import { ArrowLeft, LogOut, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import LegacyChatApp from "../App";
import { Button } from "../components/ui/button";
import Layout from "./Layout";
import ChatListItem from "../components/ChatListItem";
import SearchBar from "../components/SearchBar";
import {
  createOrGetDirectChat,
  fetchChatsByIds,
  getDirectChatSecret,
  joinGroupChatBySecret,
  searchUsersByUsername,
  subscribeChat,
  subscribeUserChats,
  updateChatReadState,
} from "../firebase/socialService";
import { listImportedChats } from "../utils/importedChatStore";
import { selectAuthProfile, selectAuthUser, selectIsAdmin } from "../store/authSlice";
import { setAuthSession, setCurrentUser, setLastRoomId } from "../store/appSessionSlice";
import { decryptMessage } from "../utils/encryption";
import { setActiveChatRouteId } from "../utils/chatRouteState";

function ChatEngine({ chat, chatSecret, profile, dispatch, onBackHome }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const username = profile?.username || "user";
    dispatch(setCurrentUser(username));
    dispatch(setLastRoomId(chat.id));
    dispatch(setAuthSession({ displayName: username, secret: chatSecret }));
    setReady(true);
  }, [profile?.username, chat?.id, chatSecret, dispatch]);

  if (!ready) {
    return null;
  }

  return <LegacyChatApp key={chat.id} onBackHome={onBackHome} initialChatTitle={chat?.displayTitle || chat?.name || ''} initialChatId={chat?.id || ''} />;
}

function resolveTitle(chat, currentUserId) {
  if (!chat) {
    return "Chat";
  }

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

export default function ChatPage({ chatId, navigate, onLogout }) {
  const dispatch = useDispatch();
  const authUser = useSelector(selectAuthUser);
  const profile = useSelector(selectAuthProfile);
  const isAdmin = useSelector(selectIsAdmin);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chat, setChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [importedChats, setImportedChats] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [groupSecrets, setGroupSecrets] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (chatId) {
      return;
    }

    navigate('/home', { replace: true });
  }, [chatId, navigate]);

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

  useEffect(() => {
    if (!authUser?.uid) {
      return undefined;
    }

    return subscribeUserChats(authUser.uid, async (nextChatIds) => {
      const items = await fetchChatsByIds(nextChatIds);
      setChats(items.map((entry) => ({
        ...entry,
        displayTitle: resolveTitle(entry, authUser.uid),
        previewText: buildLastMessagePreview(entry)
      })));
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
    if (!authUser?.uid || !chatId) {
      return undefined;
    }

    setLoading(true);
    return subscribeChat(
      chatId,
      (nextChat) => {
        if (!nextChat) {
          setError("Chat not found.");
          setLoading(false);
          return;
        }

        if (!Array.isArray(nextChat.members) || !nextChat.members.includes(authUser.uid)) {
          setError("You do not have access to this chat.");
          setLoading(false);
          navigate("/home", { replace: true });
          return;
        }

        setChat({ ...nextChat, displayTitle: resolveTitle(nextChat, authUser.uid) });
        setError("");
        setLoading(false);
        updateChatReadState(chatId, authUser.uid);
      },
      () => {
        setError("Unable to load chat.");
        setLoading(false);
      },
    );
  }, [authUser?.uid, chatId, navigate]);

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

  const chatSecret = useMemo(() => {
    if (!chat) {
      return "";
    }

    if (chat.type === "group") {
      return groupSecrets[chat.id] || "";
    }

    return getDirectChatSecret(chat.id);
  }, [chat, groupSecrets]);

  const handleCreateDirectChat = async (targetUser) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const nextChatId = await createOrGetDirectChat({ ...profile, uid: authUser.uid }, targetUser);
    navigate(`/chat/${encodeURIComponent(nextChatId)}`);
    setSidebarOpen(false);
  };

  const handleJoinGroup = async (secret) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const result = await joinGroupChatBySecret({ ...profile, uid: authUser.uid }, secret);
    setGroupSecrets((prev) => ({ ...prev, [result.chatId]: result.secret }));
    navigate(`/chat/${encodeURIComponent(result.chatId)}`);
    setSidebarOpen(false);
  };

  const sidebar = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
      <div className="flex items-center justify-start">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="h-8 w-8 rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)]"
          aria-label="Go to home"
          title="Home"
        >
          <ArrowLeft size={15} />
        </Button>
      </div>

      {/* Search Bar */}
      <SearchBar
        userQuery={userQuery}
        onUserQueryChange={setUserQuery}
        userResults={searchResults}
        onCreateDirectChat={handleCreateDirectChat}
        onJoinGroup={handleJoinGroup}
        loading={loading}
      />

      {/* Chat List - Expandable */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {mergedChats.length > 0 ? (
          mergedChats.map((entry) => (
            <ChatListItem
              key={entry.id}
              chat={entry}
              currentUserId={authUser?.uid}
              isActive={!entry.isImported && entry.id === chatId}
              onSelect={() => {
                if (entry.isImported) {
                  navigate(`/imported/${encodeURIComponent(entry.id)}`);
                  setSidebarOpen(false);
                  return;
                }

                navigate(`/chat/${encodeURIComponent(entry.id)}`);
                setSidebarOpen(false);
              }}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">
            No chats yet. Create one using search above.
          </div>
        )}
      </div>

      {/* Admin & Logout at Bottom */}
      <div className="space-y-2 border-t border-[var(--border-soft)] pt-2.5">
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => navigate("/admin")}
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
      title={chat?.displayTitle || "Chat"}
      showAdmin={false}
      rightAction={null}
      hideHeader
    >
      <div className="relative h-full">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/home")}
          className="fixed left-2 top-[4.4rem] z-[70] h-9 w-9 rounded-full border border-white/25 bg-slate-950/60 text-white shadow-lg backdrop-blur md:hidden"
          aria-label="Back to home"
          title="Back to home"
        >
          <ArrowLeft size={16} />
        </Button>

        {loading || !chat || !chatSecret ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 px-6 py-5 text-sm text-slate-300 backdrop-blur-xl">
              {error || "Loading chat workspace..."}
            </div>
          </div>
        ) : (
          <ChatEngine chat={chat} chatSecret={chatSecret} profile={profile} dispatch={dispatch} onBackHome={() => navigate('/home')} />
        )}
      </div>
    </Layout>
  );
}
