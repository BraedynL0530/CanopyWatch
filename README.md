# CanopyWatch

U-net satellite-powered illegal deforestation watch, with agentic legality reasoning(future WIP alerting as well).

CanopyWatch detects changes in forest canopy from satellite imagery, classifies potential deforestation events, reasons about (potential) legality.

## Features
- U-Net based segmentation for deforestation detection made with python
- Automated satalite scanning and Ai processing
- Ipynb where i trained the model in google collab + testing
- Agentic human-in-the-loop legality reasoning
- 

## Languages
- Python: core model code, preprocessing, training, alerting
- JavaScript: web dashboard / integrations 
- Dockerfile and packaging helpers(config files)

## How it works:
This is a celery powered pipeline where it utilizes task queues to scan across Brazil(and future the world).
With the task scheduling it triggers scans with google earth engine, after the scan that triggers and nvdi delta threshold to determine if its worth calling
the u-net model, if it is worth it the u-net goes over the before and after  images(geoTiffs for near infrared) and after each pixel for both is found they subtract the probabilities(with thresholds)
to generate the deforestation mask which was exported as a png and layered over the after image along with deforestation percentage. after that the percentage, date, and more are sent over to ai agent.
which deems legality, using the IBMA dataset and data mentioned previously, it outputs its illegal or not and how bad deforestation with 4 classes: Clear, Needs Review, Illegal Logging(again potentially) and Unknown.
After all of that its pushed to frontend via RestAPI(fastApi/nginx powered) and that's the dashboard.
this is all dockerized for nginx server, backend, frontend, and Docker Compose to manage/define all the other containers.

## 🐳 Running with Docker

To spin up the entire architecture locally be sure to configure your .env and install the JSON key from google earth engine:

```bash
git clone [https://github.com/BraedynL0530/CanopyWatch.git](https://github.com/BraedynL0530/CanopyWatch.git)
cd CanopyWatch
docker-compose up --build```
