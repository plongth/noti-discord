#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${WA2DC_DEPLOY_ROOT:-$HOME/wa2dc}"
APP_DIR="${WA2DC_APP_DIR:-${DEPLOY_ROOT}/app}"
PM2_HOME_DIR="${PM2_HOME:-$HOME/.pm2}"

log() {
	printf '[wa2dc-do-log-cleanup] %s\n' "$*"
}

truncate_if_exists() {
	local file_path="$1"
	if [[ -f "${file_path}" ]]; then
		: >"${file_path}"
		log "Truncated ${file_path}"
	fi
}

if [[ -d "${APP_DIR}" ]]; then
	truncate_if_exists "${APP_DIR}/logs.txt"
	truncate_if_exists "${APP_DIR}/terminal.log"
fi

if [[ -d "${PM2_HOME_DIR}/logs" ]]; then
	while IFS= read -r -d '' file; do
		: >"${file}"
		log "Truncated ${file}"
	done < <(find "${PM2_HOME_DIR}/logs" -type f -name '*.log' -print0)
fi

truncate_if_exists "${PM2_HOME_DIR}/pm2.log"

if command -v pm2 >/dev/null 2>&1; then
	pm2 flush >/dev/null 2>&1 || true
	log "Ran pm2 flush"
fi

log "Log cleanup completed"
