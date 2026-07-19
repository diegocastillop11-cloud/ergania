import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

/**
 * Requires these keyframes and utilities in your CSS (e.g. global CSS or Tailwind):
 *
 * @keyframes cosmic-spin {
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(360deg); }
 * }
 * @keyframes cosmic-spin-slow {
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(-360deg); }
 * }
 * @utility animate-cosmic-spin {
 *   animation: cosmic-spin 3s linear infinite;
 * }
 * @utility animate-cosmic-spin-slow {
 *   animation: cosmic-spin-slow 5s linear infinite;
 * }
 */

export type CosmicButtonProps<E extends "a" | "button" = "a"> = {
  /** The HTML element to render as. @default "a" */
  as?: E
} & ComponentPropsWithoutRef<E>

/**
 * An animated button/link with a cosmic gradient border effect.
 * Renders as an anchor by default; use `as="button"` for button behavior.
 *
 * @example
 * // As link (default)
 * <CosmicButton href="/about">About</CosmicButton>
 *
 * @example
 * // As button
 * <CosmicButton as="button" onClick={handleClick}>Submit</CosmicButton>
 */
export function CosmicButton<E extends "a" | "button" = "a">({
  as,
  className,
  children,
  ...props
}: CosmicButtonProps<E>) {
  const Element = as ?? "a"
  const isAnchor = Element === "a"

  const baseClassName = cn(
    "group/cosmic relative inline-flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-[15px] p-[3px] transition-transform  ",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0c0912]",
    className
  )

  const content = (
    <>
      {/* Animated cosmic border - enlarges on hover */}
      <span className="absolute inset-0 overflow-hidden rounded-[15px] transition-all duration-300 ease-out group-hover/cosmic:inset-[-3px] group-hover/cosmic:rounded-[15px]">
        <span className="absolute inset-[-200%] animate-cosmic-spin bg-[conic-gradient(from_0deg,#60A5FA,#A78BFA,#C4B5FD,#3B82F6,#2563EB,#7C3AED,#60A5FA)] opacity-95" />
      </span>

      {/* Noise/texture overlay on the border - enlarges on hover */}
      <span className="absolute inset-0 overflow-hidden rounded-[15px] opacity-45 mix-blend-soft-light transition-all duration-300 ease-out group-hover/cosmic:inset-[-3px] group-hover/cosmic:rounded-[15px] dark:opacity-60 dark:mix-blend-overlay">
        <span className="absolute inset-[-200%] animate-cosmic-spin-slow bg-[conic-gradient(from_180deg,#C4B5FD_0%,transparent_30%,#60A5FA_50%,transparent_70%,#2563EB_100%)]" />
      </span>

      {/* Theme-aware inner background */}
      <span className="relative z-10 flex items-center gap-3 rounded-[12px] bg-[#12123A] px-5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_1px_rgba(0,0,0,0.45),0_10px_28px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover/cosmic:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(0,0,0,0.55),0_14px_34px_rgba(59,130,246,0.25)] active:scale-[0.98]">
        <span className="font-medium text-base tracking-wide text-[#F1F2FB]">
          {children ?? "Placeholder text"}
        </span>
      </span>
    </>
  )

  if (isAnchor) {
    const { href, rel, target, ...rest } =
      props as ComponentPropsWithoutRef<"a">
    return (
      <a
        className={baseClassName}
        href={href ?? "https://aisdkagents.com"}
        rel={rel ?? "noopener noreferrer"}
        target={target ?? "_blank"}
        {...rest}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      className={baseClassName}
      {...(props as ComponentPropsWithoutRef<"button">)}
    >
      {content}
    </button>
  )
}
