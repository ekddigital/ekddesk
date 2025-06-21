import { EventEmitter } from "eventemitter3";
import { Logger } from "@ekd-desk/shared";
import {
  NetworkConditions,
  QualitySettings,
  BandwidthMeasurement,
  NetworkAdapter,
  NetworkMonitorResult,
  NetworkError,
} from "./types";

/**
 * Network optimizer for EKD Desk
 * Handles bandwidth measurement, quality adaptation, and network optimization
 */
export class NetworkOptimizer extends EventEmitter {
  private logger: Logger;
  private isDestroyed: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastConditions: NetworkConditions | null = null;
  private adaptiveSettings: QualitySettings;
  private bandwidthHistory: BandwidthMeasurement[] = [];

  // Configuration
  private readonly monitorInterval: number = 10000; // 10 seconds
  private readonly historyLength: number = 10;
  private readonly adaptationThreshold: number = 0.2; // 20% change threshold

  // Default quality settings
  private readonly defaultQualitySettings: QualitySettings = {
    video: {
      fps: 30,
      bitrate: 2000000, // 2 Mbps
      resolution: {
        width: 1920,
        height: 1080,
      },
    },
    audio: {
      bitrate: 128000, // 128 kbps
      sampleRate: 44100,
      channels: 2,
    },
    adaptiveBitrate: true,
    maxBitrate: 10000000, // 10 Mbps
    minBitrate: 500000, // 500 kbps
  };
  constructor() {
    super();

    try {
      this.logger = Logger.createLogger("NetworkOptimizer");
    } catch (err) {
      // Fallback for test environments where Logger might not be available
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        log: () => {},
        setLevel: () => {},
        getLevel: () => "info",
      } as any;
    }

    // If logger is still undefined (shouldn't happen), create minimal fallback
    if (!this.logger) {
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        log: () => {},
        setLevel: () => {},
        getLevel: () => "info",
      } as any;
    }

    this.adaptiveSettings = { ...this.defaultQualitySettings };

    this.startMonitoring();
    this.logger.info("NetworkOptimizer initialized");
  }

  /**
   * Measure current bandwidth
   */
  async measureBandwidth(): Promise<BandwidthMeasurement> {
    try {
      const startTime = Date.now();
      const measurement = await this.performBandwidthTest();
      const endTime = Date.now();

      const result: BandwidthMeasurement = {
        ...measurement,
        timestamp: new Date(),
        duration: endTime - startTime,
      };

      // Add to history
      this.bandwidthHistory.push(result);
      if (this.bandwidthHistory.length > this.historyLength) {
        this.bandwidthHistory.shift();
      }

      this.logger.debug("Bandwidth measured", {
        download: result.download,
        upload: result.upload,
        latency: result.latency,
        duration: result.duration,
      });

      this.emit("bandwidth:measured", result);
      return result;
    } catch (error) {
      this.logger.error("Bandwidth measurement failed", error);
      throw new NetworkError(
        "Bandwidth measurement failed",
        "BANDWIDTH_MEASUREMENT_FAILED",
        { error }
      );
    }
  }

  /**
   * Measure current network conditions
   */
  async measureNetworkConditions(): Promise<NetworkConditions> {
    try {
      const bandwidth = await this.measureBandwidth();
      const adapters = await this.getNetworkAdapters();

      // Determine connection type
      const connectionType = this.determineConnectionType(adapters);

      // Calculate stability
      const isStable = this.calculateNetworkStability();

      const conditions: NetworkConditions = {
        bandwidth: bandwidth.download,
        latency: bandwidth.latency,
        packetLoss: this.estimatePacketLoss(),
        jitter: bandwidth.jitter,
        connectionType,
        isStable,
      };

      this.lastConditions = conditions;
      this.logger.debug("Network conditions measured", conditions);

      this.emit("conditions:measured", conditions);
      return conditions;
    } catch (error) {
      this.logger.error("Network conditions measurement failed", error);
      throw new NetworkError(
        "Network conditions measurement failed",
        "CONDITIONS_MEASUREMENT_FAILED",
        { error }
      );
    }
  }

  /**
   * Adapt quality settings based on network conditions
   */
  adaptQuality(conditions: NetworkConditions): QualitySettings {
    try {
      const settings = this.calculateOptimalSettings(conditions);

      // Check if adaptation is needed
      if (this.shouldAdaptSettings(settings)) {
        this.adaptiveSettings = settings;
        this.logger.info("Quality settings adapted", {
          bandwidth: conditions.bandwidth,
          latency: conditions.latency,
          newBitrate: settings.video.bitrate,
          newFps: settings.video.fps,
        });

        this.emit("quality:adapted", { conditions, settings });
      }

      return { ...this.adaptiveSettings };
    } catch (error) {
      this.logger.error("Quality adaptation failed", error);
      return { ...this.adaptiveSettings };
    }
  }

  /**
   * Handle network congestion
   */
  handleCongestion(): QualitySettings {
    this.logger.warn("Network congestion detected, reducing quality");

    // Aggressive quality reduction for congestion
    const congestionSettings: QualitySettings = {
      video: {
        fps: Math.max(15, this.adaptiveSettings.video.fps * 0.5),
        bitrate: Math.max(
          this.defaultQualitySettings.minBitrate,
          this.adaptiveSettings.video.bitrate * 0.3
        ),
        resolution: {
          width: Math.max(
            640,
            this.adaptiveSettings.video.resolution.width * 0.5
          ),
          height: Math.max(
            480,
            this.adaptiveSettings.video.resolution.height * 0.5
          ),
        },
      },
      audio: {
        bitrate: Math.max(64000, this.adaptiveSettings.audio.bitrate * 0.5),
        sampleRate: this.adaptiveSettings.audio.sampleRate,
        channels: 1, // Reduce to mono
      },
      adaptiveBitrate: true,
      maxBitrate: this.adaptiveSettings.maxBitrate * 0.5,
      minBitrate: this.defaultQualitySettings.minBitrate,
    };

    this.adaptiveSettings = congestionSettings;
    this.emit("congestion:handled", congestionSettings);

    return { ...congestionSettings };
  }

  /**
   * Get current quality settings
   */
  getCurrentQualitySettings(): QualitySettings {
    return { ...this.adaptiveSettings };
  }

  /**
   * Update quality settings manually
   */
  updateQualitySettings(settings: Partial<QualitySettings>): void {
    this.adaptiveSettings = {
      ...this.adaptiveSettings,
      ...settings,
      video: {
        ...this.adaptiveSettings.video,
        ...settings.video,
      },
      audio: {
        ...this.adaptiveSettings.audio,
        ...settings.audio,
      },
    };

    this.logger.info("Quality settings updated manually", settings);
    this.emit("quality:updated", this.adaptiveSettings);
  }

  /**
   * Get bandwidth history
   */
  getBandwidthHistory(): BandwidthMeasurement[] {
    return [...this.bandwidthHistory];
  }

  /**
   * Get average bandwidth from history
   */
  getAverageBandwidth(): { download: number; upload: number; latency: number } {
    if (this.bandwidthHistory.length === 0) {
      return { download: 0, upload: 0, latency: 0 };
    }

    const totals = this.bandwidthHistory.reduce(
      (acc, measurement) => ({
        download: acc.download + measurement.download,
        upload: acc.upload + measurement.upload,
        latency: acc.latency + measurement.latency,
      }),
      { download: 0, upload: 0, latency: 0 }
    );

    const count = this.bandwidthHistory.length;
    return {
      download: totals.download / count,
      upload: totals.upload / count,
      latency: totals.latency / count,
    };
  }

  /**
   * Monitor network conditions
   */
  async monitorNetwork(): Promise<NetworkMonitorResult> {
    try {
      const conditions = await this.measureNetworkConditions();
      const adapters = await this.getNetworkAdapters();
      const bandwidth = await this.measureBandwidth();

      const result: NetworkMonitorResult = {
        adapters,
        defaultGateway: await this.getDefaultGateway(),
        dnsServers: await this.getDnsServers(),
        publicIp: await this.getPublicIp(),
        bandwidth,
        timestamp: new Date(),
      };

      this.emit("network:monitored", result);
      return result;
    } catch (error) {
      this.logger.error("Network monitoring failed", error);
      throw new NetworkError(
        "Network monitoring failed",
        "NETWORK_MONITORING_FAILED",
        { error }
      );
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    this.adaptiveSettings = { ...this.defaultQualitySettings };
    this.bandwidthHistory = [];
    this.lastConditions = null;

    this.logger.info("Settings reset to defaults");
    this.emit("quality:reset", this.adaptiveSettings);
  }

  /**
   * Destroy optimizer
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.logger.info("Destroying NetworkOptimizer");
    this.isDestroyed = true;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.removeAllListeners();
    this.logger.info("NetworkOptimizer destroyed");
  }

  // Private methods

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      if (!this.isDestroyed) {
        try {
          const conditions = await this.measureNetworkConditions();
          this.checkForConditionChanges(conditions);
        } catch (error) {
          this.logger.debug("Monitoring cycle failed", error);
        }
      }
    }, this.monitorInterval);
  }

  private checkForConditionChanges(newConditions: NetworkConditions): void {
    if (!this.lastConditions) {
      return;
    }

    const bandwidthChange =
      Math.abs(newConditions.bandwidth - this.lastConditions.bandwidth) /
      this.lastConditions.bandwidth;
    const latencyChange =
      Math.abs(newConditions.latency - this.lastConditions.latency) /
      this.lastConditions.latency;

    if (
      bandwidthChange > this.adaptationThreshold ||
      latencyChange > this.adaptationThreshold
    ) {
      this.logger.debug("Significant network conditions change detected", {
        bandwidthChange: bandwidthChange * 100,
        latencyChange: latencyChange * 100,
      });

      this.emit("conditions:changed", newConditions);
      this.adaptQuality(newConditions);
    }
  }

  private async performBandwidthTest(): Promise<
    Omit<BandwidthMeasurement, "timestamp" | "duration">
  > {
    // Simple bandwidth test implementation
    // In a real implementation, this would make HTTP requests to test servers

    const testStartTime = performance.now();

    try {
      // Simulate download test
      const downloadStart = performance.now();
      await this.simulateDownloadTest();
      const downloadTime = performance.now() - downloadStart;

      // Simulate upload test
      const uploadStart = performance.now();
      await this.simulateUploadTest();
      const uploadTime = performance.now() - uploadStart;

      // Calculate latency (round-trip time)
      const latencyStart = performance.now();
      await this.simulateLatencyTest();
      const latency = performance.now() - latencyStart;

      // Estimate bandwidth (this is simplified)
      const testDataSize = 1024 * 1024; // 1MB test
      const downloadBandwidth = (testDataSize * 8) / (downloadTime / 1000); // bps
      const uploadBandwidth = (testDataSize * 8) / (uploadTime / 1000); // bps

      return {
        download: downloadBandwidth,
        upload: uploadBandwidth,
        latency,
        jitter: this.calculateJitter(),
      };
    } catch (error) {
      // Fallback to estimated values
      return {
        download: 5000000, // 5 Mbps default
        upload: 1000000, // 1 Mbps default
        latency: 50, // 50ms default
        jitter: 10, // 10ms default
      };
    }
  }

  private async simulateDownloadTest(): Promise<void> {
    // Simulate network delay
    return new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50)
    );
  }

  private async simulateUploadTest(): Promise<void> {
    // Simulate network delay
    return new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 150 + 75)
    );
  }

  private async simulateLatencyTest(): Promise<void> {
    // Simulate ping
    return new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 50 + 25)
    );
  }

  private calculateJitter(): number {
    if (this.bandwidthHistory.length < 2) {
      return 0;
    }

    const latencies = this.bandwidthHistory.slice(-5).map((m) => m.latency);
    const avgLatency =
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const variance =
      latencies.reduce((sum, lat) => sum + Math.pow(lat - avgLatency, 2), 0) /
      latencies.length;

    return Math.sqrt(variance);
  }

  private async getNetworkAdapters(): Promise<NetworkAdapter[]> {
    // Simplified network adapter detection
    // In a real implementation, this would use OS-specific APIs

    return [
      {
        name: "Ethernet",
        description: "Primary Ethernet Adapter",
        type: "ethernet",
        isActive: true,
        addresses: {
          ipv4: "192.168.1.100",
          mac: "00:11:22:33:44:55",
        },
        statistics: {
          bytesReceived: 1024000,
          bytesSent: 512000,
          packetsReceived: 1000,
          packetsSent: 500,
        },
      },
    ];
  }

  private determineConnectionType(
    adapters: NetworkAdapter[]
  ): "wifi" | "ethernet" | "cellular" | "unknown" {
    for (const adapter of adapters) {
      if (adapter.isActive) {
        if (adapter.type === "ethernet") return "ethernet";
        if (adapter.type === "wifi") return "wifi";
        if (adapter.type === "cellular") return "cellular";
      }
    }
    return "unknown";
  }

  private calculateNetworkStability(): boolean {
    if (this.bandwidthHistory.length < 3) {
      return true; // Assume stable if not enough data
    }

    const recentMeasurements = this.bandwidthHistory.slice(-3);
    const bandwidths = recentMeasurements.map((m) => m.download);
    const avgBandwidth =
      bandwidths.reduce((sum, bw) => sum + bw, 0) / bandwidths.length;

    // Check if variance is within acceptable range (20%)
    const variance = bandwidths.every(
      (bw) => Math.abs(bw - avgBandwidth) / avgBandwidth < 0.2
    );

    return variance;
  }

  private estimatePacketLoss(): number {
    // Simplified packet loss estimation
    // In practice, this would be measured from actual network statistics
    const stability = this.calculateNetworkStability();
    return stability ? Math.random() * 0.5 : Math.random() * 5; // 0-0.5% if stable, 0-5% if unstable
  }

  private calculateOptimalSettings(
    conditions: NetworkConditions
  ): QualitySettings {
    const { bandwidth, latency, packetLoss, isStable } = conditions;

    // Base settings on available bandwidth
    let videoBitrate = Math.min(
      bandwidth * 0.8,
      this.defaultQualitySettings.maxBitrate
    ); // Use 80% of available bandwidth
    let fps = this.defaultQualitySettings.video.fps;
    let resolution = { ...this.defaultQualitySettings.video.resolution };

    // Adjust for latency
    if (latency > 150) {
      fps = Math.max(15, fps * 0.75);
      videoBitrate *= 0.8;
    } else if (latency > 100) {
      fps = Math.max(20, fps * 0.9);
      videoBitrate *= 0.9;
    }

    // Adjust for packet loss
    if (packetLoss > 2) {
      videoBitrate *= 0.7;
      fps = Math.max(15, fps * 0.8);
    } else if (packetLoss > 1) {
      videoBitrate *= 0.85;
    }

    // Adjust for stability
    if (!isStable) {
      videoBitrate *= 0.8;
      fps = Math.max(15, fps * 0.8);
    }

    // Ensure minimum quality
    videoBitrate = Math.max(
      this.defaultQualitySettings.minBitrate,
      videoBitrate
    );

    // Adjust resolution based on bitrate
    if (videoBitrate < 1000000) {
      // < 1 Mbps
      resolution = { width: 640, height: 480 };
    } else if (videoBitrate < 2000000) {
      // < 2 Mbps
      resolution = { width: 1280, height: 720 };
    }

    // Audio settings
    let audioBitrate = this.defaultQualitySettings.audio.bitrate;
    let audioChannels = this.defaultQualitySettings.audio.channels;

    if (bandwidth < 1000000) {
      // < 1 Mbps total
      audioBitrate = 64000; // 64 kbps
      audioChannels = 1; // Mono
    } else if (bandwidth < 2000000) {
      // < 2 Mbps total
      audioBitrate = 96000; // 96 kbps
    }

    return {
      video: {
        fps: Math.round(fps),
        bitrate: Math.round(videoBitrate),
        resolution,
      },
      audio: {
        bitrate: audioBitrate,
        sampleRate: this.defaultQualitySettings.audio.sampleRate,
        channels: audioChannels,
      },
      adaptiveBitrate: true,
      maxBitrate: this.defaultQualitySettings.maxBitrate,
      minBitrate: this.defaultQualitySettings.minBitrate,
    };
  }

  private shouldAdaptSettings(newSettings: QualitySettings): boolean {
    const current = this.adaptiveSettings;

    const bitrateChange =
      Math.abs(newSettings.video.bitrate - current.video.bitrate) /
      current.video.bitrate;
    const fpsChange =
      Math.abs(newSettings.video.fps - current.video.fps) / current.video.fps;

    return (
      bitrateChange > this.adaptationThreshold ||
      fpsChange > this.adaptationThreshold
    );
  }

  private async getDefaultGateway(): Promise<string> {
    // Simplified - in practice would query system routing table
    return "192.168.1.1";
  }

  private async getDnsServers(): Promise<string[]> {
    // Simplified - in practice would query system DNS configuration
    return ["8.8.8.8", "8.8.4.4"];
  }

  private async getPublicIp(): Promise<string | undefined> {
    try {
      // Simplified - in practice would make HTTP request to IP service
      return "203.0.113.1";
    } catch {
      return undefined;
    }
  }
}
