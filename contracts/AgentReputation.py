# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class Contract(gl.Contract):
    platform_admin: Address
    authorized_court: Address
    scores: TreeMap[Address, u256]
    total_tasks: TreeMap[Address, u256]
    successful_tasks: TreeMap[Address, u256]
    failed_tasks: TreeMap[Address, u256]
    agent_list: DynArray[Address]

    def __init__(self):
        self.platform_admin = gl.message.sender
        self.authorized_court = gl.message.sender
        self.scores = TreeMap()
        self.total_tasks = TreeMap()
        self.successful_tasks = TreeMap()
        self.failed_tasks = TreeMap()
        self.agent_list = DynArray()

    @gl.public.write
    def set_authorized_court(self, court_address: Address) -> None:
        if gl.message.sender != self.platform_admin:
            raise UserError("Only platform admin can set authorized court")
        self.authorized_court = court_address

    @gl.public.write
    def update_reputation(self, agent: Address, is_success: bool) -> None:
        """
        Called by authorized AgentEscrowCourt contract upon finalized adjudication.
        """
        if gl.message.sender != self.authorized_court and gl.message.sender != self.platform_admin:
            raise UserError("Unauthorized caller")

        current_score = self.scores.get(agent, u256(100))
        tot = self.total_tasks.get(agent, u256(0))
        succ = self.successful_tasks.get(agent, u256(0))
        fail = self.failed_tasks.get(agent, u256(0))

        if tot == u256(0) and agent not in self.agent_list:
            self.agent_list.append(agent)

        self.total_tasks[agent] = tot + u256(1)

        if is_success:
            self.successful_tasks[agent] = succ + u256(1)
            self.scores[agent] = current_score + u256(10)
        else:
            self.failed_tasks[agent] = fail + u256(1)
            if current_score >= u256(20):
                self.scores[agent] = current_score - u256(20)
            else:
                self.scores[agent] = u256(0)

    @gl.public.view
    def get_reputation(self, agent: Address) -> u256:
        return self.scores.get(agent, u256(100))

    @gl.public.view
    def get_agent_stats(self, agent: Address) -> dict:
        return {
            "agent": str(agent),
            "score": str(self.scores.get(agent, u256(100))),
            "total_tasks": str(self.total_tasks.get(agent, u256(0))),
            "successful_tasks": str(self.successful_tasks.get(agent, u256(0))),
            "failed_tasks": str(self.failed_tasks.get(agent, u256(0)))
        }

    @gl.public.view
    def get_all_reputations(self) -> str:
        """Authoritative public view for frontend leaderboard synchronization."""
        res = []
        for a in self.agent_list:
            res.append({
                "agent": str(a),
                "score": str(self.scores.get(a, u256(100))),
                "total_tasks": str(self.total_tasks.get(a, u256(0))),
                "successful_tasks": str(self.successful_tasks.get(a, u256(0))),
                "failed_tasks": str(self.failed_tasks.get(a, u256(0)))
            })
        return json.dumps(res)
