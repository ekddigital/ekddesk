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
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { AnimatePresence, motion } from "framer-motion";

// Import our custom components
import HomeView from "./components/HomeView";
import HostView from "./components/HostView";
import ConnectView from "./components/ConnectView";
import SettingsView from "./components/SettingsView";
import AboutView from "./components/AboutView";
import LoginView from "./components/LoginView";
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

type ViewType = "login" | "home" | "host" | "connect" | "settings" | "about";

/**
 * Main App Component for EKD Desk Desktop Client
 * Manages application state, theme, navigation, and real-time updates
 */
const App: React.FC = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Application state
  const [currentView, setCurrentView] = useState<ViewType>("login");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isHosting: false,
    isConnected: false,
    status: "disconnected",
    connectedClients: 0,
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
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

        // Check for existing authentication
        const savedUser = localStorage.getItem("user");
        const savedToken = localStorage.getItem("accessToken");

        if (savedUser && savedToken) {
          try {
            const user = JSON.parse(savedUser);
            setCurrentUser(user);
            setIsAuthenticated(true);
            setCurrentView("home");
          } catch (e) {
            // Invalid saved data, clear it
            localStorage.removeItem("user");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
          }
        }

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

  // Authentication handlers
  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setCurrentView("home");
    setNotifications((prev) =>
      [
        {
          id: Date.now().toString(),
          type: "success" as const,
          title: "Login Successful",
          message: `Welcome back, ${user.firstName}!`,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 10)
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentView("login");
    setNotifications((prev) =>
      [
        {
          id: Date.now().toString(),
          type: "info" as const,
          title: "Logged Out",
          message: "You have been logged out successfully",
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 10)
    );
  };

  // Navigation items
  const navigationItems = [
    { id: "home", label: "Home", icon: ComputerIcon },
    { id: "host", label: "Host Session", icon: ShareIcon },
    { id: "connect", label: "Connect", icon: ComputerIcon },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "about", label: "About EKD Digital", icon: InfoIcon },
  ];

  // Render current view
  const renderCurrentView = () => {
    // If not authenticated, always show login view
    if (!isAuthenticated) {
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
    }

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
        return <ConnectView onBack={() => setCurrentView("home")} />;
      case "settings":
        return (
          <SettingsView
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
            onBack={() => setCurrentView("home")}
          />
        );
      case "about":
        return <AboutView onBack={() => setCurrentView("home")} />;
      default:
        return (
          <HomeView
            onStartHosting={() => setCurrentView("host")}
            onConnect={() => setCurrentView("connect")}
            connectionState={connectionState}
          />
        );
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
            {isAuthenticated && (
              <IconButton
                size="small"
                onClick={() => setDrawerOpen(true)}
                sx={{ WebkitAppRegion: "no-drag" }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography variant="h6" sx={{ ml: 1, flex: 1, fontSize: "14px" }}>
              EKD Desk
              <Typography
                component="span"
                variant="caption"
                sx={{ ml: 1, opacity: 0.7, fontSize: "11px" }}
              >
                by EKD Digital
              </Typography>
            </Typography>

            {isAuthenticated && (
              <>
                <ConnectionStatus connectionState={connectionState} />

                <Tooltip title="Notifications">
                  <IconButton
                    size="small"
                    onClick={() =>
                      setNotificationPanelOpen(!notificationPanelOpen)
                    }
                    sx={{ WebkitAppRegion: "no-drag" }}
                  >
                    <Badge badgeContent={notifications.length} color="error">
                      <NotificationsIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                </Tooltip>

                <Tooltip title="Logout">
                  <IconButton
                    size="small"
                    onClick={handleLogout}
                    sx={{ WebkitAppRegion: "no-drag", ml: 1 }}
                  >
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}

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

        {/* Navigation Drawer - Only show when authenticated */}
        {isAuthenticated && (
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
        )}

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

        {/* Status Bar - Only show when authenticated */}
        {isAuthenticated && <StatusBar connectionState={connectionState} />}

        {/* Notification Center */}
        <NotificationCenter
          notifications={notifications}
          open={notificationPanelOpen}
          onClose={() => setNotificationPanelOpen(false)}
          onDismiss={(index: number) => {
            setNotifications((prev) => prev.filter((_, i) => i !== index));
          }}
        />
      </Box>
    </ThemeProvider>
  );
};

export default App;
