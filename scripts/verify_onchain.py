"""
GenLayer On-Chain Verification Script
Verifies active status of deployed AgentEscrowCourt and AgentReputation contracts.
Usage:
    python scripts/verify_onchain.py
"""
from genlayer_py import create_client, create_account, generate_private_key, studionet

ESCROW_CONTRACT = '0xA54F3a19A737212c838e0fF4ADD5A1ecC721EEd8'
REPUTATION_CONTRACT = '0x072e90DFD02e0716695133C7d772250B81735183'

def main():
    print("=========================================================")
    print("      GenLayer On-Chain Contract Verification           ")
    print("=========================================================\n")

    account = create_account(generate_private_key())
    client = create_client(chain=studionet, account=account)

    print(f"1. Checking AgentEscrowCourt ({ESCROW_CONTRACT})...")
    try:
        tasks = client.read_contract(
            address=ESCROW_CONTRACT,
            function_name="get_all_tasks",
            args=[]
        )
        if isinstance(tasks, str):
            import json
            tasks = json.loads(tasks)
        print(f"   [OK] Contract is ACTIVE. Total tasks recorded: {len(tasks)}")
        for t in tasks[-3:]:
            task_id = t.get('id') or t.get('task_id')
            reward = t.get('bounty') or t.get('reward') or t.get('amount')
            status = t.get('status')
            print(f"      - ID: {task_id} | Reward: {reward} GEN | Status: {status}")
    except Exception as e:
        print(f"   [FAIL] Failed to read escrow contract: {e}")

    print(f"\n2. Checking AgentReputation ({REPUTATION_CONTRACT})...")
    try:
        leaderboard = client.read_contract(
            address=REPUTATION_CONTRACT,
            function_name="get_all_reputations",
            args=[]
        )
        print(f"   [OK] Contract is ACTIVE. Total agents tracked: {len(leaderboard)}")
    except Exception as e:
        print(f"   [FAIL] Failed to read reputation contract: {e}")

    print("\n=========================================================")
    print("  Verification Finished!                                 ")
    print("=========================================================")

if __name__ == "__main__":
    main()
