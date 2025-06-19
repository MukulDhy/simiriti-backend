const fs = require("fs");
const path = require("path");

class AudioClipManager {
  constructor(clipDurationMs = 10000, audioDir = "./audio_clips") {
    this.clipDurationMs = clipDurationMs; // 10 seconds by default
    this.audioDir = audioDir;
    this.audioBuffer = [];
    this.currentClipStartTime = null;
    this.clipCounter = 0;

    // Create audio directory if it doesn't exist
    this.ensureAudioDirectory();
  }

  ensureAudioDirectory() {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  addAudioData(audioBuffer, timestamp = new Date()) {
    // Initialize clip start time if this is the first chunk
    if (!this.currentClipStartTime) {
      this.currentClipStartTime = timestamp;
    }

    // Add audio data to buffer
    this.audioBuffer.push({
      data: audioBuffer,
      timestamp: timestamp,
    });

    // Check if we've reached the clip duration
    const elapsed = timestamp - this.currentClipStartTime;
    if (elapsed >= this.clipDurationMs) {
      this.saveCurrentClip();
    }
  }

  saveCurrentClip() {
    if (this.audioBuffer.length === 0) return;

    try {
      // Combine all audio buffers
      const combinedBuffer = Buffer.concat(
        this.audioBuffer.map((chunk) => chunk.data)
      );

      // Generate filename with timestamp
      const filename = this.generateFilename();
      const filepath = path.join(this.audioDir, filename);

      // Create WAV header (assuming 16-bit mono PCM at 44100Hz)
      const wavHeader = this.createWavHeader(combinedBuffer.length);

      // Combine header and audio data
      const wavBuffer = Buffer.concat([wavHeader, combinedBuffer]);

      // Save to file
      fs.writeFileSync(filepath, wavBuffer);

      console.log(`Audio clip saved: ${filename} (${wavBuffer.length} bytes)`);

      // Reset for next clip
      this.resetClipBuffer();
    } catch (error) {
      console.error("Error saving audio clip:", error);
    }
  }

  createWavHeader(dataLength, sampleRate = 44100, channels = 1, bitDepth = 16) {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const totalLength = 36 + dataLength;

    const buffer = Buffer.alloc(44);

    // RIFF header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(totalLength, 4);
    buffer.write("WAVE", 8);

    // fmt subchunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);

    // data subchunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
  }

  generateFilename() {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-");
    this.clipCounter++;
    return `audio_clip_${timestamp}_${this.clipCounter}.wav`;
  }

  saveClipMetadata(filename, metadata) {
    const metadataFile = filename.replace(".wav", "_metadata.json");
    const metadataPath = path.join(this.audioDir, metadataFile);

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  resetClipBuffer() {
    this.audioBuffer = [];
    this.currentClipStartTime = null;
  }

  // Force save current clip (useful for cleanup)
  forceStopCurrentClip() {
    if (this.audioBuffer.length > 0) {
      this.saveCurrentClip();
    }
  }

  // Get statistics
  getStats() {
    return {
      currentBufferSize: this.audioBuffer.length,
      currentClipDuration: this.currentClipStartTime
        ? Date.now() - this.currentClipStartTime
        : 0,
      clipsGenerated: this.clipCounter,
      audioDirectory: this.audioDir,
    };
  }
}

// Modified ESP32 message handler
class ESP32Handler {
  constructor() {
    this.esp32Status = { lastSeen: null };
    this.audioClipManager = new AudioClipManager(10000, "./audio_clips"); // 10 seconds
  }

  handleESP32Message(data) {
    try {
      this.esp32Status.lastSeen = new Date();

      // Handle binary data (audio data from ESP32)
      if (data instanceof Buffer) {
        console.log("Received binary audio data from ESP32");

        // Add to audio clip manager
        this.audioClipManager.addAudioData(data, new Date());

        // Convert to base64 for broadcasting (existing functionality)
        const base64Audio = data.toString("base64");
        this.broadcastToClients({
          type: "audio-data",
          timestamp: new Date().toISOString(),
          dataSize: data.length,
          data: base64Audio,
        });

        // Log current stats periodically
        const stats = this.audioClipManager.getStats();
        if (stats.currentBufferSize % 10 === 0) {
          // Log every 10 chunks
          console.log("Audio buffer stats:", stats);
        }

        return;
      }

      // Handle JSON messages (existing code)
      console.log("Received JSON message from ESP32");
      const message = JSON.parse(data.toString());
      console.log(`ESP32 message: ${message.type}`);

      switch (message.type) {
        case "device-info":
          this.handleDeviceInfo(message);
          break;
        case "sensor-data":
          this.handleSensorData(message);
          break;
        case "status-update":
          this.handleStatusUpdate(message);
          break;
        case "ping":
          this.sendToESP32({ type: "pong", timestamp: Date.now() });
          break;
        default:
          console.log(`Unhandled ESP32 message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`ESP32 message handling error: ${err.message}`);
    }
  }

  // Cleanup method - call when server shuts down
  cleanup() {
    this.audioClipManager.forceStopCurrentClip();
  }

  // Placeholder methods (implement based on your needs)
  handleDeviceInfo(message) {
    /* ... */
  }
  handleSensorData(message) {
    /* ... */
  }
  handleStatusUpdate(message) {
    /* ... */
  }
  sendToESP32(message) {
    /* ... */
  }
  broadcastToClients(message) {
    /* ... */
  }
}

// Usage example
const esp32Handler = new ESP32Handler();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  esp32Handler.cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  esp32Handler.cleanup();
  process.exit(0);
});

module.exports = { ESP32Handler, AudioClipManager };
