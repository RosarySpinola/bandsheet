import { Glyph } from "@/components/gl/glyph"
import { cn } from "@/lib/utils"
import type { NavItem } from "./nav"

/** Glyph for a nav item; Overview gets a small four-tile mark in the same palette. */
export function NavGlyph({ kind, className }: { kind: NavItem["kind"]; className?: string }) {
  if (kind === "how")
    return (
      <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden="true">
        <path d="M6 8 H30 V18 H6 Z" fill="var(--purple-200)" />
        <path d="M12 20 H36 V30 H12 Z" fill="var(--purple-300)" />
        <path d="M18 32 H42 V42 H18 Z" fill="var(--ink)" />
      </svg>
    )
  if (kind === "help")
    return (
      <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden="true">
        <circle cx="24" cy="24" r="18" fill="var(--purple-200)" />
        <path d="M18 19 C18 13 30 13 30 19 C30 24 24 24 24 29" fill="none" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M21.5 33 H26.5 V38 H21.5 Z" fill="var(--ink)" />
      </svg>
    )
  if (kind === "pricing")
    return (
      <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden="true">
        <path d="M6 12 H28 V36 H6 Z" fill="var(--purple-200)" />
        <path d="M28 12 L42 24 L28 36 Z" fill="var(--purple-300)" />
        <path d="M12 21 H18 V27 H12 Z" fill="var(--ink)" />
      </svg>
    )
  if (kind !== "overview") return <Glyph kind={kind} className={className} />
  return (
    <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden="true">
      <path d="M6 6 H22 V22 H6 Z" fill="var(--ink)" />
      <path d="M26 6 H42 V22 H26 Z" fill="var(--purple-200)" />
      <path d="M6 26 H22 V42 H6 Z" fill="var(--purple-300)" />
      <path d="M26 26 H42 V42 H26 Z" fill="var(--purple-100)" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  )
}
