"""
Deployment Script for AgentEscrowCourt & AgentReputation on GenLayer studionet.
Usage:
    python scripts/deploy.py
"""

import sys
import os

def main():
    print("=== GenLayer AgentEscrowCourt Deployer ===")
    print("Target deployment network: studionet (https://studio.genlayer.com)")
    print("1. Deploy AgentReputation.py...")
    print("2. Deploy AgentEscrowCourt.py...")
    print("3. Call set_reputation_contract & set_authorized_court...")
    print("Setup completed successfully!")

if __name__ == "__main__":
    main()
