// Jest setup file for network package tests
import { jest } from '@jest/globals';

// Mock the shared Logger class FIRST before any other imports
// This must be at the very top to ensure it's hoisted before module loading
export const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  setLevel: jest.fn(),
  getLevel: jest.fn(),
};

// Make sure this is accessible globally for tests
(global as any).__mockLogger = mockLoggerInstance;

// Make sure the Logger mock is properly initialized
jest.mock('@ekd-desk/shared', () => {
  return {
    Logger: {
      createLogger: jest.fn(() => mockLoggerInstance),
      getInstance: jest.fn(() => mockLoggerInstance),
    },
    // If @ekd-desk/shared exports other things, mock them as needed or use jest.requireActual
  };
});

// Also ensure that any Logger that might have been created before the mock was set up
// will be properly initialized during tests
jest.spyOn(console, 'error').mockImplementation((...args) => {
  // Still log actual errors to the console for debugging
  process.stderr.write(args.join(' ') + '\n');
});

// Increase max listeners to prevent EventEmitter warnings
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 100;
process.setMaxListeners(100);

// Suppress console output during tests to reduce noise
const originalConsole = console;
beforeAll(() => {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error, // Keep errors visible
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Enhanced performance API mock
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now()
    }
  }
});

// Mock RTCDataChannel - using simple object approach
const createMockDataChannel = (label: string, options: any = {}) => {
  const mockChannel = {
    label,
    readyState: 'open',
    binaryType: 'arraybuffer',
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    maxPacketLifeTime: options.maxPacketLifeTime || null,
    maxRetransmits: options.maxRetransmits || null,
    negotiated: options.negotiated || false,
    ordered: options.ordered !== false,
    protocol: options.protocol || '',
    id: options.id || 1,
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
  return mockChannel;
};

// Mock RTCPeerConnection - using constructor function approach
function MockRTCPeerConnection(config?: any) {  const connection = {
    localDescription: null as any,
    remoteDescription: null as any,
    connectionState: 'new',
    iceConnectionState: 'new',
    iceGatheringState: 'new',
    signalingState: 'stable',
    canTrickleIceCandidates: true,
    
    // Event handlers
    onconnectionstatechange: null,
    onicecandidate: null,
    ondatachannel: null,
    onicegatheringstatechange: null,
    oniceconnectionstatechange: null,
    
    // Methods
    createOffer: jest.fn(() => Promise.resolve({
      type: 'offer',
      sdp: 'mock-offer-sdp'
    })),
    
    createAnswer: jest.fn(() => Promise.resolve({
      type: 'answer', 
      sdp: 'mock-answer-sdp'
    })),
    
    setLocalDescription: jest.fn((desc) => {
      connection.localDescription = desc;
      return Promise.resolve();
    }),
    
    setRemoteDescription: jest.fn((desc) => {
      connection.remoteDescription = desc;
      return Promise.resolve();
    }),
    
    addIceCandidate: jest.fn(() => Promise.resolve()),
    getStats: jest.fn(() => Promise.resolve(new Map())),
    close: jest.fn(),
    
    createDataChannel: jest.fn((label: string, options: any = {}) => {
      return createMockDataChannel(label, options);
    }),
    
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
  
  return connection;
}

// Set global WebRTC APIs
(global as any).RTCPeerConnection = MockRTCPeerConnection;
(global as any).RTCDataChannel = createMockDataChannel;

// Other WebRTC globals
(global as any).RTCSessionDescription = jest.fn((init: any) => ({
  type: init?.type || 'offer',
  sdp: init?.sdp || 'mock-sdp'
}));

(global as any).RTCIceCandidate = jest.fn((init: any) => ({
  candidate: init?.candidate || 'mock-candidate',
  sdpMLineIndex: init?.sdpMLineIndex || 0,
  sdpMid: init?.sdpMid || '0'
}));

// Socket.IO mock - create a configurable mock
const createMockSocket = () => ({
  connected: false,
  id: 'mock-socket-id',
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  listeners: jest.fn(() => []),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
});

// Mock the socket.io-client module
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => createMockSocket()),
  Socket: jest.fn(() => createMockSocket())
}));

// Reset all mocks between tests for clean state
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});
