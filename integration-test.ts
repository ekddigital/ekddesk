/**
 * Integration test for EKD Desk Remote System
 * Demonstrates the full pipeline: Capture -> Media Processing -> Signaling -> Remote Control
 */

import { Logger } from "@ekd-desk/shared";
import { VideoProcessor, AudioProcessor, StreamManager } from "@ekd-desk/media";
import { PlatformFactory } from "@ekd-desk/platform";
import { io, Socket } from "socket.io-client";

class RemoteDesktopIntegrationTest {
  private logger: Logger;
  private captureService: any;
  private inputService: any;
  private streamManager: StreamManager;
  private videoProcessor: VideoProcessor;
  private audioProcessor: AudioProcessor;
  private socket: Socket | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.logger = Logger.createLogger("RemoteDesktopIntegration");
    this.videoProcessor = new VideoProcessor();
    this.audioProcessor = new AudioProcessor();
    this.streamManager = new StreamManager();
  }

  /**
   * Initialize the remote desktop system
   */
  async initialize(): Promise<void> {
    this.logger.info("🚀 Initializing EKD Desk Remote System Integration Test");

    try {
      // Initialize platform services
      this.captureService = PlatformFactory.createCaptureService();
      this.inputService = PlatformFactory.createInputService();

      await this.captureService.initializeCapture();
      await this.inputService.initializeInput();

      // Get platform capabilities
      const capabilities = await this.captureService.getCapabilities();
      this.logger.info("Platform capabilities:", capabilities);

      // Initialize media processing
      await this.streamManager.startStream();

      this.logger.info("✅ Remote desktop system initialized successfully");
    } catch (error) {
      this.logger.error("❌ Failed to initialize remote desktop system", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Connect to signaling server
   */
  async connectToSignalingServer(
    serverUrl: string = "http://localhost:3002"
  ): Promise<void> {
    this.logger.info("🔗 Connecting to signaling server", { serverUrl });

    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl);

      this.socket.on("connect", () => {
        this.logger.info("✅ Connected to signaling server");
        resolve();
      });

      this.socket.on("disconnect", () => {
        this.logger.warn("⚠️ Disconnected from signaling server");
      });

      this.socket.on("connect_error", (error) => {
        this.logger.error("❌ Failed to connect to signaling server", {
          error: error.message,
        });
        reject(error);
      });

      // Set up signaling event handlers
      this.setupSignalingHandlers();

      // Connection timeout
      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 5000);
    });
  }

  /**
   * Start the remote desktop session
   */
  async startRemoteSession(): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error("Not connected to signaling server");
    }

    this.logger.info("🎬 Starting remote desktop session");
    this.isRunning = true;

    try {
      // Start screen capture and streaming
      await this.captureService.startCapture({
        width: 1920,
        height: 1080,
        quality: 85,
        cursor: true,
      });

      // Start the main capture loop
      this.startCaptureLoop();

      this.logger.info("✅ Remote desktop session started");
    } catch (error) {
      this.logger.error("❌ Failed to start remote session", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the remote desktop session
   */
  async stopRemoteSession(): Promise<void> {
    this.logger.info("🛑 Stopping remote desktop session");

    this.isRunning = false;

    try {
      await this.captureService.stopCapture();
      await this.streamManager.stopStream();

      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.logger.info("✅ Remote desktop session stopped");
    } catch (error) {
      this.logger.error("❌ Error stopping remote session", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Demonstrate full pipeline: capture -> encode -> transmit
   */
  private async startCaptureLoop(): Promise<void> {
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let frameCount = 0;
    const startTime = Date.now();

    const captureFrame = async () => {
      if (!this.isRunning) return;

      try {
        // Capture screen frame
        const captureStart = performance.now();
        const frameData = await this.captureService.captureFrame();
        const captureTime = performance.now() - captureStart;

        // Process video frame
        const processStart = performance.now();
        const processedFrame =
          await this.streamManager.processVideoFrame(frameData);
        const processTime = performance.now() - processStart;

        // Simulate network transmission
        if (this.socket?.connected) {
          this.socket.emit("video-frame", {
            data: processedFrame.data.toString("base64"),
            width: frameData.width,
            height: frameData.height,
            timestamp: frameData.timestamp,
            isKeyframe: processedFrame.isKeyframe,
          });
        }

        frameCount++;

        // Log performance metrics every 5 seconds
        if (frameCount % (targetFPS * 5) === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const actualFPS = frameCount / elapsed;
          const streamMetrics = this.streamManager.getPerformanceMetrics();
          const captureMetrics = this.captureService.getPerformanceMetrics();

          this.logger.info("📊 Performance Metrics", {
            frameCount,
            actualFPS: actualFPS.toFixed(2),
            captureLatency: captureTime.toFixed(2) + "ms",
            processLatency: processTime.toFixed(2) + "ms",
            streamMetrics,
            captureMetrics,
          });
        }

        // Schedule next frame
        setTimeout(captureFrame, frameInterval);
      } catch (error) {
        this.logger.error("❌ Frame capture/processing failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        setTimeout(captureFrame, frameInterval * 2); // Retry with longer delay
      }
    };

    // Start audio capture loop
    this.startAudioLoop();

    // Start the first frame capture
    captureFrame();
  }

  /**
   * Audio capture and processing loop
   */
  private async startAudioLoop(): Promise<void> {
    const audioInterval = 20; // 20ms audio chunks (50 FPS)

    const captureAudio = async () => {
      if (!this.isRunning) return;

      try {
        // Capture audio
        const audioData = await this.captureService.captureAudio();

        // Process audio
        const processedAudio =
          await this.streamManager.processAudioData(audioData);

        // Simulate network transmission
        if (this.socket?.connected) {
          this.socket.emit("audio-data", {
            data: processedAudio.data.toString("base64"),
            sampleRate: audioData.sampleRate,
            channels: audioData.channels,
            timestamp: audioData.timestamp,
          });
        }

        setTimeout(captureAudio, audioInterval);
      } catch (error) {
        this.logger.warn("⚠️ Audio capture failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        setTimeout(captureAudio, audioInterval * 2);
      }
    };

    captureAudio();
  }

  /**
   * Set up signaling server event handlers
   */
  private setupSignalingHandlers(): void {
    if (!this.socket) return;

    // Handle remote input events
    this.socket.on("remote-mouse", async (event) => {
      try {
        await this.inputService.injectMouseEvent(event);
        this.logger.debug("🖱️ Remote mouse event processed", event);
      } catch (error) {
        this.logger.error("❌ Failed to process remote mouse event", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.socket.on("remote-keyboard", async (event) => {
      try {
        await this.inputService.injectKeyboardEvent(event);
        this.logger.debug("⌨️ Remote keyboard event processed", event);
      } catch (error) {
        this.logger.error("❌ Failed to process remote keyboard event", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Handle WebRTC signaling
    this.socket.on("webrtc-offer", (offer) => {
      this.logger.info("📡 Received WebRTC offer", { offer });
      // TODO: Handle WebRTC offer for peer-to-peer connection
    });

    this.socket.on("webrtc-answer", (answer) => {
      this.logger.info("📡 Received WebRTC answer", { answer });
      // TODO: Handle WebRTC answer
    });

    this.socket.on("webrtc-ice-candidate", (candidate) => {
      this.logger.debug("🧊 Received ICE candidate", { candidate });
      // TODO: Handle ICE candidate
    });

    // Quality adaptation
    this.socket.on("network-conditions", async (conditions) => {
      try {
        await this.streamManager.adaptQuality(conditions);
        this.logger.debug(
          "📊 Adapted stream quality for network conditions",
          conditions
        );
      } catch (error) {
        this.logger.error("❌ Failed to adapt stream quality", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Demonstrate the system capabilities
   */
  async demonstrateCapabilities(): Promise<void> {
    this.logger.info("🎯 Demonstrating EKD Desk capabilities");

    try {
      // Start capture service for testing
      await this.captureService.startCapture({
        width: 1920,
        height: 1080,
        quality: 85,
      });

      // Test screen capture
      this.logger.info("📸 Testing screen capture...");
      const frame = await this.captureService.captureFrame();
      this.logger.info("✅ Screen capture successful", {
        width: frame.width,
        height: frame.height,
        dataSize: frame.data.length,
      });

      // Test audio capture
      this.logger.info("🎵 Testing audio capture...");
      const audio = await this.captureService.captureAudio();
      this.logger.info("✅ Audio capture successful", {
        sampleRate: audio.sampleRate,
        channels: audio.channels,
        dataSize: audio.data.length,
      });

      // Test video processing
      this.logger.info("🎬 Testing video processing...");
      const encodedFrame = await this.videoProcessor.encodeFrame(frame, {
        codec: "H264",
        bitrate: 2000000,
        framerate: 30,
        quality: 85,
        keyframeInterval: 30,
      });
      this.logger.info("✅ Video encoding successful", {
        originalSize: frame.data.length,
        encodedSize: encodedFrame.data.length,
        compressionRatio: encodedFrame.compressionRatio,
      });

      // Test audio processing
      this.logger.info("🎵 Testing audio processing...");
      const processedAudio = await this.audioProcessor.encodeAudio(audio, {
        codec: "OPUS",
        bitrate: 128000,
        sampleRate: 48000,
        channels: 2,
      });
      this.logger.info("✅ Audio encoding successful", {
        originalSize: audio.data.length,
        encodedSize: processedAudio.data.length,
      });

      // Test input injection
      this.logger.info("🖱️ Testing input injection...");
      await this.inputService.injectMouseEvent({
        x: 100,
        y: 100,
        action: "move",
      });
      await this.inputService.injectKeyboardEvent({
        key: "a",
        code: "KeyA",
        action: "keydown",
      });
      this.logger.info("✅ Input injection successful");

      // Stop capture service
      await this.captureService.stopCapture();

      this.logger.info("🎉 All capabilities demonstrated successfully!");
    } catch (error) {
      this.logger.error("❌ Capability demonstration failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      connected: this.socket?.connected || false,
      streamStatus: this.streamManager.getStreamStatus(),
      platformInfo: PlatformFactory.getPlatformInfo(),
      inputLatency: this.inputService.getInputLatency(),
      captureMetrics: this.captureService.getPerformanceMetrics(),
    };
  }
}

// Export for use in tests or as a demo
export { RemoteDesktopIntegrationTest };

// CLI demo runner
if (require.main === module) {
  async function runDemo() {
    const demo = new RemoteDesktopIntegrationTest();

    try {
      console.log("🚀 Starting EKD Desk Remote Desktop Integration Demo");

      // Initialize system
      await demo.initialize();

      // Demonstrate capabilities
      await demo.demonstrateCapabilities();

      // Try to connect to signaling server (if running)
      try {
        await demo.connectToSignalingServer();

        // Start remote session for 30 seconds
        await demo.startRemoteSession();

        console.log("🎬 Running remote session for 30 seconds...");
        setTimeout(async () => {
          await demo.stopRemoteSession();

          const status = demo.getSystemStatus();
          console.log(
            "📊 Final System Status:",
            JSON.stringify(status, null, 2)
          );

          console.log("✅ Demo completed successfully!");
          process.exit(0);
        }, 30000);
      } catch (signalingError) {
        console.log("⚠️ Signaling server not available, running offline demo");
        console.log("💡 To test with signaling: npm run start:signaling");

        await demo.stopRemoteSession();
        console.log("✅ Offline demo completed!");
        process.exit(0);
      }
    } catch (error) {
      console.error("❌ Demo failed:", error);
      process.exit(1);
    }
  }

  runDemo();
}
