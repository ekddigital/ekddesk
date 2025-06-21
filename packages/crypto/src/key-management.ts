import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@ekd-desk/shared';
import { KeyPair, SessionKey, KeyManagementError, KeyFormat, SignatureAlgorithm } from './types';
import { generateSecureKey } from './utils';


/**
 * Key management service for EKD Desk
 * Handles key generation, rotation, and secure storage
 */
export class KeyManager {
  private logger: Logger;
  private keys: Map<string, KeyPair> = new Map();
  private sessionKeys: Map<string, SessionKey> = new Map();
  private rotationInterval: number;
  private maxKeyAge: number;
  private rotationTimer?: NodeJS.Timeout;

  constructor(
    rotationInterval: number = 24 * 60 * 60 * 1000, // 24 hours
    maxKeyAge: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ) {
    this.logger = Logger.createLogger('KeyManager');
    this.rotationInterval = rotationInterval;
    this.maxKeyAge = maxKeyAge;
    this.startKeyRotation();
  }

  /**
   * Generate a new RSA key pair
   */
  async generateRSAKeyPair(keySize: number = 2048, format: KeyFormat = 'pkcs8'): Promise<KeyPair> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyPair: KeyPair = {
        publicKey,
        privateKey,
        algorithm: `rsa-${keySize}`,
        format,
        createdAt: new Date()
      };

      const keyId = uuidv4();
      this.keys.set(keyId, keyPair);
      
      this.logger.info('RSA key pair generated', { keyId, keySize });
      return keyPair;
    } catch (error) {
      this.logger.error('RSA key pair generation failed', error);
      throw new KeyManagementError('RSA key pair generation failed', { error });
    }
  }

  /**
   * Generate an ECDSA key pair
   */
  async generateECDSAKeyPair(curve: string = 'prime256v1', format: KeyFormat = 'pkcs8'): Promise<KeyPair> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: curve,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyPair: KeyPair = {
        publicKey,
        privateKey,
        algorithm: `ecdsa-${curve}`,
        format,
        createdAt: new Date()
      };

      const keyId = uuidv4();
      this.keys.set(keyId, keyPair);
      
      this.logger.info('ECDSA key pair generated', { keyId, curve });
      return keyPair;
    } catch (error) {
      this.logger.error('ECDSA key pair generation failed', error);
      throw new KeyManagementError('ECDSA key pair generation failed', { error });
    }
  }

  /**
   * Generate Ed25519 key pair
   */
  async generateEd25519KeyPair(format: KeyFormat = 'pkcs8'): Promise<KeyPair> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyPair: KeyPair = {
        publicKey,
        privateKey,
        algorithm: 'ed25519',
        format,
        createdAt: new Date()
      };

      const keyId = uuidv4();
      this.keys.set(keyId, keyPair);
      
      this.logger.info('Ed25519 key pair generated', { keyId });
      return keyPair;
    } catch (error) {
      this.logger.error('Ed25519 key pair generation failed', error);
      throw new KeyManagementError('Ed25519 key pair generation failed', { error });
    }
  }

  /**
   * Generate session key
   */
  generateSessionKey(sessionId: string, keySize: number = 32, maxUsage: number = 1000): SessionKey {
    try {
      const key = generateSecureKey(keySize);
      const sessionKey: SessionKey = {
        id: uuidv4(),
        key: key.toString('hex'),
        algorithm: 'aes-256-gcm',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        usageCount: 0,
        maxUsage,
        sessionId
      };

      this.sessionKeys.set(sessionKey.id, sessionKey);
      
      this.logger.info('Session key generated', { 
        keyId: sessionKey.id, 
        sessionId, 
        keySize 
      });
      
      return sessionKey;
    } catch (error) {
      this.logger.error('Session key generation failed', error);
      throw new KeyManagementError('Session key generation failed', { error });
    }
  }

  /**
   * Get session key
   */
  getSessionKey(keyId: string): SessionKey | null {
    const key = this.sessionKeys.get(keyId);
    
    if (!key) {
      return null;
    }

    // Check if key is expired
    if (key.expiresAt < new Date()) {
      this.sessionKeys.delete(keyId);
      this.logger.warn('Session key expired and removed', { keyId });
      return null;
    }

    // Check if key has exceeded usage limit
    if (key.usageCount >= key.maxUsage) {
      this.sessionKeys.delete(keyId);
      this.logger.warn('Session key usage limit exceeded', { keyId });
      return null;
    }

    return key;
  }
  /**
   * Use session key (increment usage count)
   */
  useSessionKey(keyId: string): boolean {
    const key = this.getSessionKey(keyId);
    
    if (!key) {
      return false;
    }

    key.usageCount++;
    this.sessionKeys.set(keyId, key);
    
    this.logger.debug('Session key used', { 
      keyId, 
      usageCount: key.usageCount, 
      maxUsage: key.maxUsage 
    });
    
    return true;
  }

  /**
   * Use a session key for encryption/decryption operations
   */
  async useSessionKeyForOperation(sessionId: string, operation: 'encrypt' | 'decrypt', data: Buffer): Promise<Buffer> {
    try {
      const key = this.sessionKeys.get(sessionId);
      if (!key) {
        throw new KeyManagementError(`Session key not found for session: ${sessionId}`);
      }

      // Convert hex key to buffer
      const keyBuffer = Buffer.from(key.key, 'hex');

      // Create cipher/decipher based on operation
      if (operation === 'encrypt') {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();
        
        // Return: IV (16) + AuthTag (16) + Encrypted Data
        return Buffer.concat([iv, authTag, encrypted]);
      } else {
        // Extract IV, AuthTag, and encrypted data
        const iv = data.subarray(0, 16);
        const authTag = data.subarray(16, 32);
        const encryptedData = data.subarray(32);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
        decipher.setAuthTag(authTag);
        
        return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      }
    } catch (error) {
      this.logger.error(`Session key ${operation} operation failed`, { sessionId, error });
      throw new KeyManagementError(`Session key ${operation} failed`, { sessionId, error });
    }
  }

  /**
   * Rotate session keys
   */
  rotateSessionKeys(): void {
    const now = new Date();
    let rotatedCount = 0;

    for (const [keyId, key] of this.sessionKeys.entries()) {
      const keyAge = now.getTime() - key.createdAt.getTime();
      
      if (keyAge > this.rotationInterval || key.expiresAt < now) {
        this.sessionKeys.delete(keyId);
        rotatedCount++;
      }
    }

    this.logger.info('Session keys rotated', { rotatedCount });
  }

  /**
   * Sign data with private key
   */
  signData(data: string | Buffer, privateKey: string, algorithm: SignatureAlgorithm = 'rsa-pss'): string {
    try {
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      let signOptions: any = {};
      
      switch (algorithm) {
        case 'rsa-pss':
          signOptions = {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
          };
          break;
        case 'ecdsa-p256':
          signOptions = privateKey;
          break;
        case 'ed25519':
          signOptions = privateKey;
          break;
        default:
          throw new KeyManagementError(`Unsupported signature algorithm: ${algorithm}`);
      }

      const signature = crypto.sign('sha256', dataBuffer, signOptions);
      return signature.toString('base64');
    } catch (error) {
      this.logger.error('Data signing failed', error);
      throw new KeyManagementError('Data signing failed', { error });
    }
  }

  /**
   * Verify signature
   */
  verifySignature(
    data: string | Buffer, 
    signature: string, 
    publicKey: string, 
    algorithm: SignatureAlgorithm = 'rsa-pss'
  ): boolean {
    try {
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      let verifyOptions: any = {};
      
      switch (algorithm) {
        case 'rsa-pss':
          verifyOptions = {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
          };
          break;
        case 'ecdsa-p256':
          verifyOptions = publicKey;
          break;
        case 'ed25519':
          verifyOptions = publicKey;
          break;
        default:
          throw new KeyManagementError(`Unsupported signature algorithm: ${algorithm}`);
      }

      return crypto.verify('sha256', dataBuffer, verifyOptions, signatureBuffer);
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  /**
   * Export key to JWK format
   */
  exportKeyToJWK(keyPair: KeyPair): any {
    try {
      // This is a simplified JWK export - in production you'd want a proper JWK library
      return {
        kty: keyPair.algorithm.startsWith('rsa') ? 'RSA' : 'EC',
        alg: keyPair.algorithm,
        use: 'sig',
        key_ops: ['sign', 'verify'],
        created: keyPair.createdAt.toISOString(),
        // Note: In production, you'd properly encode the key components
        public_key: keyPair.publicKey,
        private_key: keyPair.privateKey
      };
    } catch (error) {
      this.logger.error('Key export to JWK failed', error);
      throw new KeyManagementError('Key export to JWK failed', { error });
    }
  }
  /**
   * Import key from JWK format
   */
  importKeyFromJWK(jwk: any): KeyPair {
    try {
      // Validate required JWK fields
      if (!jwk || typeof jwk !== 'object') {
        throw new Error('Invalid JWK: must be an object');
      }
      
      if (!jwk.public_key || typeof jwk.public_key !== 'string') {
        throw new Error('Invalid JWK: missing or invalid public_key');
      }
      
      if (!jwk.private_key || typeof jwk.private_key !== 'string') {
        throw new Error('Invalid JWK: missing or invalid private_key');
      }
      
      if (!jwk.alg || typeof jwk.alg !== 'string') {
        throw new Error('Invalid JWK: missing or invalid algorithm');
      }

      const keyPair: KeyPair = {
        publicKey: jwk.public_key,
        privateKey: jwk.private_key,
        algorithm: jwk.alg,
        format: 'jwk',
        createdAt: new Date(jwk.created || Date.now()),
        expiresAt: jwk.expires ? new Date(jwk.expires) : undefined
      };

      const keyId = uuidv4();
      this.keys.set(keyId, keyPair);
      
      this.logger.info('Key imported from JWK', { keyId });
      return keyPair;
    } catch (error) {
      this.logger.error('Key import from JWK failed', error);
      throw new KeyManagementError('Key import from JWK failed', { error });
    }
  }
  /**
   * Start automatic key rotation
   */
  private startKeyRotation(): void {
    this.rotationTimer = setInterval(() => {
      this.rotateSessionKeys();
    }, this.rotationInterval);
    
    this.logger.info('Key rotation started', { 
      rotationInterval: this.rotationInterval,
      maxKeyAge: this.maxKeyAge
    });
  }

  /**
   * Stop automatic key rotation and cleanup resources
   */
  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
      this.logger.info('Key rotation stopped');
    }
  }

  /**
   * Get key statistics
   */
  getKeyStatistics(): {
    totalKeys: number;
    sessionKeys: number;
    expiredKeys: number;
    nearExpiration: number;
  } {
    const now = new Date();
    const nearExpirationThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    let expiredKeys = 0;
    let nearExpiration = 0;

    for (const key of this.sessionKeys.values()) {
      if (key.expiresAt < now) {
        expiredKeys++;
      } else if (key.expiresAt.getTime() - now.getTime() < nearExpirationThreshold) {
        nearExpiration++;
      }
    }

    return {
      totalKeys: this.keys.size,
      sessionKeys: this.sessionKeys.size,
      expiredKeys,
      nearExpiration
    };
  }

  /**
   * Cleanup expired keys
   */
  cleanupExpiredKeys(): number {
    const now = new Date();
    let cleanedCount = 0;

    // Clean session keys
    for (const [keyId, key] of this.sessionKeys.entries()) {
      if (key.expiresAt < now) {
        this.sessionKeys.delete(keyId);
        cleanedCount++;
      }
    }

    // Clean regular keys if they have expiration
    for (const [keyId, key] of this.keys.entries()) {
      if (key.expiresAt && key.expiresAt < now) {
        this.keys.delete(keyId);
        cleanedCount++;
      }
    }

    this.logger.info('Expired keys cleaned up', { cleanedCount });
    return cleanedCount;
  }
}
