#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${WA2DC_DEPLOY_ROOT:-$HOME/wa2dc}"
APP_DIR="${WA2DC_APP_DIR:-${DEPLOY_ROOT}/app}"

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

command -v docker >/dev/null 2>&1 || die "docker not found"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"

log "Updating source checkout"
git -C "${APP_DIR}" fetch --tags origin
branch="$(git -C "${APP_DIR}" rev-parse --abbrev-ref HEAD)"
if [[ "${branch}" != "HEAD" ]]; then
	git -C "${APP_DIR}" pull --ff-only origin "${branch}"
else
	log "Repository in detached HEAD, keeping current commit"
fi

log "Pulling latest container image and recreating service"
(
	cd "${APP_DIR}"
	docker compose pull wa2dc
	docker compose up -d wa2dc
)

log "Update completed"
