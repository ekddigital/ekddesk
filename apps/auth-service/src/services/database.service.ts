import { Pool, PoolClient } from "pg";
import { Logger } from "@ekd-desk/shared";
import { config } from "../config/config";

interface Device {
  id: string;
  name: string;
  type: string;
  platform: string;
  publicKey: string;
  passwordHash: string | null;
  deviceToken: string;
  isActive: boolean;
  registeredAt: Date;
  lastLoginAt: Date | null;
  metadata?: any;
}

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
 * Database service for EKD Desk Auth Service
 * Handles all database operations using PostgreSQL
 */
export class DatabaseService {
  private pool: Pool;
  private logger: Logger;
  private isInitialized = false;

  constructor() {
    this.logger = Logger.createLogger("DatabaseService");
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.username,
      password: config.database.password,
      ssl: config.database.ssl,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on("error", (err) => {
      this.logger.error("Unexpected error on idle client", err);
      process.exit(-1);
    });
  }

  /**
   * Initialize database connection and create tables
   */
  public async initialize(): Promise<void> {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT NOW()");
      client.release();

      // Create tables if they don't exist
      await this.createTables();

      this.isInitialized = true;
      this.logger.info("Database service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize database service", error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Create devices table
      await client.query(`
        CREATE TABLE IF NOT EXISTS devices (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          platform VARCHAR(255) NOT NULL,
          public_key TEXT NOT NULL,
          password_hash VARCHAR(255),
          device_token VARCHAR(255) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          access_token_hash VARCHAR(255) NOT NULL,
          refresh_token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ip_address INET,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT TRUE
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_devices_device_token ON devices(device_token);
        CREATE INDEX IF NOT EXISTS idx_devices_is_active ON devices(is_active);
        CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
      `);

      // Create updated_at trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // Create triggers
      await client.query(`
        DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
        CREATE TRIGGER update_devices_updated_at
          BEFORE UPDATE ON devices
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      await client.query("COMMIT");
      this.logger.info("Database tables created/verified successfully");
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.error("Failed to create database tables", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new device
   */
  public async createDevice(
    deviceData: Omit<Device, "registeredAt" | "lastLoginAt">
  ): Promise<Device> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO devices (id, name, type, platform, public_key, password_hash, device_token, is_active, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        deviceData.id,
        deviceData.name,
        deviceData.type,
        deviceData.platform,
        deviceData.publicKey,
        deviceData.passwordHash,
        deviceData.deviceToken,
        deviceData.isActive,
        deviceData.metadata ? JSON.stringify(deviceData.metadata) : null,
      ];

      const result = await client.query(query, values);
      return this.mapDeviceFromDb(result.rows[0]);
    } catch (error) {
      this.logger.error("Failed to create device", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get device by ID
   */
  public async getDevice(deviceId: string): Promise<Device | null> {
    const client = await this.pool.connect();

    try {
      const query = "SELECT * FROM devices WHERE id = $1";
      const result = await client.query(query, [deviceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDeviceFromDb(result.rows[0]);
    } catch (error) {
      this.logger.error("Failed to get device", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get device by device token
   */
  public async getDeviceByToken(deviceToken: string): Promise<Device | null> {
    const client = await this.pool.connect();

    try {
      const query = "SELECT * FROM devices WHERE device_token = $1";
      const result = await client.query(query, [deviceToken]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDeviceFromDb(result.rows[0]);
    } catch (error) {
      this.logger.error("Failed to get device by token", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update device last login time
   */
  public async updateDeviceLastLogin(deviceId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = "UPDATE devices SET last_login_at = NOW() WHERE id = $1";
      await client.query(query, [deviceId]);
    } catch (error) {
      this.logger.error("Failed to update device last login", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deactivate device
   */
  public async deactivateDevice(deviceId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Deactivate device
      await client.query("UPDATE devices SET is_active = FALSE WHERE id = $1", [
        deviceId,
      ]);

      // Deactivate all sessions for this device
      await client.query(
        "UPDATE sessions SET is_active = FALSE WHERE device_id = $1",
        [deviceId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      this.logger.error("Failed to deactivate device", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new session
   */
  public async createSession(
    sessionData: Omit<Session, "id" | "createdAt" | "lastActivityAt">
  ): Promise<Session> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO sessions (device_id, access_token_hash, refresh_token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        sessionData.deviceId,
        sessionData.accessToken, // Should be hashed
        sessionData.refreshToken, // Should be hashed
        sessionData.expiresAt,
        sessionData.ipAddress,
        sessionData.userAgent,
      ];

      const result = await client.query(query, values);
      return this.mapSessionFromDb(result.rows[0]);
    } catch (error) {
      this.logger.error("Failed to create session", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active sessions for device
   */
  public async getActiveSessions(deviceId: string): Promise<Session[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT * FROM sessions 
        WHERE device_id = $1 AND is_active = TRUE AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const result = await client.query(query, [deviceId]);
      return result.rows.map((row) => this.mapSessionFromDb(row));
    } catch (error) {
      this.logger.error("Failed to get active sessions", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Terminate session
   */
  public async terminateSession(sessionId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = "UPDATE sessions SET is_active = FALSE WHERE id = $1";
      await client.query(query, [sessionId]);
    } catch (error) {
      this.logger.error("Failed to terminate session", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE sessions 
        SET is_active = FALSE 
        WHERE expires_at <= NOW() AND is_active = TRUE
      `;

      const result = await client.query(query);
      return result.rowCount || 0;
    } catch (error) {
      this.logger.error("Failed to cleanup expired sessions", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database health status
   */
  public async getHealthStatus(): Promise<{
    isHealthy: boolean;
    details: any;
  }> {
    try {
      const client = await this.pool.connect();
      const start = Date.now();

      await client.query("SELECT 1");
      const responseTime = Date.now() - start;

      client.release();

      return {
        isHealthy: true,
        details: {
          responseTime: `${responseTime}ms`,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingRequests: this.pool.waitingCount,
        },
      };
    } catch (error) {
      return {
        isHealthy: false,
        details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.info("Database connections closed");
    } catch (error) {
      this.logger.error("Error closing database connections", error);
    }
  }

  // Helper methods

  private mapDeviceFromDb(row: any): Device {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      platform: row.platform,
      publicKey: row.public_key,
      passwordHash: row.password_hash,
      deviceToken: row.device_token,
      isActive: row.is_active,
      registeredAt: row.registered_at,
      lastLoginAt: row.last_login_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }

  private mapSessionFromDb(row: any): Session {
    return {
      id: row.id,
      deviceId: row.device_id,
      accessToken: row.access_token_hash,
      refreshToken: row.refresh_token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }
}
