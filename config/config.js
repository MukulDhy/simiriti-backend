// config/config.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  // Database
  MONGO_URI:
    process.env.MONGO_URI || "mongodb://localhost:27017/care-management",

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key_here",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "30d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your_refresh_secret",

  // MQTT
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  // MQTT_PORT: process.env.MQTT_PORT || 1883,
  MQTT_USERNAME: process.env.MQTT_USERNAME || "mukulmqtt",
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || "Mukul@jaat123",

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

  // WebSocket
  WEBSOCKET_PATH: process.env.WEBSOCKET_PATH || "/ws",

  // Notification
  NOTIFICATION_CHECK_INTERVAL:
    parseInt(process.env.NOTIFICATION_CHECK_INTERVAL) || 60000, // 1 minute
};

// Validate required configurations
if (!config.JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined in environment variables");
}

module.exports = config;
