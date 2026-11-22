# SnapVault — Microsoft Store Listing Copy

## Product Overview
- **App Name:** SnapVault - Visual Backup Time Machine
- **Category:** Utilities & Tools > Backup & Sync
- **Publisher:** SnapVault
- **Monetization Model:** $19.99 One-Time Purchase
- **Trial Policy:** 14-Day Full-Featured Free Trial
- **Permanent Restore Guarantee:** If the trial expires or the app is uninstalled, all visual browsing, file previews, diffs, and restore operations remain **100% UNLOCKED FOREVER** with zero restrictions. No user data is ever held hostage.

---

## Store Metadata

### Short Description (< 100 characters)
> 100% offline visual backup and Time Machine for Windows 11. Deduplication and instant restore.

### Subtitle (Search Tagline)
> Content-Addressed Visual Backup, FastCDC Deduplication & Ransomware Protection for Windows 11.

### Target Audience
- Photographers, software developers, videographers, and creators working with large local asset libraries.
- Privacy-conscious professionals demanding 100% offline local storage with zero cloud dependencies.
- Everyday Windows 11 users who want the intuitive, beautiful timeline navigation of macOS Time Machine on PC.

### Keywords / Search Terms
`backup`, `time machine`, `windows 11 backup`, `deduplication`, `fastcdc`, `blake3`, `offline backup`, `local backup`, `ransomware protection`, `file recovery`, `file versioning`, `drive backup`, `usb backup`, `disaster recovery`

---

## Full Description

**SnapVault** brings the legendary elegance and effortless confidence of macOS Time Machine natively to Windows 11. Built with modern Windows 11 Fluent Design, Rust, and local SQLite, SnapVault delivers lightning-fast, content-addressed file versioning with zero cloud lock-in, zero subscription fees, and absolute privacy.

Whether you plug in an external USB SSD or back up to a secondary internal drive, SnapVault protects your work silently in the background.

### Why Choose SnapVault?

- **Zero Cloud Lock-in, 100% Offline Privacy**: SnapVault contains zero analytics, zero trackers, and zero network calls. Your files never touch external servers or third-party clouds.
- **Smart Space Savings with FastCDC**: Our variable-block FastCDC deduplication engine breaks files into 4KB–64KB chunks and hashes them with BLAKE3. If 10 files share identical content or a 1GB video is renamed, SnapVault stores that data only once, saving up to 70% disk space.
- **Unplug-Safe Atomic Snapshots**: Disconnecting your external drive in the middle of a backup will **never** corrupt your catalog. SQLite Write-Ahead Logging (WAL) and atomic chunk renames guarantee that your backup repository remains mathematically coherent.
- **Interactive Visual Time Machine**: Need a file from last Tuesday at 3:15 PM? Simply drag the interactive timeline slider to jump back through time. Inspect directory trees, preview code and documents side-by-side, view photo diffs, and restore with one click.
- **Ransomware & Mass-Deletion Tripwire**: If malware encrypts your files or a script accidentally wipes a folder, SnapVault detects high volatility (>20% modifications), locks prior clean snapshots, halts the backup cycle, and alerts you before damage spreads.
- **Automated Proof-of-Restore Verification**: Backups you can't restore are useless. SnapVault continuously verifies chunk hashes in the background to detect silent bit-rot and ensure your files are genuinely recoverable.
- **Plain-File Emergency Mirror**: Your backup destination includes a mirror folder containing your latest files in plain, uncompressed Windows File Explorer format. If you need a file on another PC that doesn't have SnapVault installed, just plug in the drive and open it directly.

---

## 7 Key Features

1. **Visual Time Machine Scrubber**: Glide smoothly across chronological snapshots with an intuitive timeline slider, dual-pane diff comparison, and instant single-file or folder restore.
2. **FastCDC Chunk Deduplication**: Content-addressed variable-length chunking (4KB/16KB/64KB) backed by ultra-fast BLAKE3 cryptographic hashing slashes storage consumption without slowing down your PC.
3. **100% Offline & Zero Telemetry**: Operates completely air-gapped with zero internet connectivity. No cloud accounts, no recurring monthly subscriptions, and no telemetry pings.
4. **Unplug-Safe Atomic Commits**: Fully resilient against sudden USB disconnections, power outages, and system restarts. Completed snapshots remain 100% valid.
5. **Ransomware Safety Brake Tripwire**: Real-time volatility monitoring triggers an immediate emergency pause if unexpected mass deletions or file encryptions are detected.
6. **Automated Proof-of-Restore**: Background health checks regularly reconstruct and verify random sample files against their original hashes to guarantee restore readiness.
7. **Plain-File Emergency Mirror**: Automatically maintains a zero-software emergency clone on your backup drive, accessible instantly on any machine via Windows File Explorer.

---

## Transparent Pricing & The Permanent Restore Guarantee

- **14-Day Full-Featured Free Trial**: Enjoy every feature with zero limitations.
- **$19.99 One-Time Purchase**: Lifetime license to create unlimited backups across all your drives.
- **The Permanent Restore Guarantee**: If your trial ends, we will **never** lock you out of your data. Visual timeline browsing, file previews, diffs, and complete restore operations remain **100% free and unlocked forever**.

---

## Technical Specifications
- **Operating System:** Windows 11 (64-bit) / Windows 10 (Build 19041+)
- **Architecture:** x64
- **Engine:** Rust, FastCDC, BLAKE3, SQLite WAL mode
- **UI Framework:** Tauri 2, React 18, Tailwind CSS, Lucide Icons
- **Performance:** Native multi-threaded chunking with automatic Quiet Mode CPU throttling (`THREAD_PRIORITY_BELOW_NORMAL`)
