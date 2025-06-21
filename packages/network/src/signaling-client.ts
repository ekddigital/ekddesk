import { EventEmitter } from 'eventemitter3';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@ekd-desk/shared';
import { 
  SignalingMessage, 
  SignalingMessageType, 
  NetworkError,
  ConnectionRequest,
  ConnectionResponse,
  DiscoveryResult,
  SignalingConfig
} from './types';

/**
 * Signaling client for EKD Desk
 * Handles WebRTC signaling, device discovery, and connection coordination
 */
export class SignalingClient extends EventEmitter {
  private logger: Logger;
  private socket: Socket | null = null;
  private deviceId: string;
  private serverUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: SignalingMessage[] = [];
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: SignalingConfig) {
    super();
    try {
      this.logger = Logger.createLogger('SignalingClient');
    } catch (err) {
      // Fallback if Logger is not properly initialized (especially during tests)
      this.logger = {
        debug: console.debug || (() => {}),
        info: console.info || (() => {}),
        warn: console.warn || (() => {}),
        error: console.error || (() => {}),
        setLevel: () => {}
      } as unknown as Logger;
    }
    
    // Ensure logger is always defined even if both initialization approaches fail
    if (!this.logger) {
      this.logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        setLevel: () => {}
      } as unknown as Logger;
    }
    
    this.serverUrl = config.serverUrl;
    this.deviceId = config.deviceId;
  }

  /**
   * Connect to signaling server
   */
  async connect(options?: { 
    timeout?: number; 
    auth?: any;
    transports?: string[];
  }): Promise<void> {
    try {
      if (this.socket?.connected) {
        this.logger.warn('Already connected to signaling server');
        return;
      }

      this.logger.info('Connecting to signaling server', { serverUrl: this.serverUrl });

      this.socket = io(this.serverUrl, {
        timeout: options?.timeout || 10000,
        auth: {
          deviceId: this.deviceId,
          ...options?.auth
        },
        transports: options?.transports || ['websocket', 'polling']
      });

      await this.setupSocketEventHandlers();
      
      return new Promise((resolve, reject) => {
        const connectTimeout = setTimeout(() => {
          reject(new NetworkError('Connection timeout', 'CONNECTION_TIMEOUT'));
        }, options?.timeout || 10000);

        this.socket!.once('connect', () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.processMessageQueue();
          
          this.logger.info('Connected to signaling server', { deviceId: this.deviceId });
          this.emit('connected');
          resolve();
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(connectTimeout);
          this.logger.error('Failed to connect to signaling server', error);
          reject(new NetworkError('Connection failed', 'CONNECTION_FAILED', { error }));
        });
      });
    } catch (error) {
      this.logger.error('Signaling client connection error', error);
      throw new NetworkError('Signaling connection failed', 'SIGNALING_CONNECTION_FAILED', { error });
    }
  }

  /**
   * Disconnect from signaling server
   */
  async disconnect(): Promise<void> {
    try {
      this.isConnected = false;
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Clear pending requests
      for (const [requestId, request] of this.pendingRequests) {
        clearTimeout(request.timeout);
        request.reject(new NetworkError('Disconnected', 'DISCONNECTED'));
      }
      this.pendingRequests.clear();

      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.logger.info('Disconnected from signaling server');
      this.emit('disconnected');
    } catch (error) {
      this.logger.error('Error during disconnect', error);
      throw new NetworkError('Disconnect failed', 'DISCONNECT_FAILED', { error });
    }
  }

  /**
   * Send signaling message
   */
  async sendMessage(message: Omit<SignalingMessage, 'from' | 'messageId' | 'timestamp'>): Promise<void> {
    const fullMessage: SignalingMessage = {
      ...message,
      from: this.deviceId,
      messageId: uuidv4(),
      timestamp: new Date()
    };

    if (!this.isConnected || !this.socket?.connected) {
      this.messageQueue.push(fullMessage);
      this.logger.debug('Message queued (not connected)', { type: message.type, to: message.to });
      return;
    }

    try {
      this.socket.emit('signaling-message', fullMessage);
      this.logger.debug('Signaling message sent', { 
        type: message.type, 
        to: message.to, 
        messageId: fullMessage.messageId 
      });
    } catch (error) {
      this.logger.error('Failed to send signaling message', error);
      throw new NetworkError('Message send failed', 'MESSAGE_SEND_FAILED', { error });
    }
  }

  /**
   * Send offer to target device
   */
  async sendOffer(targetDeviceId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendMessage({
      type: 'offer',
      to: targetDeviceId,
      data: offer
    });
  }

  /**
   * Send answer to target device
   */
  async sendAnswer(targetDeviceId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendMessage({
      type: 'answer',
      to: targetDeviceId,
      data: answer
    });
  }

  /**
   * Send ICE candidate to target device
   */
  async sendIceCandidate(targetDeviceId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.sendMessage({
      type: 'ice-candidate',
      to: targetDeviceId,
      data: candidate
    });
  }

  /**
   * Request connection to target device
   */
  async requestConnection(targetDeviceId: string, options?: any): Promise<ConnectionResponse> {
    const requestId = uuidv4();
    const request: ConnectionRequest = {
      requestId,
      from: this.deviceId,
      to: targetDeviceId,
      options,
      timestamp: new Date()
    };

    await this.sendMessage({
      type: 'connection-request',
      to: targetDeviceId,
      data: request
    });

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new NetworkError('Connection request timeout', 'REQUEST_TIMEOUT', { requestId }));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
    });
  }
  /**
   * Respond to connection request
   */
  async respondToConnection(request: ConnectionRequest, accepted: boolean, error?: string, answer?: RTCSessionDescriptionInit): Promise<void> {
    const response: ConnectionResponse = {
      requestId: request.requestId,
      accepted,
      from: this.deviceId,
      to: request.from,
      error,
      answer,
      timestamp: new Date()
    };

    await this.sendMessage({
      type: 'connection-response',
      to: request.from,
      data: response
    });
  }

  /**
   * Discover available devices
   */
  async discoverDevices(timeout: number = 5000): Promise<DiscoveryResult[]> {
    const discoveryId = uuidv4();
    const discoveredDevices: DiscoveryResult[] = [];

    // Send discovery request
    await this.sendMessage({
      type: 'device-discovery',
      to: 'broadcast',
      data: { discoveryId, requester: this.deviceId }
    });

    return new Promise((resolve) => {
      const discoveryTimeout = setTimeout(() => {
        this.off('device:discovered', discoveryHandler);
        resolve(discoveredDevices);
      }, timeout);

      const discoveryHandler = (result: DiscoveryResult) => {
        if (result.deviceId !== this.deviceId) {
          discoveredDevices.push(result);
        }
      };

      this.on('device:discovered', discoveryHandler);
    });
  }

  /**
   * Respond to device discovery
   */
  async respondToDiscovery(discoveryData: any): Promise<void> {
    const { discoveryId, requester } = discoveryData;
    
    if (requester === this.deviceId) return; // Don't respond to our own discovery

    const deviceInfo = {
      name: process.env.DEVICE_NAME || 'EKD Device',
      type: process.env.DEVICE_TYPE || 'desktop',
      capabilities: ['screen-capture', 'remote-control', 'file-transfer'],
      ip: '127.0.0.1', // Would be actual IP
      port: 3001
    };

    await this.sendMessage({
      type: 'device-response',
      to: requester,
      data: {
        discoveryId,
        deviceInfo,
        signal: {
          strength: 100,
          latency: 10
        }
      }
    });
  }

  /**
   * Close connection with device
   */
  async closeConnection(targetDeviceId: string, reason?: string): Promise<void> {
    await this.sendMessage({
      type: 'connection-close',
      to: targetDeviceId,
      data: { reason }
    });
  }

  /**
   * Get connection status
   */
  isConnectedToServer(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Update device ID
   */
  updateDeviceId(newDeviceId: string): void {
    this.deviceId = newDeviceId;
    if (this.socket?.connected) {
      this.socket.emit('update-device-id', { deviceId: newDeviceId });
    }
  }

  /**
   * Cleanup and destroy client
   */
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.messageQueue = [];
    this.logger.info('SignalingClient destroyed');
  }

  // Private methods

  private async setupSocketEventHandlers(): Promise<void> {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.logger.warn('Disconnected from signaling server', { reason });
      this.emit('disconnected', reason);
      
      if (reason !== 'io client disconnect') {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.logger.error('Connection error', error);
      this.emit('connection:error', error);
    });

    this.socket.on('signaling-message', (message: SignalingMessage) => {
      this.handleSignalingMessage(message);
    });

    this.socket.on('heartbeat', () => {
      this.logger.debug('Heartbeat received');
    });

    this.socket.on('error', (error) => {
      this.logger.error('Socket error', error);
      this.emit('error', error);
    });
  }

  private handleSignalingMessage(message: SignalingMessage): void {
    this.logger.debug('Signaling message received', { 
      type: message.type, 
      from: message.from,
      messageId: message.messageId
    });

    this.emit('message:received', message);

    switch (message.type) {
      case 'offer':
        this.emit('offer:received', {
          from: message.from,
          offer: message.data,
          messageId: message.messageId
        });
        break;

      case 'answer':
        this.emit('answer:received', {
          from: message.from,
          answer: message.data,
          messageId: message.messageId
        });
        break;

      case 'ice-candidate':
        this.emit('ice-candidate:received', {
          from: message.from,
          candidate: message.data,
          messageId: message.messageId
        });
        break;

      case 'connection-request':
        this.emit('connection:request', {
          from: message.from,
          request: message.data,
          messageId: message.messageId
        });
        break;

      case 'connection-response':
        this.handleConnectionResponse(message.data);
        break;

      case 'connection-close':
        this.emit('connection:close', {
          from: message.from,
          reason: message.data?.reason,
          messageId: message.messageId
        });
        break;

      case 'device-discovery':
        this.respondToDiscovery(message.data);
        break;

      case 'device-response':
        const discoveryResult: DiscoveryResult = {
          deviceId: message.from,
          deviceInfo: message.data.deviceInfo,
          signal: message.data.signal,
          discovered: new Date()
        };
        this.emit('device:discovered', discoveryResult);
        break;

      case 'error':
        this.emit('signaling:error', {
          from: message.from,
          error: message.data,
          messageId: message.messageId
        });
        break;

      default:
        this.logger.warn('Unknown signaling message type', { type: message.type });
    }
  }

  private handleConnectionResponse(response: ConnectionResponse): void {
    const pendingRequest = this.pendingRequests.get(response.requestId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(response.requestId);
      
      if (response.accepted) {
        pendingRequest.resolve(response);
      } else {
        pendingRequest.reject(new NetworkError(
          response.error || 'Connection rejected',
          'CONNECTION_REJECTED',
          { response }
        ));
      }
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('reconnect:failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    this.logger.info('Attempting to reconnect', { 
      attempt: this.reconnectAttempts, 
      delay 
    });

    setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch (error) {
        this.logger.error('Reconnection failed', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', { deviceId: this.deviceId, timestamp: new Date() });
      }
    }, 30000); // Every 30 seconds
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.socket?.connected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.socket.emit('signaling-message', message);
        this.logger.debug('Queued message sent', { type: message.type, to: message.to });
      }
    }
  }
}
