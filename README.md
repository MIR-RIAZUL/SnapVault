# SnapVault

**Your files, your drives, your time machine. 100% offline.**

![Phase 0 Complete](https://img.shields.io/badge/Phase_0-Complete-brightgreen) ![Windows 11](https://img.shields.io/badge/Platform-Windows_11-0078D4) ![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131) ![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)

---

## Overview

SnapVault is a **local-first, 100% offline Visual Backup "Time Machine"** for Windows 11. It delivers instant, browsable snapshots of your files and folders — with full version history, visual diffs, and one-click restore — all without ever touching a cloud server. Your data never leaves your machine. No subscriptions, no accounts, no telemetry. Just a single $19.99 purchase from the Microsoft Store, a 14-day free trial, and permanent ownership of a tool that treats your files the way they deserve: as yours.

SnapVault is built for photographers, developers, writers, designers, and anyone who has ever lost a file and wished they could just go back in time.

---

## Key Features

- **Instant File Snapshots** — Capture the state of any folder or drive in seconds with content-defined chunking and BLAKE3 hashing.
- **Visual Timeline Browser** — Scroll through your backup history on an intuitive visual timeline; see exactly what changed and when.
- **One-Click Restore** — Recover any file or folder to any previous version with a single click. No CLI, no complexity.
- **Block-Level Deduplication** — FastCDC content-defined chunking ensures only unique data blocks are stored, dramatically reducing storage consumption.
- **Zero Cloud Dependency** — Every byte stays on your local drives. No accounts, no logins, no servers, no internet required.
- **Blazing-Fast Hashing** — BLAKE3 cryptographic hashing delivers integrity verification at multi-GB/s throughput.
- **Smart Change Detection** — Filesystem watchers and incremental scans detect changes in real time without full re-scans.
- **MSIX Sandboxed Distribution** — Clean install and uninstall via the Microsoft Store with Windows 11 native packaging.

### Killer Features

1. **Time Slider™** — Drag a slider to any point in time and instantly preview the exact state of your files at that moment.
2. **Visual Diff Engine** — Side-by-side and overlay comparisons for images, text files, and documents with pixel-level accuracy.
3. **Storage Intelligence Dashboard** — Real-time analytics showing deduplication savings, backup health, and storage utilization trends.
4. **Backup Integrity Verification** — Automatic and on-demand BLAKE3 checksum verification ensures your backups are never silently corrupted.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite |
| **Backend** | Rust (Tauri 2), SQLite (rusqlite + r2d2 connection pool) |
| **Hashing** | BLAKE3 (cryptographic, multi-threaded) |
| **Chunking** | FastCDC (content-defined chunking) |
| **Platform** | Windows 11, WebView2, MSIX packaging |
| **Distribution** | Microsoft Store — $19.99 one-time purchase, 14-day free trial |

---

## Prerequisites

Ensure the following tools are installed and available on your `PATH` before building SnapVault:

| Requirement | Minimum Version | Recommended / Verified |
|---|---|---|
| **Node.js** | v20.0.0+ | v24.12.0 |
| **npm** | 10.0.0+ | 11.6.2 |
| **Rust** (via rustup) | 1.75.0+ | 1.99.1 |
| **Cargo** | (bundled with Rust) | 1.99.1 |
| **Clippy** | (bundled with Rust) | latest stable |
| **Tauri CLI** | 2.0.0+ | 2.12.6 |
| **Visual Studio 2022 Build Tools** | — | "Desktop development with C++" workload |
| **WebView2 Runtime** | — | Pre-installed on Windows 11 |
| **Git** | 2.40+ | latest stable |

> [!IMPORTANT]
> The **Visual Studio 2022 Build Tools** must include the **"Desktop development with C++"** workload. This provides the MSVC compiler, Windows SDK, and linker required by the Rust toolchain to compile native Windows binaries.

Install the Tauri CLI globally via either method:

```bash
# Option A: via npm (recommended)
npm install -g @tauri-apps/cli

# Option B: via Cargo
cargo install tauri-cli
```

---

## Local Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd snapvault

# 2. Install frontend dependencies
npm install

# 3. Verify Rust toolchain
rustup default stable-x86_64-pc-windows-msvc
rustup target add x86_64-pc-windows-msvc

# 4. Run in development mode (launches app with hot reload)
npm run tauri dev

# 5. Run backend unit tests
cd src-tauri && cargo test

# 6. Run Clippy lint (zero warnings policy)
cd src-tauri && cargo clippy -- -D warnings

# 7. Build for production (generates MSIX installer)
npm run tauri build
```

> [!NOTE]
> The first `npm run tauri dev` invocation will compile the entire Rust backend, which may take 2–5 minutes depending on your hardware. Subsequent builds are incremental and typically complete in under 10 seconds.

---

## Development Commands

| Command | Description |
|---|---|
| `npm run tauri dev` | Start development mode with frontend hot reload and Rust recompilation |
| `npm run build` | Build the React/TypeScript frontend for production |
| `npm run tauri build` | Full production build — compiles Rust, bundles frontend, generates MSIX installer |
| `cargo test` | Run all Rust unit and integration tests (execute from `src-tauri/`) |
| `cargo clippy -- -D warnings` | Lint all Rust code with zero-warning enforcement (execute from `src-tauri/`) |
| `npm run lint` | Lint TypeScript and React code with ESLint |

---

## Project Documentation

SnapVault maintains a comprehensive documentation suite in the repository root:

| Document | Description |
|---|---|
| [DEVELOPER.md](DEVELOPER.md) | Mandatory operating protocol, coding standards, and team workflow conventions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, database schemas, data flow diagrams, and module boundaries |
| [PLAN.md](PLAN.md) | Detailed phase execution plan covering Phases 0 through 6 with acceptance criteria |
| [ROADMAP.md](ROADMAP.md) | Milestone tracker with current completion status and target dates |
| [BRIEF.md](BRIEF.md) | Product vision, feature specifications, pricing strategy, and competitive analysis |
| [ISSUES.md](ISSUES.md) | Issue and risk tracker with severity ratings and resolution status |

> [!TIP]
> New contributors should read **DEVELOPER.md** first — it defines the branching strategy, commit conventions, code review process, and the mandatory pre-merge checklist that all pull requests must satisfy.

---

## Architecture Overview

SnapVault follows a **layered architecture** with strict separation of concerns, enforced at both the module and process boundary level:

```
┌─────────────────────────────────────────────┐
│              React UI (WebView2)             │
│         TypeScript + Tailwind CSS           │
├─────────────────────────────────────────────┤
│              Tauri IPC Bridge               │
│         Commands, Events, Channels          │
├─────────────────────────────────────────────┤
│            Rust Backup Engine               │
│    Scanning · Chunking · Hashing · Diff     │
├──────────────────────┬──────────────────────┤
│    SQLite Database   │   Chunk Store (FS)   │
│  Metadata · History  │  Deduplicated Blobs  │
└──────────────────────┴──────────────────────┘
```

**Data flows in one direction:** the React frontend issues commands through the Tauri IPC bridge, the Rust engine processes those commands against the SQLite metadata database and the filesystem-based chunk store, and results flow back to the UI as structured responses or streamed events.

The chunk store uses **FastCDC content-defined chunking** to split files into variable-size blocks (average 64 KiB), each identified by its **BLAKE3 hash**. Identical blocks across different files and different snapshots are stored exactly once, delivering aggressive deduplication without any cloud-side processing.

For the complete architectural specification — including database schemas, module dependency graphs, IPC command catalog, and chunking pipeline details — see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## License

**Proprietary — All Rights Reserved.**

SnapVault is a commercial product developed and distributed via the Microsoft Store. No part of this codebase may be reproduced, distributed, or transmitted in any form without explicit written permission from the copyright holder.

© 2025 SnapVault. All rights reserved.
