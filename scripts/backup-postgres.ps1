param(
  [string]$ContainerName = "brighted-lms-postgres",
  [string]$DatabaseName = "brighted_lms",
  [string]$DatabaseUser = "postgres",
  [string]$BackupDir = "storage/backups",
  [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackupPath = Join-Path $ProjectRoot $BackupDir
New-Item -ItemType Directory -Force -Path $BackupPath | Out-Null

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$FileName = "$DatabaseName-$Timestamp.dump"
$LocalFile = Join-Path $BackupPath $FileName
$ContainerFile = "/tmp/$FileName"

docker exec $ContainerName pg_dump -U $DatabaseUser -d $DatabaseName -Fc -f $ContainerFile
docker cp "${ContainerName}:${ContainerFile}" $LocalFile
docker exec $ContainerName rm -f $ContainerFile | Out-Null

$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $BackupPath -Filter "$DatabaseName-*.dump" |
  Where-Object { $_.LastWriteTime -lt $Cutoff } |
  Remove-Item -Force

$SizeMb = [Math]::Round((Get-Item -LiteralPath $LocalFile).Length / 1MB, 2)
Write-Output "Backup created: $LocalFile ($SizeMb MB)"
