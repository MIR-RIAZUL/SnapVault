# SnapVault — Issue & Risk Tracker

> **Project:** SnapVault — Visual Backup Time Machine for Windows 11
> **Last Updated:** 2025-07-14
> **Maintained By:** Engineering Lead

This document tracks all known issues, blockers, and architectural risks discovered during development. Items are logged during each phase and updated as they are resolved or mitigated.

---

## Summary Table

| ID | Phase | Severity | Area | Description | Status |
|---|---|---|---|---|---|
| ISS-001 | 0 | 🔴 CRITICAL | Environment | MSVC Build Tools not installed — `link.exe` linker missing | OPEN |
| ISS-002 | 0 | 🟠 HIGH | Environment | Default Rust toolchain is GNU, not MSVC | OPEN (blocked by ISS-001) |
| ISS-003 | 0 | 🟢 LOW | Environment | `winapp` CLI not available for MSIX packaging | OPEN (Deferred to Phase 6) |
| RISK-001 | 2 | 🟡 MEDIUM | Architecture | SQLite concurrent write performance under heavy backup load | MONITORING |
| RISK-002 | 2 | 🟢 LOW | Architecture | FastCDC chunk size vs dedup ratio tradeoff needs tuning | MONITORING |
| RISK-003 | 5 | 🟡 MEDIUM | Platform | Windows file system watcher reliability under heavy I/O | MONITORING |

---

## Severity Definitions

| Level | Label | Meaning |
|---|---|---|
| 🔴 | CRITICAL | Blocks the next phase from starting. Must be resolved before any dependent work begins. |
| 🟠 | HIGH | Significant impact on correctness or developer productivity. Should be resolved within the current phase. |
| 🟡 | MEDIUM | Potential impact on performance, reliability, or user experience. Must be validated and mitigated before the affected phase completes. |
| 🟢 | LOW | Minor impact or far-future concern. Tracked for awareness; resolution can be deferred. |

## Status Definitions

| Status | Meaning |
|---|---|
| OPEN | Issue is confirmed and unresolved. |
| MONITORING | Risk is identified but not yet triggered. Under observation with planned validation. |
| IN PROGRESS | Actively being worked on. |
| RESOLVED | Fix applied and verified. |
| DEFERRED | Intentionally postponed to a later phase. |
| CLOSED | No longer relevant or superseded by another item. |

---

## Issues

### ISS-001: MSVC Build Tools Not Installed

| Field | Value |
|---|---|
| **ID** | ISS-001 |
| **Phase** | 0 — Environment Setup |
| **Severity** | 🔴 CRITICAL (Blocker for Phase 1) |
| **Area** | Environment |
| **Status** | OPEN |
| **Blocks** | ISS-002, Phase 1 (Project Scaffold) |

**Description:**
Visual Studio C++ Build Tools (MSVC) are not installed on the development machine. The `link.exe` linker is missing. Tauri 2 on Windows requires the MSVC target (`x86_64-pc-windows-msvc`) with the MSVC linker for production builds. The `stable-x86_64-pc-windows-msvc` toolchain is installed via rustup but cannot link without the Visual Studio Build Tools runtime.

**Verification Notes:**
Tested by compiling a minimal Rust program with the MSVC toolchain:

```powershell
rustup run stable-x86_64-pc-windows-msvc rustc main.rs
```

Result: **fails with `linker 'link.exe' not found`**.

The GNU toolchain (`stable-x86_64-pc-windows-gnu`) compiles and links successfully, confirming the issue is isolated to the missing MSVC linker and libraries. The GNU toolchain is not suitable for Tauri Windows builds because:

- Tauri 2 requires MSVC for proper Windows API integration.
- MSIX packaging targets the MSVC ABI.
- WebView2 embedding depends on MSVC-compatible object files.

**Resolution:**
Install Visual Studio 2022 Build Tools with the "Desktop development with C++" workload. Use one of the following methods:

**Option A — winget (recommended):**

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**Option B — Manual download:**
Download the installer from [https://visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select the "Desktop development with C++" workload during installation.

**Post-installation**, set the default Rust toolchain to MSVC:

```powershell
rustup default stable-x86_64-pc-windows-msvc
```

**Verification command** (run after installation):

```powershell
rustup run stable-x86_64-pc-windows-msvc rustc -vV
# Should show host: x86_64-pc-windows-msvc without linker errors
```

---

### ISS-002: Default Rust Toolchain is GNU, Not MSVC

| Field | Value |
|---|---|
| **ID** | ISS-002 |
| **Phase** | 0 — Environment Setup |
| **Severity** | 🟠 HIGH |
| **Area** | Environment |
| **Status** | OPEN (blocked by ISS-001) |
| **Depends On** | ISS-001 |

**Description:**
The default Rust toolchain is `stable-x86_64-pc-windows-gnu` but Tauri 2 on Windows requires `stable-x86_64-pc-windows-msvc` for proper Windows API integration, MSIX packaging, and WebView2 embedding. All `cargo build` and `cargo tauri build` commands will use the wrong ABI until the default is switched.

**Verification Notes:**
`rustup show` confirms the current default:

```
Default host: x86_64-pc-windows-gnu

installed toolchains
--------------------
stable-x86_64-pc-windows-gnu (default)
stable-x86_64-pc-windows-msvc

active toolchain
----------------
stable-x86_64-pc-windows-gnu (default)
```

The MSVC toolchain is installed but non-functional without Visual Studio Build Tools (see ISS-001).

**Resolution:**
After ISS-001 is resolved, switch the default toolchain:

```powershell
rustup default stable-x86_64-pc-windows-msvc
```

**Verification command:**

```powershell
rustup show
# Default host should now show: x86_64-pc-windows-msvc
```

---

### ISS-003: winapp CLI Not Available

| Field | Value |
|---|---|
| **ID** | ISS-003 |
| **Phase** | 0 — Environment Setup |
| **Severity** | 🟢 LOW (Not needed until Phase 6) |
| **Area** | Environment |
| **Status** | OPEN (Deferred to Phase 6) |

**Description:**
The `winapp` CLI tool for MSIX packaging is not installed on the development machine. This tool is only needed in Phase 6 for Microsoft Store submission and is not a blocker for any earlier phase.

**Verification Notes:**

```powershell
Get-Command winapp
# Result: CommandNotFoundException — not found
```

Tauri 2's built-in bundler may handle MSIX generation without the `winapp` CLI, potentially making this a non-issue.

**Resolution:**
Will be evaluated in Phase 6. Possible approaches:

1. **Tauri 2 native MSIX bundler** — Tauri 2's `cargo tauri build` supports `--bundles msi` and may support MSIX natively. This is the preferred path.
2. **Windows App SDK CLI tools** — Install via `winget install Microsoft.WindowsAppSDK` if Tauri's bundler does not produce a valid MSIX package.
3. **Manual MSIX packaging** — Use `MakeAppx.exe` and `SignTool.exe` from the Windows SDK as a fallback.

---

## Risks

### RISK-001: SQLite Concurrent Write Performance

| Field | Value |
|---|---|
| **ID** | RISK-001 |
| **Phase** | 2 — Core Backup Engine |
| **Severity** | 🟡 MEDIUM |
| **Area** | Architecture |
| **Status** | MONITORING |
| **Validation Target** | Phase 2 performance testing |

**Description:**
SQLite in WAL (Write-Ahead Logging) mode supports concurrent reads but serializes all writes through a single writer lock. During large backup jobs, the engine will generate a high volume of `file_entry` inserts as it catalogs the file tree. If each insert is committed individually, the write throughput will be severely bottlenecked by filesystem sync operations.

**Potential Impact:**
- Backup catalog phase becomes the bottleneck instead of I/O.
- UI progress indicators stall while waiting for database writes.
- Large backups (100,000+ files) take disproportionately long.

**Mitigation Strategy:**
- Batch inserts within explicit transactions — target 1,000 rows per transaction.
- Use prepared statements with parameter binding to avoid query parsing overhead.
- Configure `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL` for the backup database.
- Consider `PRAGMA cache_size=-64000` (64 MB cache) for large operations.

**Verification Notes:**
To be validated during Phase 2 performance testing with the following benchmark:

```
Target: Insert 100,000 file_entry rows in under 5 seconds on NVMe storage.
Method: Batch insert with 1,000-row transactions.
Baseline: Single-row inserts (expected ~50 inserts/sec without batching).
```

---

### RISK-002: FastCDC Chunk Size vs Dedup Ratio Tradeoff

| Field | Value |
|---|---|
| **ID** | RISK-002 |
| **Phase** | 2 — Core Backup Engine |
| **Severity** | 🟢 LOW |
| **Area** | Architecture |
| **Status** | MONITORING |
| **Validation Target** | Phase 2 with representative file sets |

**Description:**
The content-defined chunking configuration uses the following parameters:

| Parameter | Value |
|---|---|
| Minimum chunk size | 4 KB |
| Average chunk size | 16 KB |
| Maximum chunk size | 64 KB |

These values balance deduplication ratio against metadata overhead. The tradeoff is:

- **Smaller chunks** → Better deduplication ratio (more shared chunks between versions) but significantly more chunk metadata records in SQLite and more small files in the chunk store.
- **Larger chunks** → Less metadata overhead and fewer chunk store files, but reduced deduplication effectiveness, especially for small edits in large files.

**Potential Impact:**
- Suboptimal chunk sizes could reduce storage savings by 20–40% compared to tuned values.
- Excessive metadata for very small chunks could slow the chunk lookup index.

**Mitigation Strategy:**
- Run dedup benchmarks against representative file type distributions:
  - Office documents (.docx, .xlsx, .pptx)
  - Source code repositories
  - Photo libraries (JPEG, RAW)
  - Video files (MP4, MOV)
- Provide per-profile chunk size overrides if different backup targets benefit from different settings.

**Verification Notes:**
To be validated with representative file sets in Phase 2. Benchmark will measure:

```
Metric: Dedup ratio = (logical size - physical size) / logical size
Target: ≥ 60% dedup ratio on second backup of a modified source code repository.
Target: ≥ 30% dedup ratio on second backup of a photo library with minor edits.
```

---

### RISK-003: Windows File System Watcher Reliability

| Field | Value |
|---|---|
| **ID** | RISK-003 |
| **Phase** | 5 — Continuous Backup & Scheduling |
| **Severity** | 🟡 MEDIUM |
| **Area** | Platform |
| **Status** | MONITORING |
| **Validation Target** | Phase 5 integration testing |

**Description:**
The Windows `ReadDirectoryChangesW` API, which powers file system watchers (including the `notify` Rust crate), has known reliability limitations:

1. **Buffer overflow** — When the internal buffer fills up during bursts of file activity (e.g., `npm install`, large git operations), events are silently dropped. The API signals an overflow but does not replay missed events.
2. **Network drives** — File system notifications are unreliable or unavailable on network-mapped drives (SMB/CIFS).
3. **Recursive watching** — Deep directory trees increase memory usage and may hit system limits on the number of watched handles.
4. **Short-lived files** — Temporary files created and deleted within the notification polling interval may never be reported.

**Potential Impact:**
- Continuous backup mode misses file changes, leading to incomplete backup snapshots.
- Users believe files are protected when they are not captured.
- Silent data loss in the backup record.

**Mitigation Strategy:**
- Implement a **periodic reconciliation scan** as a safety net — a lightweight full-tree walk that runs every 15–30 minutes to catch any events missed by the watcher.
- Use the `notify` crate with `RecommendedWatcher` and configure an appropriately large buffer (64 KB minimum).
- Detect and report buffer overflow events to the user via the notification system.
- For network drives, fall back to polling mode with a configurable interval (default: 60 seconds).
- Log all watcher errors and overflow events for diagnostics.

**Verification Notes:**
Mitigation planned in Phase 5 with the following test scenarios:

```
Test 1: Create 10,000 files in rapid succession — verify all are captured (via watcher or reconciliation).
Test 2: Simulate buffer overflow — verify reconciliation scan recovers missed events.
Test 3: Monitor a network drive — verify polling fallback activates automatically.
```

---

## Changelog

| Date | ID | Change |
|---|---|---|
| 2025-07-14 | ISS-001 | Logged during Phase 0 environment check. MSVC Build Tools missing. |
| 2025-07-14 | ISS-002 | Logged during Phase 0 environment check. GNU toolchain is default. |
| 2025-07-14 | ISS-003 | Logged during Phase 0 environment check. Deferred to Phase 6. |
| 2025-07-14 | RISK-001 | Logged during architecture review. SQLite write batching required. |
| 2025-07-14 | RISK-002 | Logged during architecture review. Chunk size tuning needed. |
| 2025-07-14 | RISK-003 | Logged during architecture review. Watcher reliability mitigation planned. |
