const mongoose = require("mongoose");
const User = require("./user.model");

const caregiverSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
  },
  relationship: {
    type: String,
    required: true,
  },
  isAlsoFamilyMember: {
    type: Boolean,
    default: true,
  },
});

module.exports = User.discriminator("Caregiver", caregiverSchema);
