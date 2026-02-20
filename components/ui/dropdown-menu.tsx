"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

const useDropdownMenu = () => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenu components must be used together.");
  return context;
};

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = useDropdownMenu();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => setOpen(!open)
    });
  }

  return (
    <button
      type="button"
      className={cn("inline-flex items-center", className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = "end",
  className,
  children
}: {
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useDropdownMenu();
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-2 min-w-[180px] rounded-2xl border border-white/10 bg-[#101922]/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDropdownMenu();
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white",
        className
      )}
      onClick={(event) => {
        props.onClick?.(event);
        setOpen(false);
      }}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-white/10", className)} {...props} />;
}
