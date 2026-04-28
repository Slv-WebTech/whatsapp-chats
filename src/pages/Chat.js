import { ArrowLeft, LogOut, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import LegacyChatApp from "../App";
import { Button } from "../components/ui/button";
import Layout from "./Layout";
import ChatListItem from "../components/ChatListItem";
import SearchBar from "../components/SearchBar";
import {
  createGroupChat,
  createOrGetDirectChat,
  fetchChatsByIds,
  getDirectChatSecret,
  getGroupChatSecret,
  joinGroupChatById,
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

function ChatEngine({ chat, chatSecret, profile, dispatch, onBackHome, onOpenSidebar }) {
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

  return <LegacyChatApp key={chat.id} onBackHome={onBackHome} onOpenSidebar={onOpenSidebar} initialChatTitle={chat?.displayTitle || chat?.name || ''} initialChatId={chat?.id || ''} initialChatType={chat?.type || ''} />;
}

function resolveTitle(chat, currentUserId) {
  if (!chat) {
    return "Chat";
  }

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

  if (raw.startsWith('U2FsdGVkX1')) {
    if (isLikelyGroupChat(chat) && chat?.id) {
      try {
        return decryptMessage(raw, getGroupChatSecret(chat.id));
      } catch {
        return 'Encrypted message';
      }
    }

    if (chat?.id) {
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

    let cancelled = false;
    let liveChatUnsubscribers = [];

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

      setChats(items.map((entry) => ({
        ...entry,
        displayTitle: resolveTitle(entry, authUser.uid),
        previewText: buildLastMessagePreview(entry)
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
              displayTitle: resolveTitle(nextChat, authUser.uid),
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
        hydrateChatList(nextChatIds).catch(() => {
          if (!cancelled) {
            setChats([]);
          }
        });
      },
      () => {
        if (!cancelled) {
          setChats([]);
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

    if (isLikelyGroupChat(chat)) {
      return getGroupChatSecret(chat.id);
    }

    return getDirectChatSecret(chat.id);
  }, [chat]);

  const handleCreateDirectChat = async (targetUser) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const nextChatId = await createOrGetDirectChat({ ...profile, uid: authUser.uid }, targetUser);
    navigate(`/chat/${encodeURIComponent(nextChatId)}`);
    setSidebarOpen(false);
  };

  const handleCreateGroup = async (groupName) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const result = await createGroupChat({ ...profile, uid: authUser.uid }, { name: groupName });
    navigate(`/chat/${encodeURIComponent(result.chatId)}`);
    setSidebarOpen(false);
  };

  const handleJoinGroup = async (groupId) => {
    if (!profile || !authUser?.uid) {
      return;
    }

    const result = await joinGroupChatById({ ...profile, uid: authUser.uid }, groupId);
    if (result?.status === 'pending') {
      setError('Join request submitted. Group owner/admin approval is required.');
      return;
    }
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
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
        loading={loading}
        showGroupActions={false}
      />

      {/* Chat List - Expandable */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-2">
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
      <div className="fixed bottom-0 left-0 z-50 w-[75vw] max-w-[380px] border-t border-[var(--border-soft)] bg-[var(--panel-strong)] p-3 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:bg-transparent lg:border-0 lg:mt-auto lg:px-0 lg:py-3">
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
        {loading || !chat || !chatSecret ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/40 px-6 py-5 text-sm text-slate-300 backdrop-blur-xl">
              {error || "Loading chat workspace..."}
            </div>
          </div>
        ) : (
          <ChatEngine chat={chat} chatSecret={chatSecret} profile={profile} dispatch={dispatch} onBackHome={() => navigate('/home')} onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </div>
    </Layout>
  );
}
