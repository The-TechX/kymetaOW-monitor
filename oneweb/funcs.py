import asyncio
import logging
from oneweb.api_client import AntennaAPIClient

async def fetchData(client: AntennaAPIClient, endpoints: dict) -> dict:

    """
    Performs a GET request to the specified AntennaAPIClient Object and returns the JSON response as a dictionary of all the endopoints set in config.json.
    Uses the persistent session for the request.
    
    :param AntennaAPIClient: API client object.
    :param endpoints: Dictionary of endpoints to fetch.
    :return: JSON response as a dictionary, or {} if an error occurs.
    """

    data = {}
    
    for endpoint in endpoints.values():
        result = await client.fetch(endpoint)
        if not result:
            return {}
        data[endpoint] = result
        
    return data
    
async def processData(data) -> dict:
    """
    Funcin para procesar los datos de los clientes de la API.
    Retorna un diccionario con los valores procesados.
    """
    try:
        processed_data = {
            "latitude": round(data["status/position"].get("latitude"), 6),
            "longitude": round(data["status/position"].get("longitude"), 6),
            "azimuth": round(data["status/look-angle"].get("azimuth"), 3),
            "elevation": round(data["status/look-angle"].get("elevation"), 3),
            "yaw": round(data["status/orientation/ypr"].get("yaw"), 3),
            "sinrDb": round(data["status/tracking-metrics"].get("sinrDb"), 3),
            "rfPower": round(data["status/buc"].get("rfPower"), 3),
            "serial_number": data["version"].get("serial_number")
        }
    except Exception as e:
        logging.error(f"Error processing data: {e}")
        return None
    
    return processed_data

async def writeData():
    ### Funcin para escribir los datos en InfluxDB ###
    pass

async def APIClientData(client: AntennaAPIClient, endpoints: dict) -> None:
    ### Main Program to Fetch, Process and Write Data in Influx DB ###
    data = await fetchData(client, endpoints)

    if not data:
        logging.error(f"Error fetching data from {client.ip_address}")
        await asyncio.sleep(1)
        return None
    
    else:
        processed_data = await processData(data)
        
        sinr =  (processed_data.get("sinrDb"))

        logging.info(f"Data from {client.ip_address}: {sinr}")
        if not processed_data:
            logging.error(f"Error processing data from {client.ip_address}")
            await asyncio.sleep(1)
            return None
        
    await asyncio.sleep(0.25)    