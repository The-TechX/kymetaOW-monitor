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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntennasManager = void 0;
// Modules
var fs = require("fs");
var winston = require("winston");
var ws_1 = require("ws");
var influxdb_client_1 = require("@influxdata/influxdb-client");
var express = require("express");
// import https = require('https');
var AntennaClient_1 = require("./AntennaClient");
// Configuration Constants
var CONFIG_PATH = '../cfg/config.json';
var DEVICES_PATH = '../cfg/devices.json';
var WS_PORT = 8765;
var HTTP_PORT = 8080;
var INFLUX_CONFIG = {
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
// Initialize InfluxDB client
var influxDB = new influxdb_client_1.InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
var writeApi = influxDB.getWriteApi(INFLUX_CONFIG.org, INFLUX_CONFIG.bucket);
/**
 * Processes raw antenna data and retrieves satellite information
 */
var AntennasManager = /** @class */ (function () {
    function AntennasManager(configPath, devicesPath) {
        if (configPath === void 0) { configPath = CONFIG_PATH; }
        if (devicesPath === void 0) { devicesPath = DEVICES_PATH; }
        this.lastID = 1;
        this.endpoints = {};
        this.data2fetch = {};
        this.antennas = [];
        this.devices = [];
        this.subscriptions = new Map();
        this.logBanner();
        this.loadConfigAndDevices(configPath, devicesPath);
        this.startServers();
        this.initializeSubscriptions();
    }
    AntennasManager.prototype.logBanner = function () {
        logger.info("  **********************************************");
        logger.info("  *                                            *");
        logger.info("  *        Initializing Antenna Manager        *");
        logger.info("  *                                            *");
        logger.info("  **********************************************");
        logger.info("    Developed by: Oscar Flores & German Sunza");
        logger.info("    Property of Viasat\n");
    };
    AntennasManager.prototype.loadConfigAndDevices = function (configPath, devicesPath) {
        var config = this.loadConfig(configPath);
        this.endpoints = config.endpoints;
        this.data2fetch = config.data2fetch;
        this.loadDevices(devicesPath);
    };
    AntennasManager.prototype.startServers = function () {
        try {
            this.app = express();
            var server = this.app.listen(HTTP_PORT, '0.0.0.0', function () {
                logger.info("API REST listening on port: ".concat(HTTP_PORT));
            });
            this.loadAPIREST();
            server.on('error', function (error) {
                logger.error("HTTP Server Error:", error);
                process.exit(1); // Detiene el programa si hay un error en el HTTP Server
            });
            this.wss = new ws_1.WebSocketServer({ port: WS_PORT });
            this.wss.on('error', function (error) {
                logger.error("WebSocket Server Error:", error);
                process.exit(1); // Detiene el programa si hay un error en WebSocket Server
            });
            this.handleWebSocketConnections();
            logger.info("WebSocket server listening on port: ".concat(WS_PORT));
        }
        catch (error) {
            logger.error("Error initializing servers: ".concat(error));
            process.exit(1); // Detiene el programa si hay un error general
        }
    };
    AntennasManager.prototype.handleWebSocketConnections = function () {
        var _this = this;
        if (this.wss) {
            this.wss.on("connection", function (socket) {
                logger.info("New client connected.");
                socket.on("message", function (message) {
                    try {
                        var request_1 = JSON.parse(message.toString());
                        if (request_1.ipAddress && request_1.streamType) {
                            logger.info("Client subscribed to ".concat(request_1.streamType, " of antenna ").concat(request_1.ipAddress));
                            var antenna = _this.antennas.find(function (a) { return a.ipAddress === request_1.ipAddress; });
                            if (antenna) {
                                antenna.realtime = true;
                                _this.subscribeClient(socket, antenna, request_1.streamType);
                                console.log(antenna.realtime);
                            }
                        }
                    }
                    catch (error) {
                        logger.error("Invalid message format:", message);
                    }
                });
                socket.on("close", function () {
                    logger.info("Client disconnected.");
                    _this.unsubscribeClient(socket);
                });
            });
        }
    };
    AntennasManager.prototype.initializeSubscriptions = function () {
        for (var _i = 0, _a = this.antennas; _i < _a.length; _i++) {
            var antenna = _a[_i];
            this.subscriptions.set(antenna, new Map());
        }
    };
    /**
     * Load all API REST endpoints.
     */
    AntennasManager.prototype.loadAPIREST = function () {
        var _this = this;
        if (this.app) {
            // Agrega el middleware para parsear JSON
            this.app.use(express.json());
            this.app.get("/", function (_, res) {
                res.json({ message: "Hello app root" });
            });
            this.app.get("/cms/api/v1/hello", function (_, res) {
                res.json({ message: "Hello API REST" });
            });
            this.app.get("/cms/api/v1/config", function (_, res) {
                res.json({
                    endpoints: _this.endpoints,
                    data2fetch: _this.data2fetch
                });
            });
            // Obtener todas las antenas
            this.app.get("/cms/api/v1/devices/antennas", function (req, res) {
                var filterBy = req.query.filter; // Ej: ?filter=siteId:12345
                var result = _this.antennas;
                if (filterBy) {
                    var _a = filterBy.split(':'), key_1 = _a[0], value_1 = _a[1];
                    console.log(result[0].info[key_1]);
                    result = result.filter(function (a) { return a.info[key_1] === value_1; });
                }
                res.json(result.map(function (a) { return _this.sanitizeAntennaData(a); }));
            });
            // http://localhost/cms/api/v1/devices/antennas/ID/by/deviceID or http://localhost/cms/api/v1/devices/antennas/ID/by/ipAddress
            this.app.get("/cms/api/v1/devices/antennas/ID/by/:field", function (req, res) {
                var allowedFields = ['deviceID', 'ipAddress'];
                var searchField = req.params.field;
                if (!allowedFields.includes(searchField)) {
                    res.status(403).json({ error: "Acceso no autorizado" });
                    return;
                }
                res.json(_this.getAllID(searchField));
            });
            // Get info about any antenna by ID. In preference, ID must be related to DeviceID integer number, i.e (ID: 1) = (DeviceID: KYM01)
            this.app.get("/cms/api/v1/devices/antennas/:antennaID", function (req, res) {
                try {
                    var antennaID_1 = Number(req.params.antennaID); // Convertir a número
                    // Buscar la antena por el valor
                    var antenna = _this.antennas.find(function (a) { return a.id === antennaID_1; });
                    if (!antenna) {
                        res.status(404).json({ message: "Antenna no encontrada" });
                        return;
                    }
                    res.json(_this.sanitizeAntennaData(antenna));
                }
                catch (error) {
                    console.error("Error al obtener la antena:", error);
                    res.status(500).json({ message: "Error interno del servidor" });
                }
            });
            // PUT NEW ANTENNA
            this.app.put("/cms/api/v1/devices/antennas/", function (req, res) {
                try {
                    var updateData = req.body;
                    if (!updateData) {
                        res.status(404).json({ error: "Missing Data." });
                        return;
                    }
                    if (!_this.addAntenna(updateData)) {
                        res.status(400).json({ error: "Can't update data. Some fields may be incorrect. Please check the docs for the PUT method." });
                        return;
                    }
                    res.json({ "message": "ok" });
                }
                catch (error) {
                    res.status(500).json({ error: "Error in server." });
                }
            });
            // PUT CRITICAL DATA LIKE IP OR DEVICE ID ON EXISTING ANTENNA
            this.app.put("/cms/api/v1/devices/antennas/:antennaID", function (req, res) {
                try {
                    // Ejemplo: PATCH /cms/api/v1/devices/antenna?searchIP=172.25.105.4&searchDeviceID=12345
                    var antennaID_2 = Number(req.params.antennaID); // Convertir a número
                    var updateData = req.body;
                    if (!updateData || Object.keys(updateData).length === 0) {
                        res.status(400).json({ error: "Bad Request. Empty request body." });
                        return;
                    }
                    // Buscar la antena por el valor
                    var antennaToUpdate = _this.antennas.find(function (a) { return a.id === antennaID_2; });
                    if (!antennaToUpdate) {
                        res.status(404).json({ error: "Can't find antenna with ID: ".concat(antennaID_2, ".") });
                        return;
                    }
                    var updateResult = antennaToUpdate.patchDeviceInfo(updateData);
                    if (!updateResult.success) {
                        res.status(400).json({ error: updateResult.error });
                        return;
                    }
                    res.status(200).json({ message: "Antenna ID: ".concat(antennaID_2, ". Succesfully updated. ") });
                }
                catch (error) {
                    res.status(500).json({ error: "Error in server." });
                }
            });
            this.app.patch("/cms/api/v1/devices/antennas/:antennaID", function (req, res) {
                try {
                    // Ejemplo: PATCH /cms/api/v1/devices/antenna?searchIP=172.25.105.4&searchDeviceID=12345
                    var antennaID_3 = Number(req.params.antennaID); // Convertir a número
                    var updateData = req.body;
                    if (!updateData || Object.keys(updateData).length === 0) {
                        res.status(400).json({ error: "Bad Request. Empty request body." });
                        return;
                    }
                    // Buscar la antena por el valor
                    var antennaToUpdate = _this.antennas.find(function (a) { return a.id === antennaID_3; });
                    if (!antennaToUpdate) {
                        res.status(404).json({ error: "Can't find antenna with ID: ".concat(antennaID_3, ".") });
                        return;
                    }
                    var updateResult = antennaToUpdate.patchDeviceInfo(updateData);
                    if (!updateResult.success) {
                        res.status(400).json({ error: updateResult.error });
                        return;
                    }
                    res.status(200).json({ message: "Antenna ID: ".concat(antennaID_3, ". Succesfully updated. ") });
                }
                catch (error) {
                    res.status(500).json({ error: "Error in server." });
                }
            });
            this.app.delete("/cms/api/v1/devices/antennas/:antennaID", function (req, res) {
                var antennaID = Number(req.params.antennaID); // Convertir a número
                if (!_this.deleteAntennaByID(antennaID)) {
                    res.status(404).json({ error: "Can't find antenna with ID: ".concat(antennaID, ".") });
                    return;
                }
                else {
                    console.log(_this.getAllID);
                    res.json({ "message": "ok" });
                }
            });
        }
    };
    AntennasManager.prototype.sanitizeAntennaData = function (antenna) {
        // Eliminar información sensible
        var _a = antenna.info, password = _a.password, safeData = __rest(_a, ["password"]);
        return __assign({}, safeData);
    };
    /**
     * Agrega un WebSocket y su topic a una antena específica.
     */
    AntennasManager.prototype.subscribeClient = function (socket, antenna, topic) {
        var _a, _b;
        var remoteAddress = (_a = socket._socket) === null || _a === void 0 ? void 0 : _a.remoteAddress;
        var remotePort = (_b = socket._socket) === null || _b === void 0 ? void 0 : _b.remotePort;
        console.log(remoteAddress);
        console.log(remotePort);
        this.subscriptions.get(antenna).set(socket, topic);
        console.log("Subscribed socket to ".concat(antenna.ipAddress, " with topic: ").concat(topic));
    };
    /**
     * Elimina un WebSocket de todas las antenas a las que estaba suscrito.
     */
    AntennasManager.prototype.unsubscribeClient = function (socket) {
        for (var _i = 0, _a = Array.from(this.subscriptions.entries()); _i < _a.length; _i++) {
            var _b = _a[_i], antenna = _b[0], sockets = _b[1];
            if (sockets.has(socket)) {
                sockets.delete(socket);
                console.log("Unsubscribed socket from ".concat(antenna.ipAddress));
                break; // Detenemos la búsqueda una vez que encontramos y eliminamos el socket
            }
        }
    };
    /**
     * Obtiene todas las suscripciones de una antena específica.
     */
    AntennasManager.prototype.getSubscriptions = function (antenna) {
        return this.subscriptions.get(antenna);
    };
    /**
     * Obtiene todas las suscripciones de todas las antenas.
     */
    AntennasManager.prototype.getAllSubscriptions = function () {
        return this.subscriptions;
    };
    AntennasManager.prototype.loadConfig = function (configPath) {
        try {
            var rawData = fs.readFileSync(configPath, "utf-8");
            return JSON.parse(rawData);
        }
        catch (error) {
            console.error("Error loading config file:", error);
            return { endpoints: {}, data2fetch: {} };
        }
    };
    AntennasManager.prototype.loadDevices = function (devicesPath) {
        var _this = this;
        try {
            var rawData = fs.readFileSync(devicesPath, "utf-8");
            var devices = JSON.parse(rawData);
            this.devices = devices.antennas || [];
            this.devices.forEach(function (device) { return _this.addAntenna(device); });
        }
        catch (error) {
            console.error("Error loading devices file:", error);
            this.devices = [];
        }
    };
    AntennasManager.prototype.addAntenna = function (deviceInfo) {
        if (!deviceInfo.IP || !deviceInfo.DeviceID) {
            logger.error("Faltan propiedades requeridas en deviceInfo: ".concat(JSON.stringify(deviceInfo)));
            return false;
        }
        // Verificar si ya existe una antena con el mismo deviceID o ipAddress
        var duplicateAntenna = this.antennas.find(function (antenna) {
            return antenna.deviceID === deviceInfo.DeviceID || antenna.ipAddress === deviceInfo.IP;
        });
        if (duplicateAntenna) {
            logger.error("Ya existe una antena con deviceID: ".concat(deviceInfo.DeviceID, " o IP: ").concat(deviceInfo.IP));
            return false;
        }
        var antenna = new AntennaClient_1.AntennaClient(this.lastID, deviceInfo, this);
        this.antennas.push(antenna);
        logger.info("Antenna added: ".concat(deviceInfo.IP, " (deviceID: ").concat(deviceInfo.DeviceID, ", ID: ").concat(this.lastID, ")"));
        this.runAntenna(antenna);
        ++this.lastID;
        return true;
    };
    AntennasManager.prototype.sendData2Websocket = function (antenna, subscribers) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, _b, socket, topic, remoteAddress, dynamicValue;
            var _c;
            var _d;
            return __generator(this, function (_e) {
                for (_i = 0, _a = Array.from(subscribers.entries()); _i < _a.length; _i++) {
                    _b = _a[_i], socket = _b[0], topic = _b[1];
                    remoteAddress = ((_d = socket._socket) === null || _d === void 0 ? void 0 : _d.remoteAddress) || "unknown";
                    console.log("- Socket [".concat(remoteAddress, "] suscrito al topic: ").concat(topic));
                    console.log(antenna.data.sinrDb);
                    switch (topic) {
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
                            dynamicValue = antenna.data[topic];
                            socket.send(JSON.stringify((_c = {}, _c[topic] = dynamicValue, _c)));
                    }
                }
                return [2 /*return*/];
            });
        });
    };
    AntennasManager.prototype.sendDataToDB = function (antenna) {
        return __awaiter(this, void 0, void 0, function () {
            var point, _i, _a, _b, key, value, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        point = new influxdb_client_1.Point("logs").tag("IP", antenna.ipAddress);
                        if (!antenna.data) return [3 /*break*/, 2];
                        // Iterar sobre los datos y agregar solo los valores que no sean null
                        for (_i = 0, _a = Object.entries(antenna.data); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            if (value !== null) {
                                if (typeof value === "number") {
                                    point = point.floatField(key, value); // Agregar como campo numérico
                                }
                                else if (typeof value === "string") {
                                    point = point.stringField(key, value); // Agregar como campo de texto
                                }
                            }
                        }
                        writeApi.writePoint(point);
                        return [4 /*yield*/, writeApi.flush()];
                    case 1:
                        _c.sent();
                        logger.info("Data sended to DB from ".concat(antenna.ipAddress));
                        return [3 /*break*/, 3];
                    case 2:
                        logger.error("No valid data to write to InfluxDB");
                        _c.label = 3;
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        error_1 = _c.sent();
                        logger.error("Error writing data");
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AntennasManager.prototype.runAntenna = function (antenna) {
        return __awaiter(this, void 0, void 0, function () {
            var dbInterval, subscribers;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dbInterval = setInterval(function () {
                            if (antenna.data) {
                                _this.sendDataToDB(antenna);
                            }
                        }, 5000);
                        _a.label = 1;
                    case 1:
                        if (!antenna.active) return [3 /*break*/, 7];
                        return [4 /*yield*/, antenna.processData()];
                    case 2:
                        _a.sent();
                        logger.info("Data from ".concat(antenna.ipAddress, ": ").concat(antenna.data.sinrDb));
                        subscribers = this.subscriptions.get(antenna);
                        if (!(antenna.realtime && subscribers && subscribers.size > 0)) return [3 /*break*/, 4];
                        this.sendData2Websocket(antenna, subscribers);
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 50); })];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 5000); })];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6: return [3 /*break*/, 1];
                    case 7:
                        // Cuando antenna.active sea false, salimos del loop y cancelamos el intervalo:
                        clearInterval(dbInterval);
                        return [2 /*return*/];
                }
            });
        });
    };
    AntennasManager.prototype.deleteAntennaByID = function (id) {
        var index = this.antennas.findIndex(function (antenna) { return antenna.id === id; });
        if (index === -1) {
            return false; // No se encontró la antena
        }
        // Detener el ciclo de procesamiento de la antena:
        this.antennas[index].active = false;
        // Si además tienes suscripciones u otros recursos asociados, también límpialos
        this.antennas.splice(index, 1); // Elimina la antena del array
        return true;
    };
    AntennasManager.prototype.getEndpoints = function () {
        return this.endpoints;
    };
    AntennasManager.prototype.getData2Fetch = function () {
        return this.data2fetch;
    };
    AntennasManager.prototype.getAllData = function () {
        return this.antennas.map(function (antenna) { return antenna.getData(); });
    };
    /*public getInstancesInfo(): Record<string, string>[] {
        return this.antennas.map((antenna) => antenna.ipAddress);
    }*/
    AntennasManager.prototype.getAllID = function (searchField) {
        var result = {};
        for (var _i = 0, _a = this.antennas; _i < _a.length; _i++) {
            var antenna = _a[_i];
            var key = antenna[searchField];
            result[key.toString()] = antenna.id;
        }
        return result;
    };
    AntennasManager.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, antenna;
            return __generator(this, function (_b) {
                //await Promise.all(this.antennas.map((antenna) => antenna.processData()));
                for (_i = 0, _a = this.antennas; _i < _a.length; _i++) {
                    antenna = _a[_i];
                    //this.runAntenna(antenna);
                }
                return [2 /*return*/];
            });
        });
    };
    return AntennasManager;
}());
exports.AntennasManager = AntennasManager;
