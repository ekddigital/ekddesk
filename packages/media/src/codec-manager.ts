import { Logger } from "@ekd-desk/shared";
import {
  EncodingSettings,
  AudioSettings,
  NetworkConditions,
  EncodingPerformance,
} from "./types";

interface CodecCapability {
  codec: string;
  encoding: boolean;
  decoding: boolean;
  hardwareAcceleration: boolean;
  maxResolution: { width: number; height: number };
  maxFramerate: number;
  maxBitrate: number;
  profiles: string[];
  levels: string[];
}

interface CodecProfile {
  name: string;
  description: string;
  settings: Partial<EncodingSettings>;
  recommendedFor: string[];
  performance: "low" | "medium" | "high";
  quality: "low" | "medium" | "high" | "ultra";
}

/**
 * Codec manager for EKD Desk
 * Handles codec selection, optimization, and capability detection
 */
export class CodecManager {
  private logger: Logger;
  private videoCodecCapabilities: Map<string, CodecCapability> = new Map();
  private audioCodecCapabilities: Map<string, CodecCapability> = new Map();
  private codecProfiles: Map<string, CodecProfile> = new Map();
  private hardwareAccelerationAvailable: boolean = false;

  constructor() {
    this.logger = Logger.createLogger("CodecManager");
    this.initializeCodecCapabilities();
    this.initializeCodecProfiles();
    this.detectHardwareAcceleration();
  }

  /**
   * Get optimal video codec settings for given conditions
   */
  getOptimalVideoSettings(
    conditions: NetworkConditions,
    requirements: {
      maxBitrate?: number;
      maxFramerate?: number;
      quality?: "low" | "medium" | "high" | "ultra";
      latency?: "low" | "medium" | "high";
    }
  ): EncodingSettings {
    this.logger.debug("Determining optimal video settings", {
      conditions,
      requirements,
    });

    let codec: EncodingSettings["codec"] = "H264";
    let settings: EncodingSettings;

    // Choose codec based on conditions and capabilities
    if (conditions.bandwidth > 5000000 && this.hardwareAccelerationAvailable) {
      // High bandwidth, prefer quality
      if (this.isCodecSupported("AV1")) {
        codec = "AV1";
      } else if (this.isCodecSupported("VP9")) {
        codec = "VP9";
      }
    } else if (conditions.latency < 50 && conditions.packetLoss < 0.01) {
      // Low latency, prefer speed
      codec = "H264";
    }

    // Apply profile-based settings
    const profile = this.selectProfile(codec, requirements.quality || "medium");

    settings = {
      codec,
      bitrate: this.calculateOptimalBitrate(
        conditions,
        requirements.maxBitrate
      ),
      framerate: this.calculateOptimalFramerate(
        conditions,
        requirements.maxFramerate
      ),
      quality: this.mapQualityToValue(requirements.quality || "medium"),
      keyframeInterval: this.calculateKeyframeInterval(
        conditions,
        requirements.latency
      ),
      ...profile.settings,
    };

    // Apply hardware acceleration if available and beneficial
    if (
      this.hardwareAccelerationAvailable &&
      this.shouldUseHardwareAcceleration(settings)
    ) {
      settings.hardwareAcceleration = true;
    }

    this.logger.debug("Optimal video settings determined", settings);
    return settings;
  }

  /**
   * Get optimal audio codec settings for given conditions
   */
  getOptimalAudioSettings(
    conditions: NetworkConditions,
    requirements: {
      maxBitrate?: number;
      channels?: number;
      quality?: "low" | "medium" | "high";
    }
  ): AudioSettings {
    this.logger.debug("Determining optimal audio settings", {
      conditions,
      requirements,
    });

    let codec: AudioSettings["codec"] = "OPUS";

    // Choose codec based on conditions
    if (conditions.bandwidth < 500000) {
      codec = "OPUS"; // Best compression for low bandwidth
    } else if (conditions.latency > 100) {
      codec = "AAC"; // Good quality with reasonable latency
    }

    const settings: AudioSettings = {
      codec,
      bitrate: this.calculateOptimalAudioBitrate(
        conditions,
        requirements.maxBitrate
      ),
      sampleRate: this.calculateOptimalSampleRate(conditions),
      channels: requirements.channels || 2,
      complexity:
        codec === "OPUS" ? this.calculateOpusComplexity(conditions) : undefined,
      vbr: conditions.packetLoss < 0.02, // Use VBR for stable connections
    };

    this.logger.debug("Optimal audio settings determined", settings);
    return settings;
  }

  /**
   * Check if a codec is supported
   */
  isCodecSupported(codec: string, type: "video" | "audio" = "video"): boolean {
    const capabilities =
      type === "video"
        ? this.videoCodecCapabilities
        : this.audioCodecCapabilities;
    return capabilities.has(codec);
  }

  /**
   * Get codec capabilities
   */
  getCodecCapabilities(
    codec: string,
    type: "video" | "audio" = "video"
  ): CodecCapability | null {
    const capabilities =
      type === "video"
        ? this.videoCodecCapabilities
        : this.audioCodecCapabilities;
    return capabilities.get(codec) || null;
  }

  /**
   * Get all supported codecs
   */
  getSupportedCodecs(type: "video" | "audio" = "video"): string[] {
    const capabilities =
      type === "video"
        ? this.videoCodecCapabilities
        : this.audioCodecCapabilities;
    return Array.from(capabilities.keys());
  }

  /**
   * Get codec profiles
   */
  getCodecProfiles(codec: string): CodecProfile[] {
    return Array.from(this.codecProfiles.values()).filter(
      (profile) => profile.settings.codec === codec
    );
  }

  /**
   * Validate codec settings
   */
  validateSettings(settings: EncodingSettings): boolean {
    const capability = this.getCodecCapabilities(settings.codec);
    if (!capability) return false;

    // Check bitrate limits
    if (settings.bitrate > capability.maxBitrate) return false;

    // Check framerate limits
    if (settings.framerate > capability.maxFramerate) return false;

    // Check profile support
    if (settings.profile && !capability.profiles.includes(settings.profile))
      return false;

    // Check level support
    if (settings.level && !capability.levels.includes(settings.level))
      return false;

    return true;
  }

  /**
   * Estimate encoding performance for given settings
   */
  estimatePerformance(
    settings: EncodingSettings
  ): Partial<EncodingPerformance> {
    const capability = this.getCodecCapabilities(settings.codec);
    if (!capability) {
      return { encodeTime: 0, cpuUsage: 100 };
    }

    // Rough performance estimation based on codec and settings
    let encodeTime = 16.67; // Base time for 60fps
    let cpuUsage = 50;

    // Adjust for codec complexity
    switch (settings.codec) {
      case "H264":
        encodeTime *= 1.0;
        cpuUsage *= 1.0;
        break;
      case "VP8":
        encodeTime *= 1.2;
        cpuUsage *= 1.1;
        break;
      case "VP9":
        encodeTime *= 1.8;
        cpuUsage *= 1.4;
        break;
      case "AV1":
        encodeTime *= 3.0;
        cpuUsage *= 2.0;
        break;
    }

    // Adjust for quality settings
    const qualityMultiplier = settings.quality / 50; // Normalize around 50
    encodeTime *= qualityMultiplier;
    cpuUsage *= qualityMultiplier;

    // Adjust for hardware acceleration
    if (settings.hardwareAcceleration && capability.hardwareAcceleration) {
      encodeTime *= 0.3;
      cpuUsage *= 0.5;
    }

    return {
      encodeTime,
      cpuUsage: Math.min(100, cpuUsage),
      memoryUsage: this.estimateMemoryUsage(settings),
    };
  }

  // Private helper methods

  private initializeCodecCapabilities(): void {
    // Initialize video codec capabilities (simulated - in real implementation would query system)
    this.videoCodecCapabilities.set("H264", {
      codec: "H264",
      encoding: true,
      decoding: true,
      hardwareAcceleration: true,
      maxResolution: { width: 4096, height: 2160 },
      maxFramerate: 60,
      maxBitrate: 50000000,
      profiles: ["baseline", "main", "high"],
      levels: ["3.0", "3.1", "4.0", "4.1", "5.0", "5.1"],
    });

    this.videoCodecCapabilities.set("VP8", {
      codec: "VP8",
      encoding: true,
      decoding: true,
      hardwareAcceleration: false,
      maxResolution: { width: 1920, height: 1080 },
      maxFramerate: 30,
      maxBitrate: 20000000,
      profiles: ["profile0", "profile1", "profile2", "profile3"],
      levels: [],
    });

    this.videoCodecCapabilities.set("VP9", {
      codec: "VP9",
      encoding: true,
      decoding: true,
      hardwareAcceleration: true,
      maxResolution: { width: 4096, height: 2160 },
      maxFramerate: 60,
      maxBitrate: 40000000,
      profiles: ["profile0", "profile1", "profile2", "profile3"],
      levels: [],
    });

    this.videoCodecCapabilities.set("AV1", {
      codec: "AV1",
      encoding: false, // Limited encoding support
      decoding: true,
      hardwareAcceleration: false,
      maxResolution: { width: 4096, height: 2160 },
      maxFramerate: 60,
      maxBitrate: 30000000,
      profiles: ["main"],
      levels: [],
    });

    // Initialize audio codec capabilities
    this.audioCodecCapabilities.set("OPUS", {
      codec: "OPUS",
      encoding: true,
      decoding: true,
      hardwareAcceleration: false,
      maxResolution: { width: 0, height: 0 },
      maxFramerate: 0,
      maxBitrate: 512000,
      profiles: [],
      levels: [],
    });

    this.audioCodecCapabilities.set("AAC", {
      codec: "AAC",
      encoding: true,
      decoding: true,
      hardwareAcceleration: true,
      maxResolution: { width: 0, height: 0 },
      maxFramerate: 0,
      maxBitrate: 320000,
      profiles: ["LC", "HE", "HEv2"],
      levels: [],
    });
  }

  private initializeCodecProfiles(): void {
    // H.264 profiles
    this.codecProfiles.set("h264-ultrafast", {
      name: "H264 Ultrafast",
      description: "Fastest encoding, lowest quality",
      settings: { codec: "H264", preset: "ultrafast", quality: 60 },
      recommendedFor: ["low-latency", "low-cpu"],
      performance: "high",
      quality: "low",
    });

    this.codecProfiles.set("h264-fast", {
      name: "H264 Fast",
      description: "Fast encoding, good quality",
      settings: { codec: "H264", preset: "fast", quality: 75 },
      recommendedFor: ["real-time", "streaming"],
      performance: "high",
      quality: "medium",
    });

    this.codecProfiles.set("h264-medium", {
      name: "H264 Medium",
      description: "Balanced encoding speed and quality",
      settings: { codec: "H264", preset: "medium", quality: 85 },
      recommendedFor: ["balanced", "general-use"],
      performance: "medium",
      quality: "high",
    });

    // VP9 profiles
    this.codecProfiles.set("vp9-realtime", {
      name: "VP9 Realtime",
      description: "Real-time VP9 encoding",
      settings: { codec: "VP9", quality: 70 },
      recommendedFor: ["real-time", "low-bandwidth"],
      performance: "medium",
      quality: "medium",
    });
  }

  private detectHardwareAcceleration(): void {
    // Simulate hardware acceleration detection
    // In real implementation, would check for GPU encoding capabilities
    this.hardwareAccelerationAvailable = true;
    this.logger.debug("Hardware acceleration availability", {
      available: this.hardwareAccelerationAvailable,
    });
  }

  private selectProfile(codec: string, quality: string): CodecProfile {
    const profiles = this.getCodecProfiles(codec);
    const targetProfile =
      profiles.find((p) => p.quality === quality) ||
      profiles.find((p) => p.quality === "medium") ||
      profiles[0];

    return (
      targetProfile || {
        name: "Default",
        description: "Default settings",
        settings: {},
        recommendedFor: [],
        performance: "medium",
        quality: "medium",
      }
    );
  }

  private calculateOptimalBitrate(
    conditions: NetworkConditions,
    maxBitrate?: number
  ): number {
    // Start with 80% of available bandwidth to leave room for other traffic
    let bitrate = Math.floor(conditions.bandwidth * 0.8);

    // Apply packet loss penalty
    if (conditions.packetLoss > 0.01) {
      bitrate = Math.floor(bitrate * (1 - conditions.packetLoss * 2));
    }

    // Apply latency considerations
    if (conditions.latency > 100) {
      bitrate = Math.floor(bitrate * 0.9);
    }

    // Respect maximum bitrate constraint
    if (maxBitrate) {
      bitrate = Math.min(bitrate, maxBitrate);
    }

    // Ensure minimum viable bitrate
    return Math.max(bitrate, 500000);
  }

  private calculateOptimalFramerate(
    conditions: NetworkConditions,
    maxFramerate?: number
  ): number {
    let framerate = 30; // Default framerate

    // Reduce framerate for low bandwidth
    if (conditions.bandwidth < 1000000) {
      framerate = 15;
    } else if (conditions.bandwidth < 2000000) {
      framerate = 24;
    }

    // Reduce framerate for high latency
    if (conditions.latency > 200) {
      framerate = Math.floor(framerate * 0.8);
    }

    // Respect maximum framerate constraint
    if (maxFramerate) {
      framerate = Math.min(framerate, maxFramerate);
    }

    return Math.max(framerate, 10);
  }

  private calculateKeyframeInterval(
    conditions: NetworkConditions,
    latency?: string
  ): number {
    let interval = 30; // Default 1 keyframe per second at 30fps

    // More frequent keyframes for unstable connections
    if (conditions.packetLoss > 0.02) {
      interval = 15;
    }

    // More frequent keyframes for low latency requirements
    if (latency === "low") {
      interval = 10;
    }

    return interval;
  }

  private calculateOptimalAudioBitrate(
    conditions: NetworkConditions,
    maxBitrate?: number
  ): number {
    let bitrate = 128000; // Default audio bitrate

    // Adjust for bandwidth constraints
    if (conditions.bandwidth < 1000000) {
      bitrate = 64000;
    } else if (conditions.bandwidth < 2000000) {
      bitrate = 96000;
    }

    // Apply packet loss penalty
    if (conditions.packetLoss > 0.02) {
      bitrate = Math.floor(bitrate * 0.8);
    }

    // Respect maximum bitrate constraint
    if (maxBitrate) {
      bitrate = Math.min(bitrate, maxBitrate);
    }

    return Math.max(bitrate, 32000);
  }

  private calculateOptimalSampleRate(conditions: NetworkConditions): number {
    // Adjust sample rate based on bandwidth
    if (conditions.bandwidth < 500000) {
      return 24000;
    } else if (conditions.bandwidth < 1000000) {
      return 32000;
    }
    return 48000;
  }

  private calculateOpusComplexity(conditions: NetworkConditions): number {
    // Higher complexity for better compression when CPU allows
    if (conditions.bandwidth < 500000) {
      return 10; // Maximum compression
    } else if (conditions.latency < 50) {
      return 5; // Lower complexity for low latency
    }
    return 8; // Balanced
  }

  private mapQualityToValue(quality: string): number {
    switch (quality) {
      case "low":
        return 60;
      case "medium":
        return 75;
      case "high":
        return 85;
      case "ultra":
        return 95;
      default:
        return 75;
    }
  }

  private shouldUseHardwareAcceleration(settings: EncodingSettings): boolean {
    // Use hardware acceleration for high bitrates and framerates
    return settings.bitrate > 2000000 || settings.framerate > 30;
  }

  private estimateMemoryUsage(settings: EncodingSettings): number {
    // Rough memory usage estimation in MB
    const baseUsage = 100; // Base memory usage
    const bitrateMultiplier = settings.bitrate / 1000000; // Per Mbps
    const qualityMultiplier = settings.quality / 100;

    return baseUsage + bitrateMultiplier * 50 + qualityMultiplier * 30;
  }
}
