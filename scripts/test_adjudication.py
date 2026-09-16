"""
GenLayer On-Chain Escrow & AI Jury Adjudication Test
Executes a complete real on-chain task workflow with state polling:
1. Client creates escrow task
2. Polls until status is OPEN
3. Worker accepts task (locks collateral)
4. Polls until status is IN_PROGRESS
5. Worker submits deliverable
6. GenLayer Consensus AI Jury adjudicates criteria vs deliverable on-chain!
"""

import time
import json
from genlayer_py import create_client, create_account, generate_private_key, studionet

ESCROW_CONTRACT = '0x83C6fD61e60E13848aCe1499F1ea9bB745a8adB4'

CRITERIA_URL = 'https://raw.githubusercontent.com/tuannguyen1995/AgentEscrowCourt/master/README.md'
DELIVERABLE_URL = 'https://raw.githubusercontent.com/tuannguyen1995/AgentEscrowCourt/master/README.md'

# Hash matching GenLayer web.render output for README.md
CRITERIA_HASH = '6307885881ff5628b2fa449d5ffcade678664925b16711ba4cff9130c5d70f8b'

def get_task(cli, task_id):
    try:
        raw = cli.read_contract(address=ESCROW_CONTRACT, function_name="get_all_tasks", args=[])
        tasks = json.loads(raw) if isinstance(raw, str) else raw
        for t in tasks:
            if t.get('id') == task_id:
                return t
    except Exception:
        pass
    return None

def main():
    print("==================================================================")
    print("   GenLayer Real On-Chain Task & AI Jury Adjudication Test        ")
    print("==================================================================\n")

    client_acc = create_account(generate_private_key())
    worker_acc = create_account(generate_private_key())

    client_cli = create_client(chain=studionet, account=client_acc)
    worker_cli = create_client(chain=studionet, account=worker_acc)

    print(f"Client Address: {client_acc.address}")
    print(f"Worker Address: {worker_acc.address}\n")

    task_id = f"real_adjudicate_{int(time.time())}"
    title = "Real On-Chain AI Escrow Adjudication Test - Valid Deliverable"

    print(f"1. Creating Escrow Task '{task_id}'...")
    tx1 = client_cli.write_contract(
        address=ESCROW_CONTRACT,
        function_name="create_escrow",
        args=[task_id, title, CRITERIA_URL, CRITERIA_HASH, 72],
        value=100
    )
    print(f"   [SUCCESS] create_escrow TX: {tx1}")

    print("   Polling contract state until task is OPEN...")
    for _ in range(10):
        time.sleep(4)
        t = get_task(client_cli, task_id)
        if t and t.get('status') == 'OPEN':
            print("   [CONFIRMED] Task is OPEN on-chain!")
            break

    print(f"\n2. Worker Accepting Task '{task_id}'...")
    tx2 = worker_cli.write_contract(
        address=ESCROW_CONTRACT,
        function_name="accept_task",
        args=[task_id],
        value=20
    )
    print(f"   [SUCCESS] accept_task TX: {tx2}")

    print("   Polling contract state until task is IN_PROGRESS...")
    for _ in range(10):
        time.sleep(4)
        t = get_task(client_cli, task_id)
        if t and t.get('status') == 'IN_PROGRESS':
            print("   [CONFIRMED] Task is IN_PROGRESS on-chain!")
            break

    print(f"\n3. Submitting Deliverable & Triggering AI Jury Adjudication...")
    print("   (GenLayer Consensus validators are fetching evidence and running LLM evaluation on-chain...)")
    tx3 = worker_cli.write_contract(
        address=ESCROW_CONTRACT,
        function_name="submit_deliverable",
        args=[task_id, DELIVERABLE_URL]
    )
    print(f"   [SUCCESS] submit_deliverable TX: {tx3}")

    print(f"\n4. Polling contract state for final AI Jury Verdict...")
    for i in range(12):
        time.sleep(5)
        t = get_task(client_cli, task_id)
        if t and t.get('verdict') != 'NONE':
            print("\n=================== FINAL ON-CHAIN RESULT ===================")
            print(f"Task ID:         {t.get('id')}")
            print(f"Title:           {t.get('title')}")
            print(f"Status:          {t.get('status')}")
            print(f"Verdict:         {t.get('verdict')}")
            print(f"Confidence:      {t.get('confidence')}%")
            print(f"Verdict Reason:  {t.get('verdict_reason')}")
            print(f"Payout Ready At: {t.get('payout_ready_at')}")
            print("=============================================================\n")
            return

    print("   Timed out waiting for final verdict.")

if __name__ == "__main__":
    main()
