
/**
 * Satellite Data Processing System
 * 
 * Module: Antenna Client and Manager
 * Description: Handles communication with antennas and data processing via Python socket server
 * Date: 03/11/2025 
 * Created by: Oscar Flores
 * Property of: Viasat Inc.
 */

// Modules
import * as fs from "fs";

import * as winston from 'winston';
import { WebSocketServer, WebSocket } from "ws";
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import express = require("express");

// import https = require('https');

import { AntennaClient } from './AntennaClient';
import { send } from "process";
import { get } from "https";

// Configuration Constants
const CONFIG_PATH = '../cfg/config.json';
const DEVICES_PATH = '../cfg/devices.json';
const WS_PORT = 8765
const HTTP_PORT = 8080;
const INFLUX_CONFIG = {
  url: 'http://localhost:8086',
  token: 'BnOlaA2L_XA_HtcoujJis8AlYsV2NOhoHh3au5maPmeoUEBoN8Bb3W2oZGwVdiedPfahGCNotfp3XgMUdtx19g==',
  bucket: 'kymeta_oneweb',
  org: 'viasat'
};


/*

// HTTPS Options... No needed in local network

const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname,'ssl', 'cert.pem'))
};
*/

// Initialize Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(), // Habilita colores en la consola
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
    ),
    transports: [
      new winston.transports.Console(), // Los colores solo se aplican en la consola
      new winston.transports.File({ 
        filename: 'application.log',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
        )
      })
    ]
  });

// Initialize InfluxDB client
const influxDB = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
const writeApi = influxDB.getWriteApi(INFLUX_CONFIG.org, INFLUX_CONFIG.bucket);

/**
 * Processes raw antenna data and retrieves satellite information
 */
export class AntennasManager {
    private lastID: number = 1;
    private endpoints: Record<string, string> = {};
    private data2fetch: Record<string, string> = {};
    public antennas: AntennaClient[] = [];
    private devices: any[] = [];
    private subscriptions: Map<AntennaClient, Map<WebSocket, string>> = new Map();
    private app: express.Application | undefined;
    private wss: WebSocketServer | undefined;

    constructor(configPath = CONFIG_PATH, devicesPath = DEVICES_PATH) {
        this.logBanner();
        this.loadConfigAndDevices(configPath, devicesPath);
        this.startServers();
        this.initializeSubscriptions();
    }

    private logBanner(): void {
        logger.info("  **********************************************");
        logger.info("  *                                            *");
        logger.info("  *        Initializing Antenna Manager        *");
        logger.info("  *                                            *");
        logger.info("  **********************************************");
        logger.info("    Developed by: Oscar Flores & German Sunza");
        logger.info("    Property of Viasat\n");
    }

    private loadConfigAndDevices(configPath: string, devicesPath: string): void {
        const config = this.loadConfig(configPath);
        this.endpoints = config.endpoints;
        this.data2fetch = config.data2fetch;
        this.loadDevices(devicesPath);
    }

    private startServers(): void {
        try {
            this.app = express();
            const server = this.app.listen(HTTP_PORT, '0.0.0.0',  () => {
                logger.info(`API REST listening on port: ${HTTP_PORT}`);
            });

            this.loadAPIREST();
            
            server.on('error', (error: NodeJS.ErrnoException) => {
                logger.error("HTTP Server Error:", error);
                process.exit(1); // Detiene el programa si hay un error en el HTTP Server
            });

            this.wss = new WebSocketServer({ port: WS_PORT });
            this.wss.on('error', (error: NodeJS.ErrnoException) => {
                logger.error("WebSocket Server Error:", error);
                process.exit(1); // Detiene el programa si hay un error en WebSocket Server
            });

            this.handleWebSocketConnections();
            logger.info(`WebSocket server listening on port: ${WS_PORT}`);
        } catch (error) {
            logger.error(`Error initializing servers: ${error}`);
            process.exit(1); // Detiene el programa si hay un error general
        }
    }

    private handleWebSocketConnections(): void {
        if (this.wss){
            this.wss.on("connection", (socket) => {
                logger.info("New client connected.");
                
                socket.on("message", (message) => {
                    try {
                        const request = JSON.parse(message.toString());
                        if (request.ipAddress && request.streamType) {
                            logger.info(`Client subscribed to ${request.streamType} of antenna ${request.ipAddress}`);
                            const antenna = this.antennas.find(a => a.ipAddress === request.ipAddress);
                            if (antenna) {
                                antenna.realtime = true;
                                this.subscribeClient(socket, antenna, request.streamType);
                                console.log(antenna.realtime)
                            }
                        }
                    } catch (error) {
                        logger.error("Invalid message format:", message);
                    }
                });
    
                socket.on("close", () => {
                    logger.info("Client disconnected.");
                    this.unsubscribeClient(socket);
                });
            });
        }
    }

    private initializeSubscriptions(): void {
        for (const antenna of this.antennas) {
            this.subscriptions.set(antenna, new Map());
        }
    }
    
    /**
     * Load all API REST endpoints.
     */
    private loadAPIREST(){
        if (this.app){

            // Agrega el middleware para parsear JSON
            this.app.use(express.json());

            this.app.get("/", (_, res) => {
                res.json({message: "Hello app root"});
            });

            this.app.get("/cms/api/v1/hello", (_, res) => {
                res.json({message: "Hello API REST"});
            });

            this.app.get("/cms/api/v1/config", (_, res) => {
                res.json({
                    endpoints: this.endpoints,
                    data2fetch: this.data2fetch
                });
            });

            // Obtener todas las antenas
            this.app.get("/cms/api/v1/devices/antennas", (req, res) => {
                const filterBy = req.query.filter as string; // Ej: ?filter=siteId:12345
                let result = this.antennas;
                
                if (filterBy) {
                    const [key, value] = filterBy.split(':');
                    console.log(result[0].info[key])
                    result = result.filter(a => a.info[key] === value);
                }
                
                res.json(result.map(a => this.sanitizeAntennaData(a)));
            });

            // http://localhost/cms/api/v1/devices/antennas/ID/by/deviceID or http://localhost/cms/api/v1/devices/antennas/ID/by/ipAddress
            this.app.get("/cms/api/v1/devices/antennas/ID/by/:field", (req, res) => {

                const allowedFields: (keyof Pick<AntennaClient, 'deviceID' | 'ipAddress'>)[] = ['deviceID', 'ipAddress'];
                const searchField = req.params.field as keyof AntennaClient;
                
                if (!allowedFields.includes(searchField as any)) {
                    res.status(403).json({ error: "Acceso no autorizado" });
                    return;
                }
                
                res.json(this.getAllID(searchField));
            });

            // Get info about any antenna by ID. In preference, ID must be related to DeviceID integer number, i.e (ID: 1) = (DeviceID: KYM01)
            this.app.get("/cms/api/v1/devices/antennas/:antennaID", (req, res) => {
                try {
                    const antennaID = Number(req.params.antennaID); // Convertir a número

                    // Buscar la antena por el valor
                    const antenna = this.antennas.find(a => a.id === antennaID);

                    if (!antenna) {
                        res.status(404).json({ message: "Antenna no encontrada" });
                        return;
                    }

                    res.json(this.sanitizeAntennaData(antenna));
                } catch (error) {
                    console.error("Error al obtener la antena:", error);
                    res.status(500).json({ message: "Error interno del servidor" });
                }
            });

            // PUT NEW ANTENNA
            this.app.put("/cms/api/v1/devices/antennas/", (req, res) => {
                try {

                    const updateData = req.body;

                    if (!updateData) {
                        res.status(404).json({ error: `Missing Data.` });
                        return;
                    }
                    
                    if (!this.addAntenna(updateData)){
                        res.status(400).json({ error: "Can't update data. Some fields may be incorrect. Please check the docs for the PUT method."  });
                        return;
                    }
            
                    res.json({"message": "ok"});
              
                } catch (error) {
                  res.status(500).json({ error: "Error in server." });
                }
              });
            
            // PUT CRITICAL DATA LIKE IP OR DEVICE ID ON EXISTING ANTENNA
            this.app.put("/cms/api/v1/devices/antennas/:antennaID", (req, res) => {
                try {
                    // Ejemplo: PATCH /cms/api/v1/devices/antenna?searchIP=172.25.105.4&searchDeviceID=12345
                    const antennaID = Number(req.params.antennaID); // Convertir a número
                    const updateData = req.body;

                    if (!updateData || Object.keys(updateData).length === 0) {
                        res.status(400).json({ error: `Bad Request. Empty request body.` });
                        return;
                    }

                    // Buscar la antena por el valor
                    const antennaToUpdate = this.antennas.find(a => a.id === antennaID);

                    if (!antennaToUpdate) {
                        res.status(404).json({ error: `Can't find antenna with ID: ${antennaID}.` });
                        return;
                    }
                    
                    const updateResult = antennaToUpdate.patchDeviceInfo(updateData);
                    if (!updateResult.success) {
                        res.status(400).json({ error: updateResult.error });
                        return;
                    }
                    
                    res.status(200).json({ message:  `Antenna ID: ${antennaID}. Succesfully updated. ` });
              
                } catch (error) {
                  res.status(500).json({ error: "Error in server." });
                }
              });

            this.app.patch("/cms/api/v1/devices/antennas/:antennaID", (req, res) => {
                try {
                    // Ejemplo: PATCH /cms/api/v1/devices/antenna?searchIP=172.25.105.4&searchDeviceID=12345
                    const antennaID = Number(req.params.antennaID); // Convertir a número
                    const updateData = req.body;

                    if (!updateData || Object.keys(updateData).length === 0) {
                        res.status(400).json({ error: `Bad Request. Empty request body.` });
                        return;
                    }

                    // Buscar la antena por el valor
                    const antennaToUpdate = this.antennas.find(a => a.id === antennaID);

                    if (!antennaToUpdate) {
                        res.status(404).json({ error: `Can't find antenna with ID: ${antennaID}.` });
                        return;
                    }
                    
                    const updateResult = antennaToUpdate.patchDeviceInfo(updateData);
                    if (!updateResult.success) {
                        res.status(400).json({ error: updateResult.error });
                        return;
                    }
                    
                    res.status(200).json({ message:  `Antenna ID: ${antennaID}. Succesfully updated. ` });
              
                } catch (error) {
                  res.status(500).json({ error: "Error in server." });
                }
              });

            this.app.delete("/cms/api/v1/devices/antennas/:antennaID", (req, res) => {
            
                const antennaID = Number(req.params.antennaID); // Convertir a número

                if(!this.deleteAntennaByID(antennaID)){
                    res.status(404).json({ error: `Can't find antenna with ID: ${antennaID}.` });
                    return
                }

                else {
                    console.log(this.getAllID)
                    res.json({"message": "ok"});
                }

            });
        }
        
    }


    private sanitizeAntennaData(antenna: AntennaClient): any {
        // Eliminar información sensible
        const { password, ...safeData } = antenna.info;
        return {
            ...safeData,
            //status: antenna.status,
            //lastUpdate: antenna.lastUpdate
        };
    }

    /**
     * Agrega un WebSocket y su topic a una antena específica.
     */
    private subscribeClient(socket: WebSocket, antenna: AntennaClient, topic: string): void {
        const remoteAddress = (socket as any)._socket?.remoteAddress;
        const remotePort = (socket as any)._socket?.remotePort;
        console.log(remoteAddress)
        console.log(remotePort)
        this.subscriptions.get(antenna)!.set(socket, topic);
        console.log(`Subscribed socket to ${antenna.ipAddress} with topic: ${topic}`);
    }

    /**
     * Elimina un WebSocket de todas las antenas a las que estaba suscrito.
     */
    private unsubscribeClient(socket: WebSocket): void {
        for (const [antenna, sockets] of Array.from(this.subscriptions.entries())) {
            if (sockets.has(socket)) {
                sockets.delete(socket);
                console.log(`Unsubscribed socket from ${antenna.ipAddress}`);
                break; // Detenemos la búsqueda una vez que encontramos y eliminamos el socket
            }
        }
    }
    

    /**
     * Obtiene todas las suscripciones de una antena específica.
     */
    private getSubscriptions(antenna: AntennaClient): Map<WebSocket, string> | undefined {
        return this.subscriptions.get(antenna);
    }

    /**
     * Obtiene todas las suscripciones de todas las antenas.
     */
    private getAllSubscriptions(): Map<AntennaClient, Map<WebSocket, string>> {
        return this.subscriptions;
    }
    
    private loadConfig(configPath: string): any {
        try {
            const rawData = fs.readFileSync(configPath, "utf-8");
            return JSON.parse(rawData);
        } catch (error) {
            console.error("Error loading config file:", error);
            return { endpoints: {}, data2fetch: {} };
        }
    }

    private loadDevices(devicesPath: string): void {
        try {
            const rawData = fs.readFileSync(devicesPath, "utf-8");
            const devices = JSON.parse(rawData);
            this.devices = devices.antennas || [];

            this.devices.forEach((device) => this.addAntenna(device));
        } catch (error) {
            console.error("Error loading devices file:", error);
            this.devices = [];
        }
    }

    private addAntenna(deviceInfo: any): boolean {
        if (!deviceInfo.IP || !deviceInfo.DeviceID) {
            logger.error(`Faltan propiedades requeridas en deviceInfo: ${JSON.stringify(deviceInfo)}`);
            return false;
        }

        // Verificar si ya existe una antena con el mismo deviceID o ipAddress
        const duplicateAntenna = this.antennas.find(antenna =>
            antenna.deviceID === deviceInfo.DeviceID || antenna.ipAddress === deviceInfo.IP
        );
        if (duplicateAntenna) {
            logger.error(`Ya existe una antena con deviceID: ${deviceInfo.DeviceID} o IP: ${deviceInfo.IP}`);
            return false;
        }

        const antenna = new AntennaClient(this.lastID, deviceInfo, this);
        this.antennas.push(antenna);
        logger.info(`Antenna added: ${deviceInfo.IP} (deviceID: ${deviceInfo.DeviceID}, ID: ${this.lastID})`);
        this.runAntenna(antenna);
        ++this.lastID;
        return true;
    }

    private async sendData2Websocket(antenna: AntennaClient, subscribers: Map<WebSocket, string>) {

        for (const [socket, topic] of Array.from(subscribers.entries())) {
            const remoteAddress = (socket as any)._socket?.remoteAddress || "unknown";
            console.log(`- Socket [${remoteAddress}] suscrito al topic: ${topic}`);

            console.log(antenna.data.sinrDb);
    
            switch (topic){
                case "polar_plot":
                    socket.send(JSON.stringify({
                        ipAddress: antenna.ipAddress,
                        azimuth: antenna.data.azimuth,
                        elevation: antenna.data.elevation,
                        sinrDb: antenna.data.sinrDb,
                        rfPower: antenna.data.rfPower,
                    }));
                case "tracking_metrics":
                    socket.send(JSON.stringify({
                        ipAddress: antenna.ipAddress,
                        azimuth: antenna.data.azimuth,
                        elevation: antenna.data.elevation,
                        sinrDb: antenna.data.sinrDb,
                        rfPower: antenna.data.rfPower,
                        satellite_name: antenna.data.satellite_name,
                    }));
                
                default:
                    const dynamicValue = antenna.data[topic as keyof typeof antenna.data];
                    socket.send(JSON.stringify({ [topic]: dynamicValue }));
            }
        }
    }
    
    private async sendDataToDB(antenna: AntennaClient): Promise<void> {

        try {
            
            let point = new Point("logs").tag("IP", antenna.ipAddress); // Usamos la IP como tag
        
            if (antenna.data){
                // Iterar sobre los datos y agregar solo los valores que no sean null
                for (const [key, value] of Object.entries(antenna.data)) {
                    if (value !== null) {
                    if (typeof value === "number") {
                        point = point.floatField(key, value); // Agregar como campo numérico
                    } else if (typeof value === "string") {
                        point = point.stringField(key, value); // Agregar como campo de texto
                    }
                    }
                }

                writeApi.writePoint(point);
                await writeApi.flush();

                logger.info(`Data sended to DB from ${antenna.ipAddress}`);

            } else {
                logger.error("No valid data to write to InfluxDB");

            }

        } catch (error) {
            logger.error("Error writing data");

        }

    }

    private async runAntenna(antenna: AntennaClient): Promise<void> {

        const dbInterval = setInterval(() => {
            if (antenna.data) {
                this.sendDataToDB(antenna);
            }
        }, 5000);
    
        while (antenna.active) {
            await antenna.processData();
            logger.info(`Data from ${antenna.ipAddress}: ${antenna.data.sinrDb}`);
    
            const subscribers = this.subscriptions.get(antenna);
    
            if (antenna.realtime && subscribers && subscribers.size > 0) {
                this.sendData2Websocket(antenna, subscribers);
                await new Promise(resolve => setTimeout(resolve, 50));
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        // Cuando antenna.active sea false, salimos del loop y cancelamos el intervalo:
        clearInterval(dbInterval);
    }

    private deleteAntennaByID(id: number): boolean {
        const index = this.antennas.findIndex(antenna => antenna.id === id);
        if (index === -1) {
            return false; // No se encontró la antena
        }
        // Detener el ciclo de procesamiento de la antena:
        this.antennas[index].active = false;
        // Si además tienes suscripciones u otros recursos asociados, también límpialos
        this.antennas.splice(index, 1); // Elimina la antena del array
        return true;
    }

    public getEndpoints(): Record<string, string> {
        return this.endpoints;
    }

    public getData2Fetch(): Record<string, string> {
        return this.data2fetch;
    }

    public getAllData(): Record<string, any>[] {
        return this.antennas.map((antenna) => antenna.getData());
    }

    /*public getInstancesInfo(): Record<string, string>[] {
        return this.antennas.map((antenna) => antenna.ipAddress);
    }*/

    private getAllID(searchField: keyof AntennaClient): { [key: string]: number } {
        const result: { [key: string]: number } = {};
    
        for (const antenna of this.antennas) {
            const key = antenna[searchField];
            result[key.toString()] = antenna.id;
        }
    
        return result;
    }

    public async run(): Promise<void> {

        //await Promise.all(this.antennas.map((antenna) => antenna.processData()));
    
        for (const antenna of this.antennas) {

            //this.runAntenna(antenna);
        }
    }

}