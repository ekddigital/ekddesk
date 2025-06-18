// Platform-specific types for EKD Desk

export interface CaptureOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  quality?: number;
  monitor?: number;
}

export interface InputEvent {
  type: "mouse" | "keyboard";
  data: MouseEvent | KeyboardEvent;
  timestamp: number;
}

export interface MouseEvent {
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
  action: "move" | "click" | "scroll";
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEvent {
  key: string;
  action: "keydown" | "keyup";
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

export interface DeviceCapabilities {
  screen: {
    capture: boolean;
    multiMonitor: boolean;
    maxResolution: { width: number; height: number };
  };
  audio: {
    capture: boolean;
    playback: boolean;
    devices: string[];
  };
  input: {
    mouse: boolean;
    keyboard: boolean;
    touch?: boolean;
  };
}

export interface ICaptureService {
  initializeCapture(): Promise<void>;
  captureScreen(options: CaptureOptions): Promise<FrameData>;
  captureAudio(deviceId: string): Promise<AudioData>;
  injectInput(input: InputEvent): Promise<void>;
  getCapabilities(): Promise<DeviceCapabilities>;
}

export interface FrameData {
  data: Buffer;
  width: number;
  height: number;
  format: string;
  timestamp: number;
}

export interface AudioData {
  data: Buffer;
  sampleRate: number;
  channels: number;
  format: string;
  timestamp: number;
}
