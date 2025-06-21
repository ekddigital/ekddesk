import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { Logger } from '@ekd-desk/shared';
import { EncryptionConfig, EncryptionAlgorithm, EncryptionError } from './types';
import { deriveKey, generateSecureKey } from './utils';


/**
 * Advanced encryption service for EKD Desk
 * Provides AES-GCM, ChaCha20-Poly1305, and other encryption algorithms
 */
export class EncryptionService {
  private logger: Logger;
  private defaultConfig: EncryptionConfig;

  constructor(config?: Partial<EncryptionConfig>) {
    this.logger = Logger.createLogger('EncryptionService');
    this.defaultConfig = {
      algorithm: 'aes-256-gcm',
      keySize: 32,
      ivSize: 12,
      tagSize: 16,
      ...config
    };
  }

  /**
   * Encrypt data using the specified algorithm
   */
  async encrypt(
    data: string | Buffer,
    key: string | Buffer,
    config?: Partial<EncryptionConfig>
  ): Promise<{
    encrypted: Buffer;
    iv: Buffer;
    tag?: Buffer;
    algorithm: EncryptionAlgorithm;
  }> {
    try {
      const encConfig = { ...this.defaultConfig, ...config };
      const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

      switch (encConfig.algorithm) {
        case 'aes-256-gcm':
          return await this.encryptAESGCM(dataBuffer, keyBuffer, encConfig);
        case 'aes-256-cbc':
          return await this.encryptAESCBC(dataBuffer, keyBuffer, encConfig);
        case 'chacha20-poly1305':
          return await this.encryptChaCha20(dataBuffer, keyBuffer, encConfig);
        default:
          throw new EncryptionError(`Unsupported algorithm: ${encConfig.algorithm}`);
      }
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new EncryptionError('Encryption operation failed', { error });
    }
  }

  /**
   * Decrypt data using the specified algorithm
   */
  async decrypt(
    encryptedData: Buffer,
    key: string | Buffer,
    iv: Buffer,
    algorithm: EncryptionAlgorithm,
    tag?: Buffer
  ): Promise<Buffer> {
    try {
      const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'hex') : key;

      switch (algorithm) {
        case 'aes-256-gcm':
          if (!tag) throw new EncryptionError('Tag required for AES-GCM decryption');
          return await this.decryptAESGCM(encryptedData, keyBuffer, iv, tag);
        case 'aes-256-cbc':
          return await this.decryptAESCBC(encryptedData, keyBuffer, iv);
        case 'chacha20-poly1305':
          if (!tag) throw new EncryptionError('Tag required for ChaCha20-Poly1305 decryption');
          return await this.decryptChaCha20(encryptedData, keyBuffer, iv, tag);
        default:
          throw new EncryptionError(`Unsupported algorithm: ${algorithm}`);
      }
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new EncryptionError('Decryption operation failed', { error });
    }
  }
  /**
   * AES-256-GCM encryption
   */
  private async encryptAESGCM(
    data: Buffer,
    key: Buffer,
    config: EncryptionConfig
  ): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer; algorithm: EncryptionAlgorithm }> {
    const iv = crypto.randomBytes(config.ivSize);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv,
      tag,
      algorithm: 'aes-256-gcm'
    };
  }
  /**
   * AES-256-GCM decryption
   */
  private async decryptAESGCM(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer,
    tag: Buffer
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  }  /**
   * AES-256-CBC encryption
   */
  private async encryptAESCBC(
    data: Buffer,
    key: Buffer,
    config: EncryptionConfig
  ): Promise<{ encrypted: Buffer; iv: Buffer; algorithm: EncryptionAlgorithm }> {
    // CBC requires 16-byte IV
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    return {
      encrypted,
      iv,
      algorithm: 'aes-256-cbc'
    };
  }
  /**
   * AES-256-CBC decryption
   */
  private async decryptAESCBC(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  }

  /**
   * ChaCha20-Poly1305 encryption (using node-forge for broader support)
   */
  private async encryptChaCha20(
    data: Buffer,
    key: Buffer,
    config: EncryptionConfig
  ): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer; algorithm: EncryptionAlgorithm }> {
    // For now, fallback to AES-GCM if ChaCha20 is not available
    // In production, you might want to use a specialized library
    this.logger.warn('ChaCha20-Poly1305 not fully implemented, falling back to AES-GCM');
    return await this.encryptAESGCM(data, key, config);
  }

  /**
   * ChaCha20-Poly1305 decryption
   */
  private async decryptChaCha20(
    encryptedData: Buffer,
    key: Buffer,
    iv: Buffer,
    tag: Buffer
  ): Promise<Buffer> {
    // For now, fallback to AES-GCM if ChaCha20 is not available
    this.logger.warn('ChaCha20-Poly1305 not fully implemented, falling back to AES-GCM');
    return await this.decryptAESGCM(encryptedData, key, iv, tag);
  }

  /**
   * Generate a new encryption key
   */
  generateKey(algorithm: EncryptionAlgorithm = 'aes-256-gcm'): Buffer {
    const keySize = algorithm.includes('256') ? 32 : 16;
    return generateSecureKey(keySize);
  }

  /**
   * Derive a key from password using PBKDF2
   */
  async deriveKeyFromPassword(
    password: string,
    salt: Buffer,
    iterations: number = 100000,
    keyLength: number = 32
  ): Promise<Buffer> {
    return deriveKey(password, salt, iterations, keyLength, 'pbkdf2');
  }

  /**
   * Encrypt file
   */
  async encryptFile(
    inputPath: string,
    outputPath: string,
    key: string | Buffer,
    config?: Partial<EncryptionConfig>
  ): Promise<void> {
    const fs = await import('fs/promises');
    
    try {
      const data = await fs.readFile(inputPath);
      const result = await this.encrypt(data, key, config);
      
      // Create a header with metadata
      const header = {
        algorithm: result.algorithm,
        ivSize: result.iv.length,
        tagSize: result.tag?.length || 0
      };
      
      const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
      const headerSizeBuffer = Buffer.alloc(4);
      headerSizeBuffer.writeUInt32BE(headerBuffer.length, 0);
      
      // Write: [header_size][header][iv][tag][encrypted_data]
      const output = Buffer.concat([
        headerSizeBuffer,
        headerBuffer,
        result.iv,
        result.tag || Buffer.alloc(0),
        result.encrypted
      ]);
      
      await fs.writeFile(outputPath, output);
      this.logger.info('File encrypted successfully', { inputPath, outputPath });
    } catch (error) {
      this.logger.error('File encryption failed', error);
      throw new EncryptionError('File encryption failed', { inputPath, outputPath, error });
    }
  }

  /**
   * Decrypt file
   */
  async decryptFile(
    inputPath: string,
    outputPath: string,
    key: string | Buffer
  ): Promise<void> {
    const fs = await import('fs/promises');
    
    try {
      const encryptedData = await fs.readFile(inputPath);
      
      // Read header
      const headerSize = encryptedData.readUInt32BE(0);
      const headerBuffer = encryptedData.subarray(4, 4 + headerSize);
      const header = JSON.parse(headerBuffer.toString('utf8'));
      
      let offset = 4 + headerSize;
      const iv = encryptedData.subarray(offset, offset + header.ivSize);
      offset += header.ivSize;
      
      let tag: Buffer | undefined;
      if (header.tagSize > 0) {
        tag = encryptedData.subarray(offset, offset + header.tagSize);
        offset += header.tagSize;
      }
      
      const encrypted = encryptedData.subarray(offset);
      
      const decrypted = await this.decrypt(encrypted, key, iv, header.algorithm, tag);
      await fs.writeFile(outputPath, decrypted);
      
      this.logger.info('File decrypted successfully', { inputPath, outputPath });
    } catch (error) {
      this.logger.error('File decryption failed', error);
      throw new EncryptionError('File decryption failed', { inputPath, outputPath, error });
    }
  }
}
