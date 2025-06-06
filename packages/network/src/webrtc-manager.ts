import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@ekd-desk/shared';
import { 
  RTCConfig, 
  ConnectionState, 
  SignalingMessage, 
  PeerConnectionWrapper, 
  DataChannelConfig, 
  ConnectionStatistics,
  NetworkError,
  ConnectionOptions,
  ConnectionInfo
} from './types';

/**
 * WebRTC connection manager for EKD Desk
 * Handles peer-to-peer connections, data channels, and WebRTC lifecycle
 */
export class WebRTCManager extends EventEmitter {
  private logger: Logger;
  private connections: Map<string, PeerConnectionWrapper> = new Map();
  private defaultConfig: RTCConfig;
  private statisticsInterval: NodeJS.Timeout | null = null;
  constructor(config?: Partial<RTCConfig>) {
    super();    try {
      this.logger = Logger.createLogger('WebRTCManager');
    } catch (err) {
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
    
    this.defaultConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all',
      ...config
    };

    this.startStatisticsCollection();
  }

  /**
   * Create a new peer connection
   */
  async createPeerConnection(
    deviceId: string, 
    config?: RTCConfig,
    options?: ConnectionOptions
  ): Promise<string> {
    try {
      const connectionId = uuidv4();
      const rtcConfig = config || this.defaultConfig;

      const peerConnection = new RTCPeerConnection(rtcConfig);
      const wrapper: PeerConnectionWrapper = {
        id: connectionId,
        deviceId,
        connection: peerConnection,
        dataChannels: new Map(),
        state: 'disconnected',
        statistics: this.initializeStatistics(),
        lastActivity: new Date()
      };

      // Set up connection event handlers
      this.setupConnectionEventHandlers(wrapper);

      // Create default data channels if specified
      if (options?.dataChannels) {
        for (const channelConfig of options.dataChannels) {
          await this.createDataChannel(connectionId, channelConfig);
        }
      }

      this.connections.set(connectionId, wrapper);
      
      this.logger.info('Peer connection created', { 
        connectionId, 
        deviceId,
        iceServers: rtcConfig.iceServers?.length || 0
      });

      this.emit('connection:created', { connectionId, deviceId });
      
      return connectionId;
    } catch (error) {
      this.logger.error('Failed to create peer connection', error);
      throw new NetworkError('Failed to create peer connection', 'CONNECTION_CREATE_FAILED', { error });
    }
  }

  /**
   * Create an offer for connection
   */
  async createOffer(connectionId: string, options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    try {
      const wrapper = this.getConnection(connectionId);
      
      const offer = await wrapper.connection.createOffer(options);
      await wrapper.connection.setLocalDescription(offer);
      
      wrapper.lastActivity = new Date();
      this.updateConnectionState(wrapper, 'connecting');
      
      this.logger.debug('Offer created', { connectionId, type: offer.type });
      
      return offer;
    } catch (error) {
      this.logger.error('Failed to create offer', error);
      throw new NetworkError('Failed to create offer', 'OFFER_CREATE_FAILED', { connectionId, error });
    }
  }

  /**
   * Create an answer for connection
   */
  async createAnswer(connectionId: string, options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    try {
      const wrapper = this.getConnection(connectionId);
      
      const answer = await wrapper.connection.createAnswer(options);
      await wrapper.connection.setLocalDescription(answer);
      
      wrapper.lastActivity = new Date();
      this.updateConnectionState(wrapper, 'connecting');
      
      this.logger.debug('Answer created', { connectionId, type: answer.type });
      
      return answer;
    } catch (error) {
      this.logger.error('Failed to create answer', error);
      throw new NetworkError('Failed to create answer', 'ANSWER_CREATE_FAILED', { connectionId, error });
    }
  }

  /**
   * Set remote description
   */
  async setRemoteDescription(connectionId: string, description: RTCSessionDescriptionInit): Promise<void> {
    try {
      const wrapper = this.getConnection(connectionId);
      
      await wrapper.connection.setRemoteDescription(description);
      wrapper.lastActivity = new Date();
      
      this.logger.debug('Remote description set', { connectionId, type: description.type });
    } catch (error) {
      this.logger.error('Failed to set remote description', error);
      throw new NetworkError('Failed to set remote description', 'REMOTE_DESCRIPTION_FAILED', { connectionId, error });
    }
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(connectionId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const wrapper = this.getConnection(connectionId);
      
      await wrapper.connection.addIceCandidate(candidate);
      wrapper.lastActivity = new Date();
      
      this.logger.debug('ICE candidate added', { connectionId, candidate: candidate.candidate });
    } catch (error) {
      this.logger.error('Failed to add ICE candidate', error);
      throw new NetworkError('Failed to add ICE candidate', 'ICE_CANDIDATE_FAILED', { connectionId, error });
    }
  }

  /**
   * Create data channel
   */
  async createDataChannel(connectionId: string, config: DataChannelConfig): Promise<string> {
    try {
      const wrapper = this.getConnection(connectionId);
      
      const dataChannel = wrapper.connection.createDataChannel(config.label, {
        ordered: config.ordered,
        maxPacketLifeTime: config.maxPacketLifeTime,
        maxRetransmits: config.maxRetransmits,
        protocol: config.protocol,
        negotiated: config.negotiated,
        id: config.id
      });

      // Set up data channel event handlers
      this.setupDataChannelEventHandlers(dataChannel, connectionId);
      
      wrapper.dataChannels.set(config.label, dataChannel);
      wrapper.lastActivity = new Date();
      
      this.logger.info('Data channel created', { connectionId, label: config.label });
      
      this.emit('datachannel:created', { connectionId, label: config.label });
      
      return config.label;
    } catch (error) {
      this.logger.error('Failed to create data channel', error);
      throw new NetworkError('Failed to create data channel', 'DATACHANNEL_CREATE_FAILED', { connectionId, error });
    }
  }
  /**
   * Send data through data channel
   */
  async sendData(connectionId: string, channelLabel: string, data: string | ArrayBuffer | Blob): Promise<void> {
    try {
      const wrapper = this.getConnection(connectionId);
      const dataChannel = wrapper.dataChannels.get(channelLabel);
      
      if (!dataChannel) {
        throw new NetworkError('Data channel not found', 'DATACHANNEL_NOT_FOUND', { connectionId, channelLabel });
      }
      
      if (dataChannel.readyState !== 'open') {
        throw new NetworkError('Data channel not open', 'DATACHANNEL_NOT_OPEN', { 
          connectionId, 
          channelLabel, 
          state: dataChannel.readyState 
        });
      }
      
      // Convert data to appropriate format for data channel
      if (typeof data === 'string') {
        dataChannel.send(data);
      } else if (data instanceof ArrayBuffer) {
        dataChannel.send(data);
      } else if (data instanceof Blob) {
        // Convert Blob to ArrayBuffer for data channel
        const arrayBuffer = await data.arrayBuffer();
        dataChannel.send(arrayBuffer);
      } else {
        throw new NetworkError('Unsupported data type', 'UNSUPPORTED_DATA_TYPE', { connectionId, channelLabel });
      }
      
      wrapper.lastActivity = new Date();
      wrapper.statistics.bytesSent += this.getDataSize(data);
      wrapper.statistics.packetsSent++;
      
      this.logger.debug('Data sent through channel', { 
        connectionId, 
        channelLabel, 
        size: this.getDataSize(data) 
      });
    } catch (error) {
      this.logger.error('Failed to send data', error);
      throw new NetworkError('Failed to send data', 'DATA_SEND_FAILED', { connectionId, channelLabel, error });
    }
  }
  /**
   * Close connection
   */
  async closeConnection(connectionId: string): Promise<void> {
    try {
      const wrapper = this.connections.get(connectionId);
      if (!wrapper) {
        this.logger.warn('Connection not found for closing', { connectionId });
        return;
      }

      // Close all data channels safely
      for (const [label, channel] of wrapper.dataChannels) {
        try {
          if (channel.readyState !== 'closed') {
            channel.close();
          }
          this.logger.debug('Data channel closed', { connectionId, label });
        } catch (err) {
          this.logger.debug('Error closing data channel (expected during cleanup)', { connectionId, label, error: err });
        }
      }
      wrapper.dataChannels.clear();

      // Close peer connection safely
      try {
        if (wrapper.connection.connectionState !== 'closed') {
          wrapper.connection.close();
        }
        this.updateConnectionState(wrapper, 'closed');
      } catch (err) {
        this.logger.debug('Error closing peer connection (expected during cleanup)', { connectionId, error: err });
      }
      
      this.connections.delete(connectionId);
      
      this.logger.info('Connection closed', { connectionId, deviceId: wrapper.deviceId });
      
      this.emit('connection:closed', { connectionId, deviceId: wrapper.deviceId });
    } catch (error) {
      // Log error but don't throw during cleanup to avoid cascading failures
      this.logger.warn('Error during connection cleanup', { connectionId, error });
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo(connectionId: string): ConnectionInfo | null {
    const wrapper = this.connections.get(connectionId);
    if (!wrapper) return null;

    return {
      id: wrapper.id,
      deviceId: wrapper.deviceId,
      state: wrapper.state,
      type: 'direct', // Will be enhanced with actual connection type detection
      quality: this.calculateConnectionQuality(wrapper),
      statistics: { ...wrapper.statistics },
      createdAt: new Date(wrapper.lastActivity.getTime() - wrapper.statistics.connectionDuration),
      lastActivity: wrapper.lastActivity
    };
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.keys())
      .map(id => this.getConnectionInfo(id))
      .filter((info): info is ConnectionInfo => info !== null);
  }

  /**
   * Get connection statistics
   */
  getConnectionStatistics(connectionId: string): ConnectionStatistics | null {
    const wrapper = this.connections.get(connectionId);
    return wrapper ? { ...wrapper.statistics } : null;
  }

  /**
   * Update connection configuration
   */
  updateDefaultConfig(config: Partial<RTCConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.logger.info('Default WebRTC configuration updated');
  }

  /**
   * Cleanup and destroy manager
   */
  destroy(): void {
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
      this.statisticsInterval = null;
    }

    // Close all connections
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }

    this.removeAllListeners();
    this.logger.info('WebRTCManager destroyed');
  }

  // Private methods

  private getConnection(connectionId: string): PeerConnectionWrapper {
    const wrapper = this.connections.get(connectionId);
    if (!wrapper) {
      throw new NetworkError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }
    return wrapper;
  }

  private setupConnectionEventHandlers(wrapper: PeerConnectionWrapper): void {
    const { connection, id: connectionId, deviceId } = wrapper;

    connection.onconnectionstatechange = () => {
      const state = this.mapRTCConnectionState(connection.connectionState);
      this.updateConnectionState(wrapper, state);
      
      this.logger.debug('Connection state changed', { 
        connectionId, 
        state: connection.connectionState 
      });
      
      this.emit('connection:statechange', { connectionId, deviceId, state });
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('connection:icecandidate', { 
          connectionId, 
          deviceId, 
          candidate: event.candidate 
        });
      }
    };

    connection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.setupDataChannelEventHandlers(dataChannel, connectionId);
      wrapper.dataChannels.set(dataChannel.label, dataChannel);
      
      this.emit('datachannel:received', { 
        connectionId, 
        label: dataChannel.label 
      });
    };

    connection.onicegatheringstatechange = () => {
      this.logger.debug('ICE gathering state changed', {
        connectionId,
        state: connection.iceGatheringState
      });
    };

    connection.oniceconnectionstatechange = () => {
      this.logger.debug('ICE connection state changed', {
        connectionId,
        state: connection.iceConnectionState
      });
      
      if (connection.iceConnectionState === 'failed') {
        this.emit('connection:icefailed', { connectionId, deviceId });
      }
    };
  }

  private setupDataChannelEventHandlers(dataChannel: RTCDataChannel, connectionId: string): void {
    dataChannel.onopen = () => {
      this.logger.debug('Data channel opened', { 
        connectionId, 
        label: dataChannel.label 
      });
      
      this.emit('datachannel:open', { 
        connectionId, 
        label: dataChannel.label 
      });
    };

    dataChannel.onclose = () => {
      this.logger.debug('Data channel closed', { 
        connectionId, 
        label: dataChannel.label 
      });
      
      this.emit('datachannel:close', { 
        connectionId, 
        label: dataChannel.label 
      });
    };

    dataChannel.onmessage = (event) => {
      const wrapper = this.connections.get(connectionId);
      if (wrapper) {
        wrapper.lastActivity = new Date();
        wrapper.statistics.bytesReceived += this.getDataSize(event.data);
        wrapper.statistics.packetsReceived++;
      }
      
      this.emit('datachannel:message', { 
        connectionId, 
        label: dataChannel.label, 
        data: event.data 
      });
    };

    dataChannel.onerror = (error) => {
      this.logger.error('Data channel error', { 
        connectionId, 
        label: dataChannel.label, 
        error 
      });
      
      this.emit('datachannel:error', { 
        connectionId, 
        label: dataChannel.label, 
        error 
      });
    };
  }

  private updateConnectionState(wrapper: PeerConnectionWrapper, state: ConnectionState): void {
    const previousState = wrapper.state;
    wrapper.state = state;
    wrapper.lastActivity = new Date();

    if (previousState !== state) {
      this.logger.debug('Connection state updated', {
        connectionId: wrapper.id,
        previousState,
        newState: state
      });
    }
  }

  private mapRTCConnectionState(rtcState: RTCPeerConnectionState): ConnectionState {
    switch (rtcState) {
      case 'new':
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'reconnecting';
      case 'failed':
        return 'failed';
      case 'closed':
        return 'closed';
      default:
        return 'disconnected';
    }
  }

  private initializeStatistics(): ConnectionStatistics {
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      packetsLost: 0,
      connectionDuration: 0,
      averageLatency: 0,
      peakBandwidth: 0
    };
  }

  private calculateConnectionQuality(wrapper: PeerConnectionWrapper) {
    // Simplified quality calculation - would be enhanced with real metrics
    const { statistics } = wrapper;
    const packetLossRate = statistics.packetsLost / (statistics.packetsSent || 1);
    
    let quality: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
    if (packetLossRate < 0.01) quality = 'excellent';
    else if (packetLossRate < 0.05) quality = 'good';
    else if (packetLossRate < 0.1) quality = 'fair';

    return {
      latency: statistics.averageLatency,
      bandwidth: statistics.peakBandwidth,
      packetLoss: packetLossRate * 100,
      jitter: 0, // Would be calculated from real metrics
      quality
    };
  }

  private getDataSize(data: string | ArrayBuffer | Blob): number {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Blob) {
      return data.size;
    }
    return 0;
  }

  private startStatisticsCollection(): void {
    this.statisticsInterval = setInterval(() => {
      this.updateConnectionStatistics();
    }, 5000); // Update every 5 seconds
  }

  private async updateConnectionStatistics(): Promise<void> {
    for (const wrapper of this.connections.values()) {
      if (wrapper.state === 'connected') {
        try {
          const stats = await wrapper.connection.getStats();
          this.processRTCStats(wrapper, stats);
        } catch (error) {
          this.logger.debug('Failed to get connection statistics', { 
            connectionId: wrapper.id, 
            error 
          });
        }
      }
    }
  }

  private processRTCStats(wrapper: PeerConnectionWrapper, stats: RTCStatsReport): void {
    // Process WebRTC statistics and update wrapper.statistics
    // This is a simplified version - would be enhanced with detailed metric processing
    
    wrapper.statistics.connectionDuration = Date.now() - wrapper.lastActivity.getTime();
    
    for (const stat of stats.values()) {
      if (stat.type === 'inbound-rtp') {
        wrapper.statistics.bytesReceived = stat.bytesReceived || wrapper.statistics.bytesReceived;
        wrapper.statistics.packetsReceived = stat.packetsReceived || wrapper.statistics.packetsReceived;
        wrapper.statistics.packetsLost = stat.packetsLost || wrapper.statistics.packetsLost;
      } else if (stat.type === 'outbound-rtp') {
        wrapper.statistics.bytesSent = stat.bytesSent || wrapper.statistics.bytesSent;
        wrapper.statistics.packetsSent = stat.packetsSent || wrapper.statistics.packetsSent;
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        wrapper.statistics.averageLatency = stat.currentRoundTripTime || wrapper.statistics.averageLatency;
      }
    }
  }
}
