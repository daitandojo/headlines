#!/bin/bash
# scripts/set-fly-secrets.sh (version 1.01)

# A script to read a .env file and set the variables as Fly.io secrets.
# It builds a single command to set all secrets at once for efficiency.

# --- Configuration ---
ENV_FILE=".env"

# --- Pre-flight Checks ---

# Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found in the current directory."
    echo "Please create a .env file or run this script from the project root."
    exit 1
fi

# Check for flyctl command
if ! command -v fly &> /dev/null
then
    echo "Error: 'fly' command-line tool not found."
    echo "Please install flyctl first: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if an app is associated with the current directory
APP_NAME=$(fly status --app 2>/dev/null)
if [ -z "$APP_NAME" ]; then
    echo "Error: No Fly.io app is associated with this directory."
    echo "Please run 'fly launch' in your project directory first."
    exit 1
fi

echo "Reading secrets from '$ENV_FILE'..."

# --- Main Logic ---

# Prepare the command arguments
secrets_args=()
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.* ]] || [[ -z "$line" ]]; then
        continue
    fi

    # Parse KEY=VALUE, handling values that might contain '='
    # This also removes potential surrounding quotes from the value
    key=$(echo "$line" | cut -d '=' -f 1)
    value=$(echo "$line" | sed -e 's/^[^=]*=//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')

    if [ -z "$key" ]; then
        echo "Warning: Skipping malformed line: $line"
        continue
    fi

    # Add to the arguments array in KEY=VALUE format.
    # The fly CLI handles quoting internally when passed as separate arguments.
    secrets_args+=("$key=$value")
    echo "  - Found secret: $key"
done < "$ENV_FILE"

# Check if any secrets were found
if [ ${#secrets_args[@]} -eq 0 ]; then
    echo "No secrets to set were found in '$ENV_FILE'."
    exit 0
fi

echo ""
echo "The following secrets will be set for the app '$APP_NAME':"
# Preview keys without values for security
for arg in "${secrets_args[@]}"; do
    key=$(echo "$arg" | cut -d '=' -f 1)
    echo "  - $key"
done
echo ""

# Ask for user confirmation
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo # Move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Operation cancelled by user."
    exit 1
fi

# Execute the command with all arguments properly escaped by the shell
echo "Setting secrets on Fly.io..."
fly secrets set --stage "${secrets_args[@]}"

# Check the exit status of the fly command
if [ $? -eq 0 ]; then
    echo "✅ Successfully set ${#secrets_args[@]} secrets. A new release is being created."
else
    echo "❌ An error occurred while setting secrets. Please review the output from the 'fly' command."
    exit 1
fi