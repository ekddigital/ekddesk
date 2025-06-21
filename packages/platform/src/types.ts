// Platform-specific types for EKD Desk
import { FrameData, AudioData } from "@ekd-desk/media";

export interface CaptureOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  quality?: number;
  monitor?: number;
  cursor?: boolean;
  region?: CaptureRegion;
}

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

export interface DisplayInfo {
  id: number;
  name: string;
  primary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface InputEvent {
  type: "mouse" | "keyboard" | "touch";
  data: MouseEvent | KeyboardEvent | TouchEvent;
  timestamp: number;
  source?: string;
}

export interface MouseEvent {
  x: number;
  y: number;
  button?: "left" | "right" | "middle" | "x1" | "x2";
  action: "move" | "down" | "up" | "click" | "doubleclick" | "scroll";
  deltaX?: number;
  deltaY?: number;
  pressure?: number;
}

export interface KeyboardEvent {
  key: string;
  code: string;
  action: "keydown" | "keyup" | "keypress";
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    fn?: boolean;
  };
  repeat?: boolean;
}

export interface TouchEvent {
  id: number;
  x: number;
  y: number;
  action: "start" | "move" | "end" | "cancel";
  pressure?: number;
  size?: number;
}

export interface AudioDevice {
  id: string;
  name: string;
  type: "input" | "output";
  default: boolean;
  channels: number;
  sampleRate: number;
}

export interface DeviceCapabilities {
  platform: "windows" | "macos" | "linux";
  screen: {
    capture: boolean;
    multiMonitor: boolean;
    maxResolution: { width: number; height: number };
    displays: DisplayInfo[];
    cursorCapture: boolean;
  };
  audio: {
    capture: boolean;
    playback: boolean;
    devices: AudioDevice[];
    echoCancellation: boolean;
    noiseReduction: boolean;
  };
  input: {
    mouse: boolean;
    keyboard: boolean;
    touch?: boolean;
    injection: {
      mouse: boolean;
      keyboard: boolean;
      touch?: boolean;
    };
  };
  performance: {
    cpuCores: number;
    memoryGB: number;
    gpu?: string;
    hardwareAcceleration: boolean;
  };
}

export interface ICaptureService {
  initializeCapture(): Promise<void>;
  startCapture(options: CaptureOptions): Promise<void>;
  stopCapture(): Promise<void>;
  captureFrame(options?: CaptureOptions): Promise<FrameData>;
  captureAudio(deviceId?: string): Promise<AudioData>;
  getCapabilities(): Promise<DeviceCapabilities>;
  getDisplays(): Promise<DisplayInfo[]>;
  setActiveDisplay(displayId: number): Promise<void>;
  isCapturing(): boolean;
}

export interface IInputService {
  initializeInput(): Promise<void>;
  injectMouseEvent(event: MouseEvent): Promise<void>;
  injectKeyboardEvent(event: KeyboardEvent): Promise<void>;
  injectTouchEvent(event: TouchEvent): Promise<void>;
  setInputEnabled(enabled: boolean): Promise<void>;
  getInputCapabilities(): Promise<DeviceCapabilities["input"]>;
}

export interface PlatformInfo {
  os: "windows" | "macos" | "linux";
  version: string;
  arch: "x64" | "arm64" | "ia32";
  hostname: string;
  username: string;
  capabilities: DeviceCapabilities;
}

export interface CapturePerformance {
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  captureLatency: number;
  lastFrameTime: number;
  droppedFrames: number;
}
