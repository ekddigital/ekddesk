// Media processing types for EKD Desk

export interface FrameData {
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

export interface AudioData {
  data: Buffer;
  sampleRate: number;
  channels: number;
  format: "PCM16" | "PCM24" | "FLOAT32";
  timestamp: number;
  sequenceNumber?: number;
  duration?: number;
}

export interface EncodingSettings {
  codec: "H264" | "VP8" | "VP9" | "AV1";
  bitrate: number;
  framerate: number;
  quality: number; // 1-100
  keyframeInterval: number;
  preset?:
    | "ultrafast"
    | "superfast"
    | "veryfast"
    | "faster"
    | "fast"
    | "medium"
    | "slow"
    | "slower"
    | "veryslow";
  profile?: string;
  level?: string;
  hardwareAcceleration?: boolean;
}

export interface AudioSettings {
  codec: "OPUS" | "AAC" | "MP3";
  bitrate: number;
  sampleRate: number;
  channels: number;
  complexity?: number; // For Opus
  vbr?: boolean; // Variable bitrate
}

export interface ProcessedAudio {
  data: Buffer;
  settings: AudioSettings;
  timestamp: number;
  isKeyframe?: boolean;
}

export interface EncodedFrame {
  data: Buffer;
  settings: EncodingSettings;
  timestamp: number;
  isKeyframe: boolean;
  pts?: number; // Presentation timestamp
  dts?: number; // Decode timestamp
  size?: number;
  compressionRatio?: number;
}

export interface MotionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  changed?: boolean;
}

export interface MotionData {
  regions: MotionRegion[];
  totalMotion: number;
  threshold: number;
  algorithm: "block-based" | "pixel-diff" | "optical-flow";
}

export interface NetworkConditions {
  bandwidth: number; // bits per second
  latency: number; // milliseconds
  packetLoss: number; // 0-1 ratio
  jitter: number; // milliseconds
  rtt: number; // round trip time in milliseconds
}

export interface SyncedMedia {
  audio: AudioData;
  video: FrameData;
  syncOffset: number;
  timestamp: number;
}

export interface StreamQuality {
  bitrate: number;
  framerate: number;
  resolution: { width: number; height: number };
  packetLoss: number;
  latency: number;
  jitter: number;
}

export interface AdaptiveSettings {
  targetBitrate: number;
  maxBitrate: number;
  minBitrate: number;
  targetFramerate: number;
  qualityLevel: "low" | "medium" | "high" | "ultra";
  adaptiveMode: "bandwidth" | "cpu" | "mixed";
}

export interface MediaStreamConfig {
  video: {
    enabled: boolean;
    settings: EncodingSettings;
    adaptive: AdaptiveSettings;
  };
  audio: {
    enabled: boolean;
    settings: AudioSettings;
    echoCancellation: boolean;
    noiseReduction: boolean;
  };
  synchronization: {
    enabled: boolean;
    tolerance: number; // milliseconds
    correction: boolean;
  };
}

export interface EncodingPerformance {
  encodeTime: number;
  decodeTime: number;
  cpuUsage: number;
  memoryUsage: number;
  fps: number;
  droppedFrames: number;
}
