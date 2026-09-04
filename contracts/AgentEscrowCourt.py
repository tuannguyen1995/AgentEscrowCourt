# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

@allow_storage
@dataclass
class EscrowTask:
    id: u256
    client: Address
    worker: Address
    title: str
    criteria_url: str
    deliverable_url: str
    amount: bigint
    status: u8  # 0: CREATED, 1: SUBMITTED, 2: RELEASED, 3: REFUNDED, 4: RETRY
    attempts: u256  # Track submission attempts (Max 3)
    verdict_reason: str

class Contract(gl.Contract):
    tasks: TreeMap[str, EscrowTask]
    task_count: u256
    reputation_contract: Address
    owner: Address

    def __init__(self):
        self.owner = gl.message.sender
        self.task_count = u256(0)

    @gl.public.write
    def set_reputation_contract(self, rep_addr: Address) -> None:
        if gl.message.sender != self.owner:
            raise UserError("Only owner can set reputation contract")
        self.reputation_contract = rep_addr

    @gl.public.write.payable
    def create_escrow(self, title: str, criteria_url: str, worker: Address) -> u256:
        if gl.message.value <= bigint(0):
            raise UserError("Escrow amount must be greater than zero")
        if len(title) == 0:
            raise UserError("Title cannot be empty")
        if len(criteria_url) == 0:
            raise UserError("Criteria URL cannot be empty")

        new_id = self.task_count + u256(1)
        self.task_count = new_id

        task = EscrowTask(
            id=new_id,
            client=gl.message.sender,
            worker=worker,
            title=title,
            criteria_url=criteria_url,
            deliverable_url="",
            amount=gl.message.value,
            status=u8(0),
            attempts=u256(0),
            verdict_reason=""
        )

        self.tasks[str(new_id)] = task
        return new_id

    @gl.public.write
    def submit_deliverable(self, escrow_id: u256, deliverable_url: str) -> None:
        id_str = str(escrow_id)
        if id_str not in self.tasks:
            raise UserError("Escrow task not found")

        task = self.tasks[id_str]
        if task.status not in [u8(0), u8(4)]: # CREATED or RETRY
            raise UserError("Task is not in CREATED or RETRY state")
        if gl.message.sender != task.worker and gl.message.sender != task.client:
            raise UserError("Only assigned worker or client can submit deliverable")
        if len(deliverable_url) == 0:
            raise UserError("Deliverable URL cannot be empty")

        task.attempts = task.attempts + u256(1)
        if task.attempts > u256(3):
            raise UserError("Maximum 3 deliverable attempts reached for this task")

        task.deliverable_url = deliverable_url
        task.status = u8(1)  # SUBMITTED
        self.tasks[id_str] = task

    @gl.public.write
    def adjudicate(self, escrow_id: u256) -> str:
        id_str = str(escrow_id)
        if id_str not in self.tasks:
            raise UserError("Escrow task not found")

        task = self.tasks[id_str]
        if task.status != u8(1):
            raise UserError("Task is not in SUBMITTED state")

        # Extract state variables BEFORE non-deterministic closure
        criteria_url = task.criteria_url
        deliverable_url = task.deliverable_url
        task_title = task.title
        amount = task.amount
        client = task.client
        worker = task.worker
        current_attempt = task.attempts

        # 🔒 Dynamic Canary Token Defense against Prompt Injection (from DeliverableCourt/GrantAuditor)
        import hashlib
        canary_token = hashlib.sha256(f"court_{id_str}_{_addr_to_str(worker)}_{str(current_attempt)}".encode()).hexdigest()[:16]

        def is_unusable_render(text: str) -> bool:
            if not text or not text.strip():
                return True
            low = text.lower()
            error_keywords = [
                "404 not found", "error 404", "fetch failure", "network error",
                "unable to render", "connection refused", "500 internal server error"
            ]
            for kw in error_keywords:
                if kw in low:
                    return True
            return False

        def leader_fn():
            # 1. Multi-source evidence cross-referencing
            try:
                criteria_content = gl.nondet.web.render(criteria_url, mode="text")
            except Exception as e:
                criteria_content = f"Criteria fetch error: {str(e)}"

            evidence_blocks = []
            for url in deliverable_url.split(","):
                clean_url = url.strip()
                if not clean_url:
                    continue
                try:
                    res = gl.nondet.web.render(clean_url, mode="text")
                    if is_unusable_render(res[:400]):
                        evidence_blocks.append(f"Source ({clean_url}): [Warning: Unusable or error response rendered]")
                    else:
                        evidence_blocks.append(f"Source ({clean_url}):\n{res[:1500]}")
                except Exception as e:
                    evidence_blocks.append(f"Source ({clean_url}): Render error {str(e)}")

            combined_deliverables = "\n\n---\n\n".join(evidence_blocks) if evidence_blocks else "No deliverable content rendered."

            # 2. LLM evaluation prompt with Canary Token protection
            prompt = f"""You are an impartial decentralized AI Judge on GenLayer evaluating an Escrow deliverable.
Task Title: {task_title}
Attempt: {str(current_attempt)} / 3
Canary Security Token: {canary_token}

Criteria Spec ({criteria_url}):
{criteria_content[:1500]}

Deliverable Submission ({deliverable_url}):
{combined_deliverables}

Instructions:
Evaluate if the submitted deliverable satisfies the task criteria.
Valid Verdict Options:
- "RELEASE": Work fully meets criteria. Release funds to worker.
- "REFUND": Work fundamentally fails or is malicious. Refund client.
- "RETRY": Work is partially complete or has minor fixable issues (only if attempt < 3).

Respond ONLY in valid JSON format:
{{
  "verdict": "RELEASE" or "REFUND" or "RETRY",
  "confidence": 0-100,
  "reason": "Detailed step-by-step evaluation explanation."
}}"""

            res = gl.nondet.exec_prompt(prompt, response_format="json")
            return res

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_data = leader_res.calldata
            if not isinstance(leader_data, dict) or "verdict" not in leader_data:
                return False

            mine = leader_fn()
            if not isinstance(mine, dict) or "verdict" not in mine:
                return False

            # Semantic Consensus Check: Compare ONLY the verdict ("RELEASE", "REFUND", "RETRY")
            return mine["verdict"] == leader_data["verdict"]

        # Run non-deterministic consensus across validators
        result = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = str(result.get("verdict", "REFUND")).upper()
        reason = str(result.get("reason", "AI Adjudication completed"))
        confidence = int(result.get("confidence", 80))

        if confidence < 50:
            raise UserError(f"AI Adjudication confidence too low ({confidence}%). Manual escalation required.")

        if verdict == "RELEASE":
            # Release funds to worker
            gl.get_contract_at(worker).emit_transfer(value=amount)
            task.status = u8(2)  # RELEASED
            task.verdict_reason = f"VERDICT: RELEASED | Reason: {reason}"
            self.tasks[id_str] = task

            if _addr_to_str(self.reputation_contract) != "0x0000000000000000000000000000000000000000":
                try:
                    gl.get_contract_at(self.reputation_contract).update_reputation(worker, True)
                except Exception:
                    pass
            return "RELEASE"

        elif verdict == "RETRY" and current_attempt < u256(3):
            # Allow worker to retry submission
            task.status = u8(4)  # RETRY
            task.verdict_reason = f"VERDICT: RETRY (Attempt {str(current_attempt)}/3) | Feedback: {reason}"
            self.tasks[id_str] = task
            return "RETRY"

        else:
            # Refund funds to client
            gl.get_contract_at(client).emit_transfer(value=amount)
            task.status = u8(3)  # REFUNDED
            task.verdict_reason = f"VERDICT: REFUNDED | Reason: {reason}"
            self.tasks[id_str] = task

            if _addr_to_str(self.reputation_contract) != "0x0000000000000000000000000000000000000000":
                try:
                    gl.get_contract_at(self.reputation_contract).update_reputation(worker, False)
                except Exception:
                    pass
            return "REFUND"

    @gl.public.view
    def get_task(self, escrow_id: u256) -> dict:
        id_str = str(escrow_id)
        if id_str not in self.tasks:
            raise UserError("Escrow task not found")

        t = self.tasks[id_str]
        return {
            "id": t.id,
            "client": _addr_to_str(t.client),
            "worker": _addr_to_str(t.worker),
            "title": t.title,
            "criteria_url": t.criteria_url,
            "deliverable_url": t.deliverable_url,
            "amount": str(t.amount),
            "status": t.status,
            "attempts": t.attempts,
            "verdict_reason": t.verdict_reason
        }

    @gl.public.view
    def get_task_count(self) -> u256:
        return self.task_count


def _addr_to_str(addr: Address) -> str:
    try:
        return addr.as_hex
    except Exception:
        return str(addr)
