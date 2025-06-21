import { z } from 'zod';

// Base types
export type DeviceType = 'desktop' | 'mobile' | 'web' | 'server';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

// Device information
export const DeviceInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['desktop', 'mobile', 'web', 'server']),
  platform: z.string(),
  version: z.string(),
  ip: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  capabilities: z.array(z.string()),
  lastSeen: z.date(),
  isOnline: z.boolean(),
  metadata: z.record(z.any()).optional()
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

// Network configuration
export const NetworkConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  host: z.string(),
  protocol: z.enum(['tcp', 'udp', 'websocket']),
  encryption: z.boolean(),
  compression: z.boolean(),
  timeout: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative()
});

export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

// Media settings
export const MediaSettingsSchema = z.object({
  video: z.object({
    enabled: z.boolean(),
    fps: z.number().int().min(15).max(60),
    quality: z.number().int().min(30).max(100),
    bitrate: z.number().int().min(500000).max(10000000),
    codec: z.enum(['h264', 'vp8', 'vp9', 'av1']),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    })
  }),
  audio: z.object({
    enabled: z.boolean(),
    sampleRate: z.number().int().positive(),
    channels: z.number().int().min(1).max(8),
    bitrate: z.number().int().positive(),
    codec: z.enum(['opus', 'aac', 'mp3'])
  })
});

export type MediaSettings = z.infer<typeof MediaSettingsSchema>;

// Session information
export const SessionInfoSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  clientId: z.string().uuid(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'paused', 'ended']),
  mediaSettings: MediaSettingsSchema,
  permissions: z.array(z.string()),
  metadata: z.record(z.any()).optional()
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;

// User information
export const UserInfoSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
  permissions: z.array(z.string()),
  isActive: z.boolean(),
  lastLogin: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type UserInfo = z.infer<typeof UserInfoSchema>;

// Configuration types
export const AppConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'production', 'testing']),
    logLevel: z.enum(['error', 'warn', 'info', 'debug', 'verbose'])
  }),
  database: z.object({
    host: z.string(),
    port: z.number().int().min(1).max(65535),
    name: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean(),
    poolSize: z.number().int().positive()
  }),
  security: z.object({
    jwtSecret: z.string().min(32),
    encryptionKey: z.string().min(32),
    sessionTimeout: z.number().int().positive(),
    maxLoginAttempts: z.number().int().positive(),
    lockoutDuration: z.number().int().positive()
  }),
  network: NetworkConfigSchema,
  media: MediaSettingsSchema
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// Event types
export interface BaseEvent {
  type: string;
  timestamp: Date;
  source: string;
  data?: any;
}

export interface DeviceEvent extends BaseEvent {
  deviceId: string;
  device?: DeviceInfo;
}

export interface SessionEvent extends BaseEvent {
  sessionId: string;
  session?: SessionInfo;
}

export interface NetworkEvent extends BaseEvent {
  connectionId?: string;
  error?: Error;
}

export interface MediaEvent extends BaseEvent {
  sessionId: string;
  mediaType: 'video' | 'audio';
  settings?: MediaSettings;
}

// Error types
export class EKDError extends Error {
  public readonly code: string;
  public readonly context?: any;

  constructor(message: string, code: string, context?: any) {
    super(message);
    this.name = 'EKDError';
    this.code = code;
    this.context = context;
  }
}

export class NetworkError extends EKDError {
  constructor(message: string, context?: any) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends EKDError {
  constructor(message: string, context?: any) {
    super(message, 'AUTH_ERROR', context);
    this.name = 'AuthenticationError';
  }
}

export class ConfigurationError extends EKDError {
  constructor(message: string, context?: any) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

export class MediaError extends EKDError {
  constructor(message: string, context?: any) {
    super(message, 'MEDIA_ERROR', context);
    this.name = 'MediaError';
  }
}
