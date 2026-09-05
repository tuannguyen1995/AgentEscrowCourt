"""
GenLayer Contract Deployment Script
Deploys AgentReputation and AgentEscrowCourt to GenLayer Studionet and links them.
Usage:
    python scripts/deploy.py
"""
import os
from genlayer_py import create_client, create_account, generate_private_key, studionet

def deploy():
    print("=========================================================", flush=True)
    print("    Deploying Contracts to GenLayer Studionet           ", flush=True)
    print("=========================================================\n", flush=True)

    pk = os.environ.get("DEPLOYER_PRIVATE_KEY", "").strip()
    if pk:
        account = create_account(pk)
        print(f"Deployer Wallet Address (from private key): {account.address}", flush=True)
    else:
        account = create_account(generate_private_key())
        print(f"Deployer Wallet Address (generated): {account.address}", flush=True)
        print("Funding deployer account with testnet GEN...", flush=True)
        client.fund_account(address=account.address, amount=1000)

    contracts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "contracts")

    with open(os.path.join(contracts_dir, "AgentReputation.py"), "r", encoding="utf-8") as f:
        rep_code = f.read()

    with open(os.path.join(contracts_dir, "AgentEscrowCourt.py"), "r", encoding="utf-8") as f:
        escrow_code = f.read()

    print("\n1. Deploying AgentReputation Contract...", flush=True)
    rep_tx = client.deploy_contract(code=rep_code, account=account, args=[])
    print(f"Reputation Tx Hash: {rep_tx}", flush=True)
    rep_receipt = client.wait_for_transaction_receipt(rep_tx)
    rep_address = rep_receipt.get("contract_address") or rep_receipt.get("recipient")
    print(f"[OK] AgentReputation Deployed at: {rep_address}", flush=True)

    print("\n2. Deploying AgentEscrowCourt Contract...", flush=True)
    escrow_tx = client.deploy_contract(code=escrow_code, account=account, args=[])
    print(f"Escrow Tx Hash: {escrow_tx}", flush=True)
    escrow_receipt = client.wait_for_transaction_receipt(escrow_tx)
    escrow_address = escrow_receipt.get("contract_address") or escrow_receipt.get("recipient")
    print(f"[OK] AgentEscrowCourt Deployed at: {escrow_address}", flush=True)

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
    print("  DEPLOYMENT COMPLETE & VERIFIED ON GENLAYER STUDIONET ", flush=True)
    print(f"  ESCROW_CONTRACT_ADDRESS = '{escrow_address}'", flush=True)
    print(f"  REPUTATION_CONTRACT_ADDRESS = '{rep_address}'", flush=True)
    print("=========================================================", flush=True)

if __name__ == "__main__":
    deploy()
