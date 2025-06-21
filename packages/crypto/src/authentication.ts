import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Logger } from '@ekd-desk/shared';
import { AuthToken, AuthenticationError } from './types';

/**
 * Authentication service for EKD Desk
 * Handles JWT tokens, password hashing, and authentication flows
 */
export class AuthenticationService {
  private logger: Logger;
  private jwtSecret: string;
  private tokenExpiry: number;
  private refreshTokenExpiry: number;
  private revokedTokens: Set<string> = new Set();
  private tokenStatistics = {
    totalTokensIssued: 0,
    activeTokens: 0,
    revokedTokens: 0,
    expiredTokens: 0
  };
  constructor(
    jwtSecret: string,
    tokenExpiry: number = 24 * 60 * 60 * 1000, // 24 hours
    refreshTokenExpiry: number = 30 * 24 * 60 * 60 * 1000 // 30 days
  ) {
    this.logger = Logger.createLogger('AuthenticationService');
    
    // Validate JWT secret
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new AuthenticationError('JWT secret cannot be empty');
    }
    
    if (jwtSecret.length < 32) {
      throw new AuthenticationError('JWT secret must be at least 32 characters long');
    }
    
    this.jwtSecret = jwtSecret;
    this.tokenExpiry = tokenExpiry;
    this.refreshTokenExpiry = refreshTokenExpiry;
  }
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string, saltRounds: number = 12): Promise<string> {
    try {
      // Validate password
      if (!password || password.trim() === '') {
        throw new AuthenticationError('Password cannot be empty');
      }
      
      // Check password length limits
      if (password.length > 128) {
        throw new AuthenticationError('Password too long. Maximum length is 128 characters.');
      }
      
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      this.logger.error('Password hashing failed', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Password hashing failed', { error });
    }
  }

  /**
   * Verify a password against its hash
   */  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      // Validate inputs
      if (!password || password.trim() === '') {
        throw new AuthenticationError('Password cannot be empty');
      }
      if (!hashedPassword || hashedPassword.trim() === '') {
        throw new AuthenticationError('Hash cannot be empty');
      }

      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      this.logger.error('Password verification failed', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Password verification failed', { error });
    }
  }

  /**
   * Generate an access token
   */
  generateAccessToken(
    userId: string,
    permissions: string[] = [],
    expiresIn?: string | number
  ): AuthToken {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (expiresIn as number || this.tokenExpiry));
      
      const payload = {
        userId,
        permissions,
        type: 'access',
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      });

      return {
        token,
        type: 'access',
        userId,
        permissions,
        issuedAt: now,
        expiresAt,
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      };
    } catch (error) {
      this.logger.error('Access token generation failed', error);
      throw new AuthenticationError('Access token generation failed', { error });
    }
  }

  /**
   * Generate a refresh token
   */
  generateRefreshToken(userId: string): AuthToken {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.refreshTokenExpiry);
      
      const payload = {
        userId,
        type: 'refresh',
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      });

      return {
        token,
        type: 'refresh',
        userId,
        permissions: [],
        issuedAt: now,
        expiresAt,
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      };
    } catch (error) {
      this.logger.error('Refresh token generation failed', error);
      throw new AuthenticationError('Refresh token generation failed', { error });
    }
  }

  /**
   * Generate a session token
   */
  generateSessionToken(
    userId: string,
    sessionId: string,
    permissions: string[] = []
  ): AuthToken {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.tokenExpiry);
      
      const payload = {
        userId,
        sessionId,
        permissions,
        type: 'session',
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      });

      return {
        token,
        type: 'session',
        userId,
        permissions,
        issuedAt: now,
        expiresAt,
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      };
    } catch (error) {
      this.logger.error('Session token generation failed', error);
      throw new AuthenticationError('Session token generation failed', { error });
    }
  }

  /**
   * Verify and decode a token
   */  verifyToken(token: string): jwt.JwtPayload {
    try {
      // Validate input
      if (!token || token.trim() === '') {
        throw new AuthenticationError('Token cannot be empty');
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'ekd-desk',
        audience: 'ekd-desk-client'
      }) as jwt.JwtPayload;

      return decoded;
    } catch (error: any) {
      this.logger.error('Token verification failed', error);
      
      // Check for specific JWT errors
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token has expired', { error });
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token', { error });
      }
      if (error.name === 'NotBeforeError') {
        throw new AuthenticationError('Token not active yet', { error });
      }
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new AuthenticationError('Token verification failed', { error });
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  refreshAccessToken(refreshToken: string, permissions: string[] = []): AuthToken {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type for refresh');
      }

      return this.generateAccessToken(decoded.userId, permissions);
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw new AuthenticationError('Token refresh failed', { error });
    }
  }

  /**
   * Refresh token and generate new access and refresh tokens
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type for refresh');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(decoded.userId, decoded.permissions || []);
      const newRefreshToken = this.generateRefreshToken(decoded.userId);

      return {
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken.token
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Token refresh failed', { error });
    }
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Decode a token without verification (for inspection)
   */
  decodeToken(token: string): jwt.JwtPayload | null {
    try {
      if (!token || token.trim() === '') {
        return null;
      }
      
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      return decoded;
    } catch (error) {
      this.logger.error('Token decoding failed', error);
      return null;
    }
  }
  /**
   * Generate API key with validation
   */
  generateApiKey(length: number = 64): string {
    if (length <= 0 || length > 512) {
      throw new AuthenticationError('Invalid API key length. Must be between 1 and 512 characters.');
    }

    // Generate pure hex string of specified length
    const hexLength = Math.ceil(length / 2);
    const apiKey = crypto.randomBytes(hexLength).toString('hex').substring(0, length);
    
    this.tokenStatistics.totalTokensIssued++;
    this.tokenStatistics.activeTokens++;
    
    return apiKey;
  }

  /**
   * Verify API key format and validity
   */
  verifyApiKey(apiKey: string): boolean {
    try {
      if (!apiKey || apiKey.trim() === '') {
        return false;
      }

      // Check if it's a valid hex string of expected length (64 characters default)
      const hexPattern = /^[a-f0-9]+$/i;
      
      // Allow various lengths but must be hex
      if (!hexPattern.test(apiKey)) {
        return false;
      }

      // Must be reasonable length
      if (apiKey.length < 16 || apiKey.length > 512) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('API key verification failed', error);
      return false;
    }
  }

  /**
   * Generate a generic token (wrapper for access token generation)
   */  async generateToken(tokenData: {
    userId: string;
    permissions?: string[];
    expiresIn?: string | number;
    type?: string;
  }): Promise<string> {
    try {
      // Validate token data
      if (!tokenData || !tokenData.userId || tokenData.userId.trim() === '') {
        throw new AuthenticationError('Invalid token data: userId is required');
      }

      const authToken = this.generateAccessToken(
        tokenData.userId,
        tokenData.permissions || [],
        tokenData.expiresIn
      );
      
      this.tokenStatistics.totalTokensIssued++;
      this.tokenStatistics.activeTokens++;
      
      return authToken.token;
    } catch (error) {
      this.logger.error('Generic token generation failed', error);
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Token generation failed', { error });
    }
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): void {
    if (!token || token.trim() === '') {
      throw new AuthenticationError('Cannot revoke empty token');
    }

    this.revokedTokens.add(token);
    this.tokenStatistics.revokedTokens++;
    if (this.tokenStatistics.activeTokens > 0) {
      this.tokenStatistics.activeTokens--;
    }
    
    this.logger.info('Token revoked', { tokenHash: crypto.createHash('sha256').update(token).digest('hex').substring(0, 8) });
  }

  /**
   * Check if a token is revoked
   */
  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  /**
   * Get token statistics
   */
  getTokenStatistics(): typeof this.tokenStatistics {
    return { ...this.tokenStatistics };
  }

  /**
   * Create HMAC signature
   */
  createSignature(data: string, secret?: string): string {
    const key = secret || this.jwtSecret;
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(data: string, signature: string, secret?: string): boolean {
    const key = secret || this.jwtSecret;
    const expectedSignature = crypto.createHmac('sha256', key).update(data).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Generate one-time password (OTP)
   */
  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += digits[crypto.randomInt(0, digits.length)];
    }
    return result;
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId: string, expiryMinutes: number = 30): string {
    const payload = {
      userId,
      purpose: 'password-reset',
      exp: Math.floor((Date.now() + expiryMinutes * 60 * 1000) / 1000)
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token: string): { userId: string; valid: boolean } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      
      if (decoded.purpose !== 'password-reset') {
        return { userId: '', valid: false };
      }

      return { userId: decoded.userId, valid: true };
    } catch (error) {
      this.logger.error('Password reset token verification failed', error);
      return { userId: '', valid: false };
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded || !decoded.exp) return true;
      
      return Date.now() >= decoded.exp * 1000;
    } catch (error) {
      return true;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
