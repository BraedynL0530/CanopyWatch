from fastapi import FastAPI, Response, status
from backend.legality_router import router as legality_router
import ee
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()
app.include_router(legality_router)
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
def get_satellite_patch(response: Response):
    #Rondonia, Brazil
    coords = [-62.05, -10.05, -62.00, -10.00]
    roi = ee.Geometry.Rectangle(coords)

    def mask_clouds(img):
        qa = img.select('QA60')
        mask = qa.bitwiseAnd(1 << 10).eq(0).And(qa.bitwiseAnd(1 << 11).eq(0))
        return img.updateMask(mask).divide(10000)

    def get_ndvi_composite(start_date, end_date):
        img = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
               .filterBounds(roi)
               .filterDate(start_date, end_date)
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
               .map(mask_clouds)
               .median()
               .clip(roi))

        #calc NDVI
        ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI')
        return img.addBands(ndvi)

    #Fetch Before (baseline) and After (current) composites
    image_before = get_ndvi_composite('2023-01-01', '2023-03-31')
    image_after = get_ndvi_composite('2023-06-01', '2023-08-31')

    # A positive delta means vegetation was lost (Before was greener than After)
    ndvi_delta = image_before.select('NDVI').subtract(image_after.select('NDVI'))

    max_delta = ndvi_delta.reduceRegion(
        reducer=ee.Reducer.max(),
        geometry=roi,
        scale=10,
        maxPixels=1e6
    ).get('NDVI').getInfo()  #pulls the raw float number from Google cloud

    NDVI_THRESHOLD = 0.25

    if max_delta is None or max_delta < NDVI_THRESHOLD:
        #no significant forest loss detected
        response.status_code = status.HTTP_204_NO_CONTENT
        return {"message": f"No significant deforestation detected. Max NDVI drop: {max_delta}"}


    ai_ready_image = image_after.select(['B4', 'B3', 'B2', 'B8'])

    request_payload = {
        'expression': ai_ready_image,
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

    tiff_bytes = ee.data.computePixels(request_payload)

    #back to server
    return Response(content=tiff_bytes, media_type="image/tiff")


