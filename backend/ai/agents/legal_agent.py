import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
from groq import Groq
import time

load_dotenv()

SYSTEM_PROMPT = """You are the CanopyWatch Legal Verification Agent. 
Your role is to synthesize technical alerts with legal records to issue a final verdict.

OPERATE IN THIS LOOP:
1. REASON: Analyze the provided data points (damage_percentage, location, date, cloudy_img, area_status, and permit_status). 
   Format: {"action": "REASON", "reasoning": "Detailed explanation using the provided data points."}
2. PUSH: Issue the final verdict.
   Format: {"action": "PUSH", "status": "string", "reasoning": "string"}

RULES:
- You must REASON at least once before PUSH.
- status must be one of: "Illegal Logging", "Needs Review", "Clear", or "Unknown".
- damage_percentage: The estimated ratio (0.0 to 1.0) of forest cleared. 

- INTERPRETING LEGALITY (ONLY IF DAMAGE > 0.0):
  * PROTECTED AREAS: If area_status is "PROTECTED", logging is strictly prohibited regardless of permits. Status: "Illegal Logging".
  * STANDARD AREAS: If permit_status is "No records found", the logging is unauthorized. Status: "Illegal Logging".
  * AUTHORIZED: If permit_status is "Valid Permit" and area is not protected, logging is authorized. Status: "Clear" or "Needs Review".

- CRITICAL OVERRIDE: If damage_percentage is 0.0, there is NO deforestation. Do not flag as illegal even if the area is protected or lacks a permit. No damage = no crime. Immediately output PUSH with status "Clear".
- DO NOT output conversational text. ONLY JSON.
"""

Permit_Api = "https://ibama.gov.br"
SINAFLOR_RESOURCE_ID = os.getenv("SINAFLOR_RESOURCE_ID")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

model = "llama-3.1-8b-instant"


def query_sinaflor_records(lat, lon):
    buffer = 0.008
    CKAN_API_URL = "https://dadosabertos.ibama.gov.br/api/3/action/datastore_search_sql"

    sql = f"""SELECT SITUACAO_AUTORIZACAO, DT_EMISSAO, DT_VALIDADE 
              FROM "{SINAFLOR_RESOURCE_ID}" 
              WHERE LATITUDE BETWEEN {lat - buffer} AND {lat + buffer} 
              AND LONGITUDE BETWEEN {lon - buffer} AND {lon + buffer}"""
    try:
        resp = requests.get(CKAN_API_URL, params={'sql': sql}, timeout=10)

        if resp.status_code == 200:
            return resp.json().get('result', {}).get('records', [])
        return []
    except:
        return []


def get_permit_status(records, event_date_str):
    if not records:
        return "No records found"

    event_dt = datetime.strptime(event_date_str, "%Y-%m-%d")
    for p in records:
        status = str(p.get("SITUACAO_AUTORIZACAO", "")).upper()
        try:
            start = datetime.strptime(p.get("DT_EMISSAO"), "%d/%m/%Y")
            end = datetime.strptime(p.get("DT_VALIDADE"), "%d/%m/%Y")

            if status in ["EMITIDA", "VALIDA", "DEFERIDO", "AUTORIZADA"] and start <= event_dt <= end:
                return "Valid Permit"
        except:
            continue

    return "No records found"

def call_llm(messages):
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    text = response.choices[0].message.content

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None

    return {
        "raw": text,
        "json": parsed,
    }


def run_agent_loop(ai_response):
    lat = ai_response.get("lat")
    lon = ai_response.get("lon")
    event_date = ai_response.get("date")

    records = query_sinaflor_records(lat, lon)
    permit_status = get_permit_status(records, event_date)
    ai_response["permit_status"] = permit_status
    history = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": json.dumps(ai_response),
        },
    ]

    reasoning_steps = []
    max_steps = 5
    current_step = 0

    while current_step < max_steps:
        result = call_llm(history)

        if result["json"] is None:
            raise RuntimeError("LLM returned invalid JSON")

        msg = result["json"]
        action = msg.get("action")

        history.append(
            {
                "role": "assistant",
                "content": json.dumps(msg),
            }
        )

        if action == "REASON":
            reasoning_steps.append(msg.get("reasoning", "Analyzing data..."))

            history.append(
                {
                    "role": "user",
                    "content": "Continue reasoning or PUSH if ready.",
                }
            )

            current_step += 1

            if current_step < max_steps: # back off becaue it was spamming groqs api
                time.sleep(15)

            continue

        if action == "PUSH":
            return {
                "status": msg["status"],
                "reasoning": reasoning_steps,
                "final_reasoning": msg["reasoning"],
            }

        raise RuntimeError(f"Unknown action: {action}")