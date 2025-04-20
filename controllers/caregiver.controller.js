const { asyncHandler } = require("../utils/errorHandler");
const Caregiver = require("../models/caregiver.model");
const Patient = require("../models/patient.model");

exports.getCaregiverProfile = asyncHandler(async (req, res) => {
  const caregiver = await Caregiver.findOne({ user: req.user.id }).populate(
    "patients.patient",
    "name medicalRecordNumber"
  );

  if (!caregiver) throw new Error("Caregiver profile not found");

  res.json({ success: true, data: caregiver });
});

exports.assignToPatient = asyncHandler(async (req, res) => {
  const { patientId, relationship } = req.body;

  const patient = await Patient.findById(patientId);
  if (!patient) throw new Error("Patient not found");

  const caregiver = await Caregiver.findOne({ user: req.user.id });
  if (!caregiver) throw new Error("Caregiver profile not found");

  await caregiver.addPatient(patientId, relationship);

  // Also add caregiver to patient's caregivers array
  await Patient.findByIdAndUpdate(patientId, {
    $addToSet: { caregivers: req.user.id },
  });

  res.json({ success: true, message: "Patient assigned successfully" });
});

exports.getAssignedPatients = asyncHandler(async (req, res) => {
  const caregiver = await Caregiver.findOne({ user: req.user.id }).populate({
    path: "patients.patient",
    select: "name dateOfBirth primaryDiagnosis",
    match: { "patients.active": true },
  });

  const activePatients = caregiver.patients.filter((p) => p.active);
  res.json({ success: true, data: activePatients });
});

exports.updateCaregiverDetails = asyncHandler(async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    "qualifications",
    "licenseNumber",
    "shifts",
    "backgroundCheck",
  ];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) throw new Error("Invalid updates!");

  const caregiver = await Caregiver.findOneAndUpdate(
    { user: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: caregiver });
});
