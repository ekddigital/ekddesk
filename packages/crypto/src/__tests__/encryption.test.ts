import { EncryptionService } from '../encryption';
import { EncryptionError, EncryptionConfig } from '../types';
import * as crypto from 'crypto';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testData = 'Hello, World! This is test data for encryption.';
  const testKey = crypto.randomBytes(32);

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('Constructor', () => {
    test('should create instance with default config', () => {
      const service = new EncryptionService();
      expect(service).toBeInstanceOf(EncryptionService);
    });

    test('should create instance with custom config', () => {
      const customConfig: Partial<EncryptionConfig> = {
        algorithm: 'aes-256-cbc',
        keySize: 32,
        ivSize: 16
      };
      
      const service = new EncryptionService(customConfig);
      expect(service).toBeInstanceOf(EncryptionService);
    });
  });

  describe('AES-256-GCM Encryption/Decryption', () => {
    test('should encrypt and decrypt data successfully', async () => {
      const result = await encryptionService.encrypt(testData, testKey, {
        algorithm: 'aes-256-gcm'
      });
      
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      expect(result.algorithm).toBe('aes-256-gcm');
      expect(Buffer.isBuffer(result.encrypted)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);
      expect(Buffer.isBuffer(result.tag)).toBe(true);

      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        testKey,
        result.iv,
        result.algorithm,
        result.tag
      );
      
      expect(decrypted.toString('utf8')).toBe(testData);
    });

    test('should encrypt buffer data', async () => {
      const dataBuffer = Buffer.from(testData);
      const result = await encryptionService.encrypt(dataBuffer, testKey);
      
      expect(result.algorithm).toBe('aes-256-gcm'); // Default algorithm
      
      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        testKey,
        result.iv,
        result.algorithm,
        result.tag
      );
      
      expect(decrypted.equals(dataBuffer)).toBe(true);
    });

    test('should fail decryption with wrong key', async () => {
      const result = await encryptionService.encrypt(testData, testKey);
      const wrongKey = crypto.randomBytes(32);
      
      await expect(
        encryptionService.decrypt(
          result.encrypted,
          wrongKey,
          result.iv,
          result.algorithm,
          result.tag
        )
      ).rejects.toThrow();
    });

    test('should fail decryption without tag', async () => {
      const result = await encryptionService.encrypt(testData, testKey);
      
      await expect(
        encryptionService.decrypt(
          result.encrypted,
          testKey,
          result.iv,
          result.algorithm
        )
      ).rejects.toThrow(EncryptionError);
    });
  });

  describe('AES-256-CBC Encryption/Decryption', () => {
    test('should encrypt and decrypt data successfully', async () => {
      const result = await encryptionService.encrypt(testData, testKey, {
        algorithm: 'aes-256-cbc'
      });
      
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result.algorithm).toBe('aes-256-cbc');
      expect(result.tag).toBeUndefined(); // CBC doesn't use tags
      
      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        testKey,
        result.iv,
        result.algorithm
      );
      
      expect(decrypted.toString('utf8')).toBe(testData);
    });
  });

  describe('ChaCha20-Poly1305 Encryption/Decryption', () => {
    test('should fallback to AES-GCM for ChaCha20', async () => {
      const result = await encryptionService.encrypt(testData, testKey, {
        algorithm: 'chacha20-poly1305'
      });
      
      // Should fallback to AES-GCM
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('tag');
      
      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        testKey,
        result.iv,
        result.algorithm,
        result.tag
      );
      
      expect(decrypted.toString('utf8')).toBe(testData);
    });
  });

  describe('Key Generation', () => {
    test('should generate key for AES-256-GCM', () => {
      const key = encryptionService.generateKey('aes-256-gcm');
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32);
    });

    test('should generate key for AES-256-CBC', () => {
      const key = encryptionService.generateKey('aes-256-cbc');
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32);
    });

    test('should generate default key', () => {
      const key = encryptionService.generateKey();
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32); // Default for AES-256-GCM
    });
  });

  describe('Key Derivation', () => {
    test('should derive key from password', async () => {
      const password = 'test-password';
      const salt = crypto.randomBytes(32);
      
      const derivedKey = await encryptionService.deriveKeyFromPassword(
        password,
        salt,
        50000,
        32
      );
      
      expect(Buffer.isBuffer(derivedKey)).toBe(true);
      expect(derivedKey).toHaveLength(32);
    });

    test('should derive consistent keys from same password and salt', async () => {
      const password = 'test-password';
      const salt = crypto.randomBytes(32);
      
      const key1 = await encryptionService.deriveKeyFromPassword(password, salt);
      const key2 = await encryptionService.deriveKeyFromPassword(password, salt);
      
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('File Encryption/Decryption', () => {
    const fs = require('fs/promises');
    const path = require('path');
    const testDir = path.join(__dirname, '../../test-files');
    const inputFile = path.join(testDir, 'test-input.txt');
    const encryptedFile = path.join(testDir, 'test-encrypted.bin');
    const decryptedFile = path.join(testDir, 'test-decrypted.txt');

    beforeAll(async () => {
      // Create test directory and file
      try {
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(inputFile, testData);
      } catch (error) {
        // Directory might already exist
      }
    });

    afterAll(async () => {
      // Cleanup test files
      try {
        await fs.unlink(inputFile);
        await fs.unlink(encryptedFile);
        await fs.unlink(decryptedFile);
        await fs.rmdir(testDir);
      } catch (error) {
        // Files might not exist
      }
    });

    test('should encrypt and decrypt files', async () => {
      // Create test file
      await fs.writeFile(inputFile, testData);
      
      // Encrypt file
      await encryptionService.encryptFile(inputFile, encryptedFile, testKey);
      
      // Verify encrypted file exists and is different
      const encryptedData = await fs.readFile(encryptedFile);
      expect(encryptedData.length).toBeGreaterThan(testData.length);
      
      // Decrypt file
      await encryptionService.decryptFile(encryptedFile, decryptedFile, testKey);
      
      // Verify decrypted content
      const decryptedData = await fs.readFile(decryptedFile, 'utf8');
      expect(decryptedData).toBe(testData);
    });

    test('should throw error for non-existent input file', async () => {
      const nonExistentFile = path.join(testDir, 'non-existent.txt');
      
      await expect(
        encryptionService.encryptFile(nonExistentFile, encryptedFile, testKey)
      ).rejects.toThrow(EncryptionError);
    });

    test('should throw error for malformed encrypted file', async () => {
      // Create malformed encrypted file
      await fs.writeFile(encryptedFile, 'invalid encrypted data');
      
      await expect(
        encryptionService.decryptFile(encryptedFile, decryptedFile, testKey)
      ).rejects.toThrow(EncryptionError);
    });
  });

  describe('Error Handling', () => {
    test('should throw EncryptionError for unsupported algorithm', async () => {
      await expect(
        encryptionService.encrypt(testData, testKey, {
          algorithm: 'unsupported' as any
        })
      ).rejects.toThrow(EncryptionError);
    });

    test('should throw EncryptionError for invalid key', async () => {
      const invalidKey = 'short-key';
      
      await expect(
        encryptionService.encrypt(testData, invalidKey)
      ).rejects.toThrow();
    });    test('should handle encryption failures gracefully', async () => {
      // Mock crypto.randomBytes directly without jest.spyOn
      const crypto = require('crypto');
      const originalRandomBytes = crypto.randomBytes;
      crypto.randomBytes = jest.fn().mockImplementation(() => {
        throw new Error('Mock crypto error');
      });
      
      await expect(
        encryptionService.encrypt(testData, testKey)
      ).rejects.toThrow(EncryptionError);
      
      // Restore original function
      crypto.randomBytes = originalRandomBytes;
    });
  });

  describe('String and Buffer Key Handling', () => {
    test('should handle hex string keys', async () => {
      const hexKey = testKey.toString('hex');
      
      const result = await encryptionService.encrypt(testData, hexKey);
      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        hexKey,
        result.iv,
        result.algorithm,
        result.tag
      );
      
      expect(decrypted.toString('utf8')).toBe(testData);
    });

    test('should handle buffer keys', async () => {
      const result = await encryptionService.encrypt(testData, testKey);
      const decrypted = await encryptionService.decrypt(
        result.encrypted,
        testKey,
        result.iv,
        result.algorithm,
        result.tag
      );
      
      expect(decrypted.toString('utf8')).toBe(testData);
    });
  });

  describe('Configuration', () => {
    test('should use custom configuration', async () => {
      const customConfig: Partial<EncryptionConfig> = {
        algorithm: 'aes-256-cbc',
        keySize: 32,
        ivSize: 16
      };
      
      const result = await encryptionService.encrypt(testData, testKey, customConfig);
      
      expect(result.algorithm).toBe('aes-256-cbc');
      expect(result.iv).toHaveLength(16);
    });

    test('should merge with default configuration', async () => {
      const partialConfig: Partial<EncryptionConfig> = {
        algorithm: 'aes-256-cbc'
      };
      
      const result = await encryptionService.encrypt(testData, testKey, partialConfig);
      
      expect(result.algorithm).toBe('aes-256-cbc');
      expect(result.iv).toHaveLength(16); // Default for CBC
    });
  });
});
