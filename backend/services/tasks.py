import json
import os
import uuid
from datetime import datetime, timedelta
import ee
import rasterio
import requests
from celery import Celery
import os
from dotenv import load_dotenv
from backend.ai.agents.legal_agent import run_agent_loop
import torch
import gc
from backend.ai.models.model import forestClassifier
import numpy as np

load_dotenv()

app = Celery('tasks')
app.config_from_object("backend.celery_config")



SERVICE_ACCOUNT_EMAIL = os.getenv("SERVICE_ACCOUNT_EMAIL")
KEY_FILE_PATH = os.getenv("KEY_FILE_PATH")
PROJECT_ID = os.getenv("PROJECT_ID")


def init_earth_engine():
    if not ee.data._initialized:
        SERVICE_ACCOUNT_EMAIL = os.getenv("SERVICE_ACCOUNT_EMAIL")
        KEY_FILE_PATH = os.getenv("KEY_FILE_PATH")
        PROJECT_ID = os.getenv("PROJECT_ID")

        try:
            credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, KEY_FILE_PATH)
            ee.Initialize(credentials, project=PROJECT_ID)
            print("GEE Authenticated Successfully inside Worker!")
        except Exception as e:
            print(f"Failed to authenticate with GEE: {e}")
            raise e




def load_model():
    global model
    if model is None:
        model = forestClassifier()
        weight_path = os.getenv("MODEL_PATH")
        model.load_state_dict(torch.load(weight_path, map_location="cpu"))
        model.eval()
    return model

@app.task
def ML_output(tiff_path):
    scan_id = os.path.basename(tiff_path).replace("patch_", "").replace(".tif", "")

    try:
        if os.path.exists(tiff_path):
            with rasterio.open(tiff_path) as src:
                img_array= src.read().astype('float32')

            img_array = img_array / 10000.0 if img_array.max() > 255.0 else img_array / 255.0
            input_tensor = torch.from_numpy(img_array).unsqueeze(0)

            model = load_model()
            model.eval()
            with torch.no_grad():
                output = model(input_tensor)
                mask = torch.sigmoid(output).squeeze().cpu().numpy()
                forest_pixels = mask[mask > 0.5]
                confidence = float(forest_pixels.mean()) if forest_pixels.size > 0 else float(mask.mean())

            ai_response = {
                "lat": -10.02,
                "lon": -62.01,
                "confidence": round(confidence, 4),
                "date": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d"),
                "mask": mask.tolist()
            }
            agent_verdict = run_agent_loop(ai_response)

            # Build the result JSON for the frontend dashboard
            final_result = {
                "id": scan_id,
                "status": agent_verdict.get("status", "Analyzed"),
                "reason": agent_verdict.get("reason", "No significant activity found."),
                "lat": ai_response["lat"],
                "lon": ai_response["lon"],
                "confidence": ai_response["confidence"],
                "timestamp": datetime.datetime.utcnow().isoformat()

            }

            with open(f"artifacts/result_{scan_id}.json", "w") as f:
                json.dump(final_result, f)
            return ai_response

    except Exception as e:
        print(f"Error: {e}")
        raise e


    finally:
        if os.path.exists(tiff_path):
            os.remove(tiff_path)
        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

@app.task
def scan_region(regioncords, lookback_days=30): #region later after i test
    init_earth_engine()
    end_date = datetime.datetime.now(datetime.UTC)
    start_date_after = end_date - timedelta(days=lookback_days)
    start_date_before = start_date_after - timedelta(days=90)

    # Rondonia, Brazil
    coords = [-62.05, -10.05, -62.00, -10.00]
    roi = ee.Geometry.Rectangle(coords)

    def mask_clouds(img):
        qa = img.select('QA60')
        mask = (
            qa.bitwiseAnd(1 << 10).eq(0)
            .And(qa.bitwiseAnd(1 << 11).eq(0))
        )
        return img.updateMask(mask).divide(10000)

    def get_composite(start, end):
        img = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
               .filterBounds(roi)
               .filterDate(start.strftime('%Y-%m-%d'), end.strftime('%Y-%m-%d'))
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
               .map(mask_clouds)
               .median()
               .clip(roi))

        ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI')
        evi = img.expression(
            '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1.0))',
            {
                'NIR': img.select('B8'),
                'RED': img.select('B4'),
                'BLUE': img.select('B2')
            }
        ).rename('EVI')

        return img.addBands([ndvi, evi])

    image_before = get_composite(start_date_before, start_date_after) #yippe dynamic dates instead of old
    image_after = get_composite(start_date_after, end_date)


    forest_mask = image_before.select('EVI').gte(0.6).And(image_before.select('EVI').lte(0.9)) #should ignore if its not a forest
    ndvi_delta = (image_before.select('NDVI').subtract(image_after.select('NDVI')))
    significant_loss = ndvi_delta.updateMask(forest_mask).gt(0.25) #max delta reskinned.

    max_delta_obj = significant_loss.reduceRegion(
        reducer=ee.Reducer.max(),
        geometry=roi,
        scale=30,
        maxPixels=1e6
    ).get('NDVI')

    max_delta = max_delta_obj.getInfo()

    is_deforestation = significant_loss.reduceRegion(
        reducer=ee.Reducer.max(),
        geometry=roi,
        scale=30,
        maxPixels=1e6
    ).get('NDVI')

    if is_deforestation.getInfo() is None or is_deforestation.getInfo() == 0:
        return {"detected": False, "reason": "No significant forest canopy loss detected."}

    ai_ready_image = image_after.select(
        ['B4', 'B3', 'B2', 'B8']
    )


    request_payload = {
        "expression": ai_ready_image,
        "fileFormat": "GEO_TIFF",
        "grid": {
            "dimensions": {
                "width": 512,
                "height": 512
            },
            "crsCode": "EPSG:4326",
            "affineTransform": {
                "scaleX": (coords[2]-coords[0]) / 512,
                "translateX": coords[0],
                "scaleY": (coords[3]-coords[1]) / 512,
                "translateY": coords[3],
                "shearX": 0,
                "shearY": 0
            }
        }
    }

    scan_id = str(uuid.uuid4())
    os.makedirs("artifacts", exist_ok=True)
    tiff_path = f"artifacts/patch_{scan_id}.tif"

    print(f"computing pixels for: {tiff_path}")
    tiff_bytes = ee.data.computePixels(request_payload)
    with open(tiff_path, "wb") as f:
        f.write(tiff_bytes)

    vis_params = {'bands': ['B4', 'B3', 'B2'], 'min': 0.0, 'max': 0.3}
    thumb_params = {'dimensions': '512x512', 'region': roi, 'format': 'png'}

    before_url = image_before.visualize(**vis_params).getThumbURL(thumb_params)
    after_url = image_after.visualize(**vis_params).getThumbURL(thumb_params)

    before_path = f"artifacts/before_{scan_id}.png"
    after_path = f"artifacts/after_{scan_id}.png"

    #visuals for fronteend
    with open(before_path, "wb") as f:
        f.write(requests.get(before_url).content)
    with open(after_path, "wb") as f:
        f.write(requests.get(after_url).content)


    ML_output.delay(tiff_path)


    return {
        "detected": True,
        "image_before": before_path,
        "image_after": after_path,
        "ndvi_drop": max_delta
    }

