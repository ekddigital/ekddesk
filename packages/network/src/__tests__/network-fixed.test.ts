import { WebRTCManager } from '../webrtc-manager';
import { SignalingClient } from '../signaling-client';
import { ConnectionManager } from '../connection-manager';
import { NetworkOptimizer } from '../network-optimizer';
import { NetworkError } from '../types';
import { io } from 'socket.io-client';

// Get the mocked socket from the jest mock
const mockedIo = jest.mocked(io);
let mockSocket: any;

// Mock WebRTC APIs
const mockRTCPeerConnection = {
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  setLocalDescription: jest.fn(),
  setRemoteDescription: jest.fn(),
  addIceCandidate: jest.fn(),
  createDataChannel: jest.fn(),
  close: jest.fn(),
  getStats: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  iceGatheringState: 'new',
  onconnectionstatechange: null,
  onicecandidate: null,
  ondatachannel: null,
  oniceconnectionstatechange: null,
  onicegatheringstatechange: null
};

const mockDataChannel = {
  label: 'test',
  readyState: 'open',
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
} as any;

// Setup global mocks
(global as any).RTCPeerConnection = jest.fn(() => mockRTCPeerConnection);

describe('Network Package', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the mock socket
    mockSocket = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
      connected: false,
      id: 'mock-socket-id',
      close: jest.fn()
    };
    
    // Configure the io mock to return our mock socket
    mockedIo.mockReturnValue(mockSocket);
    
    mockRTCPeerConnection.createOffer.mockResolvedValue({
      type: 'offer',
      sdp: 'mock-offer-sdp'
    });
    mockRTCPeerConnection.createAnswer.mockResolvedValue({
      type: 'answer',
      sdp: 'mock-answer-sdp'
    });
    mockRTCPeerConnection.createDataChannel.mockReturnValue(mockDataChannel);
    mockRTCPeerConnection.getStats.mockResolvedValue(new Map());
  });

  describe('WebRTCManager', () => {
    let webrtcManager: WebRTCManager;

    beforeEach(() => {
      webrtcManager = new WebRTCManager();
    });

    afterEach(() => {
      webrtcManager.destroy();
    });

    describe('Connection Management', () => {
      test('should create peer connection', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        
        expect(connectionId).toBeDefined();
        expect(typeof connectionId).toBe('string');
        expect(RTCPeerConnection).toHaveBeenCalled();
      });

      test('should create offer', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const offer = await webrtcManager.createOffer(connectionId);
        
        expect(offer).toEqual({
          type: 'offer',
          sdp: 'mock-offer-sdp'
        });
        expect(mockRTCPeerConnection.createOffer).toHaveBeenCalled();
        expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(offer);
      });

      test('should create answer', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const answer = await webrtcManager.createAnswer(connectionId);
        
        expect(answer).toEqual({
          type: 'answer',
          sdp: 'mock-answer-sdp'
        });
        expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
        expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalledWith(answer);
      });

      test('should set remote description', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const description = { type: 'offer' as const, sdp: 'test-sdp' };
        
        await webrtcManager.setRemoteDescription(connectionId, description);
        expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(description);
      });

      test('should add ICE candidate', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const candidate = { candidate: 'test-candidate', sdpMid: 'test', sdpMLineIndex: 0 };
        
        await webrtcManager.addIceCandidate(connectionId, candidate);
        expect(mockRTCPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
      });

      test('should throw error for invalid connection', async () => {
        await expect(webrtcManager.createOffer('invalid-id')).rejects.toThrow(NetworkError);
      });
    });

    describe('Data Channels', () => {
      test('should create data channel', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const channelLabel = await webrtcManager.createDataChannel(connectionId, {
          label: 'test-channel',
          ordered: true
        });
        
        expect(channelLabel).toBe('test-channel');
        expect(mockRTCPeerConnection.createDataChannel).toHaveBeenCalledWith('test-channel', {
          ordered: true,
          maxPacketLifeTime: undefined,
          maxRetransmits: undefined,
          protocol: undefined,
          negotiated: undefined,
          id: undefined
        });
      });

      test('should send data through channel', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        await webrtcManager.createDataChannel(connectionId, { label: 'test-channel' });
        
        const testData = 'test message';
        await webrtcManager.sendData(connectionId, 'test-channel', testData);
        
        expect(mockDataChannel.send).toHaveBeenCalledWith(testData);
      });

      test('should throw error for non-existent channel', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        
        await expect(webrtcManager.sendData(connectionId, 'non-existent', 'data'))
          .rejects.toThrow(NetworkError);
      });
    });

    describe('Connection Statistics', () => {
      test('should get connection statistics', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        const stats = webrtcManager.getConnectionStatistics(connectionId);
        
        expect(stats).toMatchObject({
          bytesReceived: 0,
          bytesSent: 0,
          packetsReceived: 0,
          packetsSent: 0,
          packetsLost: 0,
          connectionDuration: 0,
          averageLatency: 0,
          peakBandwidth: 0
        });
      });

      test('should return null for invalid connection', () => {
        const stats = webrtcManager.getConnectionStatistics('invalid-id');
        expect(stats).toBeNull();
      });
    });

    describe('Connection Lifecycle', () => {
      test('should close connection', async () => {
        const connectionId = await webrtcManager.createPeerConnection('device-123');
        await webrtcManager.createDataChannel(connectionId, { label: 'test-channel' });
        
        await webrtcManager.closeConnection(connectionId);
        
        expect(mockDataChannel.close).toHaveBeenCalled();
        expect(mockRTCPeerConnection.close).toHaveBeenCalled();
      });

      test('should handle closing non-existent connection gracefully', async () => {
        await expect(webrtcManager.closeConnection('non-existent')).resolves.not.toThrow();
      });
    });
  });

  describe('SignalingClient', () => {
    let signalingClient: SignalingClient;    beforeEach(() => {
      signalingClient = new SignalingClient({
        serverUrl: 'ws://localhost:3002',
        deviceId: 'device-123'
      });
      mockSocket.connected = false;
    });

    afterEach(() => {
      signalingClient.destroy();
    });

    describe('Connection Management', () => {
      test('should connect to signaling server', async () => {
        const connectPromise = signalingClient.connect();
        
        // Simulate successful connection immediately
        process.nextTick(() => {
          mockSocket.connected = true;
          const connectHandler = mockSocket.once.mock.calls.find(call => call[0] === 'connect');
          if (connectHandler) {
            connectHandler[1]();
          }
        });
        
        await expect(connectPromise).resolves.not.toThrow();
        expect(mockedIo).toHaveBeenCalled();
      });

      test('should handle connection timeout', async () => {
        const connectPromise = signalingClient.connect({ timeout: 100 });
        
        // Don't simulate connection to trigger timeout
        await expect(connectPromise).rejects.toThrow(NetworkError);
      });

      test('should disconnect from server', async () => {
        // First connect
        mockSocket.connected = true;
        
        // Now disconnect
        signalingClient.disconnect();
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
    });

    describe('Device Discovery', () => {
      test('should discover devices', async () => {
        mockSocket.connected = true;
        
        const discoveryPromise = signalingClient.discoverDevices(1000);
        
        // Simulate discovery response
        setTimeout(() => {
          const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'signaling-message');
          if (messageHandler) {
            messageHandler[1]({
              type: 'device-response',
              from: 'device-456',
              data: {
                name: 'Test Device',
                type: 'desktop',
                capabilities: ['screen-capture']
              }
            });
          }
        }, 100);
        
        const results = await discoveryPromise;
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('Connection Requests', () => {
      test('should send connection request', async () => {
        mockSocket.connected = true;
        
        const requestPromise = signalingClient.requestConnection('device-456');
        
        // Simulate acceptance response immediately
        process.nextTick(() => {
          const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'signaling-message');
          if (messageHandler) {
            const requestCall = mockSocket.emit.mock.calls.find(call => call[0] === 'signaling-message');
            const requestId = requestCall?.[1]?.data?.requestId || 'test-request-id';
            
            messageHandler[1]({
              type: 'connection-response',
              from: 'device-456',
              data: {
                requestId,
                accepted: true
              }
            });
          }
        });
        
        const response = await requestPromise;
        expect(response.accepted).toBe(true);
      }, 5000);

      test('should handle connection rejection', async () => {
        mockSocket.connected = true;
        
        const requestPromise = signalingClient.requestConnection('device-456');
        
        // Simulate rejection response immediately
        process.nextTick(() => {
          const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'signaling-message');
          if (messageHandler) {
            const requestCall = mockSocket.emit.mock.calls.find(call => call[0] === 'signaling-message');
            const requestId = requestCall?.[1]?.data?.requestId || 'test-request-id';
            
            messageHandler[1]({
              type: 'connection-response',
              from: 'device-456',
              data: {
                requestId,
                accepted: false,
                error: 'Connection rejected'
              }
            });
          }
        });
        
        await expect(requestPromise).rejects.toThrow(NetworkError);
      }, 5000);
    });
  });

  describe('NetworkOptimizer', () => {
    let networkOptimizer: NetworkOptimizer;

    beforeEach(() => {
      networkOptimizer = new NetworkOptimizer();
    });

    afterEach(() => {
      networkOptimizer.destroy();
    });

    describe('Bandwidth Measurement', () => {
      test('should measure bandwidth', async () => {
        const measurement = await networkOptimizer.measureBandwidth();
        
        expect(measurement).toMatchObject({
          download: expect.any(Number),
          upload: expect.any(Number),
          latency: expect.any(Number),
          jitter: expect.any(Number),
          timestamp: expect.any(Date),
          duration: expect.any(Number)
        });
      });

      test('should maintain bandwidth history', async () => {
        await networkOptimizer.measureBandwidth();
        await networkOptimizer.measureBandwidth();
        
        const history = networkOptimizer.getBandwidthHistory();
        expect(history).toHaveLength(2);
      });

      test('should calculate average bandwidth', async () => {
        await networkOptimizer.measureBandwidth();
        await networkOptimizer.measureBandwidth();
        
        const average = networkOptimizer.getAverageBandwidth();
        expect(average).toMatchObject({
          download: expect.any(Number),
          upload: expect.any(Number),
          latency: expect.any(Number)
        });
      });
    });

    describe('Quality Adaptation', () => {
      test('should adapt quality based on conditions', () => {
        const conditions = {
          bandwidth: 1000000, // 1 Mbps
          latency: 150,
          packetLoss: 2,
          jitter: 20,
          connectionType: 'wifi' as const,
          isStable: false
        };
        
        const settings = networkOptimizer.adaptQuality(conditions);
        
        expect(settings.video.bitrate).toBeLessThan(2000000); // Should be reduced
        expect(settings.video.fps).toBeLessThanOrEqual(30);
      });

      test('should handle congestion', () => {
        const settings = networkOptimizer.handleCongestion();
        
        expect(settings.video.fps).toBeLessThanOrEqual(15);
        expect(settings.audio.channels).toBe(1); // Mono
      });

      test('should reset to defaults', () => {
        networkOptimizer.handleCongestion(); // Reduce quality
        networkOptimizer.resetToDefaults();
        
        const settings = networkOptimizer.getCurrentQualitySettings();
        expect(settings.video.fps).toBe(30);
        expect(settings.audio.channels).toBe(2);
      });
    });

    describe('Network Monitoring', () => {
      test('should monitor network conditions', async () => {
        const conditions = await networkOptimizer.measureNetworkConditions();
        
        expect(conditions).toMatchObject({
          bandwidth: expect.any(Number),
          latency: expect.any(Number),
          packetLoss: expect.any(Number),
          jitter: expect.any(Number),
          connectionType: expect.any(String),
          isStable: expect.any(Boolean)
        });
      });

      test('should provide network monitor result', async () => {
        const result = await networkOptimizer.monitorNetwork();
        
        expect(result).toMatchObject({
          adapters: expect.any(Array),
          defaultGateway: expect.any(String),
          dnsServers: expect.any(Array),
          bandwidth: expect.any(Object),
          timestamp: expect.any(Date)
        });
      });
    });
  });

  describe('ConnectionManager', () => {
    let connectionManager: ConnectionManager;
    let mockSignalingClient: jest.Mocked<SignalingClient>;
    let mockWebRTCManager: jest.Mocked<WebRTCManager>;

    beforeEach(() => {
      connectionManager = new ConnectionManager('device-123', 'ws://localhost:3002');
      
      // Get the internal instances for mocking
      mockSignalingClient = (connectionManager as any).signalingClient;
      mockWebRTCManager = (connectionManager as any).webrtcManager;
    });

    afterEach(() => {
      connectionManager.destroy();
    });

    describe('Connection Initialization', () => {
      test('should initialize connection', async () => {
        mockSignalingClient.isConnectedToServer = jest.fn().mockReturnValue(true);
        mockWebRTCManager.createPeerConnection = jest.fn().mockResolvedValue('conn-123');
        mockWebRTCManager.createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'test' });
        mockSignalingClient.requestConnection = jest.fn().mockResolvedValue({
          accepted: true,
          requestId: 'req-123',
          from: 'device-123',
          to: 'device-456',
          timestamp: new Date()
        });

        const connection = await connectionManager.initializeConnection('device-456');
        
        expect(connection).toMatchObject({
          deviceId: 'device-456',
          state: 'connecting',
          type: 'direct'
        });
        expect(mockWebRTCManager.createPeerConnection).toHaveBeenCalledWith('device-456', undefined, undefined);
      });

      test('should reuse existing connection', async () => {
        // Setup existing connection
        const existingConnection = {
          id: 'conn-123',
          deviceId: 'device-456',
          state: 'connected' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-123', existingConnection);
        
        const connection = await connectionManager.initializeConnection('device-456');
        expect(connection).toEqual(existingConnection);
      });
    });

    describe('Connection Management', () => {
      test('should get connection by ID', () => {
        const testConnection = {
          id: 'conn-123',
          deviceId: 'device-456',
          state: 'connected' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-123', testConnection);
        
        const connection = connectionManager.getConnection('conn-123');
        expect(connection).toEqual(testConnection);
      });

      test('should get connection by device ID', () => {
        const testConnection = {
          id: 'conn-123',
          deviceId: 'device-456',
          state: 'connected' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-123', testConnection);
        
        const connection = connectionManager.getConnectionByDeviceId('device-456');
        expect(connection).toEqual(testConnection);
      });

      test('should get connections by state', () => {
        const connection1 = {
          id: 'conn-1',
          deviceId: 'device-1',
          state: 'connected' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        const connection2 = {
          id: 'conn-2',
          deviceId: 'device-2',
          state: 'connecting' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-1', connection1);
        (connectionManager as any).connections.set('conn-2', connection2);
        
        const connectedConnections = connectionManager.getConnectionsByState('connected');
        expect(connectedConnections).toHaveLength(1);
        expect(connectedConnections[0]).toEqual(connection1);
      });
    });

    describe('Device Discovery', () => {
      test('should discover devices', async () => {
        const mockResults = [
          {
            deviceId: 'device-456',
            deviceInfo: {
              name: 'Test Device',
              type: 'desktop',
              capabilities: ['screen-capture'],
              ip: '192.168.1.100',
              port: 3001
            },
            signal: {
              strength: 85,
              latency: 50
            },
            discovered: new Date()
          }
        ];
        
        mockSignalingClient.isConnectedToServer = jest.fn().mockReturnValue(true);
        mockSignalingClient.discoverDevices = jest.fn().mockResolvedValue(mockResults);
        
        const results = await connectionManager.discoverDevices();
        expect(results).toEqual(mockResults);
        expect(mockSignalingClient.discoverDevices).toHaveBeenCalledWith(5000);
      });
    });

    describe('Data Transmission', () => {
      test('should send data through connection', async () => {
        const testConnection = {
          id: 'conn-123',
          deviceId: 'device-456',
          state: 'connected' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-123', testConnection);
        mockWebRTCManager.sendData = jest.fn().mockResolvedValue(undefined);
        
        await connectionManager.sendData('device-456', 'test-channel', 'test data');
        
        expect(mockWebRTCManager.sendData).toHaveBeenCalledWith('conn-123', 'test-channel', 'test data');
      });

      test('should throw error for non-existent connection', async () => {
        await expect(connectionManager.sendData('non-existent', 'test-channel', 'data'))
          .rejects.toThrow(NetworkError);
      });

      test('should throw error for non-ready connection', async () => {
        const testConnection = {
          id: 'conn-123',
          deviceId: 'device-456',
          state: 'connecting' as const,
          type: 'direct' as const,
          quality: expect.any(Object),
          statistics: expect.any(Object),
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        (connectionManager as any).connections.set('conn-123', testConnection);
        
        await expect(connectionManager.sendData('device-456', 'test-channel', 'data'))
          .rejects.toThrow(NetworkError);
      });
    });
  });

  describe('Error Handling', () => {
    test('NetworkError should be properly constructed', () => {
      const error = new NetworkError('Test error', 'TEST_ERROR', { detail: 'test' });
      
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ detail: 'test' });
    });
  });

  describe('Integration Tests', () => {
    let connectionManager: ConnectionManager;
    let webrtcManager: WebRTCManager;
    let signalingClient: SignalingClient;
    let networkOptimizer: NetworkOptimizer;    beforeEach(() => {
      webrtcManager = new WebRTCManager();
      signalingClient = new SignalingClient({
        serverUrl: 'ws://localhost:3002',
        deviceId: 'device-123'
      });
      networkOptimizer = new NetworkOptimizer();
      connectionManager = new ConnectionManager('device-123', 'ws://localhost:3002');
    });

    afterEach(() => {
      connectionManager.destroy();
      webrtcManager.destroy();
      signalingClient.destroy();
      networkOptimizer.destroy();
    });

    test('should handle complete connection flow', async () => {
      // This would test the complete flow in a real integration test
      // For now, we'll just ensure all components can be created together
      expect(connectionManager).toBeInstanceOf(ConnectionManager);
      expect(webrtcManager).toBeInstanceOf(WebRTCManager);
      expect(signalingClient).toBeInstanceOf(SignalingClient);
      expect(networkOptimizer).toBeInstanceOf(NetworkOptimizer);
    });
  });
});
