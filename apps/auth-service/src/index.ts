import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config/config";
import { Logger } from "@ekd-desk/shared";
import { AuthenticationController } from "./controllers/auth.controller";
import { SessionController } from "./controllers/session.controller";
import { DatabaseService } from "./services/database.service";
import { RedisService } from "./services/redis.service";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/logger.middleware";

/**
 * EKD Desk Authentication Service
 * Handles device registration, authentication, and session management
 */
class AuthService {
  private app: express.Application;
  private logger: Logger;
  private dbService: DatabaseService;
  private redisService: RedisService;

  constructor() {
    this.app = express();
    this.logger = Logger.createLogger("AuthService");
    this.dbService = new DatabaseService();
    this.redisService = new RedisService();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Device-ID"],
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use("/api/", limiter);

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);
  }

  private initializeRoutes(): void {
    const authController = new AuthenticationController(
      this.dbService,
      this.redisService
    );
    const sessionController = new SessionController(
      this.dbService,
      this.redisService
    );

    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "auth-service",
        version: process.env.npm_package_version || "1.0.0",
      });
    });

    // Authentication routes
    this.app.use("/api/auth", authController.getRouter());
    this.app.use("/api/sessions", sessionController.getRouter());

    // API documentation
    this.app.get("/api", (req, res) => {
      res.json({
        service: "EKD Desk Authentication Service",
        version: "1.0.0",
        endpoints: {
          "POST /api/auth/register": "Register a new device",
          "POST /api/auth/login": "Authenticate device",
          "POST /api/auth/refresh": "Refresh authentication token",
          "POST /api/auth/logout": "Logout device",
          "GET /api/sessions": "Get active sessions",
          "DELETE /api/sessions/:id": "Terminate session",
          "GET /health": "Service health check",
        },
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use("*", (req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      // Skip database initialization in development for now
      if (config.env !== "development") {
        // Initialize database connection
        await this.dbService.initialize();
        this.logger.info("Database connection established");

        // Initialize Redis connection
        await this.redisService.initialize();
        this.logger.info("Redis connection established");
      } else {
        this.logger.warn(
          "Running in development mode - database and Redis connections skipped"
        );
      }

      this.logger.info("Auth service initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize auth service", error);
      throw error;
    }
  }

  public start(): void {
    const port = config.server.port;
    const host = config.server.host;

    this.app.listen(port, host, () => {
      this.logger.info(`Auth service listening on ${host}:${port}`);
      this.logger.info(`Environment: ${config.env}`);
      this.logger.info(
        `API documentation available at http://${host}:${port}/api`
      );
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start the service
async function startService() {
  try {
    const authService = new AuthService();
    await authService.initialize();
    authService.start();

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down gracefully");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received, shutting down gracefully");
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start auth service:", error);
    process.exit(1);
  }
}

// Start if this file is run directly
if (require.main === module) {
  startService();
}

export { AuthService };
