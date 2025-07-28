#!/bin/bash
# redeploy.sh
# A script to completely destroy, re-create, set secrets, and then redeploy the Fly.io app.
# This ensures a clean slate, removing any old machines or volumes.

# --- Configuration ---
# Colors for better logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;33[0m' # No Color

# --- Pre-flight Checks ---
echo -e "${YELLOW}--- Running Pre-flight Checks ---${NC}"

if ! command -v fly &> /dev/null; then
    echo -e "${RED}Error: 'fly' command-line tool not found.${NC}"
    exit 1
fi

if [ ! -f "fly.toml" ]; then
    echo -e "${RED}Error: No fly.toml file found in this directory.${NC}"
    exit 1
fi

if [ ! -f "scripts/setFlySecrets.sh" ]; then
    echo -e "${RED}Error: The secrets script is missing at 'scripts/setFlySecrets.sh'.${NC}"
    exit 1
fi

APP_NAME=$(grep '^app = ' fly.toml | cut -d "'" -f 2)

if [ -z "$APP_NAME" ]; then
    echo -e "${RED}Error: Could not determine app name from fly.toml.${NC}"
    exit 1
fi

echo -e "${GREEN}Checks passed. App name is '${APP_NAME}'.${NC}"
echo ""

# --- Step 1: Destroy the App (with confirmation and error handling) ---
echo -e "${YELLOW}--- Step 1: Destroying the App ---${NC}"
echo -e "${RED}WARNING: This is a destructive action. It will permanently delete the app '${APP_NAME}' if it exists.${NC}"
read -p "Are you absolutely sure you want to proceed with the full redeploy? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled by user."
    exit 1
fi

echo "Attempting to destroy '${APP_NAME}'..."
DESTROY_OUTPUT=$(fly apps destroy "$APP_NAME" --yes 2>&1)
DESTROY_STATUS=$?

if [ $DESTROY_STATUS -eq 0 ]; then
    echo -e "${GREEN}App '${APP_NAME}' destroyed successfully.${NC}"
elif echo "$DESTROY_OUTPUT" | grep -q "Could not find App"; then
    echo -e "${YELLOW}Warning: App '${APP_NAME}' did not exist. Continuing to the create step.${NC}"
else
    echo -e "${RED}An error occurred while trying to destroy the app:${NC}"
    echo "$DESTROY_OUTPUT"
    exit 1
fi
echo ""


# --- Step 2: Create the App ---
echo -e "${YELLOW}--- Step 2: Creating the App ---${NC}"
echo "Registering a new, empty app shell on Fly.io for '${APP_NAME}'..."

fly apps create "$APP_NAME" --org personal

if [ $? -ne 0 ]; then
    echo -e "${RED}An error occurred while creating the app. Please check the output above.${NC}"
    exit 1
fi
echo -e "${GREEN}Empty app shell for '${APP_NAME}' created successfully.${NC}"
echo ""


# --- Step 3: Set Secrets ---
echo -e "${YELLOW}--- Step 3: Setting Secrets ---${NC}"
echo "Running the setFlySecrets.sh script to populate environment variables..."

# Automatically answer 'y' to the confirmation prompt within setFlySecrets.sh
# to avoid being prompted twice.
echo 'y' | bash ./scripts/setFlySecrets.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}An error occurred while setting secrets. Please check the output above.${NC}"
    exit 1
fi
echo -e "${GREEN}Secrets set successfully.${NC}"
echo ""


# --- Step 4: Deploy the App ---
echo -e "${YELLOW}--- Step 4: Deploying the App ---${NC}"
echo "Deploying the project to the new instance of '${APP_NAME}'..."
echo "This will create a new release and 1 stopped machine with 2048MB of memory."

# MODIFIED: Use explicit flags to force the machine size during the initial deploy.
# This is the definitive way to set the size for this type of worker app.
fly deploy --vm-cpus 1 --vm-memory 2048

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully deployed '${APP_NAME}'. The initial machine has been configured with 2048MB of memory.${NC}"
else
    echo -e "${RED}❌ An error occurred during deployment. Please check the output above.${NC}"
    exit 1
fi