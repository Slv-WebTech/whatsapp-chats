import { Archive, MessageCircleMore, Users } from "lucide-react";
import { Button } from "./ui/button";

function toMillis(value) {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function formatTimestamp(timestamp) {
  const millis = toMillis(timestamp);
  if (!millis) {
    return "";
  }

  const date = new Date(millis);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatListItem({ chat, isActive, onSelect, currentUserId }) {
  const lastMessageAt = toMillis(chat?.lastMessageAt);
  const lastReadAt = toMillis(chat?.memberMeta?.[currentUserId]?.lastReadAt);
  const lastSenderId = String(chat?.lastSenderId || '').trim();
  const isLatestMessageIncoming = !lastSenderId || String(currentUserId || '').trim() !== lastSenderId;
  const unread = lastMessageAt > 0 && lastReadAt < lastMessageAt && isLatestMessageIncoming ? 1 : 0;
  const title = chat.displayTitle || chat.name || "Untitled chat";
  const preview = chat.previewText || chat.lastMessageText || "No messages yet";
  const isImported = Boolean(chat?.isImported || chat?.type === "imported");

  return (
    <Button
      type="button"
      variant="ghost"
      className={`group h-auto w-full justify-start rounded-[1.35rem] border px-3 py-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.14)] transition-all duration-200 ${isActive ? "border-emerald-300/45 bg-[linear-gradient(130deg,rgba(16,185,129,0.2),rgba(6,182,212,0.14),rgba(15,23,42,0.08))] text-white" : "border-white/8 bg-[linear-gradient(130deg,rgba(15,23,42,0.36),rgba(15,23,42,0.2),rgba(15,23,42,0.12))] text-slate-100 hover:border-cyan-300/25 hover:bg-[linear-gradient(130deg,rgba(22,163,74,0.16),rgba(8,145,178,0.1),rgba(15,23,42,0.2))]"} ${isImported ? "border-cyan-300/35 bg-[linear-gradient(130deg,rgba(6,182,212,0.2),rgba(14,116,144,0.14),rgba(15,23,42,0.1))]" : ""} ${unread ? "border-emerald-300/45 bg-[linear-gradient(130deg,rgba(16,185,129,0.2),rgba(6,182,212,0.12),rgba(15,23,42,0.1))]" : ""}`}
      onClick={onSelect}
    >
      <div className="flex w-full items-start gap-3">
        <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300/30 via-cyan-300/18 to-slate-200/8 text-emerald-100 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
          {isImported ? <Archive size={18} /> : chat.type === "group" ? <Users size={18} /> : <MessageCircleMore size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-inherit drop-shadow-[0_1px_0_rgba(15,23,42,0.12)]">{title}</p>
            <span className="shrink-0 text-[11px] text-slate-300/85">{formatTimestamp(chat.lastMessageAt || chat.updatedAt)}</span>
          </div>
          {isImported ? (
            <span className="mt-1 inline-flex w-fit items-center rounded-full border border-cyan-300/45 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
              Imported
            </span>
          ) : null}
          <p className={`mt-1 truncate rounded-md px-1 py-0.5 text-xs ${unread ? "bg-emerald-500/20 font-semibold text-emerald-50" : "text-slate-300/85"}`}>{preview}</p>
        </div>
        {unread ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-cyan-300 px-1.5 text-[11px] font-bold text-slate-950 shadow-[0_6px_14px_rgba(16,185,129,0.35)]">
            {unread}
          </span>
        ) : null}
      </div>
    </Button>
  );
}
