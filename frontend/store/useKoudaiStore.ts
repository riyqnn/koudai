/**
 * Koudai — Global State Store (Zustand)
 *
 * This store is the single source of truth for the entire frontend. It models
 * the backend's Python Agent FSM (Finite State Machine) and holds all
 * structured data that flows between the backend and the UI.
 *
 * FSM State Lifecycle:
 *   IDLE → PARSING → VALIDATING → EXECUTING → COMPLETED
 *                                            ↘ ERROR
 *
 * Slice breakdown:
 *   1. AgentState     — current FSM phase
 *   2. TradingIntent  — parsed intent from LLM (mirrors Python TradingIntent model)
 *   3. OrderResult    — execution result from Injective
 *   4. WalletStatus   — connected wallet info
 *   5. CommandHistory — audit log of all terminal commands
 *   6. UI flags       — modal state, confirmation gate
 *   7. Actions        — state transitions and setters
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/* ── Type Definitions ──────────────────────────────────────────────────── */

/**
 * Mirrors the backend Python FSM states in `koudai/agent/state.py`.
 * Each state maps to a step in the Shuriken Progress Tracker UI.
 */
export type AgentPhase =
  | "IDLE"
  | "PARSING"
  | "VALIDATING"
  | "EXECUTING"
  | "COMPLETED"
  | "ERROR";

/**
 * Entry type for the conversational AI chat layer.
 * These bypass the trading FSM entirely — no confirmation, no execution.
 */
export type ChatEntryRole = "user" | "ai";

export interface PortfolioSnapshot {
  address: string;
  inj_balance: number;
  network: string;
  dry_run: boolean;
  is_connected: boolean;
}

export interface ChartSnapshot {
  token: string;
  data: { time: string; price: number }[];
}

export interface ChatEntry {
  id: string;
  role: ChatEntryRole;
  message: string;
  timestamp: number;
  /** Optional: used for portfolio snapshot entries */
  portfolioSnapshot?: PortfolioSnapshot | null;
  /** Optional: used for chart queries */
  chartSnapshot?: ChartSnapshot | null;
}

/**
 * Mirrors `TradingIntent` from `koudai/parser/intents.py`.
 * Populated after the LLM successfully parses a natural language command.
 */
export interface TradingIntent {
  action: "buy" | "sell";
  token: string;
  amount: number;
  /** Whether the `amount` field is denominated in token units or USD */
  amount_denom: "token" | "usd";
  order_type: "market" | "limit";
  /** Only populated for limit orders */
  price: number | null;
  /** LLM confidence score, 0.0 – 1.0 */
  confidence: number;
  /** LLM's reasoning (from LLMResponse.reasoning) */
  reasoning?: string | null;
}

/**
 * Mirrors the execution result returned by the Injective orchestrator.
 * Corresponds to `OrderResult` / `AgentContext.order_result` in the backend.
 */
export interface OrderResult {
  order_id: string;
  status: "filled" | "partial" | "failed" | "simulated";
  filled_amount: number;
  filled_price?: number | null;
  tx_hash?: string | null;
  error_message?: string | null;
}

/**
 * Wallet connection status — displayed in the WalletWidget component.
 */
export interface WalletStatus {
  /** Injective bech32 address e.g. "inj1abc..." */
  address: string;
  /** Available INJ balance */
  inj_balance: number;
  /** Network identifier */
  network: "testnet" | "mainnet";
  /** Whether the agent is in dry-run simulation mode */
  dry_run: boolean;
  /** Connection health */
  is_connected: boolean;
}

/**
 * A single entry in the command history log (displayed in the terminal).
 */
export interface CommandHistoryEntry {
  id: string;
  /** The raw natural language command the user typed */
  raw_input: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Terminal output phase */
  phase: AgentPhase;
  /** Populated if the phase reached COMPLETED */
  intent?: TradingIntent | null;
  /** Populated if the phase reached COMPLETED */
  result?: OrderResult | null;
  /** Error detail if phase is ERROR */
  error?: string | null;
}

/* ── Store Shape ───────────────────────────────────────────────────────── */

interface KoudaiState {
  // ─ Agent FSM ─────────────────────────────────────────────────────────────
  /** Current phase of the Agent state machine */
  phase: AgentPhase;
  /** Human-readable status message (e.g. "Parsing intent…") */
  statusMessage: string;

  // ─ Data Payloads ─────────────────────────────────────────────────────────
  /** Most recently parsed trading intent; null if not yet parsed */
  parsedIntent: TradingIntent | null;
  /** Most recent order execution result */
  orderResult: OrderResult | null;
  /** Agent/wallet context */
  walletStatus: WalletStatus;

  // ─ Command Terminal ───────────────────────────────────────────────────────
  /** Ordered history of all commands (newest last) */
  commandHistory: CommandHistoryEntry[];
  /** The current text in the command input box */
  inputValue: string;
  /** Whether the terminal is processing (disables input) */
  isProcessing: boolean;

  // ─ Chat Layer ─────────────────────────────────────────────────────────────
  /**
   * Conversational AI chat entries — rendered alongside trading history.
   * These bypass the FSM; no confirmation required.
   */
  chatHistory: ChatEntry[];

  // ─ UI State ───────────────────────────────────────────────────────────────
  /** Controls the Intent Confirmation Modal visibility */
  isConfirmModalOpen: boolean;
  /** Controls whether confirmation is required (low-confidence or limit orders) */
  requiresConfirmation: boolean;

  // ─ Actions ────────────────────────────────────────────────────────────────

  /**
   * Transition the FSM to a new phase with an optional status message.
   * All phase transitions should go through this action.
   */
  setPhase: (phase: AgentPhase, message?: string) => void;

  /** Set the parsed trading intent after LLM parsing */
  setParsedIntent: (intent: TradingIntent | null) => void;

  /** Set the order execution result */
  setOrderResult: (result: OrderResult | null) => void;

  /** Update wallet / network status */
  setWalletStatus: (status: Partial<WalletStatus>) => void;

  /** Update the terminal input value */
  setInputValue: (value: string) => void;

  /**
   * Add a new entry to the command history.
   * Call this when the user submits a command.
   */
  addHistoryEntry: (entry: Omit<CommandHistoryEntry, "id" | "timestamp">) => void;

  /**
   * Update the most recent history entry (e.g. to attach the result after
   * execution).
   */
  updateLatestHistoryEntry: (
    updates: Partial<Pick<CommandHistoryEntry, "phase" | "intent" | "result" | "error">>
  ) => void;

  /**
   * The primary action: submit a natural language command.
   * Automatically routes to submitChatMessage if the input is conversational.
   * Otherwise runs the full IDLE → PARSING → VALIDATING → EXECUTING → COMPLETED FSM.
   */
  submitCommand: (input: string) => Promise<void>;

  /**
   * Submit a conversational chat message — bypasses FSM, no confirmation needed.
   * The AI responds instantly based on keyword matching.
   */
  submitChatMessage: (input: string) => Promise<void>;

  /** Open or close the intent confirmation modal */
  setConfirmModalOpen: (open: boolean) => void;

  /** Confirm the parsed intent and proceed to EXECUTING */
  confirmAndExecute: () => Promise<void>;

  /** Reject the parsed intent and reset to IDLE */
  rejectIntent: () => void;

  /** Hard reset — clears everything back to IDLE */
  reset: () => void;
}

/* ── Default/Mock State Values ─────────────────────────────────────────── */

/** Mocked wallet for UI demo purposes */
const DEFAULT_WALLET: WalletStatus = {
  address: "",
  inj_balance: 0,
  network: "testnet",
  dry_run: true,
  is_connected: false,
};

/** Phase → human-readable status text map */
const PHASE_MESSAGES: Record<AgentPhase, string> = {
  IDLE:       "Awaiting command…",
  PARSING:    "Parsing intent via Gemini LLM…",
  VALIDATING: "Validating intent & checking constraints…",
  EXECUTING:  "Executing order on Injective Testnet…",
  COMPLETED:  "Order completed successfully.",
  ERROR:      "An error occurred. See details above.",
};

/* ── Mock Simulation Helpers (replace with real API calls) ─────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function parseIntentFromAPI(input: string): Promise<TradingIntent> {
  const res = await fetch(`${API_URL}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: input })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.intent as TradingIntent;
}

async function executeOrderFromAPI(intent: TradingIntent): Promise<OrderResult> {
  const res = await fetch(`${API_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result as OrderResult;
}

export async function fetchWalletStatusFromAPI(): Promise<WalletStatus> {
  try {
    const res = await fetch(`${API_URL}/wallet`);
    const data = await res.json();
    return {
      address: data.address,
      inj_balance: data.inj_balance,
      network: data.network,
      is_connected: data.is_connected,
      dry_run: data.dry_run
    };
  } catch (e) {
    console.error("Failed to fetch wallet status", e);
    return DEFAULT_WALLET;
  }
}

export async function fetchRealInjectiveBalance(address: string): Promise<number> {
  try {
    const res = await fetch(`https://testnet.sentry.lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    if (res.ok) {
      const data = await res.json();
      const injAsset = data.balances?.find((b: any) => b.denom === "inj");
      if (injAsset) {
         return parseFloat(injAsset.amount) / 1e18;
      }
    }
  } catch (e) {
    // Silently catch to avoid UI error overlay if testnet LCD is down
  }
  return 0; // Return 0 to allow fallback logic in caller
}

/** Generate a UUID-like ID for history entries */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ── Chat AI Response Engine ───────────────────────────────────────────── */

/**
 * Returns true when the input looks like a trading command.
 * Used to route between the FSM pipeline and the chat layer.
 */
function isTradingCommand(input: string): boolean {
  const lower = input.toLowerCase();
  const TRADING_KEYWORDS = ["buy", "sell", "swap", "trade", "order", "limit", "market", "short", "long"];
  return TRADING_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Pick a random element from an array — keeps AI responses fresh */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Normalize input for fuzzy matching:
 * - lowercase
 * - remove spaces (catches "myportfolio", "my portfolio", "myportofolio")
 * - collapse common typos
 */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")          // strip all whitespace
    .replace(/ph/g, "f")          // "porfolio" / "pholio"
    .replace(/ae/g, "e")
    .replace(/oe/g, "o");
}

/**
 * Check if the input fuzzy-matches any of the given keyword patterns.
 * Uses both the original lowercase and the normalized form.
 */
function matches(lower: string, norm: string, keywords: string[]): boolean {
  return keywords.some(
    (kw) => new RegExp(`\\b${kw}\\b`).test(lower) || new RegExp(`\\b${normalize(kw)}\\b`).test(norm)
  );
}

/**
 * Generate an AI chat response for a given user message.
 * Responses are randomly picked from multiple variants to feel natural.
 * In production, replace with a real LLM streaming call.
 */
async function generateAiResponse(
  input: string,
  wallet: WalletStatus
): Promise<{ message: string; portfolioSnapshot?: PortfolioSnapshot; chartSnapshot?: ChartSnapshot }> {
  const lower = input.toLowerCase().trim();
  const norm = normalize(input);

  // ── Greetings ────────────────────────────────────────────────────────────
  if (matches(lower, norm, ["hello", "hi", "hey", "yo", "sup", "halo", "hai", "hei", "howdy", "greet", "helo", "p", "test", "tes"])) {
    const greeting = pick([
      `Hello, shinobi! Welcome to **The Dojo** 🥷\n\nI'm **Koudai**, your AI-powered DeFi agent on Injective. Speak to me in plain English:\n→ **Trade**: \`Buy 10 INJ at market price\`\n→ **Portfolio**: \`My portfolio\`\n→ **Help**: \`What can you do?\`\n\nWhat's your move?`,

      `Hey! Koudai here — your autonomous trading agent on **Injective Testnet**.\n\nI understand natural language, just tell me what you want to do:\n→ \`Sell $50 worth of USDT\`\n→ \`Show my portfolio\`\n→ \`What commands do you support?\`\n\nThe dojo is ready.`,

      `Yo! 👊 You've reached **The Dojo** — Koudai AI trading terminal.\n\nI can parse trading intents, validate them, and execute on Injective in seconds. Try:\n→ \`Buy 5 ATOM at $2.5 limit\`\n→ \`My portfolio\`\n\nWaiting for your command.`,

      `Hey there! I'm **Koudai** (狡大), your shinobi in the DeFi shadows.\n\nI live here in the terminal, ready to execute trades on your behalf via Injective Testnet.\n\nType \`What can you do?\` to see my full capabilities, or just fire off a trade command.`,

      `Welcome back to **The Dojo**. 🎯\n\nKoudai agent is online and connected to **${wallet.network.toUpperCase()}**.\n\nReady to trade. What's the play?`,
    ]);
    return { message: greeting };
  }

  // ── Portfolio / balance ───────────────────────────────────────────────────
  if (matches(lower, norm, [
    "portfolio", "portofolio", "portfoio", "portfo",
    "balance", "balanse",
    "mywallet", "wallet",
    "holding", "asset",
    "howmuch", "how much",
    "myaccount", "account",
    "show me", "show my",
  ])) {
    const intro = pick([
      `Here's your current wallet snapshot on **${wallet.network.toUpperCase()}**:`,
      `Sure! Pulling up your portfolio on **${wallet.network.toUpperCase()}**…`,
      `Got it. Here's what I see in your wallet:`,
      `Checking your holdings on **${wallet.network.toUpperCase()}**… here we go:`,
    ]);
    return {
      message:
        `${intro}\n\n` +
        `Status: ${wallet.is_connected ? "🟢 **Connected**" : "🔴 **Disconnected**"}` +
        (wallet.dry_run ? " · **Simulation Mode**" : " · Live"),
      portfolioSnapshot: {
        address: wallet.address,
        inj_balance: wallet.inj_balance,
        network: wallet.network,
        dry_run: wallet.dry_run,
        is_connected: wallet.is_connected,
      },
    };
  }

  // ── Help / capabilities ───────────────────────────────────────────────────
  if (matches(lower, norm, [
    "help", "halp", "bantu", "cara", "tolong",
    "whatcanyou", "what can you", "bisa apa",
    "whatdoyou", "what do you",
    "howdo", "how do", "gimana",
    "commands", "command", "instruksi",
    "feature", "capabilities", "capability",
  ])) {
    const help = pick([
      `Here's what I can do 🗡️\n\n**⚡ Trading**\n→ \`Buy 10 INJ at market price\`\n→ \`Sell $50 worth of ATOM\`\n→ \`Swap 5 INJ to BLD\`\n\n**💬 Chat & Info**\n→ \`Price of ATONE\`\n→ \`Show INJ chart\`\n→ \`My portfolio\`\n\nAll trades simulate on **Injective Testnet**. No real funds at risk.`,

      `Glad you asked! I can:\n\n⚡ **Execute trades** — buy, sell, or swap on Injective\n📈 **Market Data** — check live prices & 7-day charts\n📊 **Show your portfolio** — wallet balance & address\n\nSome examples:\n→ \`Swap 10 INJ for ATOM\`\n→ \`What is the price of BLD?\`\n→ \`Show my portfolio\``,

      `My capabilities as a DeFi shinobi:\n\n1. **Parse** your natural language trade intents (Buy/Sell/Swap) \n2. **Check Markets** (e.g., "Price of INJ" or "ATOM chart")\n3. **Execute** on Injective Testnet instantly\n4. **Report** your wallet & portfolio status\n\nJust type what you want — I'll figure out the rest.`,
    ]);
    return { message: help };
  }

  // ── Who are you ───────────────────────────────────────────────────────────
  if (matches(lower, norm, [
    "whoareyou", "who are you", "siapa", "lu siapa", "kamu siapa",
    "whatareyou", "what are you",
    "koudai",
    "introduce", "about you", "aboutyou",
  ])) {
    const who = pick([
      `I'm **Koudai** (狡大) — an autonomous AI trading agent built on the **Injective** network.\n\nPowered by **Gemini AI** for natural language intent parsing, and Injective's orderbook for lightning-fast DeFi execution.\n\nThink of me as your shinobi in the DeFi shadows — silent, precise, always ready.`,

      `**Koudai** here! 狡大 means "cunning" in Japanese — fitting for a DeFi agent, right?\n\nI was built to bridge the gap between **plain English** and **on-chain execution**. You speak, I trade.\n\nBuilt with: **Gemini AI** · **Injective Network** · **Python backend** · **Next.js frontend**`,

      `Name: **Koudai** 🥷\nRole: Autonomous DeFi Trading Agent\nNetwork: **Injective Testnet**\nBrain: **Gemini AI (LLM)**\n\nI parse your natural language commands, validate them, and execute trades on-chain — all in seconds.`,
    ]);
    return { message: who };
  }

  // ── Status / network ─────────────────────────────────────────────────────
  if (matches(lower, norm, [
    "status", "statuz",
    "network", "connected", "online", "offline",
    "mode", "dryrun", "dry run", "simulation",
  ])) {
    const status = pick([
      `Current agent status:\n\n→ **Status**: ${wallet.is_connected ? "🟢 Online" : "🔴 Offline"}\n→ **Network**: ${wallet.network.toUpperCase()}\n→ **Mode**: ${wallet.dry_run ? "Simulation (Dry-Run)" : "Live"}\n→ **INJ Balance**: ${wallet.inj_balance.toFixed(2)} INJ`,

      `All systems ${wallet.is_connected ? "**operational**" : "**down**"} ✅\n\n**Network**: ${wallet.network.toUpperCase()}\n**Mode**: ${wallet.dry_run ? "🟡 Dry-Run (no real funds)" : "🔴 Live"}\n**Balance**: ${wallet.inj_balance.toFixed(2)} INJ`,
    ]);
    return { message: status };
  }

  // ── Thanks ───────────────────────────────────────────────────────────────
  if (matches(lower, norm, ["thanks", "thank you", "thankyou", "thx", "ty", "appreciate"])) {
    return {
      message: pick([
        "Anytime, shinobi! 🥷 Let me know when you're ready to trade.",
        "Of course! The dojo is always open. 🎯",
        "Happy to help! Just say the word when you want to execute a trade.",
        "Always here. Fire off a trade command whenever you're ready. 🚀",
      ]),
    };
  }

  // ── Price Checking ────────────────────────────────────────────────────────
  const priceMatch = lower.match(/(?:price of|price for|how much is)\s+([a-z0-9]+)|([a-z0-9]+)\s+(?:price|rate)/);
  if (priceMatch) {
    const token = (priceMatch[1] || priceMatch[2] || "").toUpperCase();
    if (token) {
      // Map common symbols to CoinGecko IDs
      const cgMap: Record<string, string> = {
        INJ: "injective-protocol", ATOM: "cosmos", BLD: "agoric", AKT: "akash-network", ATONE: "atomone",
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether", USDC: "usd-coin"
      };
      
      let val: number | undefined;
      const cgId = cgMap[token];
      if (cgId) {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
          const data = await res.json();
          val = data[cgId]?.usd;
        } catch (e) {
          console.error("CoinGecko fetch failed", e);
        }
      }
      
      // Fallback
      if (!val) {
        const MOCK_PRICES: Record<string, number> = { INJ: 20.45, ATOM: 8.40, BLD: 0.12, AKT: 3.20, ATONE: 1.50 };
        val = MOCK_PRICES[token];
      }
      
      const priceStr = val 
        ? val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4})
        : (Math.random() * 100).toFixed(2);

      return {
        message: pick([
          `The current oracle price of **${token}** is **$${priceStr}** 📈`,
          `Checking the oracle... **${token}** is currently trading at **$${priceStr}**.`,
          `**${token}** is sitting at **$${priceStr}** right now. Ready to execute a trade?`,
        ]),
      };
    }
  }

  // ── Chart ────────────────────────────────────────────────────────
  const chartMatch = lower.match(/(?:chart of|chart for|show chart of)\s+([a-z0-9]+)|([a-z0-9]+)\s+(?:chart|graph)/);
  if (chartMatch) {
    const token = (chartMatch[1] || chartMatch[2] || "").toUpperCase();
    if (token) {
      // Map common symbols to CoinGecko IDs
      const cgMap: Record<string, string> = {
        INJ: "injective-protocol", ATOM: "cosmos", BLD: "agoric", AKT: "akash-network", ATONE: "atomone",
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana", USDT: "tether", USDC: "usd-coin"
      };
      
      let basePrice = 100.0;
      const cgId = cgMap[token];
      if (cgId) {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
          const data = await res.json();
          if (data[cgId]?.usd) basePrice = data[cgId].usd;
        } catch (e) {}
      } else {
        const MOCK_PRICES: Record<string, number> = { INJ: 20.45, ATOM: 8.40, BLD: 0.12, AKT: 3.20, ATONE: 1.50 };
        basePrice = MOCK_PRICES[token] || 100.0;
      }
      
      const mockData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const rand = 1 + (Math.random() * 0.1 - 0.05);
        return {
          time: d.toLocaleDateString("en-US", { weekday: "short" }),
          price: basePrice * rand,
        };
      });
      mockData[mockData.length - 1].price = basePrice;

      return {
        message: `Here is the 7-day performance chart for **${token}**:`,
        chartSnapshot: {
          token,
          data: mockData,
        }
      };
    }
  }

  // ── Farewell ─────────────────────────────────────────────────────────────
  if (matches(lower, norm, ["bye", "goodbye", "ciao", "exit", "quit", "see you", "seeyou", "later"])) {
    return {
      message: pick([
        "Stay sharp, shinobi. The dojo will be here when you return. 🥷",
        "Until next time. May your trades be profitable. 🎯",
        "Sayonara! Come back anytime to execute trades on Injective. 🚀",
      ]),
    };
  }


  // ── Fallback ──────────────────────────────────────────────────────────────
  return {
    message: pick([
      `Hmm, I'm not sure I caught that. 🤔\n\nI'm built for **DeFi trading** on Injective. Try:\n→ \`Buy 10 INJ at market price\`\n→ \`My portfolio\`\n→ \`What can you do?\``,

      `I specialize in DeFi trading, not general conversation 😄\n\nTry a trade like \`Sell $50 worth of USDT\`, or ask \`What can you do?\` to see my full capabilities.`,

      `That's outside my dojo 🥷 I'm a trading agent, not a chatbot.\n\nHere's what I *can* do:\n→ Execute trades on **Injective Testnet**\n→ Show your **portfolio**\n→ Answer questions about my capabilities`,

      `Didn't quite get that one. Try:\n→ A **trade**: \`Buy 5 ATOM\`\n→ **Portfolio**: \`My portfolio\`\n→ **Help**: \`What can you do?\``,
    ]),
  };
}

/* ── Zustand Store ─────────────────────────────────────────────────────── */

export const useKoudaiStore = create<KoudaiState>()(
  devtools(
    (set, get) => ({
      /* ── Initial State ─────────────────────────────────────────────── */
      phase: "IDLE",
      statusMessage: PHASE_MESSAGES["IDLE"],
      parsedIntent: null,
      orderResult: null,
      walletStatus: DEFAULT_WALLET,
      commandHistory: [],
      chatHistory: [],
      inputValue: "",
      isProcessing: false,
      isConfirmModalOpen: false,
      requiresConfirmation: false,

      /* ── Actions ───────────────────────────────────────────────────── */

      setPhase: (phase, message) =>
        set(
          { phase, statusMessage: message ?? PHASE_MESSAGES[phase] },
          false,
          `setPhase/${phase}`
        ),

      setParsedIntent: (intent) =>
        set({ parsedIntent: intent }, false, "setParsedIntent"),

      setOrderResult: (result) =>
        set({ orderResult: result }, false, "setOrderResult"),

      setWalletStatus: (status) =>
        set(
          (s) => ({ walletStatus: { ...s.walletStatus, ...status } }),
          false,
          "setWalletStatus"
        ),

      setInputValue: (value) =>
        set({ inputValue: value }, false, "setInputValue"),

      addHistoryEntry: (entry) => {
        const full: CommandHistoryEntry = {
          ...entry,
          id: generateId(),
          timestamp: Date.now(),
        };
        set(
          (s) => ({ commandHistory: [...s.commandHistory, full] }),
          false,
          "addHistoryEntry"
        );
      },

      updateLatestHistoryEntry: (updates) => {
        set((s) => {
          const history = [...s.commandHistory];
          if (history.length === 0) return {};
          const lastIdx = history.length - 1;
          history[lastIdx] = { ...history[lastIdx], ...updates };
          return { commandHistory: history };
        }, false, "updateLatestHistoryEntry");
      },

      setConfirmModalOpen: (open) =>
        set({ isConfirmModalOpen: open }, false, "setConfirmModalOpen"),

      /**
       * submitCommand — The main pipeline entry point.
       *
       * Flow:
       *  1. Guard: reject empty input or double-submission
       *  2. Route: if not a trading command → submitChatMessage (no FSM)
       *  3. Reset previous run state, add history entry
       *  4. IDLE → PARSING (with simulated delay)
       *  5. PARSING → VALIDATING (with simulated delay)
       *  6. Check if confirmation is required (low confidence OR limit order)
       *     a. If YES: open modal, pause here — confirmAndExecute() continues
       *     b. If NO:  VALIDATING → EXECUTING → COMPLETED
       */
      submitCommand: async (input: string) => {
        const trimmed = input.trim();
        if (!trimmed || get().isProcessing) return;

        // ── Route: chat vs trading ──────────────────────────────────────
        if (!isTradingCommand(trimmed)) {
          await get().submitChatMessage(trimmed);
          return;
        }

        // ── Reset prior state ───────────────────────────────────────────
        set(
          {
            isProcessing: true,
            parsedIntent: null,
            orderResult: null,
            inputValue: "",
          },
          false,
          "submitCommand/reset"
        );

        // Add a skeleton history entry
        get().addHistoryEntry({ raw_input: trimmed, phase: "PARSING" });

        // ── PARSING ────────────────────────────────────────────────────
        get().setPhase("PARSING");
        await delay(900);

        let intent: TradingIntent;
        try {
          intent = await parseIntentFromAPI(trimmed);
        } catch (error: any) {
          const errMsg = error?.message || "LLM failed to parse the intent.";
          let displayErr = errMsg.replace("LLM rejected request: ", "").replace("LLM call failed after 3 attempts: ", "");
          if (displayErr.includes("503") || displayErr.includes("UNAVAILABLE")) {
            displayErr = "AI service is currently busy due to high demand. Please try again in a moment.";
          } else if (displayErr.includes("429") || displayErr.includes("RESOURCE_EXHAUSTED")) {
            displayErr = "AI rate limit exceeded. Please wait a moment and try again.";
          }
          get().setPhase("ERROR", displayErr);
          get().updateLatestHistoryEntry({ phase: "ERROR", error: displayErr });
          set({ isProcessing: false }, false, "submitCommand/parseError");
          return;
        }

        get().setParsedIntent(intent);

        // ── VALIDATING ─────────────────────────────────────────────────
        get().setPhase("VALIDATING");
        await delay(700);

        // Determine if we need to gate behind the confirmation modal
        // For safety in DeFi, we should ALWAYS require confirmation for any trade.
        const needsConfirm = true;

        if (needsConfirm) {
          set(
            { requiresConfirmation: true, isConfirmModalOpen: true, isProcessing: false },
            false,
            "submitCommand/awaitConfirm"
          );
          return;
        }

        // ── Auto-proceed to EXECUTING ──────────────────────────────────
        await get().confirmAndExecute();
      },

      submitChatMessage: async (input: string) => {
        const trimmed = input.trim();
        if (!trimmed || get().isProcessing) return;

        set({ isProcessing: true, inputValue: "" }, false, "submitChatMessage/start");

        // Add user message immediately
        const userEntry: ChatEntry = {
          id: generateId(),
          role: "user",
          message: trimmed,
          timestamp: Date.now(),
        };
        set(
          (s) => ({ chatHistory: [...s.chatHistory, userEntry] }),
          false,
          "submitChatMessage/userEntry"
        );

        // Simulate AI thinking delay
        await delay(300);

        const { message, portfolioSnapshot, chartSnapshot } = await generateAiResponse(trimmed, get().walletStatus);

        const aiEntry: ChatEntry = {
          id: generateId(),
          role: "ai",
          message,
          timestamp: Date.now(),
          portfolioSnapshot: portfolioSnapshot ?? null,
          chartSnapshot: chartSnapshot ?? null,
        };
        set(
          (s) => ({ chatHistory: [...s.chatHistory, aiEntry], isProcessing: false }),
          false,
          "submitChatMessage/aiEntry"
        );
      },


      confirmAndExecute: async () => {
        const { parsedIntent, walletStatus } = get();
        if (!parsedIntent) return;

        set({ isConfirmModalOpen: false, isProcessing: true }, false, "confirmAndExecute/start");

        // ── EXECUTING ─────────────────────────────────────────────────
        get().setPhase("EXECUTING");
        await delay(1400);

        let result: any = null;
        try {
          result = await executeOrderFromAPI(parsedIntent);
          get().setOrderResult(result);
          
          // ── UPDATE REAL BALANCE ───────────────────────────────────────
          if (walletStatus.dry_run) {
             let newBal = walletStatus.inj_balance;
             const amt = parsedIntent.amount;
             if (parsedIntent.token.toUpperCase() === "INJ") {
               if (parsedIntent.action === "buy") newBal += amt;
               if (parsedIntent.action === "sell") newBal -= amt;
             }
             get().setWalletStatus({ inj_balance: Math.max(0, newBal) });
          } else {
             const newBalance = await fetchRealInjectiveBalance(walletStatus.address);
             if (newBalance > 0 || parsedIntent.action === "sell") {
                get().setWalletStatus({ inj_balance: newBalance });
             }
          }
        } catch (error) {
          get().setPhase("ERROR", "Execution failed on backend.");
          get().updateLatestHistoryEntry({ phase: "ERROR", error: "Execution failed." });
          set({ isProcessing: false }, false, "confirmAndExecute/error");
          return;
        }

        // ── COMPLETED ─────────────────────────────────────────────────
        get().setPhase("COMPLETED");
        get().updateLatestHistoryEntry({
          phase: "COMPLETED",
          intent: parsedIntent,
          result,
        });

        set(
          { isProcessing: false, requiresConfirmation: false },
          false,
          "confirmAndExecute/done"
        );
      },

      rejectIntent: () => {
        set(
          {
            isConfirmModalOpen: false,
            requiresConfirmation: false,
            isProcessing: false,
            parsedIntent: null,
          },
          false,
          "rejectIntent"
        );
        get().setPhase("IDLE");
        get().updateLatestHistoryEntry({ phase: "ERROR", error: "Rejected by user." });
      },

      reset: () =>
        set(
          {
            phase: "IDLE",
            statusMessage: PHASE_MESSAGES["IDLE"],
            parsedIntent: null,
            orderResult: null,
            commandHistory: [],
            chatHistory: [],
            inputValue: "",
            isProcessing: false,
            isConfirmModalOpen: false,
            requiresConfirmation: false,
          },
          false,
          "reset"
        ),
    }),
    { name: "KoudaiStore" }
  )
);

/* ── Derived Selectors (exported for convenience) ──────────────────────── */

/**
 * Returns true when the agent is in an active (non-idle, non-terminal) phase.
 * Use this to show loading spinners / disable inputs.
 */
export const selectIsActive = (s: KoudaiState) =>
  s.isProcessing || (s.phase !== "IDLE" && s.phase !== "COMPLETED" && s.phase !== "ERROR");

/**
 * Maps the current phase to a 0-indexed step number for the progress tracker.
 * IDLE=0, PARSING=1, VALIDATING=2, EXECUTING=3, COMPLETED/ERROR=4
 */
export const selectProgressStep = (s: KoudaiState): number => {
  const map: Record<AgentPhase, number> = {
    IDLE: 0,
    PARSING: 1,
    VALIDATING: 2,
    EXECUTING: 3,
    COMPLETED: 4,
    ERROR: 4,
  };
  return map[s.phase];
};

/* ── Tiny promise-based delay util ────────────────────────────────────── */
const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
