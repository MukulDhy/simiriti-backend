const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const config = require("../config/config");
const User = require("../models/user.model");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.heartbeatInterval = 25000; // 25 seconds
    this.pingInterval = null;

    // Video calling specific properties
    this.activeCalls = new Map();
    this.callQueue = new Map();

    // ESP32 and sensor management
    this.esp32Clients = new Map(); // ESP32 devices
    this.audioClients = new Map(); // Clients listening to audio streams
    this.sensorClients = new Map(); // Clients listening to sensor data
    this.deviceRegistry = new Map(); // Device registry with capabilities
    this.sensorData = new Map(); // Latest sensor data cache

    // Room management for different data types
    this.audioRooms = new Map();
    this.sensorRooms = new Map();

    // Data streaming configuration
    this.streamingConfig = {
      audio: {
        enabled: true,
        maxBitrate: 64000,
        sampleRate: 16000,
      },
      sensors: {
        enabled: true,
        updateInterval: 5000,
        batchSize: 10,
      },
    };
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      this.handleUpgrade(request, socket, head).catch((err) => {
        logger.error(`Upgrade failed: ${err.message}`);
        socket.destroy();
      });
    });

    this.setupEventHandlers();
    this.startCleanupTasks();
    logger.info("WebSocket server initialized with multi-sensor support");
  }

  async handleUpgrade(request, socket, head) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Handle ESP32 device connections (no authentication required)
      if (
        url.pathname === "/esp32-audio" ||
        url.pathname === "/esp32-sensors"
      ) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
        return;
      }

      // Regular client authentication
      const { user, error } = await this.verifyClient(request);
      if (error || !user) {
        logger.warn(`Rejected connection: ${error}`);
        return socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request);
      });
    } catch (err) {
      logger.error(`Upgrade error: ${err.message}`);
      throw err;
    }
  }

  async verifyClient(request) {
    try {
      const origin = request.headers.origin;
      if (!this.isOriginAllowed(origin)) {
        return { error: "Origin not allowed" };
      }

      const token = this.extractToken(request);
      if (!token) {
        return { error: "No token provided" };
      }

      const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, config.jwt.secret, (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        });
      });

      if (!decoded?.id) {
        return { error: "Invalid token payload" };
      }

      const user = await User.findById(decoded.id);
      request.user = user;
      return { user: user };
    } catch (err) {
      logger.warn(`Verification failed: ${err.message}`);
      return { error: err.message };
    }
  }

  extractToken(request) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      return (
        url.searchParams.get("token") ||
        request.headers["sec-websocket-protocol"] ||
        request.headers["authorization"]?.split(" ")[1]
      );
    } catch (err) {
      return null;
    }
  }

  isOriginAllowed(origin) {
    if (!origin || process.env.NODE_ENV === "development") return true;

    const allowedOrigins = [
      ...(config.cors?.allowedOrigins || []),
      `http://${config.server.host}:${config.server.port}`,
      "http://localhost:3000",
      "http://192.168.0.103:8081",
    ];

    return allowedOrigins.includes(origin) || allowedOrigins.includes("*");
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, request) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      // Handle ESP32 device connections
      if (
        url.pathname === "/esp32-audio" ||
        url.pathname === "/esp32-sensors"
      ) {
        this.handleESP32Connection(ws, request);
        return;
      }

      // Handle regular client connections
      const userId = request.user?.id;
      if (!userId) {
        return ws.close(1008, "Authentication failed");
      }

      this.handleClientConnection(ws, userId);
    });

    // // Start heartbeat interval
    // this.startHeartbeat();
  }

  handleESP32Connection(ws, request) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const deviceId = `esp32_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const deviceType = url.pathname === "/esp32-audio" ? "audio" : "sensors";

    logger.info(`ESP32 ${deviceType} device connected: ${deviceId}`);

    const deviceInfo = {
      id: deviceId,
      type: deviceType,
      ws: ws,
      connectedAt: new Date(),
      isStreaming: false,
      capabilities: [],
      lastSeen: new Date(),
      sensorData: {},
      status: "connected",
    };

    this.esp32Clients.set(deviceId, deviceInfo);

    // Send connection confirmation
    // this.sendToESP32(deviceId, {
    //   type: "connection-established",
    //   deviceId: deviceId,
    //   serverTime: new Date().toISOString(),
    // });

    // Setup message handlers
    ws.on("message", (data) => {
      this.handleESP32Message(ws, deviceId, data);
    });

    ws.on("close", () => {
      logger.info(`ESP32 device disconnected: ${deviceId}`);
      this.handleESP32Disconnect(deviceId);
    });

    ws.on("error", (err) => {
      logger.error(`ESP32 device error ${deviceId}: ${err.message}`);
      this.handleESP32Disconnect(deviceId);
    });

    // Ping ESP32 to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  handleClientConnection(ws, userId) {
    logger.info(`Client connected: ${userId}`);

    // Send authentication confirmation
    ws.send(
      JSON.stringify({
        type: "connection",
        status: "authenticated",
        userId,
        timestamp: new Date().toISOString(),
      })
    );

    this.addClient(userId, ws);

    // Setup heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
      logger.debug(`Heartbeat from ${userId}`);
    });

    // Message handler
    ws.on("message", (data) => {
      this.handleClientMessage(ws, userId, data);
    });

    ws.on("close", () => {
      logger.info(`Client disconnected: ${userId}`);
      this.handleClientDisconnect(userId);
    });

    ws.on("error", (err) => {
      logger.error(`Client error ${userId}: ${err.message}`);
      this.handleClientDisconnect(userId);
    });
  }

  handleESP32Message(ws, deviceId, data) {
    const device = this.esp32Clients.get(deviceId);
    if (!device) return;

    device.lastSeen = new Date();

    try {
      // Handle binary audio data
      if (data instanceof Buffer && device.type === "audio") {
        this.broadcastAudioData(deviceId, data);
        return;
      }

      // Handle JSON messages
      const message = JSON.parse(data.toString());
      logger.debug(`ESP32 ${deviceId} message:`, message.type);

      switch (message.type) {
        case "device-info":
          this.handleDeviceInfo(deviceId, message);
          break;
        case "audio-stream-started":
          this.handleAudioStreamStarted(deviceId, message);
          break;
        case "audio-stream-stopped":
          this.handleAudioStreamStopped(deviceId, message);
          break;
        case "sensor-data":
          this.handleSensorData(deviceId, message);
          break;
        case "device-status":
          this.handleDeviceStatus(deviceId, message);
          break;
        default:
          logger.debug(`Unhandled ESP32 message type: ${message.type}`);
      }
    } catch (err) {
      // If JSON parsing fails and it's binary data, handle as audio
      if (data instanceof Buffer && device.type === "audio") {
        this.broadcastAudioData(deviceId, data);
      } else {
        logger.error(`ESP32 message handling error: ${err.message}`);
      }
    }
  }

  handleClientMessage(ws, userId, data) {
    try {
      const message = JSON.parse(data);
      logger.debug(`Client ${userId} message:`, message.type);

      if (message.type === "ping") {
        return ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }

      // Route messages based on type
      switch (message.type) {
        // Audio streaming
        case "join-audio-stream":
          this.handleJoinAudioStream(userId, message);
          break;
        case "leave-audio-stream":
          this.handleLeaveAudioStream(userId, message);
          break;
        case "get-available-audio-streams":
          this.handleGetAvailableAudioStreams(userId);
          break;

        // Sensor data
        case "subscribe-sensor-data":
          this.handleSubscribeSensorData(userId, message);
          break;
        case "unsubscribe-sensor-data":
          this.handleUnsubscribeSensorData(userId, message);
          break;
        case "get-available-sensors":
          this.handleGetAvailableSensors(userId);
          break;
        case "get-sensor-data":
          this.handleGetSensorData(userId, message);
          break;

        // Device management
        case "get-connected-devices":
          this.handleGetConnectedDevices(userId);
          break;
        case "control-device":
          this.handleControlDevice(userId, message);
          break;

        // Video calling (existing functionality)
        case "initiate-call":
          this.handleInitiateCall(userId, message);
          break;
        case "accept-call":
          this.handleAcceptCall(userId, message);
          break;
        case "reject-call":
          this.handleRejectCall(userId, message);
          break;
        case "end-call":
          this.handleEndCall(userId, message);
          break;
        case "webrtc-offer":
          this.handleWebRTCOffer(userId, message);
          break;
        case "webrtc-answer":
          this.handleWebRTCAnswer(userId, message);
          break;
        case "webrtc-ice-candidate":
          this.handleWebRTCIceCandidate(userId, message);
          break;
        default:
          logger.debug(`Unhandled message type: ${message.type}`);
      }
    } catch (err) {
      logger.error(`Message handling error: ${err.message}`);
    }
  }

  // Audio Stream Management Methods
  handleJoinAudioStream(userId, message) {
    try {
      const { esp32Id } = message;

      // Check if ESP32 exists and is streaming
      const esp32Client = this.esp32Clients.get(esp32Id);
      if (!esp32Client) {
        return this.sendToUser(userId, {
          type: "error",
          message: "ESP32 device not found",
        });
      }

      // Add user to audio clients
      this.audioClients.set(userId, {
        listeningToESP32: esp32Id,
        joinedAt: new Date(),
      });

      // Confirm join
      this.sendToUser(userId, {
        type: "joined-audio-stream",
        esp32Id: esp32Id,
        isStreaming: esp32Client.isStreaming,
      });

      logger.info(`User ${userId} joined audio stream from ESP32 ${esp32Id}`);
    } catch (error) {
      logger.error(`Error joining audio stream: ${error.message}`);
    }
  }

  handleLeaveAudioStream(userId, message) {
    try {
      const clientInfo = this.audioClients.get(userId);
      if (clientInfo) {
        this.audioClients.delete(userId);

        this.sendToUser(userId, {
          type: "left-audio-stream",
          esp32Id: clientInfo.listeningToESP32,
        });

        logger.info(`User ${userId} left audio stream`);
      }
    } catch (error) {
      logger.error(`Error leaving audio stream: ${error.message}`);
    }
  }

  handleGetAvailableAudioStreams(userId) {
    try {
      const availableStreams = [];

      this.esp32Clients.forEach((esp32Client, esp32Id) => {
        if (esp32Client.type === "audio") {
          availableStreams.push({
            esp32Id: esp32Id,
            isStreaming: esp32Client.isStreaming,
            connectedAt: esp32Client.connectedAt,
            listenerCount: this.getListenerCount(esp32Id),
          });
        }
      });

      this.sendToUser(userId, {
        type: "available-audio-streams",
        streams: availableStreams,
      });
    } catch (error) {
      logger.error(`Error getting available audio streams: ${error.message}`);
    }
  }

  getListenerCount(esp32Id) {
    let count = 0;
    this.audioClients.forEach((clientInfo) => {
      if (clientInfo.listeningToESP32 === esp32Id) {
        count++;
      }
    });
    return count;
  }

  broadcastAudioData(deviceId, audioData) {
    let broadcastCount = 0;

    this.audioClients.forEach((clientInfo, userId) => {
      if (clientInfo.listeningToESP32 === deviceId) {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
          try {
            client.send(audioData);
            broadcastCount++;
          } catch (err) {
            logger.error(
              `Error broadcasting audio to ${userId}: ${err.message}`
            );
          }
        }
      }
    });

    if (broadcastCount > 0) {
      logger.debug(`Audio data broadcasted to ${broadcastCount} clients`);
    }
  }

  notifyAudioClientsStreamStarted(deviceId) {
    this.audioClients.forEach((clientInfo, userId) => {
      if (clientInfo.listeningToESP32 === deviceId) {
        this.sendToUser(userId, {
          type: "audio-stream-started",
          esp32Id: deviceId,
        });
      }
    });
  }

  notifyAudioClientsStreamEnded(deviceId) {
    this.audioClients.forEach((clientInfo, userId) => {
      if (clientInfo.listeningToESP32 === deviceId) {
        this.sendToUser(userId, {
          type: "audio-stream-stopped",
          esp32Id: deviceId,
        });
      }
    });
  }

  // Video calling methods
  handleInitiateCall(callerId, message) {
    try {
      const { receiverId, callerName, callType = "video" } = message;

      if (!this.clients.has(receiverId)) {
        return this.sendToUser(callerId, {
          type: "user-offline",
          receiverId,
        });
      }

      const callId = `call_${Date.now()}_${callerId}`;

      // Store call information
      this.activeCalls.set(callId, {
        callId,
        callerId,
        receiverId,
        callerName,
        callType,
        status: "ringing",
        startTime: new Date(),
      });

      // Notify receiver about incoming call
      this.sendToUser(receiverId, {
        type: "incoming-call",
        callId,
        callerId,
        callerName,
        callType,
      });

      // Confirm to caller that call was initiated
      this.sendToUser(callerId, {
        type: "call-initiated",
        callId,
      });

      logger.info(
        `Call initiated: ${callId} from ${callerId} to ${receiverId}`
      );
    } catch (error) {
      logger.error(`Error initiating call: ${error.message}`);
    }
  }

  handleAcceptCall(userId, message) {
    try {
      const { callId } = message;
      const call = this.activeCalls.get(callId);

      if (!call || call.receiverId !== userId) {
        return this.sendToUser(userId, {
          type: "error",
          message: "Invalid call or unauthorized",
        });
      }

      call.status = "accepted";
      call.acceptTime = new Date();

      // Notify caller that call was accepted
      this.sendToUser(call.callerId, {
        type: "call-accepted",
        callId,
      });

      logger.info(`Call accepted: ${callId}`);
    } catch (error) {
      logger.error(`Error accepting call: ${error.message}`);
    }
  }

  async handleEndCall(userId, message) {
    try {
      const { callId } = message;
      const call = this.activeCalls.get(callId);

      if (!call) return;

      // Notify both parties that call ended
      const otherUserId =
        call.callerId === userId ? call.receiverId : call.callerId;

      this.sendToUser(otherUserId, {
        type: "call-ended",
        callId,
      });

      // Update call status and end time
      call.status = "ended";
      call.endTime = new Date();

      // Save to database
      await this.saveCallToDatabase(call);

      // Clean up call
      this.activeCalls.delete(callId);

      logger.info(`Call ended: ${callId} by ${userId}`);
    } catch (error) {
      logger.error(`Error ending call: ${error.message}`);
    }
  }

  async handleRejectCall(userId, message) {
    try {
      const { callId } = message;
      const call = this.activeCalls.get(callId);

      if (!call || call.receiverId !== userId) {
        return;
      }

      // Update call status
      call.status = "rejected";
      call.endTime = new Date();

      // Notify caller that call was rejected
      this.sendToUser(call.callerId, {
        type: "call-rejected",
        callId,
      });

      // Save to database
      await this.saveCallToDatabase(call);

      // Clean up call
      this.activeCalls.delete(callId);
      logger.info(`Call rejected: ${callId}`);
    } catch (error) {
      logger.error(`Error rejecting call: ${error.message}`);
    }
  }

  handleWebRTCOffer(userId, message) {
    try {
      const { callId, offer } = message;
      const call = this.activeCalls.get(callId);

      if (!call) return;

      const targetUserId =
        call.callerId === userId ? call.receiverId : call.callerId;

      this.sendToUser(targetUserId, {
        type: "webrtc-offer",
        callId,
        offer,
      });
    } catch (error) {
      logger.error(`Error handling WebRTC offer: ${error.message}`);
    }
  }

  handleWebRTCAnswer(userId, message) {
    try {
      const { callId, answer } = message;
      const call = this.activeCalls.get(callId);

      if (!call) return;

      const targetUserId =
        call.callerId === userId ? call.receiverId : call.callerId;

      this.sendToUser(targetUserId, {
        type: "webrtc-answer",
        callId,
        answer,
      });
    } catch (error) {
      logger.error(`Error handling WebRTC answer: ${error.message}`);
    }
  }

  handleWebRTCIceCandidate(userId, message) {
    try {
      const { callId, candidate } = message;
      const call = this.activeCalls.get(callId);

      if (!call) return;

      const targetUserId =
        call.callerId === userId ? call.receiverId : call.callerId;

      this.sendToUser(targetUserId, {
        type: "webrtc-ice-candidate",
        callId,
        candidate,
      });
    } catch (error) {
      logger.error(`Error handling ICE candidate: ${error.message}`);
    }
  }

  // Enhanced ESP32 and Sensor Management Methods
  handleDeviceInfo(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (!device) return;

      // Update device capabilities
      device.capabilities = message.capabilities || [];
      device.deviceName = message.deviceName || `ESP32-${deviceId}`;
      device.firmwareVersion = message.firmwareVersion || "unknown";
      device.sensorTypes = message.sensorTypes || [];

      // Register device in device registry
      this.deviceRegistry.set(deviceId, {
        ...device,
        lastUpdate: new Date(),
      });

      logger.info(`Device info updated for ${deviceId}:`, {
        capabilities: device.capabilities,
        sensorTypes: device.sensorTypes,
      });

      // Notify connected clients about new device
      this.broadcast({
        type: "device-updated",
        deviceId: deviceId,
        deviceInfo: {
          id: deviceId,
          name: device.deviceName,
          type: device.type,
          capabilities: device.capabilities,
          sensorTypes: device.sensorTypes,
          status: device.status,
          connectedAt: device.connectedAt,
        },
      });
    } catch (error) {
      logger.error(`Error handling device info: ${error.message}`);
    }
  }

  handleAudioStreamStarted(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (device) {
        device.isStreaming = true;
        device.streamConfig = message.config || {};

        logger.info(`Audio stream started for device ${deviceId}`);

        // Notify audio clients
        this.notifyAudioClientsStreamStarted(deviceId);
      }
    } catch (error) {
      logger.error(`Error handling audio stream start: ${error.message}`);
    }
  }

  handleAudioStreamStopped(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (device) {
        device.isStreaming = false;

        logger.info(`Audio stream stopped for device ${deviceId}`);

        // Notify audio clients
        this.notifyAudioClientsStreamEnded(deviceId);
      }
    } catch (error) {
      logger.error(`Error handling audio stream stop: ${error.message}`);
    }
  }

  handleSensorData(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (!device) return;

      const sensorData = {
        deviceId: deviceId,
        timestamp: new Date(),
        data: message.data || {},
        sensorType: message.sensorType || "unknown",
        ...message,
      };

      // Cache latest sensor data
      if (!this.sensorData.has(deviceId)) {
        this.sensorData.set(deviceId, new Map());
      }

      this.sensorData.get(deviceId).set(message.sensorType, sensorData);

      // Broadcast to subscribed clients
      this.broadcastSensorData(deviceId, sensorData);

      logger.debug(`Sensor data received from ${deviceId}:`, sensorData);
    } catch (error) {
      logger.error(`Error handling sensor data: ${error.message}`);
    }
  }

  handleDeviceStatus(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (device) {
        device.status = message.status || "online";
        device.lastSeen = new Date();
        device.batteryLevel = message.batteryLevel;
        device.signalStrength = message.signalStrength;

        // Broadcast status update
        this.broadcast({
          type: "device-status-updated",
          deviceId: deviceId,
          status: device.status,
          batteryLevel: device.batteryLevel,
          signalStrength: device.signalStrength,
          lastSeen: device.lastSeen,
        });
      }
    } catch (error) {
      logger.error(`Error handling device status: ${error.message}`);
    }
  }

  handleESP32Disconnect(deviceId) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (device) {
        // Update device status
        device.status = "disconnected";
        device.disconnectedAt = new Date();

        // Remove from active clients but keep in registry for a while
        this.esp32Clients.delete(deviceId);

        // Notify clients about disconnection
        this.broadcast({
          type: "device-disconnected",
          deviceId: deviceId,
          timestamp: new Date().toISOString(),
        });

        // Notify audio clients if it was streaming
        if (device.type === "audio") {
          this.notifyAudioClientsStreamEnded(deviceId);
        }

        // Remove sensor subscriptions
        this.sensorClients.forEach((clientInfo, userId) => {
          if (
            clientInfo.subscribedDevices &&
            clientInfo.subscribedDevices.includes(deviceId)
          ) {
            clientInfo.subscribedDevices = clientInfo.subscribedDevices.filter(
              (id) => id !== deviceId
            );
            this.sendToUser(userId, {
              type: "sensor-device-disconnected",
              deviceId: deviceId,
            });
          }
        });

        logger.info(`ESP32 device ${deviceId} disconnected and cleaned up`);
      }
    } catch (error) {
      logger.error(`Error handling ESP32 disconnect: ${error.message}`);
    }
  }

  // Client Message Handlers
  handleSubscribeSensorData(userId, message) {
    try {
      const { deviceId, sensorTypes } = message;

      if (!this.sensorClients.has(userId)) {
        this.sensorClients.set(userId, {
          subscribedDevices: [],
          sensorTypes: {},
        });
      }

      const clientInfo = this.sensorClients.get(userId);

      if (!clientInfo.subscribedDevices.includes(deviceId)) {
        clientInfo.subscribedDevices.push(deviceId);
      }

      clientInfo.sensorTypes[deviceId] = sensorTypes || ["all"];

      this.sendToUser(userId, {
        type: "subscribed-sensor-data",
        deviceId: deviceId,
        sensorTypes: sensorTypes,
      });

      // Send latest sensor data if available
      if (this.sensorData.has(deviceId)) {
        const deviceSensorData = this.sensorData.get(deviceId);
        const latestData = {};

        deviceSensorData.forEach((data, sensorType) => {
          if (sensorTypes.includes("all") || sensorTypes.includes(sensorType)) {
            latestData[sensorType] = data;
          }
        });

        if (Object.keys(latestData).length > 0) {
          this.sendToUser(userId, {
            type: "sensor-data-update",
            deviceId: deviceId,
            data: latestData,
          });
        }
      }

      logger.info(`User ${userId} subscribed to sensor data from ${deviceId}`);
    } catch (error) {
      logger.error(`Error subscribing to sensor data: ${error.message}`);
    }
  }

  handleUnsubscribeSensorData(userId, message) {
    try {
      const { deviceId } = message;
      const clientInfo = this.sensorClients.get(userId);

      if (clientInfo) {
        clientInfo.subscribedDevices = clientInfo.subscribedDevices.filter(
          (id) => id !== deviceId
        );
        delete clientInfo.sensorTypes[deviceId];

        this.sendToUser(userId, {
          type: "unsubscribed-sensor-data",
          deviceId: deviceId,
        });

        logger.info(
          `User ${userId} unsubscribed from sensor data from ${deviceId}`
        );
      }
    } catch (error) {
      logger.error(`Error unsubscribing from sensor data: ${error.message}`);
    }
  }

  handleGetAvailableSensors(userId) {
    try {
      const availableSensors = [];

      this.esp32Clients.forEach((device, deviceId) => {
        if (device.type === "sensors" || device.sensorTypes) {
          availableSensors.push({
            deviceId: deviceId,
            deviceName: device.deviceName || `ESP32-${deviceId}`,
            sensorTypes: device.sensorTypes || [],
            status: device.status || "online",
            lastSeen: device.lastSeen,
            batteryLevel: device.batteryLevel,
            signalStrength: device.signalStrength,
          });
        }
      });

      this.sendToUser(userId, {
        type: "available-sensors",
        sensors: availableSensors,
      });
    } catch (error) {
      logger.error(`Error getting available sensors: ${error.message}`);
    }
  }

  handleGetSensorData(userId, message) {
    try {
      const { deviceId, sensorType, timeRange } = message;

      if (!this.sensorData.has(deviceId)) {
        return this.sendToUser(userId, {
          type: "sensor-data-response",
          deviceId: deviceId,
          error: "Device not found or no data available",
        });
      }

      const deviceSensorData = this.sensorData.get(deviceId);
      const responseData = {};

      if (sensorType && sensorType !== "all") {
        const data = deviceSensorData.get(sensorType);
        if (data) {
          responseData[sensorType] = data;
        }
      } else {
        deviceSensorData.forEach((data, type) => {
          responseData[type] = data;
        });
      }

      this.sendToUser(userId, {
        type: "sensor-data-response",
        deviceId: deviceId,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error getting sensor data: ${error.message}`);
    }
  }

  handleGetConnectedDevices(userId) {
    try {
      const connectedDevices = [];

      this.esp32Clients.forEach((device, deviceId) => {
        connectedDevices.push({
          deviceId: deviceId,
          deviceName: device.deviceName || `ESP32-${deviceId}`,
          type: device.type,
          status: device.status || "online",
          capabilities: device.capabilities || [],
          sensorTypes: device.sensorTypes || [],
          connectedAt: device.connectedAt,
          lastSeen: device.lastSeen,
          isStreaming: device.isStreaming || false,
          batteryLevel: device.batteryLevel,
          signalStrength: device.signalStrength,
        });
      });

      this.sendToUser(userId, {
        type: "connected-devices",
        devices: connectedDevices,
      });
    } catch (error) {
      logger.error(`Error getting connected devices: ${error.message}`);
    }
  }

  handleControlDevice(userId, message) {
    try {
      const { deviceId, command, parameters } = message;

      const device = this.esp32Clients.get(deviceId);
      if (!device) {
        return this.sendToUser(userId, {
          type: "device-control-response",
          deviceId: deviceId,
          error: "Device not found",
        });
      }

      // Send command to ESP32 device
      this.sendToESP32(deviceId, {
        type: "device-command",
        command: command,
        parameters: parameters || {},
        requestId: `cmd_${Date.now()}`,
        fromUserId: userId,
      });

      // Send confirmation to user
      this.sendToUser(userId, {
        type: "device-control-sent",
        deviceId: deviceId,
        command: command,
      });

      logger.info(
        `User ${userId} sent command '${command}' to device ${deviceId}`
      );
    } catch (error) {
      logger.error(`Error controlling device: ${error.message}`);
    }
  }

  // Utility Methods
  sendToESP32(deviceId, message) {
    try {
      const device = this.esp32Clients.get(deviceId);
      if (device && device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(JSON.stringify(message));
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error sending to ESP32 ${deviceId}: ${error.message}`);
      return false;
    }
  }

  broadcastSensorData(deviceId, sensorData) {
    let broadcastCount = 0;

    this.sensorClients.forEach((clientInfo, userId) => {
      if (clientInfo.subscribedDevices.includes(deviceId)) {
        const subscribedSensorTypes = clientInfo.sensorTypes[deviceId] || [
          "all",
        ];

        if (
          subscribedSensorTypes.includes("all") ||
          subscribedSensorTypes.includes(sensorData.sensorType)
        ) {
          const success = this.sendToUser(userId, {
            type: "sensor-data-update",
            deviceId: deviceId,
            sensorType: sensorData.sensorType,
            data: sensorData.data,
            timestamp: sensorData.timestamp,
          });

          if (success) broadcastCount++;
        }
      }
    });

    if (broadcastCount > 0) {
      logger.debug(`Sensor data broadcasted to ${broadcastCount} clients`);
    }
  }

  // Cleanup and Maintenance
  startCleanupTasks() {
    // Clean up old sensor data every 5 minutes
    setInterval(() => {
      this.cleanupOldSensorData();
    }, 5 * 60 * 1000);

    // Check device heartbeats every 30 seconds
    setInterval(() => {
      this.checkDeviceHeartbeats();
    }, 30 * 1000);
  }

  cleanupOldSensorData() {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();

    this.sensorData.forEach((deviceData, deviceId) => {
      deviceData.forEach((sensorData, sensorType) => {
        if (now - sensorData.timestamp > maxAge) {
          deviceData.delete(sensorType);
        }
      });

      if (deviceData.size === 0) {
        this.sensorData.delete(deviceId);
      }
    });
  }

  checkDeviceHeartbeats() {
    const timeout = 2 * 60 * 1000; // 2 minutes
    const now = new Date();

    this.esp32Clients.forEach((device, deviceId) => {
      if (now - device.lastSeen > timeout) {
        logger.warn(
          `Device ${deviceId} appears to be offline (last seen: ${device.lastSeen})`
        );
        device.status = "offline";

        // Notify clients
        this.broadcast({
          type: "device-status-updated",
          deviceId: deviceId,
          status: "offline",
          lastSeen: device.lastSeen,
        });
      }
    });
  }

  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.warn("Terminating unresponsive client");
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.heartbeatInterval);
  }

  handleClientDisconnect(userId) {
    this.removeClient(userId);
    this.handleUserDisconnect(userId);
  }

  handleUserDisconnect(userId) {
    // Handle any ongoing calls when user disconnects
    this.activeCalls.forEach((call, callId) => {
      if (call.callerId === userId || call.receiverId === userId) {
        const otherUserId =
          call.callerId === userId ? call.receiverId : call.callerId;

        this.sendToUser(otherUserId, {
          type: "call-ended",
          callId,
          reason: "user-disconnected",
        });

        this.activeCalls.delete(callId);
        logger.info(`Call ${callId} ended due to user ${userId} disconnect`);
      }
    });

    // Remove from audio clients
    this.audioClients.delete(userId);

    // Remove from sensor clients
    this.sensorClients.delete(userId);
  }

  addClient(userId, ws) {
    // Close existing connection if present
    if (this.clients.has(userId)) {
      this.clients.get(userId).close(1001, "Duplicate connection");
    }

    this.clients.set(userId, ws);
    logger.info(`Client ${userId} connected (${this.clients.size} total)`);
  }

  removeClient(userId) {
    if (this.clients.delete(userId)) {
      logger.info(
        `Client ${userId} disconnected (${this.clients.size} remaining)`
      );
    }

    // Clear interval if no clients left
    if (this.clients.size === 0 && this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (!client || client.readyState !== WebSocket.OPEN) return false;

    try {
      client.send(JSON.stringify(data));
      return true;
    } catch (err) {
      logger.error(`Send error to ${userId}: ${err.message}`);
      this.removeClient(userId);
      return false;
    }
  }

  broadcast(data) {
    let successCount = 0;
    this.clients.forEach((client, userId) => {
      if (this.sendToUser(userId, data)) {
        successCount++;
      }
    });
    return successCount;
  }

  async saveCallToDatabase(call) {
    try {
      const callData = {
        callId: call.callId,
        callerId: call.callerId,
        receiverId: call.receiverId,
        callerName: call.callerName,
        callType: call.callType,
        status: call.status,
        startTime: call.startTime,
        acceptTime: call.acceptTime,
        endTime: call.endTime,
      };

      // Note: You'll need to import the Call model
      // await Call.findOneAndUpdate({ callId: call.callId }, callData, {
      //   upsert: true,
      //   new: true,
      // });
    } catch (error) {
      logger.error(`Failed to save call to database: ${error.message}`);
    }
  }

  // Video calling utility methods
  getActiveCall(callId) {
    return this.activeCalls.get(callId);
  }

  getUserActiveCalls(userId) {
    const userCalls = [];
    this.activeCalls.forEach((call) => {
      if (call.callerId === userId || call.receiverId === userId) {
        userCalls.push(call);
      }
    });
    return userCalls;
  }

  getCallStats() {
    return {
      totalActiveCalls: this.activeCalls.size,
      connectedClients: this.clients.size,
      esp32Clients: this.esp32Clients.size,
      audioListeners: this.audioClients.size,
    };
  }

  // Audio streaming utility methods
  getAudioStreamStats() {
    const stats = {
      totalESP32Devices: this.esp32Clients.size,
      totalAudioListeners: this.audioClients.size,
      streamsByDevice: {},
    };

    this.esp32Clients.forEach((client, esp32Id) => {
      if (client.type === "audio") {
        stats.streamsByDevice[esp32Id] = {
          isStreaming: client.isStreaming,
          listenerCount: this.getListenerCount(esp32Id),
          connectedAt: client.connectedAt,
        };
      }
    });

    return stats;
  }
}

module.exports = new WebSocketService();
