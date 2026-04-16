# DigitalOcean Quick Deploy Scripts (WA2DC)

This folder provides helper scripts to deploy WA2DC quickly on a DigitalOcean Droplet using Docker Compose.

## Scripts

- `do-setup.sh`: install Docker + compose plugin and create deploy folders
- `do-deploy.sh`: clone/pull repository, create `.env` if missing, start container
- `do-update.sh`: pull latest source + image, recreate service
- `do-backup.sh`: backup `storage/` into `.tar.gz` and prune old backups

## Typical flow on a new Droplet

```bash
# 1) Upload project files or clone this repository
# 2) Run setup as root once
sudo bash scripts/digitalocean/do-setup.sh

# 3) Open a new shell (to refresh docker group), then deploy as regular user
bash scripts/digitalocean/do-deploy.sh

# 4) Edit token
nano ~/wa2dc/app/.env
# set WA2DC_TOKEN=...

# 5) Redeploy after editing env
bash scripts/digitalocean/do-deploy.sh

# 6) Follow logs
cd ~/wa2dc/app && docker compose logs -f --tail=200 wa2dc
```

## Environment overrides

All scripts support these optional environment variables:

- `WA2DC_DEPLOY_ROOT` (default: `~/wa2dc`)
- `WA2DC_APP_DIR` (default: `$WA2DC_DEPLOY_ROOT/app`)
- `WA2DC_REPO_URL` and `WA2DC_REPO_REF` (deploy script only)
- `WA2DC_ENV_FILE` (deploy script only)
- `WA2DC_BACKUP_DIR`, `WA2DC_BACKUP_RETENTION_DAYS` (backup script only)

## Optional cron backup

```bash
crontab -e
# every day at 03:30 UTC
30 3 * * * /bin/bash /home/<user>/wa2dc/app/scripts/digitalocean/do-backup.sh >> /home/<user>/wa2dc/backup.log 2>&1
```

Adjust paths according to your checkout location.

