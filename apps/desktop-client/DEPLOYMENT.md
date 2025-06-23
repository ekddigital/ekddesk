# EKD Desk Desktop Client - Environment Configuration

This document explains how to configure the EKD Desk Desktop Client for different deployment scenarios using environment variables.

## 🔧 Configuration System

The EKD Desk Desktop Client uses a robust environment-based configuration system that allows you to easily deploy the application across different environments without code changes.

### Configuration Files

- **`.env.development`** - Development environment defaults
- **`.env.production`** - Production environment defaults
- **`.env.template`** - Template for custom deployments
- **`.env.local`** - Local overrides (not tracked in git)

### Environment Variables

| Variable                     | Description                 | Default (Dev)           | Default (Prod)              |
| ---------------------------- | --------------------------- | ----------------------- | --------------------------- |
| `EKD_API_BASE_URL`           | Backend API server URL      | `http://localhost:3001` | `http://192.168.1.101:3001` |
| `EKD_SIGNALING_URL`          | WebRTC signaling server URL | `http://localhost:3002` | `http://192.168.1.101:3002` |
| `EKD_APP_NAME`               | Application display name    | `EKD Desk (Dev)`        | `EKD Desk`                  |
| `EKD_APP_VERSION`            | Application version         | `1.0.0-dev`             | `1.0.0`                     |
| `EKD_ENABLE_DEBUG_LOGS`      | Enable debug logging        | `true`                  | `false`                     |
| `EKD_ENABLE_AUTO_UPDATE`     | Enable automatic updates    | `false`                 | `true`                      |
| `EKD_ENABLE_CRASH_REPORTING` | Enable crash reporting      | `false`                 | `true`                      |
| `EKD_CONNECTION_TIMEOUT`     | Network timeout (ms)        | `30000`                 | `10000`                     |
| `EKD_MAX_RETRY_ATTEMPTS`     | Max retry attempts          | `3`                     | `5`                         |
| `EKD_ENABLE_HTTPS`           | Force HTTPS connections     | `false`                 | `false`                     |
| `EKD_CERTIFICATE_VALIDATION` | Validate SSL certificates   | `false`                 | `true`                      |

## 🚀 Deployment Scenarios

### Scenario 1: Local Network Deployment

For deploying across computers on the same local network:

1. **Find your server IP address:**

   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Create `.env.local` file:**

   ```bash
   cp .env.template .env.local
   ```

3. **Update the IP addresses in `.env.local`:**

   ```env
   EKD_API_BASE_URL=http://192.168.1.100:3001
   EKD_SIGNALING_URL=http://192.168.1.100:3002
   ```

4. **Build the application:**
   ```bash
   npm run build
   npm run dist
   ```

### Scenario 2: Remote Server Deployment

For deploying with a remote server:

1. **Set environment variables:**
   ```env
   EKD_API_BASE_URL=https://api.yourcompany.com
   EKD_SIGNALING_URL=wss://signaling.yourcompany.com
   EKD_ENABLE_HTTPS=true
   EKD_CERTIFICATE_VALIDATION=true
   ```

### Scenario 3: Development Environment

For local development:

1. **Use development defaults:**

   ```bash
   npm run dev
   ```

2. **Or override specific settings in `.env.local`:**
   ```env
   EKD_ENABLE_DEBUG_LOGS=true
   EKD_CONNECTION_TIMEOUT=60000
   ```

## 📦 Building for Distribution

### macOS

Build for both Intel and Apple Silicon:

```bash
# Intel Macs (x64)
npx electron-builder --mac --x64

# Apple Silicon Macs (arm64)
npx electron-builder --mac --arm64

# Universal binary (both architectures)
npx electron-builder --mac --universal
```

### Windows

```bash
# Windows x64
npx electron-builder --win --x64

# Windows x86
npx electron-builder --win --ia32
```

### Linux

```bash
# Linux x64
npx electron-builder --linux --x64
```

## 🔧 Runtime Configuration

The application automatically detects the environment based on `NODE_ENV`:

- **Development**: Uses localhost URLs and enables debug features
- **Production**: Uses configured remote URLs and enables production features

You can override any setting by:

1. **Setting environment variables before building:**

   ```bash
   export EKD_API_BASE_URL=http://your-server:3001
   npm run build
   npm run dist
   ```

2. **Creating a `.env.local` file** (recommended for persistent settings)

3. **Setting system environment variables** (for enterprise deployments)

## 🐛 Troubleshooting

### Connection Issues

1. **Check server URLs:**

   - Ensure the backend server is running on the specified IP/port
   - Verify firewall settings allow connections on ports 3001 and 3002

2. **Enable debug logging:**

   ```env
   EKD_ENABLE_DEBUG_LOGS=true
   ```

3. **Test network connectivity:**
   ```bash
   curl http://your-server-ip:3001/health
   ```

### Build Issues

1. **Clear build cache:**

   ```bash
   npm run clean
   npm run build
   ```

2. **Check environment variables:**
   ```bash
   # View current configuration
   node -e "require('dotenv').config(); console.log(process.env)"
   ```

## 📁 File Structure

```
apps/desktop-client/
├── .env.development      # Development defaults
├── .env.production       # Production defaults
├── .env.template         # Configuration template
├── .env.local           # Local overrides (create manually)
├── src/
│   └── config/
│       └── environment.ts # Environment configuration manager
└── build/               # Distribution packages
    ├── EKD Desk-1.0.0.dmg         # macOS Intel
    ├── EKD Desk-1.0.0-arm64.dmg   # macOS Apple Silicon
    └── EKD Desk Setup 1.0.0.exe   # Windows
```

## 🔒 Security Considerations

- Never commit `.env.local` files to version control
- Use HTTPS in production environments
- Enable certificate validation for production deployments
- Regularly update the application version for security patches

## 📞 Support

For deployment assistance or configuration issues, refer to the main project documentation or contact the development team.
