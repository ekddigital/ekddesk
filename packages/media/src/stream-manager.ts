import { Logger } from "@ekd-desk/shared";
import { VideoProcessor } from "./video-processor";
import { AudioProcessor } from "./audio-processor";
import {
  FrameData,
  AudioData,
  EncodedFrame,
  ProcessedAudio,
  MediaStreamConfig,
  StreamQuality,
  NetworkConditions,
  EncodingPerformance,
  SyncedMedia,
} from "./types";

/**
 * Stream manager for EKD Desk
 * Coordinates media streams, quality adaptation, and synchronization
 */
export class StreamManager {
  private logger: Logger;
  private videoProcessor: VideoProcessor;
  private audioProcessor: AudioProcessor;
  private isStreaming: boolean = false;
  private streamConfig: MediaStreamConfig;
  private currentQuality: StreamQuality;
  private performanceMetrics: EncodingPerformance;
  private streamStartTime: number = 0;
  private frameCount: number = 0;
  private droppedFrames: number = 0;

  constructor(config?: Partial<MediaStreamConfig>) {
    this.logger = Logger.createLogger("StreamManager");
    this.videoProcessor = new VideoProcessor();
    this.audioProcessor = new AudioProcessor();

    this.streamConfig = {
      video: {
        enabled: true,
        settings: {
          codec: "H264",
          bitrate: 2000000,
          framerate: 30,
          quality: 85,
          keyframeInterval: 30,
        },
        adaptive: {
          targetBitrate: 2000000,
          maxBitrate: 8000000,
          minBitrate: 500000,
          targetFramerate: 30,
          qualityLevel: "high",
          adaptiveMode: "mixed",
        },
      },
      audio: {
        enabled: true,
        settings: {
          codec: "OPUS",
          bitrate: 128000,
          sampleRate: 48000,
          channels: 2,
        },
        echoCancellation: true,
        noiseReduction: true,
      },
      synchronization: {
        enabled: true,
        tolerance: 40,
        correction: true,
      },
      ...config,
    };

    this.currentQuality = {
      bitrate: this.streamConfig.video.settings.bitrate,
      framerate: this.streamConfig.video.settings.framerate,
      resolution: { width: 1920, height: 1080 },
      packetLoss: 0,
      latency: 0,
      jitter: 0,
    };

    this.performanceMetrics = {
      encodeTime: 0,
      decodeTime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      fps: 0,
      droppedFrames: 0,
    };
  }

  /**
   * Start media streaming
   */
  async startStream(): Promise<void> {
    if (this.isStreaming) {
      this.logger.warn("Stream is already running");
      return;
    }

    this.logger.info("Starting media stream", this.streamConfig);

    try {
      this.isStreaming = true;
      this.streamStartTime = Date.now();
      this.frameCount = 0;
      this.droppedFrames = 0;

      this.logger.info("Media stream started successfully");
    } catch (error) {
      this.logger.error("Failed to start stream", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isStreaming = false;
      throw error;
    }
  }

  /**
   * Stop media streaming
   */
  async stopStream(): Promise<void> {
    if (!this.isStreaming) {
      this.logger.warn("Stream is not running");
      return;
    }

    this.logger.info("Stopping media stream");

    try {
      this.isStreaming = false;

      // Calculate final performance metrics
      const streamDuration = Date.now() - this.streamStartTime;
      this.performanceMetrics.fps = this.frameCount / (streamDuration / 1000);
      this.performanceMetrics.droppedFrames = this.droppedFrames;

      this.logger.info("Media stream stopped", {
        duration: streamDuration,
        totalFrames: this.frameCount,
        droppedFrames: this.droppedFrames,
        averageFps: this.performanceMetrics.fps,
      });
    } catch (error) {
      this.logger.error("Error while stopping stream", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process video frame through the pipeline
   */
  async processVideoFrame(frame: FrameData): Promise<EncodedFrame> {
    if (!this.isStreaming || !this.streamConfig.video.enabled) {
      throw new Error(
        "Video streaming is not enabled or stream is not running"
      );
    }

    const startTime = performance.now();

    try {
      const encodedFrame = await this.videoProcessor.encodeFrame(
        frame,
        this.streamConfig.video.settings
      );

      const encodeTime = performance.now() - startTime;
      this.updatePerformanceMetrics({ encodeTime });
      this.frameCount++;

      this.logger.debug("Video frame processed", {
        timestamp: frame.timestamp,
        size: encodedFrame.data.length,
        isKeyframe: encodedFrame.isKeyframe,
        encodeTime,
      });

      return encodedFrame;
    } catch (error) {
      this.droppedFrames++;
      this.logger.error("Video frame processing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process audio data through the pipeline
   */
  async processAudioData(audio: AudioData): Promise<ProcessedAudio> {
    if (!this.isStreaming || !this.streamConfig.audio.enabled) {
      throw new Error(
        "Audio streaming is not enabled or stream is not running"
      );
    }

    try {
      const processedAudio = await this.audioProcessor.encodeAudio(
        audio,
        this.streamConfig.audio.settings
      );

      this.logger.debug("Audio data processed", {
        timestamp: audio.timestamp,
        size: processedAudio.data.length,
        codec: processedAudio.settings.codec,
      });

      return processedAudio;
    } catch (error) {
      this.logger.error("Audio processing failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Synchronize audio and video streams
   */
  async synchronizeStreams(
    audio: AudioData,
    video: FrameData
  ): Promise<SyncedMedia> {
    if (!this.streamConfig.synchronization.enabled) {
      return {
        audio,
        video,
        syncOffset: 0,
        timestamp: Math.max(audio.timestamp, video.timestamp),
      };
    }

    try {
      const syncedMedia = await this.audioProcessor.synchronizeWithVideo(
        audio,
        video
      );

      // Check if sync offset is within tolerance
      if (
        Math.abs(syncedMedia.syncOffset) >
        this.streamConfig.synchronization.tolerance
      ) {
        this.logger.warn("A/V sync offset exceeds tolerance", {
          offset: syncedMedia.syncOffset,
          tolerance: this.streamConfig.synchronization.tolerance,
        });

        if (this.streamConfig.synchronization.correction) {
          // Apply sync correction
          return syncedMedia;
        }
      }

      return syncedMedia;
    } catch (error) {
      this.logger.error("Stream synchronization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Adapt stream quality based on network conditions
   */
  async adaptQuality(conditions: NetworkConditions): Promise<void> {
    this.logger.debug("Adapting stream quality", conditions);

    try {
      // Adapt video settings
      if (this.streamConfig.video.enabled) {
        const adaptedVideoSettings =
          this.videoProcessor.adaptBitrate(conditions);
        this.streamConfig.video.settings = adaptedVideoSettings;
      }

      // Adapt audio settings
      if (this.streamConfig.audio.enabled) {
        const adaptedAudioSettings =
          this.audioProcessor.adaptSettings(conditions);
        this.streamConfig.audio.settings = adaptedAudioSettings;
      }

      // Update quality metrics
      this.currentQuality = {
        ...this.currentQuality,
        bitrate: this.streamConfig.video.settings.bitrate,
        framerate: this.streamConfig.video.settings.framerate,
        packetLoss: conditions.packetLoss,
        latency: conditions.latency,
        jitter: conditions.jitter,
      };

      this.logger.info("Stream quality adapted", {
        videoBitrate: this.streamConfig.video.settings.bitrate,
        videoFramerate: this.streamConfig.video.settings.framerate,
        audioBitrate: this.streamConfig.audio.settings.bitrate,
        networkConditions: conditions,
      });
    } catch (error) {
      this.logger.error("Quality adaptation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update stream configuration
   */
  updateConfig(config: Partial<MediaStreamConfig>): void {
    this.logger.debug("Updating stream configuration", config);

    this.streamConfig = {
      ...this.streamConfig,
      ...config,
      video: { ...this.streamConfig.video, ...config.video },
      audio: { ...this.streamConfig.audio, ...config.audio },
      synchronization: {
        ...this.streamConfig.synchronization,
        ...config.synchronization,
      },
    };

    // Update processor settings
    if (config.audio?.echoCancellation !== undefined) {
      this.audioProcessor.setEchoCancellation(config.audio.echoCancellation);
    }
    if (config.audio?.noiseReduction !== undefined) {
      this.audioProcessor.setNoiseReduction(config.audio.noiseReduction);
    }
  }

  /**
   * Get current stream status
   */
  getStreamStatus(): {
    isStreaming: boolean;
    config: MediaStreamConfig;
    quality: StreamQuality;
    performance: EncodingPerformance;
    uptime: number;
  } {
    return {
      isStreaming: this.isStreaming,
      config: this.streamConfig,
      quality: this.currentQuality,
      performance: this.performanceMetrics,
      uptime: this.isStreaming ? Date.now() - this.streamStartTime : 0,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): EncodingPerformance {
    return { ...this.performanceMetrics };
  }

  /**
   * Get current quality metrics
   */
  getQualityMetrics(): StreamQuality {
    return { ...this.currentQuality };
  }

  /**
   * Check if streaming is active
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  // Private helper methods

  private updatePerformanceMetrics(
    metrics: Partial<EncodingPerformance>
  ): void {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      ...metrics,
    };
  }

  private calculateFramerate(): number {
    if (!this.isStreaming || this.streamStartTime === 0) return 0;

    const elapsed = (Date.now() - this.streamStartTime) / 1000;
    return elapsed > 0 ? this.frameCount / elapsed : 0;
  }
}
