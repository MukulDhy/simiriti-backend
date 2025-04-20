const mongoose = require("mongoose");
const User = require("./user.model");

const patientSchema = new mongoose.Schema({
  medicalRecordNumber: {
    type: String,
    unique: true,
  },
  dateOfBirth: Date,
  primaryDiagnosis: String,
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  devices: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
  },
});

module.exports = User.discriminator("Patient", patientSchema);
