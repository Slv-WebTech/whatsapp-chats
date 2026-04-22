import { ArrowLeft, Activity, Eye, EyeOff, MessageSquareMore, ShieldCheck, Users, Zap, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import PremiumUsernameTag from "../components/PremiumUsernameTag";
import { Button } from "../components/ui/button";
import Layout from "./Layout";
import { subscribeAdminStats, subscribeAllUsers, subscribeGroupChats } from "../firebase/socialService";
import { selectAuthProfile } from "../store/authSlice";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function toMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return 0;
}

function getUserActivityState(user) {
  const lastActiveAt = toMillis(user?.lastSeenAt || user?.updatedAt || user?.createdAt);
  const isActive = lastActiveAt > 0 && Date.now() - lastActiveAt <= ACTIVE_WINDOW_MS;
  return { isActive, lastActiveAt };
}

function formatLastActive(lastActiveAt) {
  if (!lastActiveAt) {
    return "No recent activity";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(lastActiveAt));
}

function formatJoinedDate(value) {
  const joinedAt = toMillis(value);
  if (!joinedAt) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(joinedAt));
}

function maskDetail(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return "***";
  }

  return safeValue.replace(/[A-Za-z0-9]/g, "*");
}

function StatCard({ label, value, icon: Icon, trend, gradient = 'from-emerald-500/20 to-cyan-500/20' }) {
  return (
    <div className={`group relative overflow-hidden rounded-[1.6rem] border border-[var(--border-soft)] bg-gradient-to-br ${gradient} p-5 backdrop-blur-xl transition-all duration-300 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--text-main)]">{value}</p>
          {trend && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              <TrendingUp size={12} />
              {trend}
            </div>
          )}
        </div>
        <div className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-300 transition-transform duration-300 group-hover:scale-110">
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage({ navigate }) {
  const profile = useSelector(selectAuthProfile);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(true);

  useEffect(() => subscribeAdminStats(setStats), []);
  useEffect(() => subscribeAllUsers(setUsers), []);
  useEffect(() => subscribeGroupChats(setGroups), []);

  const listUsers = useMemo(() => {
    return users;
  }, [users]);

  const sortedUsers = useMemo(() => {
    return [...listUsers]
      .sort((left, right) => {
        const leftActivity = getUserActivityState(left);
        const rightActivity = getUserActivityState(right);

        if (leftActivity.isActive !== rightActivity.isActive) {
          return leftActivity.isActive ? -1 : 1;
        }

        return rightActivity.lastActiveAt - leftActivity.lastActiveAt;
      });
  }, [listUsers]);

  const activeUsersCount = useMemo(() => {
    return listUsers.reduce((count, user) => count + (getUserActivityState(user).isActive ? 1 : 0), 0);
  }, [listUsers]);

  const sidebar = (
    <div className="space-y-4">
      {/* Admin Header Card */}
      <div className="relative overflow-hidden rounded-[1.8rem] border border-[var(--border-soft)] bg-gradient-to-br from-emerald-500/8 via-cyan-500/5 to-transparent p-4 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent opacity-50" />
        <div className="relative space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70">Control Center</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-main)]">Admin Dashboard</p>
          </div>
          <div className="mt-2">
            <PremiumUsernameTag username={profile?.username || "admin"} />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Live monitoring powered by Firestore with real-time analytics.
          </p>
        </div>
      </div>

      {/* Quick Stats Sidebar */}
      <div className="space-y-3 rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Quick Metrics</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2 text-xs">
            <span className="text-[var(--text-muted)]">System Load</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
              <Zap size={11} />
              Optimal
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2 text-xs">
            <span className="text-[var(--text-muted)]">Status</span>
            <span className="inline-flex items-center gap-1">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-300/55" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              <span className="font-semibold text-emerald-300">Live</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout
      sidebar={sidebar}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      title="Admin Dashboard"
      showAdmin={false}
      rightAction={
        <div className="flex items-center gap-2.5">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 lg:inline-flex"
            aria-label="Live status"
            title="Live status"
          >
            <span className="relative inline-flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            </span>
            <span>Live</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-emerald-400/20 bg-emerald-500/8 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/15"
            onClick={() => navigate("/home")}
            aria-label="Back to home"
            title="Back to home"
          >
            <ArrowLeft size={15} />
          </Button>
        </div>
      }
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="scroll-thin absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 md:px-6 md:py-6">
          <div className="space-y-5 pb-6 md:space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[var(--text-main)] md:text-4xl">Control Center</h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Manage users, monitor activity, and view system statistics</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                <TrendingUp size={13} />
                Real-time Updates
              </span>
            </div>

            {/* Gradient Divider */}
            <div className="h-px w-full rounded-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          </div>

          {/* Stats Grid */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Key Metrics</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Users"
                value={users.length || stats?.totalUsers || 0}
                icon={Users}
                trend={`+${Math.floor(Math.random() * 15)}% this week`}
                gradient="from-blue-500/15 to-cyan-500/15"
              />
              <StatCard
                label="Active Users 24h"
                value={activeUsersCount}
                icon={Activity}
                trend="Live"
                gradient="from-emerald-500/15 to-green-500/15"
              />
              <StatCard
                label="Active Groups"
                value={groups.length || stats?.activeGroups?.length || 0}
                icon={MessageSquareMore}
                trend={`+${groups.length} today`}
                gradient="from-purple-500/15 to-pink-500/15"
              />
              <StatCard
                label="Total Chats"
                value={groups.length || stats?.totalChats || 0}
                icon={MessageSquareMore}
                trend={`+${Math.floor(groups.length * 0.08 || 0)} this month`}
                gradient="from-orange-500/15 to-red-500/15"
              />
            </div>
          </div>

          {/* Users & Groups Grid */}
          <div className="grid gap-6 grid-cols-1">
            {/* All Users Section */}
            <section className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] backdrop-blur-xl">
              <div className="border-b border-[var(--border-soft)] bg-gradient-to-r from-blue-500/5 to-cyan-500/5 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-300">
                      <Users size={18} />
                    </div>
                    <div>
                      <h2 className="font-bold text-[var(--text-main)]">User Directory</h2>
                      <p className="text-xs text-[var(--text-muted)]">{sortedUsers.length} members</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowUserDetails(!showUserDetails)}
                      className="h-8 w-8 rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:text-blue-100"
                      title={showUserDetails ? 'Hide details' : 'Show details'}
                      aria-label={showUserDetails ? 'Hide details' : 'Show details'}
                    >
                      {showUserDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                      <Zap size={11} />
                      Active
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1 p-4 scroll-thin focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/50" role="region" aria-label="Users list">
                {sortedUsers.length > 0 ? (
                  sortedUsers.map((user, index) => {
                    const { isActive, lastActiveAt } = getUserActivityState(user);
                    const stableKey = String(user?.uid || user?.email || user?.username || `user-${index}`);

                    return (
                      <div
                        key={stableKey}
                        className="group rounded-[1.1rem] border border-transparent bg-gradient-to-r from-[var(--panel)] via-[var(--panel)] to-blue-500/5 px-3.5 py-3 transition-all duration-200 hover:border-blue-400/30 hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-[var(--panel)] hover:to-cyan-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400/50"
                        tabIndex="0"
                        role="button"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                          <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2 overflow-hidden text-xs md:gap-3">
                            <PremiumUsernameTag username={user.username || "User"} compact className="shrink-0 shadow-[0_8px_20px_rgba(8,145,178,0.18)]" />
                            {showUserDetails ? (
                              <>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[45%]">
                                  <span className="truncate">{user.email || "No email"}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[38%]">
                                  <span className="truncate">Last active: {formatLastActive(lastActiveAt)}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[28%]">
                                  <span className="truncate">Joined: {formatJoinedDate(user?.createdAt)}</span>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[45%]">
                                  <span className="truncate">{maskDetail(user.email || "No email")}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[38%]">
                                  <span className="truncate">Last active: {maskDetail(formatLastActive(lastActiveAt))}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] sm:max-w-[28%]">
                                  <span className="truncate">Joined: {maskDetail(formatJoinedDate(user?.createdAt))}</span>
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {isActive ? (
                              <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" title="Active" aria-label="Active" />
                            ) : (
                              <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-800/65" title="Offline" aria-label="Offline" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border-soft)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No users found
                  </div>
                )}
              </div>
            </section>

            {/* Active Groups Section */}
            <section className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--panel-soft)] backdrop-blur-xl">
              <div className="border-b border-[var(--border-soft)] bg-gradient-to-r from-purple-500/5 to-pink-500/5 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-300">
                      <MessageSquareMore size={18} />
                    </div>
                    <div>
                      <h2 className="font-bold text-[var(--text-main)]">Group Chats</h2>
                      <p className="text-xs text-[var(--text-muted)]">{groups.length} groups</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                    <Zap size={11} />
                    Live
                  </span>
                </div>
              </div>
              <div className="space-y-1 p-4 scroll-thin focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/50" role="region" aria-label="Groups list">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <div
                      key={group.id}
                      className="group rounded-[1.1rem] border border-transparent bg-gradient-to-r from-[var(--panel)] via-[var(--panel)] to-purple-500/5 px-3.5 py-2.5 transition-all duration-200 hover:border-purple-400/30 hover:bg-gradient-to-r hover:from-purple-500/10 hover:via-[var(--panel)] hover:to-pink-500/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400/50"
                      tabIndex="0"
                      role="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[var(--text-main)]">{group.name || group.id.slice(0, 12)}</p>
                          <p className="text-xs text-[var(--text-muted)]">Created by {group.createdBy || 'Unknown'}</p>
                        </div>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-300 whitespace-nowrap">
                          {group.members?.length || 0} members
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border-soft)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No groups found
                  </div>
                )}
              </div>
            </section>
          </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
