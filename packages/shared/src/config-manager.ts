import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, AppConfigSchema, ConfigurationError } from './types';
import { Logger } from './logger';
import { deepMerge } from './utils';

/**
 * Configuration manager for EKD Desk
 * Handles loading, validation, and management of application configuration
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig | null = null;
  private configPath: string;
  private logger: Logger;
  private watchers: fs.FSWatcher[] = [];
  private changeCallbacks: Array<(config: AppConfig) => void> = [];

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.logger = Logger.createLogger('ConfigManager');
  }

  static getInstance(configPath?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath);
    }
    return ConfigManager.instance;
  }

  private getDefaultConfigPath(): string {
    // Check for config file in various locations
    const possiblePaths = [
      process.env.EKD_CONFIG_PATH,
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), 'config', 'default.json'),
      path.join(process.cwd(), '.ekd-desk.json'),
      path.join(require.resolve('.'), '..', '..', 'config.json')
    ].filter(Boolean) as string[];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    // Create default config if none exists
    const defaultPath = path.join(process.cwd(), 'config.json');
    this.createDefaultConfig(defaultPath);
    return defaultPath;
  }

  private createDefaultConfig(configPath: string): void {
    const defaultConfig: AppConfig = {
      app: {
        name: 'EKD Desk',
        version: '1.0.0',
        environment: 'development',
        logLevel: 'info'
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        name: process.env.DB_NAME || 'ekd_desk',
        username: process.env.DB_USER || 'ekd_user',
        password: process.env.DB_PASSWORD || 'ekd_password',
        ssl: process.env.DB_SSL === 'true',
        poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
      },
      security: {
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        encryptionKey: process.env.ENCRYPTION_KEY || 'your-super-secret-encryption-key-32',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000')
      },
      network: {
        port: parseInt(process.env.PORT || '3001'),
        host: process.env.HOST || '0.0.0.0',
        protocol: 'websocket',
        encryption: true,
        compression: true,
        timeout: parseInt(process.env.NETWORK_TIMEOUT || '10000'),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3')
      },
      media: {
        video: {
          enabled: true,
          fps: parseInt(process.env.VIDEO_FPS || '30'),
          quality: parseInt(process.env.VIDEO_QUALITY || '80'),
          bitrate: parseInt(process.env.VIDEO_BITRATE || '2000000'),
          codec: 'h264',
          resolution: {
            width: parseInt(process.env.VIDEO_WIDTH || '1920'),
            height: parseInt(process.env.VIDEO_HEIGHT || '1080')
          }
        },
        audio: {
          enabled: true,
          sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '48000'),
          channels: parseInt(process.env.AUDIO_CHANNELS || '2'),
          bitrate: parseInt(process.env.AUDIO_BITRATE || '128000'),
          codec: 'opus'
        }
      }
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      this.logger.info(`Created default config at ${configPath}`);
    } catch (error) {
      this.logger.error('Failed to create default config', error);
      throw new ConfigurationError('Failed to create default configuration file');
    }
  }

  async load(): Promise<AppConfig> {
    try {
      this.logger.info(`Loading configuration from ${this.configPath}`);
      
      if (!fs.existsSync(this.configPath)) {
        throw new ConfigurationError(`Configuration file not found: ${this.configPath}`);
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const parsedConfig = JSON.parse(configData);
      
      // Apply environment variable overrides
      const configWithEnv = this.applyEnvironmentOverrides(parsedConfig);
      
      // Validate configuration
      const validatedConfig = this.validateConfig(configWithEnv);
      
      this.config = validatedConfig;
      this.logger.info('Configuration loaded and validated successfully');
      
      // Start watching for changes
      this.watchConfig();
      
      return this.config;
      
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw new ConfigurationError(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private applyEnvironmentOverrides(config: any): any {
    const envOverrides = {
      app: {
        environment: process.env.NODE_ENV,
        logLevel: process.env.LOG_LEVEL
      },
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
        name: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : undefined,
        poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : undefined
      },
      security: {
        jwtSecret: process.env.JWT_SECRET,
        encryptionKey: process.env.ENCRYPTION_KEY,
        sessionTimeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : undefined,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS ? parseInt(process.env.MAX_LOGIN_ATTEMPTS) : undefined,
        lockoutDuration: process.env.LOCKOUT_DURATION ? parseInt(process.env.LOCKOUT_DURATION) : undefined
      },
      network: {
        port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
        host: process.env.HOST,
        timeout: process.env.NETWORK_TIMEOUT ? parseInt(process.env.NETWORK_TIMEOUT) : undefined,
        maxRetries: process.env.MAX_RETRIES ? parseInt(process.env.MAX_RETRIES) : undefined
      }
    };

    // Remove undefined values
    const cleanEnvOverrides = JSON.parse(JSON.stringify(envOverrides));
    
    return deepMerge(config, cleanEnvOverrides);
  }

  private validateConfig(config: any): AppConfig {
    try {
      return AppConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new ConfigurationError(`Configuration validation failed:\n${errorMessages.join('\n')}`);
      }
      throw error;
    }
  }

  private watchConfig(): void {
    if (this.watchers.length > 0) {
      return; // Already watching
    }

    try {
      const watcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          this.logger.info('Configuration file changed, reloading...');
          this.reload();
        }
      });

      this.watchers.push(watcher);
      this.logger.debug(`Watching configuration file: ${this.configPath}`);
      
    } catch (error) {
      this.logger.warn('Failed to watch configuration file', error);
    }
  }

  async reload(): Promise<AppConfig> {
    try {
      const newConfig = await this.load();
      
      // Notify change callbacks
      this.changeCallbacks.forEach(callback => {
        try {
          callback(newConfig);
        } catch (error) {
          this.logger.error('Error in config change callback', error);
        }
      });
      
      return newConfig;
    } catch (error) {
      this.logger.error('Failed to reload configuration', error);
      throw error;
    }
  }

  get(): AppConfig {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  set(newConfig: Partial<AppConfig>): void {
    if (!this.config) {
      throw new ConfigurationError('Configuration not loaded. Call load() first.');
    }
    
    this.config = deepMerge(this.config, newConfig);
    this.logger.info('Configuration updated');
  }

  async save(): Promise<void> {
    if (!this.config) {
      throw new ConfigurationError('No configuration to save');
    }

    try {
      const configJson = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configJson);
      this.logger.info(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration', error);
      throw new ConfigurationError('Failed to save configuration file');
    }
  }

  onChange(callback: (config: AppConfig) => void): void {
    this.changeCallbacks.push(callback);
  }

  offChange(callback: (config: AppConfig) => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }

  setConfigPath(newPath: string): void {
    this.stopWatching();
    this.configPath = newPath;
    this.config = null;
  }

  private stopWatching(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
  }

  destroy(): void {
    this.stopWatching();
    this.changeCallbacks = [];
    this.config = null;
    this.logger.info('ConfigManager destroyed');
  }
}
