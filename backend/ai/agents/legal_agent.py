import json
from datetime import datetime
import requests
from dotenv import load_dotenv
import os
from groq import Groq

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
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

model = "llama-3.1-8b-instant" # idiot forgot it was temp
# add real model later
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

    while True:
        result = call_llm(history)

        if result["json"] is None:
            raise RuntimeError("LLM returned invalid JSON")

        msg = result["json"]

        history.append(
            {
                "role": "assistant",
                "content": json.dumps(msg),
            }
        )

        action = msg.get("action")

        if action == "REASON": # likely wont reason more than once but i like it ok?
            reasoning_steps.append(
                {
                    "summary": msg["reasoning"]
                }
            )

            history.append(
                {
                    "role": "user",
                    "content": "Continue reasoning or PUSH if ready.",
                }
            )

            continue

        if action == "PUSH":
            return {
                "status": msg["status"],
                "reasoning": reasoning_steps,
                "final_reasoning": msg["reasoning"],
            }

        raise RuntimeError(f"Unknown action: {action}")