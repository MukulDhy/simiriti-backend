const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middlewares/auth");
const {
  upsertLocation,
  getLocation,
  getPatientLocation,
} = require("../controllers/location.controller");

router.use(protect); // All routes require authentication

// Create or update location
router.get("/:id", authorizeRoles("caregiver"), getPatientLocation);
router.post("/", upsertLocation);

// Get latest location
router.get("/", getLocation);

module.exports = router;
