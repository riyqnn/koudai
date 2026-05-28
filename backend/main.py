from __future__ import annotations

import asyncio
import sys

from koudai import configure_logging, get_logger, load_config
from koudai.agent import TradingAgent

log = get_logger(__name__)

_BANNER = """
  Koudai — Natural Language DeFi Trading Agent
  Injective Testnet
"""

_EXAMPLES = [
    "Buy 10 INJ at market price",
    "Sell $50 worth of USDT",
    "Buy 5 ATOM at $2.5 limit",
    "status",
    "quit",
]


async def run_cli() -> None:
    print(_BANNER)
    cfg = load_config()
    configure_logging(level=cfg.log_level, fmt=cfg.log_format, log_dir=cfg.log_dir)
    log.info("koudai_starting", network=cfg.injective_network, dry_run=cfg.agent_dry_run)

    mode = "DRY-RUN (no real transactions)" if cfg.agent_dry_run else "LIVE (real testnet transactions)"
    print(f"  Mode:      {mode}")
    print(f"  Network:   {cfg.injective_network}")
    print(f"  Wallet:    {cfg.injective_wallet_address}")
    print(f"  Max Order: ${cfg.agent_max_order_usd:.2f} USD\n")

    async with TradingAgent() as agent:
        print("  Agent ready. Examples:")
        for ex in _EXAMPLES:
            print(f"    - {ex}")
        print()

        while True:
            try:
                user_input = input("> ").strip()

                if not user_input:
                    continue

                if user_input.lower() in ("quit", "exit", "q"):
                    print("Goodbye.")
                    break

                if user_input.lower() == "status":
                    status = await agent.get_status()
                    wallet = status.get("wallet", {})
                    print(f"\n  State:   {status['state']}")
                    print(f"  Network: {wallet.get('network', 'N/A')}")
                    print(f"  Wallet:  {wallet.get('wallet_address', 'N/A')}")
                    inj = wallet.get("inj_balance", {})
                    print(f"  Balance: {inj.get('available', 0):.2f} INJ")
                    print(f"  Dry Run: {status['dry_run']}\n")
                    continue

                print(f"\n  Processing: {user_input}")
                print("  " + "-" * 48)
                context = await agent.process(user_input)

                if context.error_message:
                    print(f"\n  Error: {context.error_message}")
                elif context.parsed_intent:
                    intent = context.parsed_intent
                    print(f"\n  Intent:    {intent['action'].upper()} {intent['amount']} {intent['token']}")
                    print(f"  Type:      {intent['order_type']}")
                    print(f"  Confidence:{intent['confidence']:.0%}")

                if context.order_result:
                    result = context.order_result
                    print(f"\n  Order:     {result['order_id']}")
                    print(f"  Status:    {result['status']}")
                    print(f"  Filled:    {result['filled_amount']}")
                    if result.get("tx_hash"):
                        print(f"  TX:        {result['tx_hash']}")
                    if result.get("filled_price"):
                        print(f"  Price:     ${result['filled_price']:.2f}")

                print("  " + "-" * 48 + "\n")

            except KeyboardInterrupt:
                print("\nGoodbye.")
                break
            except Exception as e:
                log.error("cli_error", error=str(e))
                print(f"\n  Unexpected error: {e}\n")


def main() -> int:
    try:
        asyncio.run(run_cli())
        return 0
    except KeyboardInterrupt:
        print("\nGoodbye.")
        return 0
    except Exception as e:
        print(f"\n  Fatal error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())