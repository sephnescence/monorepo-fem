#!/usr/bin/env bash
#
# Sanitize conversation export files by removing personally identifiable information
#
# Usage: ./scripts/sanitize-conversation.sh <file>
#   or:  ./scripts/sanitize-conversation.sh <directory>
#
# This script replaces:
# - Full project paths with <PROJECT_ROOT>/<REPOSITORY_NAME>
# - Username with "<user>"
# - Git user name with "User"
# - "Welcome back <user>!" with "Welcome back User!"
#

set -e

# Get the project root (where .git directory is)
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

# Get repository name and parent path
REPO_NAME="$(basename "$PROJECT_ROOT")"
PARENT_PATH="$(dirname "$PROJECT_ROOT")"

# Get current username
CURRENT_USER="$(whoami)"

# Get git user name (for replacing in welcome messages)
GIT_USER_NAME="$(git config user.name 2>/dev/null || echo "")"

# Function to sanitise a single file
sanitise_file() {
    local file="$1"

    echo "Sanitising: $file"

    # Create backup
    cp "$file" "$file.bak"

    # Replace parent path with placeholder, keeping repository name
    sed -i '' "s|${PARENT_PATH}|<PROJECT_ROOT>|g" "$file"

    # Replace username with generic placeholder
    sed -i '' "s/${CURRENT_USER}/<user>/g" "$file"

    # Replace git user name if it exists
    if [ -n "$GIT_USER_NAME" ]; then
        sed -i '' "s/${GIT_USER_NAME}/<User>/g" "$file"
    fi

    sed -i '' "s/Welcome back [^!]*!/Welcome back User!/g" "$file"

    # Remove backup if successful
    rm "$file.bak"

    echo "✓ Sanitised: $file"
}

# Main logic
if [ $# -eq 0 ]; then
    echo "Error: No file or directory specified"
    echo "Usage: $0 <file|directory>"
    exit 1
fi

TARGET="$1"

if [ -f "$TARGET" ]; then
    # Single file
    sanitise_file "$TARGET"
elif [ -d "$TARGET" ]; then
    # Directory - process all .txt files
    find "$TARGET" -type f -name "*.txt" | while read -r file; do
        sanitise_file "$file"
    done
else
    echo "Error: '$TARGET' is not a valid file or directory"
    exit 1
fi

echo ""
echo "Done! All personally identifiable information has been replaced with generic placeholders."
