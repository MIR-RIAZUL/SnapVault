param(
    [string]$IdentityName = "MIRRIAZUL.SnapVault",
    [string]$Publisher = "CN=02CE872D-25C9-4BA8-B0C5-09F51245CDEC",
    [string]$PublisherDisplayName = "MIR RIAZUL",
    [string]$Version = "1.0.0.0"
)

$ErrorActionPreference = "Stop"

# Ensure Publisher starts with CN= if not provided
if (-not $Publisher.StartsWith("CN=")) {
    $Publisher = "CN=$Publisher"
}

Write-Host "==> Packaging SnapVault v$Version into MSIX..." -ForegroundColor Cyan
Write-Host "    Identity Name:        $IdentityName"
Write-Host "    Identity Publisher:   $Publisher"
Write-Host "    PublisherDisplayName: $PublisherDisplayName"

# 1. Clean and setup staging
$stagingDir = "msix_staging"
if (Test-Path $stagingDir) {
    Remove-Item -Path $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path "$stagingDir\Assets" -Force | Out-Null

$distDir = "dist_msix"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

# 2. Copy snapvault.exe
$exePath = "src-tauri\target\release\snapvault.exe"
if (-not (Test-Path $exePath)) {
    throw "Release executable not found at $exePath. Please run cargo build --release first."
}
Copy-Item $exePath -Destination "$stagingDir\snapvault.exe" -Force

# 3. Copy visual assets
Copy-Item "src-tauri\icons\Square44x44Logo.png" -Destination "$stagingDir\Assets\Square44x44Logo.png" -Force
Copy-Item "src-tauri\icons\Square150x150Logo.png" -Destination "$stagingDir\Assets\Square150x150Logo.png"
Copy-Item "src-tauri\icons\StoreLogo.png" -Destination "$stagingDir\Assets\StoreLogo.png" -Force

# Generate Wide310x150Logo.png (310x150)
Add-Type -AssemblyName System.Drawing
$wideBmp = New-Object System.Drawing.Bitmap 310, 150
$g = [System.Drawing.Graphics]::FromImage($wideBmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcIcon = [System.Drawing.Image]::FromFile((Resolve-Path "src-tauri\icons\icon.png").Path)
$g.DrawImage($srcIcon, 80, 0, 150, 150)
$srcIcon.Dispose()
$g.Dispose()
$wideBmp.Save((Resolve-Path "$stagingDir\Assets").Path + "\Wide310x150Logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$wideBmp.Dispose()

# 4. Generate AppxManifest.xml
$manifestContent = @"
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">

  <Identity
    Name="$IdentityName"
    Publisher="$Publisher"
    Version="$Version"
    ProcessorArchitecture="x64" />

  <Properties>
    <DisplayName>SnapVault - Visual Backup Time Machine</DisplayName>
    <PublisherDisplayName>$PublisherDisplayName</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
    <Description>100% offline, local-first visual backup and Time Machine for Windows 11. Content-addressed FastCDC chunk deduplication, BLAKE3 integrity verification, and zero cloud lock-in.</Description>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Applications>
    <Application
      Id="App"
      Executable="snapvault.exe"
      EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="SnapVault"
        Description="Visual Backup Time Machine for Windows 11"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile ShortName="SnapVault" Wide310x150Logo="Assets\Wide310x150Logo.png">
          <uap:ShowNameOnTiles>
            <uap:ShowOn Tile="square150x150Logo" />
          </uap:ShowNameOnTiles>
        </uap:DefaultTile>
      </uap:VisualElements>
    </Application>
  </Applications>

  <Capabilities>
    <!--
      JUSTIFICATION FOR runFullTrust RESTRICTED CAPABILITY:
      SnapVault is a native local-first file backup and disaster recovery utility.
      To perform its core product functionality, it requires full trust access to:
      1. Traverse and read user-designated source directories across local NTFS/ReFS/exFAT volumes (walkdir).
      2. Write content-addressed FastCDC chunk files and SQLite WAL databases directly to destination backup drives.
      3. Perform atomic file restore operations to arbitrary user-specified destination paths.
      4. Detect drive attachment/removal via Win32 volume notification APIs.
      5. Adjust thread scheduling priority (THREAD_PRIORITY_BELOW_NORMAL) during Quiet Mode operation.
      SnapVault contains ZERO network/telemetry capabilities and never accesses the internet.
    -->
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
$manifestPath = Join-Path (Resolve-Path $stagingDir).Path "AppxManifest.xml"
[System.IO.File]::WriteAllText($manifestPath, $manifestContent, (New-Object System.Text.UTF8Encoding($false)))

# 5. Locate MakeAppx.exe
$makeAppx = (Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Filter "MakeAppx.exe" -Recurse | Where-Object { $_.FullName -match "x64" } | Select-Object -First 1).FullName
if (-not $makeAppx) {
    throw "MakeAppx.exe not found in Windows Kits directory."
}

# 6. Execute MakeAppx pack
$outputPackage = "$distDir\SnapVault_1.0.0_x64.msix"
Write-Host "==> Running MakeAppx.exe..." -ForegroundColor Cyan
& $makeAppx pack /d $stagingDir /p $outputPackage /o

if (Test-Path $outputPackage) {
    $item = Get-Item $outputPackage
    $sizeMB = [math]::Round($item.Length / 1MB, 2)
    Write-Host "==> SUCCESS: Created $outputPackage ($($item.Length) bytes, ~$sizeMB MB)" -ForegroundColor Green
} else {
    throw "Package generation failed."
}
