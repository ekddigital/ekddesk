import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Card,
  CardContent,
  Tabs,
  Tab,
  Divider,
  Link,
} from "@mui/material";
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import { env } from "../config/environment";
import { motion } from "framer-motion";

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
  onBack?: () => void;
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
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onBack }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Registration form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError("");
    setSuccess("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Make API call to login endpoint
      const response = await fetch(
        `${env.getApiBaseUrl()}/api/auth/login-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: loginEmail,
            password: loginPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store auth tokens
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      setSuccess("Login successful!");
      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !registerEmail ||
      !registerPassword ||
      !registerConfirmPassword ||
      !registerFirstName ||
      !registerLastName
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (registerPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Make API call to register endpoint
      const response = await fetch(
        `${env.getApiBaseUrl()}/api/auth/register-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: registerEmail,
            password: registerPassword,
            firstName: registerFirstName,
            lastName: registerLastName,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSuccess("Registration successful! You can now login.");
      setTabValue(0); // Switch to login tab

      // Clear registration form
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setRegisterFirstName("");
      setRegisterLastName("");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTestLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // First try to register a test user, then login
      const registerResponse = await fetch(
        `${env.getApiBaseUrl()}/api/auth/register-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@ekddesk.com",
            password: "test123456",
            firstName: "Test",
            lastName: "User",
          }),
        }
      );

      // Ignore if user already exists, proceed to login
      const loginResponse = await fetch(
        `${env.getApiBaseUrl()}/api/auth/login-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "test@ekddesk.com",
            password: "test123456",
          }),
        }
      );

      const data = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(data.message || "Test login failed");
      }

      // Store auth tokens
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      setSuccess("Test login successful!");
      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Test login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box sx={{ maxWidth: 500, mx: "auto", mt: 4 }}>
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box sx={{ mb: 3 }}>
              <img
                src="./logo.png"
                alt="EKD Desk Logo"
                style={{
                  width: 80,
                  height: 80,
                  marginBottom: 16,
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
            </Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Welcome to EKD Desk
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Please login or create an account to continue
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ opacity: 0.8 }}
            >
              by EKD Digital - Innovative Digital Solutions
            </Typography>
          </Box>

          {/* Quick Test Login */}
          <Card sx={{ mb: 3, bgcolor: "primary.main", color: "white" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Test Login
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
                Use a pre-configured test account for development testing
              </Typography>
              <Button
                variant="contained"
                onClick={handleQuickTestLogin}
                disabled={loading}
                sx={{ bgcolor: "white", color: "primary.main" }}
              >
                Login as Test User
              </Button>
            </CardContent>
          </Card>

          <Divider sx={{ my: 2 }}>OR</Divider>

          {/* Auth Form */}
          <Card>
            <CardContent>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="auth tabs"
                sx={{ mb: 2 }}
              >
                <Tab label="Login" />
                <Tab label="Register" />
              </Tabs>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              {/* Login Tab */}
              <TabPanel value={tabValue} index={0}>
                <form onSubmit={handleLogin}>
                  <Stack spacing={3}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <EmailIcon sx={{ mr: 1, color: "text.secondary" }} />
                        ),
                      }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <LockIcon sx={{ mr: 1, color: "text.secondary" }} />
                        ),
                      }}
                      required
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading}
                      fullWidth
                    >
                      {loading ? "Logging in..." : "Login"}
                    </Button>
                  </Stack>
                </form>
              </TabPanel>

              {/* Register Tab */}
              <TabPanel value={tabValue} index={1}>
                <form onSubmit={handleRegister}>
                  <Stack spacing={3}>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={registerFirstName}
                        onChange={(e) => setRegisterFirstName(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <PersonIcon
                              sx={{ mr: 1, color: "text.secondary" }}
                            />
                          ),
                        }}
                        required
                      />
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={registerLastName}
                        onChange={(e) => setRegisterLastName(e.target.value)}
                        required
                      />
                    </Stack>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <EmailIcon sx={{ mr: 1, color: "text.secondary" }} />
                        ),
                      }}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <LockIcon sx={{ mr: 1, color: "text.secondary" }} />
                        ),
                      }}
                      helperText="At least 6 characters"
                      required
                    />
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type="password"
                      value={registerConfirmPassword}
                      onChange={(e) =>
                        setRegisterConfirmPassword(e.target.value)
                      }
                      InputProps={{
                        startAdornment: (
                          <LockIcon sx={{ mr: 1, color: "text.secondary" }} />
                        ),
                      }}
                      required
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading}
                      fullWidth
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </Stack>
                </form>
              </TabPanel>
            </CardContent>
          </Card>

          {onBack && (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Link
                component="button"
                onClick={onBack}
                sx={{ cursor: "pointer" }}
              >
                ← Back
              </Link>
            </Box>
          )}
        </Box>
      </motion.div>
    </Box>
  );
};

export default LoginView;
