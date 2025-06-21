import { Logger } from "@ekd-desk/shared";
import {
  IInputService,
  InputEvent,
  MouseEvent,
  KeyboardEvent,
  TouchEvent,
  DeviceCapabilities,
} from "./types";
import * as os from "os";

/**
 * Input service for EKD Desk
 * Handles cross-platform input injection and event processing
 */
export class InputService implements IInputService {
  private logger: Logger;
  private inputEnabled: boolean = true;
  private inputQueue: InputEvent[] = [];
  private isProcessingQueue: boolean = false;
  private maxQueueSize: number = 1000;
  private inputLatency: number = 0;

  constructor() {
    this.logger = Logger.createLogger("InputService");
  }

  /**
   * Initialize input system
   */
  async initializeInput(): Promise<void> {
    this.logger.info("Initializing input service");

    try {
      // Initialize platform-specific input systems
      await this.initializePlatformInput();

      // Start input processing queue
      this.startInputProcessing();

      this.logger.info("Input service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize input service", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Inject mouse event
   */
  async injectMouseEvent(event: MouseEvent): Promise<void> {
    if (!this.inputEnabled) {
      this.logger.debug("Input disabled, ignoring mouse event");
      return;
    }

    const startTime = performance.now();

    try {
      this.logger.debug("Injecting mouse event", {
        action: event.action,
        x: event.x,
        y: event.y,
        button: event.button,
      });

      await this.platformInjectMouse(event);

      this.inputLatency = performance.now() - startTime;
      this.logger.debug("Mouse event injected successfully", {
        latency: this.inputLatency,
      });
    } catch (error) {
      this.logger.error("Mouse event injection failed", {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
      throw error;
    }
  }

  /**
   * Inject keyboard event
   */
  async injectKeyboardEvent(event: KeyboardEvent): Promise<void> {
    if (!this.inputEnabled) {
      this.logger.debug("Input disabled, ignoring keyboard event");
      return;
    }

    const startTime = performance.now();

    try {
      this.logger.debug("Injecting keyboard event", {
        action: event.action,
        key: event.key,
        code: event.code,
        modifiers: event.modifiers,
      });

      await this.platformInjectKeyboard(event);

      this.inputLatency = performance.now() - startTime;
      this.logger.debug("Keyboard event injected successfully", {
        latency: this.inputLatency,
      });
    } catch (error) {
      this.logger.error("Keyboard event injection failed", {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
      throw error;
    }
  }

  /**
   * Inject touch event
   */
  async injectTouchEvent(event: TouchEvent): Promise<void> {
    if (!this.inputEnabled) {
      this.logger.debug("Input disabled, ignoring touch event");
      return;
    }

    const capabilities = await this.getInputCapabilities();
    if (!capabilities.touch) {
      this.logger.warn("Touch input not supported on this platform");
      return;
    }

    const startTime = performance.now();

    try {
      this.logger.debug("Injecting touch event", {
        action: event.action,
        id: event.id,
        x: event.x,
        y: event.y,
      });

      await this.platformInjectTouch(event);

      this.inputLatency = performance.now() - startTime;
      this.logger.debug("Touch event injected successfully", {
        latency: this.inputLatency,
      });
    } catch (error) {
      this.logger.error("Touch event injection failed", {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
      throw error;
    }
  }

  /**
   * Enable or disable input injection
   */
  async setInputEnabled(enabled: boolean): Promise<void> {
    this.inputEnabled = enabled;
    this.logger.info("Input injection toggled", { enabled });

    if (!enabled) {
      // Clear input queue when disabled
      this.inputQueue = [];
    }
  }

  /**
   * Get input capabilities for this platform
   */
  async getInputCapabilities(): Promise<DeviceCapabilities["input"]> {
    const platform = this.getPlatform();

    return {
      mouse: true,
      keyboard: true,
      touch: platform === "windows", // Windows has better touch support
      injection: {
        mouse: await this.supportsMouseInjection(),
        keyboard: await this.supportsKeyboardInjection(),
        touch: platform === "windows" && (await this.supportsTouchInjection()),
      },
    };
  }

  /**
   * Queue input event for processing
   */
  queueInputEvent(event: InputEvent): void {
    if (this.inputQueue.length >= this.maxQueueSize) {
      this.logger.warn("Input queue full, dropping oldest event");
      this.inputQueue.shift();
    }

    this.inputQueue.push(event);
  }

  /**
   * Process input event immediately
   */
  async processInputEvent(event: InputEvent): Promise<void> {
    try {
      switch (event.type) {
        case "mouse":
          await this.injectMouseEvent(event.data as MouseEvent);
          break;
        case "keyboard":
          await this.injectKeyboardEvent(event.data as KeyboardEvent);
          break;
        case "touch":
          await this.injectTouchEvent(event.data as TouchEvent);
          break;
        default:
          this.logger.warn("Unknown input event type", { type: event.type });
      }
    } catch (error) {
      this.logger.error("Input event processing failed", {
        error: error instanceof Error ? error.message : String(error),
        event,
      });
      throw error;
    }
  }

  /**
   * Get input latency metrics
   */
  getInputLatency(): number {
    return this.inputLatency;
  }

  /**
   * Get input queue status
   */
  getQueueStatus(): { size: number; maxSize: number; isProcessing: boolean } {
    return {
      size: this.inputQueue.length,
      maxSize: this.maxQueueSize,
      isProcessing: this.isProcessingQueue,
    };
  }

  // Platform-specific implementations (to be overridden in platform-specific subclasses)

  protected async initializePlatformInput(): Promise<void> {
    this.logger.debug("Initializing platform-specific input systems");
    // Platform-specific initialization would go here
  }

  protected async platformInjectMouse(event: MouseEvent): Promise<void> {
    this.logger.debug("Platform mouse injection", event);

    // Simulate mouse injection delay
    await new Promise((resolve) => setTimeout(resolve, 1));

    // In real implementation, would use platform-specific APIs:
    // - Windows: SendInput, SetCursorPos
    // - macOS: CGEventCreateMouseEvent, CGEventPost
    // - Linux: XTest extension, evdev
  }

  protected async platformInjectKeyboard(event: KeyboardEvent): Promise<void> {
    this.logger.debug("Platform keyboard injection", event);

    // Simulate keyboard injection delay
    await new Promise((resolve) => setTimeout(resolve, 1));

    // In real implementation, would use platform-specific APIs:
    // - Windows: SendInput, VirtualKey codes
    // - macOS: CGEventCreateKeyboardEvent, CGEventPost
    // - Linux: XTest extension, evdev
  }

  protected async platformInjectTouch(event: TouchEvent): Promise<void> {
    this.logger.debug("Platform touch injection", event);

    // Simulate touch injection delay
    await new Promise((resolve) => setTimeout(resolve, 1));

    // In real implementation, would use platform-specific APIs:
    // - Windows: Touch Injection API
    // - Linux: evdev multi-touch protocol
    // - macOS: Limited touch support via accessibility APIs
  }

  protected async supportsMouseInjection(): Promise<boolean> {
    // All platforms support mouse injection
    return true;
  }

  protected async supportsKeyboardInjection(): Promise<boolean> {
    // All platforms support keyboard injection
    return true;
  }

  protected async supportsTouchInjection(): Promise<boolean> {
    // Platform-specific touch injection support
    const platform = this.getPlatform();
    return platform === "windows"; // Windows has the best touch injection APIs
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

  // Private helper methods

  private startInputProcessing(): void {
    this.isProcessingQueue = true;
    this.processInputQueue();
  }

  private async processInputQueue(): Promise<void> {
    while (this.isProcessingQueue) {
      if (this.inputQueue.length > 0 && this.inputEnabled) {
        const event = this.inputQueue.shift();
        if (event) {
          try {
            await this.processInputEvent(event);
          } catch (error) {
            this.logger.error("Error processing queued input event", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Small delay to prevent busy waiting
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }

  /**
   * Stop input processing (cleanup)
   */
  stopInputProcessing(): void {
    this.isProcessingQueue = false;
    this.inputQueue = [];
    this.logger.info("Input processing stopped");
  }
}
