import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root
// Find the root by going up from current working directory until we find package.json
let rootPath = process.cwd();
while (
  !require("fs").existsSync(path.join(rootPath, "package.json")) ||
  !require("fs")
    .readFileSync(path.join(rootPath, "package.json"), "utf8")
    .includes('"name": "ekd-desk"')
) {
  const parentPath = path.dirname(rootPath);
  if (parentPath === rootPath) break; // Reached filesystem root
  rootPath = parentPath;
}

const envPath = path.join(rootPath, ".env");
console.log("🔧 Loading .env from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("❌ Failed to load .env file:", result.error);
} else {
  console.log("✅ .env file loaded successfully");
}

export const config = {
  env: process.env.NODE_ENV || "development",

  server: {
    port: parseInt(process.env.AUTH_SERVICE_PORT || "3001"),
    host: process.env.AUTH_HOST || "0.0.0.0",
  },

  database: {
    // If DATABASE_URL is defined, use it, otherwise use individual components
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DATABASE_HOST || process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || "5432"),
    name: process.env.DATABASE_NAME || process.env.DB_NAME || "ekd_desk_auth",
    username:
      process.env.DATABASE_USER || process.env.DB_USERNAME || "postgres",
    password:
      process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || "password",
    ssl: process.env.DATABASE_SSL === "true" || process.env.DB_SSL === "true",
    maxConnections: parseInt(
      process.env.DATABASE_MAX_CONNECTIONS ||
        process.env.DB_MAX_CONNECTIONS ||
        "10"
    ),
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || "3"),
  },

  jwt: {
    accessTokenSecret: (() => {
      const secret =
        process.env.JWT_ACCESS_SECRET || "ekd-desk-access-secret-dev";
      console.log("🔑 JWT_ACCESS_SECRET length:", secret.length);
      console.log(
        "🔑 JWT_ACCESS_SECRET value:",
        secret.substring(0, 10) + "..."
      );
      return secret;
    })(),
    refreshTokenSecret:
      process.env.JWT_REFRESH_SECRET || "ekd-desk-refresh-secret-dev",
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
    issuer: process.env.JWT_ISSUER || "ekd-desk",
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5"),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || "900000"), // 15 minutes
    deviceTokenLength: parseInt(process.env.DEVICE_TOKEN_LENGTH || "32"),
  },

  cors: {
    allowedOrigins: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3001",
    ],
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "json",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "900000"), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  },

  session: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || "5"),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || "3600000"), // 1 hour
    cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || "300000"), // 5 minutes
    credentialCleanupInterval: parseInt(
      process.env.CREDENTIAL_CLEANUP_INTERVAL || "600000"
    ), // 10 minutes
    tempPasswordLength: parseInt(process.env.TEMP_PASSWORD_LENGTH || "16"),
  },
};
