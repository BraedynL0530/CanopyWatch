from fastapi import APIRouter
from celery import Celery

app = Celery('tasks', broker='redis://localhost:6379/0') #change on prod

@app.task
def ML_output(tiff_path):
    latitude = "temp"
    longitute = "temp"
    confidence= 123 # temp
    ai_response = {"lat": latitude, "lon":longitute, "confidence":confidence}
    return ai_response