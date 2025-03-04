import logging
import time, os, subprocess
from skyfield.api import load, wgs84
import numpy as np

MAX_AGE = 12*3600

TLE_PATH = "oneweb.txt"
URL_TLE = "https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle"

def ping_target(target: str, interface: str) -> tuple:
    """
    Executes a single ping to the target using the specified interface.
    Returns a tuple: (average_latency_ms, packet_loss)
      - average_latency_ms: average round-trip time in milliseconds.
      - packet_loss: 1 if packet loss occurred, 0 otherwise.
    """
    try:
        # Execute one ping with count 1 using the specified interface
        result = subprocess.run(
            ["ping", "-c", "1", "-I", interface, target],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            output = result.stdout
            # Check if there's 0% packet loss
            packet_loss = 0 if "0% packet loss" in output else 1

            # Parse the average latency from the "rtt" line.
            # Example line: "rtt min/avg/max/mdev = 10.123/10.456/10.789/0.123 ms"
            for line in output.splitlines():
                if "rtt" in line:
                    parts = line.split("=")[1].split()[0].split("/")
                    avg_latency = float(parts[1])
                    return avg_latency, packet_loss

            # If latency is not found, return 0.0 ms
            return 0.0, packet_loss

        else:
            return 0.0, 1  # If ping fails, assume packet loss

    except Exception as e:
        logging.error(f"Ping error: {e}")
        return 0.0, 1  # If an exception occurs, assume packet loss


def getLTESatData(lat_observador, lon_observador, ant_az, ant_elv, satelites) -> tuple:
    """Encuentra el satlite de OneWeb m cercano a la posici de la antena."""
    if not satelites:
        print("No se pudieron cargar los satlites desde el archivo TLE.")
        return (None, None, None)
    
    ts = load.timescale()
    t = ts.now()

    # Definir ubicacin del observador
    observador = wgs84.latlon(latitude_degrees=lat_observador,
                              longitude_degrees=lon_observador)

    # Definir tolerancia de error en la comparacin
    TOLERANCIA = 10 # 2 grado de diferencia en azimut y elevacin
    
    az_diff = None
    elv_diff = None

    for sat in satelites:
        # Calcular posicin aparente respecto al observador
        diferencia = sat - observador
        posicion = diferencia.at(t)
        
        # Extraer altitud y azimut
        alt, az, _ = posicion.altaz()

        # Solo considerar satlites con altitud mayor a 37
        if alt.degrees < 37:
            continue  # Saltar a la siguiente iteracin

        az_diff = np.abs(az.degrees - ant_az)
        elv_diff = np.abs(alt.degrees - ant_elv)

        # Comparar con la posici de la antena
        if az_diff < TOLERANCIA and elv_diff < TOLERANCIA:

            return sat.name, az_diff, elv_diff # Devolvemos el primer satite coincidente

    return (None, az_diff, elv_diff) # No se encontr un satlite con esa posicin

def is_file_outdated(file_path: str, max_age: int) -> bool:
    """
    Determina si el archivo se modifi hace s de 'max_age' segundos.
    """
    if not os.path.exists(file_path):
        return True  # Si no existe, se consdera desactualizado
    # Obtener laltima fecha de modificacin
    last_modification = os.path.getmtime(file_path)
    current_time = time.time()
    return (current_time - last_modification) > max_age 
    
def loadTLE(TLE_PATH: str) -> None:
    """
    Carga los salites OneWeb desde TLE_PATH y los devuelve como una lista (Skyfield EarthSatellite).
    """
    try:
        satelites = load.tle_file(TLE_PATH)
        print(f"? TLE cargado correctamente. Satites encontrados: {len(satelites)}")
        return satelites
    except Exception as e:
        print(f"? Error al cargar TLE desde {TLE_PATH}: {e}")
        return []

def updateTLE()-> None:
    """
    Downloads and updates the TLE file using a specified network interface via curl.
    """
    # Define la interfaz que deseas usar, por ejemplo "eth1" o la IP asociada a esa interfaz.
    INTERFACE = "eth0"  # Cambia esto segn tu configuracin; tambin se podra usar la IP, e.g. "172.25.105.3"

    try:
        # Ejecuta curl para descargar el archivo TLE, forzando la interfaz con "--interface"
        subprocess.run(
            ["curl", "-o", TLE_PATH, "--interface", INTERFACE, URL_TLE],
            check=True,
            timeout=10
        )
        print(f"? TLE updated successfully from {URL_TLE} using interface {INTERFACE}")
    except subprocess.CalledProcessError as e:
        print(f"? Error updating TLE file with curl: {e}")
    except subprocess.TimeoutExpired as e:
        print(f"? Timeout expired while updating TLE: {e}")


def main():
    """Bucle infinito que actualiza el TLE cada 24 horas."""
    while True:
        if is_file_outdated(TLE_PATH, MAX_AGE):
            print("?? Actualizando TLE...")
            updateTLE()
        else:
            print("TLEs inicando actualizados")
        print("? Esperando 24 horas para la prxima actualizacin...")
        time.sleep(86400)  # 24 horas
        

if __name__ == "__main__":
    main()
