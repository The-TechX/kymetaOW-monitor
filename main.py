from oneweb.api_client import AntennaAPIClient
import asyncio
import logging
import json
import websockets

# Configuracin del logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)

with open("cfg/config.json", "r") as file:
    config = json.load(file)

clients = {}

# Dictionary mapping serial numbers to tags
antenna_tags = {antenna["SN"]: antenna["ID"] for antenna in config["antennas"]} # Diccionario que mapea los nmeros de serie a las etiquetas

# List of antenna IP addresses
endpoints = config["endpoints"]  # Lista de direcciones IP de las antenas

connected_clients = set()  # Conjunto de clientes conectados

subscriptions = dict()  # Diccionario {ip_address: {set de websockets}}


async def fetchData(client: AntennaAPIClient) -> dict:  # Funcin que usa solo los atributos iniciales
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

async def writeDataInDB():
    ### Funcin para escribir los datos en InfluxDB ###
    pass
    
async def WebsocketHandler(websocket):
    connected_clients.add(websocket)
    try:
        async for message in websocket:
            ip_requested = message.strip()  # IP de la antena solicitada
            if ip_requested in clients:
                client = clients[ip_requested]

                # Añadir WebSocket a la lista de suscripciones
                if ip_requested not in subscriptions:
                    subscriptions[ip_requested] = set()
                subscriptions[ip_requested].add(websocket)

                # Activar modo real-time si hay al menos un suscriptor
                client.realtime = True  
                logging.info(f"Client {websocket.remote_address} subscribed to {ip_requested}")
                
                await websocket.send(f"Subscribed to {ip_requested}")

    except websockets.ConnectionClosedError:
        logging.info(f"Client disconnected: {websocket.remote_address}")

    finally:
        connected_clients.remove(websocket)
        # Remover cliente de todas las suscripciones activas
        for ip, subscribers in subscriptions.items():
            subscribers.discard(websocket)
            if not subscribers:  # Si ya no hay suscriptores para esta IP
                clients[ip].realtime = False  # Desactivar modo real-time
                logging.info(f"No more subscribers for {ip}, disabling real-time mode.")


async def APIClientData(client: AntennaAPIClient) -> None:
    while True:
        data = await fetchData(client)

        if not data:
            logging.error(f"Error fetching data from {client.ip_address}")
            await asyncio.sleep(1)
            continue

        processed_data = await processData(data)
        if not processed_data:
            logging.error(f"Error processing data from {client.ip_address}")
            await asyncio.sleep(1)
            continue

        sinr = processed_data.get("sinrDb")
        logging.info(f"Data from {client.ip_address}: {sinr}")

        # Copiar suscriptores antes de iterar para evitar RuntimeError
        subscribers = list(subscriptions.get(client.ip_address, []))

        for websocket in subscribers:
            try:
                await websocket.send(json.dumps({"ip": client.ip_address, "sinr": sinr}))
            except websockets.ConnectionClosed:
                logging.info(f"Removing disconnected client {websocket.remote_address}")
                subscriptions[client.ip_address].discard(websocket)

        # Ajustar el tiempo de espera según realtime
        await asyncio.sleep(0.1 if client.realtime else 5)

async def run_client(client):
    while True:
        await APIClientData(client)

async def main():
    logging.info("Starting clientAPI_backend server...")
    ws_server = await websockets.serve(WebsocketHandler, "0.0.0.0", 8765)

    for antenna in config["antennas"]:
        ip = antenna["IP"]
        password = antenna["password"]
        client = AntennaAPIClient(ip_address=ip, password=password)
        clients[ip] = client

    await asyncio.gather(*(client.initialize() for client in clients.values()))

    asyncio.create_task(ws_server.wait_closed())

    for client in clients.values():
        asyncio.create_task(run_client(client))  # Cada cliente tiene su propia tarea
        
    while True:
        await asyncio.sleep(1)  # Evitar que main() termine

if __name__ == "__main__":
    
    asyncio.run(main())
