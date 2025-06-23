import { createClient, RedisClientType } from "redis";
import { Logger } from "@ekd-desk/shared";
import { config } from "../config/config";

/**
 * Redis service for EKD Desk Auth Service
 * Handles caching, s  public async get(key: string): Promise<string | null> {
    if (!this.shouldPerformRedisOperation()) {
      return null;
    }
    
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error("Failed to get key from Redis", error);
      throw error;
    }
  }torage, and rate limiting
 */
export class RedisService {
  private client: RedisClientType;
  private logger: Logger;
  private isConnected = false;
  private isDevelopment = false;

  constructor() {
    this.logger = Logger.createLogger("RedisService");
    this.isDevelopment = config.env === "development";

    // Create Redis client
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        // Disable auto-connect in development
        connectTimeout: this.isDevelopment ? 1000 : 5000,
        reconnectStrategy: this.isDevelopment
          ? false
          : (retries) => Math.min(retries * 50, 500),
      },
      password: config.redis.password,
      database: config.redis.db,
    });

    // Handle Redis events
    this.client.on("error", (err) => {
      if (!this.isDevelopment) {
        this.logger.error("Redis error", err);
      }
    });

    this.client.on("connect", () => {
      this.logger.info("Redis connected");
      this.isConnected = true;
    });

    this.client.on("disconnect", () => {
      this.logger.warn("Redis disconnected");
      this.isConnected = false;
    });

    this.client.on("reconnecting", () => {
      if (!this.isDevelopment) {
        this.logger.info("Redis reconnecting");
      }
    });
  }

  /**
   * Initialize Redis connection
   */
  public async initialize(): Promise<void> {
    if (this.isDevelopment) {
      this.logger.info("Skipping Redis initialization in development mode");
      return;
    }

    try {
      await this.client.connect();

      // Test connection
      await this.client.ping();

      this.logger.info("Redis service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Redis service", error);
      throw error;
    }
  }

  /**
   * Check if Redis operations should be performed
   */
  private shouldPerformRedisOperation(): boolean {
    return !this.isDevelopment && this.isConnected;
  }

  /**
   * Store refresh token with expiration
   */
  public async storeRefreshToken(
    deviceId: string,
    token: string,
    expiry: string
  ): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      const key = `refresh_token:${deviceId}`;
      const expirySeconds = this.parseExpiryToSeconds(expiry);

      await this.client.setEx(key, expirySeconds, token);

      this.logger.debug("Refresh token stored", { deviceId, expiry });
    } catch (error) {
      this.logger.error("Failed to store refresh token", error);
      throw error;
    }
  }

  /**
   * Get refresh token for device
   */
  public async getRefreshToken(deviceId: string): Promise<string | null> {
    if (!this.shouldPerformRedisOperation()) {
      return null;
    }

    try {
      const key = `refresh_token:${deviceId}`;
      const token = await this.client.get(key);

      return token;
    } catch (error) {
      this.logger.error("Failed to get refresh token", error);
      throw error;
    }
  }

  /**
   * Invalidate all refresh tokens for device
   */
  public async invalidateRefreshTokens(deviceId: string): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      const key = `refresh_token:${deviceId}`;
      await this.client.del(key);

      this.logger.debug("Refresh tokens invalidated", { deviceId });
    } catch (error) {
      this.logger.error("Failed to invalidate refresh tokens", error);
      throw error;
    }
  }

  /**
   * Store authentication challenge temporarily
   */
  public async storeChallenge(
    deviceId: string,
    challenge: string,
    ttl: number
  ): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      const key = `challenge:${deviceId}`;
      await this.client.setEx(key, ttl, challenge);

      this.logger.debug("Challenge stored", { deviceId, ttl });
    } catch (error) {
      this.logger.error("Failed to store challenge", error);
      throw error;
    }
  }

  /**
   * Get and remove authentication challenge
   */
  public async getChallenge(deviceId: string): Promise<string | null> {
    if (!this.shouldPerformRedisOperation()) {
      return null;
    }

    try {
      const key = `challenge:${deviceId}`;
      const challenge = await this.client.get(key);

      if (challenge) {
        // Remove challenge after retrieval (one-time use)
        await this.client.del(key);
      }

      return challenge;
    } catch (error) {
      this.logger.error("Failed to get challenge", error);
      throw error;
    }
  }

  /**
   * Add access token to blacklist
   */
  public async blacklistToken(token: string, exp: number): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      const key = `blacklist:${token}`;
      const ttl = exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await this.client.setEx(key, ttl, "1");
        this.logger.debug("Token blacklisted", { ttl });
      }
    } catch (error) {
      this.logger.error("Failed to blacklist token", error);
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   */
  public async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.shouldPerformRedisOperation()) {
      return false; // Fail safe - don't block if Redis is not available
    }

    try {
      const key = `blacklist:${token}`;
      const exists = await this.client.exists(key);

      return exists === 1;
    } catch (error) {
      this.logger.error("Failed to check token blacklist", error);
      return false; // Fail safe - don't block if Redis is down
    }
  }

  /**
   * Generic get method
   */
  public async get(key: string): Promise<string | null> {
    if (!this.shouldPerformRedisOperation()) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error("Failed to get value", { key, error });
      throw error;
    }
  }

  /**
   * Generic set method
   */
  public async set(key: string, value: string): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      await this.client.set(key, value);
    } catch (error) {
      this.logger.error("Failed to set value", { key, error });
      throw error;
    }
  }

  /**
   * Set with expiration
   */
  public async setWithExpiry(
    key: string,
    value: string,
    ttl: number
  ): Promise<void> {
    if (!this.shouldPerformRedisOperation()) {
      return;
    }

    try {
      await this.client.setEx(key, ttl, value);
    } catch (error) {
      this.logger.error("Failed to set value with expiry", { key, ttl, error });
      throw error;
    }
  }

  /**
   * Delete key
   */
  public async delete(key: string): Promise<number> {
    if (!this.shouldPerformRedisOperation()) {
      return 0;
    }

    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error("Failed to delete key", { key, error });
      throw error;
    }
  }

  /**
   * Increment counter
   */
  public async increment(key: string): Promise<number> {
    if (!this.shouldPerformRedisOperation()) {
      return 0;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error("Failed to increment key", { key, error });
      throw error;
    }
  }

  /**
   * Set expiration on existing key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result;
    } catch (error) {
      this.logger.error("Failed to set expiration", { key, ttl, error });
      throw error;
    }
  }

  /**
   * Get keys matching pattern
   */
  public async getKeys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error("Failed to get keys", { pattern, error });
      throw error;
    }
  }

  /**
   * Rate limiting - check if action is allowed
   */
  public async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.client.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= limit) {
        const ttl = await this.client.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + ttl * 1000,
        };
      }

      // Increment counter
      await this.client.incr(key);

      // Set expiration if this is the first request
      if (count === 0) {
        await this.client.expire(key, windowSeconds);
      }

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    } catch (error) {
      this.logger.error("Failed to check rate limit", { identifier, error });
      // Fail safe - allow action if Redis is down
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  /**
   * Store user session data
   */
  public async storeSessionData(
    sessionId: string,
    data: object,
    ttl: number
  ): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.client.setEx(key, ttl, JSON.stringify(data));

      this.logger.debug("Session data stored", { sessionId, ttl });
    } catch (error) {
      this.logger.error("Failed to store session data", error);
      throw error;
    }
  }

  /**
   * Get user session data
   */
  public async getSessionData(sessionId: string): Promise<object | null> {
    try {
      const key = `session:${sessionId}`;
      const data = await this.client.get(key);

      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error("Failed to get session data", error);
      throw error;
    }
  }

  /**
   * Clear session data
   */
  public async clearSessionData(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.client.del(key);

      this.logger.debug("Session data cleared", { sessionId });
    } catch (error) {
      this.logger.error("Failed to clear session data", error);
      throw error;
    }
  }

  /**
   * Get Redis health status
   */
  public async getHealthStatus(): Promise<{
    isHealthy: boolean;
    details: any;
  }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;

      return {
        isHealthy: this.isConnected,
        details: {
          connected: this.isConnected,
          responseTime: `${responseTime}ms`,
          host: config.redis.host,
          port: config.redis.port,
          database: config.redis.db,
        },
      };
    } catch (error) {
      return {
        isHealthy: false,
        details: {
          connected: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info("Redis connection closed");
    } catch (error) {
      this.logger.error("Error closing Redis connection", error);
    }
  }

  // Helper methods

  private parseExpiryToSeconds(expiry: string): number {
    const units: { [key: string]: number } = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }
}
