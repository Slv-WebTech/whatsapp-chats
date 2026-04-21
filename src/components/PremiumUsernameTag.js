import { Sparkles } from "lucide-react";

export default function PremiumUsernameTag({ username, className = "", compact = false }) {
    const safeUsername = String(username || "user").trim() || "user";

    return (
        <span
            className={[
                "premium-username-tag relative overflow-hidden",
                compact ? "premium-username-tag--compact" : "premium-username-tag--regular",
                "font-semibold",
                className,
            ].join(" ")}
        >
            <span className="premium-username-tag__shine" aria-hidden="true" />
            <span className="premium-username-tag__orb" aria-hidden="true" />
            <span className="premium-username-tag__icon-wrap">
                <Sparkles size={compact ? 10 : 12} className="premium-username-tag__icon" />
            </span>
            <span className="premium-username-tag__text truncate">{safeUsername}</span>
        </span>
    );
}
