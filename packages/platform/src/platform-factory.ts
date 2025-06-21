import { Logger } from "@ekd-desk/shared";
import { CaptureService, CrossPlatformCaptureService } from "./capture-service";
import { InputService } from "./input-service";
import {
  ICaptureService,
  IInputService,
  DeviceCapabilities,
  CaptureOptions,
  DisplayInfo,
} from "./types";
import * as os from "os";

/**
 * Factory for creating platform-specific services
 */
export class PlatformFactory {
  private static logger = Logger.createLogger("PlatformFactory");

  /**
   * Create capture service for current platform
   */
  static createCaptureService(): ICaptureService {
    const platform = os.platform();

    this.logger.info("Creating capture service for platform", { platform });

    switch (platform) {
      case "win32":
        return new WindowsCaptureService();
      case "darwin":
        return new MacOSCaptureService();
      case "linux":
        return new LinuxCaptureService();
      default:
        this.logger.warn("Unsupported platform, using cross-platform service", {
          platform,
        });
        return new CrossPlatformCaptureService();
    }
  }

  /**
   * Create input service for current platform
   */
  static createInputService(): IInputService {
    return new InputService();
  }

  /**
   * Get platform information
   */
  static getPlatformInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      version: os.release(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    };
  }
}

// Platform-specific implementations
class WindowsCaptureService extends CrossPlatformCaptureService {
  constructor() {
    super();
    this.logger = Logger.createLogger("WindowsCapture");
  }

  async initializeCapture(): Promise<void> {
    this.logger.info("Initializing Windows capture service");
    await super.initializeCapture();

    // Windows-specific initialization
    // TODO: Initialize Windows Desktop Duplication API, WASAPI for audio
  }

  protected async getNativeDisplays(): Promise<DisplayInfo[]> {
    this.logger.debug("Getting Windows display information");

    // TODO: Use Windows APIs to get actual display info
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

  protected async supportsCursorCapture(): Promise<boolean> {
    return true; // Windows Desktop Duplication API supports cursor capture
  }

  protected async getGPUInfo(): Promise<string | undefined> {
    // TODO: Query Windows WMI for GPU information
    return "Windows GPU";
  }

  protected async supportsHardwareAcceleration(): Promise<boolean> {
    return true; // Windows generally has good hardware acceleration support
  }
}

class MacOSCaptureService extends CrossPlatformCaptureService {
  constructor() {
    super();
    this.logger = Logger.createLogger("MacOSCapture");
  }

  async initializeCapture(): Promise<void> {
    this.logger.info("Initializing macOS capture service");
    await super.initializeCapture();

    // macOS-specific initialization
    // TODO: Initialize CGDisplayStream, AVAudioEngine for audio
    // Note: macOS requires screen recording permissions
  }

  protected async getNativeDisplays(): Promise<DisplayInfo[]> {
    this.logger.debug("Getting macOS display information");

    // TODO: Use CoreGraphics APIs to get actual display info
    // For now, return mock data
    return [
      {
        id: 0,
        name: "Built-in Retina Display",
        primary: true,
        x: 0,
        y: 0,
        width: 2560,
        height: 1600,
        scaleFactor: 2.0,
      },
    ];
  }

  protected async supportsCursorCapture(): Promise<boolean> {
    return true; // macOS CGDisplayStream supports cursor capture
  }

  protected async getGPUInfo(): Promise<string | undefined> {
    // TODO: Query macOS system_profiler for GPU information
    return "Apple GPU";
  }

  protected async supportsHardwareAcceleration(): Promise<boolean> {
    return true; // macOS has good hardware acceleration, especially on Apple Silicon
  }
}

class LinuxCaptureService extends CrossPlatformCaptureService {
  constructor() {
    super();
    this.logger = Logger.createLogger("LinuxCapture");
  }

  async initializeCapture(): Promise<void> {
    this.logger.info("Initializing Linux capture service");
    await super.initializeCapture();

    // Linux-specific initialization
    // TODO: Initialize X11/Wayland capture, PulseAudio/ALSA for audio
  }

  protected async getNativeDisplays(): Promise<DisplayInfo[]> {
    this.logger.debug("Getting Linux display information");

    // TODO: Use X11/Wayland APIs to get actual display info
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

  protected async supportsCursorCapture(): Promise<boolean> {
    return true; // X11 and some Wayland compositors support cursor capture
  }

  protected async getGPUInfo(): Promise<string | undefined> {
    // TODO: Query Linux /proc or lspci for GPU information
    return "Linux GPU";
  }

  protected async supportsHardwareAcceleration(): Promise<boolean> {
    return true; // Linux supports hardware acceleration via VA-API, NVENC, etc.
  }
}
