const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      default: "esp32-main",
    },
    sensorType: {
      type: String,
      required: true,
      enum: [
        "temperature",
        "humidity",
        "pressure",
        "light",
        "motion",
        "gas",
        "sound",
        "other",
      ],
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      batteryLevel: Number,
      signalStrength: Number,
      location: String,
      additionalInfo: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: "sensor_data",
  }
);

// Indexes for better query performance
sensorDataSchema.index({ deviceId: 1, timestamp: -1 });
sensorDataSchema.index({ sensorType: 1, timestamp: -1 });
sensorDataSchema.index({ timestamp: -1 });

// TTL index to automatically delete old data (optional - keeps data for 30 days)
sensorDataSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model("SensorData", sensorDataSchema);
