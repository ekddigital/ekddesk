import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Security as SecurityIcon,
  Computer as ComputerIcon,
  Videocam as VideocamIcon,
  CallEnd as DisconnectIcon,
} from "@mui/icons-material";
import { apiService } from "../services/api.service";
import { remoteDesktopService } from "../services/remote-desktop.service";
import { enhancedRemoteDesktopService } from "../services/enhanced-remote-desktop.service";
import type { ConnectionInfo } from "../services/remote-desktop.service";

interface ConnectViewProps {
  onBack: () => void;
}

const ConnectView: React.FC<ConnectViewProps> = ({ onBack }) => {
  const [deviceId, setDeviceId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);

  useEffect(() => {
    // Setup remote desktop service event listeners
    const handleConnectionEstablished = (data: {
      connection: ConnectionInfo;
    }) => {
      setConnection(data.connection);
      setIsConnected(true);
      setSuccess(
        `Connected to ${data.connection.deviceName || data.connection.deviceId}`
      );
      setError("");
      setLoading(false);

      // Try to get the video stream after connection
      setTimeout(() => {
        const videoElement = document.getElementById(
          "remote-video"
        ) as HTMLVideoElement;
        if (videoElement && !videoElement.srcObject) {
          console.log(
            "No video stream detected, this might be a self-connection test"
          );
        }
      }, 1000);
    };

    const handleConnectionLost = (data: {
      connection: ConnectionInfo;
      reason?: string;
    }) => {
      setConnection(null);
      setIsConnected(false);
      setError(`Connection lost: ${data.reason || "Unknown reason"}`);
    };

    const handleError = (data: {
      code: string;
      message: string;
      details?: any;
    }) => {
      setError(`${data.code}: ${data.message}`);
      setLoading(false);
    };

    // Add event listeners
    remoteDesktopService.on(
      "connection-established",
      handleConnectionEstablished
    );
    remoteDesktopService.on("connection-lost", handleConnectionLost);
    remoteDesktopService.on("error", handleError);

    // Check initial connection status
    const connectionStatus = remoteDesktopService.getConnectionStatus();
    setIsConnected(connectionStatus.isConnected);
    setConnection(connectionStatus.connection || null);

    // Cleanup
    return () => {
      remoteDesktopService.removeListener(
        "connection-established",
        handleConnectionEstablished
      );
      remoteDesktopService.removeListener(
        "connection-lost",
        handleConnectionLost
      );
      remoteDesktopService.removeListener("error", handleError);
    };
  }, []);

  const handleConnect = async () => {
    if (!deviceId.trim() || !password.trim()) {
      setError("Please enter both Device ID and Password");
      return;
    }

    // Validate device ID format (10 characters, uppercase alphanumeric)
    if (!/^[A-Z0-9]{10}$/.test(deviceId.trim())) {
      setError("Device ID must be 10 uppercase alphanumeric characters");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Use the remote desktop service to connect
      await remoteDesktopService.connectToRemote(
        deviceId.trim().toUpperCase(),
        password.trim()
      );
      // Success will be handled by the event listener
    } catch (err: any) {
      setError(
        err.message || "Failed to connect. Please check your credentials."
      );
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await remoteDesktopService.disconnect();
      setConnection(null);
      setIsConnected(false);
      setSuccess("Disconnected successfully");
      setDeviceId("");
      setPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
  };

  const handleMouseMove = async (
    event: React.MouseEvent<HTMLCanvasElement | HTMLVideoElement>
  ) => {
    if (!isConnected) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) *
      (element instanceof HTMLCanvasElement ? element.width : rect.width);
    const y =
      ((event.clientY - rect.top) / rect.height) *
      (element instanceof HTMLCanvasElement ? element.height : rect.height);

    try {
      await remoteDesktopService.sendRemoteInput("mouse", {
        type: "mousemove",
        x: Math.round(x),
        y: Math.round(y),
        buttons: event.buttons,
      });
    } catch (err) {
      console.error("Failed to send mouse move:", err);
    }
  };

  const handleMouseDown = async (
    event: React.MouseEvent<HTMLCanvasElement | HTMLVideoElement>
  ) => {
    if (!isConnected) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) *
      (element instanceof HTMLCanvasElement ? element.width : rect.width);
    const y =
      ((event.clientY - rect.top) / rect.height) *
      (element instanceof HTMLCanvasElement ? element.height : rect.height);

    try {
      await remoteDesktopService.sendRemoteInput("mouse", {
        type: "mousedown",
        x: Math.round(x),
        y: Math.round(y),
        button: event.button,
      });
    } catch (err) {
      console.error("Failed to send mouse down:", err);
    }
  };

  const handleMouseUp = async (
    event: React.MouseEvent<HTMLCanvasElement | HTMLVideoElement>
  ) => {
    if (!isConnected) return;

    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) *
      (element instanceof HTMLCanvasElement ? element.width : rect.width);
    const y =
      ((event.clientY - rect.top) / rect.height) *
      (element instanceof HTMLCanvasElement ? element.height : rect.height);

    try {
      await remoteDesktopService.sendRemoteInput("mouse", {
        type: "mouseup",
        x: Math.round(x),
        y: Math.round(y),
        button: event.button,
      });
    } catch (err) {
      console.error("Failed to send mouse up:", err);
    }
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLCanvasElement | HTMLVideoElement>
  ) => {
    if (!isConnected) return;

    event.preventDefault(); // Prevent browser shortcuts

    try {
      await remoteDesktopService.sendRemoteInput("keyboard", {
        type: "keydown",
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
    } catch (err) {
      console.error("Failed to send key down:", err);
    }
  };

  const handleKeyUp = async (
    event: React.KeyboardEvent<HTMLCanvasElement | HTMLVideoElement>
  ) => {
    if (!isConnected) return;

    event.preventDefault();

    try {
      await remoteDesktopService.sendRemoteInput("keyboard", {
        type: "keyup",
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      });
    } catch (err) {
      console.error("Failed to send key up:", err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Button variant="text" onClick={onBack} sx={{ mb: 2 }}>
        &larr; Back
      </Button>
      <Typography variant="h5" gutterBottom>
        Connect to Remote Device
      </Typography>

      {!isConnected ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Remote Connection
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the Device ID and password provided by the host
            </Typography>

            <Stack spacing={3} mt={3}>
              <TextField
                label="Device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                fullWidth
                placeholder="ABC1234567"
                helperText="10-character uppercase alphanumeric ID"
                inputProps={{ maxLength: 10 }}
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                placeholder="Enter permanent or temporary password"
                helperText="Use the password provided by the device host"
              />

              <Button
                variant="contained"
                onClick={handleConnect}
                disabled={loading || !deviceId.trim() || !password.trim()}
                size="large"
                startIcon={
                  loading ? <CircularProgress size={20} /> : <ComputerIcon />
                }
              >
                {loading ? "Connecting..." : "Connect to Device"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {/* Connection Status */}
          <Card>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6" color="success.main">
                    Connected
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {connection?.deviceName || connection?.deviceId || deviceId}
                  </Typography>
                  {connection && (
                    <Chip
                      label={`Status: ${connection.status}`}
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                <Button
                  variant="outlined"
                  onClick={handleDisconnect}
                  disabled={loading}
                  color="error"
                  startIcon={
                    loading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <DisconnectIcon />
                    )
                  }
                >
                  {loading ? "Disconnecting..." : "Disconnect"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Remote Desktop View */}
          <Card>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                mb={2}
              >
                <Typography variant="h6">Remote Desktop</Typography>
                <Chip
                  icon={<VideocamIcon />}
                  label="Live View"
                  color="primary"
                  size="small"
                />
              </Stack>

              <Box
                sx={{
                  width: "100%",
                  height: 400,
                  border: "2px solid #e0e0e0",
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f8f9fa",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Remote video element for WebRTC stream */}
                <video
                  id="remote-video"
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    cursor: "crosshair",
                    display: connection ? "block" : "none",
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  tabIndex={0}
                />

                {/* Fallback canvas for non-WebRTC streams */}
                <canvas
                  id="remote-canvas"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    cursor: "crosshair",
                    display:
                      connection && !document.getElementById("remote-video")
                        ? "block"
                        : "none",
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  tabIndex={0}
                />

                {!connection && (
                  <Box sx={{ position: "absolute", textAlign: "center" }}>
                    <Typography variant="body1" color="text.secondary">
                      Waiting for remote screen...
                    </Typography>
                    <CircularProgress size={40} sx={{ mt: 2 }} />
                  </Box>
                )}
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Click on the screen to focus and interact with the remote
                desktop
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Status Messages */}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default ConnectView;
