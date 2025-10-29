# Use Alpine Linux 3.19 as base image
# Alpine is minimal (~7MB) and well-suited for containerised bash scripts
FROM alpine:3.19

# Install only essential packages
# bash: Required for scripts (Alpine uses ash by default)
# aws-cli: CloudWatch integration for publishing logs
# dcron: Alpine's lightweight cron daemon for scheduling
RUN apk add --no-cache \
    bash \
    aws-cli \
    dcron

# Create non-root user for security
# Running as non-root limits blast radius of potential vulnerabilities
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy scripts to container
# Using COPY (not ADD) as it's more explicit and cached by Docker
COPY scripts/ /scripts/

# Make scripts executable
# Ensures all scripts can be executed without manual chmod
RUN chmod +x /scripts/*.sh

# Set ownership to non-root user
# Non-root user must own files to execute them and manage cron
RUN chown -R appuser:appgroup /scripts

# Switch to non-root user
# All subsequent operations and runtime execution will be as this user
USER appuser

# Set default environment variable
# Users can override this at runtime with -e flag
ENV AWS_REGION=ap-southeast-2

# Container entrypoint
# This script validates environment, installs crontab, and starts crond
ENTRYPOINT ["/scripts/entrypoint.sh"]
