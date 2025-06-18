import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '@ekd-desk/shared';
import { DatabaseService } from '../services/database.service';
import { RedisService } from '../services/redis.service';
import { AuthenticationError, ValidationError } from '../middleware/error.middleware';

/**
 * Session Controller for EKD Desk
 * Handles session management operations
 */
export class SessionController {
  private router: Router;
  private logger: Logger;
  private dbService: DatabaseService;
  private redisService: RedisService;

  constructor(dbService: DatabaseService, redisService: RedisService) {
    this.router = Router();
    this.logger = Logger.createLogger('SessionController');
    this.dbService = dbService;
    this.redisService = redisService;
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', this.getActiveSessions.bind(this));
    this.router.delete('/:sessionId', this.terminateSession.bind(this));
    this.router.post('/cleanup', this.cleanupSessions.bind(this));
  }

  /**
   * Get active sessions for authenticated device
   */
  public async getActiveSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deviceId = this.extractDeviceIdFromToken(req);
      
      const sessions = await this.dbService.getActiveSessions(deviceId);
      
      // Remove sensitive data from response
      const safeSessions = sessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        expiresAt: session.expiresAt
      }));

      res.json({
        success: true,
        data: {
          deviceId,
          sessions: safeSessions,
          total: safeSessions.length
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Terminate a specific session
   */
  public async terminateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const deviceId = this.extractDeviceIdFromToken(req);

      if (!sessionId) {
        throw new ValidationError('Session ID is required');
      }

      // Verify session belongs to the authenticated device
      const sessions = await this.dbService.getActiveSessions(deviceId);
      const sessionExists = sessions.some(session => session.id === sessionId);

      if (!sessionExists) {
        throw new ValidationError('Session not found or access denied');
      }

      // Terminate the session
      await this.dbService.terminateSession(sessionId);

      this.logger.info('Session terminated', { sessionId, deviceId });

      res.json({
        success: true,
        message: 'Session terminated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Cleanup expired sessions (admin operation)
   */
  public async cleanupSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cleanedCount = await this.dbService.cleanupExpiredSessions();

      this.logger.info('Session cleanup completed', { cleanedCount });

      res.json({
        success: true,
        message: 'Session cleanup completed',
        data: { cleanedSessions: cleanedCount }
      });

    } catch (error) {
      next(error);
    }
  }

  // Helper methods

  private extractDeviceIdFromToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    // This would normally be done by authentication middleware
    // For now, we'll extract from the token directly
    const token = authHeader.substring(7);
    
    // In a real implementation, you'd verify the JWT and extract the deviceId
    // For this example, we'll assume middleware has already verified the token
    // and added the user info to req.user
    const user = (req as any).user;
    if (!user || !user.deviceId) {
      throw new AuthenticationError('Invalid token');
    }

    return user.deviceId;
  }

  public getRouter(): Router {
    return this.router;
  }
}
