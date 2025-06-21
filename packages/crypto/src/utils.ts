import * as crypto from 'crypto';
import { z } from 'zod';
import { 
  HashAlgorithm, 
  KeyDerivationFunction, 
  CryptoError, 
  EncryptionAlgorithm 
} from './types';

/**
 * Cryptographic utility functions for EKD Desk
 */

// Key generation utilities
export const generateSecureKey = (keySize: number = 32): Buffer => {
  if (keySize <= 0 || keySize > 1024) {
    throw new CryptoError('Invalid key size', 'INVALID_KEY_SIZE');
  }
  return crypto.randomBytes(keySize);
};

export const generateSecurePassword = (
  length: number = 32,
  includeSpecialChars: boolean = true
): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = includeSpecialChars ? chars + specialChars : chars;
  
  const bytes = crypto.randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += allChars[bytes[i] % allChars.length];
  }
  
  return result;
};

// Key derivation utilities
export const deriveKey = async (
  password: string,
  salt: Buffer,
  iterations: number = 100000,
  keyLength: number = 32,
  algorithm: KeyDerivationFunction = 'pbkdf2'
): Promise<Buffer> => {
  switch (algorithm) {
    case 'pbkdf2':
      return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
    case 'scrypt':
      return crypto.scryptSync(password, salt, keyLength, { 
        N: 16384, 
        r: 8, 
        p: 1,
        maxmem: 128 * 1024 * 1024 
      });
    case 'argon2id':
      // For Argon2, we would need an external library like 'argon2'
      // For now, fallback to scrypt
      return crypto.scryptSync(password, salt, keyLength, { 
        N: 16384, 
        r: 8, 
        p: 1,
        maxmem: 128 * 1024 * 1024 
      });
    default:
      throw new CryptoError(`Unsupported key derivation function: ${algorithm}`, 'UNSUPPORTED_KDF');
  }
};

// Hashing utilities
export const hashData = (
  data: string | Buffer,
  algorithm: HashAlgorithm = 'sha256'
): Buffer => {
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  
  switch (algorithm) {
    case 'sha256':
      return crypto.createHash('sha256').update(dataBuffer).digest();
    case 'sha512':
      return crypto.createHash('sha512').update(dataBuffer).digest();
    case 'blake2b':
      // Blake2b is not natively supported in Node.js crypto
      // For now, fallback to sha512
      return crypto.createHash('sha512').update(dataBuffer).digest();
    default:
      throw new CryptoError(`Unsupported hash algorithm: ${algorithm}`, 'UNSUPPORTED_HASH');
  }
};

export const hmac = (
  data: string | Buffer,
  key: string | Buffer,
  algorithm: HashAlgorithm = 'sha256'
): Buffer => {
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
  
  const hmacAlgorithm = algorithm === 'blake2b' ? 'sha512' : algorithm;
  return crypto.createHmac(hmacAlgorithm, keyBuffer).update(dataBuffer).digest();
};

// Random utilities
export const generateNonce = (size: number = 16): Buffer => {
  return crypto.randomBytes(size);
};

export const generateSalt = (size: number = 32): Buffer => {
  return crypto.randomBytes(size);
};

export const generateRandomInt = (min: number, max: number): number => {
  if (min >= max) {
    throw new CryptoError('Invalid range: min must be less than max', 'INVALID_RANGE');
  }
  
  const range = max - min;
  const bytes = crypto.randomBytes(4);
  const randomValue = bytes.readUInt32BE(0);
  
  return min + (randomValue % range);
};

// Constant-time comparison
export const constantTimeEqual = (a: Buffer, b: Buffer): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(a, b);
};

// Encoding utilities
export const base64Encode = (data: Buffer): string => {
  return data.toString('base64');
};

export const base64Decode = (data: string): Buffer => {
  return Buffer.from(data, 'base64');
};

export const hexEncode = (data: Buffer): string => {
  return data.toString('hex');
};

export const hexDecode = (data: string): Buffer => {
  return Buffer.from(data, 'hex');
};

// URL-safe base64 encoding
export const base64UrlEncode = (data: Buffer): string => {
  return data.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const base64UrlDecode = (data: string): Buffer => {
  // Add padding if needed
  const padded = data + '='.repeat((4 - data.length % 4) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
};

// Validation utilities
export const validateKeySize = (keySize: number, algorithm: EncryptionAlgorithm): boolean => {
  const validSizes: Record<EncryptionAlgorithm, number[]> = {
    'aes-256-gcm': [32],
    'aes-256-cbc': [32],
    'chacha20-poly1305': [32]
  };
  
  return validSizes[algorithm]?.includes(keySize) || false;
};

export const validateIVSize = (ivSize: number, algorithm: EncryptionAlgorithm): boolean => {
  const validSizes: Record<EncryptionAlgorithm, number[]> = {
    'aes-256-gcm': [12],
    'aes-256-cbc': [16],
    'chacha20-poly1305': [12]
  };
  
  return validSizes[algorithm]?.includes(ivSize) || false;
};

// Performance utilities
export const secureWipe = (buffer: Buffer): void => {
  if (buffer && buffer.length > 0) {
    crypto.randomFillSync(buffer);
  }
};

export const measureCryptoPerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'crypto-operation'
): Promise<{ result: T; duration: number }> => {
  const start = process.hrtime.bigint();
  const result = await operation();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000; // Convert to milliseconds
  
  return { result, duration };
};

// Entropy utilities
export const getSystemEntropy = (): {
  randomBytes: string;
  timestamp: number;
  processInfo: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
} => {
  return {
    randomBytes: crypto.randomBytes(32).toString('hex'),
    timestamp: Date.now(),
    processInfo: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  };
};

// Zod schemas for validation
export const CryptoKeySchema = z.object({
  key: z.string().min(1),
  algorithm: z.string(),
  size: z.number().positive(),
  format: z.enum(['hex', 'base64', 'raw'])
});

export const CryptoHashSchema = z.object({
  data: z.string(),
  algorithm: z.enum(['sha256', 'sha512', 'blake2b']),
  encoding: z.enum(['hex', 'base64']).optional()
});

// Error handling utilities
export const isCryptoError = (error: any): error is CryptoError => {
  return error instanceof CryptoError;
};

export const createCryptoError = (
  message: string,
  code: string,
  context?: any
): CryptoError => {
  return new CryptoError(message, code, context);
};

// Memory utilities
export const allocateSecureBuffer = (size: number): Buffer => {
  if (size <= 0 || size > 1024 * 1024) { // Max 1MB
    throw new CryptoError('Invalid buffer size', 'INVALID_BUFFER_SIZE');
  }
  
  const buffer = Buffer.allocUnsafe(size);
  crypto.randomFillSync(buffer);
  return buffer;
};

export const clearBuffer = (buffer: Buffer): void => {
  if (buffer && buffer.length > 0) {
    buffer.fill(0);
  }
};

// Constants
export const CRYPTO_CONSTANTS = {
  MIN_KEY_SIZE: 16,
  MAX_KEY_SIZE: 64,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  DEFAULT_ITERATIONS: 100000,
  DEFAULT_SALT_SIZE: 32,
  DEFAULT_IV_SIZE: 12,
  DEFAULT_TAG_SIZE: 16
} as const;

// Type guards
export const isValidHex = (str: string): boolean => {
  return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
};

export const isValidBase64 = (str: string): boolean => {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
};

export const isBuffer = (obj: any): obj is Buffer => {
  return Buffer.isBuffer(obj);
};
