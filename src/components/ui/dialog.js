import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

function Dialog({ children, ...props }) {
    return <RadixDialog.Root {...props}>{children}</RadixDialog.Root>;
}

function DialogTrigger(props) {
    return <RadixDialog.Trigger {...props} />;
}

function DialogClose(props) {
    return <RadixDialog.Close {...props} />;
}

function DialogPortal(props) {
    return <RadixDialog.Portal {...props} />;
}

function DialogOverlay({ className, ...props }) {
    return (
        <RadixDialog.Overlay
            className={cn('fixed inset-0 z-40 bg-black/45 backdrop-blur-sm', className)}
            {...props}
        />
    );
}

function DialogContent({ className, children, ...props }) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <RadixDialog.Content
                className={cn(
                    'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
                    'rounded-[1.2rem] border border-[var(--border-soft)] bg-[var(--panel-strong)] p-6 shadow-lg backdrop-blur-xl',
                    'focus:outline-none',
                    className
                )}
                {...props}
            >
                {children}
                <RadixDialog.Close className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none">
                    <X className="h-4 w-4 text-[var(--text-main)]" />
                    <span className="sr-only">Close</span>
                </RadixDialog.Close>
            </RadixDialog.Content>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }) {
    return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
    return (
        <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
    );
}

function DialogTitle({ className, ...props }) {
    return (
        <RadixDialog.Title
            className={cn('text-lg font-semibold leading-none tracking-tight text-[var(--text-main)]', className)}
            {...props}
        />
    );
}

function DialogDescription({ className, ...props }) {
    return (
        <RadixDialog.Description
            className={cn('text-sm text-[var(--text-muted)]', className)}
            {...props}
        />
    );
}

export { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
