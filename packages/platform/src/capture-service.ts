import { Logger } from "@ekd-desk/shared";
import {
  ICaptureService,
  CaptureOptions,
  DisplayInfo,
  DeviceCapabilities,
  AudioDevice,
  CapturePerformance,
} from "./types";
import * as os from "os";

// Local interfaces to avoid import issues during development
interface LocalFrameData {
  data: Buffer;
  width: number;
  height: number;
  format: "RGBA" | "RGB" | "YUV420" | "NV12";
  timestamp: number;
  sequenceNumber?: number;
  metadata?: {
    captureSource?: string;
    displayId?: number;
    region?: { x: number; y: number; width: number; height: number };
  };
}

interface LocalAudioData {
  data: Buffer;
  sampleRate: number;
  channels: number;
  format: "PCM16" | "PCM24" | "FLOAT32";
  timestamp: number;
  sequenceNumber?: number;
  duration?: number;
}

/**
 * Base capture service with cross-platform screen and audio capture
 */
export abstract class CaptureService implements ICaptureService {
  protected logger: Logger;
  protected capturing: boolean = false;
  protected activeDisplay: number = 0;
  protected captureStartTime: number = 0;
  protected frameCount: number = 0;
  protected droppedFrames: number = 0;
  protected lastFrameTime: number = 0;
  protected captureInterval?: NodeJS.Timeout;

  constructor(context: string) {
    this.logger = Logger.createLogger(context);
  }

  /**
   * Initialize capture system
   */
  abstract initializeCapture(): Promise<void>;

  /**
   * Start continuous capture
   */
  async startCapture(options: CaptureOptions): Promise<void> {
    if (this.capturing) {
      this.logger.warn("Capture is already running");
      return;
    }

    this.logger.info("Starting screen capture", options);

    try {
      await this.initializeCapture();
      this.capturing = true;
      this.captureStartTime = Date.now();
      this.frameCount = 0;
      this.droppedFrames = 0;

      this.logger.info("Screen capture started successfully");
    } catch (error) {
      this.logger.error("Failed to start capture", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop capture
   */
  async stopCapture(): Promise<void> {
    if (!this.capturing) {
      this.logger.warn("Capture is not running");
      return;
    }

    this.logger.info("Stopping screen capture");

    try {
      this.capturing = false;

      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.captureInterval = undefined;
      }

      const duration = Date.now() - this.captureStartTime;
      const avgFps = this.frameCount / (duration / 1000);

      this.logger.info("Screen capture stopped", {
        duration,
        frameCount: this.frameCount,
        droppedFrames: this.droppedFrames,
        averageFps: avgFps,
      });
    } catch (error) {
      this.logger.error("Error while stopping capture", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Capture a single frame
   */
  abstract captureFrame(options?: CaptureOptions): Promise<LocalFrameData>;

  /**
   * Capture audio data
   */
  abstract captureAudio(deviceId?: string): Promise<LocalAudioData>;

  /**
   * Get system capabilities
   */
  async getCapabilities(): Promise<DeviceCapabilities> {
    const displays = await this.getDisplays();
    const audioDevices = await this.getAudioDevices();

    return {
      platform: this.getPlatform(),
      screen: {
        capture: true,
        multiMonitor: displays.length > 1,
        maxResolution: this.getMaxResolution(displays),
        displays,
        cursorCapture: await this.supportsCursorCapture(),
      },
      audio: {
        capture: true,
        playback: true,
        devices: audioDevices,
        echoCancellation: await this.supportsEchoCancellation(),
        noiseReduction: await this.supportsNoiseReduction(),
      },
      input: {
        mouse: true,
        keyboard: true,
        touch: await this.supportsTouchInput(),
        injection: {
          mouse: true,
          keyboard: true,
          touch: await this.supportsTouchInput(),
        },
      },
      performance: {
        cpuCores: os.cpus().length,
        memoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
        gpu: await this.getGPUInfo(),
        hardwareAcceleration: await this.supportsHardwareAcceleration(),
      },
    };
  }

  /**
   * Get available displays
   */
  abstract getDisplays(): Promise<DisplayInfo[]>;

  /**
   * Set active display for capture
   */
  async setActiveDisplay(displayId: number): Promise<void> {
    const displays = await this.getDisplays();
    const display = displays.find((d) => d.id === displayId);

    if (!display) {
      throw new Error(`Display with ID ${displayId} not found`);
    }

    this.activeDisplay = displayId;
    this.logger.debug("Active display changed", {
      displayId,
      display: display.name,
    });
  }

  /**
   * Check if capture is running
   */
  isCapturing(): boolean {
    return this.capturing;
  }

  /**
   * Get capture performance metrics
   */
  getPerformanceMetrics(): CapturePerformance {
    const now = Date.now();
    const duration = this.capturing ? now - this.captureStartTime : 0;
    const fps = duration > 0 ? this.frameCount / (duration / 1000) : 0;

    return {
      fps,
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      captureLatency: now - this.lastFrameTime,
      lastFrameTime: this.lastFrameTime,
      droppedFrames: this.droppedFrames,
    };
  }

  // Protected helper methods for subclasses

  protected updateFrameStats(): void {
    this.frameCount++;
    this.lastFrameTime = Date.now();
  }

  protected recordDroppedFrame(): void {
    this.droppedFrames++;
  }

  protected async getAudioDevices(): Promise<AudioDevice[]> {
    // Platform-specific implementation in subclasses
    return [
      {
        id: "default",
        name: "Default Audio Device",
        type: "input",
        default: true,
        channels: 2,
        sampleRate: 48000,
      },
    ];
  }

  protected getPlatform(): "windows" | "macos" | "linux" {
    const platform = os.platform();
    switch (platform) {
      case "win32":
        return "windows";
      case "darwin":
        return "macos";
      case "linux":
        return "linux";
      default:
        return "linux";
    }
  }

  protected getMaxResolution(displays: DisplayInfo[]): {
    width: number;
    height: number;
  } {
    return displays.reduce(
      (max, display) => ({
        width: Math.max(max.width, display.width),
        height: Math.max(max.height, display.height),
      }),
      { width: 1920, height: 1080 }
    );
  }

  protected async supportsCursorCapture(): Promise<boolean> {
    // Platform-specific implementation
    return true;
  }

  protected async supportsEchoCancellation(): Promise<boolean> {
    // Platform-specific implementation
    return true;
  }

  protected async supportsNoiseReduction(): Promise<boolean> {
    // Platform-specific implementation
    return true;
  }

  protected async supportsTouchInput(): Promise<boolean> {
    // Platform-specific implementation
    const platform = this.getPlatform();
    return platform === "windows"; // Windows has better touch support
  }

  protected async getGPUInfo(): Promise<string | undefined> {
    // Platform-specific implementation
    return "Integrated Graphics";
  }

  protected async supportsHardwareAcceleration(): Promise<boolean> {
    // Platform-specific implementation
    return true;
  }

  protected getCPUUsage(): number {
    // Simplified CPU usage calculation
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    return Math.min(100, (loadAvg / cpuCount) * 100);
  }

  protected getMemoryUsage(): number {
    const used = os.totalmem() - os.freemem();
    return (used / os.totalmem()) * 100;
  }

  protected createMockFrameData(width: number, height: number): LocalFrameData {
    // Create mock frame data for testing/fallback
    const pixelCount = width * height * 4; // RGBA
    const buffer = Buffer.alloc(pixelCount);

    // Fill with a simple pattern
    for (let i = 0; i < pixelCount; i += 4) {
      buffer[i] = 64; // R
      buffer[i + 1] = 128; // G
      buffer[i + 2] = 192; // B
      buffer[i + 3] = 255; // A
    }

    return {
      data: buffer,
      width,
      height,
      format: "RGBA" as const,
      timestamp: Date.now(),
      sequenceNumber: this.frameCount,
      metadata: {
        captureSource: "mock",
        displayId: this.activeDisplay,
      },
    };
  }

  protected createMockAudioData(duration: number = 100): LocalAudioData {
    // Create mock audio data for testing/fallback
    const sampleRate = 48000;
    const channels = 2;
    const sampleCount = Math.floor((duration / 1000) * sampleRate);
    const buffer = Buffer.alloc(sampleCount * channels * 4); // Float32

    // Fill with silence
    buffer.fill(0);

    return {
      data: buffer,
      sampleRate,
      channels,
      format: "FLOAT32",
      timestamp: Date.now(),
      duration,
    };
  }
}

/**
 * Cross-platform capture service implementation
 * Uses native APIs when available, falls back to mock data for development
 */
export class CrossPlatformCaptureService extends CaptureService {
  constructor() {
    super("CrossPlatformCaptureService");
  }

  async initializeCapture(): Promise<void> {
    this.logger.info("Initializing cross-platform capture service");

    try {
      // Initialize platform-specific capture systems
      await this.initializePlatformCapture();

      this.logger.info("Cross-platform capture service initialized");
    } catch (error) {
      this.logger.error("Failed to initialize capture service", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async captureFrame(options: CaptureOptions = {}): Promise<LocalFrameData> {
    if (!this.capturing) {
      throw new Error("Capture service is not running");
    }

    try {
      // Use native capture when available, fallback to mock
      const frame = await this.nativeCaptureFrame(options);
      this.updateFrameStats();

      this.logger.debug("Frame captured", {
        width: frame.width,
        height: frame.height,
        size: frame.data.length,
        timestamp: frame.timestamp,
      });

      return frame;
    } catch (error) {
      this.recordDroppedFrame();
      this.logger.error("Frame capture failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return mock data to keep stream alive
      return this.createMockFrameData(
        options.width || 1920,
        options.height || 1080
      );
    }
  }

  async captureAudio(deviceId?: string): Promise<LocalAudioData> {
    try {
      // Use native audio capture when available, fallback to mock
      const audio = await this.nativeCaptureAudio(deviceId);

      this.logger.debug("Audio captured", {
        sampleRate: audio.sampleRate,
        channels: audio.channels,
        size: audio.data.length,
        timestamp: audio.timestamp,
      });

      return audio;
    } catch (error) {
      this.logger.error("Audio capture failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return mock data to keep stream alive
      return this.createMockAudioData();
    }
  }

  async getDisplays(): Promise<DisplayInfo[]> {
    try {
      // Get actual display information when available
      return await this.getNativeDisplays();
    } catch (error) {
      this.logger.warn("Failed to get native display info, using fallback", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback display info
      return [
        {
          id: 0,
          name: "Primary Display",
          primary: true,
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          scaleFactor: 1.0,
        },
      ];
    }
  }

  // Platform-specific implementations (to be overridden in platform-specific subclasses)

  protected async initializePlatformCapture(): Promise<void> {
    // Platform-specific initialization
    this.logger.debug("Initializing platform-specific capture");
  }

  protected async nativeCaptureFrame(
    options: CaptureOptions
  ): Promise<LocalFrameData> {
    // In real implementation, would use platform-specific screen capture APIs
    // For now, return mock data
    return this.createMockFrameData(
      options.width || 1920,
      options.height || 1080
    );
  }

  protected async nativeCaptureAudio(
    deviceId?: string
  ): Promise<LocalAudioData> {
    // In real implementation, would use platform-specific audio capture APIs
    // For now, return mock data
    return this.createMockAudioData();
  }

  protected async getNativeDisplays(): Promise<DisplayInfo[]> {
    // In real implementation, would query platform-specific display APIs
    // For now, return mock data
    return [
      {
        id: 0,
        name: "Primary Display",
        primary: true,
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scaleFactor: 1.0,
      },
    ];
  }
}
