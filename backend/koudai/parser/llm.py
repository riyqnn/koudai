from __future__ import annotations

import asyncio
import json

from google import genai
from google.genai.types import GenerateContentConfig

from koudai.core.config import load_config
from koudai.core.logging import get_logger
from koudai.exceptions import IntentParseError, IntentValidationError

from .intents import LLMResponse, TradingIntent

log = get_logger(__name__)

_SYSTEM_PROMPT = """You are Koudai, a DeFi trading assistant for the Injective network.

Parse natural language trading requests into structured trading intents.

Rules:
- Only parse requests that are clearly about trading (buying or selling tokens).
- If the request is NOT about trading, return error_message explaining why.
- Always respond in valid JSON matching the output schema.

Supported actions:
- buy, purchase, get, acquire -> "buy"
- sell, trade, swap, exchange -> "sell"

Order types:
- market order -> "market" (execute immediately at current price)
- limit order -> "limit" (execute at specified price)

Amount interpretation:
- If no denomination is specified, treat as token amount.
- Explicit USD amounts (e.g., "$50") use amount_denom="usd".

Confidence:
- Set confidence=1.0 when certain about the interpretation.
- Lower confidence for ambiguous requests.
- Set confidence below 0.5 if the request is unclear.

Examples:
- "Buy 10 INJ at market price" -> action="buy", token="INJ", amount=10, amount_denom="token", order_type="market"
- "Sell $50 worth of USDT" -> action="sell", token="USDT", amount=50, amount_denom="usd", order_type="market"
- "Buy 5 ATOM at $2.5 limit" -> action="buy", token="ATOM", amount=5, amount_denom="token", order_type="limit", price=2.5
- "What's the weather?" -> error_message="I can only help with trading on Injective testnet"

Never invent information. If the user doesn't specify something required for a limit order,
set it to null and include an explanation in reasoning."""


class IntentParser:

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        cfg = load_config()
        resolved_key = api_key or cfg.llm_api_key
        if not resolved_key or resolved_key.startswith("<"):
            raise ValueError("Gemini API key not configured. Set GEMINI_API_KEY in .env.")
        self.client = genai.Client(api_key=resolved_key)
        self.model_name = model or cfg.llm_model
        self._max_retries = 3
        log.info("parser_initialized", model=self.model_name)

    async def parse(self, user_input: str) -> TradingIntent:
        log.info("parsing_intent", input_preview=user_input[:100])
        response = ""
        for attempt in range(self._max_retries):
            try:
                response = await self._call_llm(user_input)
                break
            except Exception as e:
                log.warning("llm_retry", attempt=attempt + 1, error=str(e))
                if attempt == self._max_retries - 1:
                    raise IntentParseError(
                        f"LLM call failed after {self._max_retries} attempts: {e}"
                    ) from e
                await asyncio.sleep(2**attempt)

        try:
            llm_response = LLMResponse.model_validate_json(response)
        except Exception as e:
            log.error("llm_response_invalid", raw_response=response, error=str(e))
            raise IntentParseError(
                f"Could not parse LLM response: {e}", raw_output=response
            ) from e

        if llm_response.error_message:
            log.warning("llm_rejected_request", reason=llm_response.error_message)
            raise IntentValidationError(f"LLM rejected request: {llm_response.error_message}")

        if llm_response.intent is None:
            log.error("llm_response_no_intent", raw_response=response)
            raise IntentParseError("LLM returned valid response but no intent", raw_output=response)

        intent = llm_response.intent
        log.info(
            "intent_parsed",
            action=intent.action,
            token=intent.token,
            amount=intent.amount,
            order_type=intent.order_type,
            confidence=intent.confidence,
        )
        return intent

    async def _call_llm(self, user_input: str) -> str:
        loop = asyncio.get_event_loop()
        schema = json.dumps(LLMResponse.model_json_schema(), indent=2)
        prompt = (
            f"{_SYSTEM_PROMPT}\n\n"
            f"Parse the following user input and return a JSON response matching this schema:\n{schema}\n\n"
            f"User input: {user_input}\n\n"
            "Respond with ONLY valid JSON, no markdown formatting, no code blocks."
        )

        def _sync_generate() -> str:
            result = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=GenerateContentConfig(temperature=0.0, response_mime_type="application/json"),
            )
            return result.text or ""

        try:
            raw = await loop.run_in_executor(None, _sync_generate)
        except Exception as e:
            log.error("gemini_api_error", error=str(e))
            raise

        raw = raw.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        if not raw:
            raise IntentParseError("Empty response from LLM")

        return raw


__all__ = ["IntentParser"]
