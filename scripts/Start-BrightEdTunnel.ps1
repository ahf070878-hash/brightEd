# Run manually in PowerShell. Keep this window open; Ctrl+C stops the tunnel.
# The local BrightEd app and database must already be running.
$ErrorActionPreference = 'Stop'

$brightedSsh = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
if (-not (Test-Path -LiteralPath $brightedSsh)) {
    throw 'Windows OpenSSH client is not available. Install OpenSSH Client from Windows Optional Features.'
}

$brightedCandidateDirs = @(
    (Join-Path $env:LOCALAPPDATA 'BrightEdTunnel'),
    (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'BrightEdTunnel'),
    'C:\Users\alwif\AppData\Local\BrightEdTunnel'
) | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique

$brightedPrivate = $brightedCandidateDirs | Where-Object {
    Test-Path -LiteralPath (Join-Path $_ 'id_ed25519')
} | Select-Object -First 1

if (-not $brightedPrivate) {
    $searched = ($brightedCandidateDirs | ForEach-Object { " - $_" }) -join [Environment]::NewLine
    throw "The dedicated BrightEd SSH key is not available for this Windows user. Searched:$([Environment]::NewLine)$searched$([Environment]::NewLine)Run PowerShell as the normal Windows user 'alwif', or restore the BrightEdTunnel folder from the original profile."
}

$brightedKey = Join-Path $brightedPrivate 'id_ed25519'
$brightedHosts = Join-Path $brightedPrivate 'known_hosts'
if (-not (Test-Path -LiteralPath $brightedHosts)) {
    throw "BrightEd tunnel known_hosts file is missing: $brightedHosts"
}

Write-Host "Using BrightEd tunnel key: $brightedKey"
while ($true) {
    Write-Host 'Connecting BrightEd to lms-brighted.ezitech.online...'
    & $brightedSsh -N -T -i $brightedKey `
        -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes `
        -o "UserKnownHostsFile=$brightedHosts" -o ExitOnForwardFailure=yes `
        -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ConnectTimeout=15 `
        -R 127.0.0.1:43001:127.0.0.1:3000 brighted-tunnel@154.26.133.236
    Write-Host 'Connection ended. Reconnecting in 10 seconds; press Ctrl+C to stop.'
    Start-Sleep -Seconds 10
}
