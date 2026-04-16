# DigitalOcean Quick Deploy Scripts (WA2DC single-source + PM2)

This folder provides helper scripts to deploy WA2DC and the local wrapper from a single source checkout on a DigitalOcean Droplet.

## Scripts

- `do-setup.sh`: install Node.js 24 + PM2 and create deploy folders
- `do-deploy.sh`: clone/pull source, create `.env` if missing, run `npm ci`, start/reload PM2 ecosystem, and install daily log cleanup cron
- `do-update.sh`: pull latest source, run `npm ci`, and reload PM2 ecosystem
- `do-backup.sh`: backup `storage/` (+ `.env` if present) into `.tar.gz` and prune old backups
- `do-log-cleanup.sh`: truncate WA2DC and PM2 logs (used by daily cron)

## Typical flow on a new Droplet

```bash
# 1) Upload project files or clone this repository
# 2) Run setup as root once
sudo bash scripts/digitalocean/do-setup.sh

# 3) Open a new shell, then deploy as regular user
bash scripts/digitalocean/do-deploy.sh

# 4) Edit env values (token, wrapper endpoint/key)
nano ~/wa2dc/app/.env

# 5) Redeploy after editing env
bash scripts/digitalocean/do-deploy.sh

# 6) Follow logs
pm2 logs wa2dc-bot --lines 200
pm2 logs arespawn-wrapper --lines 200
```

## Environment overrides

All scripts support these optional environment variables:

- `WA2DC_DEPLOY_ROOT` (default: `~/wa2dc`)
- `WA2DC_APP_DIR` (default: `$WA2DC_DEPLOY_ROOT/app`)
- `WA2DC_REPO_URL` and `WA2DC_REPO_REF` (deploy script only)
- `WA2DC_ENV_FILE` (deploy script only)
- `WA2DC_BACKUP_DIR`, `WA2DC_BACKUP_RETENTION_DAYS` (backup script only)
- `WA2DC_ECOSYSTEM_FILE` (deploy/update script only, default: `$WA2DC_APP_DIR/ecosystem.config.cjs`)
- `WA2DC_INSTALL_LOG_CLEANUP_CRON` (deploy script only, default: `1`)
- `WA2DC_LOG_CLEANUP_CRON` (deploy script only, default: `15 0 * * *`)
- `WA2DC_LOG_CLEANUP_LOG` (deploy script only, default: `$WA2DC_DEPLOY_ROOT/log-cleanup.log`)

## Daily log cleanup

By default, `do-deploy.sh` installs/updates a cron job that runs every day at `00:15` and truncates:

- `logs.txt`
- `terminal.log`
- PM2 app logs under `~/.pm2/logs/`
- PM2 daemon log (`~/.pm2/pm2.log`)

Run cleanup manually any time:

```bash
bash scripts/digitalocean/do-log-cleanup.sh
```

## Optional cron backup

```bash
crontab -e
# every day at 03:30 UTC
30 3 * * * /bin/bash /home/<user>/wa2dc/app/scripts/digitalocean/do-backup.sh >> /home/<user>/wa2dc/backup.log 2>&1
```

Adjust paths according to your checkout location.

