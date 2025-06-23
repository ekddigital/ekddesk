import { EventEmitter } from "events";
import { Logger } from "@ekd-desk/shared";
import { env } from "../config/environment";
import {
  WebRTCManager,
  ConnectionInfo as NetworkConnectionInfo,
} from "@ekd-desk/network";
import { VideoProcessor, StreamManager } from "@ekd-desk/media";
import io, { Socket } from "socket.io-client";
import { ApiService } from "../utils/api";
import { deviceManager, DeviceInfo } from "./device.service";

// Re-export types for compatibility
export interface RemoteDesktopConfig {
  quality: "low" | "medium" | "high" | "ultra";
  enableAudio: boolean;
  enableClipboard: boolean;
  allowMultipleConnections: boolean;
  requirePassword: boolean;
  password?: string;
  maxConnections?: number;
  enableFileTransfer: boolean;
}

export interface ConnectionInfo {
  id: string;
  connectionId: string;
  peerId: string;
  peerDeviceId: string;
  deviceId: string;
  deviceName: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  quality: string;
  startTime: Date;
  bytesTransferred: number;
}

/**
 * Enhanced Remote Desktop Service with Real Video Streaming
 * Uses WebRTC, Media processing, and Signaling server for actual connections
 */
export class EnhancedRemoteDesktopService extends EventEmitter {
  private logger: Logger;
  private webRTCManager: WebRTCManager;
  private videoProcessor: VideoProcessor;
  private streamManager: StreamManager;
  private signalingSocket: Socket | null = null;

  private isHosting = false;
  private isConnected = false;
  private currentConfig: RemoteDesktopConfig | null = null;
  private activeConnections = new Map<string, ConnectionInfo>();
  private currentStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  // Configuration
  private readonly SIGNALING_SERVER_URL = env.getSignalingServerUrl();

  constructor() {
    super();
    this.logger = Logger.createLogger("EnhancedRemoteDesktop");
    this.webRTCManager = new WebRTCManager();
    this.videoProcessor = new VideoProcessor();
    this.streamManager = new StreamManager();

    this.setupEventHandlers();
    this.connectToSignalingServer();

    this.logger.info("Enhanced Remote Desktop Service initialized");
  }

  /**
   * Setup event handlers for WebRTC and media components
   */
  private setupEventHandlers(): void {
    // WebRTC events
    this.webRTCManager.on("connection:created", (data) => {
      this.logger.info("WebRTC connection created", data);
    });

    this.webRTCManager.on("connection:established", (data) => {
      this.handleConnectionEstablished(data);
    });

    this.webRTCManager.on("connection:lost", (data) => {
      this.handleConnectionLost(data);
    });

    this.webRTCManager.on("data:received", (data) => {
      this.handleRemoteInput(data);
    });
  }

  /**
   * Connect to signaling server for WebRTC coordination
   */
  private connectToSignalingServer(): void {
    try {
      this.signalingSocket = io(this.SIGNALING_SERVER_URL, {
        autoConnect: true,
        reconnection: true,
        transports: ["websocket", "polling"],
      });

      this.signalingSocket.on("connect", () => {
        this.logger.info("Connected to signaling server");
        this.registerDevice();
      });

      this.signalingSocket.on("disconnect", () => {
        this.logger.warn("Disconnected from signaling server");
      });

      this.signalingSocket.on("offer", (data) => {
        this.handleRemoteOffer(data);
      });

      this.signalingSocket.on("answer", (data) => {
        this.handleRemoteAnswer(data);
      });

      this.signalingSocket.on("ice-candidate", (data) => {
        this.handleIceCandidate(data);
      });
    } catch (error) {
      this.logger.error("Failed to connect to signaling server", error);
    }
  }

  /**
   * Register this device with the signaling server
   */
  private async registerDevice(): Promise<void> {
    const deviceInfo = await deviceManager.getDeviceInfo();
    if (this.signalingSocket && deviceInfo) {
      this.signalingSocket.emit("device:register", {
        deviceId: deviceInfo.deviceId,
        name: deviceInfo.deviceName,
        type: "desktop",
        capabilities: ["video", "audio", "input"],
      });
    }
  }

  /**
   * Start hosting a remote desktop session with real screen capture
   */
  async startHosting(
    config: RemoteDesktopConfig
  ): Promise<{ deviceId: string; connectionCode: string }> {
    try {
      this.logger.info("Starting hosting session", config);

      const deviceInfo = await deviceManager.getDeviceInfo();
      if (!deviceInfo) {
        throw new Error("Failed to get device info");
      }

      this.currentConfig = config;

      // Request screen capture permission and start stream
      const stream = await this.requestScreenCapture();

      // Start stream management
      await this.streamManager.startStream();

      this.isHosting = true;
      this.currentStream = stream;

      const result = {
        deviceId: deviceInfo.deviceId,
        connectionCode: this.generateConnectionCode(),
      };

      this.emit("hosting-started", {
        deviceId: deviceInfo.deviceId,
        config,
        stream,
      });

      this.logger.info("Hosting session started successfully", result);
      return result;
    } catch (error) {
      this.logger.error("Failed to start hosting", error);
      this.emit("error", { type: "hosting-start-failed", error });
      throw error;
    }
  }

  /**
   * Request screen capture using modern browser APIs
   */
  private async requestScreenCapture(): Promise<MediaStream> {
    try {
      // Try to use getDisplayMedia for screen capture
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: this.currentConfig?.enableAudio || false,
        });

        this.logger.info("Screen capture started", {
          tracks: stream.getTracks().length,
          video: stream.getVideoTracks().length,
          audio: stream.getAudioTracks().length,
        });

        return stream;
      } else {
        throw new Error("Screen capture not supported in this environment");
      }
    } catch (error) {
      this.logger.error("Failed to capture screen", error);
      throw new Error(
        "Failed to start screen capture: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Connect to a remote device with real WebRTC connection
   */
  async connectToDevice(
    deviceId: string,
    password?: string
  ): Promise<ConnectionInfo> {
    try {
      this.logger.info("Connecting to device", { deviceId });

      // Authenticate with device
      const authResult = await ApiService.login(deviceId, password || "");
      if (!authResult.success) {
        throw new Error("Authentication failed: " + authResult.error);
      }

      // Create WebRTC connection
      const connectionId = await this.webRTCManager.createPeerConnection(
        deviceId,
        {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        }
      );

      // Create offer and send via signaling
      const offer = await this.webRTCManager.createOffer(connectionId);

      if (this.signalingSocket) {
        this.signalingSocket.emit("offer", {
          targetDeviceId: deviceId,
          offer: offer.sdp,
          connectionId,
        });
      }

      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        connectionId,
        peerId: deviceId,
        peerDeviceId: deviceId,
        deviceId,
        deviceName: `Device-${deviceId.slice(0, 8)}`,
        status: "connecting",
        quality: this.currentConfig?.quality || "high",
        startTime: new Date(),
        bytesTransferred: 0,
      };

      this.activeConnections.set(connectionId, connectionInfo);
      this.isConnected = true;

      this.logger.info("Connection initiated", connectionInfo);
      return connectionInfo;
    } catch (error) {
      this.logger.error("Failed to connect to device", error);
      this.emit("error", { type: "connection-failed", error });
      throw error;
    }
  }

  /**
   * Handle incoming WebRTC offers
   */
  private async handleRemoteOffer(data: any): Promise<void> {
    try {
      const { offer, fromDeviceId, connectionId } = data;

      // Create answer
      const answer = await this.webRTCManager.createAnswer(connectionId, offer);

      // Send answer back via signaling
      if (this.signalingSocket) {
        this.signalingSocket.emit("answer", {
          targetDeviceId: fromDeviceId,
          answer: answer.sdp,
          connectionId,
        });
      }

      this.logger.info("Processed offer and sent answer", {
        fromDeviceId,
        connectionId,
      });
    } catch (error) {
      this.logger.error("Failed to handle remote offer", error);
    }
  }

  /**
   * Handle incoming WebRTC answers
   */
  private async handleRemoteAnswer(data: any): Promise<void> {
    try {
      const { answer, connectionId } = data;

      await this.webRTCManager.setRemoteDescription(connectionId, {
        type: "answer",
        sdp: answer,
      });

      this.logger.info("Set remote answer", { connectionId });
    } catch (error) {
      this.logger.error("Failed to handle remote answer", error);
    }
  }

  /**
   * Handle ICE candidates
   */
  private async handleIceCandidate(data: any): Promise<void> {
    try {
      const { candidate, connectionId } = data;

      await this.webRTCManager.addIceCandidate(connectionId, candidate);

      this.logger.debug("Added ICE candidate", { connectionId });
    } catch (error) {
      this.logger.error("Failed to handle ICE candidate", error);
    }
  }

  /**
   * Handle established WebRTC connections
   */
  private handleConnectionEstablished(data: NetworkConnectionInfo): void {
    const connectionInfo = this.activeConnections.get(data.id);
    if (connectionInfo) {
      connectionInfo.status = "connected";
      this.emit("connection-established", { connection: connectionInfo });
      this.logger.info("Connection established", { connectionId: data.id });
    }
  }

  /**
   * Handle lost connections
   */
  private handleConnectionLost(data: any): void {
    const connectionInfo = this.activeConnections.get(data.connectionId);
    if (connectionInfo) {
      connectionInfo.status = "disconnected";
      this.activeConnections.delete(data.connectionId);
      this.emit("connection-lost", { connection: connectionInfo });
      this.logger.info("Connection lost", { connectionId: data.connectionId });
    }
  }

  /**
   * Handle remote input (mouse, keyboard)
   */
  private handleRemoteInput(data: any): void {
    // This would be handled by the platform-specific input service
    this.logger.debug("Received remote input", data);
    this.emit("remote-input", data);
  }

  /**
   * Send remote input to connected device
   */
  async sendRemoteInput(
    inputType: "mouse" | "keyboard" | "scroll",
    inputData: any
  ): Promise<void> {
    try {
      const connections = Array.from(this.activeConnections.values()).filter(
        (c) => c.status === "connected"
      );

      for (const connection of connections) {
        await this.webRTCManager.sendData(
          connection.connectionId,
          "input",
          Buffer.from(
            JSON.stringify({
              type: inputType,
              data: inputData,
              timestamp: Date.now(),
            })
          )
        );
      }
    } catch (error) {
      this.logger.error("Failed to send remote input", error);
      this.emit("error", { type: "input-send-failed", inputType, error });
    }
  }

  /**
   * Stop hosting session
   */
  async stopHosting(): Promise<void> {
    try {
      this.isHosting = false;
      this.currentConfig = null;

      // Stop stream
      if (this.currentStream) {
        this.currentStream.getTracks().forEach((track) => track.stop());
        this.currentStream = null;
      }

      // Stop stream manager
      await this.streamManager.stopStream();

      // Close all connections
      for (const [connectionId] of this.activeConnections) {
        await this.webRTCManager.closeConnection(connectionId);
      }
      this.activeConnections.clear();

      this.emit("hosting-stopped", { reason: "User requested stop" });
      this.logger.info("Hosting session stopped");
    } catch (error) {
      this.logger.error("Failed to stop hosting", error);
      throw error;
    }
  }

  /**
   * Disconnect from remote device
   */
  async disconnect(connectionId?: string): Promise<void> {
    try {
      if (connectionId) {
        await this.webRTCManager.closeConnection(connectionId);
        this.activeConnections.delete(connectionId);
      } else {
        // Disconnect all
        for (const [id] of this.activeConnections) {
          await this.webRTCManager.closeConnection(id);
        }
        this.activeConnections.clear();
        this.isConnected = false;
      }

      this.emit("connection-lost", {
        connectionId,
        reason: "User requested disconnect",
      });
      this.logger.info("Disconnected", { connectionId });
    } catch (error) {
      this.logger.error("Failed to disconnect", error);
      throw error;
    }
  }

  /**
   * Attach video stream to canvas element for display
   */
  attachVideoToCanvas(canvas: HTMLCanvasElement, connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (connection && this.currentStream) {
      const video = document.createElement("video");
      video.srcObject = this.currentStream;
      video.play();

      const ctx = canvas.getContext("2d");
      if (ctx) {
        const renderFrame = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
          }
          if (connection.status === "connected") {
            requestAnimationFrame(renderFrame);
          }
        };
        video.addEventListener("loadeddata", () => renderFrame());
      }
    }
  }

  // Utility methods
  private getBitrateForQuality(quality: string): number {
    switch (quality) {
      case "low":
        return 500000;
      case "medium":
        return 1000000;
      case "high":
        return 2000000;
      case "ultra":
        return 4000000;
      default:
        return 2000000;
    }
  }

  private getQualityValue(quality: string): number {
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
        return 85;
    }
  }

  private generateConnectionCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Getters for compatibility
  getHostingStatus() {
    return {
      isHosting: this.isHosting,
      config: this.currentConfig,
      activeConnections: this.activeConnections.size,
      connections: Array.from(this.activeConnections.values()),
    };
  }

  getConnectionStatus() {
    const connections = Array.from(this.activeConnections.values());
    return {
      isConnected: this.isConnected,
      connection: connections.length > 0 ? connections[0] : undefined,
      activeConnections: connections,
    };
  }

  async cleanup(): Promise<void> {
    try {
      if (this.isHosting) {
        await this.stopHosting();
      }

      if (this.isConnected) {
        await this.disconnect();
      }

      if (this.signalingSocket) {
        this.signalingSocket.disconnect();
      }

      this.removeAllListeners();
      this.logger.info("Service cleaned up");
    } catch (error) {
      this.logger.error("Error during cleanup", error);
    }
  }
}

// Create and export the enhanced service instance
export const enhancedRemoteDesktopService = new EnhancedRemoteDesktopService();

// Also export original for compatibility
export { remoteDesktopService } from "./remote-desktop.service";
