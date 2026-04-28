import { motion } from "framer-motion";
import { Brain, MessageCircle, UploadCloud, LogIn, Sparkles, Shield, Zap } from "lucide-react";

const FEATURES = [
  { icon: Brain, title: "AI-Powered Insights", desc: "Summaries, tasks, and key decisions extracted automatically." },
  { icon: Shield, title: "End-to-End Encrypted", desc: "All messages are encrypted client-side. Zero knowledge." },
  { icon: Zap, title: "Instant Analysis", desc: "Real-time sentiment, topics, and conversation patterns." },
];

const CTA_CARDS = [
  {
    id: "live",
    icon: MessageCircle,
    label: "Start Live Chat",
    desc: "Join real-time encrypted conversations with anyone.",
    accent: "from-emerald-500 to-teal-600",
    glow: "rgba(52,211,153,0.25)",
  },
  {
    id: "import",
    icon: UploadCloud,
    label: "Import Chat",
    desc: "Upload a WhatsApp export and analyse it with AI.",
    accent: "from-blue-500 to-indigo-600",
    glow: "rgba(99,102,241,0.25)",
  },
  {
    id: "analyze",
    icon: Brain,
    label: "Analyze Conversation",
    desc: "Deep-dive analytics, insights, and AI summaries.",
    accent: "from-purple-500 to-pink-600",
    glow: "rgba(168,85,247,0.25)",
  },
];

export default function LandingPage({ onSignIn, onSelectAction }) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[var(--page-bg)]">
      {/* Background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.22) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl grid-cols-1 gap-8 px-5 pb-10 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div className="flex flex-col">
          {/* Logo + hero */}
          <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8 text-center lg:text-left">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-400/30">
              <Sparkles size={30} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)] lg:text-4xl">
              Lens<span className="text-emerald-500">iq</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)] lg:max-w-[34ch] lg:text-base">
              AI-powered Conversation Intelligence Platform built for teams that want faster decisions from every conversation.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="space-y-3 lg:max-w-xl">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] lg:text-left">Why Lensiq</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {FEATURES.map((f) => (
                <div key={f.title} className="glass-panel flex items-start gap-3 rounded-xl px-3 py-2.5">
                  <f.icon size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-main)]">{f.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CTA cards */}
        <div className="glass-panel-strong mx-auto w-full max-w-xl rounded-3xl p-4 sm:p-5">
          <div className="mb-3 px-1 text-center sm:mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Get started</p>
            <p className="mt-1 text-sm text-[var(--text-main)]">Pick how you want to begin.</p>
          </div>
          <div className="space-y-3">
            {CTA_CARDS.map((card, i) => (
              <motion.button
                key={card.id}
                type="button"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelectAction?.(card.id)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel)] p-4 text-left backdrop-blur-md shadow-md transition hover:shadow-lg active:scale-[0.98]"
                style={{ boxShadow: `0 4px 24px ${card.glow}` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.accent} shadow-sm`}>
                    <card.icon size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-main)]">{card.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Sign in */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-5 text-center">
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-6 py-2.5 text-sm font-semibold text-[var(--text-main)] shadow-sm transition hover:shadow-md"
            >
              <LogIn size={15} />
              Sign in to continue
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
