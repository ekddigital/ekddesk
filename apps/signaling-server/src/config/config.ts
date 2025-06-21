export interface SignalingConfig {
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  auth: {
    jwtSecret: string;
    tokenExpiry: string;
  };
}

export const config: SignalingConfig = {
  port: parseInt(process.env.SIGNALING_PORT || "3002"),
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "your-secret-key",
    tokenExpiry: process.env.JWT_EXPIRY || "24h",
  },
};
