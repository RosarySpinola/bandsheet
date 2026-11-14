import type { ReactNode } from "react"
import { isRouteErrorResponse, Link, useLocation, useRouteError } from "react-router"
import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Page } from "@/components/unit/page"
import { PageHeader } from "@/components/unit/page-header"
import { CtaLink } from "@/components/unit/links"
import { useDocumentTitle } from "./root"

/** Three ledger rows with the middle one withheld: a dashed outline where a band would be. */
function WithheldMark() {
  return (
    <svg viewBox="0 0 96 72" className="h-auto w-[calc(var(--gl)*7)] max-[991px]:w-20" aria-hidden="true">
      <path d="M0 0 H96 V16 H0 Z" fill="var(--purple-200)" />
      <path d="M1.5 29.5 H94.5 V42.5 H1.5 Z" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="7 6" />
      <path d="M0 56 H96 V72 H0 Z" fill="var(--ink)" />
    </svg>
  )
}

function GlCta({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="gl-cta group inline-flex w-fit items-center gap-[calc(var(--gl)*0.5)]">
      <span className="wipe group-hover:after:scale-x-100 group-focus-visible:after:scale-x-100">{children}</span>
      <span aria-hidden="true" className="inline-block translate-y-[0.08em]">↳</span>
    </Link>
  )
}

/** Public-site frame for a missing page or a page that failed: Greenlock header, serif statement, two ways back. */
function SiteFrame({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-white">
      <SiteHeader />
      <main className="gl-container flex w-full flex-1 flex-col justify-center gap-[calc(var(--gl)*2.5)] pt-[calc(var(--gl)*12)] pb-[calc(var(--gl)*8)] max-[991px]:pt-28 max-[991px]:pb-16">
        <div className="flex flex-col gap-[calc(var(--gl)*2)] animate-in fade-in-0 slide-in-from-bottom-12 duration-1000 ease-gl">
          <WithheldMark />
          <p className="gl-body3 font-medium tracking-[0.04em] text-muted-foreground! uppercase">{eyebrow}</p>
          <h1 className="gl-h1 max-w-[calc(var(--gl)*56)]">{title}</h1>
          <div className="gl-body1 max-w-[calc(var(--gl)*44)]">{body}</div>
          <div className="flex flex-wrap items-center gap-x-[calc(var(--gl)*3)] gap-y-3 pt-[var(--gl)]">
            {action}
            <GlCta to="/">Back to the home page</GlCta>
            <GlCta to="/unit">Open the demo unit</GlCta>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** 404 for any address outside the demo unit. */
export function NotFound() {
  const { pathname } = useLocation()
  useDocumentTitle("Page not found")
  return (
    <SiteFrame
      eyebrow="404 · Not found"
      title="Nothing was published at this address."
      body={
        <>
          <code className="font-mono text-[0.85em] break-all text-ink">{pathname}</code> isn't a page on Bandsheet. It may have moved, or
          the link was mistyped.
        </>
      }
    />
  )
}

/** 404 inside the demo unit: keeps the sidebar, points back to the overview. */
export function UnitNotFound() {
  const { pathname } = useLocation()
  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="404 · Not found"
        title="This page isn't in the demo unit"
        lede={
          <>
            <code className="font-mono text-[0.9em] break-all text-ink">{pathname}</code> doesn't match any screen. Pick one from the menu, or
            start from the overview.
          </>
        }
      />
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <CtaLink to="/unit" size="lg">
          Unit overview
        </CtaLink>
        <CtaLink to="/" size="lg">
          Back to the home page
        </CtaLink>
      </div>
    </Page>
  )
}

const isStaleBuild = (e: unknown) => e instanceof Error && /dynamically imported module|Importing a module script failed|Loading chunk/i.test(e.message)

/** errorElement for the root and the demo unit: a 404 in theme, or a calm failure page with a reload. */
export function RouteError() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  const stale = isStaleBuild(error)
  useDocumentTitle(missing ? "Page not found" : "Something went wrong")
  if (missing) return <NotFound />
  return (
    <SiteFrame
      eyebrow={stale ? "A newer version is live" : "Something went wrong"}
      title={stale ? "Bandsheet was updated while this page was open." : "This page could not be shown."}
      body={
        stale
          ? "Reload to pick up the new version. Nothing you sealed or sent is lost: entries live on NEAR, not in this tab."
          : "Nothing was stored or sent because of this. Reload to try again, or go back to a page that works."
      }
      action={
        <button type="button" onClick={() => window.location.reload()} className="gl-cta wipe cursor-pointer">
          Reload
        </button>
      }
    />
  )
}
