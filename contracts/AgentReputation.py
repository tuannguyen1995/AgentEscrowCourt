# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class Contract(gl.Contract):
    platform_admin: str
    authorized_court: str
    agent_list_json: str
    scores: TreeMap[str, u256]
    total_tasks: TreeMap[str, u256]
    successful_tasks: TreeMap[str, u256]
    failed_tasks: TreeMap[str, u256]

    def __init__(self):
        try:
            self.platform_admin = str(gl.message.sender).lower()
        except Exception:
            self.platform_admin = str(getattr(gl.message, "sender_address", "0x0000000000000000000000000000000000000000")).lower()
        self.authorized_court = self.platform_admin
        self.agent_list_json = "[]"
        self.scores = TreeMap()
        self.total_tasks = TreeMap()
        self.successful_tasks = TreeMap()
        self.failed_tasks = TreeMap()

    def _get_caller(self) -> str:
        try:
            return str(gl.message.sender).lower()
        except Exception:
            return str(getattr(gl.message, "sender_address", "0x0000000000000000000000000000000000000000")).lower()

    @gl.public.write
    def set_authorized_court(self, court_address: str) -> None:
        caller = self._get_caller()
        if caller != self.platform_admin:
            raise UserError("Only platform admin can set authorized court")
        self.authorized_court = str(court_address).lower().strip()

    @gl.public.write
    def update_reputation(self, agent: str, is_success: bool) -> None:
        """
        Called by authorized AgentEscrowCourt contract upon finalized adjudication.
        """
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
            
            # Register new agent in JSON list
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
    def get_agent_stats(self, agent: str) -> dict:
        agent_key = str(agent).lower().strip()
        score = self.scores[agent_key] if agent_key in self.scores else u256(100)
        tot = self.total_tasks[agent_key] if agent_key in self.total_tasks else u256(0)
        succ = self.successful_tasks[agent_key] if agent_key in self.successful_tasks else u256(0)
        fail = self.failed_tasks[agent_key] if agent_key in self.failed_tasks else u256(0)
        return {
            "agent": agent_key,
            "score": str(score),
            "total_tasks": str(tot),
            "successful_tasks": str(succ),
            "failed_tasks": str(fail)
        }

    @gl.public.view
    def get_all_reputations(self) -> str:
        """Authoritative public view for frontend leaderboard synchronization."""
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
