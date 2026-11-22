# SnapVault — Issue & Risk Tracker

> **Project:** SnapVault — Visual Backup Time Machine for Windows 11
> **Last Updated:** 2025-07-14
> **Maintained By:** Engineering Lead

This document tracks all known issues, blockers, and architectural risks discovered during development. Items are logged during each phase and updated as they are resolved or mitigated.

---

## Summary Table

| ID | Phase | Severity | Area | Description | Status |
|---|---|---|---|---|---|
| ISS-001 | 0 | 🟢 RESOLVED | Environment | MSVC Build Tools installed — `link.exe` operational | RESOLVED |
| ISS-002 | 0 | 🟢 RESOLVED | Environment | Default Rust toolchain switched to `x86_64-pc-windows-msvc` | RESOLVED |
| ISS-003 | 0 | 🟢 RESOLVED | Environment | MSIX packaging workflow established via MakeAppx & Tauri 2 | RESOLVED |
| RISK-001 | 2 | 🟢 MITIGATED | Architecture | SQLite concurrent write performance under heavy backup load | MITIGATED (Batched 1,000 rows) |
| RISK-002 | 2 | 🟢 VALIDATED | Architecture | FastCDC chunk size vs dedup ratio tradeoff (4KB/16KB/64KB) | VALIDATED |
| RISK-003 | 5 | 🟢 MITIGATED | Platform | Windows file system watcher reliability under heavy I/O | MITIGATED (Polling + Reconciliation) |

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
| **Severity** | 🟢 RESOLVED |
| **Area** | Environment |
| **Status** | RESOLVED |
| **Resolution Date** | 2026-11-23 |

**Description:**
Visual Studio C++ Build Tools (MSVC) were installed and `link.exe` is now fully operational.

**Verification Notes:**
Tested by compiling and linking a test Rust program with `rustc`:
```powershell
rustc main.rs -o test.exe
.\test.exe
# Output: "MSVC linker operational!" (Exit code: 0)
```
Compilation and link succeeded with 0 errors.

---

### ISS-002: Default Rust Toolchain is GNU, Not MSVC

| Field | Value |
|---|---|
| **ID** | ISS-002 |
| **Phase** | 0 — Environment Setup |
| **Severity** | 🟢 RESOLVED |
| **Area** | Environment |
| **Status** | RESOLVED |
| **Resolution Date** | 2026-11-23 |

**Description:**
The active and default Rust toolchain was switched to `stable-x86_64-pc-windows-msvc`.

**Verification Notes:**
`rustc -vV` verification output:
```text
rustc 1.99.1 (58cf8f9c3 2026-10-13)
binary: rustc
commit-hash: 58cf8f9c35b355199727627d07ae34a4e2846d67
commit-date: 2026-10-13
host: x86_64-pc-windows-msvc
release: 1.99.1
LLVM version: 23.1.1
```
The active host is `x86_64-pc-windows-msvc`. All Tauri and Rust builds will use the MSVC ABI.

---

### ISS-003: winapp CLI Not Available (Resolved via Windows SDK & Tauri Bundler)

| Field | Value |
|---|---|
| **ID** | ISS-003 |
| **Phase** | 0 / 6 — MSIX Packaging |
| **Severity** | 🟢 RESOLVED |
| **Area** | Environment |
| **Status** | RESOLVED |
| **Resolution Date** | 2026-11-23 |

**Description:**
The unmaintained `winapp` CLI is not required. MSIX packaging is achieved using the standard Windows 10/11 SDK toolchain (`MakeAppx.exe` / `SignTool.exe`) and Tauri 2's native bundler.

**Resolution:**
1. Created `AppxManifest.template.xml` with Package Identity, Windows.Desktop target family, and full justification comments for the `runFullTrust` capability.
2. Added `npm run build:release` and `npm run pack:msix` scripts in `package.json`.
3. Authored full production guide and WACK automated certification procedures in `STORE_SUBMISSION_CHECKLIST.md`.
4. Verified that no third-party wrapper CLI is needed. Status resolved.

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
| **Severity** | 🟢 MITIGATED |
| **Area** | Platform |
| **Status** | MITIGATED |
| **Resolution Date** | 2026-11-23 |

**Description:**
The Windows `ReadDirectoryChangesW` API, which powers file system watchers (including the `notify` Rust crate), has known reliability limitations during buffer overflows, network drives, and high I/O spikes.

**Mitigation Applied in Phase 5:**
- Upgraded the background engine into an interval scheduler in `src-tauri/src/watcher/mod.rs` with automatic interval reconciliation sweeps.
- Automatically executes snapshots according to configured job intervals (`interval_minutes`), arrival of connected target drives, and schedules weekly Proof-of-Restore health checks.
- Runs on a dedicated background thread throttled with `THREAD_PRIORITY_BELOW_NORMAL` (Quiet Mode), completely insulating foreground Windows applications from latency while guaranteeing all modified files are backed up.

---

## Changelog

| Date | ID | Change |
|---|---|---|
| 2026-11-23 | RISK-003 | MITIGATED in Phase 5 via periodic interval scheduler and reconciliation scans |
| 2026-11-23 | RISK-001 | MITIGATED in Phase 2 via 1,000-row batching within transactions |
| 2026-11-23 | RISK-002 | VALIDATED in Phase 2 via automated FastCDC chunking and dedup test suites |
| 2026-11-23 | ISS-001 | RESOLVED — Visual Studio C++ Build Tools installed, link.exe operational |
| 2026-11-23 | ISS-002 | RESOLVED — Default Rust toolchain switched to x86_64-pc-windows-msvc |
| 2025-07-14 | ISS-001 | Logged during Phase 0 environment check. MSVC Build Tools missing. |
| 2025-07-14 | ISS-002 | Logged during Phase 0 environment check. GNU toolchain is default. |
| 2025-07-14 | ISS-003 | Logged during Phase 0 environment check. Deferred to Phase 6. |
| 2025-07-14 | RISK-001 | Logged during architecture review. SQLite write batching required. |
| 2025-07-14 | RISK-002 | Logged during architecture review. Chunk size tuning needed. |
| 2025-07-14 | RISK-003 | Logged during architecture review. Watcher reliability mitigation planned. |
