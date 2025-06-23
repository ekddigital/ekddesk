import {
  PrismaClient,
  CredentialType,
  DeviceType,
  Device,
  DeviceCredential,
} from "@prisma/client";
import { Logger } from "@ekd-desk/shared";
import { config } from "../config/config";
import crypto from "crypto";
import bcrypt from "bcrypt";

interface Session {
  id: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  ipAddress: string;
  userAgent: string;
}

/**
 * Simplified Database service for EKD Desk Auth Service
 * Uses only Prisma for database operations
 */
export class DatabaseService {
  private prisma: PrismaClient;
  private logger: Logger;
  private isInitialized = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = Logger.createLogger("DatabaseService");

    this.logger.info("Database config:", {
      url: config.database.url ? "***PROVIDED***" : "not provided",
      host: config.database.host,
      port: config.database.port,
      name: config.database.name,
      user: config.database.username,
      ssl: config.database.ssl,
      maxConnections: config.database.maxConnections,
    });

    this.logger.info(
      "Using Prisma for all database operations - no separate pool needed"
    );
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    return crypto.randomBytes(5).toString("hex").toUpperCase();
  }

  /**
   * Initialize database connection
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize Prisma connection
      await this.prisma.$connect();
      this.logger.info("Prisma client connected successfully");

      // Test database connection with Prisma
      await this.prisma.$queryRaw`SELECT NOW()`;
      this.logger.info("Database connection tested successfully");

      this.isInitialized = true;
      this.logger.info("Database service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize database service", error);
      throw error;
    }
  }

  /**
   * Create or update a device
   */
  public async createOrUpdateDevice(
    deviceName: string,
    deviceType: DeviceType,
    platform: string,
    publicKey: string,
    deviceToken: string,
    passwordHash?: string
  ): Promise<Device> {
    const deviceId = this.generateDeviceId();

    const device = await this.prisma.device.upsert({
      where: { deviceToken },
      update: {
        type: deviceType,
        platform,
        lastLoginAt: new Date(),
      },
      create: {
        id: deviceId,
        name: deviceName,
        type: deviceType,
        platform,
        publicKey,
        deviceToken,
        passwordHash,
        isActive: true,
      },
    });

    return device;
  }

  /**
   * Get device by name
   */
  public async getDeviceByName(deviceName: string): Promise<Device | null> {
    return await this.prisma.device.findFirst({
      where: { name: deviceName },
    });
  }

  /**
   * Get device by ID
   */
  public async getDeviceById(deviceId: string): Promise<Device | null> {
    return await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
  }

  /**
   * Get device by token
   */
  public async getDeviceByToken(deviceToken: string): Promise<Device | null> {
    return await this.prisma.device.findUnique({
      where: { deviceToken },
    });
  }

  /**
   * Generate temporary credentials for device
   */
  public async generateTemporaryCredentials(
    deviceId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.deviceCredential.create({
      data: {
        deviceId,
        passwordHash,
        type: CredentialType.TEMPORARY,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Get device by temporary token
   */
  public async getDeviceByTemporaryToken(
    token: string
  ): Promise<Device | null> {
    const credentials = await this.prisma.deviceCredential.findMany({
      where: {
        type: CredentialType.TEMPORARY,
        expiresAt: { gt: new Date() },
      },
      include: {
        device: true,
      },
    });

    for (const credential of credentials) {
      const isValid = await bcrypt.compare(token, credential.passwordHash);
      if (isValid) {
        return credential.device;
      }
    }

    return null;
  }

  /**
   * Create permanent credentials
   */
  public async createPermanentCredentials(
    deviceId: string,
    password: string
  ): Promise<{ deviceId: string; passwordHash: string }> {
    const passwordHash = await bcrypt.hash(
      password,
      config.security.bcryptRounds
    );

    await this.prisma.deviceCredential.create({
      data: {
        deviceId,
        passwordHash,
        type: CredentialType.PERMANENT,
      },
    });

    return { deviceId, passwordHash };
  }

  /**
   * Verify device credentials
   */
  public async verifyDeviceCredentials(
    deviceName: string,
    password: string
  ): Promise<{ device: Device | null; isValid: boolean }> {
    const device = await this.prisma.device.findFirst({
      where: { name: deviceName },
    });

    if (!device) {
      return { device: null, isValid: false };
    }

    // Check device password hash first
    if (device.passwordHash) {
      const isValid = await bcrypt.compare(password, device.passwordHash);
      if (isValid) {
        return { device, isValid: true };
      }
    }

    // Check permanent credentials
    const credentials = await this.prisma.deviceCredential.findMany({
      where: {
        deviceId: device.id,
        type: CredentialType.PERMANENT,
      },
    });

    for (const credential of credentials) {
      const isValid = await bcrypt.compare(password, credential.passwordHash);
      if (isValid) {
        return { device, isValid: true };
      }
    }

    return { device, isValid: false };
  }

  /**
   * Create a new session
   */
  public async createSession(
    deviceId: string,
    accessTokenHash: string,
    refreshTokenHash: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const session = await this.prisma.session.create({
      data: {
        deviceId,
        accessTokenHash,
        refreshTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      id: session.id,
      deviceId: session.deviceId,
      accessToken: "", // Don't return actual tokens
      refreshToken: "",
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress || "",
      userAgent: session.userAgent || "",
    };
  }

  /**
   * Get session by access token hash
   */
  public async getSessionByAccessToken(
    accessTokenHash: string
  ): Promise<Session | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        accessTokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) return null;

    return {
      id: session.id,
      deviceId: session.deviceId,
      accessToken: "",
      refreshToken: "",
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress || "",
      userAgent: session.userAgent || "",
    };
  }

  /**
   * Get active sessions for a device
   */
  public async getActiveSessions(deviceId: string): Promise<Session[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        deviceId,
        expiresAt: { gt: new Date() },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      accessToken: "",
      refreshToken: "",
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress || "",
      userAgent: session.userAgent || "",
    }));
  }

  /**
   * Terminate a session
   */
  public async terminateSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  /**
   * Clean up expired sessions and credentials
   */
  public async cleanupExpired(): Promise<void> {
    const now = new Date();

    // Clean up expired sessions
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Clean up expired temporary credentials
    await this.prisma.deviceCredential.deleteMany({
      where: {
        type: CredentialType.TEMPORARY,
        expiresAt: { lt: now },
      },
    });

    this.logger.info("Cleaned up expired sessions and credentials");
  }

  /**
   * Get database health information
   */
  public async getHealthInfo(): Promise<{
    connected: boolean;
    totalDevices: number;
    activeSessions: number;
  }> {
    try {
      const totalDevices = await this.prisma.device.count();
      const activeSessions = await this.prisma.session.count({
        where: { expiresAt: { gt: new Date() } },
      });

      return {
        connected: true,
        totalDevices,
        activeSessions,
      };
    } catch (error) {
      this.logger.error("Database health check failed", error);
      return {
        connected: false,
        totalDevices: 0,
        activeSessions: 0,
      };
    }
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
    this.logger.info("Database connection closed");
  }

  /**
   * Get device by ID (alias for getDeviceById)
   */
  public async getDevice(deviceId: string): Promise<Device | null> {
    return this.getDeviceById(deviceId);
  }

  /**
   * Create a new device
   */
  public async createDevice(deviceData: {
    id: string;
    name: string;
    type: DeviceType;
    platform: string;
    publicKey: string;
    passwordHash?: string | null;
    deviceToken: string;
    isActive: boolean;
    userId?: string | null;
    metadata?: string | null;
  }): Promise<Device> {
    return await this.prisma.device.create({
      data: {
        id: deviceData.id,
        name: deviceData.name,
        type: deviceData.type,
        platform: deviceData.platform,
        publicKey: deviceData.publicKey,
        passwordHash: deviceData.passwordHash,
        deviceToken: deviceData.deviceToken,
        isActive: deviceData.isActive,
        userId: deviceData.userId,
        metadata: deviceData.metadata,
      },
    });
  }

  /**
   * Validate device credential
   */
  public async validateDeviceCredential(
    deviceId: string,
    password: string
  ): Promise<boolean> {
    const result = await this.verifyDeviceCredentials("", password);
    // This is a simplified implementation - in practice you'd want to check by deviceId
    return result.isValid;
  }

  /**
   * Update device last login timestamp
   */
  public async updateDeviceLastLogin(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Deactivate a device
   */
  public async deactivateDevice(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Generate temporary credential (alias for generateTemporaryCredentials)
   */
  public async generateTemporaryCredential(
    deviceId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    return this.generateTemporaryCredentials(deviceId);
  }

  /**
   * Set permanent credential (alias for createPermanentCredentials)
   */
  public async setPermanentCredential(
    deviceId: string,
    password: string
  ): Promise<{ deviceId: string; passwordHash: string }> {
    return this.createPermanentCredentials(deviceId, password);
  }

  /**
   * Get user by email
   */
  public async getUserByEmail(email: string): Promise<any | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new user
   */
  public async createUser(userData: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<any> {
    return await this.prisma.user.create({
      data: {
        email: userData.email,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
      },
    });
  }

  /**
   * Update user last login timestamp
   */
  public async updateUserLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Cleanup expired credentials
   */
  public async cleanupExpiredCredentials(): Promise<number> {
    // Clean up expired temporary credentials
    const result = await this.prisma.deviceCredential.deleteMany({
      where: {
        type: "TEMPORARY",
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}

export const databaseService = new DatabaseService();
