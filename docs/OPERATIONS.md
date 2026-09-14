# BrightEd LMS Operations

## Password reset email

Reset password supports SMTP delivery. Configure these environment variables on the running app:

```env
PUBLIC_APP_URL="https://lms-brighted.ezitech.online"
APP_NAME="BrightEd LMS"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
SMTP_FROM="BrightEd LMS <no-reply@example.com>"
```

If SMTP is not configured, the reset endpoint still creates a token and returns a generic success response, but production will not expose the reset URL. The Operations panel shows whether SMTP reset delivery is configured.

## Local PostgreSQL backup

Manual backup:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\backup-postgres.ps1
```

Backups are stored in:

```text
storage/backups/
```

The backup format is PostgreSQL custom dump (`pg_dump -Fc`) and is suitable for `pg_restore`.

Daily backup schedule:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1
```

Current default:

- Time: `02:15`
- Retention: `14 days`
- Task name: `BrightEd LMS PostgreSQL Backup`

Verify the scheduled task:

```powershell
schtasks /Query /TN "BrightEd LMS PostgreSQL Backup" /FO LIST /V
```

## Restore drill

List contents of a dump:

```powershell
$latest = Get-ChildItem storage\backups\brighted_lms-*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 1
docker cp $latest.FullName brighted-lms-postgres:/tmp/verify.dump
docker exec brighted-lms-postgres pg_restore -l /tmp/verify.dump
docker exec brighted-lms-postgres rm -f /tmp/verify.dump
```

Production restore should be done into a fresh database first, then switched over after verification.

## VPS uptime monitor

The VPS user cron runs:

```text
*/5 * * * * /home/ahfdev/brighted-monitor/healthcheck.sh >/dev/null 2>&1
```

It checks:

```text
https://lms-brighted.ezitech.online/api/health
```

Logs:

```text
/home/ahfdev/brighted-monitor/logs/health-YYYYMM.log
/home/ahfdev/brighted-monitor/logs/alerts.log
```

The monitor retains health logs for 30 days.
