import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Crown, ImagePlus, Link2, LogOut, Save, Settings2, Sparkles, Trash2, UserMinus, Users, X } from 'lucide-react';
import { Button } from '../../../shared/components/UI/button';

function toMemberId(member) {
    return member?.uid || member?.id || member?.userId || '';
}

function toMemberName(member) {
    return member?.displayName || member?.name || member?.username || 'Member';
}

function MemberAvatar({ name }) {
    const initials = String(name || '?').slice(0, 2).toUpperCase();
    const hue = [...initials].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return (
        <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-inner"
            style={{ background: `hsl(${hue},55%,44%)` }}
        >
            {initials}
        </span>
    );
}

export default function GroupSettingsPanel({
    open,
    group,
    groupId,
    members = [],
    canManage = false,
    canLeave = false,
    currentUserId,
    onClose,
    onSave,
    onRemoveMember,
    onDeleteGroup,
    onLeaveGroup,
    onCopyInviteLink
}) {
    const [name, setName] = useState(group?.name || '');
    const [description, setDescription] = useState(group?.description || '');
    const [photoUrl, setPhotoUrl] = useState(group?.photoUrl || '');
    const [approvalRequired, setApprovalRequired] = useState(true);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setName(group?.name || '');
        setDescription(group?.description || '');
        setPhotoUrl(group?.photoUrl || '');
        const approvalFlagPresent = (
            Object.prototype.hasOwnProperty.call(group || {}, 'approvalRequired')
            || Object.prototype.hasOwnProperty.call(group || {}, 'requireJoinApproval')
            || Object.prototype.hasOwnProperty.call(group || {}, 'joinApproval')
        );
        const nextApprovalRequired = approvalFlagPresent
            ? Boolean(
                group?.approvalRequired === true
                || group?.requireJoinApproval === true
                || group?.joinApproval === 'admin'
            )
            : true;
        setApprovalRequired(nextApprovalRequired);
    }, [group?.approvalRequired, group?.description, group?.joinApproval, group?.name, group?.photoUrl, group?.requireJoinApproval]);

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            const aRole = String(a?.role || 'member');
            const bRole = String(b?.role || 'member');
            if (aRole === 'owner' && bRole !== 'owner') return -1;
            if (bRole === 'owner' && aRole !== 'owner') return 1;
            if (aRole === 'admin' && bRole === 'member') return -1;
            if (bRole === 'admin' && aRole === 'member') return 1;
            return toMemberName(a).localeCompare(toMemberName(b));
        });
    }, [members]);

    if (!open) return null;

    const handleSave = async () => {
        if (!canManage || !onSave || saving) return;
        setSaving(true);
        try {
            await onSave({
                name: String(name || '').trim(),
                description: String(description || '').trim(),
                photoUrl: String(photoUrl || '').trim(),
                approvalRequired
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = () => {
        onCopyInviteLink?.(groupId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm md:items-center"
            onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div className="ambient-ring premium-panel-strong glass-panel-strong relative w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-white/15 shadow-[0_32px_80px_rgba(0,0,0,0.55)] md:rounded-[2rem]">

                {/* Decorative top gradient bar */}
                <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[2rem] bg-gradient-to-r from-emerald-500/80 via-sky-400/80 to-violet-500/80" />

                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                        {group?.photoUrl ? (
                            <img src={group.photoUrl} alt={name} className="h-10 w-10 rounded-full border border-white/20 object-cover shadow" />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-sky-500/30 border border-emerald-400/20">
                                <Users size={18} className="text-emerald-400" />
                            </div>
                        )}
                        <div>
                            <h3 className="flex items-center gap-1.5 text-[1rem] font-semibold tracking-[-0.02em] text-[var(--text-main)]">
                                <Settings2 size={15} className="text-emerald-400" />
                                Group Settings
                            </h3>
                            <p className="text-[11px] text-[var(--text-muted)]">{sortedMembers.length} member{sortedMembers.length !== 1 ? 's' : ''} · {canManage ? 'You are the owner' : 'Member view'}</p>
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="rounded-full opacity-70 hover:opacity-100" onClick={onClose}>
                        <X size={16} />
                    </Button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto">
                    <div className="grid gap-0 md:grid-cols-2">

                        {/* Left — Group Details */}
                        <div className="space-y-4 border-b border-white/10 p-5 md:border-b-0 md:border-r">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                <Sparkles size={11} />
                                Group Details
                            </p>

                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Group Name</span>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={!canManage}
                                    className="input-surface h-10 w-full text-sm disabled:opacity-50"
                                    placeholder="Enter group name"
                                />
                            </label>

                            <label className="block space-y-1">
                                <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={!canManage}
                                    rows={3}
                                    className="input-surface w-full resize-none py-2 text-sm disabled:opacity-50"
                                    placeholder="Add a group description…"
                                />
                            </label>

                            <label className="block space-y-1">
                                <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                                    <ImagePlus size={11} />
                                    Photo URL
                                </span>
                                <input
                                    value={photoUrl}
                                    onChange={(e) => setPhotoUrl(e.target.value)}
                                    disabled={!canManage}
                                    className="input-surface h-10 w-full text-sm disabled:opacity-50"
                                    placeholder="https://…"
                                />
                            </label>

                            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                <span>
                                    <span className="block text-xs font-medium text-[var(--text-main)]">Require Approval To Join</span>
                                    <span className="block text-[11px] text-[var(--text-muted)]">Only approved users can become members and view messages.</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={approvalRequired}
                                    onChange={(e) => setApprovalRequired(Boolean(e.target.checked))}
                                    disabled={!canManage}
                                    className="h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-400 disabled:opacity-50"
                                />
                            </label>

                            {/* Invite link */}
                            {canManage && groupId ? (
                                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5">
                                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-400">
                                        <Link2 size={11} />
                                        Invite Link
                                    </p>
                                    <code className="block truncate rounded bg-black/20 px-2 py-1 text-[11px] text-[var(--text-muted)]">
                                        {`${window.location.origin}/?join=${groupId}`}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95"
                                    >
                                        {copied ? <Check size={13} /> : <Copy size={13} />}
                                        {copied ? 'Copied!' : 'Copy Invite Link'}
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        {/* Right — Members */}
                        <div className="space-y-3 p-5">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                <Users size={11} />
                                Members ({sortedMembers.length})
                            </p>

                            <div className="max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
                                {sortedMembers.length ? sortedMembers.map((member) => {
                                    const memberId = toMemberId(member);
                                    const isSelf = Boolean(currentUserId) && memberId === currentUserId;
                                    const role = String(member?.role || 'member').toLowerCase();
                                    const isOwner = role === 'owner';
                                    const isAdmin = role === 'admin';

                                    return (
                                        <div
                                            key={memberId || toMemberName(member)}
                                            className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2 transition hover:bg-white/7"
                                        >
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <MemberAvatar name={toMemberName(member)} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-[0.82rem] font-medium text-[var(--text-main)]">
                                                        {toMemberName(member)}
                                                        {isSelf ? <span className="ml-1 text-[10px] text-[var(--text-muted)]">(you)</span> : null}
                                                    </p>
                                                    {isOwner ? (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400">
                                                            <Crown size={9} /> Owner
                                                        </span>
                                                    ) : isAdmin ? (
                                                        <span className="text-[10px] font-medium text-sky-400">Admin</span>
                                                    ) : (
                                                        <span className="text-[10px] text-[var(--text-muted)]">Member</span>
                                                    )}
                                                </div>
                                            </div>
                                            {canManage && !isSelf && !isOwner ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveMember?.({ uid: memberId, username: toMemberName(member) })}
                                                    className="flex-shrink-0 rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 transition hover:bg-rose-500/20 active:scale-95"
                                                    title="Remove member"
                                                >
                                                    <UserMinus size={13} />
                                                </button>
                                            ) : null}
                                        </div>
                                    );
                                }) : (
                                    <p className="rounded-xl border border-white/8 bg-white/4 px-3 py-4 text-center text-sm text-[var(--text-muted)]">No members found.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                            {canManage ? (
                                <Button type="button" onClick={handleSave} disabled={saving}>
                                    <Save size={14} className="mr-1.5" />
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </Button>
                            ) : null}
                            {canLeave ? (
                                <Button type="button" variant="secondary" onClick={onLeaveGroup}>
                                    <LogOut size={14} className="mr-1.5" />
                                    Leave Group
                                </Button>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                            {!canManage ? (
                                <p className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                    <AlertTriangle size={12} />
                                    View only
                                </p>
                            ) : null}
                            {canManage ? (
                                <Button type="button" variant="destructive" onClick={onDeleteGroup}>
                                    <Trash2 size={14} className="mr-1.5" />
                                    Delete Group
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
