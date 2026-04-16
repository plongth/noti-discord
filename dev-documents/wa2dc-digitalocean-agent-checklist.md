# WA2DC DigitalOcean Deploy Checklist (Agent Feed)

Use this checklist as the execution contract for an automation agent.
Goal: deploy WA2DC on a DigitalOcean Droplet with Docker Compose, verify runtime, and ensure backup readiness.

## 1. Task Metadata

- Task name: WA2DC deploy on DigitalOcean
- Repo path: d:/noti-discord
- Target OS: Ubuntu/Debian on DigitalOcean Droplet
- Runtime model: Docker Compose (`wa2dc` service)
- Must preserve data: `storage/`

## 2. Required Inputs (fill before run)

- [ ] Droplet SSH host/IP is available
- [ ] SSH user is available (non-root + sudo preferred)
- [ ] Discord bot token is ready
- [ ] Final deploy root selected (default: `~/wa2dc`)
- [ ] Branch/tag decision is made (default branch or pinned ref)

## 3. Files/Scripts To Use

- [ ] `scripts/digitalocean/do-setup.sh`
- [ ] `scripts/digitalocean/do-deploy.sh`
- [ ] `scripts/digitalocean/do-update.sh`
- [ ] `scripts/digitalocean/do-backup.sh`
- [ ] `scripts/digitalocean/README.md`

## 4. Preflight Checks

- [ ] Confirm target is Ubuntu/Debian
- [ ] Confirm internet egress works (apt + docker registry + github)
- [ ] Confirm enough disk space for image + storage + backups
- [ ] Confirm firewall/security group allows outbound connections
- [ ] Confirm no conflicting container named `wa2dc`

## 5. First-Time Setup

- [ ] Run setup script as root:
- [ ] `sudo bash scripts/digitalocean/do-setup.sh`
- [ ] Confirm Docker installed (`docker --version`)
- [ ] Confirm Compose plugin installed (`docker compose version`)
- [ ] Confirm deploy user is in docker group
- [ ] Open a new shell session after group change

## 6. Deploy Steps

- [ ] Run deploy script as deploy user:
- [ ] `bash scripts/digitalocean/do-deploy.sh`
- [ ] Ensure `.env` exists at `~/wa2dc/app/.env`
- [ ] Set valid `WA2DC_TOKEN` in `.env`
- [ ] Re-run deploy script after `.env` update
- [ ] Confirm container is up (`docker compose ps`)

## 7. Runtime Verification

- [ ] Follow logs:
- [ ] `cd ~/wa2dc/app && docker compose logs -f --tail=200 wa2dc`
- [ ] Confirm app reaches normal running state (no crash loop)
- [ ] Confirm Discord bot logs in successfully
- [ ] Confirm WhatsApp pairing flow can be completed
- [ ] Confirm `storage/wa2dc.sqlite` is created/persisted

## 8. Update and Rollback Readiness

- [ ] Run update dry run:
- [ ] `bash scripts/digitalocean/do-update.sh`
- [ ] Confirm service recreates without data loss
- [ ] Confirm app still uses existing `storage/`

## 9. Backup Readiness

- [ ] Run backup script once:
- [ ] `bash scripts/digitalocean/do-backup.sh`
- [ ] Confirm archive created in `~/wa2dc/backups`
- [ ] Confirm retention setting is acceptable (default 14 days)
- [ ] (Optional) configure cron for daily backup

## 10. Security Baseline

- [ ] Ensure `.env` is not committed or exposed
- [ ] Restrict Discord control channel permissions
- [ ] Avoid running app as root inside container workflow
- [ ] Keep Droplet patched regularly

## 11. Acceptance Criteria (Definition of Done)

- [ ] WA2DC container is healthy and running
- [ ] Discord bot connected and functional
- [ ] WhatsApp session paired and active
- [ ] Data persists across restart/redeploy
- [ ] Backup archive can be generated successfully
- [ ] No critical errors in logs after stabilization window

## 12. Agent Output Format (required)

Agent must return:

1. Completed checklist items
2. Commands executed
3. Key outputs/log snippets
4. Any blockers + exact error messages
5. Next action if blocked

