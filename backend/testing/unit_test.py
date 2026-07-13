import unittest
from backend.ai.agents.legal_agent import run_agent_loop,get_permit_status


class Test_agent(unittest.TestCase):# make sure ai isnt an idiot and all other test cases
    mock_records = [{"SITUACAO_AUTORIZACAO": "VALIDA", "DT_EMISSAO": "01/01/2023", "DT_VALIDADE": "31/12/2023"}]
    #happens inside the window
    assert get_permit_status(mock_records, "2023-06-01") == "Legal"
    #happens outside the window
    assert get_permit_status(mock_records, "2024-01-01") == "Illegal Logging (Presumed)"

    #ai stuff once llm is hooked up below:
