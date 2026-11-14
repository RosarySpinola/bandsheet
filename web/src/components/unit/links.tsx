import type { ComponentProps, ReactNode } from "react"
import { Link } from "react-router"
import { ArrowUpRight, CornerDownRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { explorer, txHashOf } from "@/lib/chain"
import { shortHash } from "@/lib/format"

/** External link: ink text, 2px wipe underline, arrow nudges up-right 500ms (Greenlock external card). */
export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("group inline-flex items-center gap-1 font-medium text-ink", className)}
    >
      <span className="wipe">{children}</span>
      <ArrowUpRight className="size-4 shrink-0 transition-transform duration-500 ease-gl group-hover:translate-x-[.375rem] group-hover:-translate-y-[.3rem]" />
    </a>
  )
}

/** A NEAR testnet transaction on nearblocks. Accepts a hash or a nearblocks URL. */
export function TxLink({ tx, label, className }: { tx: string; label?: ReactNode; className?: string }) {
  const hash = txHashOf(tx)
  return (
    <ExtLink href={explorer.tx(hash)} className={className}>
      {label ?? <code className="font-mono text-[0.875rem]">{shortHash(hash, 6, 4)}</code>}
    </ExtLink>
  )
}

export function AccountLink({ id, className }: { id: string; className?: string }) {
  return (
    <ExtLink href={explorer.account(id)} className={className}>
      <span className="break-all">{id}</span>
    </ExtLink>
  )
}

type CtaProps = { children: ReactNode; className?: string; size?: "md" | "lg" }

const ctaCls = (size: CtaProps["size"]) =>
  cn(
    "group inline-flex cursor-pointer items-center gap-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40",
    size === "lg" ? "text-[1.5rem] leading-tight md:text-[1.75rem]" : "text-[1.125rem]",
  )

function CtaInner({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="wipe group-hover:after:scale-x-100 group-focus-visible:after:scale-x-100">{children}</span>
      <CornerDownRight className="size-[1em] shrink-0" strokeWidth={2} />
    </>
  )
}

/** Greenlock text CTA ("Contact us ↳"): label + hooked arrow, 2px underline wipe on hover. */
export function CtaButton({ children, className, size = "md", ...rest }: CtaProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type="button" {...rest} className={cn(ctaCls(size), className)}>
      <CtaInner>{children}</CtaInner>
    </button>
  )
}

export function CtaLink({ to, children, className, size = "md" }: CtaProps & { to: string }) {
  return (
    <Link to={to} className={cn(ctaCls(size), className)}>
      <CtaInner>{children}</CtaInner>
    </Link>
  )
}

/** Solid square button (ink on white, or white on band). Colour change only, 400ms. */
export function SquareButton({
  variant = "ink",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: "ink" | "paper" | "line" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 px-6 text-[1rem] font-semibold transition-colors duration-[400ms] ease-gl disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav",
        variant === "ink" && "bg-ink text-white hover:bg-indigo",
        variant === "paper" && "bg-white text-ink hover:bg-lav-soft",
        variant === "line" && "border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
        className,
      )}
    />
  )
}
