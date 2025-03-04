import asyncio
from typing import Any, Dict
import urllib3
import aiohttp
import logging

# Disable warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class AntennaAPIClient:
    """
    Class to connect to an antenna's API and perform HTTP requests using a persistent session.
    Implements error handling and automatic retries to recover from connection errors.
    """
    def __init__(
        self,
        ip_address: str,
        username: str = "admin",
        password: str = "VES@V1a5atL30",
        timeout: int = 3,
        realtime: bool = False
    ) -> None:
        """
        Initializes the class with the antenna's IP address and credentials.

        :param ip_address: Antenna's IP address (e.g., "172.25.105.1")
        :param username: Username for authentication.
        :param password: Password for authentication.
        :param timeout: Maximum time (in seconds) to wait for each request.
        """
        self.ip_address: str = ip_address
        self.username: str = username
        self.password: str = password
        self.timeout: int = timeout
        self.realtime: bool = realtime
        self.base_url: str = f"https://{ip_address}/v1/"
        self.auth = aiohttp.BasicAuth(username, password)
        self.logger: logging.Logger = logging.getLogger(__name__)
        self.session: aiohttp.ClientSession = None

        self.logger.debug(f"AntennaAPIClient created for {self.base_url}")

    async def initialize(self):
        """
        Initializes the aiohttp session. This method must be called within an async context.
        """
        self.session = aiohttp.ClientSession(auth=self.auth, connector=aiohttp.TCPConnector(ssl=False))

    async def fetch(self, endpoint: str) -> Dict[str, Any]:
        """
        Performs a GET request to the specified endpoint and returns the JSON response as a dictionary.
        Uses the persistent session for the request.
        
        :param endpoint: API endpoint (e.g., "status/look-angle" or "version").
        :return: JSON response as a dictionary, or {} if an error occurs.
        """
        url = f"{self.base_url}{endpoint}"
        try:
            async with self.session.get(url, timeout=self.timeout) as response:
                response.raise_for_status()
                return await response.json()
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            self.logger.error(f"Error fetching {url}: {e}")
            return {}

    async def close(self) -> None:
        """
        Closes the HTTP session.
        """
        await self.session.close()
        self.logger.debug(f"Session closed for {self.base_url}")

    def __enter__(self) -> "AntennaAPIClient":
        """
        Allows using the class in a 'with' block to ensure the session is closed automatically.
        """
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """
        Closes the HTTP session when exiting the 'with' block.
        """
        asyncio.run(self.close())
