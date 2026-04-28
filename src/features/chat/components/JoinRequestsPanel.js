import { Check, UserRoundPlus, X } from 'lucide-react';
import { Button } from '../../../shared/components/UI/button';

function requestId(request) {
    return request?.id || request?.uid || request?.userId || request?.email || request?.username || '';
}

function requestLabel(request) {
    return request?.displayName || request?.name || request?.username || request?.email || 'Unknown user';
}

export default function JoinRequestsPanel({ requests = [], onApprove, onReject, onClose }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] md:items-center">
            <div className="glass-panel-strong w-full max-w-xl rounded-[1.3rem] border border-white/20 p-4 shadow-2xl md:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--text-main)]">
                            <UserRoundPlus size={18} />
                            Join Requests
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">Review and manage pending requests to join the group.</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                        <X size={16} />
                    </Button>
                </div>

                <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                    {requests.length ? requests.map((request) => {
                        const id = requestId(request);
                        return (
                            <div key={id || requestLabel(request)} className="flex flex-col gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-[var(--text-main)]">{requestLabel(request)}</p>
                                    {request?.message ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{request.message}</p> : null}
                                </div>
                                <div className="flex gap-2 sm:justify-end">
                                    <Button type="button" size="sm" onClick={() => onApprove?.(request)}>
                                        <Check size={14} className="mr-1" />
                                        Approve
                                    </Button>
                                    <Button type="button" size="sm" variant="secondary" onClick={() => onReject?.(request)}>
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-3 text-sm text-[var(--text-muted)]">
                            No pending requests.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
