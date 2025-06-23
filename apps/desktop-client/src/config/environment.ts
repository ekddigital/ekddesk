/**
 * Environment Configuration for EKD Desk Desktop Client
 * Centralized configuration management using environment variables
 */

export interface EnvironmentConfig {
  // Application Environment
  NODE_ENV: "development" | "production" | "test";

  // API Configuration
  API_BASE_URL: string;
  SIGNALING_SERVER_URL: string;

  // Application Settings
  APP_NAME: string;
  APP_VERSION: string;

  // Feature Flags
  ENABLE_DEBUG_LOGS: boolean;
  ENABLE_AUTO_UPDATE: boolean;
  ENABLE_CRASH_REPORTING: boolean;

  // Network Configuration
  CONNECTION_TIMEOUT: number;
  MAX_RETRY_ATTEMPTS: number;

  // Security Configuration
  ENABLE_HTTPS: boolean;
  CERTIFICATE_VALIDATION: boolean;
}

class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private loadConfiguration(): EnvironmentConfig {
    const isDevelopment = process.env.NODE_ENV === "development";
    const isProduction = process.env.NODE_ENV === "production";

    // Default development configuration
    const developmentDefaults = {
      API_BASE_URL: "http://localhost:3001",
      SIGNALING_SERVER_URL: "http://localhost:3002",
    };

    // Default production configuration (will be overridden by environment variables)
    const productionDefaults = {
      API_BASE_URL: process.env.EKD_API_BASE_URL || "http://192.168.1.101:3001",
      SIGNALING_SERVER_URL:
        process.env.EKD_SIGNALING_URL || "http://192.168.1.101:3002",
    };

    const defaults = isDevelopment ? developmentDefaults : productionDefaults;

    return {
      // Environment
      NODE_ENV: (process.env.NODE_ENV as any) || "development",

      // API Configuration
      API_BASE_URL: process.env.EKD_API_BASE_URL || defaults.API_BASE_URL,
      SIGNALING_SERVER_URL:
        process.env.EKD_SIGNALING_URL || defaults.SIGNALING_SERVER_URL,

      // Application Settings
      APP_NAME: process.env.EKD_APP_NAME || "EKD Desk",
      APP_VERSION: process.env.EKD_APP_VERSION || "1.0.0",

      // Feature Flags
      ENABLE_DEBUG_LOGS:
        this.parseBoolean(process.env.EKD_ENABLE_DEBUG_LOGS) ?? isDevelopment,
      ENABLE_AUTO_UPDATE:
        this.parseBoolean(process.env.EKD_ENABLE_AUTO_UPDATE) ?? isProduction,
      ENABLE_CRASH_REPORTING:
        this.parseBoolean(process.env.EKD_ENABLE_CRASH_REPORTING) ??
        isProduction,

      // Network Configuration
      CONNECTION_TIMEOUT: parseInt(
        process.env.EKD_CONNECTION_TIMEOUT || "30000"
      ),
      MAX_RETRY_ATTEMPTS: parseInt(process.env.EKD_MAX_RETRY_ATTEMPTS || "3"),

      // Security Configuration
      ENABLE_HTTPS:
        this.parseBoolean(process.env.EKD_ENABLE_HTTPS) ?? isProduction,
      CERTIFICATE_VALIDATION:
        this.parseBoolean(process.env.EKD_CERTIFICATE_VALIDATION) ??
        isProduction,
    };
  }

  private parseBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    return value.toLowerCase() === "true" || value === "1";
  }

  public getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  public get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  public isProduction(): boolean {
    return this.config.NODE_ENV === "production";
  }

  public getApiBaseUrl(): string {
    return this.config.API_BASE_URL;
  }

  public getSignalingServerUrl(): string {
    return this.config.SIGNALING_SERVER_URL;
  }

  // Debugging helper
  public logConfiguration(): void {
    if (this.config.ENABLE_DEBUG_LOGS) {
      console.log("🔧 EKD Desk Environment Configuration:", {
        NODE_ENV: this.config.NODE_ENV,
        API_BASE_URL: this.config.API_BASE_URL,
        SIGNALING_SERVER_URL: this.config.SIGNALING_SERVER_URL,
        ENABLE_DEBUG_LOGS: this.config.ENABLE_DEBUG_LOGS,
        // Don't log sensitive information in production
      });
    }
  }
}

// Export singleton instance
export const env = EnvironmentManager.getInstance();

// Export default configuration for easy access
export default env;
