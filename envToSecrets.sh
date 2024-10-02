#!/bin/bash

# File path to your .env file
ENV_FILE="/home/mark/Repos/.env"

# Ensure the .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo ".env file not found at $ENV_FILE"
    exit 1
fi

# Create a variable to hold all key-value pairs
SECRETS=()

# Read the .env file line by line
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and lines starting with #
    if [[ -z "$key" || "$key" =~ ^# ]]; then
        continue
    fi

    # Remove any potential surrounding quotes from value
    value=$(echo "$value" | sed 's/^"//;s/"$//')

    # Append key-value pair to secrets array, ensuring proper quoting
    SECRETS+=("$key=$value")
done < "$ENV_FILE"

# Set all secrets at once
echo "Setting all secrets..."
flyctl secrets set "${SECRETS[@]}"

echo "All secrets have been set."       