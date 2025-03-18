"use strict";
/**
 * Satellite Data Processing System
 *
 * Module: Antenna Client and Manager
 * Description: Handles communication with antennas and data processing via Python socket server
 * Date: 03/11/2025
 * Created by: Oscar Flores
 * Property of: Viasat Inc.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntennaClient = void 0;
// Modules
var net = require("net");
var winston = require("winston");
var axios_1 = require("axios");
// Configuration Constants
var SOCKET_TIMEOUT = 5000; // 5 seconds
var API_TIMEOUT = 5000;
/*

// HTTPS Options... No needed in local network

const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname,'ssl', 'cert.pem'))
};
*/
// Initialize Winston logger
var logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.colorize(), // Habilita colores en la consola
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(function (info) { return "".concat(info.timestamp, " [").concat(info.level, "]: ").concat(info.message); })),
    transports: [
        new winston.transports.Console(), // Los colores solo se aplican en la consola
        new winston.transports.File({
            filename: 'application.log',
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(function (info) { return "".concat(info.timestamp, " [").concat(info.level, "]: ").concat(info.message); }))
        })
    ]
});
/**
 * Processes raw antenna data and retrieves satellite information
 */
var AntennaClient = /** @class */ (function () {
    function AntennaClient(id, deviceInfo, manager) {
        this.data = {};
        this.active = true;
        this.lastSatelliteName = null;
        this.id = id;
        this.baseUrl = "https://".concat(deviceInfo.IP, "/v1/");
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
        this.dataEntriesSplitted = Object.entries(this.manager.getData2Fetch()).map(function (_a) {
            var key = _a[0], path = _a[1];
            var _b = path.split("."), endpointKey = _b[0], fields = _b.slice(1);
            return { key: key, endpointKey: endpointKey, fields: fields };
        });
        this.initializeData();
    }
    /**
     * Initialize `this.data` with dynamic keys from `data2fetch`
     */
    // 
    AntennaClient.prototype.initializeData = function () {
        this.data = Object.keys(this.manager.getData2Fetch()).reduce(function (acc, key) {
            acc[key] = null;
            return acc;
        }, {});
    };
    AntennaClient.prototype.putDeviceInfo = function (data) {
        var _this = this;
        var updated = true;
        // Ahora se actualizan todas las propiedades, incluso ipAddress y deviceID:
        Object.keys(data).forEach(function (key) {
            if (key in _this.info) {
                _this.info[key] = data[key];
                if (key === "IP") {
                    console.log("changing ip address");
                    _this.ipAddress = data[key];
                    _this.baseUrl = "https://".concat(data[key], "/v1/");
                    console.log(_this.ipAddress);
                }
                else if (key === "DeviceID") {
                    _this.deviceID = data[key];
                }
            }
            else {
                updated = false;
            }
        });
        console.log(updated);
        return updated;
    };
    AntennaClient.prototype.patchDeviceInfo = function (data) {
        var _this = this;
        var invalidFields = Object.keys(data).filter(function (key) { return !(key in _this.info); });
        if (invalidFields.length > 0) {
            return { success: false, error: "No valid fields: ".concat(invalidFields.join(", ")) };
        }
        // Evitar actualización de campos críticos
        var criticalFields = ["IP", "DeviceID"];
        var hasCriticalChange = Object.keys(data).some(function (key) { return criticalFields.includes(key); });
        if (hasCriticalChange) {
            return { success: false, error: "Can't update critcal fields  (IP, DeviceID)." };
        }
        // Actualizar campos no críticos
        Object.keys(data).forEach(function (key) {
            _this.info[key] = data[key];
        });
        return { success: true };
    };
    /**
     * Processes raw antenna data and retrieves satellite information
     */
    AntennaClient.prototype.fetchData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, fetchPromises, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        rawData = {};
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        fetchPromises = this.dataEntriesSplitted.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                            var endpoint, response, value, _i, fields_1, field, error_2, errorCode, errorMessage;
                            var key = _b.key, endpointKey = _b.endpointKey, fields = _b.fields;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        endpoint = this.endpoints[endpointKey];
                                        if (!endpoint) {
                                            logger.error("Endpoint not found for ".concat(key, ": ").concat(endpointKey));
                                            rawData[key] = null;
                                            return [2 /*return*/];
                                        }
                                        _c.label = 1;
                                    case 1:
                                        _c.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, axios_1.default.get("".concat(this.baseUrl).concat(endpoint), {
                                                auth: { username: this.username, password: this.password },
                                                timeout: this.timeout,
                                                httpsAgent: new (require("https").Agent)({ rejectUnauthorized: false }),
                                            })];
                                    case 2:
                                        response = _c.sent();
                                        value = response.data;
                                        for (_i = 0, fields_1 = fields; _i < fields_1.length; _i++) {
                                            field = fields_1[_i];
                                            if (value && field in value) {
                                                value = value[field];
                                            }
                                            else {
                                                value = null;
                                                break;
                                            }
                                        }
                                        rawData[key] = value;
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_2 = _c.sent();
                                        if (axios_1.default.isAxiosError(error_2)) {
                                            errorCode = error_2.code;
                                            errorMessage = error_2.message;
                                            logger.error("Error for ".concat(key, " at ").concat(this.ipAddress, ": ").concat(errorMessage, ". ").concat(errorCode));
                                        }
                                        else {
                                            logger.error("Error desconocido: ".concat(error_2));
                                        }
                                        rawData[key] = null;
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        }); });
                        //logger.info(`Generando fetchPromises datos para ${this.ipAddress}`);
                        return [4 /*yield*/, Promise.all(fetchPromises)];
                    case 2:
                        //logger.info(`Generando fetchPromises datos para ${this.ipAddress}`);
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger.error("Error when fetching data at ".concat(this.ipAddress, ":"), error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, rawData];
                }
            });
        });
    };
    /**
     * Processes raw antenna data and retrieves satellite information
     */
    AntennaClient.prototype.processData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rawData, processedData, _a, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, this.fetchData()];
                    case 1:
                        rawData = _b.sent();
                        processedData = this.formatData(rawData);
                        if (!this.hasValidPositionData(processedData)) return [3 /*break*/, 3];
                        _a = processedData;
                        return [4 /*yield*/, this.getSatelliteName(processedData)];
                    case 2:
                        _a.satellite_name = _b.sent();
                        _b.label = 3;
                    case 3:
                        this.data = processedData;
                        logger.info("Processed data for ".concat(this.ipAddress));
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _b.sent();
                        logger.error("Data processing error for ".concat(this.ipAddress, ": ").concat(error_3));
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Formats raw data with proper numeric precision
     * @param rawData Unprocessed antenna data
     * @returns Formatted data object
     */
    AntennaClient.prototype.formatData = function (rawData) {
        return Object.entries(rawData).reduce(function (acc, _a) {
            var key = _a[0], value = _a[1];
            acc[key] = typeof value === 'number'
                ? parseFloat(value.toFixed(key === 'latitude' || key === 'longitude' ? 6 : 2))
                : value;
            return acc;
        }, {});
    };
    /**
     * Validates required position data fields
     * @param data Processed data object
     * @returns Boolean indicating valid position data
     */
    AntennaClient.prototype.hasValidPositionData = function (data) {
        return ['latitude', 'longitude', 'azimuth', 'elevation'].every(function (field) { return data[field]; });
    };
    /**
     * Retrieves satellite name via Python socket server
     * @param data Processed position data
     * @returns Satellite name or null
     */
    AntennaClient.prototype.getSatelliteName = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.queryPythonSocket(data)];
                    case 1:
                        response = _a.sent();
                        if (response === null || response === void 0 ? void 0 : response.satellite_name) {
                            this.lastSatelliteName = response.satellite_name;
                            return [2 /*return*/, response.satellite_name];
                        }
                        return [2 /*return*/, this.lastSatelliteName];
                    case 2:
                        error_4 = _a.sent();
                        logger.error("Satellite query failed for ".concat(this.ipAddress, ": ").concat(error_4));
                        return [2 /*return*/, this.lastSatelliteName];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Communicates with Python socket server for satellite data
     * @param data Position data payload
     * @returns Promise with satellite response
     */
    AntennaClient.prototype.queryPythonSocket = function (data) {
        return new Promise(function (resolve, reject) {
            var socket = new net.Socket();
            var timeout = setTimeout(function () {
                socket.destroy();
                reject(new Error('Socket timeout'));
            }, SOCKET_TIMEOUT);
            socket.connect(SOCKET_TIMEOUT, '127.0.0.1', function () {
                socket.write(JSON.stringify({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    azimuth: data.azimuth,
                    elevation: data.elevation
                }));
            });
            socket.on('data', function (response) {
                clearTimeout(timeout);
                try {
                    resolve(JSON.parse(response.toString()));
                }
                catch (error) {
                    reject(new Error('Invalid JSON response'));
                }
                socket.destroy();
            });
            socket.on('error', function (error) {
                clearTimeout(timeout);
                reject(error);
            });
        });
    };
    AntennaClient.prototype.getData = function () {
        return { info: this.info, data: this.data };
    };
    return AntennaClient;
}());
exports.AntennaClient = AntennaClient;
