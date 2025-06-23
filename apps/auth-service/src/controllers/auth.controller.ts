import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import { Logger } from "@ekd-desk/shared";
import { AuthenticationService } from "@ekd-desk/crypto";
import { DeviceType } from "@prisma/client";
import { config } from "../config/config";
import { DatabaseService } from "../services/database.service.simple";
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
    deviceId: Joi.string()
      .length(10)
      .pattern(/^[A-Z0-9]+$/)
      .required(),
    deviceName: Joi.string().min(1).max(255).required(),
    deviceType: Joi.string()
      .valid("desktop", "mobile", "web", "DESKTOP", "MOBILE", "WEB")
      .required(),
    platform: Joi.string().min(1).max(255).required(),
    publicKey: Joi.string().required(),
    password: Joi.string().min(8).max(128).optional(),
  });

  private loginSchema = Joi.object({
    deviceId: Joi.string()
      .length(10)
      .pattern(/^[A-Z0-9]+$/)
      .required(),
    password: Joi.string().max(128).optional(),
    privateKey: Joi.string().optional(),
    challenge: Joi.string().optional(),
  }).or("password", "privateKey");

  private refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
  });

  private userRegisterSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
  });

  private userLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
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

  /**
   * Normalize device type string to valid DeviceType enum
   */
  private normalizeDeviceType(deviceType: string): DeviceType {
    const normalized = deviceType.toUpperCase();

    switch (normalized) {
      case "DESKTOP":
        return DeviceType.DESKTOP;
      case "MOBILE":
        return DeviceType.MOBILE;
      case "WEB":
        return DeviceType.WEB;
      default:
        throw new ValidationError(
          `Invalid device type: ${deviceType}. Must be one of: desktop, mobile, web`
        );
    }
  }

  private initializeRoutes(): void {
    // Device authentication routes
    this.router.post("/register", this.register.bind(this));
    this.router.post("/login", this.login.bind(this));
    this.router.post("/logout", this.logout.bind(this));
    this.router.post("/refresh", this.refreshToken.bind(this));
    this.router.post("/revoke", this.revokeAccess.bind(this));
    this.router.get("/challenge/:deviceId", this.getChallenge.bind(this));

    // User authentication routes
    this.router.post("/register-user", this.registerUser.bind(this));
    this.router.post("/login-user", this.loginUser.bind(this));

    // Device password endpoints
    this.router.post(
      "/devices/:deviceId/password/temp",
      this.generateTempPassword.bind(this)
    );
    this.router.post(
      "/devices/:deviceId/password",
      this.setPermanentPassword.bind(this)
    );

    // Admin endpoints for user/device management
    this.router.get("/admin/users", this.getAllUsers.bind(this));
    this.router.get("/admin/devices", this.getAllDevices.bind(this));
    this.router.delete("/admin/users/:userId", this.deleteUser.bind(this));
    this.router.delete(
      "/admin/devices/:deviceId",
      this.deleteDevice.bind(this)
    );
    this.router.put(
      "/admin/users/:userId/role",
      this.updateUserRole.bind(this)
    );
    this.router.get("/admin/stats", this.getSystemStats.bind(this));
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

      // Normalize device type to valid Prisma enum value
      const normalizedDeviceType = this.normalizeDeviceType(
        deviceData.deviceType
      );

      // Store device in database
      const device = await this.dbService.createDevice({
        id: deviceData.deviceId,
        name: deviceData.deviceName,
        type: normalizedDeviceType,
        platform: deviceData.platform,
        publicKey: deviceData.publicKey,
        passwordHash: hashedPassword,
        deviceToken: deviceToken,
        isActive: true,
        userId: null, // Device registration without user association
        metadata: null, // No additional metadata for now
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
      this.logger.debug("Login attempt started", { body: req.body });

      // Validate request
      const { error, value } = this.loginSchema.validate(req.body);
      if (error) {
        throw new ValidationError("Invalid login data", error.details);
      }

      const loginData: LoginRequest = value;
      this.logger.debug("Login data validated", {
        deviceId: loginData.deviceId,
      });

      // Check rate limiting
      await this.checkRateLimit(loginData.deviceId);
      this.logger.debug("Rate limit check passed", {
        deviceId: loginData.deviceId,
      });

      // Get device from database
      const device = await this.dbService.getDevice(loginData.deviceId);
      this.logger.debug("Device lookup result", {
        deviceId: loginData.deviceId,
        found: !!device,
        isActive: device?.isActive,
      });

      if (!device || !device.isActive) {
        await this.recordFailedAttempt(loginData.deviceId);
        throw new AuthenticationError("Invalid credentials");
      }

      // Verify authentication method
      let isAuthenticated = false;

      if (loginData.password) {
        this.logger.debug("Validating password credentials", {
          deviceId: loginData.deviceId,
        });
        // Password-based authentication (temporary or permanent)
        isAuthenticated = await this.dbService.validateDeviceCredential(
          loginData.deviceId,
          loginData.password
        );
        this.logger.debug("Password validation result", {
          deviceId: loginData.deviceId,
          isAuthenticated,
        });
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

      this.logger.debug("Authentication successful, generating tokens", {
        deviceId: loginData.deviceId,
      });

      // Clear failed attempts on successful login
      await this.clearFailedAttempts(loginData.deviceId);

      // Generate tokens
      const tokens = await this.generateTokens(device);
      this.logger.debug("Tokens generated", { deviceId: loginData.deviceId });

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
      this.logger.error("Login error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
      if (!deviceId || !this.isValidDeviceId(deviceId)) {
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

  /**
   * Register a new user
   */
  public async registerUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const { error, value } = this.userRegisterSchema.validate(req.body);
      if (error) {
        throw new ValidationError(
          "Invalid user registration data",
          error.details
        );
      }

      const { email, password, firstName, lastName } = value;

      // Check if user already exists
      const existingUser = await this.dbService.getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(
        password,
        config.security.bcryptRounds
      );

      // Create user
      const user = await this.dbService.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
      });

      this.logger.info("User registered successfully", {
        userId: user.id,
        email: user.email,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  public async loginUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const { error, value } = this.userLoginSchema.validate(req.body);
      if (error) {
        throw new ValidationError("Invalid login data", error.details);
      }

      const { email, password } = value;

      this.logger.info("Login attempt", {
        email,
        passwordLength: password.length,
      });

      // Get user
      const user = await this.dbService.getUserByEmail(email);
      if (!user) {
        this.logger.warn("User not found", { email });
        throw new AuthenticationError("Invalid email or password");
      }

      this.logger.info("User found", {
        userId: user.id,
        email: user.email,
        hasPasswordHash: !!user.passwordHash,
        passwordHashLength: user.passwordHash?.length,
      });

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      this.logger.info("Password verification", { isValidPassword });

      if (!isValidPassword) {
        this.logger.warn("Invalid password", { email });
        throw new AuthenticationError("Invalid email or password");
      }

      // Generate tokens
      const accessTokenPayload = { userId: user.id, email: user.email };
      const refreshTokenPayload = { userId: user.id };

      const accessTokenOptions = {
        expiresIn: config.jwt.accessTokenExpiry,
      } as any;
      const refreshTokenOptions = {
        expiresIn: config.jwt.refreshTokenExpiry,
      } as any;

      const accessToken = jwt.sign(
        accessTokenPayload,
        config.jwt.accessTokenSecret as string,
        accessTokenOptions
      );

      const refreshToken = jwt.sign(
        refreshTokenPayload,
        config.jwt.refreshTokenSecret as string,
        refreshTokenOptions
      );

      // Update last login
      await this.dbService.updateUserLastLogin(user.id);

      this.logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
      });

      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        accessToken,
        refreshToken,
        expiresIn: config.jwt.accessTokenExpiry,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate a temporary password for a device (10-minute validity)
   */
  private async generateTempPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { token, expiresAt } =
        await this.dbService.generateTemporaryCredential(deviceId);
      res.json({ success: true, token, expiresAt });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set a permanent password for a device
   */
  private async setPermanentPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { deviceId } = req.params;
      const bodySchema = Joi.object({
        password: Joi.string().min(8).max(128).required(),
      });
      const { error, value } = bodySchema.validate(req.body);
      if (error)
        throw new ValidationError("Invalid password format", error.details);
      const { password } = value;
      await this.dbService.setPermanentCredential(deviceId, password);
      res.json({ success: true, message: "Permanent password set" });
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

  private isValidDeviceId(deviceId: string): boolean {
    const deviceIdRegex = /^[A-Z0-9]{10}$/;
    return deviceIdRegex.test(deviceId);
  }

  /**
   * Get all users (admin only)
   */
  public async getAllUsers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const users = await this.dbService.getAllUsers();

      // Remove sensitive information
      const sanitizedUsers = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      res.json({
        success: true,
        data: {
          users: sanitizedUsers,
          count: sanitizedUsers.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all devices (admin only)
   */
  public async getAllDevices(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const devices = await this.dbService.getAllDevices();

      // Remove sensitive information
      const sanitizedDevices = devices.map((device: any) => ({
        id: device.id,
        deviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        platform: device.platform,
        isActive: device.isActive,
        lastLogin: device.lastLoginAt,
        createdAt: device.registeredAt,
      }));

      res.json({
        success: true,
        data: {
          devices: sanitizedDevices,
          count: sanitizedDevices.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a user (admin only)
   */
  public async deleteUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const { userId } = req.params;

      if (!userId) {
        throw new ValidationError("User ID is required");
      }

      await this.dbService.deleteUser(userId);

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a device (admin only)
   */
  public async deleteDevice(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const { deviceId } = req.params;

      if (!deviceId || !this.isValidDeviceId(deviceId)) {
        throw new ValidationError("Valid device ID is required");
      }

      await this.dbService.deleteDevice(deviceId);

      res.json({
        success: true,
        message: "Device deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user role (admin only)
   */
  public async updateUserRole(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const { userId } = req.params;
      const { role } = req.body;

      if (!userId) {
        throw new ValidationError("User ID is required");
      }

      if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        throw new ValidationError(
          "Invalid role. Must be USER, ADMIN, or SUPER_ADMIN"
        );
      }

      await this.dbService.updateUserRole(userId, role);

      res.json({
        success: true,
        message: "User role updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get system statistics (admin only)
   */
  public async getSystemStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // TODO: Add admin role verification middleware
      const [userCount, deviceCount, totalLogins] = await Promise.all([
        this.dbService.getUserCount(),
        this.dbService.getDeviceCount(),
        this.dbService.getTotalLoginCount(),
      ]);

      res.json({
        success: true,
        data: {
          users: {
            total: userCount,
            active: userCount, // TODO: Add active user calculation
          },
          devices: {
            total: deviceCount,
            active: deviceCount, // TODO: Add active device calculation
          },
          activity: {
            totalLogins: totalLogins,
            recentLogins: 0, // TODO: Add recent login calculation
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
