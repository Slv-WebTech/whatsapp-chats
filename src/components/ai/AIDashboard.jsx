/**
 * AIDashboard — central Conversation Intelligence Dashboard
 * Sections: Summary · Key Insights · Extracted Tasks · Sentiment Overview
 * Used in desktop sidebar and mobile bottom sheet via AISidePanel.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, CheckSquare, ChevronDown, ChevronUp, Lightbulb, Smile, Sparkles, TrendingUp } from "lucide-react";

const SENTIMENT_COLORS = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-400",
  negative: "bg-rose-500",
  mixed: "bg-amber-400",
};

function SentimentBadge({ label }) {
  const key = (label || "neutral").toLowerCase();
  const dot = SENTIMENT_COLORS[key] || SENTIMENT_COLORS.neutral;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-main)] capitalize">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label || "Neutral"}
    </span>
  );
}

function DashCard({ title, icon: Icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
          <Icon size={15} className="text-emerald-500" />
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {open ? <ChevronUp size={13} className="text-[var(--text-muted)]" /> : <ChevronDown size={13} className="text-[var(--text-muted)]" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-[var(--text-muted)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingLines({ count = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-3 animate-pulse rounded-full bg-[var(--border-soft)]" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export default function AIDashboard({ summary, summaryLoading, summaryProvider, summaryLatencyMs, summaryBreakdown, aiSuggestions = [], onSummarize }) {
  const keyPoints = useMemo(() => summaryBreakdown?.keyPoints?.slice(0, 6) || [], [summaryBreakdown]);
  const tasks = useMemo(() => summaryBreakdown?.actions?.slice(0, 8) || [], [summaryBreakdown]);
  const sentiment = summaryBreakdown?.sentiment || null;
  const mood = summaryBreakdown?.mood || null;

  return (
    <div className="space-y-3 fade-slide-in">
      {/* Header + Summarize trigger */}
      <div className="rounded-2xl border border-emerald-200/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-main)]">
            <Sparkles size={15} className="text-emerald-500" />
            AI Dashboard
          </p>
          <button
            type="button"
            onClick={onSummarize}
            disabled={summaryLoading}
            className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-400"
          >
            {summaryLoading ? "Analysing…" : "Analyse"}
          </button>
        </div>
        {summaryProvider && (
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            {summaryProvider}
            {summaryLatencyMs > 0 ? ` · ${summaryLatencyMs}ms` : ""}
          </p>
        )}
      </div>

      {/* Summary */}
      <DashCard title="Conversation Summary" icon={Bot} defaultOpen>
        {summaryLoading ? (
          <LoadingLines count={4} />
        ) : summary ? (
          <p className="whitespace-pre-wrap leading-6 text-[var(--text-muted)]">{summary}</p>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)]">
            No summary yet. Tap <strong>Analyse</strong> to generate one.
          </p>
        )}
      </DashCard>

      {/* Key Insights */}
      <DashCard
        title="Key Insights"
        icon={Lightbulb}
        badge={
          keyPoints.length ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {keyPoints.length}
            </span>
          ) : null
        }
      >
        {summaryLoading ? (
          <LoadingLines count={3} />
        ) : keyPoints.length ? (
          <ul className="space-y-1.5">
            {keyPoints.map((pt) => (
              <li key={pt} className="flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                {pt}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)]">Insights appear after analysis.</p>
        )}
      </DashCard>

      {/* Extracted Tasks */}
      <DashCard
        title="Extracted Tasks"
        icon={CheckSquare}
        badge={
          tasks.length ? (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{tasks.length}</span>
          ) : null
        }
      >
        {summaryLoading ? (
          <LoadingLines count={2} />
        ) : tasks.length ? (
          <ul className="space-y-1.5">
            {tasks.map((task, i) => (
              <li key={`${task}-${i}`} className="flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-2 text-xs">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border-soft)]" />
                {task}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)]">No tasks extracted yet.</p>
        )}
      </DashCard>

      {/* Sentiment Overview */}
      <DashCard title="Sentiment Overview" icon={Smile}>
        {summaryLoading ? (
          <LoadingLines count={2} />
        ) : (
          <div className="space-y-2">
            {sentiment ? (
              <div className="flex flex-wrap gap-2">
                <SentimentBadge label={sentiment} />
                {mood && <SentimentBadge label={mood} />}
              </div>
            ) : (
              <p className="text-xs italic text-[var(--text-muted)]">Sentiment appears after analysis.</p>
            )}
          </div>
        )}
      </DashCard>

      {/* Smart Suggestions */}
      {aiSuggestions.length > 0 && (
        <DashCard title="Smart Suggestions" icon={TrendingUp} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((s) => (
              <span key={s} className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-3 py-1 text-xs text-[var(--text-main)]">
                {s}
              </span>
            ))}
          </div>
        </DashCard>
      )}
    </div>
  );
}
