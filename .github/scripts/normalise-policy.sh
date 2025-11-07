#!/usr/bin/env bash
# Policy Normalisation Script
#
# This script normalises IAM policy JSON by:
# 1. Substituting placeholders (${AWS_ACCOUNT_ID}, ${AWS_REGION}, ${ENVIRONMENT})
# 2. Sorting JSON keys for consistent comparison
# 3. Pretty-printing for readability
#
# Usage:
#   ./normalise-policy.sh <policy-file> <aws-account-id> <aws-region> <environment>
#
# Example:
#   ./normalise-policy.sh heartbeat-policy.json 123456789012 ap-southeast-2 dev

set -euo pipefail

# Check arguments
if [ $# -ne 4 ]; then
  echo "Usage: $0 <policy-file> <aws-account-id> <aws-region> <environment>" >&2
  exit 1
fi

POLICY_FILE="$1"
AWS_ACCOUNT_ID="$2"
AWS_REGION="$3"
ENVIRONMENT="$4"

# Check if policy file exists
if [ ! -f "$POLICY_FILE" ]; then
  echo "Error: Policy file not found: $POLICY_FILE" >&2
  exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 1
fi

# Read policy, substitute placeholders, sort keys, and pretty-print
cat "$POLICY_FILE" | \
  sed "s/\${AWS_ACCOUNT_ID}/${AWS_ACCOUNT_ID}/g" | \
  sed "s/\${AWS_REGION}/${AWS_REGION}/g" | \
  sed "s/\${ENVIRONMENT}/${ENVIRONMENT}/g" | \
  jq --sort-keys '.'
