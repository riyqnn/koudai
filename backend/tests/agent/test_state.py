from __future__ import annotations

import pytest

from koudai.agent.state import AgentContext, AgentState, StateMachine, StateTransition
from koudai.exceptions import AgentStateError


class TestAgentState:

    def test_idle_can_transition_to_parsing(self) -> None:
        assert AgentState.IDLE.can_transition_to(AgentState.PARSING)

    def test_idle_cannot_transition_to_completed(self) -> None:
        assert not AgentState.IDLE.can_transition_to(AgentState.COMPLETED)

    def test_parsing_can_go_to_validating_or_error(self) -> None:
        assert AgentState.PARSING.can_transition_to(AgentState.VALIDATING)
        assert AgentState.PARSING.can_transition_to(AgentState.ERROR)

    def test_executing_can_only_go_to_completed_or_error(self) -> None:
        assert AgentState.EXECUTING.can_transition_to(AgentState.COMPLETED)
        assert AgentState.EXECUTING.can_transition_to(AgentState.ERROR)
        assert not AgentState.EXECUTING.can_transition_to(AgentState.IDLE)

    def test_error_can_only_go_to_idle(self) -> None:
        assert AgentState.ERROR.can_transition_to(AgentState.IDLE)
        assert not AgentState.ERROR.can_transition_to(AgentState.PARSING)


class TestStateMachine:

    def test_initial_state_is_idle(self) -> None:
        assert StateMachine().state == AgentState.IDLE

    def test_valid_transition_changes_state(self) -> None:
        fsm = StateMachine()
        fsm.transition_to(AgentState.PARSING)
        assert fsm.state == AgentState.PARSING

    def test_invalid_transition_raises_agent_state_error(self) -> None:
        fsm = StateMachine()
        with pytest.raises(AgentStateError):
            fsm.transition_to(AgentState.COMPLETED)

    def test_context_update_sets_attributes(self) -> None:
        fsm = StateMachine()
        fsm.transition_to(AgentState.PARSING, context_update={"user_input": "buy 10 INJ"})
        assert fsm.context.user_input == "buy 10 INJ"

    def test_reset_clears_state_and_history(self) -> None:
        fsm = StateMachine()
        fsm.transition_to(AgentState.PARSING)
        fsm.reset()
        assert fsm.state == AgentState.IDLE
        assert fsm.get_history() == []

    def test_history_records_transitions(self) -> None:
        fsm = StateMachine()
        fsm.transition_to(AgentState.PARSING)
        fsm.transition_to(AgentState.VALIDATING)
        history = fsm.get_history()
        assert len(history) == 2
        assert history[0].from_state == AgentState.IDLE
        assert history[1].from_state == AgentState.PARSING

    def test_history_returns_copy(self) -> None:
        fsm = StateMachine()
        h = fsm.get_history()
        h.append(StateTransition(AgentState.IDLE, AgentState.PARSING, AgentContext(), 0.0))
        assert fsm.get_history() == []

    def test_transition_returns_state_transition(self) -> None:
        fsm = StateMachine()
        result = fsm.transition_to(AgentState.PARSING)
        assert isinstance(result, StateTransition)
        assert result.from_state == AgentState.IDLE
        assert result.to_state == AgentState.PARSING
