#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

REPO_URL="${WA2DC_REPO_URL:-https://github.com/arespawn/WhatsAppToDiscord.git}"
REPO_REF="${WA2DC_REPO_REF:-}"
DEPLOY_ROOT="${WA2DC_DEPLOY_ROOT:-$HOME/wa2dc}"
APP_DIR="${WA2DC_APP_DIR:-${DEPLOY_ROOT}/app}"
ENV_FILE="${WA2DC_ENV_FILE:-${APP_DIR}/.env}"
ECOSYSTEM_FILE="${WA2DC_ECOSYSTEM_FILE:-${APP_DIR}/ecosystem.config.cjs}"

log() {
	printf '[wa2dc-do-deploy] %s\n' "$*"
}

die() {
	printf '[wa2dc-do-deploy] ERROR: %s\n' "$*" >&2
	exit 1
}

on_error() {
	local line="$1"
	die "Deploy failed at line ${line}."
}
trap 'on_error "$LINENO"' ERR

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_cmd git
require_cmd node
require_cmd npm
require_cmd pm2

if ! node -v | grep -Eq '^v2[4-9]\.'; then
	die "Node.js 24+ is required. Current: $(node -v). Run do-setup.sh first."
fi

mkdir -p "${DEPLOY_ROOT}"

if [[ -d "${APP_DIR}/.git" ]]; then
	log "Repository exists. Pulling latest changes"
	git -C "${APP_DIR}" fetch --tags origin
	if [[ -n "${REPO_REF}" ]]; then
		git -C "${APP_DIR}" checkout --detach "${REPO_REF}"
	else
		branch="$(git -C "${APP_DIR}" rev-parse --abbrev-ref HEAD)"
		if [[ "${branch}" != "HEAD" ]]; then
			git -C "${APP_DIR}" pull --ff-only origin "${branch}"
		fi
	fi
else
	log "Cloning repository to ${APP_DIR}"
	git clone "${REPO_URL}" "${APP_DIR}"
	if [[ -n "${REPO_REF}" ]]; then
		git -C "${APP_DIR}" checkout --detach "${REPO_REF}"
	fi
fi

if [[ ! -f "${ENV_FILE}" ]]; then
	if [[ -f "${APP_DIR}/.env.example" ]]; then
		cp "${APP_DIR}/.env.example" "${ENV_FILE}"
		log "Created ${ENV_FILE} from .env.example"
	else
		touch "${ENV_FILE}"
		log "Created empty ${ENV_FILE}"
	fi
fi

token_line="$(grep -E '^WA2DC_TOKEN=' "${ENV_FILE}" || true)"
token_value="${token_line#WA2DC_TOKEN=}"
token_value="${token_value%$'\r'}"
token_value="${token_value## }"
token_value="${token_value%% }"

if [[ -z "${token_line}" || -z "${token_value}" || "${token_value}" == "TOKEN_GO_HERE" || "${token_value}" == "CHANGE_THIS_TOKEN" ]]; then
	die "Please set a valid WA2DC_TOKEN in ${ENV_FILE} before deploy."
fi

if [[ ! -f "${ECOSYSTEM_FILE}" ]]; then
	die "PM2 ecosystem file not found: ${ECOSYSTEM_FILE}"
fi

mkdir -p "${APP_DIR}/storage"

log "Installing dependencies"
(
	cd "${APP_DIR}"
	npm ci
)

log "Starting/reloading PM2 ecosystem"
(
	cd "${APP_DIR}"
	pm2 startOrReload "${ECOSYSTEM_FILE}" --update-env
	pm2 save
)

log "Deployment finished"
log "Show logs: pm2 logs wa2dc-bot --lines 200"
log "Show logs: pm2 logs arespawn-wrapper --lines 200"
