import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { MessageCircle, Users, TrendingUp, Clock, Zap, MessageSquare, Smile } from 'lucide-react';
import { useChatAnalysis } from '../hooks/useChatAnalysis';

const COLORS = ['#8f6677', '#5b6778', '#2f6f8d', '#78bad9', '#8f6677', '#5b6778', '#2f6f8d'];

function StatCard(props) {
    const { icon: Icon, label, value, unit, color } = props;
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-4 space-y-2"
        >
            <div className="flex items-center justify-between">
                <span className={color || 'text-slate-600'}>
                    <Icon size={20} />
                </span>
                <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {value}
                {unit && <span className="text-sm ml-1 font-normal text-slate-500">{unit}</span>}
            </div>
        </motion.div>
    );
}

export function ChatInsights(props) {
    const { messages } = props;
    const messageArray = messages || [];
    const analysis = useChatAnalysis(messageArray);

    if (messageArray.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-slate-500">Import a chat to view insights</p>
            </div>
        );
    }

    const userDataForChart = Object.entries(analysis.messagesByUser || {})
        .map(entry => ({
            name: entry[0],
            messages: entry[1]
        }))
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 10);

    const dayDataForChart = Object.entries(analysis.messagesPerDay || {})
        .slice(-30)
        .map(entry => ({
            date: entry[0].slice(0, 5),
            messages: entry[1]
        }));

    const hourDataForChart = Object.entries(analysis.hourlyDistribution || {})
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(entry => ({
            hour: `${entry[0]}:00`,
            messages: entry[1]
        }));

    const emojiDataForChart = Object.entries(analysis.emojiUsage || {})
        .map(entry => ({
            emoji: entry[0],
            count: entry[1]
        }))
        .slice(0, 8);

    const userDistributionForPie = Object.entries(analysis.messagesByUser || {})
        .slice(0, 5)
        .map(entry => ({
            name: entry[0],
            value: entry[1]
        }));

    return (
        <div className="space-y-6 p-6 pb-20">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Chat Insights</h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Analyze {analysis.totalMessages} messages across {analysis.uniqueUsers} participants
                </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={MessageCircle} label="Total Messages" value={analysis.totalMessages.toLocaleString()} color="text-blue-600" />
                <StatCard icon={Users} label="Participants" value={analysis.uniqueUsers} color="text-purple-600" />
                <StatCard
                    icon={TrendingUp}
                    label="Most Active"
                    value={analysis.mostActiveUser ? analysis.mostActiveUser.split(' ')[0] : 'N/A'}
                    color="text-green-600"
                />
                <StatCard icon={Clock} label="Avg Reply Time" value={analysis.averageReplyTime} unit="min" color="text-orange-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Messages per User</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={userDataForChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px' }} cursor={{ fill: 'rgba(91, 103, 120, 0.1)' }} />
                            <Bar dataKey="messages" fill="#5b6778" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Activity Trend (Last 30 Days)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dayDataForChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px' }} />
                            <Line type="monotone" dataKey="messages" stroke="#2f6f8d" dot={false} strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Peak Activity Hours</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={hourDataForChart}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px' }} />
                            <Bar dataKey="messages" fill="#78bad9" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Message Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={userDistributionForPie}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={entry => `${entry.name.split(' ')[0]}: ${(entry.value / (analysis.totalMessages || 1) * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#5b6778"
                                dataKey="value"
                            >
                                {userDistributionForPie.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Smile className="text-yellow-600" size={20} />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Emoji Usage</h2>
                    </div>
                    <div className="space-y-2">
                        {emojiDataForChart.length > 0 ? (
                            emojiDataForChart.map((item, idx) => {
                                const maxCount = Math.max(...emojiDataForChart.map(e => e.count));
                                return (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                        <span className="text-2xl">{item.emoji}</span>
                                        <div className="flex-1 mx-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                                                style={{ width: `${(item.count / maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-[2rem] text-right">{item.count}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-slate-500">No emojis detected</p>
                        )}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="text-blue-600" size={20} />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Longest Message</h2>
                    </div>
                    {analysis.longestMessage ? (
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-slate-500">From: {analysis.longestMessage.sender}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {analysis.longestMessage.date} · {analysis.longestMessage.time}
                                </p>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{analysis.longestMessage.text}</p>
                            <div className="text-xs text-slate-500">Length: {analysis.longestMessage.length} characters</div>
                        </div>
                    ) : (
                        <p className="text-slate-500">No messages found</p>
                    )}
                </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-orange-400/20 to-red-400/20">
                        <Zap className="text-orange-600" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Peak Activity Time</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Most messages sent around <span className="font-bold">{analysis.peakHour}:00</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default ChatInsights;
