import React from "react";
import { Box } from "@mui/material";

interface NotificationCenterProps {
  notifications: any[];
  onDismiss: (index: number) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onDismiss,
}) => {
  return <Box>{/* Notification center will be implemented here */}</Box>;
};

export default NotificationCenter;
