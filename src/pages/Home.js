import { LogOut, Shield, Upload, UserCircle2 } from "lucide-react";
import HelpModal from "../components/HelpModal";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ChatListItem from "../components/ChatListItem";
import SearchBar from "../components/SearchBar";
import PremiumUsernameTag from "../components/PremiumUsernameTag";
import { Button } from "../components/ui/button";
import Layout from "./Layout";
import { createOrGetDirectChat, fetchChatsByIds, getDirectChatSecret, joinGroupChatBySecret, searchUsersByUsername, subscribeUserChats } from "../firebase/socialService";
import { parseWhatsAppFileInChunks } from "../utils/parser";
import { listImportedChats, saveImportedChat } from "../utils/importedChatStore";
import { selectAuthProfile, selectAuthUser, selectIsAdmin } from "../store/authSlice";
import { selectAvatarPreferences } from "../store/appSessionSlice";
import { decryptMessage } from "../utils/encryption";
import { setActiveChatRouteId } from "../utils/chatRouteState";

function buildDisplayTitle(chat, currentUserId) {
  if (chat.type === "group") {
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
  const raw = String(chat?.lastMessageText || '').trim();
  if (!raw) {
    return 'No messages yet';
  }

  if (raw.startsWith('U2FsdGVkX1')) {
    if (chat?.type === '1:1') {
      try {
        return decryptMessage(raw, getDirectChatSecret(chat.id));
      } catch {
        return 'Encrypted message';
      }
    }

    return 'Encrypted message';
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
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!authUser?.uid) {
      return undefined;
    }

    return subscribeUserChats(
      authUser.uid,
      async (nextChatIds) => {
        const items = await fetchChatsByIds(nextChatIds);
        setChats(items.map((chat) => ({
          ...chat,
          displayTitle: buildDisplayTitle(chat, authUser.uid),
          previewText: buildLastMessagePreview(chat)
        })));
      },
      () => {
        setError("Unable to load your chat list.");
      },
    );
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
    const regular = chats.map((entry) => ({ ...entry, isImported: false, type: entry.type || '1:1' }));
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

  const handleJoinGroup = async (secret) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await joinGroupChatBySecret({ ...profile, uid: authUser.uid }, secret);
      setActiveChatRouteId(result.chatId);
      navigate('/chat');
    } catch (joinError) {
      setError(joinError?.message || "Unable to join group.");
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
        onJoinGroup={handleJoinGroup}
        loading={loading}
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
          <div className="rounded-[1.1rem] border border-dashed border-[var(--border-soft)] bg-[var(--panel-soft)] p-3 text-xs text-[var(--text-muted)]">
            No chats yet. Start a chat or import one.
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

