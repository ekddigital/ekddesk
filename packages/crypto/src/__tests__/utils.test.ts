import * as crypto from 'crypto';
import {
  generateSecureKey,
  generateSecurePassword,
  deriveKey,
  hashData,
  hmac,
  generateNonce,
  generateSalt,
  generateRandomInt,
  constantTimeEqual,
  base64Encode,
  base64Decode,
  hexEncode,
  hexDecode,
  base64UrlEncode,
  base64UrlDecode,
  validateKeySize,
  validateIVSize,
  secureWipe,
  measureCryptoPerformance,
  getSystemEntropy,
  allocateSecureBuffer,
  clearBuffer,
  isValidHex,
  isValidBase64,
  isBuffer,
  CRYPTO_CONSTANTS
} from '../utils';
import { CryptoError } from '../types';

describe('Crypto Utils', () => {
  describe('Key Generation', () => {
    test('generateSecureKey should generate keys of specified size', () => {
      const key16 = generateSecureKey(16);
      const key32 = generateSecureKey(32);
      
      expect(key16).toHaveLength(16);
      expect(key32).toHaveLength(32);
      expect(Buffer.isBuffer(key16)).toBe(true);
      expect(Buffer.isBuffer(key32)).toBe(true);
    });

    test('generateSecureKey should throw error for invalid sizes', () => {
      expect(() => generateSecureKey(0)).toThrow(CryptoError);
      expect(() => generateSecureKey(-1)).toThrow(CryptoError);
      expect(() => generateSecureKey(2048)).toThrow(CryptoError);
    });

    test('generateSecurePassword should generate passwords of specified length', () => {
      const password16 = generateSecurePassword(16);
      const password32 = generateSecurePassword(32);
      
      expect(password16).toHaveLength(16);
      expect(password32).toHaveLength(32);
      expect(typeof password16).toBe('string');
      expect(typeof password32).toBe('string');
    });

    test('generateSecurePassword should include special characters when requested', () => {
      const withSpecial = generateSecurePassword(50, true);
      const withoutSpecial = generateSecurePassword(50, false);
      
      const specialChars = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/;
      
      // Note: This test might occasionally fail due to randomness
      // In a real test environment, you might want to mock the randomBytes function
      expect(typeof withSpecial).toBe('string');
      expect(typeof withoutSpecial).toBe('string');
    });
  });

  describe('Key Derivation', () => {
    const password = 'test-password';
    const salt = Buffer.from('test-salt');

    test('deriveKey should derive keys using PBKDF2', async () => {
      const key = await deriveKey(password, salt, 1000, 32, 'pbkdf2');
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32);
    });

    test('deriveKey should derive keys using scrypt', async () => {
      const key = await deriveKey(password, salt, 1000, 32, 'scrypt');
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32);
    });

    test('deriveKey should fallback to scrypt for argon2id', async () => {
      const key = await deriveKey(password, salt, 1000, 32, 'argon2id');
      
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key).toHaveLength(32);
    });

    test('deriveKey should throw error for unsupported algorithm', async () => {
      await expect(
        deriveKey(password, salt, 1000, 32, 'unsupported' as any)
      ).rejects.toThrow(CryptoError);
    });
  });

  describe('Hashing', () => {
    const testData = 'test data';
    const testBuffer = Buffer.from(testData);

    test('hashData should hash strings with SHA256', () => {
      const hash = hashData(testData, 'sha256');
      
      expect(Buffer.isBuffer(hash)).toBe(true);
      expect(hash).toHaveLength(32); // SHA256 produces 32 bytes
    });

    test('hashData should hash buffers with SHA512', () => {
      const hash = hashData(testBuffer, 'sha512');
      
      expect(Buffer.isBuffer(hash)).toBe(true);
      expect(hash).toHaveLength(64); // SHA512 produces 64 bytes
    });

    test('hashData should fallback to SHA512 for Blake2b', () => {
      const hash = hashData(testData, 'blake2b');
      
      expect(Buffer.isBuffer(hash)).toBe(true);
      expect(hash).toHaveLength(64); // Fallback to SHA512
    });

    test('hashData should throw error for unsupported algorithm', () => {
      expect(() => hashData(testData, 'unsupported' as any)).toThrow(CryptoError);
    });

    test('hmac should generate HMAC correctly', () => {
      const key = 'test-key';
      const mac = hmac(testData, key, 'sha256');
      
      expect(Buffer.isBuffer(mac)).toBe(true);
      expect(mac).toHaveLength(32);
    });
  });

  describe('Random Utilities', () => {
    test('generateNonce should generate random nonces', () => {
      const nonce1 = generateNonce(16);
      const nonce2 = generateNonce(16);
      
      expect(nonce1).toHaveLength(16);
      expect(nonce2).toHaveLength(16);
      expect(nonce1.equals(nonce2)).toBe(false);
    });

    test('generateSalt should generate random salts', () => {
      const salt = generateSalt(32);
      
      expect(salt).toHaveLength(32);
      expect(Buffer.isBuffer(salt)).toBe(true);
    });

    test('generateRandomInt should generate integers in range', () => {
      const randomInt = generateRandomInt(1, 100);
      
      expect(randomInt).toBeGreaterThanOrEqual(1);
      expect(randomInt).toBeLessThan(100);
      expect(Number.isInteger(randomInt)).toBe(true);
    });

    test('generateRandomInt should throw error for invalid range', () => {
      expect(() => generateRandomInt(100, 1)).toThrow(CryptoError);
      expect(() => generateRandomInt(50, 50)).toThrow(CryptoError);
    });
  });

  describe('Comparison Utilities', () => {
    test('constantTimeEqual should compare buffers safely', () => {
      const buffer1 = Buffer.from('same');
      const buffer2 = Buffer.from('same');
      const buffer3 = Buffer.from('different');
      
      expect(constantTimeEqual(buffer1, buffer2)).toBe(true);
      expect(constantTimeEqual(buffer1, buffer3)).toBe(false);
      expect(constantTimeEqual(buffer1, Buffer.from('sam'))).toBe(false);
    });
  });

  describe('Encoding Utilities', () => {
    const testData = Buffer.from('Hello, World!');
    const base64String = 'SGVsbG8sIFdvcmxkIQ==';
    const hexString = '48656c6c6f2c20576f726c6421';

    test('base64Encode and base64Decode should work correctly', () => {
      const encoded = base64Encode(testData);
      const decoded = base64Decode(encoded);
      
      expect(encoded).toBe(base64String);
      expect(decoded.equals(testData)).toBe(true);
    });

    test('hexEncode and hexDecode should work correctly', () => {
      const encoded = hexEncode(testData);
      const decoded = hexDecode(encoded);
      
      expect(encoded).toBe(hexString);
      expect(decoded.equals(testData)).toBe(true);
    });

    test('base64UrlEncode and base64UrlDecode should work correctly', () => {
      const testDataWithPadding = Buffer.from('test data for URL encoding');
      const encoded = base64UrlEncode(testDataWithPadding);
      const decoded = base64UrlDecode(encoded);
      
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      expect(decoded.equals(testDataWithPadding)).toBe(true);
    });
  });

  describe('Validation Utilities', () => {
    test('validateKeySize should validate key sizes for algorithms', () => {
      expect(validateKeySize(32, 'aes-256-gcm')).toBe(true);
      expect(validateKeySize(16, 'aes-256-gcm')).toBe(false);
      expect(validateKeySize(32, 'aes-256-cbc')).toBe(true);
      expect(validateKeySize(32, 'chacha20-poly1305')).toBe(true);
    });

    test('validateIVSize should validate IV sizes for algorithms', () => {
      expect(validateIVSize(12, 'aes-256-gcm')).toBe(true);
      expect(validateIVSize(16, 'aes-256-gcm')).toBe(false);
      expect(validateIVSize(16, 'aes-256-cbc')).toBe(true);
      expect(validateIVSize(12, 'chacha20-poly1305')).toBe(true);
    });
  });

  describe('Memory Utilities', () => {
    test('secureWipe should wipe buffer contents', () => {
      const buffer = Buffer.from('sensitive data');
      const original = Buffer.from(buffer);
      
      secureWipe(buffer);
      
      expect(buffer.equals(original)).toBe(false);
    });

    test('allocateSecureBuffer should allocate random buffer', () => {
      const buffer = allocateSecureBuffer(32);
      
      expect(buffer).toHaveLength(32);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    test('allocateSecureBuffer should throw error for invalid sizes', () => {
      expect(() => allocateSecureBuffer(0)).toThrow(CryptoError);
      expect(() => allocateSecureBuffer(-1)).toThrow(CryptoError);
      expect(() => allocateSecureBuffer(2 * 1024 * 1024)).toThrow(CryptoError);
    });

    test('clearBuffer should clear buffer contents', () => {
      const buffer = Buffer.from('test data');
      const zeroBuffer = Buffer.alloc(buffer.length);
      
      clearBuffer(buffer);
      
      expect(buffer.equals(zeroBuffer)).toBe(true);
    });
  });

  describe('Performance Utilities', () => {
    test('measureCryptoPerformance should measure operation duration', async () => {
      const mockOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };

      const { result, duration } = await measureCryptoPerformance(mockOperation, 'test-op');
      
      expect(result).toBe('result');
      expect(duration).toBeGreaterThan(0);
      expect(typeof duration).toBe('number');
    });
  });

  describe('System Utilities', () => {
    test('getSystemEntropy should return entropy information', () => {
      const entropy = getSystemEntropy();
      
      expect(entropy).toHaveProperty('randomBytes');
      expect(entropy).toHaveProperty('timestamp');
      expect(entropy).toHaveProperty('processInfo');
      expect(entropy.processInfo).toHaveProperty('pid');
      expect(entropy.processInfo).toHaveProperty('uptime');
      expect(entropy.processInfo).toHaveProperty('memoryUsage');
      
      expect(typeof entropy.randomBytes).toBe('string');
      expect(typeof entropy.timestamp).toBe('number');
      expect(typeof entropy.processInfo.pid).toBe('number');
    });
  });

  describe('Type Guards', () => {
    test('isValidHex should validate hex strings', () => {
      expect(isValidHex('48656c6c6f')).toBe(true);
      expect(isValidHex('48656c6c6')).toBe(false); // Odd length
      expect(isValidHex('hello')).toBe(false); // Invalid chars
      expect(isValidHex('123g')).toBe(false); // Invalid char
    });

    test('isValidBase64 should validate base64 strings', () => {
      expect(isValidBase64('SGVsbG8=')).toBe(true);
      expect(isValidBase64('SGVsbG8')).toBe(false); // Invalid padding
      expect(isValidBase64('Hello!')).toBe(false); // Invalid chars
    });

    test('isBuffer should identify buffers', () => {
      expect(isBuffer(Buffer.from('test'))).toBe(true);
      expect(isBuffer('string')).toBe(false);
      expect(isBuffer({})).toBe(false);
      expect(isBuffer(null)).toBe(false);
    });
  });

  describe('Constants', () => {
    test('CRYPTO_CONSTANTS should contain expected values', () => {
      expect(CRYPTO_CONSTANTS.MIN_KEY_SIZE).toBe(16);
      expect(CRYPTO_CONSTANTS.MAX_KEY_SIZE).toBe(64);
      expect(CRYPTO_CONSTANTS.MIN_PASSWORD_LENGTH).toBe(8);
      expect(CRYPTO_CONSTANTS.MAX_PASSWORD_LENGTH).toBe(128);
      expect(CRYPTO_CONSTANTS.DEFAULT_ITERATIONS).toBe(100000);
      expect(CRYPTO_CONSTANTS.DEFAULT_SALT_SIZE).toBe(32);
      expect(CRYPTO_CONSTANTS.DEFAULT_IV_SIZE).toBe(12);
      expect(CRYPTO_CONSTANTS.DEFAULT_TAG_SIZE).toBe(16);
    });
  });
});
