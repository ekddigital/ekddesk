import { apiService } from "./api.service";

/**
 * Device Management Service
 * Handles device registration, authentication, and state management
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceToken?: string;
  isRegistered: boolean;
  isAuthenticated: boolean;
  lastLoginAt?: Date;
  registeredAt?: Date;
}

export interface DeviceCredentials {
  permanent?: {
    password: string;
    isSet: boolean;
  };
  temporary?: {
    token: string;
    expiresAt: Date;
  };
}

export class DeviceManager {
  private deviceInfo: DeviceInfo | null = null;
  private credentials: DeviceCredentials = {};
  private storageKey = "ekd-desk-device-info";

  constructor() {
    this.loadDeviceInfo();
  }

  /**
   * Generate a unique 10-character device ID (uppercase alphanumeric)
   */
  generateDeviceId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get device name based on platform
   */
  getDeviceName(): string {
    const platform = this.getPlatform();
    const hostname = this.getHostname();
    return `${hostname} (${platform})`;
  }

  /**
   * Get the platform string
   */
  getPlatform(): string {
    const userAgent = navigator.userAgent;

    if (userAgent.includes("Win")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
      return "iOS";

    return "Unknown";
  }

  /**
   * Get a hostname-like identifier
   */
  getHostname(): string {
    // In a real Electron app, this would come from the main process
    // For now, we'll generate a simple identifier
    return `EKD-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }

  /**
   * Generate a mock public key (in a real app, this would be proper crypto)
   */
  generatePublicKey(): string {
    // This would be a real RSA/EC public key in production
    return (
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" +
      Math.random().toString(36).substr(2, 32).toUpperCase()
    );
  }

  /**
   * Load device info from local storage
   */
  private loadDeviceInfo(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.deviceInfo = {
          ...parsed,
          lastLoginAt: parsed.lastLoginAt
            ? new Date(parsed.lastLoginAt)
            : undefined,
          registeredAt: parsed.registeredAt
            ? new Date(parsed.registeredAt)
            : undefined,
        };
      }
    } catch (error) {
      console.error("Failed to load device info:", error);
      this.deviceInfo = null;
    }
  }

  /**
   * Save device info to local storage
   */
  private saveDeviceInfo(): void {
    if (this.deviceInfo) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.deviceInfo));
      } catch (error) {
        console.error("Failed to save device info:", error);
      }
    }
  }

  /**
   * Get current device info
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Check if device is registered
   */
  isRegistered(): boolean {
    return this.deviceInfo?.isRegistered || false;
  }

  /**
   * Check if device is authenticated
   */
  isAuthenticated(): boolean {
    return this.deviceInfo?.isAuthenticated || false;
  }

  /**
   * Register a new device
   */
  async registerDevice(password?: string): Promise<DeviceInfo> {
    // Generate new device info if not exists
    if (!this.deviceInfo || !this.deviceInfo.deviceId) {
      this.deviceInfo = {
        deviceId: this.generateDeviceId(),
        deviceName: this.getDeviceName(),
        isRegistered: false,
        isAuthenticated: false,
      };
    }

    try {
      const response = await apiService.registerDevice({
        deviceId: this.deviceInfo.deviceId,
        deviceName: this.deviceInfo.deviceName,
        deviceType: "DESKTOP",
        platform: this.getPlatform(),
        publicKey: this.generatePublicKey(),
        password,
      });

      if (response.success) {
        this.deviceInfo = {
          ...this.deviceInfo,
          deviceToken: response.data.deviceToken,
          isRegistered: true,
          registeredAt: new Date(response.data.registeredAt),
        };

        // Set device token in API service
        apiService.setDeviceToken(response.data.deviceToken);

        // Store permanent password info if provided
        if (password) {
          this.credentials.permanent = {
            password,
            isSet: true,
          };
        }

        this.saveDeviceInfo();
      }

      return this.deviceInfo;
    } catch (error) {
      console.error("Device registration failed:", error);
      throw error;
    }
  }

  /**
   * Login with device credentials
   */
  async loginWithPassword(password: string): Promise<boolean> {
    if (!this.deviceInfo?.deviceId) {
      throw new Error("Device not registered");
    }

    try {
      const response = await apiService.login({
        deviceId: this.deviceInfo.deviceId,
        password,
      });

      if (response.success) {
        this.deviceInfo.isAuthenticated = true;
        this.deviceInfo.lastLoginAt = new Date();
        this.saveDeviceInfo();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Generate a temporary password
   */
  async generateTempPassword(): Promise<{ token: string; expiresAt: Date }> {
    if (!this.deviceInfo?.deviceId) {
      throw new Error("Device not registered");
    }

    try {
      const response = await apiService.generateTempPassword(
        this.deviceInfo.deviceId
      );

      if (response.success) {
        this.credentials.temporary = {
          token: response.token,
          expiresAt: new Date(response.expiresAt),
        };

        return {
          token: response.token,
          expiresAt: new Date(response.expiresAt),
        };
      }

      throw new Error("Failed to generate temporary password");
    } catch (error) {
      console.error("Temp password generation failed:", error);
      throw error;
    }
  }

  /**
   * Set a permanent password
   */
  async setPermanentPassword(password: string): Promise<void> {
    if (!this.deviceInfo?.deviceId) {
      throw new Error("Device not registered");
    }

    try {
      await apiService.setPermanentPassword(this.deviceInfo.deviceId, password);

      this.credentials.permanent = {
        password,
        isSet: true,
      };
    } catch (error) {
      console.error("Set permanent password failed:", error);
      throw error;
    }
  }

  /**
   * Get current credentials info (without sensitive data)
   */
  getCredentialsInfo(): {
    hasPermanent: boolean;
    hasTemporary: boolean;
    tempExpiresAt?: Date;
  } {
    return {
      hasPermanent: this.credentials.permanent?.isSet || false,
      hasTemporary: !!this.credentials.temporary,
      tempExpiresAt: this.credentials.temporary?.expiresAt,
    };
  }

  /**
   * Logout and clear authentication
   */
  async logout(): Promise<void> {
    try {
      await apiService.logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      if (this.deviceInfo) {
        this.deviceInfo.isAuthenticated = false;
        this.saveDeviceInfo();
      }
      this.credentials = {};
    }
  }

  /**
   * Clear all device data (for testing/reset)
   */
  clearDeviceData(): void {
    localStorage.removeItem(this.storageKey);
    this.deviceInfo = null;
    this.credentials = {};
  }
}

// Create a singleton instance
export const deviceManager = new DeviceManager();
