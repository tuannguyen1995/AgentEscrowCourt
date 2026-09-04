# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

@allow_storage
@dataclass
class AgentScore:
    agent: str
    score: bigint
    total_tasks: bigint
    successful_tasks: bigint
    failed_tasks: bigint

class Contract(gl.Contract):
    platform_admin: str
    authorized_court: str
    scores: TreeMap[str, AgentScore]
    agent_list: DynArray[str]

    def __init__(self):
        caller = self._get_caller()
        self.platform_admin = caller
        self.authorized_court = caller

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
        if not court_address.startswith("0x") or len(court_address.strip()) != 42:
            raise UserError("Invalid court contract address format")
        self.authorized_court = court_address.lower().strip()

    @gl.public.write
    def update_reputation(self, agent: str, is_success: bool) -> None:
        """
        Called exclusively by the authorized AgentEscrowCourt contract upon finalized adjudication.
        """
        caller = self._get_caller()
        if caller != self.authorized_court and caller != self.platform_admin:
            raise UserError(f"Unauthorized caller: {caller}. Expected court: {self.authorized_court}")

        agent_key = str(agent).lower().strip()

        if agent_key in self.scores:
            record = self.scores[agent_key]
        else:
            record = AgentScore(
                agent=agent_key,
                score=bigint(100),       # Initial baseline score: 100
                total_tasks=bigint(0),
                successful_tasks=bigint(0),
                failed_tasks=bigint(0)
            )
            self.agent_list.append(agent_key)

        record.total_tasks += bigint(1)

        if is_success:
            record.successful_tasks += bigint(1)
            record.score += bigint(10)
        else:
            record.failed_tasks += bigint(1)
            if record.score >= bigint(20):
                record.score -= bigint(20)
            else:
                record.score = bigint(0)

        self.scores[agent_key] = record

    @gl.public.view
    def get_reputation(self, agent: str) -> str:
        agent_key = str(agent).lower().strip()
        if agent_key in self.scores:
            s = self.scores[agent_key]
            return json.dumps({
                "agent": s.agent,
                "score": str(s.score),
                "total_tasks": str(s.total_tasks),
                "successful_tasks": str(s.successful_tasks),
                "failed_tasks": str(s.failed_tasks)
            })
        return json.dumps({
            "agent": agent_key,
            "score": "100",
            "total_tasks": "0",
            "successful_tasks": "0",
            "failed_tasks": "0"
        })

    @gl.public.view
    def get_all_reputations(self) -> str:
        """Public view allowing the frontend to render the Agent Leaderboard authoritatively."""
        res = []
        for a in self.agent_list:
            if a in self.scores:
                s = self.scores[a]
                res.append({
                    "agent": s.agent,
                    "score": str(s.score),
                    "total_tasks": str(s.total_tasks),
                    "successful_tasks": str(s.successful_tasks),
                    "failed_tasks": str(s.failed_tasks)
                })
        return json.dumps(res)
