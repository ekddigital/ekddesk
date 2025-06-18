import { Logger } from "@ekd-desk/shared";
import {
  ICaptureService,
  CaptureOptions,
  FrameData,
  AudioData,
  InputEvent,
  DeviceCapabilities,
} from "./types";

/**
 * Base capture service interface implementation
 */
export abstract class CaptureService implements ICaptureService {
  protected logger: Logger;

  constructor(context: string) {
    this.logger = Logger.createLogger(context);
  }

  abstract initializeCapture(): Promise<void>;
  abstract captureScreen(options: CaptureOptions): Promise<FrameData>;
  abstract captureAudio(deviceId: string): Promise<AudioData>;
  abstract injectInput(input: InputEvent): Promise<void>;
  abstract getCapabilities(): Promise<DeviceCapabilities>;
}
