import React from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Chip,
  Stack,
} from "@mui/material";
import {
  Share as ShareIcon,
  Computer as ComputerIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import type { ConnectionState } from "../preload";

interface HomeViewProps {
  onStartHosting: () => void;
  onConnect: () => void;
  connectionState: ConnectionState;
}

/**
 * Home View Component - Main landing page for EKD Desk
 * Shows quick actions and current connection status
 */
const HomeView: React.FC<HomeViewProps> = ({
  onStartHosting,
  onConnect,
  connectionState,
}) => {
  const isConnected =
    connectionState.status === "connected" ||
    connectionState.status === "hosting";

  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to EKD Desk
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            Secure, fast, and reliable remote desktop control
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ opacity: 0.8 }}
          >
            Powered by EKD Digital - Transforming businesses through innovative
            digital solutions
          </Typography>
        </Box>

        {/* Status Card */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Paper
              sx={{
                p: 2,
                mb: 3,
                bgcolor:
                  connectionState.status === "hosting"
                    ? "primary.main"
                    : "secondary.main",
                color: "white",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box>
                  <Typography variant="h6">
                    {connectionState.status === "hosting"
                      ? "Hosting Session"
                      : "Connected"}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {connectionState.status === "hosting"
                      ? `${connectionState.connectedClients || 0} client(s) connected`
                      : `Connected to ${connectionState.remoteHostName || "remote host"}`}
                  </Typography>
                </Box>
                <Box sx={{ ml: "auto" }}>
                  {connectionState.latency && (
                    <Chip
                      label={`${connectionState.latency}ms`}
                      size="small"
                      sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
                    />
                  )}
                </Box>
              </Stack>
            </Paper>
          </motion.div>
        )}

        {/* Quick Actions */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ textAlign: "center", p: 3 }}>
                  <ShareIcon
                    sx={{ fontSize: 48, color: "primary.main", mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Share Your Screen
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Allow others to control your computer remotely. Perfect for
                    support and collaboration.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={onStartHosting}
                    disabled={connectionState.status === "hosting"}
                    sx={{ borderRadius: 2 }}
                  >
                    {connectionState.status === "hosting"
                      ? "Already Hosting"
                      : "Start Hosting"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ textAlign: "center", p: 3 }}>
                  <ComputerIcon
                    sx={{ fontSize: 48, color: "secondary.main", mb: 2 }}
                  />
                  <Typography variant="h6" gutterBottom>
                    Connect to Computer
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Control another computer remotely using a connection ID or
                    invitation link.
                  </Typography>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={onConnect}
                    disabled={connectionState.status === "connected"}
                    sx={{ borderRadius: 2 }}
                  >
                    {connectionState.status === "connected"
                      ? "Already Connected"
                      : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>

        {/* Features */}
        <Typography variant="h6" gutterBottom>
          Key Features
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <SpeedIcon
                  sx={{ fontSize: 32, color: "primary.main", mb: 1 }}
                />
                <Typography variant="subtitle2" gutterBottom>
                  High Performance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ultra-low latency with adaptive quality
                </Typography>
              </Paper>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <SecurityIcon
                  sx={{ fontSize: 32, color: "primary.main", mb: 1 }}
                />
                <Typography variant="subtitle2" gutterBottom>
                  Secure & Private
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  End-to-end encryption for all connections
                </Typography>
              </Paper>
            </motion.div>
          </Grid>

          <Grid item xs={12} md={4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Paper sx={{ p: 2, textAlign: "center" }}>
                <ComputerIcon
                  sx={{ fontSize: 32, color: "primary.main", mb: 1 }}
                />
                <Typography variant="subtitle2" gutterBottom>
                  Cross-Platform
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Works on Windows, macOS, and Linux
                </Typography>
              </Paper>
            </motion.div>
          </Grid>
        </Grid>
      </motion.div>
    </Box>
  );
};

export default HomeView;
