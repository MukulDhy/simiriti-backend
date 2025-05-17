const { validationResult } = require("express-validator");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const reminderService = require("../services/reminder.service");
const reminderModel = require("../models/reminder.model");

exports.createReminder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError("Validation failed", 400, errors.array());
  }

  const { title, description, scheduledTime, patientId } = req.body;

  if (new Date(scheduledTime) <= new Date()) {
    throw new AppError("Scheduled time must be in the future", 400);
  }

  const reminder = await reminderService.createReminder({
    title,
    description,
    scheduledTime,
    patient: patientId,
    createdBy: req.user.id,
  });
  console.log("Reminder Set Scuccessfull");
  res.status(201).json({
    success: true,
    data: reminder,
  });
});

exports.getReminders = asyncHandler(async (req, res) => {
  const { patientId } = req.query; // Get from query parameters
  console.log("patientId = ", patientId);

  let reminders;

  if (patientId) {
    // Fetch reminders only for the specific patient
    reminders = await reminderModel.find({ patient: patientId });
  } else {
    // Fallback: fetch all reminders (optional, depending on your logic)
    reminders = await reminderService.getAllReminders();
  }

  res.status(200).json({
    status: "success",
    count: reminders.length,
    data: reminders,
  });
});

exports.getReminder = asyncHandler(async (req, res, next) => {
  const reminder = await reminderService.getReminderById(req.params.id);
  res.status(200).json({
    status: "success",
    data: reminder,
  });
});

exports.updateReminder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError("Validation failed", 400, errors.array());
  }

  const reminder = await reminderService.updateReminder(
    req.params.id,
    req.body
  );
  res.status(200).json({
    status: "success",
    data: reminder,
  });
});

exports.cancelReminder = asyncHandler(async (req, res, next) => {
  await reminderService.cancelReminder(req.params.id);
  res.status(204).json({
    status: "success",
    data: null,
  });
});
