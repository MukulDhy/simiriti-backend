const express = require("express");
const router = express.Router();
const CallController = require("../controllers/call.controller");
const {authorizeRoles,protect} = require("../middlewares/auth");

router.use(protect);

// Call history
router.get("/history", CallController.getCallHistory);
router.get("/:callId", CallController.getCallDetails);

// WebRTC configuration
router.get("/ice-servers", CallController.getIceServers);

module.exports = router;
