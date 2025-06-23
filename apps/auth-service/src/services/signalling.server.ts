import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

interface HostSession {
  id: string;
  deviceId: string;
  accessCode: string;
  socket: WebSocket;
  clients: Set<string>;
}

interface ClientSession {
  id: string;
  socket: WebSocket;
  hostId?: string;
}

/**
 * Simple WebRTC Signalling Server for EKD Desk
 * Coordinates peer-to-peer connections between hosts and clients
 */
export class SignallingServer {
  private wss: WebSocketServer;
  private hosts = new Map<string, HostSession>();
  private clients = new Map<string, ClientSession>();
  private port: number;

  constructor(port: number = 3002) {
    this.port = port;

    // Create HTTP server for WebSocket upgrade
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.setupWebSocketHandlers();

    server.listen(port, () => {
      console.log(`🔗 EKD Desk Signalling Server running on port ${port}`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on("connection", (socket: WebSocket) => {
      const sessionId = this.generateSessionId();
      console.log(`New connection: ${sessionId}`);

      socket.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(sessionId, socket, message);
        } catch (error) {
          console.error("Invalid message format:", error);
        }
      });

      socket.on("close", () => {
        this.handleDisconnection(sessionId);
      });

      socket.on("error", (error) => {
        console.error(`Socket error for ${sessionId}:`, error);
        this.handleDisconnection(sessionId);
      });
    });
  }

  private handleMessage(
    sessionId: string,
    socket: WebSocket,
    message: any
  ): void {
    const { type } = message;

    switch (type) {
      case "register-host":
        this.handleRegisterHost(sessionId, socket, message);
        break;

      case "request-connection":
        this.handleConnectionRequest(sessionId, socket, message);
        break;

      case "offer":
      case "answer":
      case "ice-candidate":
        this.forwardSignallingMessage(sessionId, message);
        break;

      case "disconnect":
        this.handleDisconnection(sessionId);
        break;

      default:
        console.log(`Unknown message type: ${type}`);
    }
  }

  private handleRegisterHost(
    sessionId: string,
    socket: WebSocket,
    message: any
  ): void {
    const { deviceId, accessCode } = message;

    // Check if device ID already exists
    const existingHost = Array.from(this.hosts.values()).find(
      (h) => h.deviceId === deviceId
    );
    if (existingHost) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Device ID already in use",
        })
      );
      return;
    }

    const hostSession: HostSession = {
      id: sessionId,
      deviceId,
      accessCode,
      socket,
      clients: new Set(),
    };

    this.hosts.set(sessionId, hostSession);

    socket.send(
      JSON.stringify({
        type: "host-registered",
        deviceId,
        accessCode,
        sessionId,
      })
    );

    console.log(`Host registered: ${deviceId} (${sessionId})`);
  }

  private handleConnectionRequest(
    sessionId: string,
    socket: WebSocket,
    message: any
  ): void {
    const { deviceId, accessCode } = message;

    // Find host with matching device ID and access code
    const host = Array.from(this.hosts.values()).find(
      (h) => h.deviceId === deviceId && h.accessCode === accessCode
    );

    if (!host) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid device ID or access code",
        })
      );
      return;
    }

    // Create client session
    const clientSession: ClientSession = {
      id: sessionId,
      socket,
      hostId: host.id,
    };

    this.clients.set(sessionId, clientSession);
    host.clients.add(sessionId);

    // Notify host of incoming connection
    host.socket.send(
      JSON.stringify({
        type: "connection-request",
        peerId: sessionId,
      })
    );

    // Confirm connection to client
    socket.send(
      JSON.stringify({
        type: "connection-accepted",
        hostId: host.id,
        peerId: sessionId,
      })
    );

    console.log(`Client ${sessionId} connected to host ${host.deviceId}`);
  }

  private forwardSignallingMessage(sessionId: string, message: any): void {
    const { peerId } = message;

    // Determine if sender is host or client
    const host = this.hosts.get(sessionId);
    const client = this.clients.get(sessionId);

    if (host) {
      // Host sending to client
      const targetClient = this.clients.get(peerId);
      if (targetClient) {
        targetClient.socket.send(
          JSON.stringify({
            ...message,
            peerId: sessionId, // Replace with host's session ID
          })
        );
      }
    } else if (client) {
      // Client sending to host
      const targetHost = this.hosts.get(client.hostId!);
      if (targetHost) {
        targetHost.socket.send(
          JSON.stringify({
            ...message,
            peerId: sessionId, // Replace with client's session ID
          })
        );
      }
    }
  }

  private handleDisconnection(sessionId: string): void {
    const host = this.hosts.get(sessionId);
    const client = this.clients.get(sessionId);

    if (host) {
      // Host disconnected - notify all clients
      host.clients.forEach((clientId) => {
        const clientSession = this.clients.get(clientId);
        if (clientSession) {
          clientSession.socket.send(
            JSON.stringify({
              type: "host-disconnected",
            })
          );
          this.clients.delete(clientId);
        }
      });

      this.hosts.delete(sessionId);
      console.log(`Host disconnected: ${host.deviceId} (${sessionId})`);
    } else if (client) {
      // Client disconnected - notify host
      const hostSession = this.hosts.get(client.hostId!);
      if (hostSession) {
        hostSession.clients.delete(sessionId);
        hostSession.socket.send(
          JSON.stringify({
            type: "peer-disconnected",
            peerId: sessionId,
          })
        );
      }

      this.clients.delete(sessionId);
      console.log(`Client disconnected: ${sessionId}`);
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getStats(): any {
    return {
      hosts: this.hosts.size,
      clients: this.clients.size,
      totalConnections: this.hosts.size + this.clients.size,
      activeSessions: Array.from(this.hosts.values()).map((host) => ({
        deviceId: host.deviceId,
        clientCount: host.clients.size,
      })),
    };
  }
}

// Start signalling server if this file is run directly
if (require.main === module) {
  new SignallingServer(3002);
}
