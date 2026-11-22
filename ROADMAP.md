# SnapVault — Milestone Tracker & Product Roadmap

> **Document Purpose:** Living milestone tracker for the SnapVault project. Every task, feature, and deliverable is tracked here with explicit completion status. This file is the single source of truth for project progress and is updated at the end of every phase.

**Product:** SnapVault — Visual Backup "Time Machine" for Windows 11
**Target:** Microsoft Store · $19.99 one-time purchase · 14-day free trial · 100% offline
**Tech Stack:** Tauri 2 (Rust) + React 18 + TypeScript + Tailwind CSS + SQLite
**Tracking Format:** `[ ]` not started · `[/]` in progress · `[x]` complete

---

## v1.0 — Microsoft Store Launch

### Phase 0: Project Initialization & Governance

| Status | Task |
|:------:|------|
| ✅ | Development environment verified |
| ✅ | Node.js 24.12.0, npm 11.6.2 confirmed |
| ✅ | Rust 1.99.1, Cargo, Clippy confirmed |
| ✅ | Tauri CLI 2.12.6 confirmed |
| ✅ | WebView2 runtime confirmed (157.0.4341.60) |
| ✅ | MSVC Build Tools gap identified and logged in ISSUES.md |
| ✅ | Git repository initialized |
| ✅ | .gitignore created |
| ✅ | DEVELOPER.md created — mandatory operating protocol |
| ✅ | BRIEF.md created — product brief |
| ✅ | ARCHITECTURE.md created — system architecture |
| ✅ | PLAN.md created — phase execution plan |
| ✅ | ROADMAP.md created — this file |
| ✅ | ISSUES.md created — issue tracker |
| ✅ | README.md created — repository readme |
| ✅ | reports/REPORT_TEMPLATE.md created |
| ✅ | reports/PHASE_0_REPORT.md generated |
| ✅ | Phase 0 Report reviewed |

- [x] Development environment verified
- [x] Node.js 24.12.0, npm 11.6.2 confirmed
- [x] Rust 1.99.1, Cargo, Clippy confirmed
- [x] Tauri CLI 2.12.6 confirmed
- [x] WebView2 runtime confirmed (157.0.4341.60)
- [x] MSVC Build Tools gap identified and logged in ISSUES.md
- [x] Git repository initialized
- [x] .gitignore created
- [x] DEVELOPER.md created — mandatory operating protocol
- [x] BRIEF.md created — product brief
- [x] ARCHITECTURE.md created — system architecture
- [x] PLAN.md created — phase execution plan
- [x] ROADMAP.md created — this file
- [x] ISSUES.md created — issue tracker
- [x] README.md created — repository readme
- [x] reports/REPORT_TEMPLATE.md created
- [x] reports/PHASE_0_REPORT.md generated
- [x] Phase 0 Report reviewed

**Phase 0 Result:** All 18 tasks completed. Foundation documents established, development environment fully validated, known issues catalogued. Project is ready to proceed to implementation.

---

### Phase 1: Tauri 2 Scaffold + SQLite Foundation

**Goal:** Stand up the runnable application shell with a working database layer. The app must launch in dev mode, display a React page, and execute a round-trip Tauri IPC command that reads/writes SQLite.

- [x] Tauri 2 project scaffolded (React 18 + TypeScript + Vite)
- [x] Tailwind CSS integrated
- [x] SQLite integration via rusqlite (WAL mode & foreign keys enabled)
- [x] Schema migration system implemented
- [x] All 6 database tables created with indices (drives, backup_jobs, snapshots, file_entries, chunks, health_checks)
- [x] Basic Tauri IPC command working (`ping_db` returning status, table count, schema version)
- [x] Dev/build mode compiles and packages cleanly (`npm run build` & `cargo check`)
- [x] Phase 1 Central Tester verification passed (5 unit tests, 0 clippy warnings)
- [x] Phase 1 Report generated (`reports/PHASE_1_REPORT.md`)

**Key Deliverables:**
- `src-tauri/` Rust backend with Cargo.toml and tauri.conf.json
- `src/` React frontend with Vite + TypeScript + Tailwind
- `src-tauri/src/db/` module with connection pool and migration runner
- Tables: `drive_pairs`, `snapshots`, `file_entries`, `chunks`, `app_config`
- At least one `#[tauri::command]` demonstrating IPC round-trip

**Exit Criteria:** `cargo tauri dev` launches the app window, the React UI renders, and a button click triggers an IPC call that writes to and reads from SQLite.

---

### Phase 2: Backup Engine Core

**Goal:** Implement the complete backup pipeline — from scanning the source directory to producing a deduplicated, content-addressed snapshot on the destination drive. This is the heart of SnapVault.

- [x] FastCDC chunking engine (min 4KB, avg 16KB, max 64KB)
- [x] BLAKE3 hashing integration
- [x] Content-addressed chunk store (2-level fan-out `chunks/xx/yy/[hash].chunk`)
- [x] Atomic write engine (.tmp -> sync_all -> rename)
- [x] Snapshot lifecycle state machine (PENDING -> COMMITTED / INTERRUPTED)
- [x] File system scanner (walkdir with non-panicking error handling)
- [x] Deduplication logic (skip existing chunks, tally dedup_saved_bytes)
- [x] Drive pairing CRUD (register_drive, list_drives, create_backup_job, list_backup_jobs)
- [x] Backup job execution pipeline (unplug-safe snapshot execution)
- [x] File entry recording (batched transactions of 1,000 rows mitigating RISK-001)
- [x] Phase 2 Central Tester verification passed (11 unit/integration tests, 0 clippy warnings)
- [x] Phase 2 Report generated (`reports/PHASE_2_REPORT.md`)

**Key Deliverables:**
- `src-tauri/src/backup/` module with chunker, hasher, writer, scanner
- `src-tauri/src/store/` content-addressed chunk store with `AA/BB/` fan-out
- Drive pairing IPC commands (create, list, update, delete)
- Snapshot state machine: `Pending → Running → Finalizing → Complete | Failed`
- Full backup of a test directory producing verifiable chunk files

**Exit Criteria:** A paired drive can execute a full backup job. The resulting snapshot contains correct file entries and deduplicated chunks. A second backup of the same data produces zero new chunks (100% dedup hit rate).

---

### Phase 3: Restore Engine + Visual Timeline UI

**Goal:** Users can browse any snapshot in a visual timeline, explore its file tree, compare file versions side-by-side, and restore individual files or entire folders with cryptographic verification.

- [x] File/folder restore from snapshots
- [x] Chunk reassembly with BLAKE3 verification
- [x] Visual timeline scrubber component
- [x] File explorer for snapshot browsing
- [x] Side-by-side diff viewer
- [x] Image preview comparison
- [x] Dashboard page
- [x] Tauri IPC wiring for restore/browse
- [x] Phase 3 Central Tester verification passed
- [x] Phase 3 Report generated (`reports/PHASE_3_REPORT.md`)

**Key Deliverables:**
- `src-tauri/src/restore/` module with chunk reassembly, memory preview, and integrity verification
- React timeline scrubber component with zoom navigation and keyboard arrows
- Snapshot file browser (tree view with breadcrumbs, status pills, show/hide deleted)
- Side-by-side text diff viewer and image comparison overlay in slide-over drawer
- Dashboard with 3-step setup wizard, KPI metrics, and live progress bar
- Full Tauri dialog integration for native Windows folder selection

**Exit Criteria:** A user can select any snapshot on the timeline, browse its contents, preview file differences, and restore a file/folder to a chosen location. Restored files are byte-identical to the originals (verified by BLAKE3). All Phase 3 deliverables verified passing.

---

### Phase 4: Killer Features & System Tray

**Goal:** Implement the differentiating features that justify SnapVault's price point — ransomware detection tripwire, proof-of-restore health checks, unplug-safe operation, emergency plain-file mirror mode, Windows System Tray, toast notifications, and background drive auto-connect watching.

- [x] Ransomware/mass-deletion tripwire ("Safety Brake") with snapshot auto-locking
- [x] Automated proof-of-restore health checks (sampling BLAKE3 chunk verification & staleness check)
- [x] Unplug-safe disconnect detection + atomic commit lifecycle
- [x] Plain-file emergency mirror mode (`SnapVault_Latest_Readable` zero-tool recovery)
- [x] Windows system tray icon and context menu (Open, Back Up Now, Pause, Quit)
- [x] Windows toast notifications via `tauri-plugin-notification`
- [x] Background drive watcher auto-connect polling loop
- [x] Dashboard health status KPI card ("Verified Restorable" badge + "Verify Now" button)
- [x] Dashboard tripwire banner (amber warning, unlock modal, direct link to Time Machine)
- [x] Jobs page emergency mirror toggle and status pill
- [x] Phase 4 Central Tester verification passed (15 unit & integration tests, 0 clippy warnings)
- [x] Phase 4 Report generated (`reports/PHASE_4_REPORT.md`)

**Key Deliverables:**
- Ransomware tripwire: detects entropy spikes + mass rename/delete patterns, blocks snapshot
- Proof-of-restore: randomly samples chunks, reassembles, verifies BLAKE3 — reports health score
- Disconnect handler: detects USB removal mid-backup, marks snapshot `Interrupted`, resumes on reconnect
- Multi-drive rotation: supports 2+ paired drives, tracks last-used, suggests rotation schedule
- Mirror mode: copies files as plain directory tree (no chunking) for emergency recovery without SnapVault
- Settings page: backup schedule, retention policy, notification preferences, drive management

**Exit Criteria:** Each feature has unit tests and integration tests. Ransomware tripwire triggers on simulated attack patterns. Proof-of-restore reports a health score. Pulling a USB mid-backup does not corrupt the chunk store. Multi-drive rotation correctly tracks and schedules across drives.

---

### Phase 5: Hardening, Scheduler, Settings & Stress Tests

**Goal:** Harden SnapVault against real-world Windows 11 filesystem edge cases, add the background interval scheduler and Settings page, and validate reliability with an automated 500+ file stress-test suite.

- [x] Windows Long Paths (`\\?\` extended prefix) and Unicode filename support (Bengali, CJK, emoji, spaces)
- [x] Symlink and NTFS junction loop prevention (`follow_links(false)` + reparse attribute check)
- [x] In-use / locked file handling (500ms retry with graceful skip)
- [x] Default exclusion presets (`node_modules`, `.git/objects`, `*.tmp`, `~$*`, `Thumbs.db`, `$RECYCLE.BIN`, `System Volume Information`)
- [x] Startup orphan `.tmp` file cleanup in `.snapvault/chunks/` and `.snapvault/manifests/`
- [x] Quiet Mode background worker CPU throttling (`THREAD_PRIORITY_BELOW_NORMAL` on Windows)
- [x] Background interval scheduler with periodic reconciliation scans (mitigating RISK-003)
- [x] Automatic weekly Proof-of-Restore health checks
- [x] Settings page (`src/pages/Settings.tsx`) with Quiet Mode toggle, exclusion editor, tripwire controls, notifications, and theme selector
- [x] Automated stress-test suite with 500+ nested files and corrupted chunk batch resilience
- [x] Phase 5 Central Tester verification passed (28 tests: 17 unit, 7 integration, 4 stress; 0 clippy warnings)
- [x] Phase 5 Report generated (`reports/PHASE_5_REPORT.md`)

**Key Deliverables:**
- System tray integration with dynamic icon (idle / backing up / error / trial expiring)
- Tray context menu: Backup Now, Open Dashboard, Pause, Settings, Quit
- Scheduler: hourly / daily / weekly / continuous-with-cooldown, respecting system idle
- GFS retention: configurable Grandfather-Father-Son policy with automatic pruning
- Garbage collector: identifies orphaned chunks after snapshot pruning, reclaims disk space
- Trial: 14-day local countdown, grace period warnings at day 10/12/13, read-only mode after expiry
- Polish: skeleton loading states, smooth transitions, toast notifications, error boundaries
- Accessibility: keyboard navigation, screen reader labels, focus indicators, high contrast support

**Exit Criteria:** SnapVault runs silently in the system tray, executes scheduled backups, enforces retention, and presents a professional trial experience. The UI passes a manual accessibility audit covering keyboard navigation, screen reader compatibility, and color contrast (WCAG 2.1 AA).

---

### Phase 6: Microsoft Store Launch

**Goal:** Package SnapVault as an MSIX installer, pass Windows App Certification Kit (WACK), prepare all Store listing assets, and submit to the Microsoft Store.

- [ ] MSIX package generation
- [ ] Store assets (icons, screenshots, description)
- [ ] Store listing content
- [ ] Pricing configured ($19.99 + 14-day trial)
- [ ] Security audit (zero network calls)
- [ ] Performance profiling
- [ ] User documentation
- [ ] v1.0.0 release tag
- [ ] Windows App Certification Kit passed
- [ ] Phase 6 Central Tester verification passed
- [ ] Phase 6 Report generated

**Key Deliverables:**
- MSIX package signed and ready for Store submission
- Store assets: app icon (all required sizes), 5+ screenshots (1366×768 min), feature graphic
- Store listing: title, short description, full description, feature list, privacy policy URL
- Pricing: $19.99 USD one-time purchase with 14-day free trial via Microsoft Store commerce
- Security audit report confirming zero outbound network calls (Wireshark + Fiddler trace)
- Performance profile: startup time < 2s, memory usage < 150 MB idle, backup throughput benchmarks
- User documentation: Getting Started guide, FAQ, troubleshooting guide
- Git tag `v1.0.0` on the release commit

**Exit Criteria:** MSIX passes WACK. Store listing is complete with all required assets. The security audit confirms zero network activity. Performance meets defined thresholds. Documentation is published. The `v1.0.0` tag is pushed.

---

## Post-Launch Backlog

### v1.1 — Quality of Life

**Target:** 4–6 weeks post-launch. Focus on the most requested user experience improvements and security hardening.

- [ ] Encrypted backup vaults (AES-256-GCM, user passphrase)
- [ ] Backup verification progress bar with ETA
- [ ] Detailed per-file change log viewer
- [ ] Custom retention policy editor
- [ ] Backup size analytics and storage usage charts
- [ ] Dark/light theme toggle
- [ ] Localization framework (i18n) + first 3 languages

**Notes:**
- Encryption uses AES-256-GCM with Argon2id key derivation from a user-supplied passphrase
- Localization targets: English (default), German, Japanese (highest Windows store markets after EN)
- Theme toggle persists user preference in `app_config` table, respects Windows system theme on first launch

---

### v2.0 — Extended Platform

**Target:** 3–4 months post-launch. Expand SnapVault beyond single-machine USB backup to cover network destinations, enterprise deployment, and cross-platform availability.

- [ ] SFTP/S3 optional destination plugin (opt-in, still no telemetry)
- [ ] Network share (SMB) backup destination
- [ ] Backup encryption key escrow (local USB key backup)
- [ ] CLI interface for headless/scheduled operations
- [ ] PowerShell module for enterprise scripting
- [ ] Group Policy support for enterprise deployment
- [ ] Open-source restore-only tool (standalone, no SnapVault required)
- [ ] Linux port (Tauri 2 supports Linux)

**Notes:**
- Network destinations are entirely opt-in; default remains local/USB with zero cloud dependency
- The open-source restore tool ensures users are never locked in — they can recover data even without SnapVault installed
- Linux port leverages Tauri 2's native Linux support (WebKitGTK); same Rust backend, same React frontend
- Enterprise features (GPO, PowerShell) target a potential separate Enterprise SKU or volume licensing

---

### v2.1 — Advanced Features

**Target:** 6+ months post-launch. Power-user and professional features based on user feedback and competitive analysis.

- [ ] Block-level diff for large files (VM images, databases)
- [ ] Snapshot tagging and annotations
- [ ] Backup task prioritization and bandwidth throttling
- [ ] Email/webhook notifications (opt-in)
- [ ] Snapshot comparison (diff between any two snapshots)
- [ ] Restore to alternate location with conflict resolution

**Notes:**
- Block-level diff targets files > 1 GB (VM disks, database files) where full-file chunking is wasteful
- Snapshot tagging allows users to mark snapshots as "before update," "known good," etc.
- Bandwidth throttling ensures backups don't saturate USB or network bandwidth during active use
- Snapshot comparison shows added/modified/deleted files between any two snapshots in the timeline

---

## Progress Summary

| Phase | Tasks | Complete | In Progress | Not Started | Status |
|-------|------:|:--------:|:-----------:|:-----------:|--------|
| Phase 0 — Initialization | 18 | 18 | 0 | 0 | ✅ Complete |
| Phase 1 — Scaffold | 9 | 9 | 0 | 0 | ✅ Complete |
| Phase 2 — Backup Engine | 12 | 12 | 0 | 0 | ✅ Complete |
| Phase 3 — Restore + UI | 10 | 0 | 0 | 10 | ⬜ Not Started |
| Phase 4 — Killer Features | 10 | 0 | 0 | 10 | ⬜ Not Started |
| Phase 5 — Polish + Trial | 11 | 0 | 0 | 11 | ⬜ Not Started |
| Phase 6 — Store Launch | 11 | 0 | 0 | 11 | ⬜ Not Started |
| **v1.0 Total** | **81** | **39** | **0** | **42** | **48% Complete** |

| Backlog | Tasks | Status |
|---------|------:|--------|
| v1.1 — Quality of Life | 7 | ⬜ Post-Launch |
| v2.0 — Extended Platform | 8 | ⬜ Post-Launch |
| v2.1 — Advanced Features | 6 | ⬜ Post-Launch |
| **Backlog Total** | **21** | **Planned** |

---

## Document History

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026-11-22 | 1.0 | SnapVault Team | Initial roadmap created with all v1.0 phases and post-launch backlog |

---

*This document is updated at the conclusion of every phase. Status checkboxes are the authoritative record of project progress. All changes must be reflected in both the checkbox lists and the Progress Summary table.*
