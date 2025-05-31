const WebSocketService = require("../services/websocket.service");
const Call = require("../models/call.model");
const logger = require("../utils/logger");

class CallController {
  async getCallHistory(req, res, next) {
    try {
      const { userId } = req.user;
      const { page = 1, limit = 20 } = req.query;

      const calls = await Call.find({
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
        .sort({ startTime: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      res.json(calls);
    } catch (error) {
      next(error);
    }
  }

  async getCallDetails(req, res, next) {
    try {
      const { callId } = req.params;
      const call = await Call.findById(callId);

      if (!call) {
        throw new Error("Call not found");
      }

      // Verify user has permission to view this call
      if (![call.callerId, call.receiverId].includes(req.user.userId)) {
        throw new Error("Unauthorized to view this call");
      }

      res.json(call);
    } catch (error) {
      next(error);
    }
  }

  async getIceServers(req, res, next) {
    try {
      const iceServers = [
        {
          urls: [
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
          ],
        },
        // Add your TURN servers here if needed
      ];

      res.json({ iceServers });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CallController();
