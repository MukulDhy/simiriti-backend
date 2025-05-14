// // app.js
// const express = require("express");
// const morgan = require("morgan");
// const cors = require("cors");
// const helmet = require("helmet");
// const path = require("path");
// const bodyParser = require("body-parser");
// const config = require("./config/config.js");
// const { Server } = require("socket.io");
// // const
// const connectDB = require("./config/db");
// const logger = require("./utils/logger");

// const { defaultLimiter } = require("./middlewares/rateLimit");
// const errorHandler = require("./middlewares/error");
// const mqttService = require("./services/mqtt.service");
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

// // Connect to database
// connectDB();

// // Body parser
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.json());

// // Routes

// // Security middleware
// app.use(helmet());
// app.use(cors());

// // Rate limiting - apply to all routes
// // app.use(defaultLimiter);

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
// const server = app.listen(PORT, () => {
//   logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
// });

// // Initialize WebSocket server
// const webSocketService = require("./services/websocket.service");
// webSocketService.initialize(server);

// // Connect to MQTT broker
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

// module.exports = app;
// app.js
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
const notificationService = require("./services/notification.service");

// Route imports
const authRoutes = require("./routes/auth.routes");
// const deviceRoutes = require("./routes/device.routes");
const reminderRoutes = require("./routes/reminder.routes");
const userRoutes = require("./routes/user.routes");
const basicRoutes = require("./routes/basic.routes.js");
const whatsappRoutes = require("./routes/whatsapp.routes.js");

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all connections (replace with specific origins in production)
  },
});

// Track connected devices
const connectedDevices = new Set();

io.on("connection", (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  connectedDevices.add(socket.id);

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
    connectedDevices.delete(socket.id);
  });
});

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

// Mount routes
app.use("/api/auth", authRoutes);
// app.use("/api/devices", deviceRoutes);
app.use("/api/reminders", reminderRoutes);
// app.use("/api/alerts", alertRoutes);
app.use("/api/users", userRoutes);
app.use("/api/basic", basicRoutes);
app.use("/api/whatsapp", whatsappRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("API is running");
});

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

// Initialize MQTT service with Socket.IO instance
const MqttService = require("./services/mqtt.service");
const mqttService = new MqttService(io);
mqttService.connect();

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

// Export server, app, and io (but do NOT export mqttService here)
module.exports = { app, server, io };
