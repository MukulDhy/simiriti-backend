const mongoose = require("mongoose");
const User = require("./user.model");

const caregiverSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
  },
  deviceId: {
    type: Number,
    default: 2113,
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
