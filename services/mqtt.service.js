// const mqtt = require("mqtt");
// const config = require("../config/config");
// const logger = require("../utils/logger");
// const io = require("../app").io;
// class MqttService {
//   constructor(io) {
//     // Accept io as constructor parameter
//     this.getIO = () => {
//       const app = require("../app").app;
//       return app.locals.io;
//     };
//     this.client = null;
//     this.connected = false;
//     this.deviceId = "2113";
//     this.topics = {
//       DEVICE_STATUS: `devices/${this.deviceId}/status`,
//       DEVICE_COMMAND: `devices/${this.deviceId}/commands`,
//     };
//   }

//   connect() {
//     try {
//       const options = {
//         username: config.MQTT_USERNAME,
//         password: config.MQTT_PASSWORD,
//         reconnectPeriod: 1000,
//         connectTimeout: 30 * 1000,
//         protocol: "mqtts", // TLS connection
//       };

//       const url =
//         "mqtts://02ed6b84181647639b35d467c00afbd9.s1.eu.hivemq.cloud:8883";

//       this.client = mqtt.connect(url, options);

//       this.client.on("connect", () => {
//         this.connected = true;
//         logger.info(`✅ Connected to HiveMQ Cloud for device ${this.deviceId}`);
//         this.subscribe(this.topics.DEVICE_STATUS);
//       });

//       this.client.on("error", (error) => {
//         logger.error(
//           `❌ MQTT error (Device ${this.deviceId}): ${error.message}`
//         );
//         this.connected = false;
//       });

//       this.client.on("close", () => {
//         logger.info(`ℹ️ MQTT connection closed for device ${this.deviceId}`);
//         this.connected = false;
//       });

//       this.client.on("message", (topic, message) => {
//         this.handleMessage(topic, message);
//       });
//     } catch (error) {
//       logger.error(
//         `MQTT service error (Device ${this.deviceId}): ${error.message}`
//       );
//     }
//   }

//   handleMessage(topic, message) {
//     try {
//       const payload = JSON.parse(message.toString());
//       if (topic === this.topics.DEVICE_STATUS) {
//         if (payload.reminder === "Alert") {
//           logger.info("Emergency alert received from patient device");

//           const io = this.getIO();
//           if (!io) {
//             logger.error("Socket.IO instance not available");
//             return;
//           }

//           io.emit("emergency", {
//             title: "🚨 EMERGENCY ALERT!",
//             message: "Patient Needs Immediate Assistance",
//             data: {
//               patientId: payload.patientId || "unknown",
//               severity: "high",
//               deviceId: this.deviceId,
//               timestamp: new Date().toISOString(),
//             },
//           });
//         }
//         logger.info(
//           `Status update from ${this.deviceId}: ${JSON.stringify(payload)}`
//         );
//       }
//     } catch (error) {
//       logger.error(
//         `Message handling error (Device ${this.deviceId}): ${error.message}`
//       );
//     }
//   }

//   subscribe(topic) {
//     if (!this.connected) {
//       logger.warn(`⚠️ ${this.deviceId}: Can't subscribe - not connected`);
//       return false;
//     }

//     this.client.subscribe(topic, (err) => {
//       if (err) {
//         logger.error(`❌ ${this.deviceId} subscription failed: ${err.message}`);
//         return;
//       }
//       logger.info(`📡 ${this.deviceId} subscribed to ${topic}`);
//     });
//     return true;
//   }

//   publishToDevice(message) {
//     if (!this.connected) {
//       logger.warn(`⚠️ ${this.deviceId}: Can't publish - not connected`);
//       return false;
//     }

//     this.client.publish(this.topics.DEVICE_COMMAND, JSON.stringify(message), {
//       qos: 1,
//     });
//     logger.info(
//       `📤 Command sent to ${this.deviceId}: ${JSON.stringify(message)}`
//     );
//     return true;
//   }
// }

// // const mqttService = new MqttService();
// module.exports = MqttService;
// const mqtt = require("mqtt");
// const config = require("../config/config");
// const logger = require("../utils/logger");
// const { mqttService } = require("../app");
// class MqttService {
//   constructor(io) {
//     if (!io) {
//       throw new Error("Socket.IO instance is required for MqttService");
//     }
//     this.io = io; // Store the Socket.IO instance
//     this.client = null;
//     this.connected = false;
//     this.deviceId = "2113"; // Hardcoded device ID
//     this.topics = {
//       DEVICE_STATUS: `devices/${this.deviceId}/status`, // Pre-formatted topic
//       DEVICE_COMMAND: `devices/${this.deviceId}/commands`, // Pre-formatted topic
//     };
//   }

//   connect() {
//     try {
//       const options = {
//         username: config.MQTT_USERNAME,
//         password: config.MQTT_PASSWORD,
//         reconnectPeriod: 1000,
//         connectTimeout: 30 * 1000,
//         protocol: "mqtts", // TLS connection
//       };

//       const url =
//         "mqtts://02ed6b84181647639b35d467c00afbd9.s1.eu.hivemq.cloud:8883";

//       this.client = mqtt.connect(url, options);

//       this.client.on("connect", () => {
//         this.connected = true;
//         logger.info(`✅ Connected to HiveMQ Cloud for device ${this.deviceId}`);
//         this.subscribe(this.topics.DEVICE_STATUS);
//       });

//       this.client.on("error", (error) => {
//         logger.error(
//           `❌ MQTT error (Device ${this.deviceId}): ${error.message}`
//         );
//         this.connected = false;
//       });

//       this.client.on("close", () => {
//         logger.info(`ℹ️ MQTT connection closed for device ${this.deviceId}`);
//         this.connected = false;
//       });

//       this.client.on("message", (topic, message) => {
//         this.handleMessage(topic, message);
//       });

//       this.client.on("offline", () => {
//         this.connected = false;
//         logger.info(`ℹ️ MQTT client offline for device ${this.deviceId}`);
//       });
//     } catch (error) {
//       logger.error(
//         `MQTT service error (Device ${this.deviceId}): ${error.message}`
//       );
//     }
//   }

//   handleMessage(topic, message) {
//     try {
//       const payload = JSON.parse(message.toString());

//       if (topic === this.topics.DEVICE_STATUS) {
//         if (payload.reminder === "Alert") {
//           logger.info("Emergency alert received from patient device");

//           // Use the injected Socket.IO instance directly
//           this.io.emit("emergency", {
//             title: "🚨 EMERGENCY ALERT!",
//             message: "Patient Needs Assistance",
//             data: {
//               patientId: payload.patientId || 343434,
//               severity: "high",
//               deviceId: this.deviceId,
//               timestamp: new Date().toISOString(),
//             },
//           });

//           logger.info(
//             `Emergency alert emitted to ${this.io.engine.clientsCount} connected clients`
//           );
//         }

//         logger.info(
//           `📥 Status from ${this.deviceId}: ${JSON.stringify(payload)}`
//         );
//       }
//     } catch (error) {
//       logger.error(
//         `Message handling error (Device ${this.deviceId}): ${error.message}`
//       );
//     }
//   }

//   subscribe(topic) {
//     if (!this.client || !this.connected) {
//       logger.warn(`⚠️ ${this.deviceId}: Can't subscribe - not connected`);
//       return false;
//     }

//     this.client.subscribe(topic, (err) => {
//       if (err) {
//         logger.error(`❌ ${this.deviceId} subscription failed: ${err.message}`);
//         return;
//       }
//       logger.info(`📡 ${this.deviceId} subscribed to ${topic}`);
//     });
//     return true;
//   }

//   publishToDevice(message) {
//     if (!this.client || !this.connected) {
//       logger.warn(`⚠️ ${this.deviceId}: Can't publish - not connected`);
//       return false;
//     }

//     try {
//       this.client.publish(
//         this.topics.DEVICE_COMMAND,
//         JSON.stringify(message),
//         {
//           qos: 1,
//           retain: false,
//         },
//         (err) => {
//           if (err) {
//             logger.error(`❌ ${this.deviceId} publish failed: ${err.message}`);
//             return;
//           }
//           logger.info(
//             `📤 Command sent to ${this.deviceId}: ${JSON.stringify(message)}`
//           );
//         }
//       );
//       return true;
//     } catch (error) {
//       logger.error(`❌ ${this.deviceId} publish error: ${error.message}`);
//       return false;
//     }
//   }

//   // Add a method to check connection status
//   isConnected() {
//     return this.connected && this.client;
//   }
// }
// const mqttService = new MqttService();
// // Export the class (not an instance)
// module.exports = MqttService;

// FINAL CODE
const mqtt = require("mqtt");
const config = require("../config/config");
const logger = require("../utils/logger");
const websocket = require("./websocket.service")

class MqttService {
  constructor(io) {
    if (!io) {
      throw new Error("Socket.IO instance is required for MqttService");
    }
    this.io = io; // Store the Socket.IO instance
    this.client = null;
    this.connected = false;
    this.deviceId = "2113"; // Hardcoded device ID
    this.lastStatusUpdate = null;
  this.statusCheckInterval = null;
  this.STATUS_TIMEOUT = 30000; // 30 seconds
  this.esp32Cyd = {
    deviceId: "2113",
    currentStatus: "offline",
    lastSeen: "Not Available",
    batteryLevel: 80,
    wifiSignal: -70,
    temperature: 25.0,
    displayBrightness: 85,
    uptime: 0
  };
    this.topics = {
      DEVICE_STATUS: `devices/${this.deviceId}/status`, // Pre-formatted topic
      DEVICE_COMMAND: `devices/${this.deviceId}/commands`, // Pre-formatted topic
      DEVICE_VOICE_RECORD: `devices/${this.deviceId}/record`,
    };
  }

  connect() {
    try {
      const options = {
        username: config.MQTT_USERNAME,
        password: config.MQTT_PASSWORD,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        protocol: "mqtts", // TLS connection
      };

      const url =
        "mqtts://02ed6b84181647639b35d467c00afbd9.s1.eu.hivemq.cloud:8883";

      this.client = mqtt.connect(url, options);

      this.client.on("connect", () => {
        this.connected = true;
        logger.info(`✅ Connected to HiveMQ Cloud for device ${this.deviceId}`);
        this.subscribe(this.topics.DEVICE_STATUS);
         // Start status monitoring
      this.startStatusMonitoring();
      });

      this.client.on("error", (error) => {
        logger.error(
          `❌ MQTT error (Device ${this.deviceId}): ${error.message}`
        );
        this.connected = false;
      });

      this.client.on("close", () => {
        logger.info(`ℹ️ MQTT connection closed for device ${this.deviceId}`);
        this.connected = false;
      });

      this.client.on("message", (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on("offline", () => {
        this.connected = false;
        logger.info(`ℹ️ MQTT client offline for device ${this.deviceId}`);
      });
    } catch (error) {
      logger.error(
        `MQTT service error (Device ${this.deviceId}): ${error.message}`
      );
    }
  }

  // Add these new methods to the class
startStatusMonitoring() {
  this.statusCheckInterval = setInterval(() => {
    this.checkDeviceStatus();
  }, 20000); // Check every 10 seconds
}

checkDeviceStatus() {
  if (this.lastStatusUpdate) {
    const timeSinceLastUpdate = Date.now() - this.lastStatusUpdate;
    
    if (timeSinceLastUpdate > this.STATUS_TIMEOUT) {
      // Mark device as offline
      this.esp32Cyd.currentStatus = "offline";
      this.esp32Cyd.lastSeen = new Date(this.lastStatusUpdate).toISOString();
      
      logger.warn(`Device ${this.deviceId} marked as offline - no status for ${timeSinceLastUpdate}ms`);
      
      // Broadcast offline status to WebSocket clients
      websocket.broadcastToClients({
      type: "esp32-cyd-status",
      status: this.esp32Cyd,
      timestamp: new Date().toISOString(),
    })
    }
  }
}

updateDeviceStatus(statusData) {
  this.lastStatusUpdate = Date.now();
  
  // Update esp32Cyd status
  this.esp32Cyd = {
    ...this.esp32Cyd,
    currentStatus: "online",
    lastSeen: new Date().toISOString(),
    batteryLevel: statusData.batteryLevel || this.esp32Cyd.batteryLevel,
    wifiSignal: statusData.wifiSignal || this.esp32Cyd.wifiSignal,
    temperature: statusData.temperature || this.esp32Cyd.temperature,
    displayBrightness: statusData.displayBrightness || this.esp32Cyd.displayBrightness,
    uptime: statusData.uptime || 0
  };
  
  logger.info(`Device ${this.deviceId} status updated:`, this.esp32Cyd);
  
  // Broadcast updated status to WebSocket clients
  websocket.broadcastToClients({
      type: "esp32-cyd-status",
      status: this.esp32Cyd,
      timestamp: new Date().toISOString(),
    })
  
}


  handleMessage(topic, message) {
  try {
    const payload = JSON.parse(message.toString());
    
    if (topic === this.topics.DEVICE_STATUS) {
      // Handle regular status updates
      if (payload.status === "running") {
        this.updateDeviceStatus(payload);
      }
      
      if (payload.type === "emergency") {
        logger.info("Emergency alert received from patient device");
        
        this.io.emit("emergency", {
          title: "🚨 EMERGENCY ALERT!",
          message: "Patient Needs Assistance",
          data: {
            patientId: payload.patientId || 343434,
            severity: "high",
            deviceId: this.deviceId,
            timestamp: new Date().toISOString(),
          },
        });
        
        logger.info(
          `Emergency alert emitted to ${this.io.engine.clientsCount} connected clients`
        );
      }
      
      logger.info(
        `📥 Status from ${this.deviceId}: ${JSON.stringify(payload)}`
      );
      
    } else if (topic === this.topics.DEVICE_VOICE_RECORD) {
      // Handle voice record messages
    }
  } catch (error) {
    logger.error(
      `Message handling error (Device ${this.deviceId}): ${error.message}`
    );
  }
}

  subscribe(topic) {
    if (!this.client || !this.connected) {
      logger.warn(`⚠️ ${this.deviceId}: Can't subscribe - not connected`);
      return false;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        logger.error(`❌ ${this.deviceId} subscription failed: ${err.message}`);
        return;
      }
      logger.info(`📡 ${this.deviceId} subscribed to ${topic}`);
    });
    return true;
  }

  publishToDevice(message) {
    if (!this.client || !this.connected) {
      logger.warn(`⚠️ ${this.deviceId}: Can't publish - not connected`);
      return false;
    }

    try {
      this.client.publish(
        this.topics.DEVICE_COMMAND,
        JSON.stringify(message),
        {
          qos: 1,
          retain: false,
        },
        (err) => {
          if (err) {
            logger.error(`❌ ${this.deviceId} publish failed: ${err.message}`);
            return;
          }
          logger.info(
            `📤 Command sent to ${this.deviceId}: ${JSON.stringify(message)}`
          );
        }
      );
      return true;
    } catch (error) {
      logger.error(`❌ ${this.deviceId} publish error: ${error.message}`);
      return false;
    }
  }

  // Add a method to check connection status
  isConnected() {
    return this.connected && this.client;
  }
}

// Singleton instance - IMPORTANT: Store globally
let mqttServiceInstance = null;

// Initialize the service
const initializeService = (io) => {
  if (!mqttServiceInstance && io) {
    mqttServiceInstance = new MqttService(io);
    logger.info("MQTT Service singleton created");
  }
  return mqttServiceInstance;
};

// Get the existing instance
const getInstance = () => {
  if (!mqttServiceInstance) {
    logger.error(
      "MQTT service not initialized. Call initializeService(io) first."
    );
    return null;
  }
  return mqttServiceInstance;
};

// Export functions and class
module.exports = {
  initializeService,
  getInstance,
  MqttService, // Export class for direct use if needed
};
