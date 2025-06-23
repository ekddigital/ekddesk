import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Slide,
  Modal,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from "@mui/material";
import {
  Close as CloseIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";

interface AppNotification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
}

interface NotificationCenterProps {
  notifications: AppNotification[];
  open: boolean;
  onClose: () => void;
  onDismiss: (index: number) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  open,
  onClose,
  onDismiss,
}) => {
  const getNotificationIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "success":
        return <SuccessIcon color="success" fontSize="small" />;
      case "warning":
        return <WarningIcon color="warning" fontSize="small" />;
      case "error":
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <InfoIcon color="info" fontSize="small" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      BackdropProps={{
        invisible: true,
      }}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        pt: "50px", // Below the toolbar
        pr: 2,
        zIndex: 1300,
      }}
    >
      <Slide direction="down" in={open} mountOnEnter unmountOnExit>
        <Card
          sx={{
            width: 360,
            maxHeight: 400,
            boxShadow: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <CardContent sx={{ p: 2 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6" fontSize="14px">
                Notifications
              </Typography>
              <IconButton size="small" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {notifications.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                No notifications
              </Typography>
            ) : (
              <List sx={{ p: 0, maxHeight: 300, overflow: "auto" }}>
                {notifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <ListItem
                      sx={{
                        px: 0,
                        py: 1,
                        alignItems: "flex-start",
                      }}
                    >
                      <Box sx={{ mr: 1, mt: 0.5 }}>
                        {getNotificationIcon(notification.type)}
                      </Box>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" fontSize="13px">
                            {notification.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="body2"
                              fontSize="12px"
                              color="text.secondary"
                            >
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {formatTimestamp(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => onDismiss(index)}
                          sx={{ opacity: 0.7 }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < notifications.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Slide>
    </Modal>
  );
};

export default NotificationCenter;
