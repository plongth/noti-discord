#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${WA2DC_DEPLOY_ROOT:-$HOME/wa2dc}"
APP_DIR="${WA2DC_APP_DIR:-${DEPLOY_ROOT}/app}"
ECOSYSTEM_FILE="${WA2DC_ECOSYSTEM_FILE:-${APP_DIR}/ecosystem.config.cjs}"

log() {
	printf '[wa2dc-do-update] %s\n' "$*"
}

die() {
	printf '[wa2dc-do-update] ERROR: %s\n' "$*" >&2
	exit 1
}

on_error() {
	local line="$1"
	die "Update failed at line ${line}."
}
trap 'on_error "$LINENO"' ERR

[[ -d "${APP_DIR}" ]] || die "App dir not found: ${APP_DIR}. Run do-deploy.sh first."

command -v git >/dev/null 2>&1 || die "git not found"
command -v node >/dev/null 2>&1 || die "node not found"
command -v npm >/dev/null 2>&1 || die "npm not found"
command -v pm2 >/dev/null 2>&1 || die "pm2 not found"

if ! node -v | grep -Eq '^v2[4-9]\.'; then
	die "Node.js 24+ is required. Current: $(node -v)."
fi

[[ -f "${ECOSYSTEM_FILE}" ]] || die "PM2 ecosystem file not found: ${ECOSYSTEM_FILE}"

log "Updating source checkout"
git -C "${APP_DIR}" fetch --tags origin
branch="$(git -C "${APP_DIR}" rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" != "HEAD" ]]; then
	git -C "${APP_DIR}" pull --ff-only origin "${branch}"
else
	log "Repository in detached HEAD, keeping current commit"
fi

log "Installing dependencies"
(
	cd "${APP_DIR}"
	npm ci
)

log "Reloading PM2 ecosystem"
(
	cd "${APP_DIR}"
	pm2 startOrReload "${ECOSYSTEM_FILE}" --update-env
	pm2 save
)

log "Update completed"
