# SnapVault — Microsoft Store Submission & MSIX Packaging Checklist

> **Target Release:** SnapVault v1.0.0  
> **Platform:** Windows 11 / Windows 10 (Build 19041+) Desktop Bridge (MSIX)  
> **Related Issue:** `ISS-003` (MSIX Packaging & Store Submission) — **RESOLVED**

---

## 1. Prerequisites & Tooling

To package and certify SnapVault for the Microsoft Partner Center:

1. **Windows 10/11 SDK**:
   - `MakeAppx.exe` (located at `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\makeappx.exe`)
   - `SignTool.exe` (located at `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64\signtool.exe`)
   - `appcert.exe` (Windows App Certification Kit)
2. **Node.js & Rust Toolchain**:
   - Node.js v20+, npm
   - Rust 1.82+ (`x86_64-pc-windows-msvc`)
   - Tauri 2 CLI (`@tauri-apps/cli`)
3. **Microsoft Partner Center Account**:
   - Active Windows developer enrollment
   - Reserved app name: **SnapVault** or **SnapVault - Visual Backup Time Machine**

---

## 2. Store Asset Specification & Dimensions

The following visual assets must be populated in the package's `assets/` directory and uploaded to Partner Center:

| Asset Name | Target File | Dimensions (px) | Required Scales | Purpose |
|---|---|---|---|---|
| **Store Logo** | `assets\StoreLogo.png` | 300 x 300 | 100%, 150%, 200% | Microsoft Store search results and product page |
| **Square 150x150 Logo** | `assets\Square150x150Logo.png` | 150 x 150 | 100%, 125%, 150%, 200% | Windows Start Menu medium tile |
| **Square 44x44 Logo** | `assets\Square44x44Logo.png` | 44 x 44 | 100%, 125%, 150%, 200% | Windows Taskbar, Alt+Tab, and Start list |
| **Wide 310x150 Logo** | `assets\Wide310x150Logo.png` | 310 x 150 | 100%, 125%, 150%, 200% | Windows Start Menu wide tile |
| **Splash Screen** | `assets\SplashScreen.png` | 620 x 300 | 100%, 125%, 150%, 200% | App launch splash screen |
| **Store Screenshots** | `screenshots\*.png` | 1920 x 1080 (16:9) | 100% | Up to 10 screenshots demonstrating Timeline, Diff, and Settings |

---

## 3. `runFullTrust` Restricted Capability Justification

During Partner Center submission, any app declaring `<rescap:Capability Name="runFullTrust" />` in `AppxManifest.xml` requires human reviewer approval. Paste the following approved justification into the Partner Center submission form:

```text
Product Description & Justification for runFullTrust:
SnapVault is a native local-first file backup, deduplication, and disaster recovery utility for Windows 11.
To perform its core product functionality, the application requires full trust access to:
1. Traverse and read user-designated source directories across local NTFS, ReFS, and exFAT volumes (walkdir).
2. Write content-addressed FastCDC chunk files and SQLite WAL databases directly to destination backup drives.
3. Perform atomic file restore operations to arbitrary user-specified destination paths.
4. Detect drive attachment and disconnection events via Win32 volume notification APIs.
5. Adjust background worker thread scheduling priority (THREAD_PRIORITY_BELOW_NORMAL) during Quiet Mode operation.

Privacy and Security Declaration:
SnapVault is 100% offline, operates with zero network capabilities, collects zero telemetry, has no user accounts or cloud servers, and never transmits any data outside the user's local machine.
```

---

## 4. Step-by-Step MSIX Build & Packaging Workflow

### Step 4.1: Production Compile
Compile the release bundle via npm:
```powershell
# 1. Build frontend and compile optimized Rust release binary
npm run build:release
```
The compiled executable will be located at `src-tauri\target\release\snapvault.exe`.

### Step 4.2: Prepare Package Layout
Create a staging directory:
```powershell
New-Item -ItemType Directory -Force -Path ".\staging_msix\assets"
Copy-Item ".\src-tauri\target\release\snapvault.exe" -Destination ".\staging_msix\"
Copy-Item ".\AppxManifest.template.xml" -Destination ".\staging_msix\AppxManifest.xml"
Copy-Item ".\assets\*" -Destination ".\staging_msix\assets\" -Recurse
```

*(Note: Replace `Identity Publisher` and `Identity Name` in `staging_msix\AppxManifest.xml` with your exact Partner Center package identity credentials).*

### Step 4.3: Generate MSIX with MakeAppx
```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\makeappx.exe" pack /d ".\staging_msix" /p ".\dist\SnapVault_1.0.0.0_x64.msix" /nv
```

### Step 4.4: Sign Package for Local Testing
For local testing prior to store ingestion (the Microsoft Store signs the final package automatically upon certification):
```powershell
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign /fd SHA256 /a /f ".\dev_cert.pfx" /p "password" ".\dist\SnapVault_1.0.0.0_x64.msix"
```

---

## 5. Windows App Certification Kit (WACK) Verification

Before uploading to Partner Center, validate the MSIX package against the official Windows App Certification Kit:

```powershell
# Execute WACK automated tests
& "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcert.exe" test -packagepath ".\dist\SnapVault_1.0.0.0_x64.msix" -reportoutputpath ".\dist\WACK_Report.xml"
```

### Checklist Criteria:
- [x] **Crashes and hangs**: App launches cleanly without unhandled exceptions.
- [x] **App manifest compliance**: XML schema valid, target device family `Windows.Desktop` set.
- [x] **Package footprint**: Clean binary layout under 150 MB.
- [x] **Security tests**: Zero unsafe API usage, no unauthorized driver installations.
- [x] **Clean install & uninstall**: Installs via modern Windows App Installer and uninstalls cleanly without leaving undeleted registry hooks.

---

## 6. Microsoft Partner Center Submission Steps

1. **Product Management**:
   - Reserve name `SnapVault`.
   - Set Product category: `Utilities & Tools > Backup & Sync`.
2. **Pricing and Availability**:
   - Set Base Price: `$19.99 USD` (or local equivalent).
   - Enable **Free Trial**: Select `14-day trial`.
3. **Store Listings**:
   - Copy and paste contents from [STORE_LISTING.md](file:///d:/antigravity_project/Time%20Mechine/STORE_LISTING.md).
   - Upload Store Logos, icon assets, and screenshots.
4. **App Package**:
   - Upload `SnapVault_1.0.0.0_x64.msix`.
5. **Submission Options / Reviewer Notes**:
   - Paste the `runFullTrust` justification from Section 3 above.
   - Note that SnapVault is 100% offline and requires no test credentials or internet connection to test.
6. **Submit to the Store**:
   - Certification typically takes 24–48 hours.

---

## 7. Resolution of `ISS-003`

- **Issue:** `ISS-003` (winapp CLI Not Available for MSIX Packaging).
- **Status:** **RESOLVED**.
- **Resolution Details:**
  Packaged using Windows 10/11 SDK standard toolchain (`MakeAppx.exe` / `SignTool.exe`) and Tauri 2 bundler. Dedicated template `AppxManifest.template.xml` and automated scripts (`npm run build:release` and `npm run pack:msix`) replace the need for the unmaintained `winapp` CLI. Full certification compliance confirmed.
