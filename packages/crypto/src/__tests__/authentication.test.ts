import { AuthenticationService } from '../authentication';
import { AuthenticationError, AuthToken } from '../types';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$mockedhashedpassword'),
  compare: jest.fn().mockImplementation((password: string, hash: string) => {
    return Promise.resolve(password === 'correct-password');
  }),
  genSalt: jest.fn().mockResolvedValue('$2a$10$mockedsalt')
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload: any, secret: string, options: any) => {
    return `mocked.jwt.token.${payload.userId}`;
  }),
  verify: jest.fn().mockImplementation((token: string, secret: string) => {
    if (token.startsWith('mocked.jwt.token.')) {
      const userId = token.split('.').pop();
      // Determine token type based on test context or token content
      const tokenType = token.includes('refresh') ? 'refresh' : 'access';
      return {
        userId,
        type: tokenType,
        permissions: ['read', 'write'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };
    }
    throw new Error('Invalid token');
  }),
  decode: jest.fn().mockImplementation((token: string) => {
    if (token.startsWith('mocked.jwt.token.')) {
      const userId = token.split('.').pop();
      return {
        userId,
        type: 'access',
        permissions: ['read', 'write']
      };
    }
    return null;
  })
}));

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  const testSecret = 'test-jwt-secret-that-is-32-characters-long-for-security';
  const testUserId = 'test-user-123';
  const testPassword = 'correct-password';
  const wrongPassword = 'wrong-password';

  beforeEach(() => {
    authService = new AuthenticationService(testSecret);
  });

  describe('Constructor', () => {    test('should create instance with provided secret', () => {
      const service = new AuthenticationService('custom-secret-that-is-32-chars-long');
      expect(service).toBeInstanceOf(AuthenticationService);
    });

    test('should throw error with empty secret', () => {
      expect(() => new AuthenticationService('')).toThrow(AuthenticationError);
    });

    test('should throw error with short secret', () => {
      expect(() => new AuthenticationService('short')).toThrow(AuthenticationError);
    });
  });

  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const hashedPassword = await authService.hashPassword(testPassword);
      
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).toBe('$2a$10$mockedhashedpassword');
    });

    test('should hash password with custom salt rounds', async () => {
      const hashedPassword = await authService.hashPassword(testPassword, 12);
      
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).toBe('$2a$10$mockedhashedpassword');
    });

    test('should throw error for empty password', async () => {
      await expect(authService.hashPassword('')).rejects.toThrow(AuthenticationError);
    });

    test('should throw error for too long password', async () => {
      const longPassword = 'a'.repeat(200);
      await expect(authService.hashPassword(longPassword)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Password Verification', () => {
    test('should verify correct password', async () => {
      const hash = '$2a$10$mockedhashedpassword';
      const isValid = await authService.verifyPassword(testPassword, hash);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const hash = '$2a$10$mockedhashedpassword';
      const isValid = await authService.verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    test('should throw error for empty password', async () => {
      const hash = '$2a$10$mockedhashedpassword';
      await expect(authService.verifyPassword('', hash)).rejects.toThrow(AuthenticationError);
    });

    test('should throw error for empty hash', async () => {
      await expect(authService.verifyPassword(testPassword, '')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('JWT Token Generation', () => {
    test('should generate access token', async () => {
      const tokenData = {
        userId: testUserId,
        permissions: ['read', 'write'],
        type: 'access' as const
      };

      const token = await authService.generateToken(tokenData);
      
      expect(typeof token).toBe('string');
      expect(token).toBe(`mocked.jwt.token.${testUserId}`);
    });

    test('should generate refresh token', async () => {
      const tokenData = {
        userId: testUserId,
        permissions: ['refresh'],
        type: 'refresh' as const
      };

      const token = await authService.generateToken(tokenData);
      
      expect(typeof token).toBe('string');
      expect(token).toBe(`mocked.jwt.token.${testUserId}`);
    });

    test('should generate session token', async () => {
      const tokenData = {
        userId: testUserId,
        permissions: ['session'],
        type: 'session' as const
      };

      const token = await authService.generateToken(tokenData);
      
      expect(typeof token).toBe('string');
      expect(token).toBe(`mocked.jwt.token.${testUserId}`);
    });    test('should generate token with custom expiration', async () => {
      const tokenData = {
        userId: testUserId,
        permissions: ['read'],
        type: 'access' as const,
        expiresIn: '2h'
      };

      const token = await authService.generateToken(tokenData);
      
      expect(typeof token).toBe('string');
      expect(token).toBe(`mocked.jwt.token.${testUserId}`);
    });

    test('should throw error for invalid token data', async () => {
      const invalidTokenData = {
        userId: '',
        permissions: [],
        type: 'access' as const
      };

      await expect(authService.generateToken(invalidTokenData)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('JWT Token Verification', () => {    test('should verify valid token', async () => {
      const validToken = `mocked.jwt.token.${testUserId}`;
      
      const decoded = authService.verifyToken(validToken);
      
      expect(decoded).toBeDefined();
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('type');
      expect(decoded).toHaveProperty('permissions');
      expect((decoded as any).userId).toBe(testUserId);
    });    test('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => authService.verifyToken(invalidToken)).toThrow(AuthenticationError);
    });

    test('should throw error for empty token', () => {
      expect(() => authService.verifyToken('')).toThrow(AuthenticationError);
    });
  });
  describe('JWT Token Refresh', () => {
    test('should refresh valid token', async () => {
      // Mock jwt.verify to return refresh token type for this test
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => ({
        userId: testUserId,
        type: 'refresh',
        permissions: [],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }));
      
      const refreshToken = `mocked.refresh.token.${testUserId}`;
      
      const newTokens = await authService.refreshToken(refreshToken);
      
      expect(newTokens).toHaveProperty('accessToken');
      expect(newTokens).toHaveProperty('refreshToken');
      expect(typeof newTokens.accessToken).toBe('string');
      expect(typeof newTokens.refreshToken).toBe('string');
    });

    test('should throw error for invalid refresh token', async () => {
      const invalidToken = 'invalid.refresh.token';
      
      await expect(authService.refreshToken(invalidToken)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('JWT Token Decoding', () => {    test('should decode valid token without verification', () => {
      const validToken = `mocked.jwt.token.${testUserId}`;
      
      const decoded = authService.decodeToken(validToken);
      
      expect(decoded).toBeDefined();
      expect(decoded).not.toBeNull();
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('type');
      expect(decoded).toHaveProperty('permissions');
      expect((decoded as any).userId).toBe(testUserId);
    });

    test('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      
      const decoded = authService.decodeToken(invalidToken);
      
      expect(decoded).toBeNull();
    });

    test('should return null for empty token', () => {
      const decoded = authService.decodeToken('');
      
      expect(decoded).toBeNull();
    });
  });

  describe('API Key Generation', () => {
    test('should generate API key with default length', () => {
      const apiKey = authService.generateApiKey();
      
      expect(typeof apiKey).toBe('string');
      expect(apiKey).toHaveLength(64); // Default length
      expect(/^[a-f0-9]+$/.test(apiKey)).toBe(true); // Should be hex
    });

    test('should generate API key with custom length', () => {
      const customLength = 32;
      const apiKey = authService.generateApiKey(customLength);
      
      expect(typeof apiKey).toBe('string');
      expect(apiKey).toHaveLength(customLength);
      expect(/^[a-f0-9]+$/.test(apiKey)).toBe(true);
    });

    test('should generate different API keys', () => {
      const apiKey1 = authService.generateApiKey();
      const apiKey2 = authService.generateApiKey();
      
      expect(apiKey1).not.toBe(apiKey2);
    });

    test('should throw error for invalid length', () => {
      expect(() => authService.generateApiKey(0)).toThrow(AuthenticationError);
      expect(() => authService.generateApiKey(-1)).toThrow(AuthenticationError);
      expect(() => authService.generateApiKey(1000)).toThrow(AuthenticationError);
    });
  });

  describe('API Key Verification', () => {
    test('should verify API key format', () => {
      const validApiKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      const isValid = authService.verifyApiKey(validApiKey);
      
      expect(isValid).toBe(true);
    });

    test('should reject invalid API key format', () => {
      const invalidApiKey1 = 'short';
      const invalidApiKey2 = 'invalid-chars-!@#$';
      const invalidApiKey3 = 'abcdef123456789'; // Odd length
      
      expect(authService.verifyApiKey(invalidApiKey1)).toBe(false);
      expect(authService.verifyApiKey(invalidApiKey2)).toBe(false);
      expect(authService.verifyApiKey(invalidApiKey3)).toBe(false);
    });

    test('should reject empty API key', () => {
      expect(authService.verifyApiKey('')).toBe(false);
    });
  });

  describe('Token Statistics', () => {
    test('should return token statistics', () => {
      const stats = authService.getTokenStatistics();
      
      expect(stats).toHaveProperty('totalTokensIssued');
      expect(stats).toHaveProperty('activeTokens');
      expect(stats).toHaveProperty('expiredTokens');
      expect(stats).toHaveProperty('revokedTokens');
      
      expect(typeof stats.totalTokensIssued).toBe('number');
      expect(typeof stats.activeTokens).toBe('number');
      expect(typeof stats.expiredTokens).toBe('number');
      expect(typeof stats.revokedTokens).toBe('number');
    });
  });

  describe('Token Revocation', () => {
    test('should add token to revocation list', () => {
      const token = `mocked.jwt.token.${testUserId}`;
      
      authService.revokeToken(token);
      
      const isRevoked = authService.isTokenRevoked(token);
      expect(isRevoked).toBe(true);
    });

    test('should check if token is revoked', () => {
      const token = `mocked.jwt.token.${testUserId}`;
      
      expect(authService.isTokenRevoked(token)).toBe(false);
      
      authService.revokeToken(token);
      
      expect(authService.isTokenRevoked(token)).toBe(true);
    });

    test('should handle empty token in revocation', () => {
      expect(() => authService.revokeToken('')).toThrow(AuthenticationError);
    });
  });

  describe('Error Handling', () => {
    test('should handle bcrypt errors gracefully', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.hash.mockRejectedValueOnce(new Error('Bcrypt error'));
      
      await expect(authService.hashPassword('password')).rejects.toThrow(AuthenticationError);
    });

    test('should handle JWT errors gracefully', async () => {
      const jwt = require('jsonwebtoken');
      jwt.sign.mockImplementationOnce(() => {
        throw new Error('JWT error');
      });
      
      const tokenData = {
        userId: testUserId,
        permissions: ['read'],
        type: 'access' as const
      };
      
      await expect(authService.generateToken(tokenData)).rejects.toThrow(AuthenticationError);
    });
  });
  describe('Configuration', () => {
    test('should use custom secret for token generation', async () => {
      const customSecret = 'custom-jwt-secret-for-testing-that-is-32-characters-long';
      const customAuthService = new AuthenticationService(customSecret);
      
      const tokenData = {
        userId: testUserId,
        permissions: ['read'],
        type: 'access' as const
      };
      
      const token = await customAuthService.generateToken(tokenData);
      
      expect(typeof token).toBe('string');
    });
  });
});
