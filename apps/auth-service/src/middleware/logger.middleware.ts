import { Request, Response, NextFunction } from 'express';
import { Logger } from '@ekd-desk/shared';

const logger = Logger.createLogger('RequestLogger');

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';
  const deviceId = req.get('X-Device-ID') || 'unknown';

  // Log the request
  logger.info('Request received', {
    method,
    url,
    ip,
    userAgent,
    deviceId,
    timestamp: new Date().toISOString(),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): any {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method,
      url,
      ip,
      deviceId,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
    });

    // Call the original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
