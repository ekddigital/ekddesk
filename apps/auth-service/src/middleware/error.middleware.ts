import { Request, Response, NextFunction } from 'express';
import { Logger } from '@ekd-desk/shared';

const logger = Logger.createLogger('ErrorHandler');

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const {
    statusCode = 500,
    message = 'Internal Server Error',
    code = 'INTERNAL_ERROR',
    details
  } = error;

  // Log the error
  logger.error('API Error', {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
      details
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      deviceId: req.get('X-Device-ID')
    },
    timestamp: new Date().toISOString()
  });

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        details,
        stack: error.stack 
      })
    },
    timestamp: new Date().toISOString()
  });
};

export class AuthenticationError extends Error implements ApiError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication failed', public details?: any) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied', public details?: any) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';

  constructor(message: string = 'Validation failed', public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found', public details?: any) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'CONFLICT';

  constructor(message: string = 'Resource conflict', public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements ApiError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Rate limit exceeded', public details?: any) {
    super(message);
    this.name = 'RateLimitError';
  }
}
