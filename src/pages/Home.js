import { LogOut, MessageCircle, Plus, Shield, Upload, UserPlus, Users, X } from "lucide-react";
import HelpModal from "../components/HelpModal";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ChatListItem from "../components/ChatListItem";
import SearchBar from "../components/SearchBar";
import PremiumUsernameTag from "../components/PremiumUsernameTag";
import { Button } from "../components/ui/button";
import Layout from "./Layout";
import { createGroupChat, createOrGetDirectChat, fetchChatsByIds, getDirectChatSecret, getGroupChatSecret, joinGroupChatById, searchUsersByUsername, subscribeChat, subscribeUserChats, syncUserChatMembership } from "../firebase/socialService";
import { parseWhatsAppFileInChunks } from "../utils/parser";
import { listImportedChats, saveImportedChat } from "../utils/importedChatStore";
import { selectAuthProfile, selectAuthUser, selectIsAdmin } from "../store/authSlice";
import { selectAvatarPreferences } from "../store/appSessionSlice";
import { decryptMessage } from "../utils/encryption";
import { setActiveChatRouteId } from "../utils/chatRouteState";
import { resyncMembershipServer } from "../services/api/chatMembership";

function isLikelyGroupChat(chat) {
  const id = String(chat?.id || "").trim().toLowerCase();
  const type = String(chat?.type || "").trim().toLowerCase();
  if (type === "group") {
    return true;
  }

  if (id.startsWith("grp-") || /^[a-f0-9]{64}$/i.test(id)) {
    return true;
  }

  return Boolean(chat?.ownerId || chat?.createdBy || chat?.memberRoles);
}

function buildDisplayTitle(chat, currentUserId) {
  if (isLikelyGroupChat(chat)) {
    return chat.name || `Group ${chat.id.slice(0, 8)}`;
  }

  const usernames = chat.memberUsernames || {};
  return Object.entries(usernames).find(([uid]) => uid !== currentUserId)?.[1] || "Direct chat";
}

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

function getConversationSortTime(chat) {
  return toMillis(chat?.lastMessageAt)
    || toMillis(chat?.updatedAt)
    || toMillis(chat?.updatedAtMs)
    || toMillis(chat?.createdAt)
    || toMillis(chat?.createdAtMs)
    || 0;
}

function buildLastMessagePreview(chat) {
  const raw = String(
    chat?.previewText ||
    chat?.lastMessageText ||
    chat?.lastMessagePreview ||
    chat?.latestMessageText ||
    chat?.lastMessage?.text ||
    ''
  ).trim();

  if (!raw) {
    return 'No messages yet';
  }

  if (raw.startsWith('wc:')) {
    return '[Message]';
  }

  if (raw.startsWith('U2FsdGVkX1')) {
    if (isLikelyGroupChat(chat) && chat?.id) {
      try {
        return decryptMessage(raw, getGroupChatSecret(chat.id));
      } catch {
        return '[Message]';
      }
    }

    if (chat?.id) {
      try {
        return decryptMessage(raw, getDirectChatSecret(chat.id));
      } catch {
        return '[Message]';
      }
    }

    return '[Message]';
  }

  return raw;
}

export default function Home({ navigate, onLogout }) {
  const dispatch = useDispatch();
  const authUser = useSelector(selectAuthUser);
  const profile = useSelector(selectAuthProfile);
  const isAdmin = useSelector(selectIsAdmin);
  const avatars = useSelector(selectAvatarPreferences);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [chats, setChats] = useState([]);
  const [importedChats, setImportedChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importHint, setImportHint] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);
  const createGroupRef = useRef(null);
  const joinGroupRef = useRef(null);

  const importInputRef = useRef(null);

  useEffect(() => {
    if (!createGroupOpen && !joinGroupOpen) return;
    function handleClick(e) {
      if (createGroupRef.current && !createGroupRef.current.contains(e.target)) setCreateGroupOpen(false);
      if (joinGroupRef.current && !joinGroupRef.current.contains(e.target)) setJoinGroupOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [createGroupOpen, joinGroupOpen]);

  function extractGroupId(raw) {
    const s = String(raw || '').trim();
    try {
      const url = new URL(s);
      const fromParam = url.searchParams.get('join');
      if (fromParam) return fromParam.trim();
    } catch {
      // not a URL, use as-is
    }
    return s;
  }

  // Auto-join group when opened via invite link (?join=<groupId>)
  useEffect(() => {
    if (!authUser?.uid || !profile) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (!joinId) return;
    // Remove param from URL without reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    handleJoinGroup(joinId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid, profile]);

  useEffect(() => {
    if (!authUser?.uid) {
      return undefined;
    }

    let cancelled = false;
    let recoveredFromFailure = false;
    let liveChatUnsubscribers = [];

    resyncMembershipServer()
      .catch(() => {
        // Fallback to client-side sync when API route isn't available (e.g., local dev without server env).
        return syncUserChatMembership(authUser.uid);
      })
      .catch(() => {
        // Non-blocking warmup.
      });

    const clearLiveSubscriptions = () => {
      liveChatUnsubscribers.forEach((unsubscribe) => unsubscribe?.());
      liveChatUnsubscribers = [];
    };

    const hydrateChatList = async (nextChatIds) => {
      const safeChatIds = Array.from(new Set((nextChatIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
      clearLiveSubscriptions();

      if (!safeChatIds.length) {
        setChats([]);
        return;
      }

      const items = await fetchChatsByIds(safeChatIds);
      if (cancelled) {
        return;
      }

      setChats(items.map((chat) => ({
        ...chat,
        displayTitle: buildDisplayTitle(chat, authUser.uid),
        previewText: buildLastMessagePreview(chat)
      })));

      liveChatUnsubscribers = safeChatIds.map((id) =>
        subscribeChat(
          id,
          (nextChat) => {
            if (!nextChat || cancelled) {
              return;
            }

            const normalized = {
              ...nextChat,
              displayTitle: buildDisplayTitle(nextChat, authUser.uid),
              previewText: buildLastMessagePreview(nextChat)
            };

            setChats((prev) => {
              const withoutCurrent = prev.filter((entry) => entry.id !== normalized.id);
              return [...withoutCurrent, normalized].sort((left, right) => getConversationSortTime(right) - getConversationSortTime(left));
            });
          },
          () => {
            // Keep list stable if one chat subscription fails.
          }
        )
      );
    };

    const stopUserChatList = subscribeUserChats(
      authUser.uid,
      (nextChatIds) => {
        if (!cancelled) {
          setError("");
        }

        hydrateChatList(nextChatIds).catch(() => {
          if (!cancelled) {
            setChats([]);
          }
        });
      },
      () => {
        if (!cancelled) {
          setChats([]);

          if (recoveredFromFailure) {
            setError("Unable to load your chat list.");
            return;
          }

          recoveredFromFailure = true;
          resyncMembershipServer()
            .catch(() => syncUserChatMembership(authUser.uid))
            .catch(() => {
              // If recovery fails once, the next subscription error will surface to the UI.
            });
        }
      }
    );

    return () => {
      cancelled = true;
      stopUserChatList?.();
      clearLiveSubscriptions();
    };
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

    if (userQuery.trim().length < 2 || !authUser?.uid) {
      setSearchResults([]);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      searchUsersByUsername(userQuery, authUser.uid)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [userQuery, authUser?.uid]);

  const activeChatId = useMemo(() => "", []);

  const mergedChats = useMemo(() => {
    const regular = chats.map((entry) => ({
      ...entry,
      isImported: false,
      type: entry.type || (isLikelyGroupChat(entry) ? 'group' : '1:1')
    }));
    const imported = importedChats.map((entry) => ({
      ...entry,
      isImported: true,
      type: 'imported',
      updatedAt: entry.updatedAtMs || entry.lastMessageAt || 0
    }));

    return [...regular, ...imported].sort((left, right) => getConversationSortTime(right) - getConversationSortTime(left));
  }, [chats, importedChats]);

  const refreshImportedChats = async () => {
    if (!authUser?.uid) {
      setImportedChats([]);
      return;
    }

    const items = await listImportedChats(authUser.uid);
    setImportedChats(items);
  };

  const handleCreateDirectChat = async (targetUser) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextChatId = await createOrGetDirectChat({ ...profile, uid: authUser.uid }, targetUser);
      setActiveChatRouteId(nextChatId);
      navigate('/chat');
    } catch (createError) {
      setError(createError?.message || "Unable to create direct chat.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (groupName) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await createGroupChat({ ...profile, uid: authUser.uid }, { name: groupName });
      setActiveChatRouteId(result.chatId);
      navigate('/chat');
    } catch (createError) {
      setError(createError?.message || "Unable to create group.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (groupId) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const resolvedId = extractGroupId(groupId);
    if (!resolvedId) {
      setError('Please enter a valid group ID or invite link.');
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await joinGroupChatById({ ...profile, uid: authUser.uid }, resolvedId);
      if (result?.status === 'pending') {
        setError('Join request submitted. Group owner/admin approval is required.');
        return;
      }
      setActiveChatRouteId(result.chatId);
      navigate('/chat');
    } catch (joinError) {
      const rawMessage = String(joinError?.message || '').trim();
      const normalizedMessage = rawMessage.toLowerCase();
      if (normalizedMessage.includes('internal assertion failed')) {
        setError('Unable to submit join request right now. Please retry in a few seconds.');
      } else {
        setError(rawMessage || "Unable to join group.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImportedFileSelect = async (file) => {
    if (!file) {
      return;
    }

    if (!authUser?.uid) {
      setError("Sign in required to import chats.");
      return;
    }

    try {
      setIsImporting(true);
      setImportHint('Importing chat...');
      setError('');

      const parsed = await parseWhatsAppFileInChunks(file, {
        chunkSize: 1800
      });

      await saveImportedChat({
        ownerUid: authUser.uid,
        fileName: file.name,
        parsed
      });

      await refreshImportedChats();
      setImportHint('Imported chat added to list.');
    } catch (importError) {
      setError(importError?.message || "Unable to save imported chat.");
      setImportHint('');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const sidebar = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
      <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3 md:p-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300/80">Signed in as</p>
        <div className="mt-2 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="h-10 w-10 overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--panel)]"
            title="Open profile"
            aria-label="Open profile"
          >
            <img
              src={avatars[profile?.username || ''] || 'https://i.pravatar.cc/100?img=12'}
              alt={profile?.username || 'Profile'}
              className="h-full w-full object-cover"
            />
          </button>
          <PremiumUsernameTag username={profile?.username || "user"} />
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Create direct chats and join groups with your account.</p>
      </div>

      <SearchBar
        userQuery={userQuery}
        onUserQueryChange={setUserQuery}
        userResults={searchResults}
        onCreateDirectChat={handleCreateDirectChat}
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
        loading={loading}
        showGroupActions={false}
      />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 md:pr-1">
        {mergedChats.length ? (
          mergedChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              currentUserId={authUser?.uid}
              isActive={chat.id === activeChatId}
              onSelect={() => {
                if (chat.isImported) {
                  navigate(`/imported/${encodeURIComponent(chat.id)}`);
                  return;
                }
                setActiveChatRouteId(chat.id);
                navigate('/chat');
              }}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-10 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
              <MessageCircle size={26} className="text-[var(--accent)]" />
            </span>
            <div>
              <p className="font-semibold text-[var(--text-main)]">No conversations yet</p>
              <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">Search for a username above to start a direct chat, or import a WhatsApp export.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => importInputRef.current?.click()} className="rounded-full border border-[var(--border-soft)] bg-[var(--panel)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                Import chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Layout
        sidebar={sidebar}
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        title="Home"
        showAdmin={isAdmin}
        rightAction={
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Create Group popover */}
            <div className="relative" ref={createGroupRef}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => { setCreateGroupOpen((v) => !v); setJoinGroupOpen(false); }}
                className="h-8 w-8 rounded-full md:h-9 md:w-9"
                aria-label="Create group"
                title="Create group"
              >
                <Users size={15} />
              </Button>
              {createGroupOpen && (
                <div className="absolute right-0 top-[calc(100%+0.55rem)] z-[500] w-[min(18rem,calc(100vw-1rem))] rounded-[1.35rem] border border-[var(--border-soft)] bg-[color:color-mix(in_srgb,var(--panel)_92%,transparent)] p-3 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest">Create Group</p>
                    <button type="button" onClick={() => setCreateGroupOpen(false)} className="rounded-full p-0.5 hover:bg-[var(--panel-soft)]"><X size={13} /></button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && groupName.trim().length >= 2) { handleCreateGroup(groupName); setGroupName(''); setCreateGroupOpen(false); } }}
                      placeholder="Group name"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-emerald-500/50"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading || groupName.trim().length < 2}
                      onClick={() => { handleCreateGroup(groupName); setGroupName(''); setCreateGroupOpen(false); }}
                      className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs"
                    >
                      <Plus size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Join Group popover */}
            <div className="relative" ref={joinGroupRef}>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => { setJoinGroupOpen((v) => !v); setCreateGroupOpen(false); }}
                className="h-8 w-8 rounded-full md:h-9 md:w-9"
                aria-label="Join group"
                title="Join group"
              >
                <UserPlus size={15} />
              </Button>
              {joinGroupOpen && (
                <div className="absolute right-0 top-[calc(100%+0.55rem)] z-[500] w-[min(18rem,calc(100vw-1rem))] rounded-[1.35rem] border border-[var(--border-soft)] bg-[color:color-mix(in_srgb,var(--panel)_92%,transparent)] p-3 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest">Join Group</p>
                    <button type="button" onClick={() => setJoinGroupOpen(false)} className="rounded-full p-0.5 hover:bg-[var(--panel-soft)]"><X size={13} /></button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={joinGroupId}
                      onChange={(e) => setJoinGroupId(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && joinGroupId.trim().length >= 8) { handleJoinGroup(joinGroupId); setJoinGroupId(''); setJoinGroupOpen(false); } }}
                      placeholder="Group ID or link"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] focus:border-emerald-500/50"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loading || joinGroupId.trim().length < 8}
                      onClick={() => { handleJoinGroup(joinGroupId); setJoinGroupId(''); setJoinGroupOpen(false); }}
                      className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs"
                    >
                      <Plus size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {isAdmin ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => navigate("/admin")}
                className="h-8 w-8 rounded-full md:h-9 md:w-9"
                aria-label="Open admin panel"
                title="Open admin panel"
              >
                <Shield size={15} />
              </Button>
            ) : null}
            <input
              ref={importInputRef}
              type="file"
              accept=".txt,.doc,.docx"
              className="hidden"
              onChange={(event) => handleImportedFileSelect(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="h-8 rounded-full px-2.5 md:h-9 md:px-3"
            >
              <Upload size={14} />
              <span className="hidden md:inline">{isImporting ? 'Importing...' : 'Import'}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 overflow-hidden rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              title="Open profile"
            >
              <img
                src={avatars[profile?.username || ''] || 'https://i.pravatar.cc/100?img=12'}
                alt={profile?.username || 'Profile'}
                className="h-full w-full object-cover"
              />
            </Button>
            <HelpModal
              isAdmin={isAdmin}
              triggerClassName="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
              triggerIconSize={15}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
              onClick={onLogout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={15} />
            </Button>
          </div>
        }
      >
        <div className="scroll-thin h-full overflow-y-auto overflow-x-hidden p-2.5 md:p-6">
          <div className="relative overflow-hidden rounded-[1.2rem] border border-[var(--border-soft)] bg-[linear-gradient(145deg,rgba(14,24,35,0.92),rgba(19,60,88,0.66))] p-3.5 text-white shadow-[0_24px_56px_rgba(2,6,23,0.3)] md:rounded-[1.9rem] md:p-7">
            <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-cyan-300/18 blur-3xl" />
            <div className="absolute -right-10 bottom-6 h-48 w-48 rounded-full bg-emerald-300/15 blur-3xl" />
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-100/85">Premium Workspace</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-4xl">Personalized chat hub for live and imported conversations.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-100/84">
                Use one combined chat list with smart labels. Imported chats are marked with a small tag so they stay easy to recognize.
              </p>
              <p className="mt-3 text-xs text-cyan-100/90">
                Quick import is available from the top bar.
                {importHint ? ` ${importHint}` : ''}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-200/35 bg-cyan-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]">Encrypted Storage</span>
                <span className="rounded-full border border-emerald-200/35 bg-emerald-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]">IndexedDB Sync</span>
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]">Scalable Architecture</span>
              </div>
            </div>
          </div>

          {error ? <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
        </div>
      </Layout>
    </>
  );
}

