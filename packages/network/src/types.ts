import { z } from 'zod';

// Connection states
export type ConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'failed' 
  | 'closed';

// Connection types
export type ConnectionType = 'direct' | 'relayed' | 'turn';

// WebRTC Configuration
export interface RTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
}

// Signaling message types
export type SignalingMessageType = 
  | 'offer' 
  | 'answer' 
  | 'ice-candidate' 
  | 'device-discovery' 
  | 'device-response'
  | 'connection-request'
  | 'connection-response'
  | 'connection-close'
  | 'heartbeat'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
  from: string;
  to: string;
  data: any;
  timestamp: Date;
  messageId: string;
}

// Connection info
export interface ConnectionInfo {
  id: string;
  deviceId: string;
  state: ConnectionState;
  type: ConnectionType;
  quality: ConnectionQuality;
  statistics: ConnectionStatistics;
  createdAt: Date;
  lastActivity: Date;
}

// Connection quality metrics
export interface ConnectionQuality {
  latency: number; // ms
  bandwidth: number; // bps
  packetLoss: number; // percentage
  jitter: number; // ms
  quality: 'poor' | 'fair' | 'good' | 'excellent';
}

// Connection statistics
export interface ConnectionStatistics {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  packetsLost: number;
  connectionDuration: number;
  averageLatency: number;
  peakBandwidth: number;
}

// Network conditions
export interface NetworkConditions {
  bandwidth: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  connectionType: 'wifi' | 'ethernet' | 'cellular' | 'unknown';
  isStable: boolean;
}

// Data channel configuration
export interface DataChannelConfig {
  label: string;
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
  negotiated?: boolean;
  id?: number;
}

// Network events
export interface NetworkEvent {
  type: string;
  connectionId?: string;
  deviceId?: string;
  data?: any;
  error?: Error;
  timestamp: Date;
}

// Discovery result
export interface DiscoveryResult {
  deviceId: string;
  deviceInfo: {
    name: string;
    type: string;
    capabilities: string[];
    ip: string;
    port: number;
  };
  signal: {
    strength: number;
    latency: number;
  };
  discovered: Date;
}

// Connection options
export interface ConnectionOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableReconnect?: boolean;
  dataChannels?: DataChannelConfig[];
  iceServers?: RTCIceServer[];
  offer?: RTCSessionDescriptionInit;
  bandwidth?: {
    video?: number;
    audio?: number;
    data?: number;
  };
}

// Bandwidth measurement result
export interface BandwidthMeasurement {
  download: number; // bps
  upload: number; // bps
  latency: number; // ms
  jitter: number; // ms
  timestamp: Date;
  duration: number; // ms
}

// Quality settings for adaptive streaming
export interface QualitySettings {
  video: {
    fps: number;
    bitrate: number;
    resolution: {
      width: number;
      height: number;
    };
  };
  audio: {
    bitrate: number;
    sampleRate: number;
    channels: number;
  };
  adaptiveBitrate: boolean;
  maxBitrate: number;
  minBitrate: number;
}

// Peer connection wrapper
export interface PeerConnectionWrapper {
  id: string;
  deviceId: string;
  connection: RTCPeerConnection;
  dataChannels: Map<string, RTCDataChannel>;
  state: ConnectionState;
  statistics: ConnectionStatistics;
  lastActivity: Date;
}

// Network error types
export class NetworkError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
    this.details = details;
  }
}

// Connection request/response
export interface ConnectionRequest {
  requestId: string;
  from: string;
  to: string;
  options?: ConnectionOptions;
  timestamp: Date;
}

export interface ConnectionResponse {
  requestId: string;
  accepted: boolean;
  from: string;
  to: string;
  error?: string;
  answer?: RTCSessionDescriptionInit;
  timestamp: Date;
}

// Relay server configuration
export interface RelayServerConfig {
  id: string;
  url: string;
  region: string;
  capacity: number;
  currentLoad: number;
  latency: number;
  isActive: boolean;
}

// TURN server configuration
export interface TurnServerConfig {  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password' | 'oauth';
}

// Network adapter interface
export interface NetworkAdapter {
  name: string;
  description: string;
  type: 'ethernet' | 'wifi' | 'cellular' | 'vpn' | 'loopback';
  isActive: boolean;
  addresses: {
    ipv4?: string;
    ipv6?: string;
    mac?: string;
  };
  statistics: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
}

// Network monitor result
export interface NetworkMonitorResult {
  adapters: NetworkAdapter[];
  defaultGateway: string;
  dnsServers: string[];
  publicIp?: string;
  bandwidth: BandwidthMeasurement;
  timestamp: Date;
}

// Validation schemas
export const ConnectionOptionsSchema = z.object({
  timeout: z.number().int().positive().optional(),
  retryAttempts: z.number().int().nonnegative().optional(),
  retryDelay: z.number().int().positive().optional(),
  enableReconnect: z.boolean().optional(),
  dataChannels: z.array(z.object({
    label: z.string(),
    ordered: z.boolean().optional(),
    maxPacketLifeTime: z.number().int().positive().optional(),
    maxRetransmits: z.number().int().nonnegative().optional(),
    protocol: z.string().optional(),
    negotiated: z.boolean().optional(),
    id: z.number().int().nonnegative().optional()
  })).optional(),
  iceServers: z.array(z.any()).optional(),
  bandwidth: z.object({
    video: z.number().int().positive().optional(),
    audio: z.number().int().positive().optional(),
    data: z.number().int().positive().optional()
  }).optional()
});

export const SignalingMessageSchema = z.object({
  type: z.enum(['offer', 'answer', 'ice-candidate', 'device-discovery', 'device-response', 'connection-request', 'connection-response', 'connection-close', 'heartbeat', 'error']),
  from: z.string(),
  to: z.string(),
  data: z.any(),
  timestamp: z.date(),
  messageId: z.string()
});

export const QualitySettingsSchema = z.object({
  video: z.object({
    fps: z.number().int().min(15).max(60),
    bitrate: z.number().int().positive(),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    })
  }),
  audio: z.object({
    bitrate: z.number().int().positive(),
    sampleRate: z.number().int().positive(),
    channels: z.number().int().min(1).max(8)
  }),
  adaptiveBitrate: z.boolean(),
  maxBitrate: z.number().int().positive(),
  minBitrate: z.number().int().positive()
});

/**
 * Configuration for SignalingClient
 */
export interface SignalingConfig {
  /**
   * URL of the signaling server
   */
  serverUrl: string;
  
  /**
   * Unique identifier for this device
   */
  deviceId: string;
}
