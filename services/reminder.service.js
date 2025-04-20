// services/reminder.service.js
const Reminder = require("../models/reminder.model");
const notificationService = require("./notification.service");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");

/**
 * @desc    Create a new reminder and schedule it
 * @param   {Object} reminderData - Reminder data including title, description, scheduledTime, etc.
 * @returns {Promise<Object>} Created reminder
 */
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

    // Schedule notification
    await notificationService.scheduleReminder(reminder);

    logger.info(`Created and scheduled reminder ${reminder._id}`);
    return reminder;
  } catch (error) {
    logger.error(`Error creating reminder: ${error.message}`);
    throw error;
  }
};

/**
 * @desc    Get reminder by ID
 * @param   {String} id - Reminder ID
 * @returns {Promise<Object>} Found reminder
 */
exports.getReminderById = async (id) => {
  const reminder = await Reminder.findById(id)
    .populate("patient", "name email")
    .populate("createdBy", "name userType");

  if (!reminder) {
    throw new AppError("Reminder not found", 404);
  }

  return reminder;
};

/**
 * @desc    Update reminder by ID
 * @param   {String} id - Reminder ID
 * @param   {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated reminder
 */
exports.updateReminder = async (id, updateData) => {
  try {
    const reminder = await Reminder.findById(id);
    if (!reminder) {
      throw new AppError("Reminder not found", 404);
    }

    // Prevent modifying triggered reminders
    if (reminder.status === "triggered") {
      throw new AppError("Cannot modify a triggered reminder", 400);
    }

    // If changing time, validate it's in the future
    if (updateData.scheduledTime) {
      const newTime = new Date(updateData.scheduledTime);
      if (newTime <= new Date()) {
        throw new AppError("New scheduled time must be in the future", 400);
      }
      updateData.status = "scheduled"; // Reset status if time changed
    }

    const updatedReminder = await Reminder.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    // Reschedule if needed
    if (updatedReminder.status === "scheduled") {
      await notificationService.scheduleReminder(updatedReminder);
    }

    logger.info(`Updated reminder ${id}`);
    return updatedReminder;
  } catch (error) {
    logger.error(`Error updating reminder ${id}: ${error.message}`);
    throw error;
  }
};

/**
 * @desc    Cancel reminder by ID
 * @param   {String} id - Reminder ID
 * @returns {Promise<Object>} Cancelled reminder
 */
exports.cancelReminder = async (id) => {
  const reminder = await Reminder.findById(id);
  if (!reminder) {
    throw new AppError("Reminder not found", 404);
  }

  if (reminder.status === "triggered") {
    throw new AppError("Cannot cancel a triggered reminder", 400);
  }

  reminder.status = "cancelled";
  await reminder.save();

  logger.info(`Cancelled reminder ${id}`);
  return reminder;
};

/**
 * @desc    Check for and process due reminders
 * @returns {Promise<Number>} Number of processed reminders
 */
exports.processDueReminders = async () => {
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({
      scheduledTime: { $lte: now },
      status: "scheduled",
    }).populate("patient");

    let processedCount = 0;

    for (const reminder of dueReminders) {
      try {
        // Update reminder status
        reminder.status = "triggered";
        await reminder.save();

        // Send notifications (no alert creation)
        await notificationService.sendReminderNotifications(reminder);

        // Handle recurrence if needed
        if (reminder.recurrence !== "none") {
          await notificationService.scheduleRecurringReminder(reminder);
        }

        processedCount++;
        logger.info(`Processed due reminder ${reminder._id}`);
      } catch (error) {
        logger.error(
          `Error processing reminder ${reminder._id}: ${error.message}`
        );
      }
    }

    if (processedCount > 0) {
      logger.info(`Processed ${processedCount} due reminders`);
    }

    return processedCount;
  } catch (error) {
    logger.error(`Error processing due reminders: ${error.message}`);
    throw error;
  }
};

/**
 * @desc    Get reminders by patient ID
 * @param   {String} patientId - Patient ID
 * @param   {Object} [filters] - Optional filters (status, from, to)
 * @returns {Promise<Array>} List of reminders
 */
exports.getRemindersByPatient = async (patientId, filters = {}) => {
  const query = { patient: patientId };

  // Apply filters
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.from || filters.to) {
    query.scheduledTime = {};
    if (filters.from) query.scheduledTime.$gte = new Date(filters.from);
    if (filters.to) query.scheduledTime.$lte = new Date(filters.to);
  }

  return Reminder.find(query)
    .sort({ scheduledTime: 1 })
    .populate("createdBy", "name userType");
};

/**
 * @desc    Get reminders by creator ID
 * @param   {String} creatorId - User ID who created the reminders
 * @param   {Object} [filters] - Optional filters
 * @returns {Promise<Array>} List of reminders
 */
exports.getRemindersByCreator = async (creatorId, filters = {}) => {
  const query = { createdBy: creatorId };

  // Apply filters (same as getRemindersByPatient)
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.from || filters.to) {
    query.scheduledTime = {};
    if (filters.from) query.scheduledTime.$gte = new Date(filters.from);
    if (filters.to) query.scheduledTime.$lte = new Date(filters.to);
  }

  return Reminder.find(query)
    .sort({ scheduledTime: 1 })
    .populate("patient", "name");
};
