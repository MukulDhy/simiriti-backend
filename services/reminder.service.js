const Reminder = require("../models/reminder.model");
const notificationService = require("./notification.service");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");

// Single device system constants
const DEVICE_ID = "2113";

exports.createReminder = async (reminderData) => {
  try {
    // Validate scheduled time
    if (new Date(reminderData.scheduledTime) <= new Date()) {
      throw new AppError("Scheduled time must be in the future", 400);
    }

    const reminder = await Reminder.create({
      ...reminderData,
      status: "scheduled",
    });

    await notificationService.scheduleReminder(reminder);
    logger.info(`⏰ Created reminder for device ${DEVICE_ID}: ${reminder._id}`);
    return reminder;
  } catch (error) {
    logger.error(`Reminder creation error: ${error.message}`);
    throw error;
  }
};

exports.getReminderById = async (id) => {
  const reminder = await Reminder.findById(id);
  if (!reminder) throw new AppError("Reminder not found", 404);
  return reminder;
};

exports.updateReminder = async (id, updateData) => {
  const reminder = await Reminder.findById(id);
  if (!reminder) throw new AppError("Reminder not found", 404);

  if (reminder.status === "triggered") {
    throw new AppError("Cannot modify triggered reminders", 400);
  }

  if (updateData.scheduledTime) {
    const newTime = new Date(updateData.scheduledTime);
    if (newTime <= new Date()) {
      throw new AppError("New time must be in the future", 400);
    }
    updateData.status = "scheduled";
  }

  const updatedReminder = await Reminder.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (updatedReminder.status === "scheduled") {
    await notificationService.scheduleReminder(updatedReminder);
  }

  logger.info(`🔄 Updated reminder ${id} for device ${DEVICE_ID}`);
  return updatedReminder;
};

exports.cancelReminder = async (id) => {
  const reminder = await Reminder.findById(id);
  if (!reminder) throw new AppError("Reminder not found", 404);
  if (reminder.status === "triggered") {
    throw new AppError("Cannot cancel triggered reminders", 400);
  }

  reminder.status = "cancelled";
  await reminder.save();
  logger.info(`❌ Cancelled reminder ${id} for device ${DEVICE_ID}`);
  return reminder;
};

exports.processDueReminders = async () => {
  const dueReminders = await Reminder.find({
    scheduledTime: { $lte: new Date() },
    status: "scheduled",
  });

  for (const reminder of dueReminders) {
    reminder.status = "triggered";
    await reminder.save();
    await notificationService.sendReminderNotifications(reminder);
  }

  if (dueReminders.length) {
    logger.info(
      `⏳ Processed ${dueReminders.length} reminders for ${DEVICE_ID}`
    );
  }
  return dueReminders.length;
};

exports.getAllReminders = async () => {
  return Reminder.find().sort({ scheduledTime: 1 });
};
