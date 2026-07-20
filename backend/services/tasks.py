import json
import os
import uuid
import datetime #lazy fix suck it idc
from datetime import timedelta
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
from PIL import Image

load_dotenv()

app = Celery('tasks')
app.config_from_object("backend.celery_config")



SERVICE_ACCOUNT_EMAIL = os.getenv("SERVICE_ACCOUNT_EMAIL")
KEY_FILE_PATH = os.getenv("KEY_FILE_PATH")
PROJECT_ID = os.getenv("PROJECT_ID")

#helper funcs
model = None
def init_earth_engine():
    try:
        project_id = os.getenv('PROJECT_ID')
        sa_email = os.getenv('SERVICE_ACCOUNT_EMAIL')
        key_file = os.getenv('KEY_FILE_PATH')

        credentials = ee.ServiceAccountCredentials(sa_email, key_file)

        ee.Initialize(credentials, project=project_id)
        print("Authencatied")
    except Exception as e:
        ee.Authenticate()  # Only if not already authenticated
        ee.Initialize()
        print(f"Failed to authenticate with GEE: {e}")
        raise e


def generate_tiff_payload(ee_image, coords):
    return {
        "expression": ee_image,
        "fileFormat": "GEO_TIFF",
        "grid": {
            "dimensions": {
                "width": 512,
                "height": 512
            },
            "crsCode": "EPSG:4326",
            "affineTransform": {
                "scaleX": (coords[2] - coords[0]) / 512,
                "translateX": coords[0],
                "scaleY": (coords[3] - coords[1]) / 512,
                "translateY": coords[3],
                "shearX": 0,
                "shearY": 0
            }
        }
    }

def load_model():
    global model
    if model is None:
        try:
            model = forestClassifier()
            weight_path = os.getenv("MODEL_PATH")
            model.load_state_dict(torch.load(weight_path, map_location="cpu"))
            print("Model loaded successfully")
        except Exception as e:
            print(f"Failed to load model: {e}")
            raise e
    return model

def chunk_region(coords, n_lon=4, n_lat=3, overlap_pct=0.1):
    min_lon, min_lat, max_lon, max_lat = coords
    lon_step = (max_lon - min_lon) / n_lon
    lat_step = (max_lat - min_lat) / n_lat
    lon_pad = lon_step * overlap_pct
    lat_pad = lat_step * overlap_pct
    chunks = []
    for i in range(n_lon):
        for j in range(n_lat):
            chunks.append([
                min_lon + i * lon_step - lon_pad,
                min_lat + j * lat_step - lat_pad,
                min_lon + (i + 1) * lon_step + lon_pad,
                min_lat + (j + 1) * lat_step + lat_pad,
            ])
    return chunks
def save_mask_png(mask_np, path):
    heat = np.zeros((*mask_np.shape, 4), dtype=np.uint8)
    heat[mask_np == 1] = [255, 60, 60, 180]  #red where flagged
    Image.fromarray(heat, mode="RGBA").save(path)

@app.task
def ML_output(before_tiff,after_tiff, iscloudy,lat,lon):#tiffs are paths
    scan_id = (os.path.basename(before_tiff).replace("before_", "").replace(".tif", ""))
    try:
        if os.path.exists(before_tiff) and os.path.exists(after_tiff):
            with rasterio.open(before_tiff) as src:
                before_img_array= src.read().astype('float32')
            with rasterio.open(after_tiff) as src:
                after_img_array= src.read().astype('float32')

            if before_img_array.max() > 1.0:
                if before_img_array.max() > 255.0:
                    before_img_array = before_img_array / 10000.0
                else:
                    before_img_array = before_img_array / 255.0

            if after_img_array.max() > 1.0:
                if after_img_array.max() > 255.0:
                    after_img_array = after_img_array / 10000.0
                else:
                    after_img_array = after_img_array / 255.0

            before_input_tensor = torch.from_numpy(before_img_array).unsqueeze(0)
            after_input_tensor = torch.from_numpy(after_img_array).unsqueeze(0)

            model = load_model()
            model.eval()
            with torch.no_grad():
                prob_before = torch.sigmoid(model(before_input_tensor))
                prob_after = torch.sigmoid(model(after_input_tensor))

                forest_before = (prob_before >= 0.5).float()  # keep this — defines "was this forest at all"

                prob_drop = (prob_before - prob_after).clamp(min=0)
                deforestation_mask = (prob_drop >= 0.3).float()

                mask_np = deforestation_mask.squeeze().cpu().numpy()
                mask_path = f"artifacts/mask_{scan_id}.png"
                save_mask_png(mask_np, mask_path)
                print(f"[{scan_id}] Mask saved to {mask_path}")

                forest_before_np = forest_before.squeeze().cpu().numpy()
                deforested_pixels = np.count_nonzero(mask_np == 1)
                original_forest_pixels = np.count_nonzero(forest_before_np == 1)

                print(f"[{scan_id}] prob_drop stats — max: {prob_drop.max():.3f}, "
                      f"mean: {prob_drop.mean():.3f}, "
                      f"pixels 0.15-0.3: {((prob_drop >= 0.15) & (prob_drop < 0.3)).sum().item()}, "
                      f"pixels >=0.3: {(prob_drop >= 0.3).sum().item()}")
                if original_forest_pixels > 0:
                    damage_percentage = deforested_pixels / original_forest_pixels
                else:
                    damage_percentage = 0.0

            ai_response = {
                "lat": lat,
                "lon": lon,
                "cloudy_img": iscloudy,
                "damage_percentage": round(damage_percentage * 100, 2),#agent is stupid so i made it clear
                "mask_url": f"/api/static/mask_{scan_id}.png",
                "date": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d"),
                #raw mask was blowing up tokens
            }
            agent_verdict = run_agent_loop(ai_response)

            final_result = {
                "id": scan_id,
                "status": agent_verdict.get("status", "Analyzed"),
                "reason": agent_verdict.get("final_reasoning", "No significant activity found."),
                "reasoning":agent_verdict.get("reasoning", ["No significant activity found."]),
                "lat": ai_response["lat"],
                "lon": ai_response["lon"],
                "damage_percentage": ai_response["damage_percentage"],
                "timestamp": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")

            }

            with open(f"artifacts/result_{scan_id}.json", "w") as f:
                json.dump(final_result, f)
            return ai_response

    except Exception as e:
        print(f"Error: {e}")
        raise e


    finally:
        if os.path.exists(before_tiff):
            os.remove(before_tiff)

        if os.path.exists(after_tiff):
            os.remove(after_tiff)

        gc.collect()

        if torch.cuda.is_available():
            torch.cuda.empty_cache()


BRAZIL_REGIONS = {
    "para_frontier": [-56.00, -8.50, -53.50, -6.00],
    "acre_frontier": [-68.50, -10.50, -66.50, -9.00],
}

@app.task
def scan_brazil_region(region_name="para_frontier", n_lon=3, n_lat=3, lookback_days=30):
    base_coords = BRAZIL_REGIONS.get(region_name, BRAZIL_REGIONS["para_frontier"])
    for chunk in chunk_region(base_coords, n_lon, n_lat):
        scan_region.delay(chunk, lookback_days)

@app.task
def scan_all_brazil_regions(n_lon=3, n_lat=3, lookback_days=30):#future and not just brazil i decided ill refactor and this will scan more
    for region_name in BRAZIL_REGIONS:
        scan_brazil_region.delay(region_name, n_lon, n_lat, lookback_days)

@app.task
def scan_region(regioncords, lookback_days=30): #region later after i test
    init_earth_engine()
    end_date = datetime.datetime.now(datetime.UTC)
    start_date_after = end_date - timedelta(days=lookback_days)
    start_date_before = start_date_after - timedelta(days=90)
    is_cloudy = False

    #Brazil!
    coords = regioncords
    roi = ee.Geometry.Rectangle(coords)

    s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') # yes i did it twice no i dont care
                     .filterBounds(roi)
                     .filterDate(start_date_after.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')))

    cloud_stats = s2_collection.aggregate_stats('CLOUDY_PIXEL_PERCENTAGE').getInfo()
    avg_clouds = cloud_stats.get('mean', 0)

    if avg_clouds > 50:
        return {"detected": False, "reason": "Cloud cover too high (>50%). Scan aborted."}

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

        return img.addBands([ndvi ,evi])


    def get_s1_composite(start, end):
        return (ee.ImageCollection('COPERNICUS/S1_GRD')
                .filterBounds(roi)
                .filterDate(start.strftime('%Y-%m-%d'), end.strftime('%Y-%m-%d'))
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                .filter(ee.Filter.eq('instrumentMode', 'IW'))
                .median()
                .clip(roi)
                .select(['VV', 'VH']))

    image_before = get_composite(start_date_before, start_date_after)
    image_after = get_composite(start_date_after, end_date)
    s1_after = get_s1_composite(start_date_after, end_date)

    vis_params = {'bands': ['B4', 'B3', 'B2'], 'min': 0.0, 'max': 0.3}
    thumb_params = {'dimensions': '512x512', 'region': roi, 'format': 'png'}

    before_url = image_before.visualize(**vis_params).getThumbURL(thumb_params)
    after_url = image_after.visualize(**vis_params).getThumbURL(thumb_params)

    scan_id = str(uuid.uuid4())
    os.makedirs("artifacts", exist_ok=True)

    before_path = f"artifacts/before_{scan_id}.png"
    after_path = f"artifacts/after_{scan_id}.png"

    # visuals for fronteend
    with open(before_path, "wb") as f:
        f.write(requests.get(before_url).content)
    with open(after_path, "wb") as f:
        f.write(requests.get(after_url).content)


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
        clean_result = {
            "id": scan_id,
            "status": "Analyzed",
            "cloud_masked": is_cloudy,
            "reason": "No significant forest canopy loss detected.",
            "timestamp": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d"),
            "confidence": 1.0,
            "lat": (coords[1] + coords[3]) / 2,
            "lon": (coords[0] + coords[2]) / 2
        }

        with open(f"artifacts/result_{scan_id}.json", "w") as f:
            json.dump(clean_result, f)

        return {"detected": False, "reason": "No significant forest canopy loss detected."}

    ai_image_after = image_after.select(['B4', 'B3', 'B2', 'B8'])
    ai_image_before = image_before.select(['B4', 'B3', 'B2', 'B8'])

    scans = {
        "before": ai_image_before,
        "after": ai_image_after
    }

    saved_paths = {}

    for time_period, ee_img in scans.items():
        payload = generate_tiff_payload(ee_img, coords)
        tiff_path = f"artifacts/{time_period}_{scan_id}.tif"

        tiff_bytes = ee.data.computePixels(payload)

        with open(tiff_path, "wb") as f:
            f.write(tiff_bytes)

        saved_paths[time_period] = tiff_path

    centroid = roi.centroid().coordinates().getInfo()

    lon = centroid[0]
    lat = centroid[1]

    ML_output.delay(saved_paths["before"], saved_paths["after"], is_cloudy, lat, lon)






    return {
        "detected": True,
        "image_before": before_path,
        "image_after": after_path,
        "ndvi_drop": max_delta
    }


@app.task
def seed_historical_data():
    init_earth_engine()
    os.makedirs("artifacts", exist_ok=True)

    hotspots = [
        {"name": "Rondonia_Fishbone", "coords": [-62.72, -8.54, -62.60, -8.42]},
        {"name": "Mato_Grosso_Agri", "coords": [-55.15, -11.90, -55.02, -11.78]},
        {"name": "Para_Logging", "coords": [-55.02, -7.92, -54.88, -7.78]},
    ]

    start_before = datetime.datetime(2018, 6, 1, tzinfo=datetime.UTC)
    end_before = datetime.datetime(2018, 8, 31, tzinfo=datetime.UTC)

    start_after = datetime.datetime(2020, 6, 1, tzinfo=datetime.UTC)
    end_after = datetime.datetime(2020, 8, 31, tzinfo=datetime.UTC)

    def mask_clouds(img):
        qa = img.select("QA60")
        mask = (
            qa.bitwiseAnd(1 << 10).eq(0)
            .And(qa.bitwiseAnd(1 << 11).eq(0))
        )
        return img.updateMask(mask).divide(10000)

    def get_composite(start, end, roi):
        img = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(roi)
            .filterDate(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            .map(mask_clouds)
            .median()
            .clip(roi)
        )

        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")

        evi = img.expression(
            "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1.0))",
            {
                "NIR": img.select("B8"),
                "RED": img.select("B4"),
                "BLUE": img.select("B2"),
            },
        ).rename("EVI")

        return img.addBands([ndvi, evi])


    results = []

    for spot in hotspots:
        coords = spot["coords"]
        roi = ee.Geometry.Rectangle(coords)
        scan_id = f"historical_{spot['name']}_{uuid.uuid4().hex[:6]}"

        image_before = get_composite(start_before, end_before, roi)
        image_after = get_composite(start_after, end_after, roi)

        vis_params = {
            "bands": ["B4", "B3", "B2"],
            "min": 0.0,
            "max": 0.3,
        }

        thumb_params = {
            "dimensions": "512x512",
            "region": roi,
            "format": "png",
        }

        before_path = f"artifacts/before_{scan_id}.png"
        after_path = f"artifacts/after_{scan_id}.png"

        with open(before_path, "wb") as f:
            f.write(
                requests.get(
                    image_before.visualize(**vis_params).getThumbURL(thumb_params)
                ).content
            )

        with open(after_path, "wb") as f:
            f.write(
                requests.get(
                    image_after.visualize(**vis_params).getThumbURL(thumb_params)
                ).content
            )

        ai_before = image_before.select(["B4", "B3", "B2", "B8"])
        ai_after = image_after.select(["B4", "B3", "B2", "B8"])

        saved_paths = {}

        for period, ee_img in {
            "before": ai_before,
            "after": ai_after,
        }.items():
            payload = generate_tiff_payload(ee_img, coords)
            tiff_path = f"artifacts/{period}_{scan_id}.tif"

            with open(tiff_path, "wb") as f:
                f.write(ee.data.computePixels(payload))

            saved_paths[period] = tiff_path

        centroid = roi.centroid().coordinates().getInfo()
        lon = centroid[0]
        lat = centroid[1]

        ML_output.delay(
            saved_paths["before"],
            saved_paths["after"],
            False,
            lat,
            lon,
        )

        results.append(
            {
                "id": scan_id,
                "status": "Queued",
                "reason": "Historical scan queued for AI analysis.",
                "timestamp": datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d"),
                "cloud_masked": False,
                "lat": lat,
                "lon": lon,
                "before_url": f"/static/before_{scan_id}.png",
                "after_url": f"/static/after_{scan_id}.png",
            }
        )

#Debug further if needed