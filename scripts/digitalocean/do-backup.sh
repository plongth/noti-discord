#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

DEPLOY_ROOT="${WA2DC_DEPLOY_ROOT:-$HOME/wa2dc}"
APP_DIR="${WA2DC_APP_DIR:-${DEPLOY_ROOT}/app}"
BACKUP_DIR="${WA2DC_BACKUP_DIR:-${DEPLOY_ROOT}/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_DIR}/wa2dc-storage-${STAMP}.tar.gz"
RETENTION_DAYS="${WA2DC_BACKUP_RETENTION_DAYS:-14}"

log() {
	printf '[wa2dc-do-backup] %s\n' "$*"
}

die() {
	printf '[wa2dc-do-backup] ERROR: %s\n' "$*" >&2
	exit 1
}

on_error() {
	local line="$1"
	die "Backup failed at line ${line}."
}
trap 'on_error "$LINENO"' ERR

[[ -d "${APP_DIR}/storage" ]] || die "Storage directory not found: ${APP_DIR}/storage"
mkdir -p "${BACKUP_DIR}"

log "Creating backup archive ${ARCHIVE}"
tar -C "${APP_DIR}" -czf "${ARCHIVE}" storage

if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS > 0 )); then
	log "Pruning backups older than ${RETENTION_DAYS} days"
	find "${BACKUP_DIR}" -type f -name 'wa2dc-storage-*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete
fi

log "Backup done"
log "Archive: ${ARCHIVE}"
