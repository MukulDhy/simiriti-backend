// app.js
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const config = require("./config/config.js");
// const
const connectDB = require("./config/db");
const logger = require("./utils/logger");

const { defaultLimiter } = require("./middlewares/rateLimit");
const errorHandler = require("./middlewares/error");
const mqttService = require("./services/mqtt.service");
const notificationService = require("./services/notification.service");

// Route imports
const authRoutes = require("./routes/auth.routes");
const deviceRoutes = require("./routes/device.routes");
const reminderRoutes = require("./routes/reminder.routes");
const userRoutes = require("./routes/user.routes");

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting - apply to all routes
app.use(defaultLimiter);

// Logging
app.use(morgan("combined", { stream: logger.stream }));

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/users", userRoutes);
// app.use("/api/alerts", alertRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("API is running");
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.PORT;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
});

// Initialize WebSocket server
const webSocketService = require("./services/websocket.service");
webSocketService.initialize(server);

// Connect to MQTT broker
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

module.exports = app;
