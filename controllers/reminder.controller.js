const { validationResult } = require("express-validator");
const Reminder = require("../models/reminder.model");
const Patient = require("../models/patient.model");
const Family = require("../models/family.model");
const Caregiver = require("../models/caregiver.model");
const asyncHandler = require("../utils/asyncHandler");
const notificationService = require("../services/notification.service");
const AppError = require("../utils/appError");

/**
 * @desc    Create a new reminder
 * @route   POST /api/reminders
 * @access  Private (Patient, Family, or Caregiver)
 */
exports.createReminder = asyncHandler(async (req, res, next) => {
  // 1. Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()));
  }

  const { title, description, scheduledTime, recurrence = "none" } = req.body;
  let { patient } = req.body;

  // 2. Determine patient based on user type
  patient = await determinePatientForUser(req.user, patient);
  if (!patient) {
    return next(
      new AppError("Not authorized to create reminders for this patient", 403)
    );
  }

  // 3. Validate scheduled time
  const scheduleDate = new Date(scheduledTime);
  if (scheduleDate <= new Date()) {
    return next(new AppError("Scheduled time must be in the future", 400));
  }

  // 4. Create and schedule reminder
  const reminder = await Reminder.create({
    title,
    description,
    scheduledTime: scheduleDate,
    patient,
    createdBy: req.user.id,
    recurrence,
    status: "scheduled",
  });

  await notificationService.scheduleReminder(reminder);

  res.status(201).json({
    status: "success",
    data: reminder,
  });
});

/**
 * @desc    Get all reminders
 * @route   GET /api/reminders
 * @access  Private (Patient, Family, or Caregiver)
 */
exports.getReminders = asyncHandler(async (req, res, next) => {
  // 1. Build base query based on user type
  const query = await buildReminderQuery(req.user, req.query);

  // 2. Execute query with sorting and pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [reminders, total] = await Promise.all([
    Reminder.find(query)
      .sort({ scheduledTime: 1 })
      .skip(skip)
      .limit(limit)
      .populate("patient", "name")
      .populate("createdBy", "name userType"),
    Reminder.countDocuments(query),
  ]);

  res.status(200).json({
    status: "success",
    results: reminders.length,
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    data: reminders,
  });
});

/**
 * @desc    Get single reminder
 * @route   GET /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
exports.getReminder = asyncHandler(async (req, res, next) => {
  const reminder = await Reminder.findById(req.params.id)
    .populate("patient", "name")
    .populate("createdBy", "name userType");

  if (!reminder) {
    return next(new AppError("Reminder not found", 404));
  }

  if (!(await hasReminderAccess(req.user, reminder))) {
    return next(new AppError("Not authorized to access this reminder", 403));
  }

  res.status(200).json({
    status: "success",
    data: reminder,
  });
});

/**
 * @desc    Update reminder
 * @route   PATCH /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
exports.updateReminder = asyncHandler(async (req, res, next) => {
  // 1. Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError("Validation failed", 400, errors.array()));
  }

  // 2. Find and validate reminder
  let reminder = await Reminder.findById(req.params.id);
  if (!reminder) {
    return next(new AppError("Reminder not found", 404));
  }

  if (!(await hasReminderAccess(req.user, reminder))) {
    return next(new AppError("Not authorized to update this reminder", 403));
  }

  if (reminder.status === "triggered") {
    return next(new AppError("Cannot update a triggered reminder", 400));
  }

  // 3. Validate scheduled time if being updated
  if (req.body.scheduledTime) {
    const newTime = new Date(req.body.scheduledTime);
    if (newTime <= new Date()) {
      return next(new AppError("Scheduled time must be in the future", 400));
    }
  }

  // 4. Update reminder
  const updatedFields = {
    ...req.body,
    ...(req.body.scheduledTime && { status: "scheduled" }), // Reset status if time changed
  };

  reminder = await Reminder.findByIdAndUpdate(req.params.id, updatedFields, {
    new: true,
    runValidators: true,
  });

  // 5. Reschedule if needed
  if (reminder.status === "scheduled") {
    await notificationService.scheduleReminder(reminder);
  }

  res.status(200).json({
    status: "success",
    data: reminder,
  });
});

/**
 * @desc    Cancel reminder
 * @route   DELETE /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
exports.cancelReminder = asyncHandler(async (req, res, next) => {
  const reminder = await Reminder.findById(req.params.id);
  if (!reminder) {
    return next(new AppError("Reminder not found", 404));
  }

  if (!(await hasReminderAccess(req.user, reminder))) {
    return next(new AppError("Not authorized to cancel this reminder", 403));
  }

  if (reminder.status === "triggered") {
    return next(new AppError("Cannot cancel a triggered reminder", 400));
  }

  reminder.status = "cancelled";
  await reminder.save();

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Determine the patient ID based on user type and input
 */
async function determinePatientForUser(user, inputPatientId) {
  switch (user.userType) {
    case "patient":
      return user.id; // Patients can only create for themselves
    case "family":
      const family = await Family.findOne({ user: user.id });
      if (!family) return null;
      // Must either not specify patient or specify their linked patient
      if (inputPatientId && inputPatientId !== family.patient.toString())
        return null;
      return family.patient;
    case "caregiver":
      if (!inputPatientId) return null;
      // Verify caregiver is assigned to this patient
      const isAssigned = await Caregiver.exists({
        user: user.id,
        patient: inputPatientId,
      });
      return isAssigned ? inputPatientId : null;
    default:
      return null;
  }
}

/**
 * Build query based on user type and request filters
 */
async function buildReminderQuery(user, queryParams) {
  const { status, from, to } = queryParams;
  const query = {};

  // Base patient filter based on user type
  switch (user.userType) {
    case "patient":
      query.patient = user.id;
      break;
    case "family":
      const family = await Family.findOne({ user: user.id });
      if (!family)
        throw new AppError("Family member not linked to any patient", 404);
      query.patient = family.patient;
      break;
    case "caregiver":
      const assignments = await Caregiver.find({ user: user.id }).select(
        "patient"
      );
      if (!assignments.length)
        throw new AppError("No patient assignments found", 404);
      query.patient = { $in: assignments.map((a) => a.patient) };
      break;
    default:
      throw new AppError("Invalid user type", 400);
  }

  // Additional filters
  if (status && ["scheduled", "triggered", "cancelled"].includes(status)) {
    query.status = status;
  }

  if (from || to) {
    query.scheduledTime = {};
    if (from) query.scheduledTime.$gte = new Date(from);
    if (to) query.scheduledTime.$lte = new Date(to);
  }

  return query;
}

/**
 * Check if user has access to a specific reminder
 */
async function hasReminderAccess(user, reminder) {
  // Creator always has access
  if (reminder.createdBy.toString() === user.id) return true;

  // Patient has access to their own reminders
  if (user.userType === "patient" && reminder.patient.toString() === user.id) {
    return true;
  }

  // Family members have access to their patient's reminders
  if (user.userType === "family") {
    const family = await Family.findOne({ user: user.id });
    return family && family.patient.toString() === reminder.patient.toString();
  }

  // Caregivers have access to their assigned patients' reminders
  if (user.userType === "caregiver") {
    return Caregiver.exists({
      user: user.id,
      patient: reminder.patient,
    });
  }

  return false;
}
