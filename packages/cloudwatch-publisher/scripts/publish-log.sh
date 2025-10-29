#!/bin/bash

# Strict error handling
set -euo pipefail

# Service name for structured logging
SERVICE_NAME="cloudwatch-publisher"

# Logging functions
log() {
    echo "{\"service\": \"${SERVICE_NAME}\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"level\": \"INFO\", \"message\": \"$1\"}"
}

log_error() {
    echo "{\"service\": \"${SERVICE_NAME}\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"level\": \"ERROR\", \"message\": \"$1\"}" >&2
}

# Validate AWS CLI is available
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed or not in PATH"
    exit 1
fi

# Validate required environment variables
if [ -z "${AWS_REGION:-}" ]; then
    log_error "AWS_REGION environment variable is required"
    exit 1
fi

# CloudWatch Logs configuration
LOG_GROUP_NAME="/monorepo-fem/heartbeat"
LOG_STREAM_NAME="heartbeat-$(date -u +"%Y-%m-%d")"

# Retry configuration
MAX_RETRIES=3
RETRY_COUNT=0

# Ensure log group exists (idempotent)
ensure_log_group() {
    aws logs create-log-group \
        --log-group-name "${LOG_GROUP_NAME}" \
        --region "${AWS_REGION}" 2>/dev/null || true
}

# Ensure log stream exists (idempotent)
ensure_log_stream() {
    aws logs create-log-stream \
        --log-group-name "${LOG_GROUP_NAME}" \
        --log-stream-name "${LOG_STREAM_NAME}" \
        --region "${AWS_REGION}" 2>/dev/null || true
}

# Function to publish log event to CloudWatch Logs
publish_log() {
    # Get current timestamp in milliseconds since epoch
    TIMESTAMP=$(date +%s)000

    # Build JSON log message
    LOG_MESSAGE=$(cat <<EOF
{
  "service": "monorepo-fem-heartbeat",
  "event": "heartbeat",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metadata": {
    "container": "${HOSTNAME:-unknown}",
    "region": "${AWS_REGION}"
  }
}
EOF
)

    # Put log event (without sequence token - CloudWatch will handle it)
    aws logs put-log-events \
        --log-group-name "${LOG_GROUP_NAME}" \
        --log-stream-name "${LOG_STREAM_NAME}" \
        --log-events timestamp="${TIMESTAMP},message='${LOG_MESSAGE}'" \
        --region "${AWS_REGION}"
}

# Ensure log group and stream exist before publishing
ensure_log_group
ensure_log_stream

# Retry logic with exponential backoff
while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
    if publish_log; then
        log "Successfully published log to CloudWatch Logs (log-group: ${LOG_GROUP_NAME}, log-stream: ${LOG_STREAM_NAME}, region: ${AWS_REGION})"
        exit 0
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; then
            BACKOFF=$((2 ** RETRY_COUNT))
            log_error "Failed to publish log, retrying in ${BACKOFF} seconds (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
            sleep ${BACKOFF}
        fi
    fi
done

# All retries exhausted
log_error "Failed to publish log after ${MAX_RETRIES} attempts"
exit 1
