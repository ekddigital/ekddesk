import React, { useState, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import { env } from "../config/environment";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

// Custom hook for API calls with error handling
export function useApi<T = any>(
  apiCall: (...args: any[]) => Promise<ApiResponse<T>>
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiCall(...args);

        if (!response.success) {
          throw new Error(
            response.error || response.message || "API call failed"
          );
        }

        setData(response.data || null);
        return response.data || null;
      } catch (err: any) {
        const errorMessage = err.message || "An unexpected error occurred";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

// API service class
export class ApiService {
  private static baseUrl = env.getApiBaseUrl();

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: response.ok ? data.data : undefined,
        message: data.message,
        error: response.ok
          ? undefined
          : data.message || `HTTP ${response.status}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Network error occurred",
      };
    }
  }

  // Device registration
  static async registerDevice(deviceData: {
    deviceId: string;
    deviceName: string;
    deviceType: string;
    platform: string;
    publicKey: string;
    password?: string;
  }) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(deviceData),
    });
  }

  // Generate temporary password
  static async generateTempPassword(deviceId: string) {
    return this.request(`/api/auth/devices/${deviceId}/password/temp`, {
      method: "POST",
    });
  }

  // Set permanent password
  static async setPermanentPassword(deviceId: string, password: string) {
    return this.request(`/api/auth/devices/${deviceId}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }

  // Login with credentials
  static async login(deviceId: string, password: string) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ deviceId, password }),
    });
  }

  // User authentication
  static async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    return this.request("/api/auth/register-user", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  static async loginUser(email: string, password: string) {
    return this.request("/api/auth/login-user", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  // Admin endpoints
  static async getAllUsers() {
    return this.request("/api/auth/admin/users", {
      method: "GET",
    });
  }

  static async getAllDevices() {
    return this.request("/api/auth/admin/devices", {
      method: "GET",
    });
  }

  static async deleteUser(userId: string) {
    return this.request(`/api/auth/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  static async deleteDevice(deviceId: string) {
    return this.request(`/api/auth/admin/devices/${deviceId}`, {
      method: "DELETE",
    });
  }

  static async updateUserRole(userId: string, role: string) {
    return this.request(`/api/auth/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  static async getSystemStats() {
    return this.request("/api/auth/admin/stats", {
      method: "GET",
    });
  }
}

// Error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Card sx={{ m: 2 }}>
            <CardContent>
              <Alert severity="error">
                <Typography variant="h6">Something went wrong</Typography>
                <Typography variant="body2">
                  {this.state.error?.message || "An unexpected error occurred"}
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}

// Loading component
export const LoadingSpinner: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <Box display="flex" flexDirection="column" alignItems="center" p={3}>
    <CircularProgress />
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      {message}
    </Typography>
  </Box>
);

// Toast notification component
interface ToastProps {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  open,
  message,
  severity,
  onClose,
}) => (
  <Snackbar
    open={open}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
  >
    <Alert onClose={onClose} severity={severity} sx={{ width: "100%" }}>
      {message}
    </Alert>
  </Snackbar>
);
