import os
import uuid
from datetime import datetime, timedelta

import ee
import rasterio
from celery import Celery
import os
from dotenv import load_dotenv
from backend.ai.agents.legal_agent import run_agent_loop
import torch
import gc

load_dotenv()

app = Celery('tasks')
app.config_from_object("backend.celery_config")

app.conf.update(
    imports=["tasks"],
    task_always_eager=False #true to test
)

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
    if model is  None:
        model_path = os.getenv("MODEL_PATH")
        model = torch.load(model_path)
        model.load_state_dict(torch.load("canopywatch_v1.pth", map_location="cpu"))
        model.eval()
        pass
    return model
@app.task
def ML_output(tiff_path):
    try:
        if os.path.exists(tiff_path):
            with rasterio.open(tiff_path) as src:
                img_array= src.read().astype('float32')

            input_tensor = torch.from_numpy(img_array).unsqueeze(0)
            del img_array

            model = load_model()
            with torch.no_grad():
                output = model(input_tensor)
                confidence = output.softmax(dim=1)[0][1].item()
                print(f"Confidence: {confidence}")
                pass
            del input_tensor

        latitude = "temp"
        longitute = "temp"
        ai_response = {"lat": latitude, "lon":longitute, "confidence":confidence}
        run_agent_loop(ai_response)
        return ai_response


    finally:
        if os.path.exists(tiff_path):
            try:
                os.remove(tiff_path)

            except Exception as e:
                print(f"Failed to delete artifact {tiff_path}: {e}")

        gc.collect()

@app.task
def scan_region(regioncords, lookback_days=30): #region later after i test
    init_earth_engine()
    end_date = datetime.utcnow()
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

    frontend_before_img = image_before.select(

    )

    frontend_after_img = image_after.select(

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

    tiff_bytes = ee.data.computePixels(request_payload)


    filename = f"patch_{uuid.uuid4()}.tif"

    path = f"artifacts/{filename}"

    os.makedirs("artifacts", exist_ok=True)

    with open(path, "wb") as f:
        f.write(tiff_bytes)


    ML_output.delay(path)


    return {
        "detected": True,
        "image": path,
        "ndvi_drop": ndvi_delta
    }

#ok were gonna have some OOM issues on deployment, we gotta find a way to reduce gpu and ram memory, compute pixels is one of them and pytorch