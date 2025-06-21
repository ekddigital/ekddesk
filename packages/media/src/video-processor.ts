import { Logger } from "@ekd-desk/shared";
import {
  FrameData,
  EncodingSettings,
  EncodedFrame,
  MotionData,
  MotionRegion,
  NetworkConditions,
} from "./types";

/**
 * Video processor for EKD Desk
 * Handles frame encoding, decoding, and motion detection with adaptive quality
 */
export class VideoProcessor {
  private logger: Logger;
  private previousFrame: FrameData | null = null;
  private currentSettings: EncodingSettings;
  private motionThreshold: number = 10;
  private compressionBuffer: ArrayBuffer[] = [];

  constructor() {
    this.logger = Logger.createLogger("VideoProcessor");
    this.currentSettings = {
      codec: "H264",
      bitrate: 2000000,
      framerate: 30,
      quality: 85,
      keyframeInterval: 30,
    };
  }

  /**
   * Encode frame data with compression and motion-based optimization
   */
  async encodeFrame(
    frame: FrameData,
    settings: EncodingSettings
  ): Promise<EncodedFrame> {
    this.logger.debug("Encoding frame", {
      width: frame.width,
      height: frame.height,
      codec: settings.codec,
      bitrate: settings.bitrate,
    });

    try {
      // Check for motion to determine if this should be a keyframe
      let isKeyframe = this.shouldGenerateKeyframe(frame, settings);

      // Simulate encoding process (in real implementation, would use native codecs)
      const encodedData = await this.compressFrame(frame, settings, isKeyframe);

      // Store current frame for next motion detection
      this.previousFrame = frame;

      return {
        data: Buffer.from(encodedData),
        settings,
        timestamp: frame.timestamp,
        isKeyframe,
        compressionRatio: this.calculateCompressionRatio(
          frame.data.byteLength,
          encodedData.byteLength
        ),
      };
    } catch (error) {
      this.logger.error("Frame encoding failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Decode frame data
   */
  async decodeFrame(encoded: EncodedFrame): Promise<FrameData> {
    this.logger.debug("Decoding frame", {
      codec: encoded.settings.codec,
      isKeyframe: encoded.isKeyframe,
      size: encoded.data.byteLength,
    });

    try {
      // Simulate decoding process
      const decodedData = await this.decompressFrame(encoded);

      return {
        data: Buffer.from(decodedData),
        width: 1920, // TODO: Extract from encoded metadata
        height: 1080,
        format: "RGBA",
        timestamp: encoded.timestamp,
      };
    } catch (error) {
      this.logger.error("Frame decoding failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Detect motion between frames using pixel difference analysis
   */
  detectMotion(currentFrame: FrameData, previousFrame?: FrameData): MotionData {
    if (!previousFrame) {
      previousFrame = this.previousFrame || undefined;
    }

    if (!previousFrame) {
      return {
        regions: [],
        totalMotion: 0,
        threshold: this.motionThreshold,
        algorithm: "block-based",
      };
    }

    this.logger.debug("Detecting motion between frames");

    const regions: MotionRegion[] = [];
    let totalMotion = 0;

    try {
      // Divide frame into 16x16 blocks for motion detection
      const blockSize = 16;
      const blocksX = Math.floor(currentFrame.width / blockSize);
      const blocksY = Math.floor(currentFrame.height / blockSize);

      const currentData = new Uint8Array(currentFrame.data);
      const prevData = new Uint8Array(previousFrame.data);

      for (let y = 0; y < blocksY; y++) {
        for (let x = 0; x < blocksX; x++) {
          const motion = this.calculateBlockMotion(
            currentData,
            prevData,
            x * blockSize,
            y * blockSize,
            blockSize,
            currentFrame.width
          );

          if (motion > this.motionThreshold) {
            regions.push({
              x: x * blockSize,
              y: y * blockSize,
              width: blockSize,
              height: blockSize,
              intensity: motion,
            });
            totalMotion += motion;
          }
        }
      }

      this.logger.debug("Motion detection complete", {
        regions: regions.length,
        totalMotion,
      });

      return {
        regions,
        totalMotion,
        threshold: this.motionThreshold,
        algorithm: "block-based",
      };
    } catch (error) {
      this.logger.error("Motion detection failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        regions: [],
        totalMotion: 0,
        threshold: this.motionThreshold,
        algorithm: "block-based",
      };
    }
  }

  /**
   * Adapt bitrate and quality based on network conditions and motion
   */
  adaptBitrate(
    conditions: NetworkConditions,
    motionData?: MotionData
  ): EncodingSettings {
    this.logger.debug("Adapting bitrate for conditions", {
      bandwidth: conditions.bandwidth,
      latency: conditions.latency,
      packetLoss: conditions.packetLoss,
    });

    const baseSettings = { ...this.currentSettings };

    // Adjust based on available bandwidth
    if (conditions.bandwidth < 1000000) {
      // < 1 Mbps
      baseSettings.bitrate = Math.min(baseSettings.bitrate, 500000);
      baseSettings.quality = 60;
      baseSettings.framerate = 15;
    } else if (conditions.bandwidth < 5000000) {
      // < 5 Mbps
      baseSettings.bitrate = Math.min(baseSettings.bitrate, 2000000);
      baseSettings.quality = 75;
      baseSettings.framerate = 24;
    } else {
      baseSettings.bitrate = Math.min(baseSettings.bitrate, 8000000);
      baseSettings.quality = 90;
      baseSettings.framerate = 30;
    }

    // Adjust based on latency
    if (conditions.latency > 200) {
      baseSettings.keyframeInterval = Math.max(
        baseSettings.keyframeInterval / 2,
        10
      );
    }

    // Adjust based on packet loss
    if (conditions.packetLoss > 0.05) {
      baseSettings.keyframeInterval = Math.max(
        baseSettings.keyframeInterval / 2,
        5
      );
      baseSettings.bitrate = Math.floor(baseSettings.bitrate * 0.8);
    }

    // Adjust based on motion
    if (motionData && motionData.totalMotion > 1000) {
      baseSettings.bitrate = Math.floor(baseSettings.bitrate * 1.2);
      baseSettings.keyframeInterval = Math.max(
        baseSettings.keyframeInterval / 2,
        10
      );
    }

    this.currentSettings = baseSettings;

    this.logger.debug("Bitrate adaptation complete", baseSettings);

    return baseSettings;
  }

  /**
   * Set motion detection sensitivity
   */
  setMotionThreshold(threshold: number): void {
    this.motionThreshold = Math.max(1, Math.min(100, threshold));
    this.logger.debug("Motion threshold updated", {
      threshold: this.motionThreshold,
    });
  }

  /**
   * Get current encoding settings
   */
  getCurrentSettings(): EncodingSettings {
    return { ...this.currentSettings };
  }

  // Private helper methods

  private shouldGenerateKeyframe(
    frame: FrameData,
    settings: EncodingSettings
  ): boolean {
    if (!this.previousFrame) return true;

    const motionData = this.detectMotion(frame);
    const highMotion = motionData.totalMotion > 2000;
    const timeForKeyframe =
      frame.timestamp - this.previousFrame.timestamp >=
      (1000 / settings.framerate) * settings.keyframeInterval;

    return highMotion || timeForKeyframe;
  }

  private async compressFrame(
    frame: FrameData,
    settings: EncodingSettings,
    isKeyframe: boolean
  ): Promise<ArrayBuffer> {
    // Simulate compression - in real implementation would use native codecs
    const compressionRatio = isKeyframe ? 0.1 : 0.05;
    const compressedSize = Math.floor(frame.data.byteLength * compressionRatio);

    // Simple compression simulation
    const compressed = new ArrayBuffer(compressedSize);
    const view = new Uint8Array(compressed);
    const original = new Uint8Array(frame.data);

    // Sample every nth pixel for compression simulation
    const step = Math.floor(original.length / compressedSize);
    for (let i = 0; i < compressedSize; i++) {
      view[i] = original[i * step] || 0;
    }

    return compressed;
  }

  private async decompressFrame(encoded: EncodedFrame): Promise<ArrayBuffer> {
    // Simulate decompression - in real implementation would use native codecs
    const targetSize = 1920 * 1080 * 4; // RGBA
    const decompressed = new ArrayBuffer(targetSize);
    const view = new Uint8Array(decompressed);
    const compressed = new Uint8Array(encoded.data);

    // Expand compressed data
    const expansionRatio = Math.floor(targetSize / compressed.length);
    for (let i = 0; i < compressed.length; i++) {
      for (
        let j = 0;
        j < expansionRatio && i * expansionRatio + j < targetSize;
        j++
      ) {
        view[i * expansionRatio + j] = compressed[i];
      }
    }

    return decompressed;
  }

  private calculateBlockMotion(
    current: Uint8Array,
    previous: Uint8Array,
    startX: number,
    startY: number,
    blockSize: number,
    frameWidth: number
  ): number {
    let motion = 0;
    const pixelsPerRow = frameWidth * 4; // RGBA

    for (let y = 0; y < blockSize; y++) {
      for (let x = 0; x < blockSize; x++) {
        const pixelIndex = (startY + y) * pixelsPerRow + (startX + x) * 4;

        if (
          pixelIndex + 2 < current.length &&
          pixelIndex + 2 < previous.length
        ) {
          // Calculate luminance difference
          const currentLuma =
            0.299 * current[pixelIndex] +
            0.587 * current[pixelIndex + 1] +
            0.114 * current[pixelIndex + 2];
          const prevLuma =
            0.299 * previous[pixelIndex] +
            0.587 * previous[pixelIndex + 1] +
            0.114 * previous[pixelIndex + 2];
          motion += Math.abs(currentLuma - prevLuma);
        }
      }
    }

    return motion / (blockSize * blockSize);
  }

  private calculateCompressionRatio(
    originalSize: number,
    compressedSize: number
  ): number {
    return originalSize > 0 ? compressedSize / originalSize : 1;
  }
}
