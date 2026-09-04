# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class Contract(gl.Contract):
    scores: TreeMap[str, u256]
    owner: Address
    authorized_court: Address

    def __init__(self):
        self.owner = gl.message.sender
        self.authorized_court = gl.message.sender

    @gl.public.write
    def set_authorized_court(self, court_address: Address) -> None:
        if gl.message.sender != self.owner:
            raise UserError("Only owner can set authorized court")
        self.authorized_court = court_address

    @gl.public.write
    def update_reputation(self, agent: Address, is_success: bool) -> None:
        if gl.message.sender != self.authorized_court and gl.message.sender != self.owner:
            raise UserError("Unauthorized caller")

        agent_str = _addr_to_str(agent)
        current_score = u256(100)
        if agent_str in self.scores:
            current_score = self.scores[agent_str]

        if is_success:
            current_score = current_score + u256(10)
        else:
            if current_score >= u256(20):
                current_score = current_score - u256(20)
            else:
                current_score = u256(0)

        self.scores[agent_str] = current_score

    @gl.public.view
    def get_reputation(self, agent: Address) -> u256:
        agent_str = _addr_to_str(agent)
        if agent_str in self.scores:
            return self.scores[agent_str]
        return u256(100)


def _addr_to_str(addr: Address) -> str:
    try:
        return addr.as_hex
    except Exception:
        return str(addr)
