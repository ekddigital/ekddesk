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
  Chip,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Timer as TimerIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import type { AppSettings } from "../preload";
import { deviceManager, DeviceInfo } from "../services/device.service";
import {
  remoteDesktopService,
  RemoteDesktopConfig,
  ConnectionInfo,
} from "../services/remote-desktop.service";

interface HostViewProps {
  onBack: () => void;
  settings: AppSettings | null;
}

const HostView: React.FC<HostViewProps> = ({ onBack, settings }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [tempPassword, setTempPassword] = useState<string>("");
  const [tempExpiresAt, setTempExpiresAt] = useState<Date | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");

  // Hosting-related state
  const [isHosting, setIsHosting] = useState<boolean>(false);
  const [hostingConfig, setHostingConfig] = useState<RemoteDesktopConfig>({
    quality: "high",
    enableAudio: true,
    enableClipboard: true,
    allowMultipleConnections: true,
    requirePassword: false,
    maxConnections: 5,
    enableFileTransfer: true,
  });
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [hostingError, setHostingError] = useState<string>("");

  useEffect(() => {
    const loadDeviceInfo = () => {
      const info = deviceManager.getDeviceInfo();
      setDeviceInfo(info);

      const credInfo = deviceManager.getCredentialsInfo();
      if (credInfo.hasTemporary && credInfo.tempExpiresAt) {
        setTempExpiresAt(credInfo.tempExpiresAt);
      }
    };

    loadDeviceInfo();
  }, []);

  useEffect(() => {
    // Setup remote desktop service event listeners
    const handleHostingStarted = (data: any) => {
      setIsHosting(true);
      setSuccess(`Started hosting device ${data.deviceId}`);
      setHostingError("");
    };

    const handleHostingStopped = (data: any) => {
      setIsHosting(false);
      setConnections([]);
      setSuccess(`Stopped hosting device ${data.deviceId}`);
    };

    const handleConnectionEstablished = (data: {
      connection: ConnectionInfo;
    }) => {
      setConnections((prev) => [...prev, data.connection]);
      setSuccess(`New connection from ${data.connection.deviceName}`);
    };

    const handleConnectionLost = (data: {
      connection: ConnectionInfo;
      reason?: string;
    }) => {
      setConnections((prev) =>
        prev.filter((conn) => conn.id !== data.connection.id)
      );
      console.log(
        `Connection lost: ${data.connection.deviceName} (${data.reason})`
      );
    };

    const handleConnectionRequest = (data: {
      fromDeviceId: string;
      deviceName: string;
    }) => {
      setSuccess(
        `Connection request from ${data.deviceName} (${data.fromDeviceId})`
      );
    };

    const handleError = (data: {
      code: string;
      message: string;
      details?: any;
    }) => {
      setHostingError(`${data.code}: ${data.message}`);
      console.error("Remote desktop error:", data);
    };

    // Add event listeners
    remoteDesktopService.on("hosting-started", handleHostingStarted);
    remoteDesktopService.on("hosting-stopped", handleHostingStopped);
    remoteDesktopService.on(
      "connection-established",
      handleConnectionEstablished
    );
    remoteDesktopService.on("connection-lost", handleConnectionLost);
    remoteDesktopService.on("connection-request", handleConnectionRequest);
    remoteDesktopService.on("error", handleError);

    // Check initial hosting status
    const hostingStatus = remoteDesktopService.getHostingStatus();
    setIsHosting(hostingStatus.isHosting);
    setConnections(hostingStatus.connections || []);

    // Cleanup
    return () => {
      remoteDesktopService.removeListener(
        "hosting-started",
        handleHostingStarted
      );
      remoteDesktopService.removeListener(
        "hosting-stopped",
        handleHostingStopped
      );
      remoteDesktopService.removeListener(
        "connection-established",
        handleConnectionEstablished
      );
      remoteDesktopService.removeListener(
        "connection-lost",
        handleConnectionLost
      );
      remoteDesktopService.removeListener(
        "connection-request",
        handleConnectionRequest
      );
      remoteDesktopService.removeListener("error", handleError);
    };
  }, []);

  const handleRegisterDevice = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const registeredDevice = await deviceManager.registerDevice(
        passwordInput || undefined
      );
      setDeviceInfo(registeredDevice);
      setSuccess("Device registered successfully! You can now start hosting.");
      setPasswordInput("");
    } catch (err: any) {
      setError(err.message || "Failed to register device");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTempPassword = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const tempCred = await deviceManager.generateTempPassword();
      setTempPassword(tempCred.token);
      setTempExpiresAt(tempCred.expiresAt);
      setSuccess("Temporary password generated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to generate temporary password");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPermanentPassword = async () => {
    if (!passwordInput.trim()) {
      setError("Please enter a password");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await deviceManager.setPermanentPassword(passwordInput);
      setSuccess("Permanent password set successfully!");
      setPasswordInput("");
    } catch (err: any) {
      setError(err.message || "Failed to set permanent password");
    } finally {
      setLoading(false);
    }
  };

  const handleStartHosting = async () => {
    setLoading(true);
    setHostingError("");
    setSuccess("");

    try {
      await remoteDesktopService.startHosting(hostingConfig);
      // Success will be handled by the event listener
    } catch (err: any) {
      setHostingError(err.message || "Failed to start hosting");
    } finally {
      setLoading(false);
    }
  };

  const handleStopHosting = async () => {
    setLoading(true);
    setHostingError("");

    try {
      await remoteDesktopService.stopHosting();
      // Success will be handled by the event listener
    } catch (err: any) {
      setHostingError(err.message || "Failed to stop hosting");
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: keyof RemoteDesktopConfig, value: any) => {
    setHostingConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
  };

  const formatTimeRemaining = (expiresAt: Date): string => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  const isRegistered = deviceInfo?.isRegistered || false;

  return (
    <Box sx={{ p: 3 }}>
      <Button variant="text" onClick={onBack} sx={{ mb: 2 }}>
        &larr; Back
      </Button>
      <Typography variant="h5" gutterBottom>
        Host Your Device
      </Typography>

      {!isRegistered ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Device Registration
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              First, register your device to enable hosting
            </Typography>

            <Stack spacing={2} mt={2}>
              <TextField
                label="Device ID"
                value={deviceInfo?.deviceId || "Generating..."}
                disabled
                fullWidth
              />
              <TextField
                label="Device Name"
                value={deviceInfo?.deviceName || ""}
                disabled
                fullWidth
              />
              <TextField
                label="Set Permanent Password (optional)"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                fullWidth
                helperText="Optional: Set a permanent password for this device"
              />
              <Button
                variant="contained"
                onClick={handleRegisterDevice}
                disabled={loading}
                fullWidth
                startIcon={
                  loading ? <CircularProgress size={20} /> : <SecurityIcon />
                }
              >
                {loading ? "Registering..." : "Register Device"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={3}>
          {/* Device Info Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Information
              </Typography>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary">
                    Device ID:
                  </Typography>
                  <Chip
                    label={deviceInfo?.deviceId || ""}
                    size="small"
                    variant="outlined"
                  />
                  <Tooltip title="Copy Device ID">
                    <IconButton
                      size="small"
                      onClick={() =>
                        copyToClipboard(deviceInfo?.deviceId || "")
                      }
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Device Name: {deviceInfo?.deviceName}
                  </Typography>
                </Box>
                <Box>
                  <Chip
                    label="Registered"
                    color="success"
                    size="small"
                    icon={<SecurityIcon />}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Permanent Password Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Permanent Password
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Set a permanent password for consistent access
              </Typography>

              <Stack spacing={2} mt={2}>
                <TextField
                  label="New Permanent Password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={handleSetPermanentPassword}
                  disabled={loading || !passwordInput.trim()}
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <SecurityIcon />
                  }
                >
                  {loading ? "Setting..." : "Set Permanent Password"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Temporary Password Card */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Temporary Password
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Generate a one-time password for quick access (expires in 10
                minutes)
              </Typography>

              <Stack spacing={2} mt={2}>
                {tempPassword && (
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "background.default",
                      borderRadius: 1,
                      border: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Stack spacing={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          Temporary Password:
                        </Typography>
                        <Tooltip title="Copy Temporary Password">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(tempPassword)}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{ fontFamily: "monospace", letterSpacing: 1 }}
                      >
                        {tempPassword}
                      </Typography>
                      {tempExpiresAt && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <TimerIcon fontSize="small" color="warning" />
                          <Typography variant="body2" color="warning.main">
                            Expires in: {formatTimeRemaining(tempExpiresAt)}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}

                <Button
                  variant="contained"
                  onClick={handleGenerateTempPassword}
                  disabled={loading}
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <RefreshIcon />
                  }
                >
                  {loading ? "Generating..." : "Generate Temporary Password"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Hosting Controls */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Start Hosting
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Share your device ID and password with others to allow
                connections
              </Typography>

              <Divider sx={{ my: 2 }} />

              <FormControl fullWidth>
                <InputLabel>Quality</InputLabel>
                <Select
                  value={hostingConfig.quality}
                  onChange={(e) =>
                    handleConfigChange("quality", e.target.value)
                  }
                  disabled={loading}
                >
                  <MenuItem value="low">Low (Fast, but lower quality)</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">
                    High (Best quality, but may lag)
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={hostingConfig.enableAudio}
                    onChange={(e) =>
                      handleConfigChange("enableAudio", e.target.checked)
                    }
                    disabled={loading}
                  />
                }
                label="Enable Audio"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={hostingConfig.enableClipboard}
                    onChange={(e) =>
                      handleConfigChange("enableClipboard", e.target.checked)
                    }
                    disabled={loading}
                  />
                }
                label="Enable Clipboard Sharing"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={hostingConfig.allowMultipleConnections}
                    onChange={(e) =>
                      handleConfigChange(
                        "allowMultipleConnections",
                        e.target.checked
                      )
                    }
                    disabled={loading}
                  />
                }
                label="Allow Multiple Connections"
              />

              <TextField
                label="Max Connections"
                type="number"
                value={hostingConfig.maxConnections}
                onChange={(e) =>
                  handleConfigChange("maxConnections", Number(e.target.value))
                }
                disabled={loading}
                fullWidth
                helperText="Maximum number of simultaneous connections"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={hostingConfig.enableFileTransfer}
                    onChange={(e) =>
                      handleConfigChange("enableFileTransfer", e.target.checked)
                    }
                    disabled={loading}
                  />
                }
                label="Enable File Transfer"
              />

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={isHosting ? handleStopHosting : handleStartHosting}
                disabled={loading}
                sx={{ mt: 2 }}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} />
                  ) : isHosting ? (
                    <StopIcon />
                  ) : (
                    <StartIcon />
                  )
                }
              >
                {loading
                  ? isHosting
                    ? "Stopping..."
                    : "Starting..."
                  : isHosting
                    ? "Stop Hosting"
                    : "Start Hosting"}
              </Button>

              {hostingError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {hostingError}
                </Alert>
              )}
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

export default HostView;
