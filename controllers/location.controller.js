const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const Location = require("../models/location.model");

// @desc    Create or update user location
// @route   POST /api/locations
// @access  Private
exports.upsertLocation = asyncHandler(async (req, res, next) => {
  const { latitude, longitude } = req.body;

  // Basic validation
  if (
    !latitude ||
    !longitude ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new AppError("Invalid coordinates", 400);
  }

  // Upsert logic (create or update)
  const location = await Location.findOneAndUpdate(
    { userId: req.user.id },
    {
      userId: req.user.id,
      latitude,
      longitude,
      updatedAt: new Date(),
    },
    {
      upsert: true, // Create if doesn't exist
      new: true, // Return the updated document
    }
  );

  res.status(200).json({
    success: true,
    data: location,
  });
});

// @desc    Get user's latest location
// @route   GET /api/locations
// @access  Private
exports.getLocation = asyncHandler(async (req, res) => {
  const location = await Location.findOne({ userId: req.user.id }).sort({
    updatedAt: -1,
  });

  if (!location) {
    throw new AppError("No location data found", 404);
  }

  res.status(200).json({
    success: true,
    data: {
      latitude: location.latitude,
      longitude: location.longitude,
      updatedAt: location.updatedAt,
    },
  });
});

exports.getPatientLocation = asyncHandler(async (req, res) => {
  // Correct way to get the parameter (either from params or query)
  const patientId = req.params.id || req.query.id;

  if (!patientId) {
    throw new AppError("Patient ID is required", 400);
  }

  const location = await Location.findOne({ userId: patientId })
    .sort({ updatedAt: -1 }) // Get most recent location
    .select("latitude longitude updatedAt") // Only select needed fields
    .lean(); // Return plain JS object instead of Mongoose document

  if (!location) {
    throw new AppError("No location data found for Your patient", 404);
  }

  res.status(200).json({
    success: true,
    data: {
      latitude: location.latitude,
      longitude: location.longitude,
      updatedAt: location.updatedAt,
      // You could add additional useful info like:
      lastUpdated: new Date(location.updatedAt).toLocaleString(),
    },
  });
});
