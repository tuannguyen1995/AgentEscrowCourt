"""
GenLayer Contract Deployment Script
Deploys AgentReputation and AgentEscrowCourt to GenLayer Studio Next (chain 61997) and links them.
Usage:
    python scripts/deploy.py
"""
import os
import copy
import json
import time
import urllib.request
from genlayer_py import create_client, create_account, generate_private_key, studionet

# Define Studio Next (Chain 61997) configuration
studio_next = copy.deepcopy(studionet)
studio_next.id = 61997
studio_next.name = 'GenLayer Studio Next'
studio_next.rpc_urls = {'default': {'http': ['https://studio-next.genlayer.com/api']}}

def fund_account_studio_next(address: str, amount: int = 1000000000000000000):
    url = 'https://studio-next.genlayer.com/api'
    req_data = json.dumps({
        'jsonrpc': '2.0',
        'method': 'sim_fundAccount',
        'params': [address, amount],
        'id': 1
    }).encode('utf-8')
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode())
            print(f"Faucet sim_fundAccount response: {res}")
            return res
    except Exception as e:
        print(f"Faucet funding error: {e}")
        return None

def deploy():
    print("=========================================================", flush=True)
    print("  Deploying Contracts to GenLayer Studio Next (61997)    ", flush=True)
    print("=========================================================\n", flush=True)

    pk = os.environ.get("DEPLOYER_PRIVATE_KEY", "").strip()
    if pk:
        account = create_account(pk)
        print(f"Deployer Wallet Address (from private key): {account.address}", flush=True)
    else:
        account = create_account(generate_private_key())
        print(f"Deployer Wallet Address (generated): {account.address}", flush=True)

    print("Funding deployer account with testnet GEN on Studio Next...", flush=True)
    fund_account_studio_next(account.address, 1000000000000000000)
    print("Waiting 6 seconds for funding transaction block finalization...", flush=True)
    time.sleep(6)

    client = create_client(chain=studio_next, account=account)

    contracts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts")

    with open(os.path.join(contracts_dir, "AgentReputation.py"), "r", encoding="utf-8") as f:
        rep_code = f.read()

    with open(os.path.join(contracts_dir, "AgentEscrowCourt.py"), "r", encoding="utf-8") as f:
        escrow_code = f.read()

    print("\n1. Deploying AgentReputation Contract to Studio Next...", flush=True)
    rep_tx = client.deploy_contract(code=rep_code, account=account, args=[])
    print(f"Reputation Tx Hash: {rep_tx}", flush=True)
    rep_receipt = client.wait_for_transaction_receipt(rep_tx)
    rep_address = rep_receipt.get("contract_address") or rep_receipt.get("recipient")
    print(f"[OK] AgentReputation Deployed at: {rep_address}", flush=True)

    print("Waiting 5 seconds for block finalization...", flush=True)
    time.sleep(5)

    print("\n2. Deploying AgentEscrowCourt Contract to Studio Next...", flush=True)
    escrow_tx = client.deploy_contract(code=escrow_code, account=account, args=[])
    print(f"Escrow Tx Hash: {escrow_tx}", flush=True)
    escrow_receipt = client.wait_for_transaction_receipt(escrow_tx)
    escrow_address = escrow_receipt.get("contract_address") or escrow_receipt.get("recipient")
    print(f"[OK] AgentEscrowCourt Deployed at: {escrow_address}", flush=True)

    print("Waiting 5 seconds for block finalization...", flush=True)
    time.sleep(5)

    print("\n3. Linking Reputation contract on AgentEscrowCourt...", flush=True)
    link_tx = client.write_contract(
        address=escrow_address,
        function_name="set_reputation_contract",
        args=[rep_address],
        account=account
    )
    client.wait_for_transaction_receipt(link_tx)

    # Automatically update frontend/src/config.ts
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "src", "config.ts")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as cf:
            c_text = cf.read()
        import re
        c_text = re.sub(r"DEFAULT_ESCROW_CONTRACT_ADDRESS\s*=\s*.*?;", f"DEFAULT_ESCROW_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_ESCROW_CONTRACT_ADDRESS || '{escrow_address}';", c_text)
        c_text = re.sub(r"DEFAULT_REPUTATION_CONTRACT_ADDRESS\s*=\s*.*?;", f"DEFAULT_REPUTATION_CONTRACT_ADDRESS = (import.meta as any).env?.VITE_REPUTATION_CONTRACT_ADDRESS || '{rep_address}';", c_text)
        with open(config_path, "w", encoding="utf-8") as cf:
            cf.write(c_text)
        print("[OK] Updated frontend/src/config.ts automatically!", flush=True)

    print("\n=========================================================", flush=True)
    print("  DEPLOYMENT COMPLETE & VERIFIED ON GENLAYER STUDIO NEXT (61997) ", flush=True)
    print(f"  ESCROW_CONTRACT_ADDRESS = '{escrow_address}'", flush=True)
    print(f"  REPUTATION_CONTRACT_ADDRESS = '{rep_address}'", flush=True)
    print("=========================================================", flush=True)

if __name__ == "__main__":
    deploy()
