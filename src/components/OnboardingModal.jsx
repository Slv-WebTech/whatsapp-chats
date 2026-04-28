import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, MessageCircle, Shield, Sparkles, UploadCloud, X } from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    color: "from-emerald-400 to-teal-500",
    title: "Welcome to Lensiq",
    desc: "An AI-powered Conversation Intelligence Platform that helps you understand, analyse, and act on your chats.",
  },
  {
    icon: MessageCircle,
    color: "from-blue-400 to-indigo-500",
    title: "Live Encrypted Chat",
    desc: "Chat in real-time with end-to-end encryption. All messages are encrypted before leaving your device.",
  },
  {
    icon: UploadCloud,
    color: "from-violet-400 to-purple-500",
    title: "Import & Analyse",
    desc: "Upload any WhatsApp export (.txt). AI extracts summaries, tasks, insights, and sentiment automatically.",
  },
  {
    icon: Brain,
    color: "from-pink-400 to-rose-500",
    title: "AI Conversation Intelligence",
    desc: "Use @AI commands, smart search, analytics dashboards, and replay to get the most out of every conversation.",
  },
  {
    icon: Shield,
    color: "from-amber-400 to-orange-500",
    title: "Privacy First",
    desc: "Your data stays yours. Encryption keys never leave your device. AI analysis is opt-in only.",
  },
];

const ONBOARDING_KEY = "lensiq_onboarding_done_v1";

export function useOnboarding() {
  const [show, setShow] = useState(() => !localStorage.getItem(ONBOARDING_KEY));

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShow(false);
  };

  return { show, dismiss };
}

export default function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onDone?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDone]);

  const handleNext = () => {
    if (isLast) {
      onDone?.();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding"
        onClick={(e) => {
          if (e.target === e.currentTarget) onDone?.();
        }}
      >
        <motion.div
          key={`step-${step}`}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.35 }}
          className="relative mx-auto w-full max-w-sm rounded-t-3xl bg-[var(--panel-strong)] p-6 shadow-2xl sm:rounded-3xl"
        >
          {/* Close */}
          <button
            type="button"
            onClick={onDone}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] text-[var(--text-muted)]"
            aria-label="Close onboarding"
          >
            <X size={14} />
          </button>

          {/* Icon */}
          <div className={`mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${current.color} shadow-lg`}>
            <current.icon size={30} className="text-white" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-bold text-[var(--text-main)]">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{current.desc}</p>

          {/* Steps indicator */}
          <div className="mt-5 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-emerald-500" : "w-1.5 bg-[var(--border-soft)]"}`}
              />
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleNext}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98]"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
