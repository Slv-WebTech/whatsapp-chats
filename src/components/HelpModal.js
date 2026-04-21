import * as Dialog from "@radix-ui/react-dialog";
import { Compass, Info, LayoutDashboard, LogIn, Palette, Search, UserRoundPlus, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { BRAND } from "../config/branding";

const STEPS = [
    {
        number: "01",
        icon: UserRoundPlus,
        title: "Create an Account",
        color: "text-emerald-300",
        border: "border-emerald-400/30",
        bg: "bg-emerald-500/10",
        description:
            "Tap Create Account with email + password, then set your username.",
    },
    {
        number: "02",
        icon: LogIn,
        title: "Sign In",
        color: "text-sky-300",
        border: "border-sky-400/30",
        bg: "bg-sky-500/10",
        description:
            "Use Sign In to open your chat workspace.",
    },
    {
        number: "03",
        icon: Palette,
        title: "Open Profile Settings",
        color: "text-violet-300",
        border: "border-violet-400/30",
        bg: "bg-violet-500/10",
        description:
            "Tap your profile picture on Home to open Profile, then change username, avatar, theme, and appearance.",
    },
    {
        number: "04",
        icon: Search,
        title: "Start a 1-on-1 Chat",
        color: "text-amber-300",
        border: "border-amber-400/30",
        bg: "bg-amber-500/10",
        description:
            "Search a username (2+ chars) and tap a result to start chatting.",
    },
    {
        number: "05",
        icon: UsersRound,
        title: "Join a Group Chat",
        color: "text-pink-300",
        border: "border-pink-400/30",
        bg: "bg-pink-500/10",
        description:
            "Enter the group secret and join instantly.",
    },
    {
        number: "06",
        icon: Compass,
        title: "Import Chat (Optional)",
        color: "text-orange-300",
        border: "border-orange-400/30",
        bg: "bg-orange-500/10",
        description:
            "Use the small Import button on Home top actions. Imported chats are marked with a small Imported tag in chat list.",
    },
    {
        number: "07",
        icon: Compass,
        title: "Open & Use a Chat",
        color: "text-orange-300",
        border: "border-orange-400/30",
        bg: "bg-orange-500/10",
        description:
            "Send messages, replay timeline, run AI tools, and use offline queue with auto-sync on reconnect.",
    },
    {
        number: "08",
        icon: LayoutDashboard,
        title: "Admin Dashboard",
        color: "text-cyan-300",
        border: "border-cyan-400/30",
        bg: "bg-cyan-500/10",
        description:
            "Admins can monitor users, groups, and live platform stats.",
    },
];

export default function HelpModal({ isAdmin = false, triggerClassName = "", triggerIconSize = 18 }) {
    const [open, setOpen] = useState(false);
    const steps = isAdmin ? STEPS : STEPS.filter((step) => step.title !== "Admin Dashboard");

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Help - How to use ${BRAND.name}`}
                    title="Help"
                    className={[
                        "rounded-full text-slate-400 hover:text-emerald-300",
                        triggerClassName,
                    ].filter(Boolean).join(" ")}
                >
                    <Info size={triggerIconSize} />
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90svh] w-[min(95vw,680px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[1.8rem] border border-white/10 bg-[#07111b] shadow-2xl ring-1 ring-white/5 focus:outline-none">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                        <div>
                            <Dialog.Title className="text-xl font-semibold tracking-tight text-slate-100">
                                {`How to use ${BRAND.name}`}
                            </Dialog.Title>
                            <Dialog.Description className="mt-0.5 text-sm text-slate-400">
                                Follow these steps to get started in under a minute.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button type="button" variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-slate-100">
                                <X size={18} />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {/* Scrollable step list */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        <ol className="space-y-4">
                            {steps.map((step) => {
                                const StepIcon = step.icon;
                                return (
                                    <li
                                        key={step.number}
                                        className={`flex gap-4 rounded-[1.2rem] border ${step.border} ${step.bg} p-4`}
                                    >
                                        <div className="shrink-0">
                                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 ${step.color}`}>
                                                <StepIcon size={18} />
                                            </span>
                                            <p className={`mt-1 text-center text-[11px] font-semibold ${step.color}`}>{step.number}</p>
                                        </div>
                                        <div>
                                            <p className={`font-semibold ${step.color}`}>{step.title}</p>
                                            <p className="mt-1 text-sm leading-relaxed text-slate-300/90">{step.description}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>

                        {/* Footer tip */}
                        <div className="mt-5 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-slate-400">
                            <span className="font-semibold text-slate-300">Tip: </span>
                            On mobile, tap the menu icon (☰) in the top-left to open the sidebar. The sidebar holds your chat list, user search, and group join field.
                        </div>
                    </div>

                    {/* Footer close button */}
                    <div className="border-t border-white/10 px-6 py-4">
                        <Dialog.Close asChild>
                            <Button type="button" className="w-full rounded-2xl" variant="secondary">
                                Got it
                            </Button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
