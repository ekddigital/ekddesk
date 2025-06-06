# EKD Desk - Remote Desktop Control Application

## Project Structure

This is a monorepo containing all components of the EKD Desk remote desktop application.

### Packages
- `packages/shared` - Common utilities and types
- `packages/crypto` - Encryption and security modules  
- `packages/network` - Network protocols and WebRTC
- `packages/media` - Video/audio processing
- `packages/platform` - OS-specific implementations
- `packages/ui-components` - Reusable UI components

### Applications
- `apps/desktop-client` - Electron desktop application
- `apps/mobile-client` - React Native mobile app
- `apps/web-client` - Progressive Web App
- `apps/signaling-server` - WebRTC signaling & relay
- `apps/auth-service` - Authentication microservice
- `apps/admin-dashboard` - Management interface

### Services
- `services/turn-servers` - STUN/TURN infrastructure
- `services/relay-servers` - Connection relay services
- `services/monitoring` - Telemetry & analytics

## Getting Started

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Install Dependencies**
   ```bash
   npm run bootstrap
   ```

3. **Build All Packages**
   ```bash
   npm run build
   ```

4. **Start Development Environment**
   ```bash
   npm run start:all
   ```

## Development Commands

- `npm run build` - Build all packages and apps
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run format` - Format all code
- `npm run typecheck` - Type check all TypeScript
- `npm run clean` - Clean all build artifacts

## Environment Variables

Copy `.env.example` to `.env` and configure:

- **Database**: PostgreSQL connection settings
- **Redis**: Session store configuration  
- **Security**: JWT secrets and encryption keys
- **Network**: STUN/TURN server configuration
- **Storage**: File storage settings

## Architecture

EKD Desk follows a microservices architecture with:

- **Frontend**: Electron (desktop), React Native (mobile), PWA (web)
- **Backend**: Node.js microservices with PostgreSQL
- **Communication**: WebRTC for P2P, WebSocket for signaling
- **Security**: End-to-end encryption with AES-256

## License

MIT License - see LICENSE file for details
