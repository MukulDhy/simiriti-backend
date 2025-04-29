const mqtt = require("mqtt");
const config = require("../config/config");
const logger = require("../utils/logger");

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.topics = {
      DEVICE_STATUS: "devices/{deviceId}/status",
      DEVICE_COMMAND: "devices/{deviceId}/commands",
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

      const url = "mqtts://02ed6b84181647639b35d467c00afbd9.s1.eu.hivemq.cloud:8883";

      this.client = mqtt.connect(url, options);

      this.client.on("connect", () => {
        this.connected = true;
        logger.info("✅ Connected to HiveMQ Cloud MQTT broker");
        this.subscribe(this.topics.DEVICE_STATUS);
      });

      this.client.on("error", (error) => {
        logger.error(`❌ MQTT connection error: ${error.message}`);
        this.connected = false;
      });

      this.client.on("close", () => {
        logger.info("ℹ️ MQTT connection closed");
        this.connected = false;
      });

      this.client.on("message", (topic, message) => {
        this.handleMessage(topic, message);
      });
    } catch (error) {
      logger.error(`MQTT service error: ${error.message}`);
    }
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());

      if (topic.match(/devices\/(.+)\/status/)) {
        const deviceId = topic.split("/")[1];
        logger.info(
          `📥 Received status update from device ${deviceId}: ${JSON.stringify(
            payload
          )}`
        );
        // Update device status in database
        // ...
      }
    } catch (error) {
      logger.error(`Error handling MQTT message: ${error.message}`);
    }
  }

  subscribe(topic) {
    if (!this.connected) {
      logger.warn("⚠️ Cannot subscribe: MQTT client not connected");
      return false;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        logger.error(`❌ Error subscribing to ${topic}: ${err.message}`);
        return;
      }
      logger.info(`📡 Subscribed to ${topic}`);
    });
    return true;
  }

  publishToDevice(deviceId, message) {
    if (!this.connected) {
      logger.warn("⚠️ Cannot publish: MQTT client not connected");
      return false;
    }

    const topic = this.topics.DEVICE_COMMAND.replace("{deviceId}", deviceId);
    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
    logger.info(`📤 Published message to ${topic}`);
    return true;
  }
}

const mqttService = new MqttService();
module.exports = mqttService;
