import React from "react";
import { Chip, CircularProgress } from "@mui/material";
import {
  CheckCircle as ConnectedIcon,
  Cancel as DisconnectedIcon,
  Share as HostingIcon,
} from "@mui/icons-material";
import type { ConnectionState } from "../preload";

interface ConnectionStatusProps {
  connectionState: ConnectionState;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
}) => {
  const getStatusConfig = () => {
    switch (connectionState.status) {
      case "connected":
        return {
          label: "Connected",
          color: "success" as const,
          icon: <ConnectedIcon />,
        };
      case "hosting":
        return {
          label: "Hosting",
          color: "primary" as const,
          icon: <HostingIcon />,
        };
      case "connecting":
        return {
          label: "Connecting...",
          color: "warning" as const,
          icon: <CircularProgress size={16} />,
        };
      case "error":
        return {
          label: "Error",
          color: "error" as const,
          icon: <DisconnectedIcon />,
        };
      default:
        return {
          label: "Disconnected",
          color: "default" as const,
          icon: <DisconnectedIcon />,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
    />
  );
};

export default ConnectionStatus;
