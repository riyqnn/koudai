from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from koudai.exceptions import AgentStateError


class AgentState(str, Enum):
    IDLE = "idle"
    PARSING = "parsing"
    VALIDATING = "validating"
    EXECUTING = "executing"
    ERROR = "error"
    COMPLETED = "completed"

    def can_transition_to(self, target: AgentState) -> bool:
        valid: dict[AgentState, set[AgentState]] = {
            AgentState.IDLE: {AgentState.PARSING},
            AgentState.PARSING: {AgentState.VALIDATING, AgentState.ERROR, AgentState.IDLE},
            AgentState.VALIDATING: {AgentState.EXECUTING, AgentState.ERROR, AgentState.IDLE},
            AgentState.EXECUTING: {AgentState.COMPLETED, AgentState.ERROR},
            AgentState.ERROR: {AgentState.IDLE},
            AgentState.COMPLETED: {AgentState.IDLE},
        }
        return target in valid.get(self, set())


@dataclass
class AgentContext:
    user_input: str = ""
    parsed_intent: dict[str, Any] | None = None
    order_result: dict[str, Any] | None = None
    error_message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class StateTransition:
    from_state: AgentState
    to_state: AgentState
    context: AgentContext
    timestamp: float


class StateMachine:

    def __init__(self, initial_state: AgentState = AgentState.IDLE) -> None:
        self._state = initial_state
        self._context = AgentContext()
        self._history: list[StateTransition] = []

    @property
    def state(self) -> AgentState:
        return self._state

    @property
    def context(self) -> AgentContext:
        return self._context

    def transition_to(self, new_state: AgentState, context_update: dict[str, Any] | None = None) -> StateTransition:
        if not self._state.can_transition_to(new_state):
            raise AgentStateError(self._state.value, new_state.value)

        from_state = self._state
        self._state = new_state

        if context_update:
            for key, value in context_update.items():
                setattr(self._context, key, value)

        transition = StateTransition(
            from_state=from_state,
            to_state=new_state,
            context=self._context,
            timestamp=time.time(),
        )
        self._history.append(transition)
        return transition

    def reset(self) -> None:
        self._state = AgentState.IDLE
        self._context = AgentContext()
        self._history.clear()

    def get_history(self) -> list[StateTransition]:
        return list(self._history)


__all__ = ["AgentContext", "AgentState", "StateMachine", "StateTransition"]
