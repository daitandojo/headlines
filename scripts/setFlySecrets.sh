#!/bin/bash
# scripts/setFlySecrets.sh (version 1.0)

# A script to read a .env file and set the variables as Fly.io secrets.
# It builds a single command to set all secrets at once for efficiency.

# --- Configuration ---
ENV_FILE=".env"

# --- Pre-flight Checks ---

# Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found in the current directory."
    exit 1
fi

# Check for flyctl command
if ! command -v fly &> /dev/null
then
    echo "Error: 'fly' command-line tool not found."
    exit 1
fi

if [ ! -f "fly.toml" ]; then
    echo "Error: No fly.toml file found in this directory."
    echo "Please run 'fly launch' first."
    exit 1
fi

APP_NAME=$(grep '^app = ' fly.toml | cut -d "'" -f 2)
if [ -z "$APP_NAME" ]; then
    echo "Error: Could not determine app name from fly.toml."
    exit 1
fi

echo "Reading secrets from '$ENV_FILE' for app '$APP_NAME'..."

# --- Main Logic ---
secrets_args=()
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.* ]] || [[ -z "$line" ]]; then
        continue
    fi
    # Handle carriage return for Windows-edited .env files
    line=$(echo "$line" | tr -d '\r')
    key=$(echo "$line" | cut -d '=' -f 1)
    # Correctly extract value, even if it contains '='
    value=$(echo "$line" | sed -e "s/^$key=//")
    if [ -z "$key" ]; then
        continue
    fi
    # Use printf for robust quoting to handle special characters
    secrets_args+=("$(printf "%s=%s" "$key" "$value")")
    echo "  - Found secret: $key"
done < "$ENV_FILE"

if [ ${#secrets_args[@]} -eq 0 ]; then
    echo "No secrets to set were found in '$ENV_FILE'."
    exit 0
fi

echo ""
echo "The following secrets will be set for the app '$APP_NAME':"
for arg in "${secrets_args[@]}"; do
    key=$(echo "$arg" | cut -d '=' -f 1)
    echo "  - $key"
done
echo ""

read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled by user."
    exit 1
fi

echo "Setting secrets on Fly.io..."
fly secrets set --stage "${secrets_args[@]}"

if [ $? -eq 0 ]; then
    echo "✅ Successfully set ${#secrets_args[@]} secrets. A new release is being created."
else
    echo "❌ An error occurred while setting secrets."
    exit 1
fi