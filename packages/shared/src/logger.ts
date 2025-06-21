import * as winston from 'winston';
import { LogLevel } from './types';
import { formatTimestamp } from './utils';

/**
 * Centralized logging system for EKD Desk
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = 'EKD-Desk') {
    this.context = context;
    this.logger = this.createLogger();
  }

  static getInstance(context?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  static createLogger(context: string): Logger {
    return new Logger(context);
  }

  private createLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let logMessage = `${timestamp} [${this.context}] ${level.toUpperCase()}: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          logMessage += ` ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
          logMessage += `\n${stack}`;
        }
        
        return logMessage;
      })
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        )
      })
    ];

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: logFormat
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: logFormat
        })
      );
    }

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports,
      exceptionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production' 
          ? [new winston.transports.File({ filename: 'logs/exceptions.log' })]
          : []
        )
      ],
      rejectionHandlers: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production'
          ? [new winston.transports.File({ filename: 'logs/rejections.log' })]
          : []
        )
      ]
    });
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  setContext(context: string): void {
    this.context = context;
    this.logger = this.createLogger();
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
      this.logger.error(message, { error, ...meta });
    }
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  // Convenience methods for common logging scenarios
  logConnection(deviceId: string, action: 'connected' | 'disconnected', meta?: any): void {
    this.info(`Device ${action}`, { deviceId, action, ...meta });
  }

  logSession(sessionId: string, action: 'started' | 'ended' | 'paused' | 'resumed', meta?: any): void {
    this.info(`Session ${action}`, { sessionId, action, ...meta });
  }

  logAuth(userId: string, action: 'login' | 'logout' | 'failed', meta?: any): void {
    if (action === 'failed') {
      this.warn(`Authentication failed`, { userId, action, ...meta });
    } else {
      this.info(`User ${action}`, { userId, action, ...meta });
    }
  }

  logNetworkEvent(event: string, meta?: any): void {
    this.debug(`Network event: ${event}`, meta);
  }

  logMediaEvent(event: string, sessionId: string, meta?: any): void {
    this.debug(`Media event: ${event}`, { sessionId, ...meta });
  }

  logPerformance(operation: string, duration: number, meta?: any): void {
    this.debug(`Performance: ${operation} took ${duration}ms`, { operation, duration, ...meta });
  }

  // Method to create child logger with additional context
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }

  // Stream interface for external integrations
  stream(level: LogLevel = 'info') {
    return {
      write: (message: string) => {
        this.logger.log(level, message.trim());
      }
    };
  }
}
