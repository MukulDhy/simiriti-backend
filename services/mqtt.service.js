// services/mqtt.service.js
const mqtt = require("mqtt");
const config = require("../config/config");
const logger = require("../utils/logger");

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.topics = {
      DEVICE_STATUS: "devices/+/status",
      DEVICE_COMMAND: "devices/{deviceId}/commands",
      ALERT_NOTIFICATION: "patients/{patientId}/alerts",
    };
  }

  connect() {
    try {
      const options = {
        username: config.MQTT_USERNAME,
        password: config.MQTT_PASSWORD,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
      };

      this.client = mqtt.connect(config.MQTT_BROKER_URL, options);

      this.client.on("connect", () => {
        this.connected = true;
        logger.info("Connected to MQTT broker");
        this.subscribe(this.topics.DEVICE_STATUS);
      });

      this.client.on("error", (error) => {
        logger.error(`MQTT connection error: ${error.message}`);
        this.connected = false;
      });

      this.client.on("close", () => {
        logger.info("MQTT connection closed");
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

      // Handle device status updates
      if (topic.match(/devices\/(.+)\/status/)) {
        const deviceId = topic.split("/")[1];
        logger.info(
          `Received status update from device ${deviceId}: ${JSON.stringify(
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
      logger.warn("Cannot subscribe: MQTT client not connected");
      return false;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        logger.error(`Error subscribing to ${topic}: ${err.message}`);
        return;
      }
      logger.info(`Subscribed to ${topic}`);
    });
    return true;
  }

  publishToDevice(deviceId, message) {
    if (!this.connected) {
      logger.warn("Cannot publish: MQTT client not connected");
      return false;
    }

    const topic = this.topics.DEVICE_COMMAND.replace("{deviceId}", deviceId);
    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
    logger.info(`Published message to ${topic}`);
    return true;
  }

  sendAlert(patientId, alert) {
    if (!this.connected) {
      logger.warn("Cannot send alert: MQTT client not connected");
      return false;
    }

    const topic = this.topics.ALERT_NOTIFICATION.replace(
      "{patientId}",
      patientId
    );
    this.client.publish(topic, JSON.stringify(alert), { qos: 1 });
    logger.info(`Alert sent to patient ${patientId}`);
    return true;
  }
}

// Singleton instance
const mqttService = new MqttService();

module.exports = mqttService;
