# Forensic Workspace

Forensic CRM and Intelligence Workstation. Built on an **Entity-Link Graph** for auditable, forensic-grade research and communication. Developed with Next.js, Electron, and Drizzle ORM.

## Architecture: Forensic Entity Graph

Unlike traditional CRMs that rely on static foreign keys, this system uses an **Atomic Relationship Graph** (`entity_links`).

- **Forensic Integrity**: Every association (Evidence → Company, Tab → Task) is a first-class citizen.
- **Auditable Unlinking**: Removing a link generates a signed notebook entry for chain-of-custody.
- **Multi-Tenant Isolation**: All browser sessions are sandboxed via the Electron `user-` partition namespace.

## Getting Started (Development)

### 1. Prerequisites

- **Node.js**: lts/iron (v20+)
- **OS**: Windows (optimized), macOS (universal), Linux

### 2. Installation

```powershell
# Clone and install dependencies
git clone <repository-url>
npm install
```

*Note: `electron-rebuild` runs automatically on install to sync native SQLite drivers with the Electron ABI.*

### 3. Local Development

```powershell
# Start Next.js and Electron shell
npm run electron:dev
```

## Production Packaging

To generate a distributable build for your local OS:

```powershell
npm run electron:build
```

Builds are output to the `release/` directory. The production loader is asar-aware and correctly resolves static assets from the `out/` export folder.

---

## 🛠️ Security Hardening

- **IPC Lockdown**: Strictly validates URL schemes (http/https only) and sanitizes session partitions.
- **Navigation Control**: Prevents remote pages from navigating to `file://` or `chrome://` protocols using `will-navigate` listeners.
- **Zero-Trust Bridge**: Privileged database operations (migrations, legacy links) are removed from the renderer bridge.
- **Geometry Clamping**: Prevents rogue renderer code from obfuscating state or overlapping system UI.
