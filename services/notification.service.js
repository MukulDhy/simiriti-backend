// services/notification.service.js
const schedule = require("node-schedule");
const mqttService = require("./mqtt.service");
const webSocketService = require("./websocket.service");
const logger = require("../utils/logger");
const Reminder = require("../models/reminder.model");
const Device = require("../models/device.model");

class NotificationService {
  constructor() {
    this.scheduledJobs = new Map();
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
        `Scheduled reminder ${reminder._id} for ${reminder.scheduledTime}`
      );
      return true;
    } catch (error) {
      logger.error(`Error scheduling reminder: ${error.message}`);
      return false;
    }
  }

  async triggerReminder(reminderId) {
    try {
      const reminder = await Reminder.findById(reminderId)
        .populate("patient")
        .populate("createdBy");

      if (!reminder || reminder.status !== "scheduled") {
        logger.warn(
          `Cannot trigger reminder ${reminderId}: not found or not scheduled`
        );
        return false;
      }

      // Update reminder status
      reminder.status = "triggered";
      await reminder.save();

      // Send notifications directly (no alert creation)
      await this.sendReminderNotifications(reminder);

      // Handle recurrence if needed

      logger.info(`Triggered reminder ${reminderId}`);
      return true;
    } catch (error) {
      logger.error(`Error triggering reminder: ${error.message}`);
      return false;
    }
  }

  async sendReminderNotifications(reminder) {
    try {
      // Populate reminder with patient data
      const populatedReminder = await Reminder.findById(reminder._id).populate({
        path: "patient",
        populate: [
          { path: "devices" },
          { path: "caregivers", populate: { path: "user" } },
          { path: "family", populate: { path: "user" } },
        ],
      });

      if (!populatedReminder) {
        logger.warn(
          `Cannot send notifications: Reminder ${reminder._id} not found`
        );
        return false;
      }

      // Send to WebSocket clients
      webSocketService.broadcastReminder(populatedReminder);

      // Send to patient's devices via MQTT
      if (populatedReminder.patient.devices?.length > 0) {
        for (const device of populatedReminder.patient.devices) {
          if (device.status === "active") {
            mqttService.publishToDevice(device.deviceId, {
              type: "reminder",
              reminderId: populatedReminder._id,
              title: populatedReminder.title,
              description: populatedReminder.description,
              timestamp: new Date(),
            });
          }
        }
      }

      logger.info(`Sent notifications for reminder ${reminder._id}`);
      return true;
    } catch (error) {
      logger.error(`Error sending reminder notifications: ${error.message}`);
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
        `Scheduled ${scheduledCount} pending reminders on service start`
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
        logger.info(`Processed ${missedReminders.length} missed reminders`);
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
