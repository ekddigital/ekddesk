import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  
  server: {
    port: parseInt(process.env.AUTH_PORT || '3002'),
    host: process.env.AUTH_HOST || '0.0.0.0',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'ekd_desk_auth',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  },

  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'ekd-desk-access-secret-dev',
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'ekd-desk-refresh-secret-dev',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'ekd-desk',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15 minutes
    deviceTokenLength: parseInt(process.env.DEVICE_TOKEN_LENGTH || '32'),
  },

  cors: {
    allowedOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  },

  session: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5'),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
    cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '300000'), // 5 minutes
  },
};
