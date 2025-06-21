import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  screen,
  dialog,
  systemPreferences,
} from "electron";
import { join } from "path";
import { Logger } from "@ekd-desk/shared";
import { PlatformFactory } from "@ekd-desk/platform";
import { StreamManager } from "@ekd-desk/media";
import Store from "electron-store";
import { writeFileSync, mkdirSync } from "fs";

/**
 * EKD Desk Desktop Client - Electron Main Process
 * Handles window management, system integration, and backend coordination
 */
class EKDDeskApp {
  private logger: Logger;
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private store: Store<any>;
  private captureService: any;
  private inputService: any;
  private streamManager: StreamManager;
  private isHosting: boolean = false;
  private isConnected: boolean = false;

  constructor() {
    this.logger = Logger.createLogger("EKDDeskApp");
    this.store = new Store({
      defaults: {
        windowBounds: { width: 1200, height: 800 },
        autoStart: false,
        minimizeToTray: true,
        theme: "system",
        quality: "high",
        enableAudio: true,
        enableClipboard: true,
      },
    });
    this.streamManager = new StreamManager();
  }

  /**
   * Create a simple fallback tray icon when the asset is missing
   */
  private createFallbackTrayIcon(iconPath: string): void {
    try {
      // Create a simple 16x16 PNG with a basic icon
      // This is a minimal PNG with a simple circle in the center
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0xf3, 0xff, 0x61, 0x00, 0x00, 0x00,
        0x29, 0x49, 0x44, 0x41, 0x54, 0x38, 0x8d, 0x63, 0x60, 0x18, 0x05, 0xa3,
        0x60, 0x14, 0x8c, 0x02, 0x08, 0x00, 0x00, 0x00, 0x04, 0x10, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x02, 0x08, 0x20, 0x80, 0x00, 0x02, 0x08, 0x20, 0x80,
        0x00, 0x00, 0x87, 0x96, 0x7e, 0x8c, 0x3a, 0x2f, 0x74, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      // Ensure directory exists
      mkdirSync(join(iconPath, ".."), { recursive: true });

      // Write the fallback icon
      writeFileSync(iconPath, pngData);
      this.logger.info("Created fallback tray icon");
    } catch (error) {
      this.logger.error("Failed to create fallback tray icon:", error);
      throw error;
    }
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    this.logger.info("🚀 Initializing EKD Desk Desktop Client");

    try {
      // Initialize platform services
      this.captureService = PlatformFactory.createCaptureService();
      this.inputService = PlatformFactory.createInputService();

      await this.captureService.initializeCapture();
      await this.inputService.initializeInput();

      // Set up Electron app event handlers
      this.setupAppHandlers();

      // Set up IPC handlers
      this.setupIpcHandlers();

      this.logger.info("✅ EKD Desk Desktop Client initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize EKD Desk", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create the main application window
   */
  private createMainWindow(): void {
    const bounds = this.store.get("windowBounds") as any;

    this.mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, "preload.js"),
        webSecurity: true,
      },
      icon: join(__dirname, "../assets/icon.png"),
      title: "EKD Desk",
      show: false, // Don't show until ready
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    });

    // Load the renderer
    const isDev = process.env.NODE_ENV === "development";
    const url = isDev
      ? "http://localhost:8080"
      : `file://${join(__dirname, "index.html")}`;

    this.logger.info(`Loading URL: ${url}`);
    this.logger.info(`isDev: ${isDev}, NODE_ENV: ${process.env.NODE_ENV}`);
    this.logger.info(`__dirname: ${__dirname}`);

    this.mainWindow.loadURL(url);

    // Handle load failures
    this.mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        this.logger.error(
          `Failed to load URL: ${validatedURL}, Error: ${errorCode} - ${errorDescription}`
        );
      }
    );

    this.mainWindow.webContents.on("did-finish-load", () => {
      this.logger.info("Main window finished loading");
      // Open DevTools in development or for debugging
      if (
        process.env.NODE_ENV === "development" ||
        process.env.DEBUG_ELECTRON
      ) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Show when ready
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();

      if (isDev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Handle window events
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    this.mainWindow.on("close", (event) => {
      if (this.store.get("minimizeToTray") && this.tray) {
        event.preventDefault();
        this.mainWindow?.hide();
      } else {
        // Save window bounds
        if (this.mainWindow) {
          this.store.set("windowBounds", this.mainWindow.getBounds());
        }
      }
    });

    this.logger.info("📱 Main window created");
  }

  /**
   * Create system tray
   */
  private createTray(): void {
    const trayIconPath = join(__dirname, "../assets/tray-icon.png");

    try {
      // Check if tray icon exists, if not, create a simple one or use a fallback
      this.tray = new Tray(trayIconPath);
    } catch (error) {
      console.warn(
        "Failed to create tray with icon:",
        (error as Error).message
      );
      // Try to create tray without icon as fallback (platform dependent)
      try {
        // Create a simple 16x16 transparent image as fallback
        this.createFallbackTrayIcon(trayIconPath);
        this.tray = new Tray(trayIconPath);
      } catch (fallbackError) {
        console.error(
          "Failed to create tray even with fallback:",
          (fallbackError as Error).message
        );
        return; // Skip tray creation entirely
      }
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show EKD Desk",
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          } else {
            this.createMainWindow();
          }
        },
      },
      { type: "separator" },
      {
        label: this.isHosting ? "Stop Hosting" : "Start Hosting",
        click: () => this.toggleHosting(),
      },
      {
        label: this.isConnected ? "Disconnect" : "Connect to...",
        click: () => this.showConnectionDialog(),
      },
      { type: "separator" },
      {
        label: "Settings",
        click: () => this.showSettings(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip("EKD Desk - Remote Desktop Control");

    this.tray.on("double-click", () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      } else {
        this.createMainWindow();
      }
    });

    this.logger.info("🔧 System tray created");
  }

  /**
   * Set up Electron app event handlers
   */
  private setupAppHandlers(): void {
    app.whenReady().then(() => {
      this.createMainWindow();
      // Temporarily disable tray to focus on main window
      // this.createTray();

      // macOS: Re-create window when dock icon is clicked
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("before-quit", async () => {
      if (this.isHosting) {
        await this.stopHosting();
      }
    });

    // Request permissions on macOS
    if (process.platform === "darwin") {
      this.requestMacOSPermissions();
    }
  }

  /**
   * Set up IPC handlers for communication with renderer
   */
  private setupIpcHandlers(): void {
    // App state
    ipcMain.handle("app:getState", () => ({
      isHosting: this.isHosting,
      isConnected: this.isConnected,
      platform: process.platform,
      version: app.getVersion(),
    }));

    // App controls
    ipcMain.handle("app:minimize", () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.handle("app:maximize", () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMaximized()) {
          this.mainWindow.unmaximize();
        } else {
          this.mainWindow.maximize();
        }
      }
    });

    ipcMain.handle("app:close", () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });

    ipcMain.handle("app:restart", () => {
      app.relaunch();
      app.exit();
    });

    // Settings
    ipcMain.handle("settings:get", () => this.store.store);
    ipcMain.handle("settings:set", (_, key, value) =>
      this.store.set(key, value)
    );
    ipcMain.handle("settings:update", (_, settings) => {
      for (const [key, value] of Object.entries(settings)) {
        this.store.set(key, value);
      }
      return this.store.store;
    });
    ipcMain.handle("settings:getAll", () => this.store.store);

    // Hosting
    ipcMain.handle("hosting:start", () => this.startHosting());
    ipcMain.handle("hosting:stop", () => this.stopHosting());
    ipcMain.handle("hosting:getInfo", () => this.getHostingInfo());

    // Connection
    ipcMain.handle("connection:start-hosting", (_, config) =>
      this.startHosting()
    );
    ipcMain.handle("connection:stop-hosting", () => this.stopHosting());
    ipcMain.handle("connection:connect", (_, config) =>
      this.connectToHost(config)
    );
    ipcMain.handle("connection:disconnect", () => this.disconnect());

    // Platform capabilities
    ipcMain.handle("platform:getCapabilities", async () => {
      return await this.captureService.getCapabilities();
    });

    ipcMain.handle("platform:getDisplays", async () => {
      return await this.captureService.getDisplays();
    });

    // Screen sources and displays
    ipcMain.handle("screen:get-sources", async () => {
      try {
        return await this.captureService.getScreenSources();
      } catch (error) {
        this.logger.error("Failed to get screen sources", error);
        return [];
      }
    });

    ipcMain.handle("screen:get-displays", async () => {
      try {
        return await this.captureService.getDisplays();
      } catch (error) {
        this.logger.error("Failed to get displays", error);
        return [];
      }
    });

    // Permissions
    ipcMain.handle("permissions:request-screen", async () => {
      return await this.requestMacOSPermissions();
    });

    ipcMain.handle("permissions:request-input", async () => {
      return await this.requestMacOSPermissions();
    });

    ipcMain.handle("permissions:has-screen", async () => {
      if (process.platform === "darwin") {
        const hasAccess = systemPreferences.getMediaAccessStatus("screen");
        return hasAccess === "granted";
      }
      return true; // Assume true for non-macOS platforms
    });

    ipcMain.handle("permissions:has-input", async () => {
      if (process.platform === "darwin") {
        return systemPreferences.isTrustedAccessibilityClient(false);
      }
      return true; // Assume true for non-macOS platforms
    });

    // Screen capture
    ipcMain.handle("capture:getScreenshot", async (_, options) => {
      try {
        const frame = await this.captureService.captureFrame(options);
        return {
          data: frame.data.toString("base64"),
          width: frame.width,
          height: frame.height,
          timestamp: frame.timestamp,
        };
      } catch (error) {
        this.logger.error("Screenshot capture failed", { error });
        throw error;
      }
    });

    // Remote input
    ipcMain.handle("input:inject", async (_, event) => {
      try {
        if (event.type === "mouse") {
          await this.inputService.injectMouseEvent(event.data);
        } else if (event.type === "keyboard") {
          await this.inputService.injectKeyboardEvent(event.data);
        }
      } catch (error) {
        this.logger.error("Input injection failed", { error });
        throw error;
      }
    });

    this.logger.info("🔌 IPC handlers registered");
  }

  /**
   * Start hosting (allow others to connect to this machine)
   */
  private async startHosting(): Promise<void> {
    this.logger.info("🏠 Starting hosting mode");

    try {
      await this.captureService.startCapture({
        width: 1920,
        height: 1080,
        quality: 85,
        cursor: true,
      });

      await this.streamManager.startStream();

      this.isHosting = true;
      this.updateTrayMenu();

      // Notify renderer
      this.mainWindow?.webContents.send("hosting:started");

      this.logger.info("✅ Hosting started successfully");
    } catch (error) {
      this.logger.error("❌ Failed to start hosting", { error });
      throw error;
    }
  }

  /**
   * Stop hosting
   */
  private async stopHosting(): Promise<void> {
    this.logger.info("🛑 Stopping hosting mode");

    try {
      await this.captureService.stopCapture();
      await this.streamManager.stopStream();

      this.isHosting = false;
      this.updateTrayMenu();

      // Notify renderer
      this.mainWindow?.webContents.send("hosting:stopped");

      this.logger.info("✅ Hosting stopped");
    } catch (error) {
      this.logger.error("❌ Error stopping hosting", { error });
    }
  }

  /**
   * Get hosting information
   */
  private async getHostingInfo(): Promise<any> {
    if (!this.isHosting) {
      return null;
    }

    const capabilities = await this.captureService.getCapabilities();
    const performance = this.captureService.getPerformanceMetrics();

    return {
      isActive: this.isHosting,
      capabilities,
      performance,
      uptime: Date.now(), // TODO: Calculate actual uptime
    };
  }

  /**
   * Connect to a remote host
   */
  private async connectToHost(config: any): Promise<void> {
    this.logger.info("🔗 Connecting to remote host", { host: config.host });

    try {
      // TODO: Implement WebRTC connection logic
      this.isConnected = true;
      this.updateTrayMenu();

      // Notify renderer
      this.mainWindow?.webContents.send("connection:established", config);

      this.logger.info("✅ Connected to remote host");
    } catch (error) {
      this.logger.error("❌ Failed to connect to host", { error });
      throw error;
    }
  }

  /**
   * Disconnect from remote host
   */
  private async disconnect(): Promise<void> {
    this.logger.info("🔌 Disconnecting from remote host");

    try {
      // TODO: Implement disconnect logic
      this.isConnected = false;
      this.updateTrayMenu();

      // Notify renderer
      this.mainWindow?.webContents.send("connection:disconnected");

      this.logger.info("✅ Disconnected from remote host");
    } catch (error) {
      this.logger.error("❌ Error during disconnect", { error });
    }
  }

  /**
   * Toggle hosting state
   */
  private async toggleHosting(): Promise<void> {
    if (this.isHosting) {
      await this.stopHosting();
    } else {
      await this.startHosting();
    }
  }

  /**
   * Show connection dialog
   */
  private showConnectionDialog(): void {
    if (this.isConnected) {
      this.disconnect();
    } else {
      // Show main window and navigate to connection screen
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.mainWindow.webContents.send("navigate:connect");
      }
    }
  }

  /**
   * Show settings
   */
  private showSettings(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      this.mainWindow.webContents.send("navigate:settings");
    }
  }

  /**
   * Update tray menu
   */
  private updateTrayMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show EKD Desk",
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          } else {
            this.createMainWindow();
          }
        },
      },
      { type: "separator" },
      {
        label: this.isHosting ? "Stop Hosting" : "Start Hosting",
        click: () => this.toggleHosting(),
      },
      {
        label: this.isConnected ? "Disconnect" : "Connect to...",
        click: () => this.showConnectionDialog(),
      },
      { type: "separator" },
      {
        label: "Settings",
        click: () => this.showSettings(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Request necessary permissions on macOS
   */
  private async requestMacOSPermissions(): Promise<void> {
    if (process.platform !== "darwin") return;

    try {
      // Check screen recording permission (no API to request, user must enable manually)
      const hasScreenAccess = systemPreferences.getMediaAccessStatus("screen");
      if (hasScreenAccess !== "granted") {
        this.logger.warn(
          "Screen recording permission not granted. Please enable in System Preferences."
        );
        // Show dialog to user about enabling screen recording
      }

      // Request accessibility permission for input injection
      const hasAccessibilityAccess =
        systemPreferences.isTrustedAccessibilityClient(false);
      if (!hasAccessibilityAccess) {
        this.logger.info("Requesting accessibility permission");
        systemPreferences.isTrustedAccessibilityClient(true);

        dialog.showMessageBox({
          type: "info",
          title: "Accessibility Permission Required",
          message:
            "EKD Desk needs accessibility permission to control the remote computer.",
          detail:
            "Please enable accessibility access in System Preferences > Security & Privacy > Privacy > Accessibility",
        });
      }
    } catch (error) {
      this.logger.error("Failed to request macOS permissions", { error });
    }
  }
}

// Initialize and start the application
const ekdDeskApp = new EKDDeskApp();

ekdDeskApp.initialize().catch((error) => {
  console.error("Failed to initialize EKD Desk:", error);
  app.quit();
});
