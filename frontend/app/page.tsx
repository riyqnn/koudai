"use client";

/**
 * Koudai — Main Page (The Dojo Dashboard)
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  TopBar  — Brand wordmark + WalletWidget + network info         │
 *  ├────────────────────────────┬────────────────────────────────────┤
 *  │                            │  CommandTerminal (The Dojo)        │
 *  │  PortfolioSidebar          │  (full height)                     │
 *  │  - Wallet balance          │                                    │
 *  │  - Token prices            ├────────────────────────────────────┤
 *  │  - Recent transactions     │  (Intent Confirmation Modal)       │
 *  │                            │  (rendered as overlay)             │
 *  └────────────────────────────┴────────────────────────────────────┘
 *
 * Note: PortfolioSidebar and IntentConfirmModal are stubbed here and
 * will be expanded in subsequent phases. This page focuses on the
 * CommandTerminal wiring.
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";

import CommandTerminal from "@/components/CommandTerminal";
import {
  useKoudaiStore,
  fetchWalletStatusFromAPI,
  type TradingIntent,
} from "@/store/useKoudaiStore";

/* ══════════════════════════════════════════════════════════════════════════
   TopBar
══════════════════════════════════════════════════════════════════════════ */

function TopBar() {
  const { walletStatus, setWalletStatus } = useKoudaiStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (!(window as any).keplr) {
        alert("Please install the Keplr extension to connect.");
        setIsConnecting(false);
        return;
      }
      
      const chainId = "injective-888"; // Injective Testnet
      await (window as any).keplr.enable(chainId);
      
      const offlineSigner = (window as any).getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      const userAddress = accounts[0].address;

      // Fetch real balance from Injective LCD
      let balance = 1000.0; // Fallback balance if Testnet RPC is down
      try {
        const res = await fetch(`https://testnet.sentry.lcd.injective.network/cosmos/bank/v1beta1/balances/${userAddress}`);
        if (res.ok) {
          const data = await res.json();
          const injAsset = data.balances?.find((b: any) => b.denom === "inj");
          if (injAsset) {
             balance = parseFloat(injAsset.amount) / 1e18;
          }
        }
      } catch (e) {
        // Silently catch to avoid UI error overlay if testnet LCD is down
      }

      setWalletStatus({
        address: userAddress,
        inj_balance: balance,
        network: "testnet",
        is_connected: true,
        dry_run: false
      });
    } catch (err) {
      console.error("Keplr connection error", err);
      alert("Failed to connect Keplr.");
    } finally {
      setIsConnecting(false);
    }
  };

  const addrShort = walletStatus.address
    ? `${walletStatus.address.slice(0, 8)}…${walletStatus.address.slice(-6)}`
    : "—";

  return (
    <header className="flex-between h-14 px-5 border-b border-[var(--color-border)] bg-void-900/80 backdrop-blur-sm shrink-0 z-10">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Koudai Logo"
          width={32}
          height={32}
          className="rounded object-contain"
          priority
          style={{ width: "auto", height: "auto", filter: "drop-shadow(3px 3px 0px rgba(255,45,85,0.4))" }}
        />
        <div>
          <span className="font-mono font-bold text-sm tracking-[0.15em] text-[var(--color-text-primary)] uppercase">
            KOUDAI
          </span>
          <span className="font-mono text-2xs text-silver-600 ml-2">
            v0.1.0-testnet
          </span>
        </div>
      </div>

      {/* Right — wallet + network */}
      <div className="flex items-center gap-4">
        {!walletStatus.is_connected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-black bg-[var(--color-crimson)] rounded hover:bg-[var(--color-crimson-hover)] transition-colors"
          >
            {isConnecting ? "Connecting..." : "Connect Keplr"}
          </button>
        ) : (
          <>
            {/* INJ Balance */}
            <div className="hidden sm:flex items-center gap-2 kd-panel rounded px-3 py-1.5">
              <Wallet size={12} className="text-silver-500" />
              <span className="font-mono text-xs text-silver-400">
                <span className="text-[var(--color-text-primary)] font-semibold">
                  {walletStatus.inj_balance.toFixed(2)}
                </span>{" "}
                INJ
              </span>
            </div>

            {/* Address */}
            <div className="hidden md:flex items-center gap-1.5 kd-panel rounded px-3 py-1.5">
              <span className="kd-dot kd-dot-live" />
              <span className="font-mono text-xs text-silver-500 truncate-address">
                {addrShort}
              </span>
              <a
                href={`https://testnet.explorer.injective.network/account/${walletStatus.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-silver-700 hover:text-crimson transition-colors"
              >
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Dry-run badge */}
            {walletStatus.dry_run && (
              <span className="kd-badge-gold hidden sm:flex">SIM</span>
            )}
          </>
        )}
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PortfolioSidebar — Mock token prices + balance widget
══════════════════════════════════════════════════════════════════════════ */

interface TokenData {
  symbol: string;
  id: string;
  price: number;
  change24h: number;
  logo: string;
}

const INITIAL_TOKENS: TokenData[] = [
  { symbol: "INJ",   id: "injective-protocol", price: 20.45, change24h: 3.24, logo: "https://coin-images.coingecko.com/coins/images/12882/large/Secondary_Symbol.png" },
  { symbol: "ATOM",  id: "cosmos",             price: 8.40,  change24h: -1.12, logo: "https://coin-images.coingecko.com/coins/images/1481/large/cosmos_hub.png" },
  { symbol: "BLD",   id: "agoric",             price: 0.12,  change24h: 1.87, logo: "https://coin-images.coingecko.com/coins/images/24487/large/agoric_bld_logo.png" },
  { symbol: "AKT",   id: "akash-network",      price: 3.20,  change24h: 0.43, logo: "https://coin-images.coingecko.com/coins/images/12785/large/akash-logo.png" },
  { symbol: "ATONE", id: "atomone",            price: 1.50,  change24h: 0.00, logo: "https://coin-images.coingecko.com/coins/images/33230/large/atomone_200x200.jpg" },
];

function TokenRow({ token }: { token: TokenData }) {
  const isUp = token.change24h >= 0;
  return (
    <div className="flex-between py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-void-600 border border-[var(--color-border)] flex-center overflow-hidden">
          <img src={token.logo} alt={token.symbol} className="w-full h-full object-cover" />
        </div>
        <span className="font-mono text-xs text-[var(--color-text-primary)]">
          {token.symbol}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-xs text-[var(--color-text-primary)] tabular-nums">
          ${token.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </span>
        <span
          className={`font-mono text-2xs tabular-nums flex items-center gap-0.5 ${
            isUp ? "text-cyan" : "text-crimson"
          }`}
        >
          {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {isUp ? "+" : ""}
          {token.change24h.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function PortfolioSidebar() {
  const { walletStatus, commandHistory } = useKoudaiStore();
  const completedTrades = commandHistory.filter((e) => e.phase === "COMPLETED");
  const [tokens, setTokens] = useState<TokenData[]>(INITIAL_TOKENS);

  // Fetch real-time prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const ids = INITIAL_TOKENS.map((t) => t.id).join(",");
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
        if (!res.ok) return;
        const data = await res.json();
        
        setTokens((prev) => 
          prev.map((t) => {
            const coinData = data[t.id];
            if (coinData) {
              return {
                ...t,
                price: coinData.usd,
                change24h: coinData.usd_24h_change || 0,
              };
            }
            return t;
          })
        );
      } catch (err) {
        console.error("Failed to fetch token prices:", err);
      }
    };

    fetchPrices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const injPrice = tokens.find(t => t.symbol === "INJ")?.price || 20.45;

  return (
    <aside className="flex flex-col gap-4 overflow-y-auto no-scrollbar">
      {/* ─ Wallet Balance ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="kd-panel rounded-xl p-4"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 2px 2px 0px rgba(255,45,85,0.15)" }}
      >
        <div className="kd-section-title mb-3">Portfolio</div>

        {/* Balance display */}
        <div className="mb-3">
          <div className="font-mono text-3xl font-bold text-[var(--color-text-primary)] tabular-nums kd-glow-text-crimson">
            {walletStatus.inj_balance.toFixed(2)}
            <span className="text-silver-600 text-lg font-normal ml-1.5">INJ</span>
          </div>
          <div className="font-mono text-xs text-silver-500 mt-0.5">
            ≈ ${(walletStatus.inj_balance * injPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
        </div>

        {/* Wallet address */}
        <div className="kd-panel rounded px-2.5 py-2 flex-between">
          <div className="flex items-center gap-1.5">
            <span className="kd-dot-live" />
            <span className="font-mono text-2xs text-silver-500">
              {walletStatus.address.slice(0, 10)}…{walletStatus.address.slice(-6)}
            </span>
          </div>
          <span className="kd-badge-gold text-2xs">
            {walletStatus.network}
          </span>
        </div>
      </motion.div>

      {/* ─ Market Prices ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="kd-panel rounded-xl p-4"
      >
        <div className="kd-section-title mb-3">Live Prices</div>
        <div>
          {tokens.map((t) => (
            <TokenRow key={t.symbol} token={t} />
          ))}
        </div>
        <p className="font-mono text-2xs text-silver-700 mt-2">
          ◆ Live data via CoinGecko
        </p>
      </motion.div>

      {/* ─ Recent Trades ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.35, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="kd-panel rounded-xl p-4"
      >
        <div className="kd-section-title mb-3">Recent Trades</div>
        {completedTrades.length === 0 ? (
          <p className="font-mono text-2xs text-silver-700 py-4 text-center">
            No trades yet. Execute a command to see results here.
          </p>
        ) : (
          <div className="space-y-2">
            {completedTrades
              .slice()
              .reverse()
              .slice(0, 5)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="kd-panel rounded px-2.5 py-2 space-y-1"
                >
                  <div className="flex-between">
                    <span
                      className={`kd-badge ${
                        entry.intent?.action === "buy"
                          ? "kd-badge-cyan"
                          : "kd-badge-crimson"
                      }`}
                    >
                      {entry.intent?.action?.toUpperCase()}
                    </span>
                    <span className="font-mono text-2xs text-silver-600">
                      {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[var(--color-text-primary)]">
                    {entry.intent?.amount} {entry.intent?.token}
                  </div>
                  {entry.result?.tx_hash && (
                    <a
                      href={`https://testnet.explorer.injective.network/transaction/${entry.result.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-2xs text-silver-600 hover:text-crimson flex items-center gap-1 transition-colors"
                    >
                      {entry.result.tx_hash.slice(0, 10)}…
                      <ExternalLink size={8} />
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}
      </motion.div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   IntentConfirmModal
══════════════════════════════════════════════════════════════════════════ */

function ConfidenceBar({ value }: { value: number }) {
  const isHigh = value >= 0.9;
  return (
    <div className="space-y-1.5">
      <div className="flex-between font-mono text-2xs">
        <span className="text-silver-500">LLM Confidence</span>
        <span className={isHigh ? "text-cyan" : "text-gold-400"}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 bg-void-600 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${isHigh ? "bg-cyan" : "bg-gold-400"}`}
        />
      </div>
      {!isHigh && (
        <p className="font-mono text-2xs text-gold-400 flex items-center gap-1">
          <AlertTriangle size={10} />
          Low confidence — please verify the parsed intent.
        </p>
      )}
    </div>
  );
}

function IntentRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "crimson" | "cyan" | "gold" | "silver";
}) {
  const colorMap = {
    crimson: "text-crimson",
    cyan: "text-cyan",
    gold: "text-gold-400",
    silver: "text-[var(--color-text-primary)]",
  };
  return (
    <div className="flex-between py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="font-mono text-2xs text-silver-500 uppercase tracking-widest">
        {label}
      </span>
      <span
        className={`font-mono text-xs font-medium tabular-nums ${
          colorMap[accent ?? "silver"]
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function IntentConfirmModal() {
  const { isConfirmModalOpen, parsedIntent, confirmAndExecute, rejectIntent } =
    useKoudaiStore();

  return (
    <AnimatePresence>
      {isConfirmModalOpen && parsedIntent && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-void-950/80 backdrop-blur-sm z-40"
            onClick={rejectIntent}
          />

          {/* Modal panel */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, y: 30, scale: 0.97, skewX: -1 }}
            animate={{ opacity: 1, y: 0, scale: 1, skewX: 0 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
            style={{ maxWidth: "420px", width: "100%" }}
          >
            <div
              className="kd-panel rounded-xl m-4 sm:m-0 overflow-hidden"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,45,85,0.3), 0 32px 80px rgba(0,0,0,0.8), 4px 4px 0px rgba(255,45,85,0.25)",
              }}
            >
              {/* Modal header */}
              <div className="flex-between px-5 py-4 border-b border-[var(--color-border-accent)]">
                <div>
                  <h2 className="font-mono text-sm font-semibold text-[var(--color-text-primary)] tracking-wide">
                    CONFIRM INTENT
                  </h2>
                  <p className="font-mono text-2xs text-silver-600 mt-0.5">
                    Review parsed trade before execution
                  </p>
                </div>
                <button
                  onClick={rejectIntent}
                  className="kd-btn-ghost w-7 h-7 rounded"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Intent details */}
              <div className="px-5 py-4 space-y-3">
                {/* Action hero */}
                <div
                  className={`rounded border p-3 flex items-center gap-3 ${
                    parsedIntent.action === "buy"
                      ? "bg-cyan/5 border-cyan/20"
                      : "bg-crimson/5 border-crimson/20"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded flex-center font-mono font-bold text-base ${
                      parsedIntent.action === "buy"
                        ? "bg-cyan/10 text-cyan"
                        : "bg-crimson/10 text-crimson"
                    }`}
                  >
                    {parsedIntent.action === "buy" ? "B" : "S"}
                  </div>
                  <div>
                    <div className="font-mono text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
                      {parsedIntent.amount}{" "}
                      {parsedIntent.amount_denom === "usd"
                        ? "USD"
                        : parsedIntent.token}
                    </div>
                    <div className="font-mono text-2xs text-silver-500">
                      {parsedIntent.action.toUpperCase()} •{" "}
                      {parsedIntent.order_type.toUpperCase()} ORDER
                      {parsedIntent.amount_denom === "usd" &&
                        ` • of ${parsedIntent.token}`}
                    </div>
                  </div>
                </div>

                {/* Details table */}
                <div className="kd-panel rounded px-3">
                  <IntentRow
                    label="Token"
                    value={parsedIntent.token}
                    accent="silver"
                  />
                  <IntentRow
                    label="Action"
                    value={parsedIntent.action.toUpperCase()}
                    accent={parsedIntent.action === "buy" ? "cyan" : "crimson"}
                  />
                  <IntentRow
                    label="Order Type"
                    value={parsedIntent.order_type.toUpperCase()}
                    accent="silver"
                  />
                  {parsedIntent.price !== null && (
                    <IntentRow
                      label="Limit Price"
                      value={`$${parsedIntent.price.toFixed(2)}`}
                      accent="gold"
                    />
                  )}
                  <IntentRow
                    label="Denom"
                    value={parsedIntent.amount_denom === "usd" ? "USD" : "Token"}
                    accent="silver"
                  />
                </div>

                {/* Confidence */}
                <ConfidenceBar value={parsedIntent.confidence} />

                {/* Reasoning */}
                {parsedIntent.reasoning && (
                  <div className="kd-panel rounded px-3 py-2">
                    <p className="kd-label mb-1">LLM Reasoning</p>
                    <p className="font-mono text-2xs text-silver-500 leading-relaxed">
                      {parsedIntent.reasoning}
                    </p>
                  </div>
                )}
              </div>

              {/* CTA buttons */}
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={rejectIntent}
                  className="kd-btn-secondary flex-1"
                >
                  <X size={13} />
                  Cancel
                </button>
                <button
                  onClick={confirmAndExecute}
                  className="kd-btn-cyan flex-1"
                >
                  <CheckCircle2 size={13} />
                  Execute Trade
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main Page Component
══════════════════════════════════════════════════════════════════════════ */

export default function KoudaiDashboard() {
  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {/* Top navigation bar */}
      <TopBar />

      {/* Main 2-column grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left — Portfolio sidebar */}
        <div className="hidden lg:block overflow-y-auto no-scrollbar">
          <PortfolioSidebar />
        </div>

        {/* Right — Command Terminal */}
        <div className="min-h-0">
          <CommandTerminal />
        </div>
      </main>

      {/* Intent Confirmation Modal (portal-like, rendered at root) */}
      <IntentConfirmModal />
    </div>
  );
}
