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

import * as net from 'net';
import * as winston from 'winston';
import axios from "axios";

import { AntennasManager } from './AntennasManager';


// Configuration Constants
const SOCKET_TIMEOUT = 5000; // 5 seconds
const API_TIMEOUT = 5000;


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

// Interface to define data response from satname.service
interface SatelliteResponse {
    satellite_name?: string;
    azimuth_diff?: number;
    elevation_diff?: number;
    error?: string;
  }

/**
 * Processes raw antenna data and retrieves satellite information
 */


export class AntennaClient {

    public id: number;
    public ipAddress: string;
    public deviceID: string;
    public realtime: boolean;
    public data: Record<string, any> = {};
    public info: Record<string, any>; // Información del dispositivo
    public active: boolean = true;
    private manager: AntennasManager;
    private lastSatelliteName: string | null = null;
    private baseUrl: string;
    private username: string;
    protected password: string;
    private timeout: number;
    private dataEntriesSplitted;
    private endpoints;


    constructor(id: number, deviceInfo: any, manager: AntennasManager) {
        this.id = id;
        this.baseUrl = `https://${deviceInfo.IP}/v1/`;
        this.ipAddress = deviceInfo.IP;
        this.deviceID = deviceInfo.DeviceID;
        this.username = "admin";
        this.password = deviceInfo.password || "defaultPassword"; 
        this.timeout = API_TIMEOUT;
        this.realtime = false;
        this.manager = manager;
        this.endpoints = this.manager.getEndpoints();
        this.info = deviceInfo; // Guardamos la info del JSON

        // Convert data2fetch to an input array and preprocess the split
        this.dataEntriesSplitted = Object.entries(this.manager.getData2Fetch()).map(([key, path]) => {
            const [endpointKey, ...fields] = path.split(".");
            return { key, endpointKey, fields };
        });

        this.initializeData();
    }


    /**
     * Initialize `this.data` with dynamic keys from `data2fetch`
     */
    // 
    private initializeData(): void {
        this.data = Object.keys(this.manager.getData2Fetch()).reduce((acc, key) => {
            acc[key] = null;
            return acc;
        }, {} as Record<string, any>);
    }

    public putDeviceInfo(data: {[key: string]: string}): boolean {

        let updated = true;

        // Ahora se actualizan todas las propiedades, incluso ipAddress y deviceID:
        Object.keys(data).forEach(key => {
            if (key in this.info) {
                (this.info as any)[key] = data[key];
                if (key === "IP") {
                    console.log("changing ip address")
                    this.ipAddress = data[key];
                    this.baseUrl = `https://${data[key]}/v1/`;
                    console.log(this.ipAddress)
                } else if (key === "DeviceID") {
                    this.deviceID = data[key];
                }
            } else { updated = false}
        });
        console.log(updated);
        return updated;
    }

    public patchDeviceInfo(data: { [key: string]: string }): { success: boolean, error?: string } {
        const invalidFields = Object.keys(data).filter(key => !(key in this.info));
        if (invalidFields.length > 0) {
            return { success: false, error: `No valid fields: ${invalidFields.join(", ")}` };
        }
    
        // Evitar actualización de campos críticos
        const criticalFields = ["IP", "DeviceID"];
        const hasCriticalChange = Object.keys(data).some(key => criticalFields.includes(key));
        if (hasCriticalChange) {
            return { success: false, error: "Can't update critcal fields  (IP, DeviceID)." };
        }
    
        // Actualizar campos no críticos
        Object.keys(data).forEach(key => {
            (this.info as any)[key] = data[key];
        });
    
        return { success: true };
    }

    /**
     * Processes raw antenna data and retrieves satellite information
     */
    public async fetchData(): Promise<Record<string, any>> {
        const rawData: Record<string, any> = {};
        try {

            // Execute all fetches in parallel, creating a promise per endpoint to fetch
            
            const fetchPromises = this.dataEntriesSplitted.map(async ({ key, endpointKey, fields }) => {
                const endpoint = this.endpoints[endpointKey];

                if (!endpoint) {
                    logger.error(`Endpoint not found for ${key}: ${endpointKey}`);
                    rawData[key] = null;
                    return;
                  }
                //logger.info(`Updating data for ${key} at ${this.ipAddress}`);
                try {
                    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                        auth: { username: this.username, password: this.password },
                        timeout: this.timeout,
                        httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false }),
                    });
                    //logger.info(`Updated data for ${key} at ${this.ipAddress}:`);
                    // Extract nested value
                    let value = response.data;
                    for (const field of fields) {
                        if (value && field in value) {
                        value = value[field];
                        } else {
                        value = null;
                        break;
                        }
                    }
                    rawData[key] = value;
                    
                } catch (error: unknown) {
                    if (axios.isAxiosError(error)) {
                        //const status = error.response?.status; // HTTP Code (ie. 404, 500)
                        const errorCode = error.code; // Axios internal code (ie. ECONNREFUSED)
                        const errorMessage = error.message;
                
                        logger.error(`Error for ${key} at ${this.ipAddress}: ${errorMessage}. ${errorCode}`);
                    } else {
                        logger.error(`Error desconocido: ${error}`);
                    }
                    rawData[key] = null;
                }
            });
            //logger.info(`Generando fetchPromises datos para ${this.ipAddress}`);
            await Promise.all(fetchPromises);
            //logger.info(`fetchPromises datos para ${this.ipAddress}`);
        } catch (error) {
            logger.error(`Error when fetching data at ${this.ipAddress}:`, error);
            
        }
        return rawData;
    }

    /**
     * Processes raw antenna data and retrieves satellite information
     */
    public async processData(): Promise<void> {
        try {
        const rawData = await this.fetchData();
        const processedData = this.formatData(rawData);
        
        if (this.hasValidPositionData(processedData)) {
            processedData.satellite_name = await this.getSatelliteName(processedData);
        }

        this.data = processedData;
        logger.info(`Processed data for ${this.ipAddress}`);
        } catch (error) {
        logger.error(`Data processing error for ${this.ipAddress}: ${error}`);
        }
    }

    /**
     * Formats raw data with proper numeric precision
     * @param rawData Unprocessed antenna data
     * @returns Formatted data object
     */
    private formatData(rawData: Record<string, any>): Record<string, any> {
        return Object.entries(rawData).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'number' 
            ? parseFloat(value.toFixed(key === 'latitude' || key === 'longitude' ? 6 : 2))
            : value;
        return acc;
        }, {} as Record<string, any>);
    }

    /**
     * Validates required position data fields
     * @param data Processed data object
     * @returns Boolean indicating valid position data
     */
    private hasValidPositionData(data: Record<string, any>): boolean {
        return ['latitude', 'longitude', 'azimuth', 'elevation'].every(field => data[field]);
    }

    /**
     * Retrieves satellite name via Python socket server
     * @param data Processed position data
     * @returns Satellite name or null
     */
    private async getSatelliteName(data: Record<string, any>): Promise<string | null> {
    try {
        const response = await this.queryPythonSocket(data);
        
        if (response?.satellite_name) {
        this.lastSatelliteName = response.satellite_name;
        return response.satellite_name;
        }
        
        return this.lastSatelliteName;
    } catch (error) {
        logger.error(`Satellite query failed for ${this.ipAddress}: ${error}`);
        return this.lastSatelliteName;
    }
    }
    
    /**
     * Communicates with Python socket server for satellite data
     * @param data Position data payload
     * @returns Promise with satellite response
     */
    private queryPythonSocket(data: Record<string, any>): Promise<SatelliteResponse> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Socket timeout'));
        }, SOCKET_TIMEOUT);

        socket.connect(SOCKET_TIMEOUT, '127.0.0.1', () => {
        socket.write(JSON.stringify({
            latitude: data.latitude,
            longitude: data.longitude,
            azimuth: data.azimuth,
            elevation: data.elevation
        }));
        });

        socket.on('data', (response) => {
        clearTimeout(timeout);
        try {
            resolve(JSON.parse(response.toString()));
        } catch (error) {
            reject(new Error('Invalid JSON response'));
        }
        socket.destroy();
        });

        socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
        });
    });
    }

    getData(): Record<string, any> {
        return { info: this.info, data: this.data };
    }
}

