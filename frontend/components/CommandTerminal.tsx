"use client";

/**
 * CommandTerminal — The Dojo (Command Center)
 *
 * The primary interaction surface for Koudai. Renders as a dark terminal panel
 * where users type natural language trading commands (e.g. "Buy $50 of INJ").
 *
 * Architecture:
 *  ┌─ TerminalHeader       — Title bar, network badge, status dot
 *  ├─ TerminalFeed         — Scrollable history log of past commands + results
 *  ├─ FSMProgressTracker   — "Shuriken" stepper showing IDLE→PARSING→…→DONE
 *  └─ TerminalInputRow     — Input box + submit button + keyboard hints
 *
 * All state lives in useKoudaiStore (Zustand). No local state except for
 * animation-specific refs.
 *
 * Animation strategy (Framer Motion):
 *  - Terminal mounts with a slice-in-from-bottom effect
 *  - Each history entry uses a staggered slice-in-from-left
 *  - FSM steps use a staggered fade/slide reveal
 *  - The submit button pulses while processing
 */

import {
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Terminal,
  Cpu,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Zap,
  ShieldCheck,
  RotateCcw,
  User,
  Wallet,
  ExternalLink,
} from "lucide-react";

import {
  useKoudaiStore,
  selectProgressStep,
  type AgentPhase,
  type CommandHistoryEntry,
  type TradingIntent,
  type OrderResult,
  type ChatEntry,
  type PortfolioSnapshot,
  type ChartSnapshot,
} from "@/store/useKoudaiStore";

/* ══════════════════════════════════════════════════════════════════════════
   Motion Variants
══════════════════════════════════════════════════════════════════════════ */

/** Terminal panel itself — slices up from below */
const panelVariants: Variants = {
  hidden: { opacity: 0, y: 40, skewX: -1 },
  visible: {
    opacity: 1,
    y: 0,
    skewX: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/** History entry — slices in from the left */
const feedEntryVariants: Variants = {
  hidden:  { opacity: 0, x: -20, skewX: -2 },
  visible: {
    opacity: 1,
    x: 0,
    skewX: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.15 },
  },
};

/** FSM step — individual step badge */
const stepVariants: Variants = {
  inactive: { opacity: 0.3, scale: 0.95 },
  active: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  done: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2 },
  },
};

/** Stagger container for FSM steps */
const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: TerminalHeader
══════════════════════════════════════════════════════════════════════════ */

function TerminalHeader() {
  const { walletStatus, phase, reset } = useKoudaiStore();

  const networkColor =
    walletStatus.network === "testnet" ? "text-gold-400" : "text-cyan";

  return (
    <div className="flex-between px-4 py-3 border-b border-[var(--color-border)]">
      {/* Left — brand + icon */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded flex-center bg-crimson/10 border border-crimson/20">
          <Terminal size={14} className="text-crimson" />
        </div>
        <div>
          <div className="font-mono text-xs font-semibold text-[var(--color-text-primary)] tracking-widest uppercase">
            KOUDAI
          </div>
          <div className="font-mono text-2xs text-silver-600 tracking-wider">
            The Dojo — Command Center
          </div>
        </div>
      </div>

      {/* Right — network badge + status + reset */}
      <div className="flex items-center gap-3">
        {/* Dry-run indicator */}
        {walletStatus.dry_run && (
          <span className="kd-badge-gold">DRY-RUN</span>
        )}

        {/* Network */}
        <span className={`font-mono text-2xs font-medium uppercase tracking-widest ${networkColor}`}>
          {walletStatus.network}
        </span>

        {/* Connection dot */}
        <span
          className={
            walletStatus.is_connected ? "kd-dot-live" : "kd-dot-error"
          }
        />

        {/* Reset button — only show when not IDLE */}
        {phase !== "IDLE" && (
          <button
            onClick={reset}
            className="kd-btn-ghost p-1 rounded"
            title="Reset agent"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: FSMProgressTracker (The Shuriken Progress)
══════════════════════════════════════════════════════════════════════════ */

interface FSMStep {
  phase: AgentPhase;
  label: string;
  icon: React.ElementType;
  description: string;
}

const FSM_STEPS: FSMStep[] = [
  {
    phase: "PARSING",
    label: "Parse",
    icon: Cpu,
    description: "LLM intent extraction",
  },
  {
    phase: "VALIDATING",
    label: "Validate",
    icon: ShieldCheck,
    description: "Constraint check",
  },
  {
    phase: "EXECUTING",
    label: "Execute",
    icon: Zap,
    description: "Injective submission",
  },
];

function FSMProgressTracker() {
  const { phase } = useKoudaiStore();
  const currentStep = useKoudaiStore(selectProgressStep);
  const isError = phase === "ERROR";

  // Map phase name to step index (1-based for FSM_STEPS array)
  const phaseToIndex: Partial<Record<AgentPhase, number>> = {
    PARSING: 1,
    VALIDATING: 2,
    EXECUTING: 3,
    COMPLETED: 4,
    ERROR: 4,
  };
  const activeIndex = phaseToIndex[phase] ?? 0;

  if (phase === "IDLE") return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-[var(--color-border)] px-4 py-3 overflow-hidden"
    >
      <div className="kd-label mb-2.5">
        ◆ Agent State Machine
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-2"
      >
        {FSM_STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = activeIndex > stepNum;
          const isActive = activeIndex === stepNum;
          const isUpcoming = activeIndex < stepNum;

          const Icon = step.icon;

          return (
            <div key={step.phase} className="flex items-center gap-2">
              {/* Step pill */}
              <motion.div
                variants={stepVariants}
                animate={
                  isDone ? "done" : isActive ? "active" : "inactive"
                }
                className={[
                  "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-all duration-300",
                  isDone
                    ? "bg-cyan/10 border-cyan/30 text-cyan"
                    : isActive
                    ? "bg-crimson/10 border-crimson/40 text-crimson"
                    : "bg-void-700 border-[var(--color-border)] text-silver-600",
                ].join(" ")}
              >
                {/* Active spinner or icon */}
                {isActive ? (
                  <Loader2
                    size={11}
                    className="animate-spin text-crimson shrink-0"
                  />
                ) : isDone ? (
                  <CheckCircle2 size={11} className="text-cyan shrink-0" />
                ) : (
                  <Icon size={11} className="shrink-0" />
                )}

                <span className="font-mono text-2xs font-medium uppercase tracking-widest whitespace-nowrap">
                  {step.label}
                </span>

                {/* Active glow pulse */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded border border-crimson/20"
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Connector line */}
              {idx < FSM_STEPS.length - 1 && (
                <div className="flex items-center gap-1">
                  <motion.div
                    className={[
                      "h-px transition-all duration-500",
                      isDone ? "w-6 bg-cyan/50" : "w-6 bg-[var(--color-border)]",
                    ].join(" ")}
                  />
                  <ChevronRight
                    size={10}
                    className={isDone ? "text-cyan/50" : "text-silver-700"}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Final state badge */}
        <AnimatePresence>
          {(phase === "COMPLETED" || isError) && (
            <motion.div
              key="final-state"
              initial={{ opacity: 0, scale: 0.85, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded border",
                isError
                  ? "bg-crimson/10 border-crimson/30 text-crimson"
                  : "bg-cyan/10 border-cyan/30 text-cyan",
              ].join(" ")}
            >
              {isError ? (
                <XCircle size={11} />
              ) : (
                <CheckCircle2 size={11} />
              )}
              <span className="font-mono text-2xs font-medium uppercase tracking-widest">
                {isError ? "Error" : "Done"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Status message */}
      <motion.p
        key={phase}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className={[
          "mt-2 font-mono text-2xs",
          isError ? "text-crimson" : "text-silver-500",
        ].join(" ")}
      >
        <span className="text-crimson mr-1.5">▸</span>
        {useKoudaiStore.getState().statusMessage}
      </motion.p>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: IntentBadge (in feed entries)
══════════════════════════════════════════════════════════════════════════ */

function IntentBadge({ intent }: { intent: TradingIntent }) {
  const isHighConf = intent.confidence >= 0.9;
  const confColor = isHighConf ? "text-cyan" : "text-gold-400";
  const confBg = isHighConf ? "bg-cyan/5 border-cyan/15" : "bg-gold/5 border-gold/15";

  return (
    <div
      className={`mt-2 rounded border p-2.5 ${confBg} font-mono text-2xs space-y-1.5`}
    >
      {/* Action + Token */}
      <div className="flex items-center gap-2">
        <span
          className={`kd-badge ${
            intent.action === "buy" ? "kd-badge-cyan" : "kd-badge-crimson"
          }`}
        >
          {intent.action.toUpperCase()}
        </span>
        <span className="text-[var(--color-text-primary)] font-semibold text-xs">
          {intent.amount}{" "}
          {intent.amount_denom === "usd" ? "USD" : intent.token}
          {intent.amount_denom === "usd" && (
            <span className="text-silver-500 font-normal"> of {intent.token}</span>
          )}
        </span>
        <span className="kd-badge-silver">{intent.order_type}</span>
        {intent.price !== null && (
          <span className="text-silver-400">
            @ ${intent.price.toFixed(2)}
          </span>
        )}
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-2">
        <span className="text-silver-600 shrink-0">Confidence</span>
        <div className="flex-1 h-1 bg-void-600 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${intent.confidence * 100}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${
              isHighConf ? "bg-cyan" : "bg-gold-400"
            }`}
          />
        </div>
        <span className={`${confColor} shrink-0`}>
          {(intent.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: ResultBadge (in feed entries)
══════════════════════════════════════════════════════════════════════════ */

function ResultBadge({ result }: { result: OrderResult }) {
  const isSuccess = result.status !== "failed";
  const txShort = result.tx_hash
    ? `${result.tx_hash.slice(0, 12)}…${result.tx_hash.slice(-8)}`
    : null;

  return (
    <div
      className={`mt-1.5 rounded border p-2.5 font-mono text-2xs space-y-1.5 ${
        isSuccess
          ? "bg-cyan/5 border-cyan/15"
          : "bg-crimson/5 border-crimson/15"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={isSuccess ? "kd-badge-cyan" : "kd-badge-crimson"}
        >
          {result.status.toUpperCase()}
        </span>
        <span className="text-silver-400">
          Filled: <span className="text-[var(--color-text-primary)]">{result.filled_amount}</span>
        </span>
        {result.filled_price && (
          <span className="text-silver-400">
            @ <span className="text-cyan">${result.filled_price.toFixed(2)}</span>
          </span>
        )}
      </div>

      {txShort && (
        <div className="flex items-center gap-1.5 text-silver-500">
          <span className="text-silver-700">TX</span>
          <a
            href={`https://testnet.explorer.injective.network/transaction/${result.tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-crimson hover:text-crimson-300 underline underline-offset-2 transition-colors"
          >
            {txShort}
          </a>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: TerminalFeedEntry
══════════════════════════════════════════════════════════════════════════ */

function TerminalFeedEntry({ entry }: { entry: CommandHistoryEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isError = entry.phase === "ERROR";
  const isCompleted = entry.phase === "COMPLETED";

  return (
    <motion.div
      variants={feedEntryVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="group px-4 py-3 border-b border-[var(--color-border)] last:border-b-0"
    >
      {/* Input line */}
      <div className="flex items-start gap-2">
        {/* Prompt symbol */}
        <span
          className={`font-mono text-xs mt-0.5 shrink-0 transition-colors ${
            isError
              ? "text-crimson"
              : isCompleted
              ? "text-cyan"
              : "text-silver-600"
          }`}
        >
          {isError ? "✗" : isCompleted ? "✓" : "›"}
        </span>

        <div className="flex-1 min-w-0">
          {/* Raw command */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-sm text-[var(--color-text-primary)] break-all">
              {entry.raw_input}
            </span>
            <span className="font-mono text-2xs text-silver-700 shrink-0 ml-auto">
              {time}
            </span>
          </div>

          {/* Intent summary */}
          {entry.intent && <IntentBadge intent={entry.intent} />}

          {/* Order result */}
          {entry.result && <ResultBadge result={entry.result} />}

          {/* Error */}
          {isError && entry.error && (
            <p className="mt-1.5 font-mono text-2xs text-crimson">
              <span className="text-silver-600">ERR </span>
              {entry.error}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: ChatPortfolioCard (inline portfolio snapshot in AI response)
══════════════════════════════════════════════════════════════════════════ */

function ChatPortfolioCard({ snap }: { snap: PortfolioSnapshot }) {
  const addrShort = `${snap.address.slice(0, 10)}…${snap.address.slice(-6)}`;
  const usdValue = (snap.inj_balance * 5.35).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mt-3 rounded-lg border border-[var(--color-border-accent)] bg-void-800/60 overflow-hidden"
      style={{ boxShadow: "0 0 0 1px rgba(255,45,85,0.08), inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-void-900/40">
        <div className="flex items-center gap-1.5">
          <Wallet size={11} className="text-crimson" />
          <span className="font-mono text-2xs text-silver-400 uppercase tracking-widest">Portfolio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`kd-dot ${snap.is_connected ? "kd-dot-live" : "kd-dot-error"}`} />
          <span className="font-mono text-2xs text-silver-500 uppercase">{snap.network}</span>
          {snap.dry_run && (
            <span className="kd-badge-gold text-2xs">SIM</span>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="px-3 py-3 space-y-2">
        <div>
          <div className="font-mono text-2xl font-bold text-[var(--color-text-primary)] tabular-nums kd-glow-text-crimson">
            {snap.inj_balance.toFixed(2)}
            <span className="text-silver-600 text-sm font-normal ml-1.5">INJ</span>
          </div>
          <div className="font-mono text-xs text-silver-500 mt-0.5">≈ ${usdValue} USD</div>
        </div>

        {/* Address */}
        <div className="flex items-center justify-between kd-panel rounded px-2.5 py-1.5">
          <span className="font-mono text-2xs text-silver-500">{addrShort}</span>
          <a
            href={`https://testnet.explorer.injective.network/account/${snap.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-silver-700 hover:text-crimson transition-colors"
          >
            <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: ChatChartCard (inline chart snapshot in AI response)
══════════════════════════════════════════════════════════════════════════ */

function ChatChartCard({ snap }: { snap: ChartSnapshot }) {
  // Find min and max for YAxis domain padding
  const prices = snap.data.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mt-3 rounded-lg border border-[var(--color-border-accent)] bg-void-800/60 overflow-hidden w-full max-w-sm"
      style={{ boxShadow: "0 0 0 1px rgba(255,45,85,0.08), inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center px-3 py-2 border-b border-[var(--color-border)] bg-void-900/40">
        <span className="font-mono text-2xs text-silver-400 uppercase tracking-widest flex items-center gap-1.5">
          <Zap size={11} className="text-crimson" /> {snap.token} / USD
        </span>
      </div>
      <div className="px-1 py-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={snap.data}>
            <XAxis 
              dataKey="time" 
              stroke="var(--color-silver-700)" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              dy={5}
            />
            <YAxis 
              domain={[minPrice, maxPrice]} 
              hide={true} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--color-void-900)', 
                borderColor: 'var(--color-border)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
              itemStyle={{ color: 'var(--color-text-primary)' }}
              formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "Price"]}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="var(--color-crimson)" 
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-void-900)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--color-crimson)", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: ChatFeedEntry (AI conversational message bubble)
══════════════════════════════════════════════════════════════════════════ */

/** Minimal markdown renderer: bolds **text**, inlines `code`, preserves newlines */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    // Split on **bold** and `code`
    const chunks = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    chunks.forEach((chunk, ci) => {
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        parts.push(
          <strong key={ci} className="font-semibold text-[var(--color-text-primary)]">
            {chunk.slice(2, -2)}
          </strong>
        );
      } else if (chunk.startsWith("`") && chunk.endsWith("`")) {
        parts.push(
          <code
            key={ci}
            className="bg-void-600 border border-[var(--color-border)] rounded px-1 py-0.5 font-mono text-crimson text-2xs"
          >
            {chunk.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(chunk);
      }
    });
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function ChatFeedEntry({ entry }: { entry: ChatEntry }) {
  const isAi = entry.role === "ai";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <motion.div
      variants={feedEntryVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`px-4 py-3 flex gap-3 ${isAi ? "items-start" : "items-start flex-row-reverse"}`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full shrink-0 overflow-hidden border ${
          isAi
            ? "border-crimson/25"
            : "bg-void-600 border-[var(--color-border)] flex-center"
        }`}
      >
        {isAi ? (
          <Image
            src="/logo.png"
            alt="Koudai"
            width={28}
            height={28}
            className="w-full h-full object-cover"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,45,85,0.4))" }}
          />
        ) : (
          <User size={13} className="text-silver-500" />
        )}
      </div>

      {/* Bubble */}
      <div className={`flex-1 min-w-0 ${isAi ? "" : "flex flex-col items-end"}`}>
        {/* Role label + time */}
        <div className={`flex items-center gap-2 mb-1 ${isAi ? "" : "flex-row-reverse"}`}>
          <span className={`font-mono text-2xs font-medium uppercase tracking-widest ${isAi ? "text-crimson" : "text-silver-500"}`}>
            {isAi ? "Koudai" : "You"}
          </span>
          <span className="font-mono text-2xs text-silver-700">{time}</span>
        </div>

        {/* Message */}
        <div
          className={[
            "rounded-lg px-3 py-2.5 font-mono text-xs leading-relaxed max-w-prose",
            isAi
              ? "bg-void-800/80 border border-[var(--color-border)] text-silver-300 rounded-tl-none"
              : "bg-crimson/8 border border-crimson/15 text-[var(--color-text-primary)] rounded-tr-none",
          ].join(" ")}
        >
          {renderMarkdown(entry.message)}
        </div>

        {/* Portfolio card (AI response only) */}
        {isAi && entry.portfolioSnapshot && (
          <ChatPortfolioCard snap={entry.portfolioSnapshot} />
        )}
        
        {/* Chart card (AI response only) */}
        {isAi && entry.chartSnapshot && (
          <ChatChartCard snap={entry.chartSnapshot} />
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: AiThinkingIndicator (shown while chat is processing)
══════════════════════════════════════════════════════════════════════════ */

function AiThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-3 flex gap-3 items-start"
    >
      <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden border border-crimson/25">
        <Image
          src="/logo.png"
          alt="Koudai"
          width={28}
          height={28}
          className="w-full h-full object-cover"
          style={{ filter: "drop-shadow(0 0 4px rgba(255,45,85,0.4))" }}
        />
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        {[0, 0.18, 0.36].map((delay, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-crimson/50"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-Component: TerminalWelcome (shown when history is empty)
══════════════════════════════════════════════════════════════════════════ */

const ALL_EXAMPLES = [
  { cmd: "Buy 10 INJ at market price",  type: "trade" as const },
  { cmd: "Sell $50 worth of USDT",       type: "trade" as const },
  { cmd: "Buy 5 ATOM at $2.5 limit",    type: "trade" as const },
  { cmd: "My portfolio",                 type: "chat"  as const },
  { cmd: "INJ chart",                    type: "chat"  as const },
  { cmd: "What can you do?",            type: "chat"  as const },
];

function TerminalWelcome({
  onExample,
}: {
  onExample: (cmd: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full px-6 py-8 text-center"
    >
      {/* Logo with pulse ring */}
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-full bg-crimson/5 border border-crimson/15 flex-center p-1">
          <Image
            src="/logo.png"
            alt="Koudai"
            width={44}
            height={44}
            className="rounded-full object-contain"
            priority
            style={{ filter: "drop-shadow(0 0 8px rgba(255,45,85,0.5))" }}
          />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border border-crimson/20"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
        />
      </div>

      <h2 className="font-mono text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        KOUDAI AGENT READY
      </h2>
      <p className="font-mono text-2xs text-silver-600 mb-5 max-w-xs leading-relaxed">
        I am your autonomous DeFi agent on Injective.<br />
        Type a trading command to execute on-chain, or chat with me to view your portfolio and token prices.
      </p>

      {/* Single vertical example list */}
      <div className="w-full max-w-xs space-y-1.5">
        {ALL_EXAMPLES.map((item, i) => {
          const isChat = item.type === "chat";
          // Insert divider before first chat item
          const showDivider = i > 0 && isChat && ALL_EXAMPLES[i - 1].type === "trade";
          return (
            <div key={item.cmd}>
              {showDivider && (
                <div className="flex items-center gap-2 py-2 mt-2">
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                  <span className="font-mono text-2xs text-silver-700 uppercase tracking-widest font-bold">💬 Chat & Info</span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>
              )}
              {i === 0 && (
                <div className="flex items-center gap-2 py-2 mb-1">
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                  <span className="font-mono text-2xs text-silver-700 uppercase tracking-widest font-bold">⚡ Trading (On-Chain)</span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>
              )}
              <button
                onClick={() => onExample(item.cmd)}
                className={[
                  "w-full text-left kd-panel rounded px-3 py-2 font-mono text-xs text-silver-400 transition-all duration-150 group",
                  isChat
                    ? "hover:border-cyan/30 hover:text-[var(--color-text-primary)]"
                    : "hover:border-crimson/30 hover:text-[var(--color-text-primary)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "mr-2 transition-colors",
                    isChat
                      ? "text-cyan/50 group-hover:text-cyan"
                      : "text-crimson/50 group-hover:text-crimson",
                  ].join(" ")}
                >
                  ›
                </span>
                {item.cmd}
              </button>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}



/* ══════════════════════════════════════════════════════════════════════════
   Main Export: CommandTerminal
══════════════════════════════════════════════════════════════════════════ */

export default function CommandTerminal() {
  const {
    commandHistory,
    chatHistory,
    inputValue,
    isProcessing,
    phase,
    setInputValue,
    submitCommand,
    isConfirmModalOpen,
  } = useKoudaiStore();

  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Merge trading entries and chat entries, sorted by timestamp
  const unifiedFeed = [
    ...commandHistory.map((e) => ({ ...e, _type: "trade" as const })),
    ...chatHistory.map((e) => ({ ...e, _type: "chat" as const })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const isEmpty = unifiedFeed.length === 0;
  // Chat is processing when there's no trading activity but we're waiting
  const isChatProcessing = isProcessing && phase === "IDLE";

  /* Auto-scroll feed to bottom on new entries */
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [commandHistory, chatHistory]);

  /* Focus input on mount */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* Focus input when processing finishes */
  useEffect(() => {
    if (!isProcessing && !isConfirmModalOpen) {
      // Small timeout to allow React to re-enable the input element first
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isProcessing, isConfirmModalOpen]);

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (!inputValue.trim() || isProcessing) return;
      await submitCommand(inputValue);
    },
    [inputValue, isProcessing, submitCommand]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleExampleClick = useCallback(
    (cmd: string) => {
      setInputValue(cmd);
      inputRef.current?.focus();
    },
    [setInputValue]
  );

  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col h-full kd-panel rounded-xl overflow-hidden border border-[var(--color-border)]"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,45,85,0.04), 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* ─ Header ─────────────────────────────────────────────────────── */}
      <TerminalHeader />

      {/* ─ FSM Progress Tracker ───────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase !== "IDLE" && (
          <FSMProgressTracker key="fsm-tracker" />
        )}
      </AnimatePresence>

      {/* ─ Feed ───────────────────────────────────────────────────────── */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto kd-terminal-scroll min-h-0"
      >
        <AnimatePresence initial={false}>
          {isEmpty ? (
            <TerminalWelcome
              key="welcome"
              onExample={handleExampleClick}
            />
          ) : (
            <>
              {unifiedFeed.map((entry) =>
                entry._type === "chat" ? (
                  <ChatFeedEntry key={entry.id} entry={entry} />
                ) : (
                  <TerminalFeedEntry key={entry.id} entry={entry} />
                )
              )}
              {/* AI thinking dots — shown while waiting for chat response */}
              {isChatProcessing && (
                <AiThinkingIndicator key="thinking" />
              )}
            </>
          )}
        </AnimatePresence>
      </div>


      {/* ─ Input Row ──────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--color-border)] bg-void-900/50 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3"
        >
          {/* Prompt label */}
          <span className="font-mono text-crimson text-sm shrink-0 select-none">
            ›_
          </span>

          {/* Text input */}
          <input
            ref={inputRef}
            id="koudai-command-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder={
              isProcessing
                ? "Processing…"
                : "Buy 10 INJ at market price…"
            }
            autoComplete="off"
            spellCheck={false}
            className={[
              "flex-1 bg-transparent border-none outline-none",
              "font-mono text-sm text-[var(--color-text-primary)]",
              "placeholder-silver-700 caret-crimson",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-opacity duration-200",
            ].join(" ")}
          />

          {/* Blinking cursor when idle */}
          {!inputValue && !isProcessing && (
            <span className="kd-cursor" aria-hidden="true" />
          )}

          {/* Submit button */}
          <motion.button
            id="koudai-submit-btn"
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            whileTap={{ scale: 0.92 }}
            animate={
              isProcessing
                ? { boxShadow: ["0 0 0px rgba(255,45,85,0)", "0 0 12px rgba(255,45,85,0.6)", "0 0 0px rgba(255,45,85,0)"] }
                : {}
            }
            transition={isProcessing ? { duration: 1, repeat: Infinity } : {}}
            className={[
              "shrink-0 w-8 h-8 rounded flex-center",
              "border transition-all duration-150",
              inputValue.trim() && !isProcessing
                ? "bg-crimson/10 border-crimson/40 text-crimson hover:bg-crimson/20 hover:shadow-glow-sm-crimson cursor-pointer"
                : "bg-void-700 border-[var(--color-border)] text-silver-700 cursor-not-allowed opacity-40",
            ].join(" ")}
            title="Submit command (Enter)"
          >
            {isProcessing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
          </motion.button>
        </form>

        {/* Keyboard hint */}
        <div className="px-4 pb-2 flex items-center gap-3">
          <span className="font-mono text-2xs text-silver-800">
            <kbd className="px-1 py-0.5 rounded border border-silver-800/40 text-silver-700">Enter</kbd>
            {" "}to execute
          </span>
          <span className="font-mono text-2xs text-silver-800">
            <kbd className="px-1 py-0.5 rounded border border-silver-800/40 text-silver-700">Esc</kbd>
            {" "}to clear
          </span>
        </div>
      </div>
    </motion.div>
  );
}
