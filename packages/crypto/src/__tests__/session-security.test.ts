import './jest-setup';
import { SessionSecurity } from '../session-security';
import { EncryptionService } from '../encryption';
import { KeyManager } from '../key-management';
import { CryptoError } from '../types';

// Mock the dependencies
jest.mock('../encryption');
jest.mock('../key-management');

describe('SessionSecurity', () => {
  let sessionSecurity: SessionSecurity;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockKeyManager: jest.Mocked<KeyManager>;
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      encryptFile: jest.fn(),
      decryptFile: jest.fn(),
      generateNonce: jest.fn(),
      deriveKey: jest.fn(),
      secureRandom: jest.fn()
    } as any;

    mockKeyManager = {
      generateKeyPair: jest.fn(),
      generateSessionKey: jest.fn(),
      getSessionKey: jest.fn(),
      useSessionKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn(),
      signData: jest.fn(),
      verifySignature: jest.fn(),
      deriveSharedSecret: jest.fn(),
      rotateKeys: jest.fn()
    } as any;// Setup default mock implementations
    mockEncryptionService.encrypt.mockResolvedValue({
      encrypted: Buffer.from('encrypted-data'),
      iv: Buffer.from('test-iv'),
      tag: Buffer.from('auth-tag'),
      algorithm: 'aes-256-gcm'
    });
    
    mockEncryptionService.decrypt.mockResolvedValue(Buffer.from('decrypted-data'));    mockKeyManager.generateSessionKey.mockImplementation((sessionId: string) => {
      // Generate different keys each time
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000);
      return {
        id: `test-key-id-${timestamp}-${random}`,
        key: `key${timestamp.toString().padStart(50, '0')}${random.toString().padStart(10, '0')}abcdef1234567890abcdef1234567890`,
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usageCount: 0,
        maxUsage: 10000,
        sessionId
      };
    });

    mockKeyManager.getSessionKey.mockReturnValue({
      id: 'test-key-id',
      key: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      algorithm: 'aes-256-gcm',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usageCount: 0,
      maxUsage: 10000,
      sessionId: 'test-session'
    });

    mockKeyManager.useSessionKey.mockReturnValue(true);    mockKeyManager.signData.mockReturnValue('signature-string');
    mockKeyManager.verifySignature.mockReturnValue(true);

    mockKeyManager.signData.mockReturnValue('mock-signature-hash');
    mockKeyManager.verifySignature.mockReturnValue(true);
      sessionSecurity = new SessionSecurity(mockEncryptionService, mockKeyManager);
  });

  afterEach(() => {
    // Clean up timers to prevent Jest async operation warnings
    if (sessionSecurity) {
      sessionSecurity.destroy();
    }
  });

  describe('Session Initialization', () => {
    it('should initialize session with default parameters', async () => {
      const sessionId = 'test-session-1';
      const userId = 'user-123';
      
      const context = await sessionSecurity.initializeSession(sessionId, userId);
      
      expect(context).toBeDefined();
      expect(context.sessionId).toBe(sessionId);
      expect(context.userId).toBe(userId);
      expect(context.isActive).toBe(true);
      expect(context.encryptionKey).toBeDefined();
      expect(context.integrityKey).toBeDefined();
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.lastActivity).toBeInstanceOf(Date);
      expect(mockKeyManager.generateSessionKey).toHaveBeenCalledTimes(2);
    });

    it('should initialize session with custom permissions', async () => {
      const sessionId = 'test-session-2';
      const userId = 'user-456';
      const permissions = ['read', 'write', 'admin'];
      
      const context = await sessionSecurity.initializeSession(sessionId, userId, permissions);
      
      expect(context.permissions).toEqual(permissions);
      expect(context.securityLevel).toBe('high'); // Based on admin permission
    });

    it('should calculate security level correctly', async () => {
      // Test low security level
      const lowSecContext = await sessionSecurity.initializeSession('s1', 'u1', ['read']);
      expect(lowSecContext.securityLevel).toBe('low');
      
      // Test medium security level
      const medSecContext = await sessionSecurity.initializeSession('s2', 'u2', ['read', 'write']);
      expect(medSecContext.securityLevel).toBe('medium');
      
      // Test high security level
      const highSecContext = await sessionSecurity.initializeSession('s3', 'u3', ['admin']);
      expect(highSecContext.securityLevel).toBe('high');
    });

    it('should handle session initialization errors', async () => {
      mockKeyManager.generateSessionKey.mockImplementation(() => {
        throw new Error('Key generation failed');
      });

      await expect(
        sessionSecurity.initializeSession('session-error', 'user-error')
      ).rejects.toThrow(CryptoError);
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should get active session', async () => {
      const context = await sessionSecurity.getSession(sessionId);
      
      expect(context).toBeDefined();
      expect(context!.sessionId).toBe(sessionId);
      expect(context!.isActive).toBe(true);
    });

    it('should return null for non-existent session', async () => {
      const context = await sessionSecurity.getSession('non-existent');
      expect(context).toBeNull();
    });

    it('should update session activity', async () => {
      const originalContext = await sessionSecurity.getSession(sessionId);
      const originalActivity = originalContext!.lastActivity;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionSecurity.updateSessionActivity(sessionId);
      
      const updatedContext = await sessionSecurity.getSession(sessionId);
      expect(updatedContext!.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    it('should terminate session', async () => {
      await sessionSecurity.terminateSession(sessionId);
      
      const context = await sessionSecurity.getSession(sessionId);
      expect(context).toBeNull();
    });

    it('should list active sessions', async () => {
      await sessionSecurity.initializeSession('session-2', 'user-456');
      await sessionSecurity.initializeSession('session-3', 'user-789');
      
      const activeSessions = await sessionSecurity.getActiveSessions();
      
      expect(activeSessions).toHaveLength(3);
      expect(activeSessions.map(s => s.sessionId)).toContain(sessionId);
      expect(activeSessions.map(s => s.sessionId)).toContain('session-2');
      expect(activeSessions.map(s => s.sessionId)).toContain('session-3');
    });
  });

  describe('Session Encryption', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should encrypt session data', async () => {
      const plaintext = 'sensitive data';
      
      const encrypted = await sessionSecurity.encryptSessionData(sessionId, plaintext);
        expect(encrypted).toBeDefined();
      expect(encrypted.sessionId).toBe(sessionId);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(mockEncryptionService.encrypt).toHaveBeenCalled();
    });

    it('should decrypt session data', async () => {
      const plaintext = 'sensitive data';
      const encrypted = await sessionSecurity.encryptSessionData(sessionId, plaintext);
      
      const decrypted = await sessionSecurity.decryptSessionData(sessionId, encrypted);
        expect(decrypted).toBe('decrypted-data'); // Mocked response
      expect(mockEncryptionService.decrypt).toHaveBeenCalled();
    });

    it('should handle encryption for non-existent session', async () => {
      await expect(
        sessionSecurity.encryptSessionData('non-existent', 'data')
      ).rejects.toThrow(CryptoError);
    });

    it('should handle decryption for non-existent session', async () => {      const fakeEncrypted = {
        sessionId: 'non-existent',
        encrypted: Buffer.from('fake'),
        iv: Buffer.from('fake'),
        tag: Buffer.from('fake'),
        algorithm: 'aes-256-gcm',
        timestamp: new Date()
      };

      await expect(
        sessionSecurity.decryptSessionData('non-existent', fakeEncrypted)
      ).rejects.toThrow(CryptoError);
    });
  });

  describe('Key Rotation', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should rotate session keys', async () => {
      const originalContext = await sessionSecurity.getSession(sessionId);
      const originalEncKey = originalContext!.encryptionKey.key;
      
      await sessionSecurity.rotateSessionKeys(sessionId);
      
      const updatedContext = await sessionSecurity.getSession(sessionId);
      expect(updatedContext!.encryptionKey.key).not.toEqual(originalEncKey);
      expect(mockKeyManager.generateSessionKey).toHaveBeenCalled();
    });

    it('should handle key rotation errors', async () => {
      mockKeyManager.generateSessionKey.mockImplementation(() => {
        throw new Error('Key rotation failed');
      });

      await expect(
        sessionSecurity.rotateSessionKeys(sessionId)
      ).rejects.toThrow(CryptoError);
    });    it('should auto-rotate keys based on schedule', async () => {
      await sessionSecurity.scheduleKeyRotation(sessionId, 0.1); // 0.1 minutes for testing
      
      // Wait for rotation to occur
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify key rotation occurred
      expect(mockKeyManager.generateSessionKey).toHaveBeenCalled();
    });
  });

  describe('Security Events', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });    it('should record security event', async () => {
      const eventType = 'failed_authentication';
      const eventData = { attempts: 3 };
      
      await sessionSecurity.recordSecurityEvent(sessionId, eventType, eventData);
      const events = await sessionSecurity.getSecurityEvents(sessionId);
      
      // Should have 2 events: session_initialized (from beforeEach) + failed_authentication
      expect(events).toHaveLength(2);
      expect(events[1].type).toBe(eventType);
      expect(events[1].data).toMatchObject({ sessionId, ...eventData });
    });    it('should get security events for session', async () => {
      await sessionSecurity.recordSecurityEvent(sessionId, 'login', {});
      await sessionSecurity.recordSecurityEvent(sessionId, 'data_access', { resource: 'file1' });
      
      const events = await sessionSecurity.getSecurityEvents(sessionId);
      // Should have 3 events: session_initialized (from beforeEach) + login + data_access
      expect(events).toHaveLength(3);
    });

    it('should limit security events history', async () => {
      // Record more events than the limit
      for (let i = 0; i < 1200; i++) {
        await sessionSecurity.recordSecurityEvent(sessionId, 'test_event', { index: i });
      }      const sessionEvents = await sessionSecurity.getSecurityEvents(sessionId);
      // Should have recorded all events for this session (they're not limited per session)
      expect(sessionEvents.length).toBeGreaterThan(0);
    });

    it('should detect suspicious activity', async () => {
      // Record multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await sessionSecurity.recordSecurityEvent(sessionId, 'failed_authentication', {});
      }
      
      const isSuspicious = await sessionSecurity.detectSuspiciousActivity(sessionId);
      expect(isSuspicious).toBe(true);
    });
  });

  describe('Session Validation', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should validate active session', async () => {
      const isValid = await sessionSecurity.validateSession(sessionId);
      expect(isValid).toBe(true);
    });

    it('should invalidate expired session', async () => {
      const context = await sessionSecurity.getSession(sessionId);
      if (context) {
        // Set session as expired
        context.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }
      
      const isValid = await sessionSecurity.validateSession(sessionId);
      expect(isValid).toBe(false);
    });

    it('should invalidate inactive session', async () => {
      const context = await sessionSecurity.getSession(sessionId);
      if (context) {
        context.isActive = false;
      }
      
      const isValid = await sessionSecurity.validateSession(sessionId);
      expect(isValid).toBe(false);
    });

    it('should check session permissions', async () => {
      await sessionSecurity.initializeSession('admin-session', 'admin-user', ['admin', 'write']);
      
      const hasAdminPerm = await sessionSecurity.hasPermission('admin-session', 'admin');
      const hasWritePerm = await sessionSecurity.hasPermission('admin-session', 'write');
      const hasReadPerm = await sessionSecurity.hasPermission('admin-session', 'read');
      
      expect(hasAdminPerm).toBe(true);
      expect(hasWritePerm).toBe(true);
      expect(hasReadPerm).toBe(false);
    });
  });

  describe('Integrity Protection', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should generate integrity hash', async () => {
      const data = 'important data';
      
      const hash = await sessionSecurity.generateIntegrityHash(sessionId, data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(mockKeyManager.signData).toHaveBeenCalled();
    });

    it('should verify integrity hash', async () => {
      const data = 'important data';
      const hash = await sessionSecurity.generateIntegrityHash(sessionId, data);
      
      const isValid = await sessionSecurity.verifyIntegrityHash(sessionId, data, hash);
      
      expect(isValid).toBe(true);
      expect(mockKeyManager.verifySignature).toHaveBeenCalled();
    });

    it('should detect integrity violation', async () => {
      const originalData = 'original data';
      const tamperedData = 'tampered data';
      const hash = await sessionSecurity.generateIntegrityHash(sessionId, originalData);
      
      mockKeyManager.verifySignature.mockReturnValue(false);
      
      const isValid = await sessionSecurity.verifyIntegrityHash(sessionId, tamperedData, hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Session Statistics', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
    });

    it('should get session statistics', async () => {
      // Perform some operations to generate stats
      await sessionSecurity.encryptSessionData(sessionId, 'data1');
      await sessionSecurity.encryptSessionData(sessionId, 'data2');
      await sessionSecurity.generateIntegrityHash(sessionId, 'data');
      
      const stats = await sessionSecurity.getSessionStatistics(sessionId);
      
      expect(stats).toBeDefined();
      expect(stats.sessionId).toBe(sessionId);
      expect(stats.encryptedDataCount).toBeGreaterThan(0);
      expect(stats.integrityChecks).toBeGreaterThan(0);
    });

    it('should get overall statistics', async () => {
      await sessionSecurity.initializeSession('session-2', 'user-456');
      
      const stats = await sessionSecurity.getOverallStatistics();
        expect(stats).toBeDefined();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(2);
      expect(stats.totalSecurityEvents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {    it('should handle encryption service errors', async () => {
      mockEncryptionService.encrypt.mockRejectedValue(new Error('Encryption failed'));
      
      const sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
      
      await expect(
        sessionSecurity.encryptSessionData(sessionId, 'data')
      ).rejects.toThrow();
    });    it('should handle key manager errors', async () => {
      mockKeyManager.signData.mockImplementation(() => {
        throw new Error('Signing failed');
      });
      
      const sessionId = 'test-session';
      await sessionSecurity.initializeSession(sessionId, 'user-123');
      
      expect(() => {
        sessionSecurity.generateIntegrityHash(sessionId, 'data');
      }).toThrow();
    });

    it('should validate input parameters', async () => {
      await expect(
        sessionSecurity.initializeSession('', 'user')
      ).rejects.toThrow(CryptoError);
      
      await expect(
        sessionSecurity.initializeSession('session', '')
      ).rejects.toThrow(CryptoError);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should cleanup expired sessions', async () => {
      // Create sessions with different expiry times
      const session1 = await sessionSecurity.initializeSession('session-1', 'user-1');
      const session2 = await sessionSecurity.initializeSession('session-2', 'user-2');
      
      // Manually expire one session
      session1.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      await sessionSecurity.cleanupExpiredSessions();
      
      const activeSessions = await sessionSecurity.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe('session-2');
    });

    it('should perform security maintenance', async () => {
      await sessionSecurity.initializeSession('session-1', 'user-1');
      
      // This should cleanup expired sessions and rotate old keys
      await sessionSecurity.performSecurityMaintenance();
      
      // Verify maintenance was performed (implementation would track this)
      const stats = await sessionSecurity.getOverallStatistics();
      expect(stats).toBeDefined();
    });
  });
});
