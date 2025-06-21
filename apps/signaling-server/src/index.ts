import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { config } from "./config/config";

// Load environment variables from project root
const rootPath = process.cwd();
const envPath = path.join(rootPath, ".env");
console.log("🔧 Loading .env from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("❌ Failed to load .env file:", result.error);
} else {
  console.log("✅ .env file loaded successfully");
}

/**
 * EKD Desk Signaling Server
 * Handles WebRTC signaling for peer-to-peer connections
 */
class SignalingServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private connectedDevices: Map<string, any> = new Map();

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"],
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "signaling-server",
        version: "1.0.0",
        connectedDevices: this.connectedDevices.size,
      });
    });

    // API info endpoint
    this.app.get("/api", (req, res) => {
      res.json({
        service: "EKD Desk Signaling Server",
        version: "1.0.0",
        websocket: "Socket.IO",
        endpoints: {
          "GET /health": "Service health check",
          "GET /api": "API documentation",
          "WebSocket Events": {
            "device:register": "Register device for signaling",
            offer: "Send WebRTC offer",
            answer: "Send WebRTC answer",
            "ice-candidate": "Send ICE candidate",
            disconnect: "Disconnect device",
          },
        },
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket) => {
      console.log(`🔌 Device connected: ${socket.id}`);

      // Device registration
      socket.on("device:register", (deviceInfo) => {
        this.connectedDevices.set(socket.id, {
          ...deviceInfo,
          socketId: socket.id,
          connectedAt: new Date(),
        });
        console.log(`📱 Device registered: ${deviceInfo.name || socket.id}`);

        // Broadcast updated device list
        this.io.emit(
          "devices:updated",
          Array.from(this.connectedDevices.values())
        );
      });

      // WebRTC signaling events
      socket.on("offer", (data) => {
        console.log(`📤 Offer from ${socket.id} to ${data.target}`);
        socket.to(data.target).emit("offer", {
          ...data,
          from: socket.id,
        });
      });

      socket.on("answer", (data) => {
        console.log(`📥 Answer from ${socket.id} to ${data.target}`);
        socket.to(data.target).emit("answer", {
          ...data,
          from: socket.id,
        });
      });

      socket.on("ice-candidate", (data) => {
        console.log(`🧊 ICE candidate from ${socket.id} to ${data.target}`);
        socket.to(data.target).emit("ice-candidate", {
          ...data,
          from: socket.id,
        });
      });

      // Device disconnection
      socket.on("disconnect", () => {
        console.log(`🔌 Device disconnected: ${socket.id}`);
        this.connectedDevices.delete(socket.id);

        // Broadcast updated device list
        this.io.emit(
          "devices:updated",
          Array.from(this.connectedDevices.values())
        );
      });
    });
  }

  public start(): void {
    const port = parseInt(process.env.SIGNALING_SERVER_PORT || "3002");

    this.server.listen(port, () => {
      console.log("🚀 Signaling server initialized successfully");
      console.log(`🌐 Signaling server listening on port ${port}`);
      console.log(`🔗 WebSocket endpoint: ws://localhost:${port}`);
      console.log(`📋 API documentation: http://localhost:${port}/api`);
      console.log("🎯 Environment: development");
    });
  }
}

// Start the signaling server
const signalingServer = new SignalingServer();
signalingServer.start();
