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
    this.callQueue = new Map(); // For managing call states
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
    logger.info("WebSocket server initialized with video calling support");
  }

  async handleUpgrade(request, socket, head) {
    try {
      const { user, error } = await this.verifyClient(request);
      if (error || !user) {
        logger.warn(`Rejected connection: ${error}`);
        return socket.end("HTTP/1.1 401 Unauthorized\r\n\rn");
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
      const user = await User.findById(decoded?.id);
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
      const userId = request.user?.id;
      if (!userId) {
        return ws.close(1008, "Authentication failed");
      }

      logger.info(`New connection from user ${userId}`);

      // Send immediate authentication confirmation
      ws.send(
        JSON.stringify({
          type: "connection",
          status: "authenticated",
          userId,
          timestamp: new Date().toISOString(),
        })
      );

      // Add to clients map
      this.addClient(userId, ws);

      // Setup heartbeat
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
        logger.debug(`Heartbeat from ${userId}`);
      });

      // Message handler
      ws.on("message", (data) => {
        this.handleMessage(ws, userId, data);
      });

      ws.on("close", () => {
        logger.info(`Connection closed for user ${userId}`);
        this.handleUserDisconnect(userId);
        this.removeClient(userId);
      });

      ws.on("error", (err) => {
        logger.error(`Connection error for ${userId}: ${err.message}`);
        this.handleUserDisconnect(userId);
        this.removeClient(userId);
      });
    });

    // Start heartbeat interval if not already running
    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => {
        this.wss.clients.forEach((client) => {
          if (client.isAlive === false) {
            logger.info("Terminating stale connection");
            return client.terminate();
          }

          client.isAlive = false;
          client.ping();
        });
      }, this.heartbeatInterval);
    }
  }

  handleMessage(ws, userId, data) {
    try {
      const message = JSON.parse(data);
      logger.debug(`Message from ${userId}:`, message);

      if (message.type === "ping") {
        return ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }

      if (message.type === "registerUser") {
        console.log("GOT IT REG");
        return;
      }

      // Video calling message handlers
      switch (message.type) {
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

  // handleRejectCall(userId, message) {
  //   try {
  //     const { callId } = message;
  //     const call = this.activeCalls.get(callId);

  //     if (!call || call.receiverId !== userId) {
  //       return;
  //     }

  //     // Notify caller that call was rejected
  //     this.sendToUser(call.callerId, {
  //       type: "call-rejected",
  //       callId,
  //     });

  //     // Clean up call
  //     this.activeCalls.delete(callId);
  //     logger.info(`Call rejected: ${callId}`);
  //   } catch (error) {
  //     logger.error(`Error rejecting call: ${error.message}`);
  //   }
  // }

  // handleEndCall(userId, message) {
  //   try {
  //     const { callId } = message;
  //     const call = this.activeCalls.get(callId);

  //     if (!call) return;

  //     // Notify both parties that call ended
  //     const otherUserId =
  //       call.callerId === userId ? call.receiverId : call.callerId;

  //     this.sendToUser(otherUserId, {
  //       type: "call-ended",
  //       callId,
  //     });

  //     // Clean up call
  //     this.activeCalls.delete(callId);
  //     call.endTime = new Date();

  //     logger.info(`Call ended: ${callId} by ${userId}`);
  //   } catch (error) {
  //     logger.error(`Error ending call: ${error.message}`);
  //   }
  // }

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

  // Add to handleRejectCall
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
  }

  // Existing methods remain unchanged
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
  // Add to WebSocketService class

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

      await Call.findOneAndUpdate({ callId: call.callId }, callData, {
        upsert: true,
        new: true,
      });
    } catch (error) {
      logger.error(`Failed to save call to database: ${error.message}`);
    }
  }

  // Modify handleEndCall to save call data

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
    };
  }
}

module.exports = new WebSocketService();
