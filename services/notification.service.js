const schedule = require("node-schedule");
const { getInstance: getMqttService } = require("./mqtt.service");
const webSocketService = require("./websocket.service");
const logger = require("../utils/logger");
const Reminder = require("../models/reminder.model");

class NotificationService {
  constructor() {
    this.scheduledJobs = new Map();
    this.deviceId = "2113"; // Hardcoded device ID
  }

  async scheduleReminder(reminder) {
    try {
      const jobId = `reminder_${reminder._id}`;

      // Cancel existing job if it exists
      if (this.scheduledJobs.has(jobId)) {
        this.scheduledJobs.get(jobId).cancel();
        this.scheduledJobs.delete(jobId);
      }

      // Schedule new job
      const job = schedule.scheduleJob(reminder.scheduledTime, async () => {
        await this.triggerReminder(reminder._id);
      });

      this.scheduledJobs.set(jobId, job);

      logger.info(
        `⏰ Scheduled reminder ${reminder._id} for ${reminder.scheduledTime}`
      );
      return true;
    } catch (error) {
      logger.error(`Error scheduling reminder: ${error.message}`);
      return false;
    }
  }

  async triggerReminder(reminderId) {
    try {
      const reminder = await Reminder.findById(reminderId).populate("patient");

      if (!reminder || reminder.status !== "scheduled") {
        logger.warn(
          `⚠️ Cannot trigger reminder ${reminderId}: not found or not scheduled`
        );
        return false;
      }

      // Update reminder status
      reminder.status = "triggered";
      await reminder.save();

      // Send notifications
      await this.sendReminderNotifications(reminder);

      logger.info(`🔔 Triggered reminder ${reminderId}`);
      return true;
    } catch (error) {
      logger.error(`Error triggering reminder: ${error.message}`);
      return false;
    }
  }

  async sendReminderNotifications(reminder) {
    try {
      logger.warn(
        `Sending the notification to the mqtt device for reminder: ${reminder.title}`
      );

      // Get MQTT service instance
      let mqttService;

      try {
        // First try to get from the module exports
        const mqttModule = require("./mqtt.service");
        mqttService = mqttModule.getInstance();

        if (!mqttService) {
          throw new Error("MQTT service instance not available");
        }
      } catch (error) {
        logger.error(
          `Failed to get MQTT service from module: ${error.message}`
        );
        // Fall back to global instance
        mqttService = global.mqttService;
      }

      if (!mqttService) {
        logger.error("MQTT service not available - all methods failed");
        return false;
      }

      // Verify the service has the required method
      if (typeof mqttService.publishToDevice !== "function") {
        logger.error(
          `MQTT service is missing publishToDevice method. Available methods: ${Object.keys(
            mqttService
          ).join(", ")}`
        );
        return false;
      }

      if (!mqttService.isConnected()) {
        logger.warn(
          "MQTT service is not connected, attempting to reconnect..."
        );
        mqttService.connect();
        // Wait a bit for connection
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!mqttService.isConnected()) {
          logger.error(
            "MQTT service still not connected after reconnect attempt"
          );
          return false;
        }
      }

      // Prepare the message
      const message = {
        type: "reminder",
        reminderId: reminder._id.toString(),
        title: reminder.title,
        description: reminder.description,
        timestamp: new Date().toISOString(),
      };

      // Send the message
      const success = mqttService.publishToDevice(message);

      if (success) {
        logger.info(
          `📨 Sent reminder to device ${this.deviceId}: ${reminder.title}`
        );
        reminder.notificationSent = true;
        await reminder.save();
      } else {
        logger.error(`Failed to send reminder to device ${this.deviceId}`);
      }

      return success;
    } catch (error) {
      logger.error(`Error sending notifications: ${error.message}`);
      return false;
    }
  }

  async schedulePendingReminders() {
    try {
      const reminders = await Reminder.find({ status: "scheduled" });
      let scheduledCount = 0;

      for (const reminder of reminders) {
        if (new Date(reminder.scheduledTime) > new Date()) {
          await this.scheduleReminder(reminder);
          scheduledCount++;
        }
      }

      logger.info(
        `♻️ Scheduled ${scheduledCount} pending reminders on startup`
      );
      return scheduledCount;
    } catch (error) {
      logger.error(`Error scheduling pending reminders: ${error.message}`);
      return 0;
    }
  }

  async checkMissedReminders() {
    try {
      const now = new Date();
      const missedReminders = await Reminder.find({
        scheduledTime: { $lt: now },
        status: "scheduled",
      });

      for (const reminder of missedReminders) {
        await this.triggerReminder(reminder._id);
      }

      if (missedReminders.length > 0) {
        logger.info(`⏳ Processed ${missedReminders.length} missed reminders`);
      }

      return missedReminders.length;
    } catch (error) {
      logger.error(`Error checking missed reminders: ${error.message}`);
      return 0;
    }
  }
}

// Singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
