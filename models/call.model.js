const mongoose = require("mongoose");
const { Schema } = mongoose;

const callSchema = new Schema(
  {
    callId: { type: String, required: true, unique: true },
    callerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    callerName: { type: String, required: true },
    callType: { type: String, enum: ["video", "audio"], default: "video" },
    status: {
      type: String,
      enum: ["ringing", "accepted", "rejected", "ended", "missed"],
      default: "ringing",
    },
    startTime: { type: Date, default: Date.now },
    acceptTime: Date,
    endTime: Date,
    duration: Number, // in seconds
    callQuality: {
      type: {
        video: {
          sent: { resolution: String, fps: Number },
          received: { resolution: String, fps: Number },
        },
        audio: {
          sent: { bitrate: Number },
          received: { bitrate: Number },
        },
      },
      default: null,
    },
  },
  { timestamps: true }
);

// Calculate duration before saving
callSchema.pre("save", function (next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

const Call = mongoose.model("Call", callSchema);

module.exports = Call;
