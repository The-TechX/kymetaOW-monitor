import logging
import requests
import urllib3
from typing import Dict, Any

# Deshabilitar advertencias de certificados autofirmados
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class AntennaAPIClient:
    """
    Clase para conectarse a la API de una antena y realizar peticiones HTTP.
    Reutiliza una sesiÃ³n HTTP para optimizar las conexiones.
    """
    def __init__(
        self,
        ip_address: str,
        username: str = "admin",
        password: str = "2Cfg^Ant",
        timeout: int = 3
    ) -> None:
        """
        Inicializa la clase con la IP de la antena y las credenciales.

        :param ip_address: DirecciÃ³n IP de la antena (p.ej. 172.25.105.1)
        :param username: Usuario para autenticaciÃ³n
        :param password: ContraseÃ±a para autenticaciÃ³n
        :param timeout: Tiempo mÃ¡ximo de espera (segundos) para cada peticiÃ³n
        """
        self.base_url: str = f"https://{ip_address}/v1/"
        self.timeout: int = timeout
        self.logger: logging.Logger = logging.getLogger(__name__)

        # Crear una sesiÃ³n HTTP que se reutilizarÃ¡ en cada peticiÃ³n
        self.session: requests.Session = requests.Session()
        self.session.auth = (username, password)
        self.session.verify = False  # No verificar SSL (Ãºtil para certificados autofirmados)

        self.logger.debug(f"AntennaAPIClient creado para {self.base_url}")

    def __enter__(self) -> "AntennaAPIClient":
        """
        Permite usar la clase con 'with', para asegurar que la sesiÃ³n
        se cierra automÃ¡ticamente.
        """
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """
        Cierra la sesiÃ³n HTTP al salir del bloque with.
        """
        self.close()

    def fetch(self, endpoint: str) -> Dict[str, Any]:
        """
        Realiza una peticiÃ³n GET a cualquier endpoint y retorna el resultado en formato JSON.
        
        :param endpoint: Endpoint de la API (p.ej. "status/look-angle" o "version").
        :return: Diccionario con la respuesta JSON o vacÃ­o si ocurre algÃºn error.
        """
        url = f"{self.base_url}{endpoint}"
        #self.logger.info(f"Obteniendo datos de {url}...")
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()  # Lanza excepciÃ³n si el status code no es 2xx
            self.logger.debug(f"Respuesta exitosa de {url}")
            return response.json()
        except requests.exceptions.Timeout:
            self.logger.error(f"Timeout de {self.timeout}s al acceder a {url}")
        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Error de conexiÃ³n con {url}: {e}")
        except requests.exceptions.HTTPError as e:
            self.logger.error(f"Error HTTP {response.status_code} al acceder a {url}: {e}")
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error desconocido al obtener datos de {url}: {e}")
        return {}

    def close(self) -> None:
        """
        Cierra la sesiÃ³n HTTP.
        """
        self.session.close()
        self.logger.debug(f"SesiÃ³n cerrada para {self.base_url}")

def main() -> None:
    """
    FunciÃ³n principal: define la lista de antenas y los endpoints,
    instancia el cliente y realiza las peticiones a cada antena.
    """
    # Configurar logging (puedes ajustar el nivel a DEBUG si necesitas mÃ¡s detalles)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    )

    # Lista de IPs de antenas
    antennas = [
        "172.25.105.1",
        "172.25.105.2"
    ]

    # Endpoints a consultar
    endpoints = ["status/look-angle", "status/position", "status/tracking-metrics", "version"]

    for ip in antennas:
        logging.info(f"=== Procesando antena {ip} ===")
        # Usamos 'with' para que la sesiÃ³n HTTP se cierre automÃ¡ticamente
        with AntennaAPIClient(ip_address=ip) as client:
            # Obtener los datos de cada endpoint en un diccionario
            data = {endpoint: client.fetch(endpoint) for endpoint in endpoints}

            # Extraer datos especÃ­ficos si existen
            lat = data["status/position"].get("latitude")
            lon = data["status/position"].get("longitude")
            az = data["status/look-angle"].get("azimuth")
            el = data["status/look-angle"].get("elevation")
            sinr = data["status/tracking-metrics"].get("sinrDb")
            sn = data["version"].get("serial_number")

            logging.info(
                f"Antena {ip} -> Latitude: {lat}, Longitude: {lon}, "
                f"Azimuth: {az}, Elevation: {el}, "
                f"SINR: {sinr}, Firmware: {sn}"
            )

if __name__ == "__main__":
    main()
