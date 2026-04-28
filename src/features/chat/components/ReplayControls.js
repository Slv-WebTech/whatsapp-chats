import { motion } from 'framer-motion';
import { CalendarRange, Gauge } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { safeParseDateParts, getValidZoomLevel, getValidSpeed, clampNumber, isMobileViewport } from '../../../utils/validators';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Safely extract and validate date parts
function extractDateParts(dateText) {
    return safeParseDateParts(dateText);
}

function compactMarkerLabel(dateText, includeYear) {
    const parsed = extractDateParts(dateText);

    // Fallback to original text if parsing fails
    if (!parsed) {
        const fallback = String(dateText || '').slice(0, 10);
        return fallback || 'Date';
    }

    const day = String(parsed.day).padStart(2, '0');
    const month = String(parsed.month).padStart(2, '0');
    const shortYear = String(parsed.year).slice(-2);
    return includeYear ? `${day}/${month}/${shortYear}` : `${day}/${month}`;
}

function getMonthKey(parts) {
    if (!parts || !parts.year || !parts.month) {
        return '';
    }
    return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function getMarkerLabel(marker, zoomLevel, includeYear = false) {
    if (!marker || !marker.parts) {
        return compactMarkerLabel(marker?.date || '', false);
    }

    if (zoomLevel === 'year') {
        return String(marker.parts.year || 'Year');
    }

    if (zoomLevel === 'month') {
        const monthIndex = Math.max(0, Math.min(11, marker.parts.month - 1));
        const month = MONTH_LABELS[monthIndex] || 'Mon';
        return includeYear ? `${month} ${marker.parts.year || ''}` : month;
    }

    return compactMarkerLabel(marker.date, includeYear);
}

function getMarkerAlignment(leftPercent) {
    const safePercent = clampNumber(leftPercent, 0, 100);
    if (safePercent <= 10) {
        return 'start';
    }

    if (safePercent >= 90) {
        return 'end';
    }

    return 'center';
}

function ReplayControls({
    hasMessages,
    progress,
    speed,
    scrubValue,
    scrubPreviewMessage,
    dateMarkers,
    totalMessages,
    showTimeline,
    onScrubPreview,
    onScrub,
    onSpeedChange
}) {
    // Safely clamp values
    const safeTotal = Math.max(0, Number(totalMessages) || 0);
    const sliderMax = Math.max(safeTotal - 1, 0);
    const safeProgress = clampNumber(progress, 0, sliderMax);

    const [isScrubbing, setIsScrubbing] = useState(false);
    const [localValue, setLocalValue] = useState(() => clampNumber(scrubValue, 0, sliderMax));
    const [zoomLevel, setZoomLevel] = useState(() => getValidZoomLevel('auto', 'auto'));
    const [yearChipsOnly, setYearChipsOnly] = useState(false);
    const [isMobileView, setIsMobileView] = useState(() => isMobileViewport(window?.innerWidth));
    const timelineRef = useRef(null);
    const [timelineWidth, setTimelineWidth] = useState(0);
    const safeSpeed = getValidSpeed(speed, 500);

    useEffect(() => {
        if (!isScrubbing) {
            const safeScrubValue = clampNumber(scrubValue, 0, sliderMax);
            setLocalValue(safeScrubValue);
        }
    }, [isScrubbing, scrubValue, sliderMax]);

    const activeValue = isScrubbing ? localValue : clampNumber(scrubValue, 0, sliderMax);
    const safePreviewPercent = clampNumber((activeValue / Math.max(sliderMax, 1)) * 100, 0, 100);
    const previewTransform = safePreviewPercent <= 8 ? 'translateX(0)' : safePreviewPercent >= 92 ? 'translateX(-100%)' : 'translateX(-50%)';
    const tooltipLabel = useMemo(() => {
        if (!scrubPreviewMessage) {
            return 'Start';
        }

        const date = scrubPreviewMessage.date || '';
        const time = scrubPreviewMessage.time || '';
        return `${date} ΓÇó ${time}`.replace(/\sΓÇó\s$/, '') || 'Message';
    }, [scrubPreviewMessage]);
    const speedOptions = useMemo(
        () => [
            { label: '0.5x', value: 1000 },
            { label: '1x', value: 500 },
            { label: '2x', value: 200 }
        ],
        []
    );

    const commitScrub = () => {
        setIsScrubbing(false);
        const safeScrubValue = clampNumber(localValue, 0, sliderMax);
        onScrub?.(safeScrubValue);
    };

    useEffect(() => {
        if (!timelineRef.current) {
            return;
        }

        try {
            const updateWidth = () => {
                const width = timelineRef.current?.clientWidth || 0;
                setTimelineWidth(Math.max(0, width));
            };

            updateWidth();

            const observer = new ResizeObserver(() => {
                try {
                    updateWidth();
                } catch (error) {
                    console.warn('ResizeObserver error:', error);
                }
            });

            observer.observe(timelineRef.current);

            return () => {
                try {
                    observer.disconnect();
                } catch (error) {
                    console.warn('Observer disconnect error:', error);
                }
            };
        } catch (error) {
            console.warn('Timeline width setup error:', error);
        }
    }, []);

    useEffect(() => {
        const onResize = () => {
            try {
                setIsMobileView(isMobileViewport(window?.innerWidth));
            } catch (error) {
                console.warn('Resize handler error:', error);
            }
        };

        window?.addEventListener?.('resize', onResize);
        return () => window?.removeEventListener?.('resize', onResize);
    }, []);

    const parsedDateMarkers = useMemo(
        () => {
            if (!Array.isArray(dateMarkers)) {
                return [];
            }

            return dateMarkers
                .map((marker, idx) => ({
                    ...marker,
                    index: Math.max(0, Number(marker.index) || idx),
                    parts: extractDateParts(marker.date)
                }))
                .filter((m) => m.parts !== null); // Filter out unparseable dates
        },
        [dateMarkers]
    );

    const adaptiveZoomLevel = useMemo(() => {
        if (!parsedDateMarkers || parsedDateMarkers.length === 0) {
            return 'day';
        }

        try {
            const years = new Set(
                parsedDateMarkers
                    .map((item) => item.parts?.year)
                    .filter((y) => y && Number.isInteger(y))
            );
            const months = new Set(
                parsedDateMarkers
                    .map((item) => (item.parts ? getMonthKey(item.parts) : null))
                    .filter(Boolean)
            );

            const yearCount = years.size;
            const monthCount = months.size;
            const messageCount = Math.max(0, safeTotal);
            const markerCount = parsedDateMarkers.length;

            if (yearCount >= 4 || messageCount >= 5000 || markerCount >= 800) {
                return 'year';
            }

            if (yearCount >= 2 || monthCount >= 18 || messageCount >= 1600 || markerCount >= 220) {
                return 'month';
            }

            return 'day';
        } catch (error) {
            console.warn('Adaptive zoom calculation error:', error);
            return 'day';
        }
    }, [parsedDateMarkers, safeTotal]);

    const effectiveZoom = yearChipsOnly ? 'year' : zoomLevel === 'auto' ? adaptiveZoomLevel : zoomLevel;

    const baseMarkers = useMemo(() => {
        if (!parsedDateMarkers || !Array.isArray(parsedDateMarkers) || parsedDateMarkers.length === 0) {
            return [];
        }

        try {
            if (effectiveZoom === 'day') {
                return parsedDateMarkers.map((marker, idx) => ({
                    key: `${marker.index}-${marker.date}`,
                    index: Math.max(0, marker.index),
                    date: marker.date || '',
                    parts: marker.parts,
                    isBoundary: idx === 0 || idx === parsedDateMarkers.length - 1,
                    yearChanged:
                        idx > 0 &&
                        marker.parts?.year &&
                        parsedDateMarkers[idx - 1]?.parts?.year &&
                        marker.parts.year !== parsedDateMarkers[idx - 1].parts.year
                }));
            }

            const grouped = new Map();
            parsedDateMarkers.forEach((marker) => {
                if (!marker.parts) {
                    return;
                }

                const groupKey = effectiveZoom === 'month' ? getMonthKey(marker.parts) : String(marker.parts.year);
                if (!groupKey || grouped.has(groupKey)) {
                    return;
                }

                grouped.set(groupKey, {
                    key: groupKey,
                    index: Math.max(0, marker.index),
                    date: marker.date || '',
                    parts: marker.parts
                });
            });

            const items = Array.from(grouped.values());
            return items.map((marker, idx) => ({
                ...marker,
                isBoundary: idx === 0 || idx === items.length - 1,
                yearChanged:
                    idx > 0 && marker.parts?.year && items[idx - 1]?.parts?.year && marker.parts.year !== items[idx - 1].parts.year
            }));
        } catch (error) {
            console.warn('Base markers calculation error:', error);
            return [];
        }
    }, [effectiveZoom, parsedDateMarkers]);

    const visibleMarkers = useMemo(() => {
        if (!baseMarkers || !Array.isArray(baseMarkers) || baseMarkers.length === 0) {
            return [];
        }

        try {
            const safeTimelineWidth = Math.max(280, timelineWidth);
            const safeSliderMax = Math.max(1, sliderMax); // Avoid division by zero
            const minDotGapPx =
                (effectiveZoom === 'year' ? 14 : effectiveZoom === 'month' ? 11 : 9) + (isMobileView ? 5 : 0);
            const minLabelGapPx =
                (effectiveZoom === 'year' ? 108 : effectiveZoom === 'month' ? 88 : 72) + (isMobileView ? 20 : 0);
            let lastDotPx = -Infinity;
            let lastLabelPx = -Infinity;

            return baseMarkers
                .map((marker, index) => {
                    const safeIndex = Math.max(0, marker.index);
                    const left = (safeIndex / safeSliderMax) * 100;
                    const leftPx = (left / 100) * safeTimelineWidth;
                    const isBoundary = marker.isBoundary;
                    const yearChanged = marker.yearChanged;

                    const canShowDot = isBoundary || leftPx - lastDotPx >= minDotGapPx;
                    if (!canShowDot) {
                        return null;
                    }

                    lastDotPx = leftPx;
                    const wantsLabel = isBoundary || yearChanged || effectiveZoom !== 'day';
                    const canShowLabel = wantsLabel || leftPx - lastLabelPx >= minLabelGapPx;
                    const showLabel = canShowLabel && (wantsLabel || index % 2 === 0 || yearChipsOnly);

                    if (showLabel) {
                        lastLabelPx = leftPx;
                    }

                    return {
                        key: marker.key || `${index}-${left}`,
                        left: clampNumber(left, 0, 100),
                        label: getMarkerLabel(marker, effectiveZoom, isBoundary || yearChanged),
                        showLabel,
                        zoom: effectiveZoom,
                        align: getMarkerAlignment(left)
                    };
                })
                .filter(Boolean);
        } catch (error) {
            console.warn('Visible markers calculation error:', error);
            return [];
        }
    }, [baseMarkers, sliderMax, timelineWidth, effectiveZoom, yearChipsOnly, isMobileView]);

    if (!showTimeline) {
        return null;
    }

    return (
        <motion.div layout className="replay-bar border-b border-white/10 px-2.5 py-1.5 md:px-3">
            <div className="replay-scrubber rounded-xl border border-[var(--border-soft)] bg-[var(--panel)] px-2.5 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    <span>Replay Timeline</span>
                    <span>{safeTotal > 0 ? `${Math.min(safeProgress + 1, safeTotal)}/${safeTotal}` : '0/0'}</span>
                </div>

                <div className="timeline-toolbar mb-1.5 hidden items-center justify-between gap-2 sm:flex">
                    <div className="timeline-zoom-group inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-soft)] p-0.5">
                        {[
                            { value: 'auto', label: 'Auto' },
                            { value: 'day', label: 'Day' },
                            { value: 'month', label: 'Month' },
                            { value: 'year', label: 'Year' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setZoomLevel(option.value)}
                                className={`timeline-zoom-button ${zoomLevel === option.value ? 'timeline-zoom-button--active' : ''}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="timeline-control-right inline-flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setYearChipsOnly((prev) => !prev)}
                            className={`timeline-chip-toggle ${yearChipsOnly ? 'timeline-chip-toggle--active' : ''}`}
                            title="Toggle year chips"
                            aria-label="Toggle year chips"
                        >
                            <CalendarRange size={12} />
                            <span>Year chips</span>
                        </button>

                        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-soft)] p-0.5">
                            <span className="timeline-speed-icon" title="Replay speed" aria-hidden="true">
                                <Gauge size={11} />
                            </span>
                            {speedOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onSpeedChange?.(option.value)}
                                    className={`timeline-speed-button ${safeSpeed === option.value ? 'timeline-speed-button--active' : ''}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="timeline-mobile-controls mb-1.5 flex items-center gap-1.5 sm:hidden">
                    <select
                        value={zoomLevel}
                        onChange={(event) => setZoomLevel(event.target.value)}
                        className="timeline-select"
                        aria-label="Timeline zoom level"
                    >
                        <option value="auto">Auto</option>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                        <option value="year">Year</option>
                    </select>

                    <select
                        value={String(safeSpeed)}
                        onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            if (speedOptions.some((opt) => opt.value === nextValue)) {
                                onSpeedChange?.(nextValue);
                            }
                        }}
                        className="timeline-select"
                        aria-label="Replay speed"
                    >
                        {speedOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setYearChipsOnly((prev) => !prev)}
                        className={`timeline-chip-toggle ${yearChipsOnly ? 'timeline-chip-toggle--active' : ''}`}
                        title="Toggle year chips"
                        aria-label="Toggle year chips"
                    >
                        <CalendarRange size={11} />
                        <span>Year</span>
                    </button>
                </div>

                <div className="timeline-shell" ref={timelineRef}>
                    <div className="timeline-preview" style={{ left: `${safePreviewPercent}%`, transform: previewTransform }}>
                        <span className="timeline-preview__label">{tooltipLabel}</span>
                        {scrubPreviewMessage && !isMobileView ? (
                            <span className="timeline-preview__meta">
                                {scrubPreviewMessage.sender || 'System'}
                            </span>
                        ) : null}
                    </div>

                    <div className="timeline-marker-row">
                        {visibleMarkers.map((marker) => {
                            return (
                                <div key={marker.key} className={`timeline-marker timeline-marker--${marker.align}`} style={{ left: `${marker.left}%` }}>
                                    {marker.showLabel ? (
                                        <span className={`timeline-marker__label ${marker.zoom === 'year' ? 'timeline-marker__label--year' : ''}`}>
                                            {marker.label}
                                        </span>
                                    ) : null}
                                    <span className="timeline-marker__dot" />
                                </div>
                            );
                        })}
                    </div>

                    <input
                        type="range"
                        min="0"
                        max={sliderMax}
                        step="1"
                        value={Math.min(activeValue, sliderMax)}
                        onMouseDown={() => setIsScrubbing(true)}
                        onTouchStart={() => setIsScrubbing(true)}
                        onChange={(event) => {
                            try {
                                const nextValue = clampNumber(Number(event.target.value), 0, sliderMax);
                                setLocalValue(nextValue);
                                onScrubPreview?.(nextValue);
                            } catch (error) {
                                console.warn('Scrub change error:', error);
                            }
                        }}
                        onMouseUp={commitScrub}
                        onTouchEnd={commitScrub}
                        onKeyUp={commitScrub}
                        onBlur={() => {
                            if (isScrubbing) {
                                commitScrub();
                            }
                        }}
                        disabled={!hasMessages || sliderMax === 0}
                        className="timeline-slider"
                        style={{ '--timeline-progress': `${safePreviewPercent}%` }}
                        aria-label="Replay timeline scrubber"
                    />
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                    <span className="hidden sm:inline">Click bubble to replay from there.</span>
                    <span className="sm:hidden">Tap bubble to replay.</span>
                    <span className="hidden md:inline">Hotkeys: Space, R, 1 2 3</span>
                </div>
            </div>
        </motion.div>
    );
}

export default ReplayControls;
