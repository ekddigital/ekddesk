import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { Logger } from "@ekd-desk/shared";
import { AuthenticationService } from "@ekd-desk/crypto";
import { config } from "../config/config";
import { DatabaseService } from "../services/database.service";
import { RedisService } from "../services/redis.service";
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
  RateLimitError,
} from "../middleware/error.middleware";

interface DeviceCredentials {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  platform: string;
  publicKey: string;
  password?: string;
}

interface LoginRequest {
  deviceId: string;
  password?: string;
  privateKey?: string;
  challenge?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Authentication Controller for EKD Desk
 * Handles device registration, login, logout, and token management
 */
export class AuthenticationController {
  private router: Router;
  private logger: Logger;
  private authService: AuthenticationService;
  private dbService: DatabaseService;
  private redisService: RedisService;

  // Validation schemas
  private registerSchema = Joi.object({
    deviceId: Joi.string().uuid().required(),
    deviceName: Joi.string().min(1).max(255).required(),
    deviceType: Joi.string().valid("desktop", "mobile", "web").required(),
    platform: Joi.string().min(1).max(255).required(),
    publicKey: Joi.string().required(),
    password: Joi.string().min(8).max(128).optional(),
  });

  private loginSchema = Joi.object({
    deviceId: Joi.string().uuid().required(),
    password: Joi.string().max(128).optional(),
    privateKey: Joi.string().optional(),
    challenge: Joi.string().optional(),
  }).or("password", "privateKey");

  private refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
  });
  constructor(dbService: DatabaseService, redisService: RedisService) {
    this.router = Router();
    this.logger = Logger.createLogger("AuthController");
    this.authService = new AuthenticationService(
      config.jwt.accessTokenSecret,
      24 * 60 * 60 * 1000
    ); // 24 hours
    this.dbService = dbService;
    this.redisService = redisService;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/register", this.register.bind(this));
    this.router.post("/login", this.login.bind(this));
    this.router.post("/logout", this.logout.bind(this));
    this.router.post("/refresh", this.refreshToken.bind(this));
    this.router.post("/revoke", this.revokeAccess.bind(this));
    this.router.get("/challenge/:deviceId", this.getChallenge.bind(this));
  }

  /**
   * Register a new device
   */
  public async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const { error, value } = this.registerSchema.validate(req.body);
      if (error) {
        throw new ValidationError("Invalid registration data", error.details);
      }

      const deviceData: DeviceCredentials = value;

      // Check if device already exists
      const existingDevice = await this.dbService.getDevice(
        deviceData.deviceId
      );
      if (existingDevice) {
        throw new ConflictError("Device already registered");
      } // Validate public key format (simplified for now)
      try {
        // TODO: Implement proper public key validation
        // await this.authService.validatePublicKey(deviceData.publicKey);
        if (!deviceData.publicKey || deviceData.publicKey.length < 32) {
          throw new Error("Invalid public key format");
        }
      } catch (error) {
        throw new ValidationError("Invalid public key format");
      }

      // Hash password if provided
      let hashedPassword: string | null = null;
      if (deviceData.password) {
        hashedPassword = await bcrypt.hash(
          deviceData.password,
          config.security.bcryptRounds
        );
      }

      // Generate device token for future authentication
      const deviceToken = this.authService.generateSecureToken(
        config.security.deviceTokenLength
      );

      // Store device in database
      const device = await this.dbService.createDevice({
        id: deviceData.deviceId,
        name: deviceData.deviceName,
        type: deviceData.deviceType,
        platform: deviceData.platform,
        publicKey: deviceData.publicKey,
        passwordHash: hashedPassword,
        deviceToken: deviceToken,
        isActive: true,
      });

      this.logger.info("Device registered successfully", {
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
      });

      res.status(201).json({
        success: true,
        message: "Device registered successfully",
        data: {
          deviceId: device.id,
          deviceName: device.name,
          deviceToken: deviceToken,
          registeredAt: device.registeredAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Authenticate device and generate tokens
   */
  public async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const { error, value } = this.loginSchema.validate(req.body);
      if (error) {
        throw new ValidationError("Invalid login data", error.details);
      }

      const loginData: LoginRequest = value;

      // Check rate limiting
      await this.checkRateLimit(loginData.deviceId);

      // Get device from database
      const device = await this.dbService.getDevice(loginData.deviceId);
      if (!device || !device.isActive) {
        await this.recordFailedAttempt(loginData.deviceId);
        throw new AuthenticationError("Invalid credentials");
      }

      // Verify authentication method
      let isAuthenticated = false;

      if (loginData.password && device.passwordHash) {
        // Password-based authentication
        isAuthenticated = await bcrypt.compare(
          loginData.password,
          device.passwordHash
        );
      } else if (loginData.privateKey && loginData.challenge) {
        // Cryptographic authentication (simplified for now)
        // TODO: Implement proper challenge verification
        isAuthenticated = true; // Placeholder
        this.logger.warn("Using placeholder challenge verification", {
          deviceId: loginData.deviceId,
        });
      } else {
        throw new ValidationError("Invalid authentication method");
      }

      if (!isAuthenticated) {
        await this.recordFailedAttempt(loginData.deviceId);
        throw new AuthenticationError("Invalid credentials");
      }

      // Clear failed attempts on successful login
      await this.clearFailedAttempts(loginData.deviceId);

      // Generate tokens
      const tokens = await this.generateTokens(device);

      // Update last login time
      await this.dbService.updateDeviceLastLogin(device.id);

      // Store refresh token in Redis
      await this.redisService.storeRefreshToken(
        device.id,
        tokens.refreshToken,
        config.jwt.refreshTokenExpiry
      );

      this.logger.info("Device authenticated successfully", {
        deviceId: device.id,
        deviceName: device.name,
        authMethod: loginData.password ? "password" : "cryptographic",
      });

      res.json({
        success: true,
        message: "Authentication successful",
        data: {
          deviceId: device.id,
          deviceName: device.name,
          tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout device and invalidate tokens
   */
  public async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AuthenticationError("No token provided");
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret) as any;
      const deviceId = decoded.deviceId;

      // Invalidate refresh tokens
      await this.redisService.invalidateRefreshTokens(deviceId);

      // Add access token to blacklist
      await this.redisService.blacklistToken(token, decoded.exp);

      this.logger.info("Device logged out successfully", { deviceId });

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AuthenticationError("Invalid token"));
      } else {
        next(error);
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { error, value } = this.refreshSchema.validate(req.body);
      if (error) {
        throw new ValidationError("Invalid refresh token data", error.details);
      }

      const { refreshToken } = value;

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshTokenSecret
      ) as any;
      const deviceId = decoded.deviceId;

      // Check if refresh token exists in Redis
      const storedToken = await this.redisService.getRefreshToken(deviceId);
      if (!storedToken || storedToken !== refreshToken) {
        throw new AuthenticationError("Invalid refresh token");
      }

      // Get device
      const device = await this.dbService.getDevice(deviceId);
      if (!device || !device.isActive) {
        throw new AuthenticationError("Device not found or inactive");
      }

      // Generate new tokens
      const tokens = await this.generateTokens(device);

      // Store new refresh token
      await this.redisService.storeRefreshToken(
        deviceId,
        tokens.refreshToken,
        config.jwt.refreshTokenExpiry
      );

      this.logger.info("Tokens refreshed successfully", { deviceId });

      res.json({
        success: true,
        message: "Tokens refreshed successfully",
        data: { tokens },
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AuthenticationError("Invalid refresh token"));
      } else {
        next(error);
      }
    }
  }

  /**
   * Revoke device access
   */
  public async revokeAccess(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { deviceId } = req.body;

      if (!deviceId) {
        throw new ValidationError("Device ID is required");
      }

      // Deactivate device
      await this.dbService.deactivateDevice(deviceId);

      // Invalidate all tokens
      await this.redisService.invalidateRefreshTokens(deviceId);

      this.logger.info("Device access revoked", { deviceId });

      res.json({
        success: true,
        message: "Device access revoked successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get authentication challenge for cryptographic auth
   */
  public async getChallenge(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { deviceId } = req.params;

      // Validate device ID
      if (!deviceId || !this.isValidUUID(deviceId)) {
        throw new ValidationError("Invalid device ID");
      }

      // Check if device exists
      const device = await this.dbService.getDevice(deviceId);
      if (!device || !device.isActive) {
        throw new AuthenticationError("Device not found or inactive");
      } // Generate challenge (simplified for now)
      const challenge = this.authService.generateSecureToken(64); // Generate random challenge

      // Store challenge temporarily (5 minutes)
      await this.redisService.storeChallenge(deviceId, challenge, 300);

      res.json({
        success: true,
        data: { challenge },
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  private async generateTokens(device: any): Promise<AuthTokens> {
    // Use AuthenticationService to generate tokens
    const accessToken = this.authService.generateAccessToken(
      device.id,
      [], // permissions
      config.jwt.accessTokenExpiry
    );

    const refreshToken = this.authService.generateRefreshToken(device.id);
    return {
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresIn: this.parseExpiry(config.jwt.accessTokenExpiry),
      tokenType: "Bearer",
    };
  }

  private async checkRateLimit(deviceId: string): Promise<void> {
    const key = `failed_attempts:${deviceId}`;
    const attempts = await this.redisService.get(key);
    const failedAttempts = attempts ? parseInt(attempts) : 0;

    if (failedAttempts >= config.security.maxLoginAttempts) {
      throw new RateLimitError(
        "Too many failed login attempts. Please try again later."
      );
    }
  }

  private async recordFailedAttempt(deviceId: string): Promise<void> {
    const key = `failed_attempts:${deviceId}`;
    const current = await this.redisService.get(key);
    const attempts = current ? parseInt(current) + 1 : 1;

    await this.redisService.setWithExpiry(
      key,
      attempts.toString(),
      config.security.lockoutDuration / 1000
    );
  }

  private async clearFailedAttempts(deviceId: string): Promise<void> {
    await this.redisService.delete(`failed_attempts:${deviceId}`);
  }

  private parseExpiry(expiry: string): number {
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

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  public getRouter(): Router {
    return this.router;
  }
}
