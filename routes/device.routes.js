// routes/device.routes.js
const express = require('express');
const { 
  registerDevice, 
  getDevices, 
  getDevice, 
  updateDevice, 
  removeDevice,
  pingDevice
} = require('../controllers/device.controller');
const { protect, authorizeRoles } = require('../middlewares/auth');
const { validate, deviceValidator } = require('../utils/validators');
const { deviceRegLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

// Protect all device routes
router.use(protect);

// Patient-only routes
router.route('/')
  .post(
    authorizeRoles('patient'),
    deviceRegLimiter,
    validate(deviceValidator),
    registerDevice
  )
  .get(authorizeRoles('patient'), getDevices);

router.route('/:id')
  .get(authorizeRoles('patient'), getDevice)
  .put(authorizeRoles('patient'), updateDevice)
  .delete(authorizeRoles('patient'), removeDevice);

// Routes accessible by patient, caregiver, and family
router.post(
  '/:id/ping',
  authorizeRoles('patient', 'caregiver', 'family'),
  pingDevice
);

module.exports = router;