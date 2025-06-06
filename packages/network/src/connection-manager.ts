import { EventEmitter } from 'eventemitter3';
import { Logger } from '@ekd-desk/shared';
import { WebRTCManager } from './webrtc-manager';
import { SignalingClient } from './signaling-client';
import { NetworkOptimizer } from './network-optimizer';
import {
  ConnectionState,
  ConnectionInfo,
  ConnectionOptions,
  ConnectionRequest,
  ConnectionResponse,
  NetworkError,
  DiscoveryResult,
  QualitySettings,
  NetworkConditions
} from './types';

/**
 * Connection manager for EKD Desk
 * Orchestrates WebRTC connections, handles reconnections, and manages connection lifecycle
 */
export class ConnectionManager extends EventEmitter {
  private logger: Logger;
  private webrtcManager: WebRTCManager;
  private signalingClient: SignalingClient;
  private networkOptimizer: NetworkOptimizer;
  private connections: Map<string, ConnectionInfo> = new Map();
  private pendingConnections: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private deviceId: string;
  private isDestroyed: boolean = false;

  // Configuration
  private readonly maxReconnectAttempts: number = 3;
  private readonly reconnectDelay: number = 2000;
  private readonly connectionTimeout: number = 30000;
  private readonly heartbeatInterval: number = 30000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  constructor(
    deviceId: string,
    signalingServerUrl: string,
    options?: {
      maxReconnectAttempts?: number;
      reconnectDelay?: number;
      connectionTimeout?: number;
      heartbeatInterval?: number;
    }
  ) {
    super();
    this.deviceId = deviceId;
      try {
      this.logger = Logger.createLogger('ConnectionManager');
    } catch (error) {
      // Fallback for test environments
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        verbose: () => {},
        setLevel: () => {},
        setContext: () => {},
        logConnection: () => {},
        logSession: () => {},
        logAuth: () => {},
        logNetworkEvent: () => {},
        logMediaEvent: () => {},
        logPerformance: () => {},
        child: () => this.logger,
        stream: () => ({ write: () => {} })
      } as unknown as Logger;
    }

    // Apply options
    if (options) {
      this.maxReconnectAttempts = options.maxReconnectAttempts ?? this.maxReconnectAttempts;
      this.reconnectDelay = options.reconnectDelay ?? this.reconnectDelay;
      this.connectionTimeout = options.connectionTimeout ?? this.connectionTimeout;
      this.heartbeatInterval = options.heartbeatInterval ?? this.heartbeatInterval;
    }    // Initialize components
    this.webrtcManager = new WebRTCManager();
    this.signalingClient = new SignalingClient({
      serverUrl: signalingServerUrl,
      deviceId: deviceId
    });
    this.networkOptimizer = new NetworkOptimizer();

    this.setupEventHandlers();
    this.startHeartbeat();

    this.logger.info('ConnectionManager initialized', { deviceId });
  }

  /**
   * Initialize connection to a target device
   */
  async initializeConnection(
    targetDeviceId: string, 
    options?: ConnectionOptions
  ): Promise<ConnectionInfo> {
    if (this.isDestroyed) {
      throw new NetworkError('ConnectionManager is destroyed', 'MANAGER_DESTROYED');
    }

    try {
      this.logger.info('Initializing connection', { targetDeviceId });

      // Check if connection already exists
      const existingConnection = this.getConnectionByDeviceId(targetDeviceId);
      if (existingConnection && existingConnection.state === 'connected') {
        this.logger.info('Connection already exists', { targetDeviceId, connectionId: existingConnection.id });
        return existingConnection;
      }

      // Ensure signaling client is connected
      if (!this.signalingClient.isConnectedToServer()) {
        await this.signalingClient.connect();
      }

      // Create WebRTC peer connection
      const connectionId = await this.webrtcManager.createPeerConnection(targetDeviceId, undefined, options);
      
      // Create connection info
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        deviceId: targetDeviceId,
        state: 'connecting',
        type: 'direct',
        quality: {
          latency: 0,
          bandwidth: 0,
          packetLoss: 0,
          jitter: 0,
          quality: 'poor'
        },
        statistics: {
          bytesReceived: 0,
          bytesSent: 0,
          packetsReceived: 0,
          packetsSent: 0,
          packetsLost: 0,
          connectionDuration: 0,
          averageLatency: 0,
          peakBandwidth: 0
        },
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.connections.set(connectionId, connectionInfo);

      // Start connection process
      await this.performConnectionHandshake(connectionId, targetDeviceId, options);

      this.logger.info('Connection initialized successfully', { targetDeviceId, connectionId });
      this.emit('connection:initialized', connectionInfo);

      return connectionInfo;
    } catch (error) {
      this.logger.error('Failed to initialize connection', error);
      throw new NetworkError('Connection initialization failed', 'CONNECTION_INIT_FAILED', { targetDeviceId, error });
    }
  }

  /**
   * Handle connection loss and attempt recovery
   */
  async handleConnectionLoss(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || this.isDestroyed) {
      return;
    }

    this.logger.warn('Connection lost detected', { connectionId, deviceId: connection.deviceId });
    
    connection.state = 'reconnecting';
    connection.lastActivity = new Date();
    this.connections.set(connectionId, connection);

    this.emit('connection:lost', connection);

    // Attempt reconnection
    await this.attemptReconnection(connectionId);
  }

  /**
   * Attempt to reconnect a failed connection
   */
  async attemptReconnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection || this.isDestroyed) {
      return false;
    }

    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached', { connectionId, attempts });
      connection.state = 'failed';
      this.connections.set(connectionId, connection);
      this.emit('connection:failed', connection);
      return false;
    }

    this.reconnectAttempts.set(connectionId, attempts + 1);
    
    try {
      this.logger.info('Attempting reconnection', { 
        connectionId, 
        attempt: attempts + 1, 
        maxAttempts: this.maxReconnectAttempts 
      });

      // Delay before reconnection attempt
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * (attempts + 1)));

      // Close existing connection
      await this.webrtcManager.closeConnection(connectionId);

      // Create new connection
      const newConnectionId = await this.webrtcManager.createPeerConnection(connection.deviceId);
      
      // Update connection info
      connection.id = newConnectionId;
      connection.state = 'connecting';
      connection.lastActivity = new Date();
      
      // Remove old mapping and add new one
      this.connections.delete(connectionId);
      this.connections.set(newConnectionId, connection);

      // Perform handshake
      await this.performConnectionHandshake(newConnectionId, connection.deviceId);

      this.logger.info('Reconnection successful', { oldConnectionId: connectionId, newConnectionId });
      this.reconnectAttempts.delete(connectionId);
      this.emit('connection:reconnected', connection);

      return true;
    } catch (error) {
      this.logger.error('Reconnection attempt failed', error);
      
      // Schedule next attempt if not max attempts reached
      if (attempts + 1 < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnection(connectionId), this.reconnectDelay);
      } else {
        connection.state = 'failed';
        this.connections.set(connectionId, connection);
        this.emit('connection:failed', connection);
      }
      
      return false;
    }
  }

  /**
   * Close a connection
   */
  async closeConnection(connectionId: string, reason?: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn('Connection not found for closing', { connectionId });
      return;
    }

    try {
      this.logger.info('Closing connection', { connectionId, deviceId: connection.deviceId, reason });

      // Notify signaling server
      await this.signalingClient.closeConnection(connection.deviceId, reason);

      // Close WebRTC connection
      await this.webrtcManager.closeConnection(connectionId);

      // Update connection state
      connection.state = 'closed';
      connection.lastActivity = new Date();
      this.connections.set(connectionId, connection);

      // Clean up
      this.reconnectAttempts.delete(connectionId);
      
      // Remove from connections after a delay to allow event processing
      setTimeout(() => {
        this.connections.delete(connectionId);
      }, 1000);

      this.emit('connection:closed', { ...connection, reason });
      this.logger.info('Connection closed successfully', { connectionId, deviceId: connection.deviceId });
    } catch (error) {
      this.logger.error('Failed to close connection', error);
      throw new NetworkError('Connection close failed', 'CONNECTION_CLOSE_FAILED', { connectionId, error });
    }
  }

  /**
   * Discover available devices
   */
  async discoverDevices(timeout: number = 5000): Promise<DiscoveryResult[]> {
    try {
      this.logger.info('Starting device discovery', { timeout });
      
      if (!this.signalingClient.isConnectedToServer()) {
        await this.signalingClient.connect();
      }

      const results = await this.signalingClient.discoverDevices(timeout);
      
      this.logger.info('Device discovery completed', { deviceCount: results.length });
      this.emit('devices:discovered', results);
      
      return results;
    } catch (error) {
      this.logger.error('Device discovery failed', error);
      throw new NetworkError('Device discovery failed', 'DISCOVERY_FAILED', { error });
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ConnectionInfo | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * Get connection by device ID
   */
  getConnectionByDeviceId(deviceId: string): ConnectionInfo | null {
    for (const connection of this.connections.values()) {
      if (connection.deviceId === deviceId) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Get all active connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by state
   */
  getConnectionsByState(state: ConnectionState): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => conn.state === state);
  }

  /**
   * Update connection quality settings
   */
  async updateQualitySettings(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      // Measure current network conditions
      const conditions = await this.networkOptimizer.measureNetworkConditions();
      
      // Get adaptive quality settings
      const qualitySettings = this.networkOptimizer.adaptQuality(conditions);
      
      // Update connection info
      connection.quality = {
        latency: conditions.latency,
        bandwidth: conditions.bandwidth,
        packetLoss: conditions.packetLoss,
        jitter: conditions.jitter,
        quality: this.calculateQualityRating(conditions)
      };
      
      connection.lastActivity = new Date();
      this.connections.set(connectionId, connection);

      this.logger.debug('Quality settings updated', { connectionId, qualitySettings });
      this.emit('connection:quality-updated', { connectionId, quality: connection.quality });
    } catch (error) {
      this.logger.error('Failed to update quality settings', error);
    }
  }

  /**
   * Send data through connection
   */
  async sendData(deviceId: string, channelLabel: string, data: string | ArrayBuffer | Blob): Promise<void> {
    const connection = this.getConnectionByDeviceId(deviceId);
    if (!connection) {
      throw new NetworkError('Connection not found', 'CONNECTION_NOT_FOUND', { deviceId });
    }

    if (connection.state !== 'connected') {
      throw new NetworkError('Connection not ready', 'CONNECTION_NOT_READY', { 
        deviceId, 
        state: connection.state 
      });
    }

    await this.webrtcManager.sendData(connection.id, channelLabel, data);
    
    // Update activity
    connection.lastActivity = new Date();
    this.connections.set(connection.id, connection);
  }

  /**
   * Get connection statistics
   */
  getConnectionStatistics(connectionId: string): any {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    const webrtcStats = this.webrtcManager.getConnectionStatistics(connectionId);
    return {
      ...connection.statistics,
      ...webrtcStats,
      connectionDuration: Date.now() - connection.createdAt.getTime(),
      lastActivity: connection.lastActivity
    };
  }

  /**
   * Destroy connection manager
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.logger.info('Destroying ConnectionManager');
    this.isDestroyed = true;

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(id => 
      this.closeConnection(id, 'Manager destroyed').catch(err => 
        this.logger.error('Error closing connection during destroy', err)
      )
    );

    Promise.all(closePromises).finally(() => {
      // Clean up components
      this.webrtcManager.destroy();
      this.signalingClient.destroy();
      this.networkOptimizer.destroy();

      // Clear collections
      this.connections.clear();
      this.pendingConnections.clear();
      this.reconnectAttempts.clear();

      this.removeAllListeners();
      this.logger.info('ConnectionManager destroyed');
    });
  }

  // Private methods

  private setupEventHandlers(): void {
    // WebRTC Manager events
    this.webrtcManager.on('connection:statechange', (event) => {
      this.handleWebRTCStateChange(event);
    });

    this.webrtcManager.on('connection:icecandidate', (event) => {
      this.handleIceCandidate(event);
    });

    this.webrtcManager.on('datachannel:message', (event) => {
      this.emit('data:received', event);
    });

    this.webrtcManager.on('connection:icefailed', (event) => {
      this.handleConnectionLoss(event.connectionId);
    });

    // Signaling Client events
    this.signalingClient.on('connection-request', (request: ConnectionRequest) => {
      this.handleIncomingConnectionRequest(request);
    });

    this.signalingClient.on('signaling-message', (message) => {
      this.handleSignalingMessage(message);
    });

    this.signalingClient.on('disconnected', () => {
      this.handleSignalingDisconnect();
    });

    // Network Optimizer events
    this.networkOptimizer.on('conditions:changed', (conditions: NetworkConditions) => {
      this.handleNetworkConditionsChange(conditions);
    });
  }

  private async performConnectionHandshake(
    connectionId: string, 
    targetDeviceId: string, 
    options?: ConnectionOptions
  ): Promise<void> {
    try {
      // Create offer
      const offer = await this.webrtcManager.createOffer(connectionId);
      
      // Send connection request through signaling
      const response = await this.signalingClient.requestConnection(targetDeviceId, {
        offer,
        options
      });

      if (!response.accepted) {
        throw new NetworkError('Connection rejected', 'CONNECTION_REJECTED', { response });
      }

      // Set remote description (answer)
      if (response.answer) {
        await this.webrtcManager.setRemoteDescription(connectionId, response.answer);
      }

      this.logger.debug('Connection handshake completed', { connectionId, targetDeviceId });
    } catch (error) {
      this.logger.error('Connection handshake failed', error);
      throw error;
    }
  }

  private handleWebRTCStateChange(event: { connectionId: string; deviceId: string; state: ConnectionState }): void {
    const connection = this.connections.get(event.connectionId);
    if (!connection) {
      return;
    }

    const previousState = connection.state;
    connection.state = event.state;
    connection.lastActivity = new Date();
    this.connections.set(event.connectionId, connection);

    this.logger.debug('Connection state changed', {
      connectionId: event.connectionId,
      deviceId: event.deviceId,
      previousState,
      newState: event.state
    });

    this.emit('connection:statechange', { ...connection, previousState });

    // Handle state-specific logic
    if (event.state === 'connected') {
      this.reconnectAttempts.delete(event.connectionId);
      this.emit('connection:established', connection);
    } else if (event.state === 'failed' || event.state === 'disconnected') {
      this.handleConnectionLoss(event.connectionId);
    }
  }
  private async handleIceCandidate(event: { connectionId: string; deviceId: string; candidate: RTCIceCandidate }): Promise<void> {
    try {
      await this.signalingClient.sendMessage({
        type: 'ice-candidate',
        to: event.deviceId,
        data: {
          connectionId: event.connectionId,
          candidate: event.candidate
        }
      });
    } catch (error) {
      this.logger.error('Failed to send ICE candidate', error);
    }
  }

  private async handleIncomingConnectionRequest(request: ConnectionRequest): Promise<void> {
    try {
      this.logger.info('Incoming connection request', { from: request.from, requestId: request.requestId });

      // Create peer connection for incoming request
      const connectionId = await this.webrtcManager.createPeerConnection(request.from);
      
      // Set remote description (offer)
      if (request.options?.offer) {
        await this.webrtcManager.setRemoteDescription(connectionId, request.options.offer);
      }

      // Create answer
      const answer = await this.webrtcManager.createAnswer(connectionId);

      // Create connection info
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        deviceId: request.from,
        state: 'connecting',
        type: 'direct',
        quality: {
          latency: 0,
          bandwidth: 0,
          packetLoss: 0,
          jitter: 0,
          quality: 'poor'
        },
        statistics: {
          bytesReceived: 0,
          bytesSent: 0,
          packetsReceived: 0,
          packetsSent: 0,
          packetsLost: 0,
          connectionDuration: 0,
          averageLatency: 0,
          peakBandwidth: 0
        },
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.connections.set(connectionId, connectionInfo);      // Send response
      await this.signalingClient.respondToConnection(request, true, undefined, answer);

      this.emit('connection:incoming', { request, connectionInfo });
      this.logger.info('Incoming connection accepted', { from: request.from, connectionId });
    } catch (error) {
      this.logger.error('Failed to handle incoming connection', error);
      await this.signalingClient.respondToConnection(request, false, 'Connection setup failed');
    }
  }

  private async handleSignalingMessage(message: any): Promise<void> {
    try {
      if (message.type === 'ice-candidate' && message.data) {
        const { connectionId, candidate } = message.data;
        if (connectionId && candidate) {
          await this.webrtcManager.addIceCandidate(connectionId, candidate);
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle signaling message', error);
    }
  }

  private handleSignalingDisconnect(): void {
    this.logger.warn('Signaling server disconnected');
    
    // Mark all connections as reconnecting
    for (const connection of this.connections.values()) {
      if (connection.state === 'connected') {
        connection.state = 'reconnecting';
        this.connections.set(connection.id, connection);
        this.emit('connection:statechange', connection);
      }
    }
  }

  private handleNetworkConditionsChange(conditions: NetworkConditions): void {
    this.logger.debug('Network conditions changed', conditions);
    
    // Update quality for all active connections
    for (const [connectionId] of this.connections) {
      this.updateQualitySettings(connectionId);
    }
  }

  private calculateQualityRating(conditions: NetworkConditions): 'poor' | 'fair' | 'good' | 'excellent' {
    const { latency, packetLoss, bandwidth } = conditions;
    
    if (latency > 200 || packetLoss > 5 || bandwidth < 1000000) return 'poor';
    if (latency > 100 || packetLoss > 2 || bandwidth < 5000000) return 'fair';
    if (latency > 50 || packetLoss > 0.5 || bandwidth < 10000000) return 'good';
    return 'excellent';
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.heartbeatInterval);
  }

  private performHeartbeat(): void {
    const now = new Date();
    const timeoutThreshold = 60000; // 1 minute

    for (const [connectionId, connection] of this.connections) {
      if (connection.state === 'connected') {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
        
        if (timeSinceActivity > timeoutThreshold) {
          this.logger.warn('Connection timeout detected', { 
            connectionId, 
            deviceId: connection.deviceId, 
            timeSinceActivity 
          });
          this.handleConnectionLoss(connectionId);
        }
      }
    }
  }
}
