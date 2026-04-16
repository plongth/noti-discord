#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_USER="${SUDO_USER:-${USER:-root}}"
DEPLOY_HOME="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6 || true)"
if [[ -z "${DEPLOY_HOME}" ]]; then
	DEPLOY_HOME="/root"
fi
DEPLOY_ROOT_DEFAULT="${DEPLOY_HOME}/wa2dc"
DEPLOY_ROOT="${1:-${DEPLOY_ROOT_DEFAULT}}"

log() {
	printf '[wa2dc-do-setup] %s\n' "$*"
}

die() {
	printf '[wa2dc-do-setup] ERROR: %s\n' "$*" >&2
	exit 1
}

on_error() {
	local line="$1"
	die "Setup failed at line ${line}."
}
trap 'on_error "$LINENO"' ERR

if [[ "$(id -u)" -ne 0 ]]; then
	die "Please run as root (example: sudo bash scripts/digitalocean/do-setup.sh)."
fi

if [[ ! -r /etc/os-release ]]; then
	die "Unsupported OS: /etc/os-release is missing."
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *"ubuntu"* && "${ID_LIKE:-}" != *"debian"* ]]; then
	die "This setup script currently supports Ubuntu/Debian only."
fi

log "Updating APT index"
apt-get update

log "Installing base dependencies"
apt-get install -y ca-certificates curl git gnupg lsb-release tar

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -Eq '^v2[4-9]\.'; then
	log "Installing Node.js 24.x from NodeSource"
	curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
	apt-get install -y nodejs
else
	log "Node.js already installed: $(node -v)"
fi

if ! command -v npm >/dev/null 2>&1; then
	die "npm not found after Node.js installation."
fi

if ! command -v pm2 >/dev/null 2>&1; then
	log "Installing PM2 globally"
	npm install -g pm2
else
	log "PM2 already installed: $(pm2 -v)"
fi

log "Creating deploy directories at ${DEPLOY_ROOT}"
install -d -m 0755 "${DEPLOY_ROOT}"
install -d -m 0755 "${DEPLOY_ROOT}/backups"

log "Setup complete"
log "Node: $(node -v)"
log "npm: $(npm -v)"
log "PM2: $(pm2 -v)"
log "Next step: run do-deploy.sh as ${DEPLOY_USER}"
