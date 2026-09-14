param(
  [string]$TaskName = "BrightEd LMS PostgreSQL Backup",
  [string]$Time = "02:15",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackupScript = Join-Path $ProjectRoot "scripts/backup-postgres.ps1"
$Pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue)?.Source
if (-not $Pwsh) {
  $Pwsh = (Get-Command powershell -ErrorAction Stop).Source
}

$Action = New-ScheduledTaskAction `
  -Execute $Pwsh `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupScript`" -RetentionDays $RetentionDays" `
  -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description "Daily BrightEd LMS PostgreSQL backup with retention." `
  -Force | Out-Null

Write-Output "Scheduled task registered: $TaskName at $Time"
