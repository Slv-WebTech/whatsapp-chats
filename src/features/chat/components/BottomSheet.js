import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function BottomSheet({ open, onOpenChange, title, children, className }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
                <Dialog.Content
                    className={cn(
                        'chat-menu-surface fixed inset-x-0 bottom-0 z-50 max-h-[82vh] rounded-t-[1.6rem] border p-4 shadow-2xl backdrop-blur-2xl',
                        className
                    )}
                >
                    <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/30" />
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <Dialog.Title className="text-base font-semibold text-[var(--text-main)]">{title || 'Menu'}</Dialog.Title>
                        <Dialog.Close className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-soft)] text-[var(--text-muted)] transition hover:bg-[var(--panel-soft)]">
                            <X size={14} />
                        </Dialog.Close>
                    </div>
                    <div className="scroll-thin overflow-y-auto pb-2">{children}</div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}