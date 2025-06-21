import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

/**
 * EKD Desk Desktop Client - Preload Script
 * Exposes secure APIs to the renderer process via contextBridge
 */

// Simple logger for preload script
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[PreloadScript] INFO: ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[PreloadScript] WARN: ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[PreloadScript] ERROR: ${message}`, ...args),
};

// Type definitions
export interface HostingConfig {
  displayId?: string;
  quality: "low" | "medium" | "high" | "ultra";
  enableAudio: boolean;
  enableClipboard: boolean;
  allowMultipleConnections: boolean;
  requirePassword: boolean;
  password?: string;
  maxConnections?: number;
}

export interface AppSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  theme: "light" | "dark" | "system";
  quality: "low" | "medium" | "high" | "ultra";
  enableAudio: boolean;
  enableClipboard: boolean;
  windowBounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
  serverUrl?: string;
  notifications: boolean;
  autoConnect: boolean;
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  type: "screen" | "window";
}

export interface Display {
  id: string;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  primary: boolean;
  scaleFactor: number;
}

export interface ConnectionState {
  isHosting: boolean;
  isConnected: boolean;
  status: "disconnected" | "connecting" | "connected" | "hosting" | "error";
  connectionId?: string;
  connectedClients: number;
  currentDisplay?: string;
  remoteHostName?: string;
  error?: string;
  latency?: number;
  bandwidth?: {
    upload: number;
    download: number;
  };
  stats?: {
    bytesReceived: number;
    bytesSent: number;
    fps: number;
    latency: number;
  };
}

export interface RemoteInputEvent {
  type: "mouse" | "keyboard" | "scroll";
  data: any;
  timestamp: number;
}

export interface StreamData {
  type: "video" | "audio";
  data: ArrayBuffer;
  timestamp: number;
}

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: number;
  actions?: {
    label: string;
    action: string;
  }[];
}

// Define the API interface that will be exposed to the renderer
export interface ElectronAPI {
  // App controls
  minimizeApp: () => Promise<void>;
  maximizeApp: () => Promise<void>;
  closeApp: () => Promise<void>;
  restartApp: () => Promise<void>;

  // Connection management
  startHosting: (
    config: HostingConfig
  ) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
  stopHosting: () => Promise<void>;
  connectToHost: (
    connectionId: string,
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // Screen capture
  getScreenSources: () => Promise<ScreenSource[]>;
  getDisplays: () => Promise<Display[]>;

  // System permissions
  requestScreenAccess: () => Promise<boolean>;
  requestInputAccess: () => Promise<boolean>;
  hasScreenAccess: () => Promise<boolean>;
  hasInputAccess: () => Promise<boolean>;

  // Event listeners
  onConnectionStateChange: (callback: (state: ConnectionState) => void) => void;
  onRemoteInput: (callback: (input: RemoteInputEvent) => void) => void;
  onStreamData: (callback: (data: StreamData) => void) => void;
  onError: (callback: (error: AppError) => void) => void;
  onNotification: (callback: (notification: AppNotification) => void) => void;

  // Remove event listeners
  removeAllListeners: (channel: string) => void;
}

// Expose the secure API to the renderer process
const electronAPI: ElectronAPI = {
  // App controls
  minimizeApp: () => ipcRenderer.invoke("app:minimize"),
  maximizeApp: () => ipcRenderer.invoke("app:maximize"),
  closeApp: () => ipcRenderer.invoke("app:close"),
  restartApp: () => ipcRenderer.invoke("app:restart"),

  // Connection management
  startHosting: (config: HostingConfig) =>
    ipcRenderer.invoke("connection:start-hosting", config),
  stopHosting: () => ipcRenderer.invoke("connection:stop-hosting"),
  connectToHost: (connectionId: string, password?: string) =>
    ipcRenderer.invoke("connection:connect", { connectionId, password }),
  disconnect: () => ipcRenderer.invoke("connection:disconnect"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke("settings:update", settings),

  // Screen capture
  getScreenSources: () => ipcRenderer.invoke("screen:get-sources"),
  getDisplays: () => ipcRenderer.invoke("screen:get-displays"),

  // System permissions
  requestScreenAccess: () => ipcRenderer.invoke("permissions:request-screen"),
  requestInputAccess: () => ipcRenderer.invoke("permissions:request-input"),
  hasScreenAccess: () => ipcRenderer.invoke("permissions:has-screen"),
  hasInputAccess: () => ipcRenderer.invoke("permissions:has-input"),

  // Event listeners
  onConnectionStateChange: (callback: (state: ConnectionState) => void) => {
    ipcRenderer.on(
      "connection:state-changed",
      (_event: IpcRendererEvent, state: ConnectionState) => callback(state)
    );
  },
  onRemoteInput: (callback: (input: RemoteInputEvent) => void) => {
    ipcRenderer.on(
      "remote:input",
      (_event: IpcRendererEvent, input: RemoteInputEvent) => callback(input)
    );
  },
  onStreamData: (callback: (data: StreamData) => void) => {
    ipcRenderer.on(
      "stream:data",
      (_event: IpcRendererEvent, data: StreamData) => callback(data)
    );
  },
  onError: (callback: (error: AppError) => void) => {
    ipcRenderer.on("app:error", (_event: IpcRendererEvent, error: AppError) =>
      callback(error)
    );
  },
  onNotification: (callback: (notification: AppNotification) => void) => {
    ipcRenderer.on(
      "app:notification",
      (_event: IpcRendererEvent, notification: AppNotification) =>
        callback(notification)
    );
  },

  // Remove event listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

logger.info("Preload script loaded successfully");
