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

if ! command -v docker >/dev/null 2>&1; then
	log "Installing Docker Engine"
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/${ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
	chmod a+r /etc/apt/keyrings/docker.gpg
	echo \
		"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} \
		$(. /etc/os-release && echo "${VERSION_CODENAME}") stable" >/etc/apt/sources.list.d/docker.list
	apt-get update
	apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
	log "Docker already installed: $(docker --version)"
fi

if id "${DEPLOY_USER}" >/dev/null 2>&1; then
	log "Adding ${DEPLOY_USER} to docker group"
	usermod -aG docker "${DEPLOY_USER}" || true
fi

log "Creating deploy directories at ${DEPLOY_ROOT}"
install -d -m 0755 "${DEPLOY_ROOT}"
install -d -m 0755 "${DEPLOY_ROOT}/backups"

log "Setup complete"
log "Next step: run do-deploy.sh as ${DEPLOY_USER}"
