import { Search, Unlock } from "lucide-react";
import { useState } from "react";
import PremiumUsernameTag from "./PremiumUsernameTag";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function SearchBar({ userQuery, onUserQueryChange, userResults, onCreateDirectChat, onJoinGroup, loading }) {
  const [groupSecret, setGroupSecret] = useState("");

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <Input value={userQuery} onChange={(event) => onUserQueryChange(event.target.value)} placeholder="Search usernames" className="pl-10 rounded-2xl" />
      </div>

      {userQuery.trim().length >= 2 ? (
        <div className="space-y-2 rounded-[1.2rem] border border-white/10 bg-white/5 p-2">
          {userResults.length ? (
            userResults.map((user) => (
              <button
                key={user.uid}
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5"
                onClick={() => onCreateDirectChat(user)}
              >
                <PremiumUsernameTag username={user.username} compact />
                <span className="text-xs text-emerald-300">Create chat</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-400">No users found.</p>
          )}
        </div>
      ) : null}

      <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Join Group</p>
        <div className="mt-2 flex gap-2">
          <Input value={groupSecret} onChange={(event) => setGroupSecret(event.target.value)} placeholder="Enter group secret" className="rounded-2xl" />
          <Button
            type="button"
            variant="secondary"
            disabled={loading || groupSecret.trim().length < 6}
            onClick={() => {
              onJoinGroup(groupSecret);
              setGroupSecret("");
            }}
          >
            <Unlock size={15} />
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}
