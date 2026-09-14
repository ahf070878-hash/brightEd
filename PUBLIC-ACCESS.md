# BrightEd public access

URL: https://lms-brighted.ezitech.online

Traffic path: HTTPS on the VPS → Nginx access gateway → VPS loopback port 43001 → encrypted reverse SSH tunnel → local BrightEd port 3000.

## Signing in

The public URL opens the LMS sign-in page directly, without a separate Nginx password prompt. Sign in once with your existing LMS account. Demo credentials are no longer prefilled or displayed on the sign-in page. Existing account passwords have not been changed.

HTTP redirects to HTTPS. Certificates renew through the existing Certbot timer; the per-certificate deployment hook reloads the existing Nginx master process.

## Running again

Keep the BrightEd computer online and awake. Docker/PostgreSQL and the LMS server must be running. If they are stopped, start Docker Desktop, run `docker compose up -d` and then `pnpm dev` from `D:\Brighted`.

Run the tunnel script in another PowerShell window:

```powershell
& D:\Brighted\scripts\Start-BrightEdTunnel.ps1
```

Keep the window open. It retries SSH after connection loss. Ctrl+C stops that instance. Run only one tunnel instance; a second instance cannot claim the same VPS port.

Windows Task Scheduler registration was rejected by automatic approval review (`blocked by policy`), so automatic startup at Windows sign-in was not installed. The tunnel established during setup is session-based.

## VPS resources

- Dedicated SSH user: `brighted-tunnel` (key authentication, no interactive shell).
- SSH configuration: `/etc/ssh/sshd_config.d/91-brighted-tunnel.conf`.
- Forwarding limited to `127.0.0.1:43001`; the port is not publicly bound.
- Nginx site: `/etc/nginx/sites-available/lms-brighted.ezitech.online`.
- The former gateway password file is unused; Nginx gateway authentication has been removed.
- Certificate: `/etc/letsencrypt/live/lms-brighted.ezitech.online/`.
- Certificate reload hook: `/usr/local/sbin/brighted-reload-nginx`.

Nginx is running directly with `/etc/nginx/nginx.conf`, not through the inactive systemd Nginx unit. Validate configuration with `nginx -t` and use the reload hook rather than starting a second Nginx instance.

## Verified

Public DNS resolves to the VPS. HTTPS certificate validation passed. Anonymous visitors can open the sign-in page without a WWW-Authenticate challenge. Protected LMS API endpoints still require a valid LMS session token. HTTP redirects to HTTPS.
