import { Logger } from "@ekd-desk/shared";

export interface PeerInfo {
  deviceId: string;
  userId: string;
  socketId: string;
  status: "online" | "busy" | "offline";
  capabilities: string[];
  lastSeen: Date;
}

export interface ConnectionRequest {
  fromDeviceId: string;
  toDeviceId: string;
  requestId: string;
  timestamp: Date;
  metadata?: any;
}

export class PeerManager {
  private logger = Logger.createLogger("PeerManager");
  private peers = new Map<string, PeerInfo>();
  private connectionRequests = new Map<string, ConnectionRequest>();

  constructor() {
    this.logger.info("PeerManager initialized");
  }

  addPeer(peerInfo: PeerInfo): void {
    this.peers.set(peerInfo.deviceId, peerInfo);
    this.logger.info("Peer added", {
      deviceId: peerInfo.deviceId,
      status: peerInfo.status,
    });
  }

  removePeer(deviceId: string): void {
    const peer = this.peers.get(deviceId);
    if (peer) {
      this.peers.delete(deviceId);
      this.logger.info("Peer removed", { deviceId });
    }
  }

  updatePeerStatus(deviceId: string, status: PeerInfo["status"]): void {
    const peer = this.peers.get(deviceId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = new Date();
      this.logger.info("Peer status updated", { deviceId, status });
    }
  }

  getPeer(deviceId: string): PeerInfo | undefined {
    return this.peers.get(deviceId);
  }

  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getAvailablePeers(excludeDeviceId?: string): PeerInfo[] {
    return Array.from(this.peers.values()).filter(
      (peer) => peer.status === "online" && peer.deviceId !== excludeDeviceId
    );
  }

  createConnectionRequest(
    fromDeviceId: string,
    toDeviceId: string,
    metadata?: any
  ): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: ConnectionRequest = {
      fromDeviceId,
      toDeviceId,
      requestId,
      timestamp: new Date(),
      metadata,
    };

    this.connectionRequests.set(requestId, request);
    this.logger.info("Connection request created", {
      requestId,
      fromDeviceId,
      toDeviceId,
    });

    return requestId;
  }

  getConnectionRequest(requestId: string): ConnectionRequest | undefined {
    return this.connectionRequests.get(requestId);
  }

  removeConnectionRequest(requestId: string): void {
    const request = this.connectionRequests.get(requestId);
    if (request) {
      this.connectionRequests.delete(requestId);
      this.logger.info("Connection request removed", { requestId });
    }
  }

  validateConnection(fromDeviceId: string, toDeviceId: string): boolean {
    const fromPeer = this.getPeer(fromDeviceId);
    const toPeer = this.getPeer(toDeviceId);

    if (!fromPeer || !toPeer) {
      this.logger.warn("Connection validation failed: peer not found", {
        fromDeviceId,
        toDeviceId,
      });
      return false;
    }

    if (fromPeer.status !== "online" || toPeer.status !== "online") {
      this.logger.warn("Connection validation failed: peer not online", {
        fromDeviceId,
        toDeviceId,
        fromStatus: fromPeer.status,
        toStatus: toPeer.status,
      });
      return false;
    }

    return true;
  }

  cleanup(): void {
    // Clean up expired connection requests
    const now = new Date();
    const expired = Array.from(this.connectionRequests.entries())
      .filter(
        ([_, request]) => now.getTime() - request.timestamp.getTime() > 30000
      ) // 30 seconds
      .map(([requestId]) => requestId);

    expired.forEach((requestId) => {
      this.removeConnectionRequest(requestId);
    });

    if (expired.length > 0) {
      this.logger.info("Cleaned up expired connection requests", {
        count: expired.length,
      });
    }
  }
}
