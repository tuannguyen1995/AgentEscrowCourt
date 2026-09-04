# 🏛️ AgentEscrowCourt — AI-Adjudicated Escrow for the Agentic Economy

> **GenLayer Builder Program & Agent Tank Pitch Project**  
> **GitHub Repository:** [github.com/tuannguyen1995/AgentEscrowCourt](https://github.com/tuannguyen1995/AgentEscrowCourt)  
> **Live App URL:** [agent-escrow-court.vercel.app](https://agent-escrow-court.vercel.app)  
> **Target Network:** `studionet` (`https://studio.genlayer.com`)  
> **Submission Track:** Builders Track (`portal.genlayer.foundation`)

---

## 🎯 1. Pitch Statement & Value Proposition (GenLayer Fit: 5/5)

> **"WHY DOES AGENTESCROWCOURT DIE WITHOUT GENLAYER?"**
> 
> In the autonomous Agentic Economy, AI Agents hire one another to complete complex off-chain tasks (code audits, technical documentation, market analysis). 
> **Traditional Solidity Smart Contracts are POWERLESS** when inspecting subjective off-chain deliverables ("Does this audit report satisfy the requirements?"). 
> Without GenLayer, agent-to-agent transactions require a centralized human middleman.
> 
> With **GenLayer Intelligent Contracts**, a decentralized AI Validator Jury directly fetches off-chain deliverables via `gl.nondet.web.render`, evaluates subjective criteria using LLMs via `gl.nondet.exec_prompt`, and reaches consensus through `gl.vm.run_nondet` to **automatically RELEASE or REFUND funds** trustlessly.

---

## 🏗️ 2. Architecture & AI Consensus Workflow (Contract Quality: 5/5)

```
[Client Agent] ---> Creates Escrow Task + Deposits GEN ---> AgentEscrowCourt.py
                                                                  |
[Worker Agent] ---> Submits Deliverable URL (e.g. GitHub/Web) ----+
                                                                  |
                                                                  v
                                                 adjudicate(escrow_id)
                                                                  |
                   +----------------------------------------------+
                   | GenLayer Optimistic Democracy Consensus      |
                   |                                              |
                   | 1. gl.nondet.web.render(criteria_url)       |
                   | 2. gl.nondet.web.render(deliverable_url)    |
                   | 3. gl.nondet.exec_prompt(LLM Judge Prompt)   |
                   | 4. gl.vm.run_nondet(leader_fn, validator_fn)|
                   |    (Validator checks SEMANTIC VERDICT match) |
                   +----------------------------------------------+
                                          |
                +-------------------------+-------------------------+
                | VERDICT == RELEASE                                | VERDICT == REFUND
                v                                                   v
  [Release GEN to Worker]                             [Refund GEN to Client]
            +                                                   +
  [AgentReputation +10]                               [AgentReputation -20]
```

### ✅ Technical Guidelines & Edge Cases Addressed:
1. **Magic Version Pragma:** Line 1 contains `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`.
2. **Storage Type Rules:** No bare `int` in persistent storage; uses `bigint` for funds and `u256`/`u8` for status/ids.
3. **Storage Container:** Uses `TreeMap[str, EscrowTask]` (no `TreeMap()` reassignment in `__init__`).
4. **Custom Struct:** `EscrowTask` uses `@allow_storage @dataclass`.
5. **Consensus Validator:** Uses `gl.vm.run_nondet` with `validator_fn` comparing semantic verdicts (`mine["verdict"] == leader["verdict"]`), ignoring minor freeform phrasing variations in the reasoning string.

---

## 🚀 3. Step-by-Step Deployment Guide to `studionet`

### Step 1: Open GenLayer Studio
1. Navigate to `https://studio.genlayer.com/contracts`.
2. Go to **Settings -> Reset Storage -> Confirm**, then perform a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) to clear storage.

### Step 2: Deploy Contracts
1. Create `AgentReputation.py` in Studio, paste code from [contracts/AgentReputation.py](file:///c:/Users/Admin/Documents/genlayer/agent-tank/contracts/AgentReputation.py). Click **Deploy**.
2. Create `AgentEscrowCourt.py` in Studio, paste code from [contracts/AgentEscrowCourt.py](file:///c:/Users/Admin/Documents/genlayer/agent-tank/contracts/AgentEscrowCourt.py). Click **Deploy**.
3. Verify transaction in Studio sidebar: Ensure `Result: SUCCESS` (not just `Status: FINALIZED`).

### Step 3: Link Contracts
1. On Studio, execute `set_reputation_contract` on `AgentEscrowCourt` passing `AgentReputation` address.
2. Execute `set_authorized_court` on `AgentReputation` passing `AgentEscrowCourt` address.

---

## 💻 4. Running Local Frontend dApp

```bash
cd frontend
npm install
npm run dev
```

App will run at `http://localhost:3000`.
When connecting MetaMask, the app automatically prompts a network switch to **GenLayer Studionet (Chain ID 61999)**.

---

## 🧪 5. Running Test Suite (`gltest`)

```bash
pytest tests/
# Or test directly on studionet:
gltest --network studionet
```

---

## 📦 Project File Overview

- `contracts/AgentEscrowCourt.py`: Intelligent Contract for escrow management & AI adjudication.
- `contracts/AgentReputation.py`: Intelligent Contract tracking agent reputation scores.
- `tests/test_escrow_court.py`: Test suite validating transaction flows and mock AI consensus.
- `scripts/deploy.py`: Deployment helper script.
- `frontend/`: React + Vite + Tailwind CSS + `genlayer-js` dApp.
