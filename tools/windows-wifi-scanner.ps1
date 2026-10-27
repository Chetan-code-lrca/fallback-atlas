# Fallback Atlas Windows Wi-Fi scanner
# Windows reports percentage, not true RSSI dBm. The website will label this dBm as an estimate.
# This script never uploads BSSIDs/MAC addresses, device IDs, passwords or saved credentials.

$ErrorActionPreference = 'Stop'
$ApiUrl = 'https://ambitious-smoke-035c3f900.6.azurestaticapps.net/api/wifi-scans'
Write-Host ''
Write-Host 'Fallback Atlas - Windows Wi-Fi scanner' -ForegroundColor Cyan
Write-Host 'This detects nearby radio networks; it does not test internet access.' -ForegroundColor Gray
Write-Host 'If shared, SSID names and approximate coordinates are visible to other users for 15 minutes.' -ForegroundColor Yellow

if (-not ('FallbackAtlas.WlanNative' -as [type])) {
$nativeSource = @'
using System;
using System.Runtime.InteropServices;
namespace FallbackAtlas {
  public static class WlanNative {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct InterfaceInfo {
      public Guid InterfaceGuid;
      [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string Description;
      public int State;
    }
    [DllImport("wlanapi.dll", SetLastError = true)]
    private static extern uint WlanOpenHandle(uint clientVersion, IntPtr reserved, out uint negotiatedVersion, out IntPtr clientHandle);
    [DllImport("wlanapi.dll", SetLastError = true)]
    private static extern uint WlanEnumInterfaces(IntPtr clientHandle, IntPtr reserved, out IntPtr interfaceList);
    [DllImport("wlanapi.dll", SetLastError = true)]
    private static extern uint WlanScan(IntPtr clientHandle, ref Guid interfaceGuid, IntPtr ssid, IntPtr ieData, IntPtr reserved);
    [DllImport("wlanapi.dll")] private static extern void WlanFreeMemory(IntPtr memory);
    [DllImport("wlanapi.dll")] private static extern uint WlanCloseHandle(IntPtr clientHandle, IntPtr reserved);
    public static int ScanFirstWirelessInterface() {
      IntPtr handle = IntPtr.Zero, list = IntPtr.Zero;
      uint version;
      uint result = WlanOpenHandle(2, IntPtr.Zero, out version, out handle);
      if (result != 0) return (int)result;
      try {
        result = WlanEnumInterfaces(handle, IntPtr.Zero, out list);
        if (result != 0) return (int)result;
        int count = Marshal.ReadInt32(list);
        if (count < 1) return -1;
        int size = Marshal.SizeOf(typeof(InterfaceInfo));
        InterfaceInfo selected = (InterfaceInfo)Marshal.PtrToStructure(IntPtr.Add(list, 8), typeof(InterfaceInfo));
        for (int i = 0; i < count; i++) {
          InterfaceInfo current = (InterfaceInfo)Marshal.PtrToStructure(IntPtr.Add(list, 8 + i * size), typeof(InterfaceInfo));
          if (current.State == 1) { selected = current; break; }
        }
        return (int)WlanScan(handle, ref selected.InterfaceGuid, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
      } finally {
        if (list != IntPtr.Zero) WlanFreeMemory(list);
        if (handle != IntPtr.Zero) WlanCloseHandle(handle, IntPtr.Zero);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $nativeSource
}

try { $scanCode = [FallbackAtlas.WlanNative]::ScanFirstWirelessInterface() }
catch { Write-Host ('Could not start Wi-Fi scan: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }
if ($scanCode -ne 0) {
  Write-Host "Windows could not start a fresh Wi-Fi scan (code $scanCode). Nothing was uploaded." -ForegroundColor Red
  Write-Host 'Try again after a short pause and make sure Wi-Fi is enabled.'
  exit 1
}
Write-Host 'Scanning nearby networks...' -ForegroundColor Cyan
Start-Sleep -Seconds 6
$rawLines = & "$env:SystemRoot\System32\netsh.exe" wlan show networks mode=bssid 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not read Wi-Fi list. Nothing uploaded.' -ForegroundColor Red; exit 1 }
$raw = ($rawLines | Out-String)
$ssidMatches = [regex]::Matches($raw, '(?im)^\s*SSID\s+\d+\s*:\s*(?<ssid>.*)$')
$observations = @()
$scanTime = (Get-Date).ToUniversalTime().ToString('o')

function Get-WifiFrequencyMhz([string]$band, [int]$channel) {
  if ($band -match '2\.4') {
    if ($channel -eq 14) { return 2484 }
    if ($channel -ge 1 -and $channel -le 13) { return 2407 + 5 * $channel }
  } elseif ($band -match '5') {
    if ($channel -ge 1 -and $channel -le 200) { return 5000 + 5 * $channel }
  } elseif ($band -match '6') {
    if ($channel -ge 1 -and $channel -le 233) { return 5950 + 5 * $channel }
  }
  return 0
}

for ($i = 0; $i -lt $ssidMatches.Count; $i++) {
  $start = $ssidMatches[$i].Index
  $end = if ($i + 1 -lt $ssidMatches.Count) { $ssidMatches[$i + 1].Index } else { $raw.Length }
  $section = $raw.Substring($start, $end - $start)
  $ssid = $ssidMatches[$i].Groups['ssid'].Value.Trim()
  if ([string]::IsNullOrWhiteSpace($ssid)) { continue }
  if ($ssid.Length -gt 32) { $ssid = $ssid.Substring(0, 32) }
  $authMatch = [regex]::Match($section, '(?im)^\s*Authentication\s*:\s*(?<value>.*?)\s*$')
  $security = if ($authMatch.Success) { $authMatch.Groups['value'].Value.Trim() } else { 'Unknown' }
  $bssidMatches = [regex]::Matches($section, '(?im)^\s*BSSID\s+\d+\s*:\s*.*$')
  for ($j = 0; $j -lt $bssidMatches.Count; $j++) {
    $bStart = $bssidMatches[$j].Index
    $bEnd = if ($j + 1 -lt $bssidMatches.Count) { $bssidMatches[$j + 1].Index } else { $section.Length }
    $block = $section.Substring($bStart, $bEnd - $bStart)
    $sig = [regex]::Match($block, '(?im)^\s*Signal\s*:\s*(?<value>\d+)\s*%')
    $bandMatch = [regex]::Match($block, '(?im)^\s*Band\s*:\s*(?<value>.*?)\s*$')
    $channelMatch = [regex]::Match($block, '(?im)^\s*Channel\s*:\s*(?<value>\d+)\s*$')
    if (-not $sig.Success -or -not $bandMatch.Success -or -not $channelMatch.Success) { continue }
    $percent = [int]$sig.Groups['value'].Value
    $frequency = Get-WifiFrequencyMhz $bandMatch.Groups['value'].Value.Trim() ([int]$channelMatch.Groups['value'].Value)
    if ($frequency -lt 2400 -or $frequency -gt 7125) { continue }
    $estimate = [int][math]::Round(($percent / 2.0) - 100)
    $key = $ssid.ToLowerInvariant() + '|' + $frequency
    $old = $observations | Where-Object { $_.key -eq $key } | Select-Object -First 1
    if ($null -eq $old) {
      $observations += [pscustomobject]@{ key=$key; networkName=$ssid; signalPercent=$percent; signalDbm=$estimate; frequencyMhz=$frequency; security=$security; signalType='windows-percent-estimate'; observedAt=$scanTime }
    } elseif ($percent -gt $old.signalPercent) { $old.signalPercent=$percent; $old.signalDbm=$estimate }
  }
}
if ($observations.Count -eq 0) { Write-Host 'No identifiable networks detected. Nothing uploaded.' -ForegroundColor Yellow; exit 0 }
$observations = @($observations | Select-Object -First 40)
Write-Host ''
Write-Host ('Found ' + $observations.Count + ' unique SSID/frequency entries:') -ForegroundColor Green
$observations | Select-Object networkName, signalPercent, frequencyMhz, security | Format-Table -AutoSize
Write-Host 'Review the names. Do not share private hotspot names or networks you do not want publicly disclosed.' -ForegroundColor Yellow

# Add row numbers so only explicitly selected access points can be shared.
for ($idx = 0; $idx -lt $observations.Count; $idx++) {
  $observations[$idx] | Add-Member -NotePropertyName selectionNumber -NotePropertyValue ($idx + 1) -Force
}
Write-Host ''
$observations | Select-Object @{Name='No';Expression={$_.selectionNumber}}, networkName, signalPercent, frequencyMhz, security | Format-Table -AutoSize
$selection = (Read-Host "Enter row numbers to share (comma-separated, e.g. 4,5,11). Type ALL for every row; anything else cancels").Trim()
if ($selection -match '(?i)^ALL$area = (Read-Host 'Enter a public area label (for example, SPSU campus, Udaipur)').Trim()
if ([string]::IsNullOrWhiteSpace($area)) { Write-Host 'Area label is required. Nothing uploaded.' -ForegroundColor Red; exit 1 }
if ($area.Length -gt 120) { $area = $area.Substring(0, 120) }
try {
  $latitude = [double]::Parse((Read-Host 'Enter approximate latitude'), [System.Globalization.CultureInfo]::InvariantCulture)
  $longitude = [double]::Parse((Read-Host 'Enter approximate longitude'), [System.Globalization.CultureInfo]::InvariantCulture)
} catch { Write-Host 'Coordinates must be numeric and use a decimal point. Nothing uploaded.' -ForegroundColor Red; exit 1 }
if ($latitude -lt -90 -or $latitude -gt 90 -or $longitude -lt -180 -or $longitude -gt 180) { Write-Host 'Coordinates out of range. Nothing uploaded.' -ForegroundColor Red; exit 1 }

$body = [ordered]@{
  area = $area
  latitude = [math]::Round($latitude, 3)
  longitude = [math]::Round($longitude, 3)
  networks = @($observations | ForEach-Object { [ordered]@{
    networkName=$_.networkName; signalDbm=$_.signalDbm; signalPercent=$_.signalPercent
    signalType=$_.signalType; frequencyMhz=$_.frequencyMhz; security=$_.security; observedAt=$_.observedAt
  } })
}
$json = $body | ConvertTo-Json -Depth 6 -Compress
try {
  $result = Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 20
  Write-Host ''
  Write-Host ("Shared " + $result.accepted + " observations with Fallback Atlas.") -ForegroundColor Green
  Write-Host 'Refresh the nearby Wi-Fi section. Radio signal does not prove internet access.'
} catch {
  $status = 'unknown status'; $responseText = ''
  if ($_.Exception.Response) {
    try {
      $status = [int]$_.Exception.Response.StatusCode
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) { $reader = New-Object System.IO.StreamReader($stream); $responseText=$reader.ReadToEnd(); $reader.Dispose() }
    } catch {}
  }
  Write-Host ("Upload failed (" + $status + ").") -ForegroundColor Red
  if ($responseText) { Write-Host $responseText } else { Write-Host $_.Exception.Message }
  exit 1
}
) {
  $selectedObservations = @($observations)
} else {
  $tokens = @($selection -split '[,\s]+' | Where-Object { $_ -ne '' })
  if ($tokens.Count -eq 0) { Write-Host 'Cancelled. Nothing was uploaded.' -ForegroundColor Gray; exit 0 }
  $numbers = @()
  foreach ($token in $tokens) {
    $number = 0
    if (-not [int]::TryParse($token, [ref]$number) -or $number -lt 1 -or $number -gt $observations.Count) {
      Write-Host ("Invalid row number: " + $token + ". Nothing was uploaded.") -ForegroundColor Red
      exit 1
    }
    $numbers += $number
  }
  $numbers = @($numbers | Select-Object -Unique)
  $selectedObservations = @($observations | Where-Object { $numbers -contains $_.selectionNumber })
}
if ($selectedObservations.Count -lt 1) { Write-Host 'No rows selected. Nothing was uploaded.' -ForegroundColor Gray; exit 0 }
$observations = @($selectedObservations)
Write-Host ''
Write-Host 'Only these selected rows will be uploaded:' -ForegroundColor Cyan
$observations | Select-Object networkName, signalPercent, frequencyMhz, security | Format-Table -AutoSize
$consent = Read-Host ("Type SHARE to upload these " + $observations.Count + " selected observations and approximate location; anything else cancels")
if ($consent -cne 'SHARE') { Write-Host 'Cancelled. Nothing was uploaded.' -ForegroundColor Gray; exit 0 }
$area = (Read-Host 'Enter a public area label (for example, SPSU campus, Udaipur)').Trim()
if ([string]::IsNullOrWhiteSpace($area)) { Write-Host 'Area label is required. Nothing uploaded.' -ForegroundColor Red; exit 1 }
if ($area.Length -gt 120) { $area = $area.Substring(0, 120) }
try {
  $latitude = [double]::Parse((Read-Host 'Enter approximate latitude'), [System.Globalization.CultureInfo]::InvariantCulture)
  $longitude = [double]::Parse((Read-Host 'Enter approximate longitude'), [System.Globalization.CultureInfo]::InvariantCulture)
} catch { Write-Host 'Coordinates must be numeric and use a decimal point. Nothing uploaded.' -ForegroundColor Red; exit 1 }
if ($latitude -lt -90 -or $latitude -gt 90 -or $longitude -lt -180 -or $longitude -gt 180) { Write-Host 'Coordinates out of range. Nothing uploaded.' -ForegroundColor Red; exit 1 }

$body = [ordered]@{
  area = $area
  latitude = [math]::Round($latitude, 3)
  longitude = [math]::Round($longitude, 3)
  networks = @($observations | ForEach-Object { [ordered]@{
    networkName=$_.networkName; signalDbm=$_.signalDbm; signalPercent=$_.signalPercent
    signalType=$_.signalType; frequencyMhz=$_.frequencyMhz; security=$_.security; observedAt=$_.observedAt
  } })
}
$json = $body | ConvertTo-Json -Depth 6 -Compress
try {
  $result = Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 20
  Write-Host ''
  Write-Host ("Shared " + $result.accepted + " observations with Fallback Atlas.") -ForegroundColor Green
  Write-Host 'Refresh the nearby Wi-Fi section. Radio signal does not prove internet access.'
} catch {
  $status = 'unknown status'; $responseText = ''
  if ($_.Exception.Response) {
    try {
      $status = [int]$_.Exception.Response.StatusCode
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) { $reader = New-Object System.IO.StreamReader($stream); $responseText=$reader.ReadToEnd(); $reader.Dispose() }
    } catch {}
  }
  Write-Host ("Upload failed (" + $status + ").") -ForegroundColor Red
  if ($responseText) { Write-Host $responseText } else { Write-Host $_.Exception.Message }
  exit 1
}
