from oneweb.api_client import AntennaAPIClient
import asyncio
import logging

# Configuracin del logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)

new_client = AntennaAPIClient(ip_address="192.168.0.1")

# List of antenna IP addresses
antennas = [
    "172.25.105.1",
    "172.25.105.2",

]

# Dictionary mapping serial numbers to tags
antenna_tags = {
    "ACH435K230324569": "VES-MX-KYM01",
    "ACH0000W23352514": "VES-MX-KYM02",

}

endpoints = [
    "status/look-angle",
    "status/position",
    "status/orientation/ypr",
    "status/tracking-metrics",
    "status/buc",
    "version",
]


async def tarea_externa(instance):  # Funcin que usa solo los atributos iniciales
    data = {endpoint: await instance.aio_fetch(endpoint) for endpoint in endpoints}
    lat = round(data["status/position"].get("latitude"), 6)
    lon = round(data["status/position"].get("longitude"), 6)
    
    logging.info(f"Antenna {instance.ip_address} -> {lat}, {lon}")
    await asyncio.sleep(5)
    return data
        

async def main():
    # Crear un cliente para cada antena
    clients = {ip: AntennaAPIClient(ip) for ip in antennas}

        # Inicializar las sesiones de los clientes
    await asyncio.gather(*(client.initialize() for client in clients.values()))


    # Imprimir el diccionario de clientes
    for ip, client in clients.items():
        print(f"Antenna IP: {ip}, Client: {client.ip_address}")

    while True:
        await asyncio.gather(*(tarea_externa(client) for _, client in clients.items()))

if __name__ == "__main__":
    asyncio.run(main())
