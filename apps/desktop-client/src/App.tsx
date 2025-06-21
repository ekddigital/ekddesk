import React, { useState, useEffect } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Computer as ComputerIcon,
  Share as ShareIcon,
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  CropSquare as MaximizeIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { AnimatePresence, motion } from "framer-motion";

// Import our custom components
import HomeView from "./components/HomeView";
import HostView from "./components/HostView";
import ConnectView from "./components/ConnectView";
import SettingsView from "./components/SettingsView";
import StatusBar from "./components/StatusBar";
import NotificationCenter from "./components/NotificationCenter";
import ConnectionStatus from "./components/ConnectionStatus";

// Import types from preload
import type {
  ElectronAPI,
  AppSettings,
  ConnectionState,
  AppNotification,
  AppError,
} from "./preload";

// Extend Window interface to include our electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

type ViewType = "home" | "host" | "connect" | "settings";

/**
 * Main App Component for EKD Desk Desktop Client
 * Manages application state, theme, navigation, and real-time updates
 */
const App: React.FC = () => {
  // Application state
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isHosting: false,
    isConnected: false,
    status: "disconnected",
    connectedClients: 0,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Theme setup
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = React.useMemo(() => {
    const isDark =
      settings?.theme === "dark" ||
      (settings?.theme === "system" && prefersDarkMode);

    return createTheme({
      palette: {
        mode: isDark ? "dark" : "light",
        primary: {
          main: "#2563eb",
          light: "#3b82f6",
          dark: "#1d4ed8",
        },
        secondary: {
          main: "#7c3aed",
          light: "#8b5cf6",
          dark: "#6d28d9",
        },
        background: {
          default: isDark ? "#0f172a" : "#f8fafc",
          paper: isDark ? "#1e293b" : "#ffffff",
        },
      },
      shape: {
        borderRadius: 8,
      },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h4: {
          fontWeight: 600,
        },
        h6: {
          fontWeight: 500,
        },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: "none",
              borderRadius: 6,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              boxShadow: isDark
                ? "0 4px 6px -1px rgba(0, 0, 0, 0.3)"
                : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            },
          },
        },
      },
    });
  }, [settings?.theme, prefersDarkMode]);

  // Initialize app and load settings
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);

        // Load settings
        const appSettings = await window.electronAPI.getSettings();
        setSettings(appSettings);

        // Set up event listeners
        window.electronAPI.onConnectionStateChange((state: ConnectionState) => {
          setConnectionState(state);
        });

        window.electronAPI.onNotification((notification: AppNotification) => {
          setNotifications((prev) => [notification, ...prev].slice(0, 10));
        });

        window.electronAPI.onError((error: AppError) => {
          console.error("App error:", error);
          setNotifications((prev) =>
            [
              {
                id: `error-${Date.now()}`,
                type: "error" as const,
                title: "Error",
                message: error.message,
                timestamp: Date.now(),
              },
              ...prev,
            ].slice(0, 10)
          );
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setIsLoading(false);
      }
    };

    initializeApp();

    // Cleanup event listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners("connection:state-changed");
      window.electronAPI.removeAllListeners("app:notification");
      window.electronAPI.removeAllListeners("app:error");
    };
  }, []);

  // Handle settings updates
  const handleSettingsUpdate = async (newSettings: Partial<AppSettings>) => {
    try {
      await window.electronAPI.updateSettings(newSettings);
      setSettings((prev: AppSettings | null) =>
        prev ? { ...prev, ...newSettings } : null
      );
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  // Navigation items
  const navigationItems = [
    { id: "home", label: "Home", icon: ComputerIcon },
    { id: "host", label: "Host Session", icon: ShareIcon },
    { id: "connect", label: "Connect", icon: ComputerIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case "home":
        return (
          <HomeView
            onStartHosting={() => setCurrentView("host")}
            onConnect={() => setCurrentView("connect")}
            connectionState={connectionState}
          />
        );
      case "host":
        return (
          <HostView onBack={() => setCurrentView("home")} settings={settings} />
        );
      case "connect":
        return (
          <ConnectView
            onBack={() => setCurrentView("home")}
            settings={settings}
          />
        );
      case "settings":
        return (
          <SettingsView
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
            onBack={() => setCurrentView("home")}
          />
        );
      default:
        return null;
    }
  };

  if (isLoading || !settings) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          bgcolor="background.default"
        >
          <Typography variant="h6" color="text.secondary">
            Loading EKD Desk...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box display="flex" flexDirection="column" height="100vh">
        {/* Custom title bar (macOS) */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            backgroundColor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            WebkitAppRegion: "drag",
          }}
        >
          <Toolbar sx={{ minHeight: "40px !important", px: 1 }}>
            <IconButton
              size="small"
              onClick={() => setDrawerOpen(true)}
              sx={{ WebkitAppRegion: "no-drag" }}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" sx={{ ml: 1, flex: 1, fontSize: "14px" }}>
              EKD Desk
            </Typography>

            <ConnectionStatus connectionState={connectionState} />

            <Tooltip title="Notifications">
              <IconButton size="small" sx={{ WebkitAppRegion: "no-drag" }}>
                <Badge badgeContent={notifications.length} color="error">
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>

            <Box sx={{ ml: 1, WebkitAppRegion: "no-drag" }}>
              <IconButton size="small" onClick={window.electronAPI.minimizeApp}>
                <MinimizeIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={window.electronAPI.maximizeApp}>
                <MaximizeIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={window.electronAPI.closeApp}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Navigation Drawer */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: { width: 240 },
          }}
        >
          <List>
            {navigationItems.map((item) => (
              <ListItem
                key={item.id}
                button
                selected={currentView === item.id}
                onClick={() => {
                  setCurrentView(item.id as ViewType);
                  setDrawerOpen(false);
                }}
              >
                <ListItemIcon>
                  <item.icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Main Content */}
        <Box component="main" sx={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              style={{ height: "100%", overflow: "auto" }}
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Status Bar */}
        <StatusBar connectionState={connectionState} />

        {/* Notification Center */}
        <NotificationCenter
          notifications={notifications}
          onDismiss={(index: number) => {
            setNotifications((prev) => prev.filter((_, i) => i !== index));
          }}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
