from __future__ import annotations

from typing import Any

from koudai.core.logging import get_logger
from koudai.exceptions import IntentParseError, IntentValidationError, KoudaiError
from koudai.execution import OrderRequest, TradingOrchestrator
from koudai.parser import IntentParser, TradingIntent

from .state import AgentContext, AgentState, StateMachine

log = get_logger(__name__)


class TradingAgent:

    def __init__(
        self,
        parser: IntentParser | None = None,
        orchestrator: TradingOrchestrator | None = None,
        dry_run: bool | None = None,
    ) -> None:
        self.parser = parser or IntentParser()
        self.orchestrator = orchestrator
        self._own_orchestrator = orchestrator is None
        self.dry_run = dry_run
        self.fsm = StateMachine()
        log.info("trading_agent_initialized", dry_run=self.dry_run)

    async def start(self) -> None:
        if self._own_orchestrator:
            self.orchestrator = TradingOrchestrator(dry_run=self.dry_run)
            await self.orchestrator.start()
        log.info("trading_agent_started")

    async def stop(self) -> None:
        if self.orchestrator and self._own_orchestrator:
            await self.orchestrator.stop()
        log.info("trading_agent_stopped")

    async def process(self, user_input: str) -> AgentContext:
        log.info("processing_user_input", input_preview=user_input[:100])
        self.fsm.reset()
        self.fsm.transition_to(AgentState.PARSING, context_update={"user_input": user_input})

        try:
            intent = await self.parser.parse(user_input)
            self.fsm.transition_to(AgentState.VALIDATING, context_update={"parsed_intent": intent.model_dump()})

            order_request = self._build_order_request(intent)
            self.fsm.transition_to(AgentState.EXECUTING)

            result = await self._execute_order(order_request)
            self.fsm.transition_to(AgentState.COMPLETED, context_update={"order_result": result.model_dump()})

            log.info("processing_completed", order_id=result.order_id)
            return self.fsm.context

        except (IntentParseError, IntentValidationError, KoudaiError) as e:
            self.fsm.transition_to(AgentState.ERROR, context_update={"error_message": str(e)})
            log.error("agent_error", error_type=type(e).__name__, error=str(e))
            return self.fsm.context

        except Exception as e:
            self.fsm.transition_to(AgentState.ERROR, context_update={"error_message": f"Unexpected error: {e}"})
            log.error("unexpected_error", error=str(e))
            return self.fsm.context

    def _build_order_request(self, intent: TradingIntent) -> OrderRequest:
        log.info(
            "building_order_request",
            action=intent.action,
            token=intent.token,
            amount=intent.amount,
            order_type=intent.order_type,
            confidence=intent.confidence,
        )
        if intent.confidence < 0.7:
            raise IntentValidationError(
                f"Intent confidence too low ({intent.confidence:.2f}). Please clarify your request.",
                field="confidence",
            )
        return OrderRequest(
            order_side=intent.action,
            token_symbol=intent.token,
            amount=intent.amount,
            amount_denom=intent.amount_denom,
            order_type=intent.order_type,
            limit_price=intent.price,
        )

    async def _execute_order(self, request: OrderRequest) -> Any:
        if not self.orchestrator:
            raise RuntimeError("Orchestrator not initialized. Call start() first.")
        return await self.orchestrator.execute_order(request)

    async def get_status(self) -> dict[str, Any]:
        if not self.orchestrator:
            return {"state": self.fsm.state.value, "status": "not_started"}
        wallet_status = await self.orchestrator.get_wallet_status()
        return {
            "state": self.fsm.state.value,
            "wallet": wallet_status,
            "dry_run": self.dry_run or wallet_status.get("dry_run", True),
        }

    async def __aenter__(self) -> TradingAgent:
        await self.start()
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.stop()


__all__ = ["TradingAgent"]
