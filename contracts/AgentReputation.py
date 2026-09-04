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
    agent_count: u256
    agents: TreeMap[u256, Address]

    def __init__(self):
        self.platform_admin = gl.message.sender_address
        self.authorized_court = gl.message.sender_address
        self.scores = TreeMap()
        self.total_tasks = TreeMap()
        self.successful_tasks = TreeMap()
        self.failed_tasks = TreeMap()
        self.agent_count = u256(0)
        self.agents = TreeMap()

    @gl.public.write
    def set_authorized_court(self, court_address: Address) -> None:
        if gl.message.sender_address != self.platform_admin:
            raise UserError("Only platform admin can set authorized court")
        self.authorized_court = court_address

    @gl.public.write
    def update_reputation(self, agent: Address, is_success: bool) -> None:
        """
        Called by authorized AgentEscrowCourt contract upon finalized adjudication.
        """
        if gl.message.sender_address != self.authorized_court and gl.message.sender_address != self.platform_admin:
            raise UserError("Unauthorized caller")

        if agent in self.scores:
            current_score = self.scores[agent]
            tot = self.total_tasks[agent]
            succ = self.successful_tasks[agent]
            fail = self.failed_tasks[agent]
        else:
            current_score = u256(100)
            tot = u256(0)
            succ = u256(0)
            fail = u256(0)

        if tot == u256(0):
            self.agents[self.agent_count] = agent
            self.agent_count = self.agent_count + u256(1)

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
        if agent in self.scores:
            return self.scores[agent]
        return u256(100)

    @gl.public.view
    def get_agent_stats(self, agent: Address) -> dict:
        score = self.scores[agent] if agent in self.scores else u256(100)
        tot = self.total_tasks[agent] if agent in self.total_tasks else u256(0)
        succ = self.successful_tasks[agent] if agent in self.successful_tasks else u256(0)
        fail = self.failed_tasks[agent] if agent in self.failed_tasks else u256(0)
        return {
            "agent": str(agent),
            "score": str(score),
            "total_tasks": str(tot),
            "successful_tasks": str(succ),
            "failed_tasks": str(fail)
        }

    @gl.public.view
    def get_all_reputations(self) -> str:
        """Authoritative public view for frontend leaderboard synchronization."""
        res = []
        count = int(self.agent_count)
        for i in range(count):
            a = self.agents[u256(i)]
            score = self.scores[a] if a in self.scores else u256(100)
            tot = self.total_tasks[a] if a in self.total_tasks else u256(0)
            succ = self.successful_tasks[a] if a in self.successful_tasks else u256(0)
            fail = self.failed_tasks[a] if a in self.failed_tasks else u256(0)
            res.append({
                "agent": str(a),
                "score": str(score),
                "total_tasks": str(tot),
                "successful_tasks": str(succ),
                "failed_tasks": str(fail)
            })
        return json.dumps(res)
