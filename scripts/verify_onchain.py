"""
GenLayer On-Chain Verification Script
Verifies active status of deployed AgentEscrowCourt and AgentReputation contracts.
Usage:
    python scripts/verify_onchain.py
"""
import copy
from genlayer_py import create_client, create_account, generate_private_key, studionet

studio_next = copy.deepcopy(studionet)
studio_next.id = 61997
studio_next.name = 'GenLayer Studio Next'
studio_next.rpc_urls = {'default': {'http': ['https://studio-next.genlayer.com/api']}}

ESCROW_CONTRACT = '0x83C6fD61e60E13848aCe1499F1ea9bB745a8adB4'
REPUTATION_CONTRACT = '0xA3D92892EFF3523F1e94dA4AB18749416FaEd38C'

def main():
    print("=========================================================")
    print("  GenLayer Studio Next On-Chain Contract Verification   ")
    print("=========================================================\n")

    account = create_account(generate_private_key())
    client = create_client(chain=studio_next, account=account)

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
