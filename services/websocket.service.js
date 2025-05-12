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
    logger.info("WebSocket server initialized");
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
        this.removeClient(userId);
      });

      ws.on("error", (err) => {
        logger.error(`Connection error for ${userId}: ${err.message}`);
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

      // Add other message handlers here
    } catch (err) {
      logger.error(`Message handling error: ${err.message}`);
    }
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
}

module.exports = new WebSocketService();
