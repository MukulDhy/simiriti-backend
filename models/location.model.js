const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
      validate: {
        validator: function (v) {
          return !isNaN(v) && v >= -90 && v <= 90;
        },
        message: "Latitude must be between -90 and 90",
      },
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
      validate: {
        validator: function (v) {
          return !isNaN(v) && v >= -180 && v <= 180;
        },
        message: "Longitude must be between -180 and 180",
      },
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      required: true, // This will come from frontend
    },
  },
  {
    timestamps: false, // We're handling our own timestamps
  }
);

module.exports = mongoose.model("Location", locationSchema);
