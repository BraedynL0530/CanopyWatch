from fastapi import FastAPI, Response
import ee
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

#GEE stuff
SERVICE_ACCOUNT_EMAIL = os.getenv("SERVICE_ACCOUNT_EMAIL")
KEY_FILE_PATH = os.getenv("KEY_FILE_PATH")
PROJECT_ID = os.getenv("PROJECT_ID")

try:
    credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT_EMAIL, KEY_FILE_PATH)
    ee.Initialize(credentials, project=PROJECT_ID)
    print("GEE Authenticated Successfully!")
except Exception as e:
    print(f"Failed to authenticate with GEE: {e}")


@app.get("/api/get-satellite-patch")
def get_satellite_patch():
    #uses Rondonia, Brazil due to GEE rate/size limits
    coords = [-62.05, -10.05, -62.00, -10.00]
    roi = ee.Geometry.Rectangle(coords)

    # Cloud masking
    def mask_clouds(img):
        qa = img.select('QA60')
        mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
        return img.updateMask(mask).divide(10000)

    # Fetch and process the dataset
    dataset = (ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
               .filterBounds(roi)
               .filterDate('2023-06-01', '2023-08-31')
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
               .map(mask_clouds))

    image_after = dataset.median().clip(roi).select(['B4', 'B3', 'B2', 'B8'])

    request_payload = {
        'expression': image_after,
        'fileFormat': 'GEO_TIFF',
        'grid': {
            'dimensions': {'width': 512, 'height': 512},
            'crsCode': 'EPSG:4326',
            'affineTransform': {
                'scaleX': (coords[2] - coords[0]) / 512,
                'shearX': 0,
                'translateX': coords[0],
                'shearY': 0,
                'scaleY': (coords[3] - coords[1]) / 512,
                'translateY': coords[3]
            }
        }
    }

    #Get raw GeoTIFF bytes
    tiff_bytes = ee.data.computePixels(request_payload)

    #Return the bytes directly as a downloadable/readable TIFF file
    return Response(content=tiff_bytes, media_type="image/tiff")