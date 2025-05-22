const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth");
const {
  upsertLocation,
  getLocation,
} = require("../controllers/location.controller");

router.use(protect); // All routes require authentication

// Create or update location
router.post("/", upsertLocation);

// Get latest location
router.get("/", getLocation);

module.exports = router;
