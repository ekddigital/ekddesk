// Media processing types for EKD Desk

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

export interface EncodingSettings {
  codec: string;
  bitrate: number;
  framerate: number;
  quality: number;
  keyframeInterval: number;
}

export interface AudioSettings {
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
}

export interface ProcessedAudio {
  data: Buffer;
  settings: AudioSettings;
  timestamp: number;
}

export interface EncodedFrame {
  data: Buffer;
  settings: EncodingSettings;
  timestamp: number;
  isKeyframe: boolean;
}

export interface MotionData {
  regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    intensity: number;
  }>;
  totalMotion: number;
}

export interface SyncedMedia {
  audio: AudioData;
  video: FrameData;
  syncOffset: number;
}
