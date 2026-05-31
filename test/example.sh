#!/bin/bash
# Shell example — Code Scavenge test file

log() {
    echo "[$(date +%H:%M:%S)] $*"
}

die() {
    echo "ERROR: $*" >&2
    exit 1
}

function ensure_dir() {
    local dir="$1"
    [ -d "$dir" ] || mkdir -p "$dir" || die "Cannot create directory: $dir"
}

function require_cmd() {
    command -v "$1" &>/dev/null || die "Required command not found: $1"
}

function latest_tag() {
    git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"
}

function build_project() {
    local target="${1:-release}"
    log "Building: $target"
    npm run build -- --mode "$target"
}

function deploy() {
    local env="$1"
    require_cmd rsync
    build_project "$env"
    log "Deploying to $env..."
}

# Aliases
alias ll='ls -lah --color=auto'
alias gs='git status'
alias gp='git push'
alias gl='git log --oneline --graph --decorate'
alias ..='cd ..'
