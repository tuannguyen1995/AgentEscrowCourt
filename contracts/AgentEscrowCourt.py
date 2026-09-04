# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass

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
    status: u8  # 0: CREATED, 1: SUBMITTED, 2: RELEASED, 3: REFUNDED
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
        if task.status != u8(0):
            raise UserError("Task is not in CREATED state")
        if gl.message.sender != task.worker and gl.message.sender != task.client:
            raise UserError("Only worker or client can submit deliverable")
        if len(deliverable_url) == 0:
            raise UserError("Deliverable URL cannot be empty")

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
            raise UserError("Task is not ready for adjudication (must be SUBMITTED)")

        # Extract values BEFORE nondet block closure
        criteria_url = task.criteria_url
        deliverable_url = task.deliverable_url
        task_title = task.title
        amount = task.amount
        client = task.client
        worker = task.worker

        def leader_fn():
            # 1. Fetch criteria and deliverable directly on-chain via GenLayer web render
            criteria_text = gl.nondet.web.render(criteria_url, mode="text")
            deliverable_text = gl.nondet.web.render(deliverable_url, mode="text")

            # 2. LLM reasoning prompt
            prompt = f"""You are an impartial decentralized AI Judge evaluating a work deliverable for an Escrow Contract.
Task Title: {task_title}
Criteria Spec ({criteria_url}):
{criteria_text[:2000]}

Deliverable Submission ({deliverable_url}):
{deliverable_text[:2000]}

Instructions:
Evaluate if the deliverable satisfies the task criteria.
Respond ONLY in valid JSON format:
{{
  "verdict": "RELEASE" or "REFUND",
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

            # Semantic consensus check: compare ONLY the verdict ("RELEASE" vs "REFUND")
            return mine["verdict"] == leader_data["verdict"]

        # Run non-deterministic consensus across validators
        result = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = str(result.get("verdict", "REFUND")).upper()
        reason = str(result.get("reason", "AI Adjudication completed"))
        confidence = int(result.get("confidence", 80))

        if confidence < 50:
            raise UserError(f"AI Adjudication confidence too low ({confidence}%). Requires manual escalation.")

        if verdict == "RELEASE":
            # Release funds to worker
            gl.get_contract_at(worker).emit_transfer(value=amount)
            task.status = u8(2)  # RELEASED
            task.verdict_reason = f"VERDICT: RELEASED | Reason: {reason}"
            self.tasks[id_str] = task

            # Update reputation if contract is linked
            if _addr_to_str(self.reputation_contract) != "0x0000000000000000000000000000000000000000":
                try:
                    gl.get_contract_at(self.reputation_contract).update_reputation(worker, True)
                except Exception:
                    pass
            return "RELEASE"
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
