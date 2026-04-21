import { setActiveChatRouteId } from '../utils/chatRouteState';
import { ArrowLeft, LogOut, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import ChatListItem from '../components/ChatListItem';
import Layout from './Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fetchChatsByIds, subscribeUserChats } from '../firebase/socialService';
import { getImportedChatById, listImportedChats } from '../utils/importedChatStore';
import { selectAuthProfile, selectAuthUser, selectIsAdmin } from '../store/authSlice';
import { includesQuery } from '../utils/highlight';
import { groupMessages } from '../utils/groupMessages';

function buildDisplayTitle(chat, currentUserId) {
    if (chat?.type === 'group') {
        return chat.name || `Group ${chat.id.slice(0, 8)}`;
    }

    const usernames = chat?.memberUsernames || {};
    return Object.entries(usernames).find(([uid]) => uid !== currentUserId)?.[1] || 'Direct chat';
}

function shouldRenderDateChip(list, index) {
    if (index === 0) {
        return true;
    }

    return list[index - 1]?.date !== list[index]?.date;
}

export default function ImportedChatPage({ importedId, navigate, onLogout }) {
    const authUser = useSelector(selectAuthUser);
    const profile = useSelector(selectAuthProfile);
    const isAdmin = useSelector(selectIsAdmin);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [regularChats, setRegularChats] = useState([]);
    const [importedChats, setImportedChats] = useState([]);
    const [search, setSearch] = useState('');
    const [activeImported, setActiveImported] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authUser?.uid) {
            return undefined;
        }

        return subscribeUserChats(authUser.uid, async (nextChatIds) => {
            const items = await fetchChatsByIds(nextChatIds);
            setRegularChats(items.map((entry) => ({ ...entry, displayTitle: buildDisplayTitle(entry, authUser.uid) })));
        });
    }, [authUser?.uid]);

    useEffect(() => {
        let cancelled = false;

        if (!authUser?.uid) {
            setImportedChats([]);
            return undefined;
        }

        listImportedChats(authUser.uid)
            .then((items) => {
                if (!cancelled) {
                    setImportedChats(items);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setImportedChats([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [authUser?.uid]);

    useEffect(() => {
        let cancelled = false;

        if (!authUser?.uid || !importedId) {
            setActiveImported(null);
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        getImportedChatById(importedId, authUser.uid)
            .then((value) => {
                if (cancelled) {
                    return;
                }

                if (!value) {
                    setError('Imported chat not found.');
                    setActiveImported(null);
                } else {
                    setError('');
                    setActiveImported(value);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setError('Unable to load imported chat.');
                    setActiveImported(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [authUser?.uid, importedId]);

    const groupedMessages = useMemo(() => groupMessages(activeImported?.payload?.messages || []), [activeImported?.payload?.messages]);
    const filteredMessages = useMemo(() => {
        if (!search.trim()) {
            return groupedMessages;
        }

        return groupedMessages.filter((entry) => includesQuery(entry?.message || '', search));
    }, [groupedMessages, search]);

    const sidebar = (
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-between">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/home')}
                    className="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
                    aria-label="Go to home"
                    title="Home"
                >
                    <ArrowLeft size={15} />
                </Button>
                <p className="text-xs font-semibold text-[var(--text-muted)]">{profile?.username || 'User'}</p>
            </div>

            <div className="space-y-2">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/80">Regular Chats</p>
                {regularChats.slice(0, 6).map((chat) => (
                    <ChatListItem
                        key={chat.id}
                        chat={chat}
                        currentUserId={authUser?.uid}
                        isActive={false}
                        onSelect={() => {
                            setActiveChatRouteId(chat.id);
                            navigate('/chat');
                        }}
                    />
                ))}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">Imported Chats</p>
                {importedChats.length ? (
                    importedChats.map((chat) => (
                        <ChatListItem
                            key={chat.id}
                            chat={{ ...chat, isImported: true, type: 'imported' }}
                            currentUserId={authUser?.uid}
                            isActive={chat.id === importedId}
                            onSelect={() => {
                                navigate(`/imported/${encodeURIComponent(chat.id)}`);
                                setSidebarOpen(false);
                            }}
                        />
                    ))
                ) : (
                    <div className="rounded-[1.1rem] border border-dashed border-cyan-300/30 bg-cyan-500/10 p-3 text-xs text-cyan-100/85">
                        Import chats from Home to see them here.
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5">
                <div className="flex items-center gap-2">
                    {isAdmin ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => navigate('/admin')}
                            className="h-11 w-11 rounded-2xl border border-cyan-300/25 bg-cyan-500/10"
                            aria-label="Open admin panel"
                            title="Open admin panel"
                        >
                            <Shield size={17} />
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onLogout}
                        className="h-11 w-11 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)]"
                        aria-label="Logout"
                        title="Logout"
                    >
                        <LogOut size={17} />
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <Layout
            sidebar={sidebar}
            sidebarOpen={sidebarOpen}
            onSidebarOpenChange={setSidebarOpen}
            title={activeImported?.metadata?.displayTitle || 'Imported Chat'}
            showAdmin={false}
            rightAction={null}
            hideHeader
        >
            <div className="flex h-full flex-col overflow-hidden bg-[var(--chat-shell)]">
                <div className="border-b border-[var(--border-soft)] bg-[var(--panel-strong)] px-3 py-2.5 md:px-6 md:py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300/90">Imported Conversation Workspace</p>
                    <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-[var(--text-muted)]">
                            {activeImported?.metadata?.messageCount || 0} messages • source: {activeImported?.metadata?.fileName || 'unknown'}
                        </p>
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search imported messages"
                            className="h-9 w-full max-w-sm"
                        />
                    </div>
                </div>

                <section className="scroll-thin flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4">
                    {loading ? (
                        <div className="grid h-full place-items-center text-sm text-[var(--text-muted)]">Loading imported chat...</div>
                    ) : error ? (
                        <div className="grid h-full place-items-center text-sm text-rose-300">{error}</div>
                    ) : !filteredMessages.length ? (
                        <div className="grid h-full place-items-center text-sm text-[var(--text-muted)]">No messages match this search.</div>
                    ) : (
                        <div className="mx-auto w-full max-w-4xl space-y-1">
                            {filteredMessages.map((message, index) => (
                                <div key={message.id} className="space-y-1">
                                    {shouldRenderDateChip(filteredMessages, index) ? (
                                        <div className="my-2.5 flex justify-center">
                                            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--date-chip)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)] shadow-sm">
                                                {message.date || 'Unknown date'}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className={`flex ${message?.isSystem ? 'justify-center' : 'justify-start'}`}>
                                        <div className={`max-w-[92%] rounded-2xl border px-3 py-2 ${message?.isSystem ? 'border-slate-400/25 bg-slate-900/35 text-slate-200 text-xs' : 'border-[var(--border-soft)] bg-[var(--panel-soft)] text-[var(--text-main)]'}`}>
                                            {!message?.isSystem ? (
                                                <p className="mb-1 text-[11px] font-semibold text-[var(--accent)]">{message.sender || 'Unknown'}</p>
                                            ) : null}
                                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p>
                                            <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">{message.time}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </Layout>
    );
}
