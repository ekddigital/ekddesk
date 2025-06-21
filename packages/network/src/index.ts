// Network Package Entry Point for EKD Desk
// Exports all network functionality for remote desktop connections

// Core managers
export { WebRTCManager } from './webrtc-manager';
export { SignalingClient } from './signaling-client';
export { ConnectionManager } from './connection-manager';
export { NetworkOptimizer } from './network-optimizer';

// Types and interfaces
export * from './types';

// Re-export commonly used types for convenience
export type {
  ConnectionState,
  ConnectionInfo,
  ConnectionOptions,
  NetworkConditions,
  QualitySettings,
  BandwidthMeasurement,
  SignalingMessage,
  DataChannelConfig,
  NetworkError,
  ConnectionRequest,
  ConnectionResponse,
  DiscoveryResult,
  NetworkAdapter,
  NetworkMonitorResult
} from './types';
