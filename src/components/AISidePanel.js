import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckSquare, ChevronDown, ChevronUp, Lightbulb, Sparkles, X } from 'lucide-react';
import BottomSheet from './BottomSheet';

function CardSection({ title, icon: Icon, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-lg">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 text-left"
            >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <Icon size={15} />
                    {title}
                </span>
                {open ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
            </button>
            {open ? <div className="mt-2 text-sm text-slate-200/90">{children}</div> : null}
        </div>
    );
}

function AISidePanelContent({ summary, summaryLoading, summaryProvider, summaryLatencyMs, summaryBreakdown, aiSuggestions, onSummarize }) {
    const keyPoints = useMemo(() => summaryBreakdown?.keyPoints?.slice(0, 5) || [], [summaryBreakdown]);
    const tasks = useMemo(() => summaryBreakdown?.actions?.slice(0, 6) || [], [summaryBreakdown]);

    return (
        <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-200/25 bg-gradient-to-br from-cyan-300/20 to-emerald-300/10 p-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50">
                        <Sparkles size={15} />
                        AI Copilot
                    </p>
                    <button
                        type="button"
                        onClick={onSummarize}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15"
                    >
                        {summaryLoading ? 'Running...' : 'Summarize'}
                    </button>
                </div>
                {summaryProvider ? (
                    <p className="mt-2 text-[11px] text-cyan-100/90">
                        {summaryProvider}{summaryLatencyMs > 0 ? ` • ${summaryLatencyMs}ms` : ''}
                    </p>
                ) : null}
            </div>

            <CardSection title="Chat Summary" icon={Bot}>
                <p className="whitespace-pre-wrap leading-6 text-slate-100/90">{summary || 'No summary yet. Tap Summarize to generate one.'}</p>
            </CardSection>

            <CardSection title="Key Insights" icon={Lightbulb} defaultOpen>
                {keyPoints.length ? (
                    <ul className="space-y-1">
                        {keyPoints.map((item) => (
                            <li key={item} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs">{item}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-slate-300">Insights appear here after summary generation.</p>
                )}
            </CardSection>

            <CardSection title="Extracted Tasks" icon={CheckSquare} defaultOpen>
                {tasks.length ? (
                    <ul className="space-y-1">
                        {tasks.map((item, index) => (
                            <li key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs">{item}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-slate-300">No tasks extracted yet.</p>
                )}
            </CardSection>

            <CardSection title="Smart Suggestions" icon={Sparkles}>
                {aiSuggestions.length ? (
                    <div className="flex flex-wrap gap-2">
                        {aiSuggestions.map((item) => (
                            <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-100">{item}</span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-300">Suggestions appear as the conversation grows.</p>
                )}
            </CardSection>
        </div>
    );
}

export default function AISidePanel({
    open,
    onOpenChange,
    isMobile,
    summary,
    summaryLoading,
    summaryProvider,
    summaryLatencyMs,
    summaryBreakdown,
    aiSuggestions,
    onSummarize
}) {
    if (isMobile) {
        return (
            <BottomSheet open={open} onOpenChange={onOpenChange} title="AI Assistant">
                <AISidePanelContent
                    summary={summary}
                    summaryLoading={summaryLoading}
                    summaryProvider={summaryProvider}
                    summaryLatencyMs={summaryLatencyMs}
                    summaryBreakdown={summaryBreakdown}
                    aiSuggestions={aiSuggestions}
                    onSummarize={onSummarize}
                />
            </BottomSheet>
        );
    }

    return (
        <AnimatePresence>
            {open ? (
                <motion.aside
                    initial={{ opacity: 0, x: 18, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 18, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="absolute inset-y-3 right-3 z-30 hidden w-[340px] rounded-[1.35rem] border border-white/15 bg-[linear-gradient(160deg,rgba(2,6,23,0.72),rgba(7,20,39,0.62))] p-3 shadow-2xl backdrop-blur-2xl xl:flex xl:flex-col"
                >
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Sparkles size={15} />
                            AI Assistant
                        </p>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                            aria-label="Close AI panel"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-1">
                        <AISidePanelContent
                            summary={summary}
                            summaryLoading={summaryLoading}
                            summaryProvider={summaryProvider}
                            summaryLatencyMs={summaryLatencyMs}
                            summaryBreakdown={summaryBreakdown}
                            aiSuggestions={aiSuggestions}
                            onSummarize={onSummarize}
                        />
                    </div>
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
}
