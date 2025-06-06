// Global constants for EKD Desk
export const APP_CONFIG = {
  NAME: 'EKD Desk',
  VERSION: '1.0.0',
  COMPANY: 'EKD Technologies',
  DESCRIPTION: 'Enterprise Remote Desktop Control Application'
} as const;

export const NETWORK_CONFIG = {
  DEFAULT_PORT: 3001,
  SIGNALING_PORT: 3002,
  DISCOVERY_PORT: 3003,
  MAX_CONNECTIONS: 100,
  HEARTBEAT_INTERVAL: 30000,
  CONNECTION_TIMEOUT: 10000,
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 2000
} as const;

export const MEDIA_CONFIG = {
  DEFAULT_FPS: 30,
  MIN_FPS: 15,
  MAX_FPS: 60,
  DEFAULT_QUALITY: 80,
  MIN_QUALITY: 30,
  MAX_QUALITY: 100,
  DEFAULT_BITRATE: 2000000, // 2 Mbps
  MIN_BITRATE: 500000,      // 500 Kbps
  MAX_BITRATE: 10000000     // 10 Mbps
} as const;

export const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 3600000,     // 1 hour
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900000,     // 15 minutes
  TOKEN_EXPIRY: 86400000,       // 24 hours
  REFRESH_TOKEN_EXPIRY: 2592000000, // 30 days
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH: 32,
  IV_LENGTH: 16
} as const;

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  VERBOSE: 'verbose'
} as const;

export const DEVICE_TYPES = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  WEB: 'web',
  SERVER: 'server'
} as const;

export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
} as const;

export const EVENTS = {
  // Device events
  DEVICE_CONNECTED: 'device:connected',
  DEVICE_DISCONNECTED: 'device:disconnected',
  DEVICE_DISCOVERED: 'device:discovered',
  DEVICE_STATUS_CHANGED: 'device:status-changed',
  
  // Session events
  SESSION_STARTED: 'session:started',
  SESSION_ENDED: 'session:ended',
  SESSION_PAUSED: 'session:paused',
  SESSION_RESUMED: 'session:resumed',
  
  // Network events
  NETWORK_CONNECTED: 'network:connected',
  NETWORK_DISCONNECTED: 'network:disconnected',
  NETWORK_ERROR: 'network:error',
  NETWORK_QUALITY_CHANGED: 'network:quality-changed',
  
  // Media events
  MEDIA_STREAM_STARTED: 'media:stream-started',
  MEDIA_STREAM_STOPPED: 'media:stream-stopped',
  MEDIA_QUALITY_CHANGED: 'media:quality-changed',
  
  // Security events
  AUTH_SUCCESS: 'auth:success',
  AUTH_FAILED: 'auth:failed',
  AUTH_EXPIRED: 'auth:expired',
  PERMISSION_DENIED: 'permission:denied'
} as const;
