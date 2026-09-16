# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.storage import TreeMap
from genlayer.vm import UserError
u256 = gl.u256
bigint = gl.bigint
import json

class Contract(gl.contract.Contract):
    platform_admin: str
    authorized_court: str
    agent_list_json: str
    scores: TreeMap[str, u256]
    total_tasks: TreeMap[str, u256]
    successful_tasks: TreeMap[str, u256]
    failed_tasks: TreeMap[str, u256]

    def __init__(self):
        try:
            self.platform_admin = str(gl.message.sender_address).lower()
        except Exception:
            self.platform_admin = str(getattr(gl.message, "sender", "0x0000000000000000000000000000000000000000")).lower()
        self.authorized_court = self.platform_admin
        self.agent_list_json = "[]"
        # TreeMap storage fields (scores, total_tasks, successful_tasks, failed_tasks)
        # are automatically initialized to empty by GenVM. Rule #2: Do not reassign in __init__.

    def _get_caller(self) -> str:
        try:
            return str(gl.message.sender_address).lower()
        except Exception:
            return str(getattr(gl.message, "sender", "0x0000000000000000000000000000000000000000")).lower()

    @gl.public.write
    def set_authorized_court(self, court_address: str) -> None:
        caller = self._get_caller()
        if caller != self.platform_admin:
            raise UserError("Only platform admin can set authorized court")
        self.authorized_court = str(court_address).lower().strip()

    @gl.public.write
    def update_reputation(self, agent: str, is_success: bool) -> None:
        caller = self._get_caller()
        if caller != self.authorized_court and caller != self.platform_admin:
            raise UserError("Unauthorized caller")

        agent_key = str(agent).lower().strip()

        if agent_key in self.scores:
            current_score = self.scores[agent_key]
            tot = self.total_tasks[agent_key]
            succ = self.successful_tasks[agent_key]
            fail = self.failed_tasks[agent_key]
        else:
            current_score = u256(100)
            tot = u256(0)
            succ = u256(0)
            fail = u256(0)
            
            try:
                agents = json.loads(self.agent_list_json)
            except Exception:
                agents = []
            if agent_key not in agents:
                agents.append(agent_key)
                self.agent_list_json = json.dumps(agents)

        self.total_tasks[agent_key] = tot + u256(1)

        if is_success:
            self.successful_tasks[agent_key] = succ + u256(1)
            self.scores[agent_key] = current_score + u256(10)
        else:
            self.failed_tasks[agent_key] = fail + u256(1)
            if current_score >= u256(20):
                self.scores[agent_key] = current_score - u256(20)
            else:
                self.scores[agent_key] = u256(0)

    @gl.public.view
    def get_reputation(self, agent: str) -> u256:
        agent_key = str(agent).lower().strip()
        if agent_key in self.scores:
            return self.scores[agent_key]
        return u256(100)

    @gl.public.view
    def get_all_reputations(self) -> str:
        try:
            agents = json.loads(self.agent_list_json)
        except Exception:
            agents = []

        res = []
        for a in agents:
            score = self.scores[a] if a in self.scores else u256(100)
            tot = self.total_tasks[a] if a in self.total_tasks else u256(0)
            succ = self.successful_tasks[a] if a in self.successful_tasks else u256(0)
            fail = self.failed_tasks[a] if a in self.failed_tasks else u256(0)
            res.append({
                "agent": a,
                "score": str(score),
                "total_tasks": str(tot),
                "successful_tasks": str(succ),
                "failed_tasks": str(fail)
            })
        return json.dumps(res)
