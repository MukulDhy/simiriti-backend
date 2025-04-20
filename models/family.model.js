const mongoose = require("mongoose");
const User = require("./user.model");

const familySchema = new mongoose.Schema({
  relationship: {
    type: String,
    required: [true, "Relationship to patient is required"],
  },
  patients: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
});

module.exports = User.discriminator("Family", familySchema);
