// Simple browser-compatible event emitter
class BrowserEventEmitter {
  private listeners: { [event: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((listener) => listener(...args));
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  // Alias for off method to match expected interface
  removeListener(event: string, listener: Function) {
    this.off(event, listener);
  }
}

import { apiService } from "./api.service";
import { deviceManager, DeviceInfo } from "./device.service";
import { webRTCService } from "./webrtc.service";
import { env } from "../config/environment";

/**
 * Remote Desktop Service - Simplified for Renderer Process
 * Uses IPC communication to main process for actual functionality
 */

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

export class RemoteDesktopService extends BrowserEventEmitter {
  private isHosting = false;
  private isConnected = false;
  private currentConfig: RemoteDesktopConfig | null = null;
  private activeConnections = new Map<string, ConnectionInfo>();

  constructor() {
    super();
    console.log("RemoteDesktopService initialized (simplified version)");
  }

  /**
   * Start hosting a remote desktop session
   */
  async startHosting(
    config: RemoteDesktopConfig
  ): Promise<{ deviceId: string; connectionCode: string }> {
    try {
      const deviceInfo = await deviceManager.getDeviceInfo();
      if (!deviceInfo) {
        throw new Error("Failed to get device info");
      }

      this.currentConfig = config;
      this.isHosting = true;

      // Initialize WebRTC signalling (Socket.IO)
      const signalingUrl = env.getSignalingServerUrl();
      await webRTCService.initializeSignalling(signalingUrl);

      // Test screen capture first
      await webRTCService.testScreenCapture();

      // Start hosting with WebRTC
      const hostingInfo = await webRTCService.startHosting();

      this.emit("hosting-started", {
        deviceId: hostingInfo.deviceId,
        accessCode: hostingInfo.accessCode,
        config,
      });

      console.log(
        `Started hosting: ${hostingInfo.deviceId} / ${hostingInfo.accessCode}`
      );

      return {
        deviceId: hostingInfo.deviceId,
        connectionCode: hostingInfo.accessCode,
      };
    } catch (error) {
      this.emit("error", { type: "hosting-start-failed", error });
      throw error;
    }
  }

  /**
   * Stop hosting
   */
  async stopHosting(): Promise<void> {
    try {
      this.isHosting = false;
      this.currentConfig = null;

      // Use Electron IPC to stop hosting
      // TODO: Implement IPC communication when ready
      // await window.electronAPI?.remoteDesktop?.stopHosting?.();

      this.emit("hosting-stopped", {
        reason: "User requested stop",
        connectionsActive: this.activeConnections.size,
      });

      this.activeConnections.clear();
    } catch (error) {
      this.emit("error", { type: "hosting-stop-failed", error });
      throw error;
    }
  }

  /**
   * Connect to a remote device
   */
  async connectToDevice(
    deviceId: string,
    connectionCode?: string
  ): Promise<ConnectionInfo> {
    try {
      console.log(`Attempting to connect to device: ${deviceId}`);

      // First, validate device credentials with backend
      const response = await apiService.login({
        deviceId: deviceId,
        password: connectionCode || "",
      });
      if (!response.success) {
        throw new Error(response.message || "Invalid device credentials");
      }

      // Initialize WebRTC signalling (Socket.IO)
      const signalingUrl = env.getSignalingServerUrl();
      await webRTCService.initializeSignalling(signalingUrl);

      // Connect to host using WebRTC
      await webRTCService.connectToHost(deviceId, connectionCode || "");

      this.isConnected = true;

      // Create connection info
      const connectionInfo: ConnectionInfo = {
        id: `conn_${Date.now()}`,
        connectionId: `conn_${Date.now()}`,
        peerId: deviceId,
        peerDeviceId: deviceId,
        deviceId: deviceId,
        deviceName: `Device-${deviceId.slice(0, 8)}`,
        status: "connecting" as const,
        quality: "high",
        startTime: new Date(),
        bytesTransferred: 0,
      };

      this.activeConnections.set(connectionInfo.connectionId, connectionInfo);
      this.emit("connection-established", { connection: connectionInfo });

      // Wait for WebRTC connection to establish
      setTimeout(() => {
        connectionInfo.status = "connected";
        this.emit("connection-established", { connection: connectionInfo });
        console.log(`Successfully connected to device: ${deviceId}`);
      }, 3000);

      return connectionInfo;
    } catch (error) {
      console.error(`Failed to connect to device ${deviceId}:`, error);
      this.emit("error", {
        code: "CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "Connection failed",
        details: { deviceId },
      });
      throw error;
    }
  }

  /**
   * Connect to a remote device (alias for connectToDevice)
   */
  async connectToRemote(
    deviceId: string,
    password?: string
  ): Promise<ConnectionInfo> {
    return this.connectToDevice(deviceId, password);
  }

  /**
   * Disconnect from remote device
   */
  async disconnect(connectionId?: string): Promise<void> {
    try {
      if (connectionId) {
        // TODO: Implement IPC communication when ready
        // await window.electronAPI?.remoteDesktop?.disconnect?.(connectionId);
        this.activeConnections.delete(connectionId);
      } else {
        // Disconnect all
        // TODO: Implement IPC communication when ready
        // await window.electronAPI?.remoteDesktop?.disconnectAll?.();
        this.activeConnections.clear();
        this.isConnected = false;
      }

      this.emit("connection-lost", {
        connectionId,
        reason: "User requested disconnect",
      });
    } catch (error) {
      this.emit("error", { type: "disconnect-failed", error });
      throw error;
    }
  }

  /**
   * Send remote input
   */
  async sendRemoteInput(
    inputType: "mouse" | "keyboard" | "scroll",
    inputData: any
  ): Promise<void> {
    try {
      // Send input via WebRTC data channel
      webRTCService.sendRemoteInput({
        type: inputType,
        data: inputData,
        timestamp: Date.now(),
      });

      this.emit("remote-input", { type: inputType, data: inputData });
    } catch (error) {
      this.emit("error", {
        type: "input-send-failed",
        inputType,
        error,
      });
    }
  }

  /**
   * Get hosting status
   */
  getHostingStatus(): {
    isHosting: boolean;
    config: RemoteDesktopConfig | null;
    activeConnections: number;
    connections: ConnectionInfo[];
  } {
    return {
      isHosting: this.isHosting,
      config: this.currentConfig,
      activeConnections: this.activeConnections.size,
      connections: Array.from(this.activeConnections.values()),
    };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    connection?: ConnectionInfo;
    activeConnections: ConnectionInfo[];
  } {
    const connections = Array.from(this.activeConnections.values());
    return {
      isConnected: this.isConnected,
      connection: connections.length > 0 ? connections[0] : undefined,
      activeConnections: connections,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isHosting) {
        await this.stopHosting();
      }

      if (this.isConnected) {
        await this.disconnect();
      }

      this.removeAllListeners();
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

// Export singleton instance
export const remoteDesktopService = new RemoteDesktopService();
