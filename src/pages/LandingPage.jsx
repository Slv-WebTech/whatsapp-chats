import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart2,
  BadgeCheck,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Code2,
  Globe,
  LogIn,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Layers3,
  Radar,
  ScanSearch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BRAND, BRAND_ASSETS } from "../config/branding";
import adminDashboardPng from "../../screenshots/admin-dashboard.png";
import adminDashboardSvg from "../../screenshots/admin-dashboard.svg";
import groupChatsPng from "../../screenshots/group-chats.png";
import groupChatsSvg from "../../screenshots/group-chats.svg";
import privateChatsPng from "../../screenshots/private-chats.png";
import privateChatsSvg from "../../screenshots/private-chats.svg";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, delay, ease: "easeOut" },
});

const FEATURES = [
  {
    icon: Brain,
    title: "AI Insights",
    desc: "Extract summaries, decisions, action items, and key moments from every chat.",
    accent: "from-cyan-500 to-blue-500",
  },
  { icon: Search, title: "Smart Search", desc: "Find exact answers across live and imported conversations in seconds.", accent: "from-blue-500 to-indigo-500" },
  { icon: BarChart2, title: "Analytics", desc: "Track sentiment, topic momentum, and engagement trends over time.", accent: "from-indigo-500 to-violet-500" },
  {
    icon: Shield,
    title: "Secure by Default",
    desc: "Privacy-first architecture with encryption-focused data handling.",
    accent: "from-emerald-500 to-teal-500",
  },
  { icon: RefreshCw, title: "Replay", desc: "Replay conversations with structure, context, and AI annotations.", accent: "from-amber-500 to-orange-500" },
  {
    icon: Bot,
    title: "Assistant",
    desc: "Ask natural language questions and get contextual responses from your data.",
    accent: "from-fuchsia-500 to-pink-500",
  },
];

const STEPS = [
  { step: "01", title: "Import or Connect", desc: "Upload exports or start live chat in one workspace." },
  { step: "02", title: "AI Understands", desc: "Models index, cluster, summarize, and enrich your conversations." },
  { step: "03", title: "Act Faster", desc: "Use insights, analytics, and search to make better decisions." },
];

const DIFFERENTIATORS = [
  "Built for messy real-world conversations, not ideal datasets.",
  "One workspace for live chat, imported history, and AI analysis.",
  "Performance-oriented architecture with offline-capable surfaces.",
  "Clear privacy posture with practical security defaults.",
];

const USE_CASES = [
  { icon: "💼", title: "Professionals", desc: "Turn chat noise into concise summaries, next steps, and follow-ups." },
  { icon: "🤝", title: "Teams", desc: "Preserve team context and keep decisions visible across time." },
  { icon: "📈", title: "Founders", desc: "Extract recurring user pain points and product opportunities." },
  { icon: "🧠", title: "Researchers", desc: "Analyze large conversation sets and detect themes quickly." },
  { icon: "🎯", title: "Marketers", desc: "Find language patterns, objections, and winning message signals." },
  { icon: "🎬", title: "Creators", desc: "Mine community discussions for content ideas and story arcs." },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    sub: "For first exploration",
    features: ["Basic chat workspace", "Limited AI actions", "Imported chat support", "Community support"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$25",
    sub: "Lifetime access",
    features: ["Unlimited live chat", "AI summaries + search", "Core analytics", "Priority email support"],
    cta: "Choose Pro",
    featured: false,
  },
  {
    name: "Premium",
    price: "$53",
    sub: "Lifetime access",
    features: ["Everything in Pro", "Advanced analytics", "Exportable intelligence reports", "Priority feature access"],
    cta: "Go Premium",
    featured: true,
  },
];

const TESTIMONIALS = [
  { name: "Alex R.", role: "Product Manager", text: "BeyondStrings turned messy discussion logs into actionable weekly direction." },
  { name: "Priya K.", role: "Founder", text: "The insights quality is surprisingly strong. We ship faster with more confidence." },
  { name: "Sam T.", role: "Creator", text: "Replay + AI search changed how I plan content from my community chats." },
  { name: "Isha M.", role: "Ops Lead", text: "We finally have continuity across conversations, not fragmented context." },
];

const TRUST_LABELS = ["Acme Corp", "Stackify", "NovaTech", "Pulsar Labs", "Meridian AI", "Orbis"];

const PRODUCT_SURFACES = [
  {
    icon: Layers3,
    title: "Live Chat Workspace",
    desc: "High-signal messaging surface with fast actions and clean threading.",
    imagePng: groupChatsPng,
    imageSvg: groupChatsSvg,
  },
  {
    icon: Radar,
    title: "AI Insights Dashboard",
    desc: "Decision-centric summaries, trends, and confidence-aware highlights.",
    imagePng: adminDashboardPng,
    imageSvg: adminDashboardSvg,
  },
  {
    icon: ScanSearch,
    title: "Replay + Context",
    desc: "Timeline replay with semantic context and searchable checkpoints.",
    imagePng: privateChatsPng,
    imageSvg: privateChatsSvg,
  },
];

const BRAND_LINKS = [
  { Icon: Code2, label: "GitHub Repo", href: "https://github.com/Slv-WebTech/BeyondStrings" },
  { Icon: Globe, label: "Slv-WebTech", href: "https://github.com/Slv-WebTech" },
  { Icon: Mail, label: "hello@beyondstrings.app", href: "mailto:hello@beyondstrings.app" },
];

function SectionWrapper({ id, children, className = "", tone = "default" }) {
  const toneClass = tone === "soft" ? "bg-[var(--panel-soft)]/35 border-y border-[var(--border-soft)]" : "";
  return (
    <section id={id} className={`py-16 lg:py-24 ${toneClass} ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)]/65 p-5 sm:p-6 backdrop-blur-sm transition duration-200 hover:scale-[1.02] ${className}`}
    >
      {children}
    </div>
  );
}

function PricingCard({ plan, onSelect }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl border p-6 ${
        plan.featured
          ? "border-transparent bg-[linear-gradient(180deg,rgba(10,18,33,0.86),rgba(13,31,46,0.86))]"
          : "border-[var(--border-soft)] bg-[var(--panel-soft)]/75"
      }`}
    >
      {plan.featured ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl p-[1px] [background:linear-gradient(135deg,#22d3ee,#3b82f6,#a78bfa)]">
          <div className="h-full w-full rounded-3xl bg-transparent" />
        </div>
      ) : null}

      <div className="relative z-10 flex h-full flex-col">
        <h3 className="text-xl font-medium text-[var(--text-main)]">{plan.name}</h3>
        <p className="mt-3 text-4xl sm:text-5xl font-bold text-[var(--text-main)]">{plan.price}</p>
        <p className="mt-2 text-base text-gray-400">{plan.sub}</p>

        <ul className="mt-6 flex-1 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-base text-gray-400">
              <CheckCircle2 size={16} className="mt-1 shrink-0 text-cyan-400" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onSelect}
          className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
            plan.featured
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-95"
              : "border border-[var(--border-soft)] bg-[var(--panel)] text-[var(--text-main)] hover:border-cyan-500/50"
          }`}
        >
          {plan.cta}
        </button>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="text-3xl font-semibold text-[var(--text-main)]">{title}</h2>
      {subtitle ? <p className="mt-4 text-base text-gray-400">{subtitle}</p> : null}
    </div>
  );
}

export default function LandingPage({ onSignIn, onSelectAction }) {
  const [contactForm, setContactForm] = useState({ name: "", message: "" });
  const [contactSent, setContactSent] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverflowX = document.body.style.overflowX;
    const previousOverflowY = document.body.style.overflowY;

    document.body.style.overflow = "auto";
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "auto";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overflowX = previousOverflowX;
      document.body.style.overflowY = previousOverflowY;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function submitContact(e) {
    e.preventDefault();
    setContactSent(true);
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[var(--page-bg)] text-[var(--text-main)]">
      <nav className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[color:color-mix(in_srgb,var(--page-bg)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/15 bg-white/90">
              <img src={BRAND_ASSETS.logoDark} alt={BRAND.name} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">{BRAND.name}</p>
              <p className="hidden sm:block text-[11px] uppercase tracking-[0.2em] text-gray-400">Conversation Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold hover:border-cyan-400/45"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onSelectAction?.("live")}
              className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold text-white"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <SectionWrapper id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.14),transparent_25%)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            {...fadeUp(0)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300"
          >
            <Sparkles size={12} />
            AI-Powered Conversation Intelligence
          </motion.div>

          <motion.h1 {...fadeUp(0.08)} className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-main)]">
            Go Beyond Conversations
          </motion.h1>

          <motion.p {...fadeUp(0.16)} className="mt-4 text-base text-gray-400">
            Understand, search, and extract value from live and imported conversations in one premium AI workspace.
          </motion.p>

          <motion.div {...fadeUp(0.24)} className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onSelectAction?.("live")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-7 py-3 text-sm font-semibold text-white"
            >
              Get Started Free
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-7 py-3 text-sm font-semibold"
            >
              <LogIn size={14} />
              Login
            </button>
          </motion.div>

          <motion.div {...fadeUp(0.32)} className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Privacy First", value: "Zero-knowledge" },
              { icon: Clock3, title: "Fast Setup", value: "< 2 minutes" },
              { icon: BadgeCheck, title: "Workspace", value: "Live + Imported" },
            ].map(({ icon: Icon, title, value }) => (
              <Card key={title} className="p-4 text-left">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300">
                  <Icon size={18} />
                </div>
                <p className="text-sm font-medium text-[var(--text-main)]">{value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-gray-400">{title}</p>
              </Card>
            ))}
          </motion.div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="trust" tone="soft" className="!py-7 sm:!py-8 lg:!py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Trusted by developers & teams worldwide</p>
        <div className="mt-3 sm:mt-4 flex flex-nowrap items-center justify-start gap-2 sm:gap-3 overflow-x-auto pb-1 sm:justify-center">
          {TRUST_LABELS.map((name) => (
            <div key={name} className="shrink-0 rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold text-gray-400">
              {name}
            </div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper id="product-preview" className="!py-12 lg:!py-14">
        <SectionHeading title="See The Product" subtitle="Three core surfaces aligned for day-to-day execution." />
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PRODUCT_SURFACES.map(({ icon: Icon, title, desc, imagePng, imageSvg }, idx) => (
            <motion.div key={title} {...fadeUp(idx * 0.06)}>
              <Card className="h-full p-5 sm:p-6">
                <div className="mb-4 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--panel)]">
                  <img
                    src={imagePng}
                    alt={`${title} screenshot`}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    className="h-36 w-full object-cover sm:h-40"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-xl font-medium text-[var(--text-main)]">{title}</h3>
                <p className="mt-3 text-base text-gray-400">{desc}</p>
                <a
                  href={imageSvg}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-fit items-center rounded-md border border-[var(--border-soft)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition hover:border-cyan-400/45 hover:text-cyan-300"
                >
                  View Vector (SVG)
                </a>
              </Card>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper id="features">
        <SectionHeading title="Everything You Need In One Product" subtitle="A balanced feature stack with clarity-first UI and actionable AI." />

        <div className="mt-10 sm:mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fadeUp(i * 0.05)}>
              <Card className="flex h-full flex-col">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white`}>
                  <f.icon size={19} />
                </div>
                <h3 className="text-xl font-medium text-[var(--text-main)]">{f.title}</h3>
                <p className="mt-3 text-base text-gray-400">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper id="how-it-works" tone="soft">
        <SectionHeading title="How It Works" subtitle="Simple flow, production-ready output." />

        <div className="relative mt-10 sm:mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-cyan-500/30 via-blue-500/35 to-cyan-500/30 lg:block"
          />
          {STEPS.map((step, i) => (
            <motion.div key={step.step} {...fadeUp(i * 0.08)} className="relative text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border-soft)] bg-gradient-to-br from-cyan-500 to-blue-500 text-xl font-bold text-white">
                {step.step}
              </div>
              <h3 className="text-xl font-medium text-[var(--text-main)]">{step.title}</h3>
              <p className="mt-3 text-base text-gray-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper id="differentiation">
        <div className="grid grid-cols-1 items-start gap-6 sm:gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold text-[var(--text-main)]">Why BeyondStrings Feels Different</h2>
            <p className="mt-4 text-base text-gray-400">
              Designed as a conversation intelligence system, not just another chat UI. The product is structured for clarity, speed, and scalable
              decision-making.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {DIFFERENTIATORS.map((item, i) => (
              <motion.div key={item} {...fadeUp(i * 0.05)}>
                <Card className="flex items-start gap-3 p-5">
                  <CheckCircle2 size={18} className="mt-1 shrink-0 text-cyan-400" />
                  <p className="text-base text-gray-400">{item}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="use-cases" tone="soft">
        <SectionHeading title="Built For Real-World Use Cases" subtitle="Consistent card geometry and practical, high-value outcomes." />

        <div className="mt-10 sm:mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u, i) => (
            <motion.div key={u.title} {...fadeUp(i * 0.05)}>
              <Card className="flex h-full flex-col text-center">
                <div className="mb-4 text-4xl">{u.icon}</div>
                <h3 className="text-xl font-medium text-[var(--text-main)]">{u.title}</h3>
                <p className="mt-3 text-base text-gray-400">{u.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </SectionWrapper>

      <SectionWrapper id="pricing">
        <div className="mx-auto max-w-5xl">
          <SectionHeading title="Simple Pricing" subtitle="Aligned plans, equal card height, clear value." />

          <div className="mt-10 sm:mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch">
            {PRICING.map((plan) => (
              <PricingCard key={plan.name} plan={plan} onSelect={() => onSelectAction?.("live")} />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="about-vision" tone="soft">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-main)]">About & Vision</h2>
          <p className="mt-4 text-base text-gray-400">
            Conversations are high-value operational data. BeyondStrings transforms fragmented dialogue into structured intelligence you can search, trust, and
            act on.
          </p>
          <p className="mt-6 text-xl font-medium text-[var(--text-main)]">“To transform conversations into actionable intelligence.”</p>
        </div>
      </SectionWrapper>

      <SectionWrapper id="testimonials">
        <SectionHeading title="What Teams Say" subtitle="Swipe-ready carousel for compact, premium social proof." />

        <div className="mt-10 sm:mt-12 mx-auto max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={() => setTestimonialIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel)] text-[var(--text-main)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to testimonial ${idx + 1}`}
                  onClick={() => setTestimonialIndex(idx)}
                  className={`h-2.5 rounded-full transition ${idx === testimonialIndex ? "w-8 bg-cyan-400" : "w-2.5 bg-[var(--border-soft)]"}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={() => setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--panel)] text-[var(--text-main)]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIndex}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Card className="h-full min-h-[220px]">
                  <div className="mb-4 flex gap-1">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-base text-gray-400">"{TESTIMONIALS[testimonialIndex].text}"</p>
                  <p className="mt-6 text-sm font-semibold text-[var(--text-main)]">{TESTIMONIALS[testimonialIndex].name}</p>
                  <p className="text-xs text-gray-400">{TESTIMONIALS[testimonialIndex].role}</p>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="contact" tone="soft">
        <div className="grid grid-cols-1 items-start gap-6 sm:gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold text-[var(--text-main)]">Get In Touch</h2>
            <p className="mt-4 text-base text-gray-400">Questions, partnerships, product feedback, or enterprise access requests.</p>
            <a href="mailto:hello@beyondstrings.app" className="mt-4 inline-block text-base text-cyan-300 hover:underline">
              hello@beyondstrings.app
            </a>

            <div className="mt-6 flex flex-col gap-3">
              {BRAND_LINKS.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex max-w-full w-fit items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-2 text-sm text-gray-400 hover:border-cyan-400/45 hover:text-cyan-300"
                >
                  <Icon size={16} />
                  <span className="truncate">{label}</span>
                </a>
              ))}
            </div>
          </div>

          <Card>
            {contactSent ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={38} className="mx-auto text-cyan-400" />
                <p className="mt-4 text-base font-medium">Thanks. We will get back shortly.</p>
              </div>
            ) : (
              <form onSubmit={submitContact} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Name</label>
                  <input
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Tell us what you need"
                    className="w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-cyan-500/50"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  <Send size={15} />
                  Send Message
                </button>
              </form>
            )}
          </Card>
        </div>
      </SectionWrapper>

      <SectionWrapper id="final-cta">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-main)]">Ready To Upgrade Your Conversation Workflow?</h2>
          <p className="mt-4 text-base text-gray-400">Clean structure. Better decisions. Faster execution.</p>
          <button
            type="button"
            onClick={() => onSelectAction?.("live")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-3 text-sm font-semibold text-white"
          >
            Start Free
            <ArrowRight size={15} />
          </button>
        </div>
      </SectionWrapper>

      <footer className="border-t border-[var(--border-soft)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-white/90">
              <img src={BRAND_ASSETS.logoDark} alt={BRAND.name} className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-semibold">{BRAND.name}</span>
          </div>

          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <a href="#about-vision" className="hover:text-[var(--text-main)]">
              About
            </a>
            <a href="#pricing" className="hover:text-[var(--text-main)]">
              Pricing
            </a>
            <a href="#contact" className="hover:text-[var(--text-main)]">
              Contact
            </a>
          </nav>

          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
