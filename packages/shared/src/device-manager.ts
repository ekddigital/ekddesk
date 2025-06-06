import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { DeviceInfo, DeviceType, ConnectionState } from './types';
import { Logger } from './logger';
import { EventBus } from './event-bus';
import { EVENTS, DEVICE_TYPES, CONNECTION_STATES } from './constants';
import { isValidIP, isValidPort, generateId } from './utils';

/**
 * Device manager for EKD Desk
 * Handles device discovery, registration, and management
 */
export class DeviceManager {
  private static instance: DeviceManager;
  private devices: Map<string, DeviceInfo> = new Map();
  private currentDevice: DeviceInfo | null = null;
  private logger: Logger;
  private eventBus: EventBus;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = Logger.createLogger('DeviceManager');
    this.eventBus = EventBus.getInstance();
    this.initializeCurrentDevice();
  }

  static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  private initializeCurrentDevice(): void {
    try {
      const platform = os.platform();
      const hostname = os.hostname();
      const networkInterfaces = os.networkInterfaces();
      
      // Get primary IP address
      let primaryIP = '127.0.0.1';
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
              primaryIP = iface.address;
              break;
            }
          }
        }
        if (primaryIP !== '127.0.0.1') break;
      }      // Determine device type based on platform and environment
      let deviceType: DeviceType = DEVICE_TYPES.DESKTOP;
      if (typeof window !== 'undefined') {
        deviceType = DEVICE_TYPES.WEB;
      } else if (process.env.PLATFORM === 'mobile' || process.env.REACT_NATIVE === 'true') {
        deviceType = DEVICE_TYPES.MOBILE;
      }

      // Get device capabilities
      const capabilities = this.getDeviceCapabilities();

      this.currentDevice = {
        id: generateId(),
        name: hostname,
        type: deviceType,
        platform: `${platform} ${os.release()}`,
        version: process.env.npm_package_version || '1.0.0',
        ip: primaryIP,
        port: parseInt(process.env.PORT || '3001'),
        capabilities,
        lastSeen: new Date(),
        isOnline: true,
        metadata: {
          arch: os.arch(),
          cpus: os.cpus().length,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          uptime: os.uptime(),
          nodeVersion: process.version
        }
      };

      this.devices.set(this.currentDevice.id, this.currentDevice);
      this.logger.info('Current device initialized', { 
        deviceId: this.currentDevice.id,
        name: this.currentDevice.name,
        type: this.currentDevice.type
      });

    } catch (error) {
      this.logger.error('Failed to initialize current device', error);
      throw error;
    }
  }

  private getDeviceCapabilities(): string[] {
    const capabilities: string[] = [];

    // Basic capabilities
    capabilities.push('screen-capture', 'remote-control', 'file-transfer');

    // Platform-specific capabilities
    const platform = os.platform();
    switch (platform) {
      case 'win32':
        capabilities.push('windows-integration', 'registry-access');
        break;
      case 'darwin':
        capabilities.push('macos-integration', 'accessibility-api');
        break;
      case 'linux':
        capabilities.push('linux-integration', 'x11-forwarding');
        break;
    }

    // Check for media capabilities
    if (typeof navigator !== 'undefined') {
      if (navigator.mediaDevices) {
        capabilities.push('media-capture');
      }
      if (navigator.permissions) {
        capabilities.push('permission-api');
      }
    }

    // Check for network capabilities
    if (typeof RTCPeerConnection !== 'undefined') {
      capabilities.push('webrtc');
    }

    return capabilities;
  }

  getCurrentDevice(): DeviceInfo | null {
    return this.currentDevice;
  }

  getCurrentDeviceId(): string | null {
    return this.currentDevice?.id || null;
  }

  registerDevice(device: Omit<DeviceInfo, 'id' | 'lastSeen'>): DeviceInfo {
    const deviceWithId: DeviceInfo = {
      ...device,
      id: generateId(),
      lastSeen: new Date()
    };

    // Validate device information
    this.validateDevice(deviceWithId);

    this.devices.set(deviceWithId.id, deviceWithId);
    this.logger.info('Device registered', { deviceId: deviceWithId.id, name: deviceWithId.name });

    this.eventBus.emitDeviceEvent(
      EVENTS.DEVICE_DISCOVERED,
      deviceWithId.id,
      'DeviceManager',
      { device: deviceWithId }
    );

    return deviceWithId;
  }

  updateDevice(deviceId: string, updates: Partial<DeviceInfo>): DeviceInfo | null {
    const device = this.devices.get(deviceId);
    if (!device) {
      this.logger.warn('Attempted to update non-existent device', { deviceId });
      return null;
    }

    const updatedDevice: DeviceInfo = {
      ...device,
      ...updates,
      id: deviceId, // Ensure ID cannot be changed
      lastSeen: new Date()
    };

    this.validateDevice(updatedDevice);
    this.devices.set(deviceId, updatedDevice);

    this.logger.debug('Device updated', { deviceId, updates });

    this.eventBus.emitDeviceEvent(
      EVENTS.DEVICE_STATUS_CHANGED,
      deviceId,
      'DeviceManager',
      { device: updatedDevice, updates }
    );

    return updatedDevice;
  }

  removeDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    this.devices.delete(deviceId);
    this.logger.info('Device removed', { deviceId, name: device.name });

    this.eventBus.emitDeviceEvent(
      EVENTS.DEVICE_DISCONNECTED,
      deviceId,
      'DeviceManager',
      { device }
    );

    return true;
  }

  getDevice(deviceId: string): DeviceInfo | null {
    return this.devices.get(deviceId) || null;
  }

  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }

  getOnlineDevices(): DeviceInfo[] {
    return this.getAllDevices().filter(device => device.isOnline);
  }

  getDevicesByType(type: DeviceType): DeviceInfo[] {
    return this.getAllDevices().filter(device => device.type === type);
  }

  searchDevices(query: string): DeviceInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllDevices().filter(device =>
      device.name.toLowerCase().includes(lowerQuery) ||
      device.platform.toLowerCase().includes(lowerQuery) ||
      device.ip.includes(query)
    );
  }

  setDeviceOnline(deviceId: string, isOnline: boolean): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    const wasOnline = device.isOnline;
    device.isOnline = isOnline;
    device.lastSeen = new Date();

    if (wasOnline !== isOnline) {
      const eventType = isOnline ? EVENTS.DEVICE_CONNECTED : EVENTS.DEVICE_DISCONNECTED;
      this.eventBus.emitDeviceEvent(eventType, deviceId, 'DeviceManager', { device });
      
      this.logger.info(`Device ${isOnline ? 'connected' : 'disconnected'}`, {
        deviceId,
        name: device.name
      });
    }

    return true;
  }

  updateHeartbeat(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    device.lastSeen = new Date();
    if (!device.isOnline) {
      this.setDeviceOnline(deviceId, true);
    }

    return true;
  }

  private validateDevice(device: DeviceInfo): void {
    if (!device.id || typeof device.id !== 'string') {
      throw new Error('Device must have a valid ID');
    }

    if (!device.name || device.name.trim().length === 0) {
      throw new Error('Device must have a valid name');
    }

    if (!Object.values(DEVICE_TYPES).includes(device.type)) {
      throw new Error(`Invalid device type: ${device.type}`);
    }

    if (!isValidIP(device.ip)) {
      throw new Error(`Invalid IP address: ${device.ip}`);
    }

    if (!isValidPort(device.port)) {
      throw new Error(`Invalid port: ${device.port}`);
    }
  }

  startDiscovery(intervalMs: number = 30000): void {
    if (this.discoveryInterval) {
      this.stopDiscovery();
    }

    this.discoveryInterval = setInterval(() => {
      this.performDiscovery();
    }, intervalMs);

    this.logger.info('Device discovery started', { intervalMs });
    this.performDiscovery(); // Run immediately
  }

  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
      this.logger.info('Device discovery stopped');
    }
  }

  private async performDiscovery(): Promise<void> {
    try {
      // This would typically involve network scanning, mDNS, or other discovery protocols
      // For now, we'll just log that discovery is running
      this.logger.debug('Performing device discovery...');
      
      // Mark devices as offline if they haven't been seen recently
      const now = new Date();
      const timeoutMs = 60000; // 1 minute
      
      for (const device of this.devices.values()) {
        if (device.isOnline && (now.getTime() - device.lastSeen.getTime()) > timeoutMs) {
          this.setDeviceOnline(device.id, false);
        }
      }
      
    } catch (error) {
      this.logger.error('Error during device discovery', error);
    }
  }

  startHeartbeat(intervalMs: number = 30000): void {
    if (this.heartbeatInterval) {
      this.stopHeartbeat();
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.currentDevice) {
        this.updateHeartbeat(this.currentDevice.id);
      }
    }, intervalMs);

    this.logger.info('Heartbeat started', { intervalMs });
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.logger.info('Heartbeat stopped');
    }
  }

  getDeviceStats(): {
    total: number;
    online: number;
    offline: number;
    byType: Record<DeviceType, number>;
  } {
    const devices = this.getAllDevices();
    const online = devices.filter(d => d.isOnline).length;
    const byType = devices.reduce((acc, device) => {
      acc[device.type] = (acc[device.type] || 0) + 1;
      return acc;
    }, {} as Record<DeviceType, number>);

    return {
      total: devices.length,
      online,
      offline: devices.length - online,
      byType
    };
  }

  destroy(): void {
    this.stopDiscovery();
    this.stopHeartbeat();
    this.devices.clear();
    this.currentDevice = null;
    this.logger.info('DeviceManager destroyed');
  }
}
