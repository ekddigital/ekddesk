import { Logger } from "@ekd-desk/shared";
import {
  AudioData,
  AudioSettings,
  ProcessedAudio,
  FrameData,
  SyncedMedia,
  NetworkConditions,
} from "./types";

/**
 * Audio processor for EKD Desk
 * Handles audio encoding, decoding, processing, and synchronization
 */
export class AudioProcessor {
  private logger: Logger;
  private echoCancellation: boolean = true;
  private noiseReduction: boolean = true;
  private currentSettings: AudioSettings;
  private syncBuffer: AudioData[] = [];
  private maxSyncOffset: number = 40; // milliseconds

  constructor() {
    this.logger = Logger.createLogger("AudioProcessor");
    this.currentSettings = {
      codec: "OPUS",
      bitrate: 128000,
      sampleRate: 48000,
      channels: 2,
      complexity: 10,
      vbr: true,
    };
  }

  /**
   * Encode audio data with compression and quality optimization
   */
  async encodeAudio(
    audio: AudioData,
    settings: AudioSettings
  ): Promise<ProcessedAudio> {
    this.logger.debug("Encoding audio", {
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      codec: settings.codec,
      bitrate: settings.bitrate,
    });

    try {
      // Apply audio preprocessing
      let processedData = await this.preprocessAudio(audio);

      // Simulate encoding (in real implementation would use native audio codecs)
      const encodedData = await this.compressAudio(processedData, settings);

      return {
        data: encodedData,
        settings,
        timestamp: audio.timestamp,
        isKeyframe: this.isAudioKeyframe(audio, settings),
      };
    } catch (error) {
      this.logger.error("Audio encoding failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Decode audio data
   */
  async decodeAudio(processed: ProcessedAudio): Promise<AudioData> {
    this.logger.debug("Decoding audio", {
      codec: processed.settings.codec,
      bitrate: processed.settings.bitrate,
    });

    try {
      const decodedData = await this.decompressAudio(processed);

      return {
        data: decodedData,
        sampleRate: processed.settings.sampleRate,
        channels: processed.settings.channels,
        format: "FLOAT32",
        timestamp: processed.timestamp,
        duration: this.calculateDuration(decodedData, processed.settings),
      };
    } catch (error) {
      this.logger.error("Audio decoding failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Synchronize audio with video using timestamps and buffering
   */
  async synchronizeWithVideo(
    audio: AudioData,
    video: FrameData
  ): Promise<SyncedMedia> {
    this.logger.debug("Synchronizing audio with video", {
      audioTimestamp: audio.timestamp,
      videoTimestamp: video.timestamp,
    });

    const syncOffset = video.timestamp - audio.timestamp;

    // Add to sync buffer for drift correction
    this.syncBuffer.push(audio);
    if (this.syncBuffer.length > 10) {
      this.syncBuffer.shift();
    }

    // Apply sync correction if offset is significant
    let correctedAudio = audio;
    if (Math.abs(syncOffset) > this.maxSyncOffset) {
      correctedAudio = await this.correctAudioSync(audio, syncOffset);
    }

    return {
      audio: correctedAudio,
      video,
      syncOffset,
      timestamp: Math.max(audio.timestamp, video.timestamp),
    };
  }

  /**
   * Apply noise reduction to audio data
   */
  async applyNoiseReduction(audio: AudioData): Promise<AudioData> {
    if (!this.noiseReduction) return audio;

    this.logger.debug("Applying noise reduction");

    try {
      // Simulate noise reduction (in real implementation would use audio processing libraries)
      const processedData = await this.reduceNoise(audio.data);

      return {
        ...audio,
        data: processedData,
      };
    } catch (error) {
      this.logger.error("Noise reduction failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return audio;
    }
  }

  /**
   * Apply echo cancellation
   */
  async applyEchoCancellation(
    audio: AudioData,
    referenceAudio?: AudioData
  ): Promise<AudioData> {
    if (!this.echoCancellation) return audio;

    this.logger.debug("Applying echo cancellation");

    try {
      // Simulate echo cancellation
      const processedData = await this.cancelEcho(
        audio.data,
        referenceAudio?.data
      );

      return {
        ...audio,
        data: processedData,
      };
    } catch (error) {
      this.logger.error("Echo cancellation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return audio;
    }
  }

  /**
   * Adapt audio settings based on network conditions
   */
  adaptSettings(conditions: NetworkConditions): AudioSettings {
    this.logger.debug("Adapting audio settings for network conditions", {
      bandwidth: conditions.bandwidth,
      latency: conditions.latency,
      packetLoss: conditions.packetLoss,
    });

    const adaptedSettings = { ...this.currentSettings };

    // Adjust based on available bandwidth
    if (conditions.bandwidth < 500000) {
      // < 500 kbps
      adaptedSettings.bitrate = 64000;
      adaptedSettings.complexity = 5;
      adaptedSettings.sampleRate = 24000;
    } else if (conditions.bandwidth < 1000000) {
      // < 1 Mbps
      adaptedSettings.bitrate = 96000;
      adaptedSettings.complexity = 7;
      adaptedSettings.sampleRate = 32000;
    } else {
      adaptedSettings.bitrate = 128000;
      adaptedSettings.complexity = 10;
      adaptedSettings.sampleRate = 48000;
    }

    // Adjust for packet loss
    if (conditions.packetLoss > 0.02) {
      adaptedSettings.vbr = false; // Use CBR for better packet loss resilience
      adaptedSettings.bitrate = Math.floor(adaptedSettings.bitrate * 0.8);
    }

    this.currentSettings = adaptedSettings;

    this.logger.debug("Audio settings adapted", adaptedSettings);

    return adaptedSettings;
  }

  /**
   * Configure echo cancellation
   */
  setEchoCancellation(enabled: boolean): void {
    this.echoCancellation = enabled;
    this.logger.debug("Echo cancellation updated", { enabled });
  }

  /**
   * Configure noise reduction
   */
  setNoiseReduction(enabled: boolean): void {
    this.noiseReduction = enabled;
    this.logger.debug("Noise reduction updated", { enabled });
  }

  /**
   * Get current audio settings
   */
  getCurrentSettings(): AudioSettings {
    return { ...this.currentSettings };
  }

  // Private helper methods

  private async preprocessAudio(audio: AudioData): Promise<AudioData> {
    let processed = audio;

    // Apply noise reduction if enabled
    if (this.noiseReduction) {
      processed = await this.applyNoiseReduction(processed);
    }

    // Apply echo cancellation if enabled
    if (this.echoCancellation) {
      processed = await this.applyEchoCancellation(processed);
    }

    return processed;
  }

  private async compressAudio(
    audio: AudioData,
    settings: AudioSettings
  ): Promise<Buffer> {
    // Simulate audio compression
    const compressionRatio = settings.codec === "OPUS" ? 0.1 : 0.15;
    const compressedSize = Math.floor(audio.data.length * compressionRatio);

    const compressed = Buffer.alloc(compressedSize);

    // Simple compression simulation - downsample
    const step = Math.floor(audio.data.length / compressedSize);
    for (let i = 0; i < compressedSize; i++) {
      compressed[i] = audio.data[i * step] || 0;
    }

    return compressed;
  }

  private async decompressAudio(processed: ProcessedAudio): Promise<Buffer> {
    // Simulate audio decompression
    const targetSize = Math.floor(processed.data.length * 8); // Expand compressed data
    const decompressed = Buffer.alloc(targetSize);

    // Simple decompression simulation - upsample
    const expansionRatio = Math.floor(targetSize / processed.data.length);
    for (let i = 0; i < processed.data.length; i++) {
      for (
        let j = 0;
        j < expansionRatio && i * expansionRatio + j < targetSize;
        j++
      ) {
        decompressed[i * expansionRatio + j] = processed.data[i];
      }
    }

    return decompressed;
  }

  private async correctAudioSync(
    audio: AudioData,
    offset: number
  ): Promise<AudioData> {
    this.logger.debug("Correcting audio sync", { offset });

    // Simple sync correction - adjust timestamp
    return {
      ...audio,
      timestamp: audio.timestamp + offset,
    };
  }

  private async reduceNoise(audioData: Buffer): Promise<Buffer> {
    // Simulate noise reduction - simple high-pass filter simulation
    const processed = Buffer.from(audioData);

    // Apply simple smoothing
    for (let i = 1; i < processed.length - 1; i++) {
      processed[i] = Math.floor(
        (processed[i - 1] + processed[i] + processed[i + 1]) / 3
      );
    }

    return processed;
  }

  private async cancelEcho(
    audioData: Buffer,
    referenceData?: Buffer
  ): Promise<Buffer> {
    // Simulate echo cancellation
    const processed = Buffer.from(audioData);

    if (referenceData) {
      // Simple echo cancellation simulation
      const minLength = Math.min(processed.length, referenceData.length);
      for (let i = 0; i < minLength; i++) {
        const echoCanceled = processed[i] - referenceData[i] * 0.3;
        processed[i] = Math.max(-128, Math.min(127, echoCanceled));
      }
    }

    return processed;
  }

  private isAudioKeyframe(audio: AudioData, settings: AudioSettings): boolean {
    // For audio, keyframes are less common but can occur at silence boundaries
    return audio.sequenceNumber ? audio.sequenceNumber % 100 === 0 : false;
  }

  private calculateDuration(
    audioData: Buffer,
    settings: AudioSettings
  ): number {
    // Calculate duration in milliseconds
    const bytesPerSample = 4; // FLOAT32
    const samplesPerChannel =
      audioData.length / (settings.channels * bytesPerSample);
    return (samplesPerChannel / settings.sampleRate) * 1000;
  }
}
