import { Menu, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent } from "../components/ui/sheet";
import { BRAND, BRAND_ASSETS } from "../config/branding";

export default function Layout({ sidebar, children, sidebarOpen, onSidebarOpenChange, title, rightAction, showAdmin, hideHeader = false }) {
  return (
    <div className="relative flex h-[100svh] min-h-[100svh] max-w-full overflow-hidden text-[var(--text-main)]">
      <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-r border-[var(--border-soft)] bg-[var(--panel)] p-3 backdrop-blur-xl lg:flex lg:flex-col lg:p-4">{sidebar}</aside>

      <Sheet open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
        <SheetContent side="left" className="w-[75vw] max-w-[380px] border-r border-[var(--border-soft)] bg-[var(--panel-strong)] p-3 sm:p-4 lg:hidden">
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {!hideHeader ? (
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--panel-strong)] px-2.5 py-2 backdrop-blur-xl md:px-6 md:py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => onSidebarOpenChange(true)}>
                <Menu size={18} />
              </Button>
              <div className="flex min-w-0 items-center gap-2">
                <img src={BRAND_ASSETS.iconDark} alt={BRAND.name} className="h-8 w-8 rounded-md object-contain" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-500/90 [data-theme='dark']_&:text-emerald-300/80" style={{ color: 'var(--accent)' }}>{BRAND.name}</p>
                  <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--text-main)] md:text-lg">{title}</h1>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              {showAdmin ? (
                <span
                  className="hidden items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 [data-theme='dark']_&:text-emerald-200 sm:inline-flex"
                  style={{ color: 'color-mix(in srgb, var(--accent) 90%, currentColor 10%)' }}
                  title="Admin access enabled"
                  aria-label="Admin access enabled"
                >
                  <ShieldCheck size={13} />
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400/65" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                </span>
              ) : null}
              {rightAction}
            </div>
          </header>
        ) : null}

        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
