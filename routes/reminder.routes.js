// routes/reminder.routes.js
const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middlewares/auth");
const {
  createReminder,
  getReminders,
  getReminder,
  updateReminder,
  cancelReminder,
} = require("../controllers/reminder.controller");
const {
  validate,
  reminderValidator,
  updateReminderValidator,
} = require("../utils/validators");
const { defaultLimiter } = require("../middlewares/rateLimit");

// Apply rate limiting and authentication to all routes
router.use(defaultLimiter);
router.use(protect);

/**
 * @desc    Create a new reminder
 * @route   POST /api/reminders
 * @access  Private (Patient, Family, Caregiver)
 */
router.post(
  "/",
  authorizeRoles("caregiver"),
  validate(reminderValidator),
  createReminder
);

/**
 * @desc    Get all reminders
 * @route   GET /api/reminders
 * @access  Private (Patient, Family, Caregiver)
 */
router.get("/", authorizeRoles("patient", "family", "caregiver"), getReminders);

/**
 * @desc    Get single reminder
 * @route   GET /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
router.get(
  "/:id",
  authorizeRoles("patient", "family", "caregiver"),
  getReminder
);

/**
 * @desc    Update reminder
 * @route   PATCH /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
router.patch(
  "/:id",
  authorizeRoles("patient", "family", "caregiver"),
  validate(updateReminderValidator),
  updateReminder
);

/**
 * @desc    Cancel reminder
 * @route   DELETE /api/reminders/:id
 * @access  Private (Owner or linked to patient)
 */
router.delete(
  "/:id",
  authorizeRoles("patient", "family", "caregiver"),
  cancelReminder
);

module.exports = router;
