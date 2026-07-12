import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
load_dotenv()

SYSTEM_PROMPT = """You are the CanopyWatch Legal Verification Agent. 
Your role is to synthesize technical alerts with legal records to issue a final verdict.

OPERATE IN THIS LOOP:
1. REASON: Analyze the provided AI Confidence, NDVI drop, Event Date, and Sinaflor Permit Status. 
   Format: {"action": "REASON", "reasoning": "Detailed explanation using the provided data points."}
2. PUSH: Issue the final verdict.
   Format: {"action": "PUSH", "status": "string", "reasoning": "string"}

RULES:
- You must REASON at least once before PUSH.
- status must be one of: "Illegal Logging (Presumed)", "Needs Permit", "Legal", or "Unknown".
- confidence refers to a number between 0 and 1, where 1 is 100% confidence that deforestation occured.
- Incorporate specific data points into your reasoning (e.g., 'Confidence: 0.96', 'NDVI delta: 0.3', 'Permit status: No records found').
- DO NOT output conversational text. ONLY JSON.
"""

Permit_Api = "https://ibama.gov.br"
SINAFLOR_RESOURCE_ID = os.getenv("SINAFLOR_RESOURCE_ID")

# im thinking of adding some secondary apis just for more accuracy! if i do add here :3

def query_sinaflor_records(lat, lon):
    buffer = 0.008
    sql = f"""SELECT SITUACAO_AUTORIZACAO, DT_EMISSAO, DT_VALIDADE 
              FROM "{SINAFLOR_RESOURCE_ID}" 
              WHERE LATITUDE BETWEEN {lat - buffer} AND {lat + buffer} 
              AND LONGITUDE BETWEEN {lon - buffer} AND {lon + buffer}"""
    try:
        resp = requests.get(SINAFLOR_RESOURCE_ID, params={'sql': sql}, timeout=10)
        return resp.json().get('result', {}).get('records', []) if resp.status_code == 200 else []
    except:
        return []


def get_permit_status(records, event_date_str):
    if not records: return "Illegal Logging (Presumed)"

    event_dt = datetime.strptime(event_date_str, "%Y-%m-%d")
    for p in records:
        status = str(p.get("SITUACAO_AUTORIZACAO", "")).upper()
        try:
            start = datetime.strptime(p.get("DT_EMISSAO"), "%d/%m/%Y")
            end = datetime.strptime(p.get("DT_VALIDADE"), "%d/%m/%Y")
            if status in ["EMITIDA", "VALIDA"] and start <= event_dt <= end:
                return "Legal"
        except:
            continue
    return "Illegal Logging (Presumed)"

def call_llm():
    pass


def run_agent_loop(ai_response):
    pass