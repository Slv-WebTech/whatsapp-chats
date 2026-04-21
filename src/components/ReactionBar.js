import { motion } from 'framer-motion';

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '🔥', '👏'];

export default function ReactionBar({ onSelect, className = '', reactions = DEFAULT_REACTIONS }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/35 px-2 py-1 shadow-lg backdrop-blur ${className}`}
        >
            {reactions.map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    onClick={() => onSelect?.(emoji)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition hover:scale-110 hover:bg-white/20"
                    aria-label={`React with ${emoji}`}
                    title={`React with ${emoji}`}
                >
                    {emoji}
                </button>
            ))}
        </motion.div>
    );
}
