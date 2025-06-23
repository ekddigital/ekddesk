import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Switch,
  Slider,
  TextField,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  Tab,
  Tabs,
  Paper,
  Grid,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Security as SecurityIcon,
  Monitor as DisplayIcon,
  Wifi as NetworkIcon,
  AdminPanelSettings as AdminIcon,
  People as UsersIcon,
  Computer as DevicesIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { ApiService } from "../utils/api";
import type { AppSettings } from "../preload";

interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
}

interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  platform: string;
  isActive: boolean;
  lastLoginAt?: string;
  registeredAt?: string;
}

interface SettingsViewProps {
  settings: AppSettings | null;
  onSettingsUpdate: (settings: Partial<AppSettings>) => void;
  onBack: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsUpdate,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [localSettings, setLocalSettings] = useState<AppSettings>(
    settings || {
      autoStart: false,
      minimizeToTray: true,
      theme: "system",
      quality: "high",
      enableAudio: true,
      enableClipboard: true,
      windowBounds: {
        width: 1200,
        height: 800,
      },
      notifications: true,
      autoConnect: false,
    }
  );

  // Admin data state
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "user" | "device";
    id: string;
    name: string;
  } | null>(null);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<{
    id: string;
    name: string;
    currentRole: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Get current user info (mock for now - in real app, get from auth context)
  const currentUser = {
    id: "user_123",
    email: "admin@ekddesk.com",
    firstName: "Admin",
    lastName: "User",
    role: "SUPER_ADMIN" as const,
  };

  const isAdmin = currentUser.role === "SUPER_ADMIN";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 1 && isAdmin) {
      // Users tab
      loadUsers();
    } else if (activeTab === 2 && isAdmin) {
      // Devices tab
      loadDevices();
    } else if (activeTab === 3 && isAdmin) {
      // Stats tab
      loadSystemStats();
    }
  }, [activeTab, isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getAllUsers();
      if (response.success) {
        setUsers((response.data as any)?.users || []);
      } else {
        setError(response.error || "Failed to load users");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getAllDevices();
      if (response.success) {
        setDevices((response.data as any)?.devices || []);
      } else {
        setError(response.error || "Failed to load devices");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getSystemStats();
      if (response.success) {
        setSystemStats(response.data);
      } else {
        setError(response.error || "Failed to load system stats");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load system stats");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await ApiService.deleteUser(userId);
      if (response.success) {
        setSuccess("User deleted successfully");
        setUsers(users.filter((u) => u.id !== userId));
      } else {
        setError(response.error || "Failed to delete user");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const response = await ApiService.deleteDevice(deviceId);
      if (response.success) {
        setSuccess("Device deleted successfully");
        setDevices(devices.filter((d) => d.id !== deviceId));
      } else {
        setError(response.error || "Failed to delete device");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete device");
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleUpdateUserRole = async () => {
    if (!editRoleTarget) return;

    try {
      const response = await ApiService.updateUserRole(
        editRoleTarget.id,
        newRole
      );
      if (response.success) {
        setSuccess("User role updated successfully");
        setUsers(
          users.map((u) =>
            u.id === editRoleTarget.id ? { ...u, role: newRole as any } : u
          )
        );
      } else {
        setError(response.error || "Failed to update user role");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update user role");
    }
    setEditRoleDialogOpen(false);
    setEditRoleTarget(null);
    setNewRole("");
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await onSettingsUpdate(localSettings);
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  const openDeleteDialog = (
    type: "user" | "device",
    id: string,
    name: string
  ) => {
    setDeleteTarget({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const openEditRoleDialog = (
    id: string,
    name: string,
    currentRole: string
  ) => {
    setEditRoleTarget({ id, name, currentRole });
    setNewRole(currentRole);
    setEditRoleDialogOpen(true);
  };

  const tabs = [
    { label: "General", icon: DisplayIcon },
    ...(isAdmin
      ? [
          { label: "Users", icon: UsersIcon },
          { label: "Devices", icon: DevicesIcon },
          { label: "Security", icon: SecurityIcon },
        ]
      : []),
  ];

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Back
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your application preferences and system settings
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="settings tabs"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={<tab.icon />}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {/* General Settings Tab */}
        <TabPanel value={activeTab} index={0}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Grid container spacing={3}>
              {/* Application Settings */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Application Settings
                    </Typography>

                    <FormControl component="fieldset" sx={{ mt: 2 }}>
                      <FormLabel component="legend">Theme</FormLabel>
                      <RadioGroup
                        value={localSettings.theme}
                        onChange={(e) =>
                          handleSettingChange("theme", e.target.value)
                        }
                      >
                        <FormControlLabel
                          value="light"
                          control={<Radio />}
                          label="Light"
                        />
                        <FormControlLabel
                          value="dark"
                          control={<Radio />}
                          label="Dark"
                        />
                        <FormControlLabel
                          value="system"
                          control={<Radio />}
                          label="System"
                        />
                      </RadioGroup>
                    </FormControl>

                    <Box sx={{ mt: 3 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localSettings.notifications}
                            onChange={(e) =>
                              handleSettingChange(
                                "notifications",
                                e.target.checked
                              )
                            }
                          />
                        }
                        label="Enable Notifications"
                      />
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localSettings.autoConnect}
                            onChange={(e) =>
                              handleSettingChange(
                                "autoConnect",
                                e.target.checked
                              )
                            }
                          />
                        }
                        label="Auto Connect to Last Session"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Connection Settings */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Connection Settings
                    </Typography>

                    <FormControl component="fieldset" sx={{ mt: 2 }}>
                      <FormLabel component="legend">Video Quality</FormLabel>
                      <RadioGroup
                        value={localSettings.quality}
                        onChange={(e) =>
                          handleSettingChange("quality", e.target.value)
                        }
                      >
                        <FormControlLabel
                          value="low"
                          control={<Radio />}
                          label="Low (Fast)"
                        />
                        <FormControlLabel
                          value="medium"
                          control={<Radio />}
                          label="Medium"
                        />
                        <FormControlLabel
                          value="high"
                          control={<Radio />}
                          label="High"
                        />
                        <FormControlLabel
                          value="ultra"
                          control={<Radio />}
                          label="Ultra (Slow)"
                        />
                      </RadioGroup>
                    </FormControl>

                    <Box sx={{ mt: 3 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localSettings.enableAudio}
                            onChange={(e) =>
                              handleSettingChange(
                                "enableAudio",
                                e.target.checked
                              )
                            }
                          />
                        }
                        label="Enable Audio"
                      />
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localSettings.enableClipboard}
                            onChange={(e) =>
                              handleSettingChange(
                                "enableClipboard",
                                e.target.checked
                              )
                            }
                          />
                        }
                        label="Enable Clipboard Sync"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Save Button */}
              <Grid item xs={12}>
                <Box
                  sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}
                >
                  <Button
                    variant="contained"
                    startIcon={
                      loading ? <CircularProgress size={20} /> : <SaveIcon />
                    }
                    onClick={handleSaveSettings}
                    disabled={loading}
                    size="large"
                  >
                    {loading ? "Saving..." : "Save Settings"}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </motion.div>
        </TabPanel>

        {/* Users Management Tab */}
        {isAdmin && (
          <TabPanel value={activeTab} index={1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 3,
                    }}
                  >
                    <Typography variant="h6">User Management</Typography>
                    <Box>
                      <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadUsers}
                        disabled={loading}
                        sx={{ mr: 1 }}
                      >
                        Refresh
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        disabled
                      >
                        Add User
                      </Button>
                    </Box>
                  </Box>

                  {loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                {user.firstName} {user.lastName}
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <Chip
                                  label={user.role}
                                  color={
                                    user.role === "SUPER_ADMIN"
                                      ? "error"
                                      : user.role === "ADMIN"
                                        ? "warning"
                                        : "default"
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right">
                                {isSuperAdmin && user.id !== currentUser.id && (
                                  <>
                                    <Tooltip title="Edit Role">
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          openEditRoleDialog(
                                            user.id,
                                            `${user.firstName} ${user.lastName}`,
                                            user.role
                                          )
                                        }
                                      >
                                        <EditIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete User">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                          openDeleteDialog(
                                            "user",
                                            user.id,
                                            `${user.firstName} ${user.lastName}`
                                          )
                                        }
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabPanel>
        )}

        {/* Devices Management Tab */}
        {isAdmin && (
          <TabPanel value={activeTab} index={2}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 3,
                    }}
                  >
                    <Typography variant="h6">Device Management</Typography>
                    <Button
                      startIcon={<RefreshIcon />}
                      onClick={loadDevices}
                      disabled={loading}
                    >
                      Refresh
                    </Button>
                  </Box>

                  {loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Device ID</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Platform</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Last Login</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {devices.map((device) => (
                            <TableRow key={device.id}>
                              <TableCell>{device.id}</TableCell>
                              <TableCell>{device.name}</TableCell>
                              <TableCell>
                                <Chip label={device.type} size="small" />
                              </TableCell>
                              <TableCell>{device.platform}</TableCell>
                              <TableCell>
                                <Chip
                                  label={
                                    device.isActive ? "Active" : "Inactive"
                                  }
                                  color={
                                    device.isActive ? "success" : "default"
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                {device.lastLoginAt
                                  ? new Date(
                                      device.lastLoginAt
                                    ).toLocaleDateString()
                                  : "Never"}
                              </TableCell>
                              <TableCell align="right">
                                {isSuperAdmin && (
                                  <Tooltip title="Delete Device">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() =>
                                        openDeleteDialog(
                                          "device",
                                          device.id,
                                          device.name
                                        )
                                      }
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabPanel>
        )}

        {/* Security Tab */}
        {isAdmin && (
          <TabPanel value={activeTab} index={3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* System Statistics */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        System Statistics
                      </Typography>
                      <Button
                        startIcon={<RefreshIcon />}
                        onClick={loadSystemStats}
                        disabled={loading}
                        sx={{ mb: 2 }}
                      >
                        Refresh
                      </Button>

                      {systemStats && (
                        <List>
                          <ListItem>
                            <ListItemText
                              primary="Total Users"
                              secondary={systemStats.users?.total || 0}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Total Devices"
                              secondary={systemStats.devices?.total || 0}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Total Logins"
                              secondary={systemStats.activity?.totalLogins || 0}
                            />
                          </ListItem>
                        </List>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Security Settings */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Security Settings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Advanced security configuration options for
                        administrators.
                      </Typography>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        Additional security features coming soon...
                      </Alert>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>
          </TabPanel>
        )}
      </Box>

      {/* Success/Error Messages */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteTarget?.type} "
            {deleteTarget?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (deleteTarget?.type === "user") {
                handleDeleteUser(deleteTarget.id);
              } else if (deleteTarget?.type === "device") {
                handleDeleteDevice(deleteTarget.id);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog
        open={editRoleDialogOpen}
        onClose={() => setEditRoleDialogOpen(false)}
      >
        <DialogTitle>Edit User Role</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Change role for user "{editRoleTarget?.name}":
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <RadioGroup
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <FormControlLabel value="USER" control={<Radio />} label="User" />
              <FormControlLabel
                value="ADMIN"
                control={<Radio />}
                label="Admin"
              />
              {isSuperAdmin && (
                <FormControlLabel
                  value="SUPER_ADMIN"
                  control={<Radio />}
                  label="Super Admin"
                />
              )}
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoleDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateUserRole}
            color="primary"
            variant="contained"
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsView;
