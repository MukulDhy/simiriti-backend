const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  lastActive: Date,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, { timestamps: true });

module.exports = mongoose.model("Device", deviceSchema);