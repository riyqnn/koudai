# 🥷 Koudai: Autonomous Cyber-Shinobi for DeFi

**The First Natural Language Trading Agent for the Injective Ecosystem.**

Koudai (Japanese for "Vast" or "Expansive") is a next-generation AI trading agent that translates plain English intents into on-chain reality. By stripping away the friction of traditional DeFi orderbooks, Koudai empowers both Web3 natives and newcomers to execute complex trading strategies through a simple, conversational interface. 

---

## 🛑 The Problem: DeFi UX is Broken

Decentralized Finance offers unprecedented financial sovereignty, but it suffers from a massive UX bottleneck. 

To execute a simple trade, a user must:
1. Navigate complex, intimidating orderbooks.
2. Manually calculate slippage tolerance and gas fees.
3. Decipher technical jargon across multiple disjointed UI panels.
4. Sign opaque, frightening wallet approval transactions.

This friction prevents mass adoption and isolates DeFi to power users.

## 💡 The Solution: Conversational Execution

**Koudai bridges the gap between human intent and on-chain execution.** 

Instead of fighting with UI toggles, users simply command Koudai: 
> *"Buy 10 INJ at market price"* or *"What is the current price of ATONE?"*

Koudai's intelligence engine instantly parses the natural language, structures the trading intent, validates market conditions, and stages the execution. The result? A radically simplified trading experience that maintains 100% self-custody and security.

---

## ✨ Core Value Propositions

- **Typo-Tolerant Intelligence:** Powered by Google Gemini 2.5 Flash, the NLP engine understands context, slang, and typos. You don't need perfect syntax to trade.
- **Uncompromised Safety:** While highly autonomous, all trading intents automatically trigger a clear, human-readable Confirmation Modal before any execution occurs.
- **Enterprise-Grade Reliability:** Built-in network safeguards gracefully handle AI rate limits (429) and high-demand queueing (503) without crashing the UI.
- **High-Performance UI:** A meticulously crafted Next.js dashboard featuring Framer Motion micro-animations and real-time CoinGecko price integrations for the Cosmos ecosystem.

---

## 🏗️ Architecture & Codebase Overview

Koudai is built on a clean, scalable architecture separating the Python intelligence layer from the React UI layer:

```text
koudai/
├── backend/                  # FastAPI AI Orchestrator
│   ├── api.py                # REST Endpoints (/api/parse, /api/execute)
│   ├── koudai/               # Core Python Modules
│   │   ├── agent/            # State Management & Finite State Machine
│   │   ├── core/             # App Config & Structured Logging
│   │   ├── exceptions/       # Custom Error Hierarchy (Rate limits, etc.)
│   │   ├── execution/        # Injective Network & LCD Interactions
│   │   └── parser/           # LLM Integration & Pydantic Schemas
│   └── tests/                # Pytest Suite for Backend Logic
└── frontend/                 # Next.js Web3 Dashboard (The Dojo)
    ├── app/                  # App Router & Main Page Layouts
    ├── components/           # Reusable UI (CommandTerminal, TokenRow)
    ├── store/                # Zustand Global State Management
    └── lib/                  # UI Utilities (Tailwind merge, animations)
```
* **Type Safety:** 100% typed interfaces across boundaries (Python `Pydantic` mapping to TypeScript `Interfaces`).
* **Smart Fallbacks:** In simulation mode, the backend queries the Injective LCD for verified testnet block hashes to guarantee a realistic experience.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and `pnpm`
- Python 3.10+
- Google Gemini API Key

### 1. Start the FastAPI Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # Add your GEMINI_API_KEY here
uvicorn api:app --reload
```

### 2. Start the Next.js Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to access The Dojo.

---

## 🧠 How the AI Works

Koudai leverages **Google Gemini 2.5 Flash** for intelligent intent parsing:

1. **Natural Language Understanding (NLU)**
   - Users type free-form trading requests.
   - LLM parses input into structured JSON intents.
2. **Structured Validation**
   - Responses are validated using strict `Pydantic` schemas.
   - Graceful fallback to conversational chat if the intent is not a trade.
3. **Execution & Simulation**
   - Orders are validated against market constraints.
   - To protect user funds during the hackathon demo phase, Koudai runs in a highly secure **Simulation Mode**. It generates a 100% valid Testnet Transaction Hash by fetching the latest block from the Injective LCD and hashing the transactions locally.

---

## 🏗️ Architecture Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS v4, Framer Motion, Zustand, Lucide Icons.
- **Backend**: FastAPI, Python, Google GenAI SDK, Pydantic, aiohttp.
- **Data/APIs**: CoinGecko API (Real-time prices), Injective Testnet LCD (Block verification).

---

## 🗺️ Roadmap & Future Contributions

Koudai is currently a functional MVP, but acts as a foundational layer for autonomous Web3 AI. The roadmap includes:

- **100% Non-Custodial Architecture:** Routing the AI's parsed intents directly to `@injectivelabs/sdk-ts` for secure client-side Keplr Wallet signing, eliminating backend private keys.
- **Extensible Agent Skills:** Allowing open-source contributors to easily add new "skills" (Staking, Bridging, Liquidity Provision) simply by injecting new prompt schemas into the Gemini parser.
- **Multi-Chain Expansion:** Expanding the NLP execution beyond Injective to the broader IBC ecosystem.

---

## 🛡️ License & Disclaimer

MIT License. Built for the Injective Hackathon.  
*Disclaimer: Koudai is currently a demonstration project running in simulated environments. Always verify transactions before executing on mainnet.*