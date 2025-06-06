import { z } from 'zod';

// Cryptographic algorithm types
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
export type HashAlgorithm = 'sha256' | 'sha512' | 'blake2b';
export type KeyDerivationFunction = 'pbkdf2' | 'scrypt' | 'argon2id';
export type SignatureAlgorithm = 'rsa-pss' | 'ecdsa-p256' | 'ed25519';

// Key formats
export type KeyFormat = 'raw' | 'pkcs8' | 'spki' | 'jwk';
export type KeyType = 'symmetric' | 'asymmetric-public' | 'asymmetric-private';

// Certificate types
export type CertificateFormat = 'pem' | 'der' | 'p12';
export type CertificateType = 'self-signed' | 'ca-signed' | 'intermediate' | 'ca' | 'client' | 'server';

// Security schemas
export const EncryptionConfigSchema = z.object({
  algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305']),
  keySize: z.number().int().positive(),
  ivSize: z.number().int().positive(),
  tagSize: z.number().int().positive().optional(),
  iterations: z.number().int().positive().optional()
});

export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;

export const KeyPairSchema = z.object({
  publicKey: z.string(),
  privateKey: z.string(),
  algorithm: z.string(),
  format: z.enum(['raw', 'pkcs8', 'spki', 'jwk']),
  createdAt: z.date(),
  expiresAt: z.date().optional()
});

export type KeyPair = z.infer<typeof KeyPairSchema>;

export const CertificateSchema = z.object({
  certificate: z.string(),
  privateKey: z.string().optional(),
  publicKey: z.string(),
  subject: z.string(),
  issuer: z.string(),
  serialNumber: z.string(),
  notBefore: z.date(),
  notAfter: z.date(),
  fingerprint: z.string(),
  format: z.enum(['pem', 'der', 'p12']),
  type: z.enum(['self-signed', 'ca-signed', 'intermediate', 'ca', 'client', 'server'])
});

export type Certificate = z.infer<typeof CertificateSchema>;

export const SessionKeySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  algorithm: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  usageCount: z.number().int().nonnegative(),
  maxUsage: z.number().int().positive(),
  sessionId: z.string().uuid()
});

export type SessionKey = z.infer<typeof SessionKeySchema>;

export const AuthTokenSchema = z.object({
  token: z.string(),
  type: z.enum(['access', 'refresh', 'session']),
  userId: z.string().uuid(),
  permissions: z.array(z.string()),
  issuedAt: z.date(),
  expiresAt: z.date(),
  issuer: z.string(),
  audience: z.string()
});

export type AuthToken = z.infer<typeof AuthTokenSchema>;

// Security event types
export interface SecurityEvent {
  type: string;
  timestamp: Date;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
}

export interface EncryptionEvent extends SecurityEvent {
  algorithm: EncryptionAlgorithm;
  keyId?: string;
  success: boolean;
}

export interface AuthenticationEvent extends SecurityEvent {
  userId?: string;
  action: 'login' | 'logout' | 'token-refresh' | 'failed-attempt';
  clientInfo?: {
    ip: string;
    userAgent: string;
    deviceId: string;
  };
}

export interface CertificateEvent extends SecurityEvent {
  certificateId: string;
  action: 'created' | 'renewed' | 'revoked' | 'expired';
  subject: string;
}

// Error types
export class CryptoError extends Error {
  public readonly code: string;
  public readonly context?: any;

  constructor(message: string, code: string, context?: any) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.context = context;
  }
}

export class EncryptionError extends CryptoError {
  constructor(message: string, context?: any) {
    super(message, 'ENCRYPTION_ERROR', context);
    this.name = 'EncryptionError';
  }
}

export class KeyManagementError extends CryptoError {
  constructor(message: string, context?: any) {
    super(message, 'KEY_MANAGEMENT_ERROR', context);
    this.name = 'KeyManagementError';
  }
}

export class AuthenticationError extends CryptoError {
  constructor(message: string, context?: any) {
    super(message, 'AUTHENTICATION_ERROR', context);
    this.name = 'AuthenticationError';
  }
}

export class CertificateError extends CryptoError {
  constructor(message: string, context?: any) {
    super(message, 'CERTIFICATE_ERROR', context);
    this.name = 'CertificateError';
  }
}
