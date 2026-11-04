<#
.SYNOPSIS
    Boot the BIM-mobile AVD into a known-good, awake, unlocked state.

.DESCRIPTION
    The AVD uses fastboot.forceFastBoot=yes, so every launch restores the
    `default_boot` quick-boot snapshot. If that snapshot was captured while the
    display was asleep (which happens easily, since the emulator's screen turns
    off after ~60s of inactivity), every subsequent launch starts on a black
    screen even though the device booted perfectly.

    This script removes that class of failure:
      1. Boots the AVD (cold boot by default, so a bad snapshot can never be restored).
      2. Waits for sys.boot_completed.
      3. Re-applies no-sleep / no-lock settings (idempotent, survives AVD wipes).
      4. Wakes the display, dismisses the keyguard, collapses the shade.
      5. Re-creates the Metro reverse tunnel (adb reverse does NOT survive reboots).
      6. Verifies the screen is really rendering (screencap size sanity check).

.PARAMETER FastBoot
    Keep the existing quick-boot snapshot instead of cold booting. Faster, but a
    stale/black snapshot will be restored. Use only once the snapshot is known-good.

.PARAMETER AvdName
    Name of the AVD to boot. If omitted, uses Pixel_10_Pro_XL when available, or
    the only installed AVD.

.PARAMETER SkipLaunch
    Only prepare the device; do not start Metro / open the app.

.EXAMPLE
    npm run emulator:up
.EXAMPLE
    ./scripts/emulator-up.ps1 -FastBoot -SkipLaunch
#>
[CmdletBinding()]
param(
    [string]$AvdName,
    [switch]$FastBoot,
    [switch]$SkipLaunch
)

$ErrorActionPreference = 'Stop'

# --- Resolve the Android SDK (mirrors helpers used by Expo CLI) -------------
$Sdk = $env:ANDROID_HOME
if (-not $Sdk) { $Sdk = $env:ANDROID_SDK_ROOT }
if (-not $Sdk) { $Sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path $Sdk)) { throw "Android SDK not found. Set ANDROID_HOME. Looked in: $Sdk" }

$Adb      = Join-Path $Sdk 'platform-tools\adb.exe'
$Emulator = Join-Path $Sdk 'emulator\emulator.exe'
foreach ($exe in @($Adb, $Emulator)) {
    if (-not (Test-Path $exe)) { throw "Missing executable: $exe" }
}

$availableAvds = @(& $Emulator -list-avds | Where-Object { $_.Trim() })
if (-not $availableAvds.Count) {
    throw "No Android Virtual Devices are installed. Create one in Android Studio Device Manager."
}
if (-not $AvdName) {
    if ($availableAvds -contains 'Pixel_10_Pro_XL') {
        $AvdName = 'Pixel_10_Pro_XL'
    }
    elseif ($availableAvds.Count -eq 1) {
        $AvdName = $availableAvds[0]
    }
    else {
        throw "Multiple AVDs are installed. Specify one with -AvdName: $($availableAvds -join ', ')"
    }
}
if ($availableAvds -notcontains $AvdName) {
    throw "AVD '$AvdName' is not installed. Available AVDs: $($availableAvds -join ', ')"
}

$MetroPort = 8081

function Get-EmulatorSerial {
    $line = & $Adb devices | Select-String -Pattern '^emulator-\d+\s+device$' | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line.Line -split '\s+')[0]
}

# --- 1. Boot -----------------------------------------------------------------
$serial = Get-EmulatorSerial
if ($serial) {
    Write-Host "[1/6] Emulator already running ($serial)." -ForegroundColor Cyan
}
else {
    $bootArgs = @('-avd', $AvdName, '-no-boot-anim')
    if (-not $FastBoot) { $bootArgs += '-no-snapshot-load' }

    $mode = if ($FastBoot) { 'fast boot (snapshot restore)' } else { 'cold boot (snapshot ignored)' }
    Write-Host "[1/6] Booting $AvdName - $mode ..." -ForegroundColor Cyan

    Start-Process -FilePath $Emulator -ArgumentList $bootArgs -WindowStyle Minimized

    Write-Host '      Waiting for emulator to answer adb ...'
    $deviceDeadline = (Get-Date).AddMinutes(2)
    while (-not $serial -and (Get-Date) -lt $deviceDeadline) {
        Start-Sleep -Seconds 2
        $serial = Get-EmulatorSerial
    }
    if (-not $serial) {
        throw "Emulator '$AvdName' did not appear in adb within 2 minutes. Check the Android Emulator output for startup errors."
    }
}

# --- 2. Wait for real boot completion ---------------------------------------
Write-Host "[2/6] Waiting for boot to complete ..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(10)
while ($true) {
    $booted = (& $Adb -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($booted -eq '1') { break }
    if ((Get-Date) -gt $deadline) { throw "Timed out waiting for $serial to boot." }
    Start-Sleep -Seconds 3
}
Write-Host '      sys.boot_completed = 1' -ForegroundColor Green

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & $Adb -s $serial @Args 2>$null | Out-Null
}

# --- 3. Persistent no-sleep / no-lock settings -------------------------------
# These land in the AVD's userdata, so they survive reboots but not a wipe.
# Re-applying every run is what makes this self-healing.
Write-Host '[3/6] Applying no-sleep / no-lock settings ...' -ForegroundColor Cyan
Invoke-Adb shell settings put system screen_off_timeout 2147483647   # never turn the display off
Invoke-Adb shell settings put global stay_on_while_plugged_in 7      # stay awake while "charging"
Invoke-Adb shell settings put secure immersive_mode_confirmations confirmed
Invoke-Adb shell settings put global development_settings_enabled 1
Invoke-Adb shell locksettings set-disabled true                     # remove the keyguard entirely

# --- 4. Force the display awake ---------------------------------------------
Write-Host '[4/6] Waking display ...' -ForegroundColor Cyan
Invoke-Adb shell input keyevent KEYCODE_WAKEUP
Invoke-Adb shell wm dismiss-keyguard
Invoke-Adb shell cmd statusbar collapse

# --- 5. Metro reverse tunnel (does not survive an emulator restart) ----------
Write-Host "[5/6] Restoring Metro tunnel on tcp:$MetroPort ..." -ForegroundColor Cyan
Invoke-Adb reverse "tcp:$MetroPort" "tcp:$MetroPort"

# --- 6. Verify the screen is genuinely rendering ----------------------------
Write-Host '[6/6] Verifying display ...' -ForegroundColor Cyan
$png = Join-Path $env:TEMP 'avd-screen-check.png'
& $Adb -s $serial exec-out screencap -p > $png
$size = (Get-Item $png).Length

$wake  = (& $Adb -s $serial shell dumpsys power | Select-String 'mWakefulness=' | Select-Object -First 1).ToString().Trim()

Write-Host "      $wake"
Write-Host "      screenshot: $([math]::Round($size / 1KB)) KB -> $png"

if ($size -lt 50KB) {
    Write-Warning 'Screen looks blank/black. Retrying wake sequence once ...'
    Invoke-Adb shell input keyevent KEYCODE_WAKEUP
    Invoke-Adb shell wm dismiss-keyguard
    Invoke-Adb shell input keyevent KEYCODE_HOME
    Start-Sleep -Seconds 2
    & $Adb -s $serial exec-out screencap -p > $png
    $size = (Get-Item $png).Length
    Write-Host "      screenshot after retry: $([math]::Round($size / 1KB)) KB"
    if ($size -lt 50KB) {
        Write-Warning 'Still blank. Fall back to a cold boot: stop the emulator and re-run without -FastBoot.'
    }
}

# --- Optional: start Metro and open the app ---------------------------------
if (-not $SkipLaunch) {
    Write-Host 'Starting Metro and launching the app ...' -ForegroundColor Cyan
    Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start:dev' -WorkingDirectory (Split-Path $PSScriptRoot -Parent) -WindowStyle Minimized
    Write-Host '      Waiting for Metro to answer ...'
    $metroOk = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $status = (Invoke-WebRequest "http://127.0.0.1:$MetroPort/status" -UseBasicParsing -TimeoutSec 3).Content
            if ($status -match 'packager-status:running') { $metroOk = $true; break }
        }
        catch { }
        Start-Sleep -Seconds 2
    }
    if ($metroOk) {
        Write-Host '      Metro is running.' -ForegroundColor Green
        Invoke-Adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:$MetroPort"
    }
    else {
        Write-Warning 'Metro did not answer in time. Check the "start:dev" terminal.'
    }
}

Write-Host ''
Write-Host "Ready - $serial is awake, unlocked and tunnelled." -ForegroundColor Green
