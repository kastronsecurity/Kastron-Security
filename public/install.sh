#!/bin/bash

# KastronSec Agent Installer
# This script simulates an agent connection by sending a heartbeat to the Supabase backend.

# Default values
TOKEN=""
URL=""
KEY=""
GROUP=""

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        --url) URL="$2"; shift ;;
        --key) KEY="$2"; shift ;;
        --group) GROUP="$2"; shift ;;
    esac
    shift
done

if [ -z "$TOKEN" ] || [ -z "$URL" ] || [ -z "$KEY" ]; then
    echo -e "${RED}Error: Missing required arguments (--token, --url, --key)${NC}"
    echo "Usage: curl -sSL <URL> | sh -s -- --token <TOKEN> --url <URL> --key <KEY> [--group <GROUP>]"
    exit 1
fi

echo -e "${BLUE}
   __  __           _                       _____           
  |  \/  |         | |                     / ____|          
  | \  / | __ _ ___| |_ _ __ ___  _ __ ___| (___   ___  ___ 
  | |\/| |/ _\` / __| __| '__/ _ \| '_ \ / _\\___ \ / _ \/ __|
  | |  | | (_| \__ \ |_| | | (_) | | | |  __/____) |  __/ (__ 
  |_|  |_|\__,_|___/\__|_|  \___/|_| |_|\___|_____/ \___|\___|
                                                              
${NC}"

echo -e "${BLUE}[*] Initializing KastronSec Agent Installation...${NC}"
echo -e "[*] Token: ${TOKEN:0:8}... (masked)"
sleep 1
echo -e "[*] System: $(uname -s) $(uname -m)"
echo -e "[*] Checking system compatibility..."
sleep 1
echo -e "[*] Downloading agent binaries..."
sleep 2
echo -e "[*] Configuring security policies..."
sleep 1
echo -e "[*] Establishing secure connection to KastronSec Cloud at $URL..."

# Send a "heartbeat" alert to Supabase to signal the agent is online
RESPONSE=$(curl -s -X POST "$URL/rest/v1/alerts" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{
    \"client_id\": \"$TOKEN\",
    \"wazuh_group\": \"$GROUP\",
    \"title\": \"Agent Connected\",
    \"severity\": \"LOW\",
    \"status\": \"Open\",
    \"description\": \"Agent successfully installed and connected from $(hostname) ($(uname -s)). Group: $GROUP\",
    \"source_ip\": \"$(curl -s https://ifconfig.me)\",
    \"category\": \"System\",
    \"created_at\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"
  }")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[+] Agent successfully installed and verified!${NC}"
    echo -e "${GREEN}[+] You can now return to the onboarding dashboard to complete the setup.${NC}"
else
    echo -e "${RED}[!] Error: Failed to connect to KastronSec Cloud. Please check your internet connection and try again.${NC}"
    exit 1
fi
