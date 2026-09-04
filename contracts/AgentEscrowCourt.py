# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

@allow_storage
@dataclass
class EscrowTask:
    id: str
    client: str
    worker: str
    title: str
    criteria_url: str
    deliverable_url: str
    amount: bigint
    worker_stake: bigint
    status: str            # OPEN, IN_PROGRESS, AWAITING_PAYOUT, NEEDS_REVISION, DISPUTED, ESCALATED, CLOSED
    attempts: bigint
    verdict: str           # RELEASE, REFUND, RETRY, ESCALATE
    verdict_reason: str
    confidence: bigint
    payout_ready_at: bigint
    deadline: bigint

class Contract(gl.Contract):
    platform_admin: str
    reputation_contract: str
    tasks: TreeMap[str, EscrowTask]
    task_count: bigint
    task_ids: TreeMap[bigint, str]

    def __init__(self):
        try:
            self.platform_admin = str(gl.message.sender).lower()
        except Exception:
            self.platform_admin = str(getattr(gl.message, "sender_address", "0x0000000000000000000000000000000000000000")).lower()
        self.reputation_contract = "0x0000000000000000000000000000000000000000"
        self.tasks = TreeMap()
        self.task_count = bigint(0)
        self.task_ids = TreeMap()

    def _get_caller(self) -> str:
        try:
            return str(gl.message.sender).lower()
        except Exception:
            return str(getattr(gl.message, "sender_address", "0x0000000000000000000000000000000000000000")).lower()

    def _get_current_timestamp(self) -> bigint:
        """Derive trusted execution timestamp strictly from transaction context."""
        try:
            dt_raw = gl.message_raw.get("datetime", None) if isinstance(gl.message_raw, dict) else None
            if dt_raw:
                from datetime import datetime
                dt = datetime.fromisoformat(str(dt_raw).replace("Z", "+00:00"))
                ts = int(dt.timestamp())
                if ts > 0:
                    return bigint(ts)
        except Exception:
            pass
        # Fallback to standard execution timestamp if context is omitted
        import time
        return bigint(int(time.time()))

    def _parse_llm_json(self, response_str: str) -> dict:
        if isinstance(response_str, dict):
            return response_str
        if hasattr(response_str, "__dict__"):
            return response_str.__dict__
        t = str(response_str).strip()
        if t.startswith("```json"):
            t = t[7:]
        elif t.startswith("```"):
            t = t[3:]
        if t.endswith("```"):
            t = t[:-3]
        try:
            return json.loads(t.strip())
        except Exception as e:
            return {"verdict": "ESCALATE", "confidence": 0, "reason": f"JSON parse failure: {str(e)}"}

    def _effective_verdict(self, data: dict) -> str:
        verdict = str(data.get("verdict", "ESCALATE")).upper().strip()
        if verdict not in {"RELEASE", "REFUND", "RETRY", "ESCALATE"}:
            verdict = "ESCALATE"
        try:
            conf = int(data.get("confidence", 0))
        except Exception:
            conf = 0
        if conf < 65:
            verdict = "ESCALATE"
        return verdict

    @gl.public.write
    def set_reputation_contract(self, rep_addr: str) -> None:
        caller = self._get_caller()
        if caller != self.platform_admin:
            raise UserError("Only platform admin can set reputation contract")
        self.reputation_contract = rep_addr.lower().strip()

    @gl.public.write.payable
    def create_escrow(self, task_id: str, title: str, criteria_url: str, deadline_hours: bigint = bigint(72)) -> None:
        if task_id in self.tasks:
            raise UserError(f"Task ID {task_id} already exists")
        amount = gl.message.value
        if amount <= bigint(0):
            raise UserError("Escrow reward must be strictly greater than zero")
        if not criteria_url.startswith("http"):
            raise UserError("Valid specification HTTP/HTTPS URL required")

        caller = self._get_caller()
        dur = deadline_hours * bigint(3600) if deadline_hours > bigint(0) else bigint(259200)

        self.tasks[task_id] = EscrowTask(
            id=task_id,
            client=caller,
            worker="0x0000000000000000000000000000000000000000",
            title=title.strip(),
            criteria_url=criteria_url.strip(),
            deliverable_url="",
            amount=amount,
            worker_stake=bigint(0),
            status="OPEN",
            attempts=bigint(0),
            verdict="NONE",
            verdict_reason="Awaiting worker acceptance and collateral lock",
            confidence=bigint(0),
            payout_ready_at=bigint(0),
            deadline=self._get_current_timestamp() + dur
        )
        self.task_ids[self.task_count] = task_id
        self.task_count += bigint(1)

    @gl.public.write.payable
    def accept_task(self, task_id: str) -> None:
        """Worker locks 15% collateral stake to claim the escrow task."""
        if task_id not in self.tasks:
            raise UserError("Task not found")
        task = self.tasks[task_id]
        if task.status != "OPEN":
            raise UserError("Task is not in OPEN status")

        caller = self._get_caller()
        if caller == task.client:
            raise UserError("Client cannot accept their own task")

        min_stake = (task.amount * bigint(15)) // bigint(100)
        if gl.message.value < min_stake or gl.message.value <= bigint(0):
            raise UserError(f"Insufficient worker stake. Minimum 15% required ({min_stake})")

        task.worker = caller
        task.worker_stake = gl.message.value
        task.status = "IN_PROGRESS"
        self.tasks[task_id] = task

    @gl.public.write
    def submit_deliverable(self, task_id: str, deliverable_url: str) -> None:
        if task_id not in self.tasks:
            raise UserError("Task not found")
        task = self.tasks[task_id]
        caller = self._get_caller()

        if caller != task.worker:
            raise UserError("Only assigned worker can submit deliverable")
        if task.status not in ["IN_PROGRESS", "NEEDS_REVISION"]:
            raise UserError("Task is not ready for submission")
        if not deliverable_url.startswith("http"):
            raise UserError("Valid deliverable HTTP/HTTPS URL required")

        task.attempts += bigint(1)
        if task.attempts > bigint(3):
            raise UserError("Maximum 3 submission attempts exceeded")

        task.deliverable_url = deliverable_url.strip()

        criteria_str = task.criteria_url
        deliverable_str = task.deliverable_url
        task_title = task.title
        attempt_num = str(task.attempts)

        def leader_fn() -> dict:
            try:
                c_res = gl.nondet.web.render(criteria_str, mode="text")
                c_text = str(c_res)
                if any(err in c_text[:400].lower() for err in ["404 not found", "error 404"]):
                    return {"verdict": "ESCALATE", "confidence": 100, "reason": "Criteria spec endpoint is 404; escrow locked."}
            except Exception as e:
                return {"verdict": "ESCALATE", "confidence": 100, "reason": f"Criteria fetch failed: {str(e)}"}

            try:
                d_res = gl.nondet.web.render(deliverable_str, mode="text")
                d_text = str(d_res)
                if any(err in d_text[:400].lower() for err in ["404 not found", "error 404"]):
                    return {"verdict": "REFUND", "confidence": 100, "reason": "Deliverable endpoint is 404 or empty."}
            except Exception as e:
                return {"verdict": "REFUND", "confidence": 100, "reason": f"Deliverable fetch failed: {str(e)}"}

            # Untruncated full evidence ingestion
            prompt = f"""You are an impartial decentralized AI Court Judge on GenLayer evaluating an Escrow deliverable.
Task Title: {task_title}
Attempt: {attempt_num} / 3

CRITERIA SPECIFICATION (FULL EVIDENCE):
{c_text}

SUBMITTED DELIVERABLE (FULL EVIDENCE):
{d_text}

DECISION FRAMEWORK:
- "RELEASE": Work fully satisfies the specifications. Escrow payout approved.
- "REFUND": Work is completely missing, plagiarized, or fails critical requirements.
- "RETRY": Work is partially complete with minor fixable flaws (only if attempt < 3).
- "ESCALATE": Content is ambiguous, contradictory, or requires human arbitration.

Respond ONLY with valid JSON:
{{"verdict": "RELEASE|REFUND|RETRY|ESCALATE", "confidence": 0-100, "reason": "Detailed step-by-step evaluation trace."}}"""

            res = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(res, dict):
                return res
            return self._parse_llm_json(str(res))

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_data = leader_res.calldata if hasattr(leader_res, "calldata") else leader_res
            if not isinstance(leader_data, dict):
                leader_data = self._parse_llm_json(str(leader_data))
            mine_data = leader_fn()
            return self._effective_verdict(leader_data) == self._effective_verdict(mine_data)

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        if not isinstance(result, dict):
            result = self._parse_llm_json(str(result))

        final_verdict = self._effective_verdict(result)
        try:
            conf = int(result.get("confidence", 0))
        except Exception:
            conf = 0
        reason = str(result.get("reason", "AI Adjudication completed"))

        if conf < 65:
            reason = f"[Confidence {conf}% < 65%] " + reason

        task.verdict = final_verdict
        task.verdict_reason = reason
        task.confidence = bigint(conf)

        if final_verdict == "RELEASE":
            task.status = "AWAITING_PAYOUT"
            task.payout_ready_at = self._get_current_timestamp() + bigint(86400) # 24h cooling-off
        elif final_verdict == "RETRY" and task.attempts < bigint(3):
            task.status = "NEEDS_REVISION"
        elif final_verdict == "REFUND":
            if task.attempts < bigint(2):
                task.status = "NEEDS_REVISION"
            else:
                # Double failure slashing
                task.status = "CLOSED"
                total_refund = task.amount + task.worker_stake
                task.amount = bigint(0)
                task.worker_stake = bigint(0)
                gl.get_contract_at(Address(task.client)).emit_transfer(value=u256(total_refund))
        else:
            task.status = "ESCALATED"

        self.tasks[task_id] = task

    @gl.public.write
    def raise_dispute(self, task_id: str, reason: str = "") -> None:
        if task_id not in self.tasks:
            raise UserError("Task not found")
        task = self.tasks[task_id]
        if task.status != "AWAITING_PAYOUT":
            raise UserError("Task is not in AWAITING_PAYOUT state")

        caller = self._get_caller()
        if caller != task.client and caller != task.worker:
            raise UserError("Only client or worker can dispute")

        now = self._get_current_timestamp()
        if now > task.payout_ready_at:
            raise UserError("24-hour dispute window has elapsed")

        task.status = "DISPUTED"
        if reason:
            task.verdict_reason = f"[DISPUTED by {caller[:8]}] {reason}"
        self.tasks[task_id] = task

    @gl.public.write
    def finalize_payout(self, task_id: str) -> None:
        """Disburses escrow funds strictly after 24h cooling-off without active disputes."""
        if task_id not in self.tasks:
            raise UserError("Task not found")
        task = self.tasks[task_id]
        if task.status != "AWAITING_PAYOUT":
            raise UserError("Task is not awaiting payout")

        caller = self._get_caller()
        if caller != task.client and caller != task.worker and caller != self.platform_admin:
            raise UserError("Unauthorized caller")

        now = self._get_current_timestamp()
        if now < task.payout_ready_at:
            raise UserError("24-hour cooling-off period has not elapsed yet")

        reward = task.amount
        stake = task.worker_stake
        task.status = "CLOSED"
        task.amount = bigint(0)
        task.worker_stake = bigint(0)

        # Release reward + stake to worker
        gl.get_contract_at(Address(task.worker)).emit_transfer(value=u256(reward + stake))

        # Update reputation if configured
        if self.reputation_contract != "0x0000000000000000000000000000000000000000":
            try:
                gl.get_contract_at(Address(self.reputation_contract)).update_reputation(Address(task.worker), True)
            except Exception:
                pass

        self.tasks[task_id] = task

    @gl.public.write
    def recover_stuck_funds(self, task_id: str) -> None:
        """Reclaims locked client funds if task remains unaccepted or worker misses deadline."""
        if task_id not in self.tasks:
            raise UserError("Task not found")
        task = self.tasks[task_id]

        caller = self._get_caller()
        if caller != task.client:
            raise UserError("Only the client can recover stuck funds")

        now = self._get_current_timestamp()
        if task.status == "OPEN":
            task.status = "CLOSED"
            refund = task.amount
            task.amount = bigint(0)
            self.tasks[task_id] = task
            gl.get_contract_at(Address(task.client)).emit_transfer(value=u256(refund))
        elif task.status in ["IN_PROGRESS", "NEEDS_REVISION"]:
            if now <= task.deadline:
                raise UserError("Deadline has not elapsed yet")
            task.status = "CLOSED"
            total = task.amount + task.worker_stake
            task.amount = bigint(0)
            task.worker_stake = bigint(0)
            self.tasks[task_id] = task
            gl.get_contract_at(Address(task.client)).emit_transfer(value=u256(total))
        else:
            raise UserError("Current status does not allow stuck fund recovery")

    @gl.public.view
    def get_all_tasks(self) -> str:
        """Authoritative public view for frontend synchronization."""
        res = []
        for i in range(int(self.task_count)):
            tid = self.task_ids[bigint(i)]
            if tid in self.tasks:
                t = self.tasks[tid]
                res.append({
                    "id": t.id,
                    "client": t.client,
                    "worker": t.worker,
                    "title": t.title,
                    "criteria_url": t.criteria_url,
                    "deliverable_url": t.deliverable_url,
                    "amount": str(t.amount),
                    "worker_stake": str(t.worker_stake),
                    "status": t.status,
                    "attempts": str(t.attempts),
                    "verdict": t.verdict,
                    "verdict_reason": t.verdict_reason,
                    "confidence": str(t.confidence),
                    "payout_ready_at": str(t.payout_ready_at),
                    "deadline": str(t.deadline)
                })
        return json.dumps(res)
