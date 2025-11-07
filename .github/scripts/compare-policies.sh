#!/usr/bin/env bash
# Policy Comparison Script
#
# This script compares two normalised IAM policy JSON files for semantic differences.
# It ignores formatting and reports differences in a readable format.
#
# Usage:
#   ./compare-policies.sh <policy-file-1> <policy-file-2>
#
# Example:
#   ./compare-policies.sh deployed-policy.json repository-policy.json
#
# Exit codes:
#   0 - Always exits with 0 (success) to avoid blocking workflows
#
# Output:
#   - "Policies are identical" if no differences
#   - Detailed diff if differences exist

set -euo pipefail

# Check arguments
if [ $# -ne 2 ]; then
  echo "Usage: $0 <policy-file-1> <policy-file-2>" >&2
  exit 0  # Exit 0 to not block workflow
fi

POLICY_FILE_1="$1"
POLICY_FILE_2="$2"

# Check if policy files exist
if [ ! -f "$POLICY_FILE_1" ]; then
  echo "Error: Policy file not found: $POLICY_FILE_1" >&2
  exit 0  # Exit 0 to not block workflow
fi

if [ ! -f "$POLICY_FILE_2" ]; then
  echo "Error: Policy file not found: $POLICY_FILE_2" >&2
  exit 0  # Exit 0 to not block workflow
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed" >&2
  exit 0  # Exit 0 to not block workflow
fi

# Compare policies using jq for semantic comparison
DIFF_OUTPUT=$(diff -u \
  <(jq --sort-keys '.' "$POLICY_FILE_1") \
  <(jq --sort-keys '.' "$POLICY_FILE_2") \
  || true)

if [ -z "$DIFF_OUTPUT" ]; then
  echo "✓ Policies are identical"
  exit 0
else
  echo "⚠️  Policy differences detected:"
  echo ""
  echo "$DIFF_OUTPUT"
  echo ""
  echo "The deployed policy differs from the repository policy."
  echo "This may be intentional (e.g., testing in lower environment)."
  echo "Review the differences above to determine if action is needed."
  exit 0  # Always exit 0 to not block workflow
fi
