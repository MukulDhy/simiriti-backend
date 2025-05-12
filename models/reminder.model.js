const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    scheduledTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "triggered", "cancelled"],
      default: "scheduled",
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for better query performance
reminderSchema.index({ patient: 1, status: 1, scheduledTime: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);

// const mongoose = require("mongoose");

// const reminderSchema = new mongoose.Schema(
//   {
//     patient: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Patient",
//       required: true,
//     },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     title: {
//       type: String,
//       required: true,
//     },
//     description: String,
//     scheduledTime: {
//       type: Date,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["scheduled", "triggered", "cancelled"],
//       default: "scheduled",
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Reminder", reminderSchema);
