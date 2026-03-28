import { useMemo } from 'react';

export function useChatAnalysis(messages = []) {
    return useMemo(() => {
        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                totalMessages: 0,
                uniqueUsers: 0,
                messagesByUser: {},
                messagesPerDay: {},
                hourlyDistribution: {},
                emojiUsage: {},
                averageReplyTime: 0,
                longestMessage: null,
                mostActiveUser: null,
                peakHour: null,
                wordCloud: {}
            };
        }

        const messagesByUser = {};
        const messagesPerDay = {};
        const hourlyDistribution = {};
        const emojiUsage = {};
        const wordFrequency = {};
        let longestMessage = null;
        let longestLength = 0;
        let totalReplyTimes = [];
        let prevTime = null;

        // Regex for emoji detection
        const emojiRegex =
            /(\u00d7\u0253|\u00d7\u025b|\u00d7\u025a|[\u2600-\u27BF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u200D\u203C\u2049\u20E3]|[\u2139\u2194-\u2199\u21A9-\u21AA])/g;

        messages.forEach((msg, idx) => {
            if (!msg || msg.isSystem) return;

            const sender = msg.sender || 'Unknown';
            const date = msg.date || '';
            const time = msg.time || '';
            const messageText = msg.message || '';

            // Count messages by user
            messagesByUser[sender] = (messagesByUser[sender] || 0) + 1;

            // Count messages per day
            if (date) {
                messagesPerDay[date] = (messagesPerDay[date] || 0) + 1;
            }

            // Extract hour from time (e.g., "14:30" -> "14")
            if (time) {
                const hour = time.split(':')[0];
                hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
            }

            // Emoji usage
            const emojis = messageText.match(emojiRegex) || [];
            emojis.forEach((emoji) => {
                emojiUsage[emoji] = (emojiUsage[emoji] || 0) + 1;
            });

            // Longest message
            if (messageText.length > longestLength) {
                longestLength = messageText.length;
                longestMessage = {
                    sender,
                    text: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
                    fullText: messageText,
                    length: messageText.length,
                    date,
                    time
                };
            }

            // Word frequency (for potential word cloud)
            const words = messageText.toLowerCase().match(/\b\w+\b/g) || [];
            words.forEach((word) => {
                if (word.length > 3) {
                    // Only count words longer than 3 chars
                    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
                }
            });

            // Calculate average reply time
            if (prevTime && idx > 0 && messages[idx - 1].sender !== sender) {
                const prevMsg = messages[idx - 1];
                const timeDiff = calculateTimeDifference(prevMsg.time, time, prevMsg.date, date);
                if (timeDiff > 0 && timeDiff < 1440) {
                    // Only count if less than 24 hours
                    totalReplyTimes.push(timeDiff);
                }
            }
            prevTime = time;
        });

        // Calculate metrics
        const totalMessages = messages.filter((m) => !m.isSystem).length;
        const uniqueUsers = Object.keys(messagesByUser).length;
        const mostActiveUser = Object.entries(messagesByUser).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const peakHour = Object.entries(hourlyDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const averageReplyTime = totalReplyTimes.length > 0 ? Math.round(totalReplyTimes.reduce((a, b) => a + b, 0) / totalReplyTimes.length) : 0;

        // Sort emoji usage
        const sortedEmojis = Object.entries(emojiUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .reduce((acc, [emoji, count]) => {
                acc[emoji] = count;
                return acc;
            }, {});

        return {
            totalMessages,
            uniqueUsers,
            messagesByUser,
            messagesPerDay,
            hourlyDistribution,
            emojiUsage: sortedEmojis,
            averageReplyTime,
            longestMessage,
            mostActiveUser,
            peakHour,
            wordCloud: wordFrequency
        };
    }, [messages]);
}

function calculateTimeDifference(time1, time2, date1, date2) {
    try {
        const parse = (timeStr) => {
            const parts = timeStr.match(/(\d+):(\d+)/);
            if (!parts) return null;
            return parseInt(parts[1]) * 60 + parseInt(parts[2]);
        };

        const min1 = parse(time1);
        const min2 = parse(time2);

        if (min1 === null || min2 === null) return -1;

        // If same day, simple difference
        if (date1 === date2) {
            return min2 - min1;
        }

        // Different days - estimate 12 hour difference (conservative)
        return (24 - (min1 / 60)) * 60 + min2;
    } catch (error) {
        return -1;
    }
}
