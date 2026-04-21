import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

function Sheet({ children, ...props }) {
    return <Dialog.Root {...props}>{children}</Dialog.Root>;
}

function SheetTrigger(props) {
    return <Dialog.Trigger {...props} />;
}

function SheetClose(props) {
    return <Dialog.Close {...props} />;
}

function SheetPortal(props) {
    return <Dialog.Portal {...props} />;
}

function SheetOverlay({ className, ...props }) {
    return (
        <Dialog.Overlay
            className={cn('fixed inset-0 z-40 bg-black/45 backdrop-blur-sm', className)}
            {...props}
        />
    );
}

function SheetContent({ side = 'right', className, children, ...props }) {
    const sideClass = side === 'right' ? 'right-0 top-0 h-[100dvh] w-full max-w-[430px]' : 'left-0 top-0 h-[100dvh] w-full max-w-[430px]';

    return (
        <SheetPortal>
            <SheetOverlay />
            <Dialog.Content
                className={cn(
                    `fixed z-50 ${sideClass} overflow-y-auto border-l border-[var(--border-soft)] bg-[var(--panel-strong)] p-5 shadow-2xl backdrop-blur-2xl`,
                    className
                )}
                {...props}
            >
                {children}
                <Dialog.Close className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-soft)] text-[var(--text-muted)] transition hover:bg-[var(--panel-soft)]">
                    <X size={14} />
                </Dialog.Close>
            </Dialog.Content>
        </SheetPortal>
    );
}

function SheetHeader({ className, ...props }) {
    return <div className={cn('mb-4 pr-10', className)} {...props} />;
}

function SheetTitle({ className, ...props }) {
    return <Dialog.Title className={cn('text-xl font-semibold tracking-tight text-[var(--text-main)]', className)} {...props} />;
}

function SheetDescription({ className, ...props }) {
    return <Dialog.Description className={cn('mt-1 text-sm text-[var(--text-muted)]', className)} {...props} />;
}

export {
    Sheet,
    SheetTrigger,
    SheetClose,
    SheetPortal,
    SheetOverlay,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
};