// services/websocket.service.js
const WebSocket = require("ws");
const logger = require("../utils/logger");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map user IDs to WebSocket connections
    this.heartbeatInterval = 30000; // 30 seconds
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      clientTracking: true,
      verifyClient: (info, done) => {
        // Basic origin check (extend for production)
        if (!this.isOriginAllowed(info.origin)) {
          return done(false, 401, "Unauthorized origin");
        }
        done(true);
      },
    });

    this.setupEventHandlers();
    this.setupHeartbeat();
    logger.info("WebSocket server initialized");
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, req) => {
      logger.info("New WebSocket connection attempt");

      // 1. Authenticate connection
      this.authenticateConnection(ws, req)
        .then((user) => {
          if (!user) {
            ws.close(1008, "Authentication failed");
            return;
          }

          // 2. Store connection
          this.addClient(user.id, ws);

          // 3. Set up message handlers
          this.setupMessageHandlers(ws, user.id);

          // 4. Send connection confirmation
          this.sendConnectionSuccess(ws, user);

          logger.info(`WebSocket connection established for user ${user.id}`);
        })
        .catch((err) => {
          logger.error(`Connection error: ${err.message}`);
          ws.close(1011, "Server error");
        });
    });
  }

  async authenticateConnection(ws, req) {
    try {
      const token = this.extractToken(req);
      if (!token) {
        ws.close(1008, "Authentication token required");
        return null;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded.user;
    } catch (err) {
      logger.error(`Authentication error: ${err.message}`);
      ws.close(1008, "Invalid token");
      return null;
    }
  }

  extractToken(req) {
    // Check URL params first
    const url = new URL(req.url, `http://${req.headers.host}`);
    const urlToken = url.searchParams.get("token");

    // Fallback to headers (for non-browser clients)
    return urlToken || req.headers["sec-websocket-protocol"];
  }

  isOriginAllowed(origin) {
    if (!origin) return true; // Non-browser clients
    const allowedOrigins = config.cors.allowedOrigins;
    return allowedOrigins.includes(origin) || allowedOrigins.includes("*");
  }

  setupMessageHandlers(ws, userId) {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        logger.debug(`Message from ${userId}: ${JSON.stringify(data)}`);

        // Handle ping/pong
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          return;
        }

        // Add custom message handlers here if needed
      } catch (error) {
        logger.error(`Message handling error: ${error.message}`);
      }
    });

    ws.on("close", () => {
      logger.info(`Connection closed for user ${userId}`);
      this.removeClient(userId);
    });

    ws.on("error", (error) => {
      logger.error(`Connection error for ${userId}: ${error.message}`);
      this.removeClient(userId);
    });
  }

  setupHeartbeat() {
    setInterval(() => {
      this.clients.forEach((ws, userId) => {
        if (ws.isAlive === false) {
          logger.info(`Terminating stale connection for ${userId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(() => {});
      });
    }, this.heartbeatInterval);

    this.wss.on("connection", (ws) => {
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });
    });
  }

  sendConnectionSuccess(ws, user) {
    ws.send(
      JSON.stringify({
        type: "connection",
        status: "authenticated",
        userType: user.userType,
        timestamp: new Date().toISOString(),
      })
    );
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

  broadcastToUsers(userIds, data) {
    let successCount = 0;
    userIds.forEach((userId) => {
      if (this.sendToUser(userId, data)) successCount++;
    });
    return successCount;
  }

  broadcastReminder(reminder) {
    const targetUsers = this.getReminderRecipients(reminder);
    const sentCount = this.broadcastToUsers(targetUsers, {
      type: "reminder",
      data: {
        id: reminder._id,
        title: reminder.title,
        description: reminder.description,
        scheduledTime: reminder.scheduledTime.toISOString(),
        status: reminder.status,
        patientId: reminder.patient._id || reminder.patient,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `Reminder broadcast to ${sentCount}/${targetUsers.length} users`
    );
    return sentCount;
  }

  getReminderRecipients(reminder) {
    const recipients = new Set();

    // Always include the patient
    recipients.add(
      reminder.patient._id?.toString() || reminder.patient.toString()
    );

    // Include caregivers if populated
    if (reminder.patient.caregivers) {
      reminder.patient.caregivers.forEach((c) =>
        recipients.add(c.user._id?.toString() || c.user.toString())
      );
    }

    // Include family if populated
    if (reminder.patient.family) {
      recipients.add(
        reminder.patient.family.user._id?.toString() ||
          reminder.patient.family.user.toString()
      );
    }

    return Array.from(recipients);
  }
}

// Singleton instance
const webSocketService = new WebSocketService();

module.exports = webSocketService;
