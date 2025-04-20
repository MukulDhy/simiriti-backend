// controllers/device.controller.js
const Device = require('../models/device.model');
const Patient = require('../models/patient.model');
const logger = require('../utils/logger');
const mqttService = require('../services/mqtt.service');

// @desc    Register new device
// @route   POST /api/devices
// @access  Private (patient only)
exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    
    // Check if device already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        error: 'Device ID already registered'
      });
    }
    
    // Create new device
    const device = await Device.create({
      deviceId,
      patient: req.user._id,
      status: 'active',
      lastActive: new Date()
    });
    
    // Update patient with device reference
    await Patient.findByIdAndUpdate(
      req.user._id,
      { $push: { devices: device._id } }
    );
    
    // Publish device registration to MQTT
    mqttService.publishToDevice(deviceId, {
      type: 'registration',
      status: 'success',
      timestamp: new Date()
    });
    
    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error(`Register device error: ${error.message}`);
    next(error);
  }
};

// @desc    Get all devices for the patient
// @route   GET /api/devices
// @access  Private (patient only)
exports.getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find({ patient: req.user._id });
    
    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    logger.error(`Get devices error: ${error.message}`);
    next(error);
  }
};

// @desc    Get single device
// @route   GET /api/devices/:id
// @access  Private (patient only)
exports.getDevice = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // Check if device belongs to the patient
    if (device.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this device'
      });
    }
    
    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error(`Get device error: ${error.message}`);
    next(error);
  }
};

// @desc    Update device status
// @route   PUT /api/devices/:id
// @access  Private (patient only)
exports.updateDevice = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    let device = await Device.findById(req.params.id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // Check if device belongs to the patient
    if (device.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this device'
      });
    }
    
    // Update device
    device = await Device.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        lastActive: new Date()
      },
      { new: true, runValidators: true }
    );
    
    // Publish status update to MQTT
    mqttService.publishToDevice(device.deviceId, {
      type: 'status_update',
      status: device.status,
      timestamp: new Date()
    });
    
    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error(`Update device error: ${error.message}`);
    next(error);
  }
};

// @desc    Remove device
// @route   DELETE /api/devices/:id
// @access  Private (patient only)
exports.removeDevice = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // Check if device belongs to the patient
    if (device.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to remove this device'
      });
    }
    
    // Remove device reference from patient
    await Patient.findByIdAndUpdate(
      req.user._id,
      { $pull: { devices: device._id } }
    );
    
    // Delete device
    await device.remove();
    
    // Publish removal to MQTT
    mqttService.publishToDevice(device.deviceId, {
      type: 'deregistration',
      status: 'removed',
      timestamp: new Date()
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    logger.error(`Remove device error: ${error.message}`);
    next(error);
  }
};

// @desc    Ping device
// @route   POST /api/devices/:id/ping
// @access  Private (patient, caregiver, family)
exports.pingDevice = async (req, res, next) => {
  try {
    const device = await Device.findById(req.params.id)
      .populate('patient');
    
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }
    
    // Publish ping to MQTT
    const pingResult = mqttService.publishToDevice(device.deviceId, {
      type: 'ping',
      sender: req.user._id,
      senderType: req.user.userType,
      timestamp: new Date()
    });
    
    if (!pingResult) {
      return res.status(500).json({
        success: false,
        error: 'Failed to ping device. MQTT service not available.'
      });
    }
    
    // Update last active
    device.lastActive = new Date();
    await device.save();
    
    res.status(200).json({
      success: true,
      message: 'Ping sent to device',
      data: {
        deviceId: device.deviceId,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error(`Ping device error: ${error.message}`);
    next(error);
  }
};