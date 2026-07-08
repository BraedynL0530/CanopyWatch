#here it needs to use prompt, search web/region using a coordinate/legality check:
#GeoPandas is  a good one ive heard out put illegal logging(pursumed) needs permit or unknown

"""google search extras:
💻 How AI Agents Can Verify Permits in Brazil
Your AI agents can use specialized, free government data layers and platforms to query specific
coordinates:Sinaflor (IBAMA) Interactive Map: Brazil's Federal Environmental Agency (IBAMA)
runs the Sinaflor System Portal. They host an official Interactive Panel of Forestry
Exploitation Authorizations. This tool allows agents or users to cross-reference coordinates
with the exact georeferenced polygons of active, approved logging and tree-clearing permits.
SICAR (Cadastro Ambiental Rural): Every private rural property in Brazil must legally register
its geographical boundaries. Agents can query coordinates using the SICAR Public Consultation
Module to download spatial boundaries (Shapefiles). This confirms if the property is a legal
reserve where cutting is heavily banned."""

#data comes from ML model which spots deforestation, the agent pushes it to dashboard and deems if its legal
#defult is gonna be unknown or pending

#functions for that below:

def get_permit_status(lat, long):
    pass
def ai_stuff(): #rename ts
    #fetch from ai end point, do status code 202 as soon as it starts, then accept when model finishes
    pass

def push_to_dashboard(permit_status,ai_results,img):
    pass