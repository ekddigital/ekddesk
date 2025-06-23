/**
 * EKD Desk API Service
 * Handles communication with the auth service backend
 */

export interface DeviceRegistrationRequest {
  deviceId: string;
  deviceName: string;
  deviceType: "DESKTOP" | "MOBILE" | "WEB";
  platform: string;
  publicKey: string;
  password?: string;
}

export interface DeviceRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    deviceId: string;
    deviceName: string;
    deviceToken: string;
    registeredAt: string;
  };
}

export interface LoginRequest {
  deviceId: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    deviceId: string;
    deviceName: string;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: string;
    };
  };
}

export interface TempPasswordResponse {
  success: boolean;
  token: string;
  expiresAt: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    stack?: string;
  };
  timestamp: string;
}

export class ApiService {
  private baseUrl: string;
  private deviceToken?: string;
  private accessToken?: string;

  constructor(baseUrl: string = "http://localhost:3001") {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the device token for authenticated requests
   */
  setDeviceToken(token: string) {
    this.deviceToken = token;
  }

  /**
   * Set the access token for authenticated requests
   */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /**
   * Make an authenticated request
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add authorization header if we have an access token
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return data;
  }

  /**
   * Register a new device
   */
  async registerDevice(
    request: DeviceRegistrationRequest
  ): Promise<DeviceRegistrationResponse> {
    return this.makeRequest<DeviceRegistrationResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Login with device credentials
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(request),
    });

    // Store the access token for future requests
    if (response.success && response.data.tokens.accessToken) {
      this.setAccessToken(response.data.tokens.accessToken);
    }

    return response;
  }

  /**
   * Generate a temporary password for a device
   */
  async generateTempPassword(deviceId: string): Promise<TempPasswordResponse> {
    return this.makeRequest<TempPasswordResponse>(
      `/api/auth/devices/${deviceId}/password/temp`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Set a permanent password for a device
   */
  async setPermanentPassword(
    deviceId: string,
    password: string
  ): Promise<{ success: boolean; message: string }> {
    return this.makeRequest<{ success: boolean; message: string }>(
      `/api/auth/devices/${deviceId}/password`,
      {
        method: "POST",
        body: JSON.stringify({ password }),
      }
    );
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
  }> {
    return this.makeRequest<{
      status: string;
      timestamp: string;
      service: string;
      version: string;
    }>("/health");
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return this.makeRequest<LoginResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  /**
   * Logout and invalidate session
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    const response = await this.makeRequest<{
      success: boolean;
      message: string;
    }>("/api/auth/logout", {
      method: "POST",
    });

    // Clear stored tokens
    this.accessToken = undefined;
    this.deviceToken = undefined;

    return response;
  }
}

// Create a singleton instance
export const apiService = new ApiService();
