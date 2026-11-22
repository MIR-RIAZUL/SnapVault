# SnapVault — Product Brief

> **Confidential — Product Strategy & Specification Document**  
> **Product Name:** SnapVault  
> **Tagline:** Your files, your drives, your time machine. 100% offline.  
> **Platform:** Windows 11 Desktop (64-bit x86 / ARM64 via Tauri 2 & WebView2)  
> **Distribution:** Microsoft Store ($19.99 one-time purchase · 14-day full-featured trial)  
> **Core Architecture:** Local-First, Zero-Cloud, Zero-Telemetry, Content-Addressed Visual Backup  

---

## 1. Executive Summary & Product Vision

Every year, millions of Windows users lose irreplaceable data—family photos, client deliverables, code repositories, financial records, and creative projects—despite having external hard drives sitting plugged into their desks.

The fundamental reason is simple: **Windows backup software is broken.**

- **Windows File History** is notoriously unreliable: it silently stops running without alert, fails on long paths or locked files, lacks an intuitive visual timeline, and leaves users guessing whether their backups actually work.
- **Cloud Backup Services (Backblaze, Carbonite, OneDrive, Dropbox)** charge **$65 to $150+ every single year**, require fast symmetrical internet, upload private personal documents to remote corporate servers, and lock users out of their data the moment a credit card expires.
- **Enterprise Disk Imaging Tools (Macrium Reflect, Veeam, Acronis)** are complex, intimidating for non-technical users, consume entire drives with monolithic proprietary image files, and take hours just to recover a single overwritten spreadsheet.

On macOS, Apple solved this problem in 2007 with **Time Machine**: an automatic, visual, delightful backup experience that lets users "turn back the clock" and browse any folder as it appeared at any point in history.

**SnapVault brings the Time Machine experience to Windows 11—and makes it better.**

SnapVault is a 100% offline, local-first visual backup desktop application. It combines:
1. The **instant, tactile visual timeline scrubber** made famous by Time Machine.
2. Modern **BLAKE3-powered content-defined deduplication (FastCDC)**, storing hundreds of point-in-time snapshots in a fraction of the disk space.
3. **Four gap-closing killer features** that eliminate the primary failure modes of existing backup tools: silent failure, mid-write drive disconnects, ransomware destruction, and proprietary vendor lock-in.
4. An honest, user-respecting business model: **$19.99 one-time purchase on the Microsoft Store, a 14-day free trial, zero subscriptions, zero cloud dependencies, and a permanent guarantee that restore functionality never expires.**

---

## 2. Target Users & Personas

SnapVault targets Windows 11 users who value privacy, control, reliability, and visual clarity over complex enterprise consoles or recurring cloud subscriptions.

### Primary Persona 1: The Frustrated Freelancer
- **Name:** Marcus Vance, 38
- **Role:** Independent Architectural Designer & CAD Consultant
- **Hardware:** Windows 11 Workstation with 2TB NVMe + 4TB External USB-C Drive
- **Pain Point:** Marcus lost three days of client CAD revisions when Windows File History silently encountered a locked file error two months prior and ceased running without displaying any warning banner. When he needed a version from last Tuesday, the backup did not exist.
- **How SnapVault Wins:** Marcus pairs his `D:\Projects` drive to his external SSD. SnapVault's **Silent-Failure Guard** verifies restore integrity weekly and alerts him via Windows toast notification if any backup fails. The **Visual Timeline** allows him to scrub back to Tuesday at 3:15 PM and restore the exact `.dwg` file in two clicks.

### Persona 2: The Privacy-Conscious Creative Professional
- **Name:** Elena Rostova, 29
- **Role:** Commercial Photographer & Content Creator
- **Hardware:** Windows 11 Laptop + 8TB Home NAS
- **Pain Point:** Elena manages 6TB of RAW camera files (`.ARW`, `.CR3`). Cloud backup services demand expensive bandwidth and quote 45 days for initial upload. Subscription fees continually escalate, and she refuses to upload unreleased client shoots to third-party cloud infrastructure.
- **How SnapVault Wins:** SnapVault operates **100% offline with zero outbound network calls**. Block-level deduplication recognizes identical raw asset chunks across project folders. Elena backs up across her local network to her NAS at line-rate multi-gigabit speeds, paying a single $19.99 license once.

### Persona 3: The Everyday Windows Home Power User
- **Name:** David Chen, 52
- **Role:** Financial Analyst & Family Archivist
- **Hardware:** Windows 11 Desktop + External 2TB WD My Passport
- **Pain Point:** David accidentally unplugged his backup drive while transferring files, which corrupted his previous backup tool's catalog and required a complete reformat. He also fears modern ransomware encrypting his computer and destroying his backups simultaneously.
- **How SnapVault Wins:** SnapVault's **Unplug-Safe Atomic Engine** guarantees that pulling the USB cable mid-backup causes zero catalog corruption—the snapshot remains cleanly flagged as `INTERRUPTED`, and automatically resumes when reconnected. The **Ransomware Tripwire Safety Brake** detects abnormal mass file modifications and halts backup before malicious encrypted files overwrite healthy snapshots.

---

## 3. Core Feature Specification

### 3.1 Intuitive Folder & Drive Pairing
- **Zero-Friction Wizard:** Select source directories (e.g., `C:\Users\Username\Documents`, `D:\Creative`) and choose a backup destination (USB external drive, secondary internal SATA/NVMe drive, or network share / NAS mount).
- **Auto-Discovery:** Automatically detects attached removable drives and persistent network shares.
- **Storage Intelligence Preview:** Before initial backup, displays total source size, estimated initial backup duration, and real-time disk space available on the target drive.

### 3.2 BLAKE3-Deduplicated Incremental Snapshots
- **Content-Defined Chunking (FastCDC):** Files are segmented into dynamic, variable-length chunks (minimum 4 KB, average 16 KB, maximum 64 KB). This ensures that inserting data into the middle of a file only invalidates the specific affected chunks, rather than the entire file.
- **Cryptographic Speed with BLAKE3:** Every chunk is hashed using BLAKE3 (yielding multi-GB/s throughput on modern AVX-512 / AVX2 processors). Chunks are indexed in local SQLite metadata.
- **Global Deduplication:** If ten folders contain the same 500 MB video or duplicate asset libraries, the chunk data is physically stored exactly once in `.snapvault/chunks/`. Subsequent snapshots store only changed chunks and metadata diffs.

### 3.3 The Visual "Time Machine" Timeline Scrubber
- **Temporal Navigation Bar:** A smooth, reactive horizontal timeline positioned at the base of the UI displaying every point-in-time snapshot categorized by hour, day, week, and month.
- **Live Folder Time-Travel:** Moving the scrubber instantly updates the file explorer pane to reflect the exact filesystem state at that historical moment.
- **Deleted File Visibility:** Files deleted in the present day remain clearly visible in historical snapshots with distinct styling, allowing instantaneous recovery.

### 3.4 Side-by-Side Diff & File Preview
- **Integrated Text Diffing:** Compare any two versions of a source code file, configuration file, or Markdown document with side-by-side split view, line-by-line additions, deletions, and inline modifications.
- **Visual Image Inspection:** Compare image revisions (PNG, JPG, WEBP, BMP, SVG) with split-slider overlay, side-by-side zoom synchronization, and metadata comparison (dimensions, file size, EXIF modification timestamps).
- **One-Click In-Place or Alternate-Path Restore:** Restore a file directly to its original location (with confirmation dialog) or export to a chosen target folder without touching the current working directory.

### 3.5 Quiet Tray Mode & Intelligent Scheduling
- **Minimalist Windows 11 System Tray Presence:** Runs quietly in the notification area with a lightweight footprint (< 60 MB RAM in idle tray mode).
- **Dynamic Status Indicator:** Tray icon badge dynamically reflects status: idle checkmark (healthy), animated pulse (backing up), warning amber (drive disconnected / health check pending), and red alert (tripwire triggered).
- **Configurable Cadence:** Choose between:
  - *Continuous Watching:* File system change events trigger incremental commits within 60 seconds of inactivity.
  - *Interval Scheduling:* Every 15 minutes, 30 minutes, 1 hour, or 4 hours.
  - *Daily/Weekly Scheduled Runs:* Run during lunch or overnight.
  - *Manual Mode:* Backup triggers only on user request.

### 3.6 Grandfather-Father-Son (GFS) Retention Policy
SnapVault automatically maintains a clean, non-bloated snapshot history using industry-standard GFS pruning:
- **Hourly Snapshots:** Retained for the last 24 hours.
- **Daily Snapshots:** Retained for the last 30 days.
- **Weekly Snapshots:** Retained forever (or until user-defined storage thresholds trigger oldest-snapshot pruning).
- **Automatic Garbage Collection:** When snapshots are pruned, an asynchronous garbage collection pass identifies unreferenced BLAKE3 chunks and safely reclaims disk space.

---

## 4. The 4 Gap-Closing Killer Features

These four innovations solve the critical vulnerabilities that cause traditional Windows backup tools to fail users in real-world emergencies.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE 4 GAP-CLOSING KILLER FEATURES                    │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 1. SILENT-FAILURE GUARD          │ 2. UNPLUG-SAFE ATOMIC ENGINE        │
│ Automated weekly proof-of-       │ Atomic writes (.tmp → sync → rename)│
│ restore drills test chunk hashes │ survive mid-backup USB disconnections│
│ before disaster strikes.         │ with zero catalog corruption.       │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 3. RANSOMWARE SAFETY BRAKE       │ 4. MULTI-DRIVE ROTATION & MIRROR    │
│ Mass-deletion & rapid encryption │ Rotate home & office drives safely; │
│ tripwire halts backups before    │ plain-file Emergency Mirror mode    │
│ damaged files overwrite history. │ readable on any PC with zero tools. │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### 4.1 Silent-Failure Guard & Automated Weekly Proof-of-Restore
- **The Problem:** The most dangerous failure in backup systems is the **silent failure**. Backups report "Success" for months, but when an emergency occurs, the user discovers the storage media suffered bit-rot, the catalog database corrupted, or encryption headers became unreadable.
- **SnapVault's Solution:** Once every 7 days (or immediately on user demand), SnapVault's background engine conducts an automated **Proof-of-Restore Verification Drill**:
  1. The engine pseudorandomly samples a representative batch of files across recent snapshots (including high-entropy binaries, nested directories, and large files).
  2. It reconstitutes the files into an isolated sandbox temporary directory (`%LOCALAPPDATA%\SnapVault\TempVerify\`).
  3. It streams each restored file through the BLAKE3 engine and compares the computed digest against the immutable record in the SQLite database.
  4. If all digests match, it logs a cryptographically verified `PASS` certificate with timestamp, recorded in the `health_checks` table.
  5. If any chunk is corrupted or missing, it **immediately triggers a high-priority Windows 11 Toast Notification** and presents an interactive remediation wizard with exact file paths affected.

### 4.2 Unplug-Safe Atomic Engine
- **The Problem:** Users disconnect USB drives without clicking "Safely Remove Hardware," laptops run out of battery mid-transfer, and home Wi-Fi drops while writing to a NAS. Traditional backup programs leave partially written database journals, corrupted chunk files, and orphaned headers.
- **SnapVault's Solution:** Every disk write in SnapVault obeys strict transactional atomic semantics:
  1. Chunks are initially written to staging files bearing a `.tmp.[uuid]` extension.
  2. Data is explicitly flushed to physical media using OS-level cache sync (`FlushFileBuffers` on Windows / Rust `std::fs::File::sync_all`).
  3. The file is atomically renamed into its final content-addressed path (`.snapvault/chunks/xx/yy/zz...`).
  4. Snapshot state transitions follow an explicit state machine: `PENDING` → `COMMITTED`. If a power drop or drive removal occurs, the snapshot state remains `INTERRUPTED`.
  5. Upon reconnecting the drive, SnapVault detects the `INTERRUPTED` state, cleans up uncommitted `.tmp` files, verifies all previously committed chunks, and resumes snapshot creation without starting over from scratch.

### 4.3 Ransomware & Mass-Deletion Tripwire ("Safety Brake")
- **The Problem:** Modern ransomware operates by silently encrypting thousands of user documents in minutes. If a continuous backup system is running, it dutifully detects "file modifications" and backs up the encrypted, unrecoverable files, purging healthy previous versions to satisfy retention quotas.
- **SnapVault's Solution:** SnapVault acts as an intelligent heuristic tripwire:
  1. Before committing any snapshot, the engine evaluates the **Modification & Deletion Velocity Ratio**:
     $$\text{Volatility Ratio} = \frac{\text{Changed Files} + \text{Deleted Files}}{\text{Total Watched Files}}$$
  2. If more than a configurable threshold (default: **30% of total files**, or more than **500 files** in a single cycle) are modified or deleted within a short window, the **Safety Brake locks immediately**.
  3. Backup processing halts. The snapshot is marked `TRIPWIRE_PAUSED`.
  4. A prominent alert modal and modal system warning display:
     > *"⚠️ SnapVault Safety Brake Triggered: Unusual file volatility detected (1,420 files changed or deleted in 3 minutes). Backup has been paused to prevent potential ransomware or accidental mass-deletion from overwriting your healthy history."*
  5. The user is presented with a complete diff list and must enter explicit confirmation ("Proceed with Backup" vs. "Halt & Investigate") before any snapshot commit can occur.

### 4.4 Multi-Drive Rotation + Plain-File Emergency Mirror Mode
- **The Problem:** Following the 3-2-1 backup rule requires having backups on separate physical media (e.g., Drive A kept at home, Drive B stored in the car or office). Most consumer backup software binds rigidly to a single drive UUID and throws cryptic errors when drives are swapped. Furthermore, proprietary container formats lock users out if they don't have the backup software installed on the computer they are restoring to.
- **SnapVault's Solution:**
  - **Drive Rotation Intelligence:** Users can pair multiple destination drives under the same backup job (e.g., "Drive A - Red Passport" and "Drive B - Blue SanDisk"). SnapVault recognizes each drive by volume GUID, tracks independent snapshot checkpoints on each drive, and seamlessly resumes backups onto whichever drive is currently connected.
  - **Plain-File Emergency Mirror Mode:** In addition to the deduplicated chunk store, users can toggle "Emergency Mirror Mode" for designated critical folders. This maintains a mirror of files in plain, uncompressed, unchunked standard Windows folder structures on the target drive. If the user's main PC completely burns down, they can plug their backup drive into any standard PC, Mac, or Linux machine and instantly double-click their documents in Windows Explorer without installing SnapVault or any recovery utility.

---

## 5. Monetization & Trust Model

### 5.1 Pricing & Microsoft Store Distribution
- **One-Time Purchase:** **$19.99 USD** (flat, lifetime license for personal use across up to 3 PCs associated with the user's Microsoft Account).
- **Zero Subscriptions:** No recurring monthly or annual fees. No upsells for storage, features, or bandwidth.
- **14-Day Full-Featured Trial:** Fully functional for 14 days without feature gating. Users experience the complete application including scheduled backups, deduplication, and visual timeline scrubbing.
- **Gentle Day 12 Reminder:** A polite, non-modal banner appears on day 12 informing the user of trial status with a direct link to purchase on the Microsoft Store.

### 5.2 The Permanent Restore Guarantee (Zero Lock-In)
- **Data Sovereignty Covenant:** Even if the 14-day trial expires and the user chooses not to purchase a license, **SnapVault NEVER locks users out of restoring their data.**
- **Post-Trial Behavior:**
  - Snapshot creation and scheduled backups are paused.
  - The Visual Timeline Scrubber, File Explorer, Diff Viewer, and **ALL Restore features remain 100% active and free forever.**
  - Users can restore single files, historical revisions, or complete directory trees at any time with zero payment requirement.
- **Standalone Open-Source CLI Tool:** We commit to publishing a lightweight, standalone, open-source Rust CLI utility (`snapvault-extract`) that can read any `.snapvault` directory structure and restore files directly from the command line, guaranteeing readability even if SnapVault as a company ceased to exist.

### 5.3 100% Offline & Absolute Privacy
- **Zero Telemetry:** The compiled production binary contains zero analytics SDKs, zero tracking pixels, and zero diagnostic pings.
- **Air-Gapped Operation:** SnapVault operates flawlessly in fully air-gapped environments without an internet connection.
- **No Account Required:** No username, password, email address, or third-party OAuth login. License verification is handled natively by the Windows 11 Microsoft Store API.

---

## 6. Competitive Landscape & Comparison

The following table demonstrates SnapVault's unique market positioning against incumbent solutions:

| Feature / Attribute | Windows File History | Backblaze / Carbonite | Macrium Reflect Home | Veeam Agent Free | SnapVault |
|---|:---:|:---:|:---:|:---:|:---:|
| **Pricing Model** | Included with Windows | \$65–\$99 / year | \$79.99 one-time | Free (Enterprise Upsell) | **\$19.99 One-Time** |
| **100% Offline & Private** | ✅ Yes | ❌ No (Cloud-only) | ✅ Yes | ✅ Yes | **✅ Yes (Zero Telemetry)** |
| **Time Machine Visual Scrubber** | ❌ Primitive / Clunky | ❌ Web download only | ❌ None | ❌ None | **✅ Smooth Native Timeline** |
| **Block-Level Deduplication** | ❌ No (Full Copies) | ✅ Yes (Remote) | ❌ Proprietary Image | ❌ Proprietary VBK | **✅ FastCDC + BLAKE3** |
| **Silent-Failure Proof-of-Restore**| ❌ No (Fails silently) | ❌ No | ❌ Manual verification | ❌ Manual mount test | **✅ Automated Weekly Drill** |
| **Unplug-Safe Atomic Writes** | ❌ Prone to corruption | N/A (Network) | ❌ Image corruption | ❌ VBK lock crash | **✅ Atomic .tmp → sync** |
| **Ransomware Safety Brake** | ❌ None (Backs up crypts)| ❌ Limited 30-day | ❌ None (Images corrupted)| ❌ None | **✅ Velocity Tripwire** |
| **Permanent Free Restore** | ✅ Yes | ❌ Cut off on non-payment | ✅ Yes | ✅ Yes | **✅ Guaranteed Forever** |
| **Plain-File Emergency Mirror** | ❌ Clunky timestamps | ❌ None | ❌ None (Needs Macrium) | ❌ None (Needs Veeam) | **✅ Native Plain Files** |
| **Windows 11 Fluent UI** | ❌ Legacy Control Panel | ❌ Outdated Java/Web | ❌ Legacy Win32 Form | ❌ Enterprise Win32 | **✅ Modern Fluent React** |

---

## 7. Strategic Success Criteria

| Milestone | Target Objective | Timeline |
|---|---|---|
| **Phase 0** | Governance & Architecture Specification | Inception |
| **Phase 1** | Tauri 2 + SQLite Engine Scaffolding | Milestone 1 |
| **Phase 2** | Chunking, Hashing & Atomic Backup Engine | Milestone 2 |
| **Phase 3** | Visual Timeline UI & Instant Restore Engine | Milestone 3 |
| **Phase 4** | The 4 Killer Features (Guard, Tripwire, etc.) | Milestone 4 |
| **Phase 5** | Tray Daemon, Scheduler & Microsoft Store Polish | Milestone 5 |
| **Phase 6** | MSIX Packaging, WACK Certification & Store Launch | Launch (v1.0) |

---
*Document approved for SnapVault Product Architecture & Engineering Governance.*
