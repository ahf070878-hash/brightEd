# Run manually in PowerShell. Keep this window open; Ctrl+C stops the tunnel.
# The local BrightEd app and database must already be running.
$brightedPrivate = Join-Path $env:LOCALAPPDATA 'BrightEdTunnel'
$brightedSsh = Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
$brightedKey = Join-Path $brightedPrivate 'id_ed25519'
$brightedHosts = Join-Path $brightedPrivate 'known_hosts'
if (-not (Test-Path -LiteralPath $brightedKey)) {
    throw 'The dedicated BrightEd SSH key is not available for this Windows user.'
}
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
