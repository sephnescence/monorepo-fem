#!/bin/bash

# Strict error handling
set -euo pipefail

# Service name for logging
SERVICE_NAME="cloudwatch-publisher-entrypoint"

# Logging functions
log() {
    echo "{\"service\": \"${SERVICE_NAME}\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"level\": \"INFO\", \"message\": \"$1\"}"
}

log_error() {
    echo "{\"service\": \"${SERVICE_NAME}\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"level\": \"ERROR\", \"message\": \"$1\"}" >&2
}

# Validate required environment variables at startup
validate_environment() {
    local missing_vars=()

    if [ -z "${AWS_REGION:-}" ]; then
        missing_vars+=("AWS_REGION")
    fi

    if [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
        missing_vars+=("AWS_ACCESS_KEY_ID")
    fi

    if [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        missing_vars+=("AWS_SECRET_ACCESS_KEY")
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_error "Please set: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
        exit 1
    fi

    log "Environment validation successful (AWS_REGION=${AWS_REGION})"
}

# Validate AWS credentials work
validate_aws_credentials() {
    log "Validating AWS credentials..."

    if ! aws sts get-caller-identity --region "${AWS_REGION}" &> /dev/null; then
        log_error "AWS credentials validation failed. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        exit 1
    fi

    log "AWS credentials validated successfully"
}

# Install crontab configuration
install_crontab() {
    log "Installing crontab configuration..."

    if [ ! -f /scripts/crontab ]; then
        log_error "Crontab file not found at /scripts/crontab"
        exit 1
    fi

    # Install crontab for the current user
    crontab /scripts/crontab

    log "Crontab installed successfully"
    log "Cron schedule: Every minute (*/1 * * * *)"
}

# Handle graceful shutdown
shutdown() {
    log "Received SIGTERM, initiating graceful shutdown..."

    # Stop cron daemon
    if [ -n "${CROND_PID:-}" ] && kill -0 "${CROND_PID}" 2>/dev/null; then
        log "Stopping cron daemon (PID: ${CROND_PID})..."
        kill -TERM "${CROND_PID}" 2>/dev/null || true
        wait "${CROND_PID}" 2>/dev/null || true
    fi

    log "Shutdown complete"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap shutdown SIGTERM SIGINT

# Main execution
main() {
    log "Starting CloudWatch Publisher container..."

    # Validate environment
    validate_environment
    validate_aws_credentials

    # Install crontab
    install_crontab

    # Start cron daemon
    log "Starting cron daemon..."

    # Start crond in background with logging
    # Alpine's dcron logs to syslog by default, but we redirect job output via crontab
    crond -b -l 2

    # Get the PID of crond (it forks, so we need to find it)
    CROND_PID=$(pgrep crond)
    log "Cron daemon started (PID: ${CROND_PID})"

    # Keep container running by waiting for crond process
    # This is a blocking operation that keeps PID 1 alive
    log "Container is running. Logs from scheduled jobs will appear below..."

    # Wait for crond to finish (it won't unless killed)
    # This keeps the container alive while allowing signal handling
    wait "${CROND_PID}" 2>/dev/null || true

    log "Cron daemon has stopped"
}

# Run main function
main
