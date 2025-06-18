import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config/config";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

export class AuthMiddleware {
  static authenticate(
    socket: AuthenticatedSocket,
    next: (err?: Error) => void
  ) {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      socket.userId = decoded.userId;
      socket.deviceId =
        decoded.deviceId || `device_${decoded.userId}_${Date.now()}`;

      next();
    } catch (error) {
      next(new Error("Invalid authentication token"));
    }
  }

  static authorize(requiredRole?: string) {
    return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      // Additional authorization logic can be added here
      // For now, just ensure the user is authenticated
      if (!socket.userId) {
        return next(new Error("User not authenticated"));
      }

      // Role-based authorization could be implemented here
      if (requiredRole) {
        // Check user role against required role
        // This would typically involve a database lookup
      }

      next();
    };
  }
}
