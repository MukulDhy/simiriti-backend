// // // app.js
// // const express = require("express");
// // const morgan = require("morgan");
// // const cors = require("cors");
// // const helmet = require("helmet");
// // const path = require("path");
// // const bodyParser = require("body-parser");
// // const config = require("./config/config.js");
// // const { Server } = require("socket.io");
// // // const
// // const connectDB = require("./config/db");
// // const logger = require("./utils/logger");

// // const { defaultLimiter } = require("./middlewares/rateLimit");
// // const errorHandler = require("./middlewares/error");
// // const mqttService = require("./services/mqtt.service");
// // const notificationService = require("./services/notification.service");

// // // Route imports
// // const authRoutes = require("./routes/auth.routes");
// // // const deviceRoutes = require("./routes/device.routes");
// // const reminderRoutes = require("./routes/reminder.routes");
// // const userRoutes = require("./routes/user.routes");
// // const basicRoutes = require("./routes/basic.routes.js");

// // const whatsappRoutes = require("./routes/whatsapp.routes.js");
// // // Initialize express app
// // const app = express();

// // // Connect to database
// // connectDB();

// // // Body parser
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true }));
// // app.use(bodyParser.json());

// // // Routes

// // // Security middleware
// // app.use(helmet());
// // app.use(cors());

// // // Rate limiting - apply to all routes
// // // app.use(defaultLimiter);

// // // Logging
// // app.use(morgan("combined", { stream: logger.stream }));

// // // Set static folder
// // app.use(express.static(path.join(__dirname, "public")));

// // // Mount routes
// // app.use("/api/auth", authRoutes);
// // // app.use("/api/devices", deviceRoutes);
// // app.use("/api/reminders", reminderRoutes);
// // // app.use("/api/alerts", alertRoutes);
// // app.use("/api/users", userRoutes);
// // app.use("/api/basic", basicRoutes);
// // app.use("/api/whatsapp", whatsappRoutes);

// // // Root route
// // app.get("/", (req, res) => {
// //   res.send("API is running");
// // });

// // // Error handler
// // app.use(errorHandler);

// // // Start server
// // const PORT = config.PORT;
// // const server = app.listen(PORT, () => {
// //   logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
// // });

// // // Initialize WebSocket server
// // const webSocketService = require("./services/websocket.service");
// // webSocketService.initialize(server);

// // // Connect to MQTT broker
// // mqttService.connect();

// // // Schedule pending reminders
// // notificationService
// //   .schedulePendingReminders()
// //   .then(() => {
// //     return notificationService.checkMissedReminders();
// //   })
// //   .catch((err) => {
// //     logger.error(`Error initializing notification service: ${err.message}`);
// //   });

// // // Handle unhandled promise rejections
// // process.on("unhandledRejection", (err) => {
// //   logger.error(`Unhandled Rejection: ${err.message}`);
// //   server.close(() => process.exit(1));
// // });

// // module.exports = app;
// const express = require("express");
// const morgan = require("morgan");
// const cors = require("cors");
// const helmet = require("helmet");
// const path = require("path");
// const bodyParser = require("body-parser");
// const config = require("./config/config.js");
// const http = require("http");
// const { Server } = require("socket.io");
// const connectDB = require("./config/db");
// const logger = require("./utils/logger");

// const { defaultLimiter } = require("./middlewares/rateLimit");
// const errorHandler = require("./middlewares/error");
// const notificationService = require("./services/notification.service");

// // Route imports
// const authRoutes = require("./routes/auth.routes");
// // const deviceRoutes = require("./routes/device.routes");
// const reminderRoutes = require("./routes/reminder.routes");
// const userRoutes = require("./routes/user.routes");
// const basicRoutes = require("./routes/basic.routes.js");
// const whatsappRoutes = require("./routes/whatsapp.routes.js");

// // Initialize express app
// const app = express();

// // Create HTTP server
// const server = http.createServer(app);

// // Initialize Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: "*", // Allow all connections (replace with specific origins in production)
//   },
// });

// // Track connected devices
// const connectedDevices = new Set();

// io.on("connection", (socket) => {
//   logger.info(`New client connected: ${socket.id}`);
//   connectedDevices.add(socket.id);

//   socket.on("disconnect", () => {
//     logger.info(`Client disconnected: ${socket.id}`);
//     connectedDevices.delete(socket.id);
//   });
// });

// // Connect to database
// connectDB();

// // Body parser
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.json());

// // Security middleware
// app.use(helmet());
// app.use(cors());

// // Logging
// app.use(morgan("combined", { stream: logger.stream }));

// // Set static folder
// app.use(express.static(path.join(__dirname, "public")));

// // Mount routes
// app.use("/api/auth", authRoutes);
// // app.use("/api/devices", deviceRoutes);
// app.use("/api/reminders", reminderRoutes);
// // app.use("/api/alerts", alertRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/basic", basicRoutes);
// app.use("/api/whatsapp", whatsappRoutes);

// // Root route
// app.get("/", (req, res) => {
//   res.send("API is running");
// });

// // Error handler
// app.use(errorHandler);

// // Start server
// const PORT = config.PORT;
// server.listen(PORT, () => {
//   logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
// });

// // Initialize WebSocket service (if you still need this)
// const webSocketService = require("./services/websocket.service");
// webSocketService.initialize(server);

// // Initialize MQTT service with Socket.IO instance
// const MqttService = require("./services/mqtt.service");
// const mqttService = new MqttService(io);
// mqttService.connect();

// // Schedule pending reminders
// notificationService
//   .schedulePendingReminders()
//   .then(() => {
//     return notificationService.checkMissedReminders();
//   })
//   .catch((err) => {
//     logger.error(`Error initializing notification service: ${err.message}`);
//   });

// // Handle unhandled promise rejections
// process.on("unhandledRejection", (err) => {
//   logger.error(`Unhandled Rejection: ${err.message}`);
//   server.close(() => process.exit(1));
// });

// // Export server, app, and io (but do NOT export mqttService here)
// module.exports = { app, server, io, mqttService };

// FINAL NEW CODE
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const bodyParser = require("body-parser");
const config = require("./config/config.js");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const logger = require("./utils/logger");

const { defaultLimiter } = require("./middlewares/rateLimit");
const errorHandler = require("./middlewares/error");

// Route imports
const authRoutes = require("./routes/auth.routes");
// const deviceRoutes = require("./routes/device.routes");
const reminderRoutes = require("./routes/reminder.routes");
const userRoutes = require("./routes/user.routes");
const basicRoutes = require("./routes/basic.routes.js");
const whatsappRoutes = require("./routes/whatsapp.routes.js");
const locationRoutes = require("./routes/location.routes.js");
const CallRoutes = require("./routes/call.routes.js");

const axios = require("axios");

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all connections (replace with specific origins in production)
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// // Track connected devices
// const connectedUsers = new Map();
// const connectedDevices = new Set();

// io.on("connection", (socket) => {
//   logger.info(`New client connected: ${socket.id}`);
//   connectedDevices.add(socket.id);

//   socket.on("disconnect", () => {
//     logger.info(`Client disconnected: ${socket.id}`);
//     connectedDevices.delete(socket.id);
//   });
// });

// Connect to database
connectDB();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Security middleware
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan("combined", { stream: logger.stream }));

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// Mount routes (after MQTT service is initialized)
app.use("/api/auth", authRoutes);
// app.use("/api/devices", deviceRoutes);
app.use("/api/reminders", reminderRoutes);
// app.use("/api/alerts", alertRoutes);
app.use("/api/users", userRoutes);
app.use("/api/basic", basicRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/call", CallRoutes);
// Root route
app.get("/", (req, res) => {
  res.send("API is running");
});

const connectedUsers = new Map();
const connectedDevices = new Set();

// Mock AI service
let i = 0;
const analyzeAudioWithAI = async (audioData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const mockSpeakers = ["Pooja", "Diksha", "Pooja", "Mukul","Sumit"];
      const randomSpeaker =
        mockSpeakers[i%mockSpeakers.length];
      resolve({
        speaker: randomSpeaker,
        confidence: (Math.random() * 0.5 + 0.5).toFixed(2), // Random confidence between 0.5-1.0
      });
    }, 15000);
  });
};

// Audio analysis endpoint
app.post("/analyze-audio", async (req, res) => {
  try {
    const { audio } = req.body;
    console.log("Received audio data length:", audio ? audio.length : 0);

    if (!audio) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    // Prepare data for FastAPI endpoint
    const audioData = {
      audio: audio, // base64 encoded audio data
      format: "wav", // or whatever format you're using
    };

    // Call FastAPI endpoint
    // const result = await axios.post(
    //   "https://spech-identification.onrender.com/analyze-audio",
    //   audioData,
    //   {
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    const result = analyzeAudioWithAI(audioData)
    // webSocketService.sendToUser()
    res.status(200).json({
      success: true,
      data: {
        speaker: result.data.speaker,
        confidence: result.data.confidence,
      },
    });
  } catch (error) {
    console.error(
      "Error analyzing audio:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Failed to analyze audio",
      details: error.response?.data || error.message,
    });
  }
});

// ESP32 trigger endpoint
app.post("/esp32/trigger", (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId is required" });
    }

    const socketId = connectedUsers.get(targetUserId);
    if (!socketId) {
      return res.status(404).json({ error: "User not connected" });
    }

    io.to(socketId).emit("startRecording");
    res.json({
      status: "Recording triggered",
      targetUserId,
      socketId,
    });
  } catch (error) {
    console.error("Error handling ESP32 trigger:", error);
    res.status(500).json({ error: "Failed to trigger recording" });
  }
});

// io.on("connection", (socket) => {
//   logger.info(`New client connected: ${socket.id}`);
//   connectedDevices.add(socket.id);

//   socket.on("disconnect", () => {
//     logger.info(`Client disconnected: ${socket.id}`);
//     connectedDevices.delete(socket.id);
//   });
// });

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  connectedDevices.add(socket.id);
  socket.on("registerUser", (userId) => {
    connectedUsers.set(userId, socket.id);

    console.log(`User ${userId} registered with socket ID ${socket.id}`);
  });

  socket.on("disconnect", () => {
    connectedDevices.delete(socket.id);
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Initialize MQTT service with Socket.IO instance BEFORE mounting routes
const {
  initializeService: initializeMqttService,
} = require("./services/mqtt.service");
const mqttService = initializeMqttService(io);
mqttService.connect();

// Store mqttService globally for access by other modules
global.mqttService = mqttService;
// Error handler
app.use(errorHandler);

// Start server
const PORT = config.PORT;
server.listen(PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
});

// Initialize WebSocket service (if you still need this)
const webSocketService = require("./services/websocket.service");
webSocketService.initialize(server);


io.on('device-status-update', (data) => {
  if (data.type === 'esp32-cyd-status') {
    webSocketService.updateESP32CydStatus(data.status);
  }
});

// Initialize notification service AFTER MQTT service is ready
const notificationService = require("./services/notification.service");

// Schedule pending reminders
notificationService
  .schedulePendingReminders()
  .then(() => {
    return notificationService.checkMissedReminders();
  })
  .catch((err) => {
    logger.error(`Error initializing notification service: ${err.message}`);
  });

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Export server, app, io, and mqttService
module.exports = { app, server, io, mqttService };
