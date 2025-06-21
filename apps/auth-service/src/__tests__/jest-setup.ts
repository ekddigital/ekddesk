// Jest setup for auth service
// Reuses shared test utilities following DRY principles
import "@ekd-desk/shared/src/test-utils";

// Auth service specific setup
// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret-key-for-jwt-access-tokens";
process.env.JWT_REFRESH_SECRET = "test-secret-key-for-jwt-refresh-tokens";
process.env.DB_HOST = "localhost";
process.env.DB_NAME = "ekd_desk_test";
process.env.REDIS_HOST = "localhost";
