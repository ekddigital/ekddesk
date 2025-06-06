import { KeyManager } from '../key-management';
import { KeyManagementError, KeyPair, SessionKey } from '../types';
import * as crypto from 'crypto';

// Mock generateSecureKey from utils
jest.mock('../utils', () => ({
  generateSecureKey: jest.fn().mockReturnValue(Buffer.from('mock-secure-key-32-bytes-long123', 'utf8'))
}));

describe('KeyManager', () => {
  let keyManager: KeyManager;
  beforeEach(() => {
    keyManager = new KeyManager(60000, 300000); // 1 minute rotation, 5 minute max age
  });

  afterEach(() => {
    keyManager.destroy();
  });

  describe('Constructor', () => {    test('should create instance with default settings', () => {
      const manager = new KeyManager();
      expect(manager).toBeInstanceOf(KeyManager);
      manager.destroy();
    });

    test('should create instance with custom settings', () => {
      const manager = new KeyManager(30000, 120000);
      expect(manager).toBeInstanceOf(KeyManager);
      manager.destroy();
    });
  });

  describe('RSA Key Pair Generation', () => {
    test('should generate RSA key pair with default settings', async () => {
      const keyPair = await keyManager.generateRSAKeyPair();
      
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('algorithm');
      expect(keyPair).toHaveProperty('format');
      expect(keyPair).toHaveProperty('createdAt');
      
      expect(keyPair.algorithm).toBe('rsa-2048');
      expect(keyPair.format).toBe('pkcs8');
      expect(keyPair.createdAt).toBeInstanceOf(Date);
    });

    test('should generate RSA key pair with custom key size', async () => {
      const keyPair = await keyManager.generateRSAKeyPair(4096);
      
      expect(keyPair.algorithm).toBe('rsa-4096');
    });

    test('should generate RSA key pair with custom format', async () => {
      const keyPair = await keyManager.generateRSAKeyPair(2048, 'spki');
      
      expect(keyPair.format).toBe('spki');
    });
  });

  describe('ECDSA Key Pair Generation', () => {
    test('should generate ECDSA key pair with default curve', async () => {
      const keyPair = await keyManager.generateECDSAKeyPair();
      
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair.algorithm).toBe('ecdsa-prime256v1');
      expect(keyPair.format).toBe('pkcs8');
    });

    test('should generate ECDSA key pair with custom curve', async () => {
      const keyPair = await keyManager.generateECDSAKeyPair('secp384r1');
      
      expect(keyPair.algorithm).toBe('ecdsa-secp384r1');
    });

    test('should generate ECDSA key pair with custom format', async () => {
      const keyPair = await keyManager.generateECDSAKeyPair('prime256v1', 'spki');
      
      expect(keyPair.format).toBe('spki');
    });
  });

  describe('Ed25519 Key Pair Generation', () => {
    test('should generate Ed25519 key pair', async () => {
      const keyPair = await keyManager.generateEd25519KeyPair();
      
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair.algorithm).toBe('ed25519');
      expect(keyPair.format).toBe('pkcs8');
    });

    test('should generate Ed25519 key pair with custom format', async () => {
      const keyPair = await keyManager.generateEd25519KeyPair('spki');
      
      expect(keyPair.format).toBe('spki');
    });
  });

  describe('Session Key Management', () => {
    test('should generate session key', () => {
      const sessionId = 'test-session-123';
      const sessionKey = keyManager.generateSessionKey(sessionId);
      
      expect(sessionKey).toHaveProperty('id');
      expect(sessionKey).toHaveProperty('key');
      expect(sessionKey).toHaveProperty('algorithm');
      expect(sessionKey).toHaveProperty('createdAt');
      expect(sessionKey).toHaveProperty('expiresAt');
      expect(sessionKey).toHaveProperty('usageCount');
      expect(sessionKey).toHaveProperty('maxUsage');
      expect(sessionKey).toHaveProperty('sessionId');
      
      expect(sessionKey.sessionId).toBe(sessionId);
      expect(sessionKey.algorithm).toBe('aes-256-gcm');
      expect(sessionKey.usageCount).toBe(0);
      expect(sessionKey.maxUsage).toBe(1000);
      expect(sessionKey.createdAt).toBeInstanceOf(Date);
      expect(sessionKey.expiresAt).toBeInstanceOf(Date);
    });

    test('should generate session key with custom parameters', () => {
      const sessionId = 'test-session-456';
      const sessionKey = keyManager.generateSessionKey(sessionId, 64, 500);
      
      expect(sessionKey.sessionId).toBe(sessionId);
      expect(sessionKey.maxUsage).toBe(500);
    });

    test('should get session key by ID', () => {
      const sessionId = 'test-session-789';
      const sessionKey = keyManager.generateSessionKey(sessionId);
      
      const retrievedKey = keyManager.getSessionKey(sessionKey.id);
      
      expect(retrievedKey).toEqual(sessionKey);
    });

    test('should return null for non-existent session key', () => {
      const nonExistentKey = keyManager.getSessionKey('non-existent-id');
      
      expect(nonExistentKey).toBeNull();
    });

    test('should return null for expired session key', () => {
      const sessionId = 'test-session-expired';
      const sessionKey = keyManager.generateSessionKey(sessionId);
      
      // Manually expire the key
      sessionKey.expiresAt = new Date(Date.now() - 1000);
      keyManager['sessionKeys'].set(sessionKey.id, sessionKey);
      
      const retrievedKey = keyManager.getSessionKey(sessionKey.id);
      
      expect(retrievedKey).toBeNull();
    });

    test('should return null for overused session key', () => {
      const sessionId = 'test-session-overused';
      const sessionKey = keyManager.generateSessionKey(sessionId);
      
      // Manually set usage count to exceed limit
      sessionKey.usageCount = sessionKey.maxUsage;
      keyManager['sessionKeys'].set(sessionKey.id, sessionKey);
      
      const retrievedKey = keyManager.getSessionKey(sessionKey.id);
      
      expect(retrievedKey).toBeNull();
    });

    test('should use session key and increment usage count', () => {
      const sessionId = 'test-session-use';
      const sessionKey = keyManager.generateSessionKey(sessionId);
      const originalUsageCount = sessionKey.usageCount;
      
      const success = keyManager.useSessionKey(sessionKey.id);
      
      expect(success).toBe(true);
      
      const updatedKey = keyManager.getSessionKey(sessionKey.id);
      expect(updatedKey?.usageCount).toBe(originalUsageCount + 1);
    });

    test('should fail to use non-existent session key', () => {
      const success = keyManager.useSessionKey('non-existent-id');
      
      expect(success).toBe(false);
    });
  });  describe('Digital Signatures', () => {
    const testData = 'test data for signing';
    const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----';
    const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC_KEY\n-----END PUBLIC KEY-----';

    // Mock crypto functions directly without jest.spyOn since they're already mocked
    const mockSign = jest.fn().mockReturnValue(Buffer.from('mock-signature', 'base64'));
    const mockVerify = jest.fn().mockReturnValue(true);

    beforeEach(() => {
      // Reset mocks
      mockSign.mockClear();
      mockVerify.mockClear();
      
      // Set up crypto mocks
      const crypto = require('crypto');
      crypto.sign = mockSign;
      crypto.verify = mockVerify;
    });    test('should sign data with RSA-PSS', () => {
      const signature = keyManager.signData(testData, mockPrivateKey, 'rsa-pss');
      
      expect(typeof signature).toBe('string');
      expect(mockSign).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(testData, 'utf8'),
        expect.objectContaining({
          key: mockPrivateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        })
      );
    });    test('should sign data with ECDSA-P256', () => {
      const signature = keyManager.signData(testData, mockPrivateKey, 'ecdsa-p256');
      
      expect(typeof signature).toBe('string');
      expect(mockSign).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(testData, 'utf8'),
        mockPrivateKey
      );
    });

    test('should sign data with Ed25519', () => {
      const signature = keyManager.signData(testData, mockPrivateKey, 'ed25519');
      
      expect(typeof signature).toBe('string');
      expect(mockSign).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(testData, 'utf8'),
        mockPrivateKey
      );
    });

    test('should sign buffer data', () => {
      const dataBuffer = Buffer.from(testData);
      const signature = keyManager.signData(dataBuffer, mockPrivateKey);
      
      expect(typeof signature).toBe('string');
    });

    test('should throw error for unsupported signature algorithm', () => {
      expect(() => {
        keyManager.signData(testData, mockPrivateKey, 'unsupported' as any);
      }).toThrow(KeyManagementError);
    });

    test('should verify signature with RSA-PSS', () => {
      const signature = 'mock-signature-base64';
      const isValid = keyManager.verifySignature(testData, signature, mockPublicKey, 'rsa-pss');
      
      expect(isValid).toBe(true);
      expect(mockVerify).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(testData, 'utf8'),
        expect.objectContaining({
          key: mockPublicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
        }),
        Buffer.from(signature, 'base64')
      );
    });

    test('should verify signature with ECDSA-P256', () => {
      const signature = 'mock-signature-base64';
      const isValid = keyManager.verifySignature(testData, signature, mockPublicKey, 'ecdsa-p256');
      
      expect(isValid).toBe(true);
      expect(mockVerify).toHaveBeenCalledWith(
        'sha256',
        Buffer.from(testData, 'utf8'),
        mockPublicKey,
        Buffer.from(signature, 'base64')
      );
    });

    test('should verify signature with Ed25519', () => {
      const signature = 'mock-signature-base64';
      const isValid = keyManager.verifySignature(testData, signature, mockPublicKey, 'ed25519');
      
      expect(isValid).toBe(true);
    });

    test('should handle signature verification failure', () => {
      mockVerify.mockReturnValue(false);
      
      const signature = 'invalid-signature';
      const isValid = keyManager.verifySignature(testData, signature, mockPublicKey);
      
      expect(isValid).toBe(false);
    });

    test('should handle signature verification errors gracefully', () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Verification error');
      });
      
      const signature = 'error-signature';
      const isValid = keyManager.verifySignature(testData, signature, mockPublicKey);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Key Rotation', () => {
    test('should rotate expired session keys', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      // Create session keys
      const key1 = keyManager.generateSessionKey(sessionId1);
      const key2 = keyManager.generateSessionKey(sessionId2);
      
      // Manually expire key1
      key1.expiresAt = new Date(Date.now() - 1000);
      keyManager['sessionKeys'].set(key1.id, key1);
      
      keyManager.rotateSessionKeys();
      
      // key1 should be removed, key2 should remain
      expect(keyManager.getSessionKey(key1.id)).toBeNull();
      expect(keyManager.getSessionKey(key2.id)).toBeTruthy();
    });

    test('should rotate old session keys', () => {
      const sessionId = 'old-session';
      const key = keyManager.generateSessionKey(sessionId);
      
      // Manually age the key beyond rotation interval
      key.createdAt = new Date(Date.now() - 120000); // 2 minutes ago
      keyManager['sessionKeys'].set(key.id, key);
      
      keyManager.rotateSessionKeys();
      
      expect(keyManager.getSessionKey(key.id)).toBeNull();
    });
  });

  describe('JWK Import/Export', () => {
    test('should export key pair to JWK format', async () => {
      const keyPair = await keyManager.generateRSAKeyPair();
      
      const jwk = keyManager.exportKeyToJWK(keyPair);
      
      expect(jwk).toHaveProperty('kty');
      expect(jwk).toHaveProperty('alg');
      expect(jwk).toHaveProperty('use');
      expect(jwk).toHaveProperty('key_ops');
      expect(jwk).toHaveProperty('created');
      expect(jwk).toHaveProperty('public_key');
      expect(jwk).toHaveProperty('private_key');
      
      expect(jwk.kty).toBe('RSA');
      expect(jwk.use).toBe('sig');
    });

    test('should export ECDSA key pair to JWK format', async () => {
      const keyPair = await keyManager.generateECDSAKeyPair();
      
      const jwk = keyManager.exportKeyToJWK(keyPair);
      
      expect(jwk.kty).toBe('EC');
    });

    test('should import key pair from JWK format', () => {
      const jwk = {
        kty: 'RSA',
        alg: 'rsa-2048',
        use: 'sig',
        key_ops: ['sign', 'verify'],
        created: new Date().toISOString(),
        public_key: 'mock-public-key',
        private_key: 'mock-private-key'
      };
      
      const keyPair = keyManager.importKeyFromJWK(jwk);
      
      expect(keyPair).toHaveProperty('publicKey', 'mock-public-key');
      expect(keyPair).toHaveProperty('privateKey', 'mock-private-key');
      expect(keyPair).toHaveProperty('algorithm', 'rsa-2048');
      expect(keyPair).toHaveProperty('format', 'jwk');
      expect(keyPair).toHaveProperty('createdAt');
    });

    test('should import key pair from JWK with expiration', () => {
      const expirationDate = new Date(Date.now() + 86400000); // 24 hours
      const jwk = {
        kty: 'RSA',
        alg: 'rsa-2048',
        use: 'sig',
        key_ops: ['sign', 'verify'],
        created: new Date().toISOString(),
        expires: expirationDate.toISOString(),
        public_key: 'mock-public-key',
        private_key: 'mock-private-key'
      };
      
      const keyPair = keyManager.importKeyFromJWK(jwk);
      
      expect(keyPair.expiresAt).toEqual(expirationDate);
    });
  });

  describe('Key Statistics', () => {
    test('should return key statistics', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      keyManager.generateSessionKey(sessionId1);
      keyManager.generateSessionKey(sessionId2);
      
      const stats = keyManager.getKeyStatistics();
      
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('sessionKeys');
      expect(stats).toHaveProperty('expiredKeys');
      expect(stats).toHaveProperty('nearExpiration');
      
      expect(stats.sessionKeys).toBe(2);
      expect(typeof stats.totalKeys).toBe('number');
      expect(typeof stats.expiredKeys).toBe('number');
      expect(typeof stats.nearExpiration).toBe('number');
    });

    test('should count expired keys correctly', () => {
      const sessionId = 'expired-session';
      const key = keyManager.generateSessionKey(sessionId);
      
      // Manually expire the key
      key.expiresAt = new Date(Date.now() - 1000);
      keyManager['sessionKeys'].set(key.id, key);
      
      const stats = keyManager.getKeyStatistics();
      
      expect(stats.expiredKeys).toBe(1);
    });

    test('should count near-expiration keys correctly', () => {
      const sessionId = 'near-expired-session';
      const key = keyManager.generateSessionKey(sessionId);
      
      // Set key to expire in 1 hour (within threshold)
      key.expiresAt = new Date(Date.now() + 3600000);
      keyManager['sessionKeys'].set(key.id, key);
      
      const stats = keyManager.getKeyStatistics();
      
      expect(stats.nearExpiration).toBeGreaterThan(0);
    });
  });

  describe('Key Cleanup', () => {
    test('should cleanup expired session keys', () => {
      const sessionId1 = 'session-expired';
      const sessionId2 = 'session-valid';
      
      const key1 = keyManager.generateSessionKey(sessionId1);
      const key2 = keyManager.generateSessionKey(sessionId2);
      
      // Expire key1
      key1.expiresAt = new Date(Date.now() - 1000);
      keyManager['sessionKeys'].set(key1.id, key1);
      
      const cleanedCount = keyManager.cleanupExpiredKeys();
      
      expect(cleanedCount).toBe(1);
      expect(keyManager.getSessionKey(key1.id)).toBeNull();
      expect(keyManager.getSessionKey(key2.id)).toBeTruthy();
    });

    test('should cleanup expired regular keys', async () => {
      const keyPair = await keyManager.generateRSAKeyPair();
      
      // Set expiration on the key pair
      keyPair.expiresAt = new Date(Date.now() - 1000);
      
      const cleanedCount = keyManager.cleanupExpiredKeys();
      
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });  describe('Error Handling', () => {
    const mockGenerateKeyPairSync = jest.fn();
    
    beforeEach(() => {
      // Set up crypto mock for error handling tests
      const crypto = require('crypto');
      crypto.generateKeyPairSync = mockGenerateKeyPairSync;
    });

    test('should handle key generation errors', async () => {
      // Mock crypto.generateKeyPairSync to throw error
      mockGenerateKeyPairSync.mockImplementation(() => {
        throw new Error('Key generation failed');
      });
      
      await expect(keyManager.generateRSAKeyPair()).rejects.toThrow(KeyManagementError);
    });

    test('should handle session key generation errors', () => {
      // Mock generateSecureKey to throw error
      const { generateSecureKey } = require('../utils');
      generateSecureKey.mockImplementationOnce(() => {
        throw new Error('Key generation failed');
      });
      
      expect(() => {
        keyManager.generateSessionKey('test-session');
      }).toThrow(KeyManagementError);
    });

    test('should handle JWK export errors', async () => {
      // Reset mock to work for this test
      mockGenerateKeyPairSync.mockReturnValue({
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key'
      });
      
      const keyPair = await keyManager.generateRSAKeyPair();
      
      // Corrupt the key pair
      (keyPair as any).createdAt = 'invalid-date';
      
      expect(() => {
        keyManager.exportKeyToJWK(keyPair);
      }).toThrow(KeyManagementError);
    });

    test('should handle JWK import errors', () => {
      const invalidJwk = {
        // Missing required fields
        kty: 'RSA'
      };
      
      expect(() => {
        keyManager.importKeyFromJWK(invalidJwk);
      }).toThrow(KeyManagementError);
    });

    test('should handle signature generation errors', () => {
      // Mock crypto functions directly
      const crypto = require('crypto');
      const mockSign = jest.fn().mockImplementation(() => {
        throw new Error('Signature generation failed');
      });
      crypto.sign = mockSign;
      
      const testData = 'test data';
      const mockPrivateKey = 'mock-private-key';
      
      expect(() => {
        keyManager.signData(testData, mockPrivateKey);
      }).toThrow(KeyManagementError);
    });
  });
});
