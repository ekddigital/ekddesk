/**
 * WebRTC Service for EKD Desk
 * Handles peer-to-peer video streaming and data channels
 */
import io, { Socket } from "socket.io-client";

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  videoConstraints: MediaStreamConstraints["video"];
  audioConstraints: MediaStreamConstraints["audio"];
}

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  remoteStream?: MediaStream;
  isHost: boolean;
  status: "connecting" | "connected" | "disconnected" | "failed";
}

export class WebRTCService {
  private connections = new Map<string, PeerConnection>();
  private localStream: MediaStream | null = null;
  private isHost = false;
  private config: WebRTCConfig;
  private signallingSocket: Socket | null = null;

  constructor() {
    this.config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Add TURN servers here for production
      ],
      videoConstraints: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audioConstraints: true,
    };
  }

  /**
   * Initialize signalling connection
   */
  async initializeSignalling(signalingUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.signallingSocket = io(signalingUrl, {
        autoConnect: true,
        reconnection: true,
        transports: ["websocket", "polling"],
      });

      this.signallingSocket.on("connect", () => {
        console.log("Signalling connection established");
        resolve();
      });

      this.signallingSocket.on("connect_error", (error) => {
        console.error("Signalling connection error:", error);
        reject(error);
      });

      this.signallingSocket.on("offer", (data) => {
        this.handleSignallingMessage({ type: "offer", ...data });
      });

      this.signallingSocket.on("answer", (data) => {
        this.handleSignallingMessage({ type: "answer", ...data });
      });

      this.signallingSocket.on("ice-candidate", (data) => {
        this.handleSignallingMessage({ type: "ice-candidate", ...data });
      });
    });
  }

  /**
   * Start hosting - capture screen and prepare for connections
   */
  async startHosting(): Promise<{ deviceId: string; accessCode: string }> {
    try {
      this.isHost = true;

      // Capture screen using Electron's desktopCapturer or Web API
      this.localStream = await this.captureScreen();

      // Generate hosting credentials
      const deviceId = this.generateDeviceId();
      const accessCode = this.generateAccessCode();

      // Register as host with signalling server
      this.sendSignallingMessage({
        type: "register-host",
        deviceId,
        accessCode,
      });

      console.log(`Started hosting with Device ID: ${deviceId}`);
      return { deviceId, accessCode };
    } catch (error) {
      console.error("Failed to start hosting:", error);
      throw error;
    }
  }

  /**
   * Connect to a host
   */
  async connectToHost(deviceId: string, accessCode: string): Promise<void> {
    try {
      this.isHost = false;

      // Request connection to host
      this.sendSignallingMessage({
        type: "request-connection",
        deviceId,
        accessCode,
      });

      console.log(`Requesting connection to device: ${deviceId}`);
    } catch (error) {
      console.error("Failed to connect to host:", error);
      throw error;
    }
  }

  /**
   * Capture screen for hosting using Electron's IPC
   */
  private async captureScreen(): Promise<MediaStream> {
    try {
      // First, request screen recording permission via Electron IPC
      if (window.electronAPI?.requestScreenAccess) {
        console.log("Requesting screen recording permission...");
        const hasPermission = await window.electronAPI.requestScreenAccess();

        if (!hasPermission) {
          throw new Error(
            "Screen recording permission denied. Please enable it in System Preferences."
          );
        }
        console.log("Screen recording permission granted");
      }

      // Use Electron's desktopCapturer through IPC
      if (window.electronAPI?.getScreenSources) {
        console.log("Getting screen sources via Electron...");
        const sources = await window.electronAPI.getScreenSources();

        if (!sources || sources.length === 0) {
          throw new Error("No screen sources available");
        }

        // Use the first available screen source (usually the primary display)
        const primarySource =
          sources.find(
            (source) =>
              source.name === "Entire Screen" || source.name.includes("Screen")
          ) || sources[0];

        console.log("Using screen source:", primarySource.name);

        // Create media stream from the screen source
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: primarySource.id,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
              minFrameRate: 30,
              maxFrameRate: 60,
            },
          } as any,
        });

        console.log("Screen capture started successfully via Electron");
        return stream;
      }

      // Fallback to browser API (for web testing)
      console.log("Falling back to browser getDisplayMedia API...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: this.config.videoConstraints,
        audio: this.config.audioConstraints,
      });

      console.log("Screen capture started successfully via browser API");
      return stream;
    } catch (error) {
      console.error("Failed to capture screen:", error);

      if (error instanceof Error) {
        if (
          error.message.includes("Permission denied") ||
          error.message.includes("permission")
        ) {
          throw new Error(
            "Screen recording permission denied. Please allow screen sharing when prompted, or enable it in System Preferences > Security & Privacy > Privacy > Screen Recording."
          );
        }
      }

      throw new Error(
        "Failed to capture screen. Please allow screen sharing permissions when prompted."
      );
    }
  }

  /**
   * Create RTCPeerConnection for a new peer
   */
  private async createPeerConnection(
    peerId: string,
    isInitiator: boolean
  ): Promise<PeerConnection> {
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    const peerConnection: PeerConnection = {
      id: peerId,
      connection,
      isHost: this.isHost,
      status: "connecting",
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignallingMessage({
          type: "ice-candidate",
          peerId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      peerConnection.status = this.mapConnectionState(
        connection.connectionState
      );
      console.log(`Connection ${peerId} state: ${peerConnection.status}`);

      if (peerConnection.status === "connected") {
        this.onPeerConnected(peerConnection);
      } else if (
        peerConnection.status === "disconnected" ||
        peerConnection.status === "failed"
      ) {
        this.onPeerDisconnected(peerConnection);
      }
    };

    // Handle remote stream (for clients connecting to host)
    connection.ontrack = (event) => {
      console.log("Received remote stream");
      peerConnection.remoteStream = event.streams[0];
      this.onRemoteStreamReceived(peerConnection, event.streams[0]);
    };

    // Add local stream (for hosts)
    if (this.isHost && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        connection.addTrack(track, this.localStream!);
      });
    }

    // Create data channel for remote input
    if (isInitiator) {
      const dataChannel = connection.createDataChannel("remote-input", {
        ordered: true,
      });
      peerConnection.dataChannel = dataChannel;
      this.setupDataChannel(dataChannel, peerId);
    } else {
      connection.ondatachannel = (event) => {
        peerConnection.dataChannel = event.channel;
        this.setupDataChannel(event.channel, peerId);
      };
    }

    this.connections.set(peerId, peerConnection);
    return peerConnection;
  }

  /**
   * Setup data channel for remote input
   */
  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`Data channel opened for peer: ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleRemoteInput(data);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error for peer ${peerId}:`, error);
    };
  }

  /**
   * Handle signalling messages
   */
  private async handleSignallingMessage(message: any): Promise<void> {
    const { type, peerId, data } = message;

    switch (type) {
      case "connection-request":
        if (this.isHost) {
          await this.handleConnectionRequest(peerId);
        }
        break;

      case "offer":
        await this.handleOffer(peerId, data);
        break;

      case "answer":
        await this.handleAnswer(peerId, data);
        break;

      case "ice-candidate":
        await this.handleIceCandidate(peerId, data);
        break;

      case "peer-disconnected":
        this.onPeerDisconnected(this.connections.get(peerId)!);
        break;

      default:
        console.log("Unknown signalling message:", message);
    }
  }

  /**
   * Handle incoming connection request (host side)
   */
  private async handleConnectionRequest(peerId: string): Promise<void> {
    try {
      const peerConnection = await this.createPeerConnection(peerId, true);

      const offer = await peerConnection.connection.createOffer();
      await peerConnection.connection.setLocalDescription(offer);

      this.sendSignallingMessage({
        type: "offer",
        peerId,
        data: offer,
      });
    } catch (error) {
      console.error("Failed to handle connection request:", error);
    }
  }

  /**
   * Handle WebRTC offer
   */
  private async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      const peerConnection = await this.createPeerConnection(peerId, false);

      await peerConnection.connection.setRemoteDescription(offer);
      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);

      this.sendSignallingMessage({
        type: "answer",
        peerId,
        data: answer,
      });
    } catch (error) {
      console.error("Failed to handle offer:", error);
    }
  }

  /**
   * Handle WebRTC answer
   */
  private async handleAnswer(
    peerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      const peerConnection = this.connections.get(peerId);
      if (peerConnection) {
        await peerConnection.connection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error("Failed to handle answer:", error);
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleIceCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    try {
      const peerConnection = this.connections.get(peerId);
      if (peerConnection) {
        await peerConnection.connection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error("Failed to handle ICE candidate:", error);
    }
  }

  /**
   * Send remote input to host
   */
  sendRemoteInput(inputData: any): void {
    if (!this.isHost) {
      // Client sending input to host
      this.connections.forEach((peerConnection) => {
        if (
          peerConnection.dataChannel &&
          peerConnection.dataChannel.readyState === "open"
        ) {
          peerConnection.dataChannel.send(JSON.stringify(inputData));
        }
      });
    }
  }

  /**
   * Handle remote input (host side)
   */
  private handleRemoteInput(inputData: any): void {
    if (this.isHost) {
      // Host receiving input from client
      this.processRemoteInput(inputData);
    }
  }

  /**
   * Process remote input on host system
   */
  private processRemoteInput(inputData: any): void {
    // This would interface with Electron's main process to inject input
    // For now, we'll just log it
    console.log("Processing remote input:", inputData);

    // TODO: Send to main process via IPC
    // window.electronAPI?.remoteInput?.inject(inputData);
  }

  /**
   * Event handlers for UI integration
   */
  private onPeerConnected(peerConnection: PeerConnection): void {
    console.log(`Peer connected: ${peerConnection.id}`);
    // Emit event to UI
  }

  private onPeerDisconnected(peerConnection: PeerConnection): void {
    console.log(`Peer disconnected: ${peerConnection.id}`);
    this.connections.delete(peerConnection.id);
  }

  private onRemoteStreamReceived(
    peerConnection: PeerConnection,
    stream: MediaStream
  ): void {
    console.log(`Remote stream received from: ${peerConnection.id}`);
    // Emit event to UI with stream
    this.displayRemoteStream(stream);
  }

  /**
   * Display remote stream in UI
   */
  private displayRemoteStream(stream: MediaStream): void {
    const videoElement = document.getElementById(
      "remote-video"
    ) as HTMLVideoElement;
    if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.play();
    }
  }

  /**
   * Test screen capture and display in video element
   */
  async testScreenCapture(): Promise<void> {
    try {
      console.log("Testing screen capture...");
      const stream = await this.captureScreen();

      // Display the stream in the video element immediately for testing
      this.displayRemoteStream(stream);

      console.log("Screen capture test successful, stream displayed");
    } catch (error) {
      console.error("Screen capture test failed:", error);
      throw error;
    }
  }

  /**
   * Utility methods
   */
  private sendSignallingMessage(message: any): void {
    if (this.signallingSocket && this.signallingSocket.connected) {
      this.signallingSocket.emit(message.type, message);
    }
  }

  private mapConnectionState(
    state: RTCPeerConnectionState
  ): PeerConnection["status"] {
    switch (state) {
      case "connected":
        return "connected";
      case "connecting":
        return "connecting";
      case "disconnected":
        return "disconnected";
      case "failed":
        return "failed";
      default:
        return "connecting";
    }
  }

  private generateDeviceId(): string {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  }

  private generateAccessCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Cleanup
   */
  disconnect(): void {
    this.connections.forEach((peerConnection) => {
      peerConnection.connection.close();
    });
    this.connections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.signallingSocket) {
      this.signallingSocket.close();
      this.signallingSocket = null;
    }
  }
}

export const webRTCService = new WebRTCService();
