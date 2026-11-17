import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate } from "react-router"
import { LandingPage } from "./pages/landing"
import Root, { type RouteHandle } from "./pages/root"
import { NotFound, RouteError, UnitNotFound } from "./pages/not-found"

/* Route map. Keep web/src/route-paths.ts in step: the Pages Function answers 404 for any page path not listed there. */
const AppShell = lazy(() => import("./pages/unit/app-shell"))
const Overview = lazy(() => import("./pages/unit/overview"))
const Submit = lazy(() => import("./pages/unit/submit"))
const Releases = lazy(() => import("./pages/unit/releases"))
const Attack = lazy(() => import("./pages/unit/attack"))
const Vote = lazy(() => import("./pages/unit/vote"))
const Stand = lazy(() => import("./pages/unit/stand"))
const Verify = lazy(() => import("./pages/unit/verify"))
const Join = lazy(() => import("./pages/unit/join"))
const How = lazy(() => import("./pages/unit/how"))
const Help = lazy(() => import("./pages/unit/help"))
const Pricing = lazy(() => import("./pages/pricing"))
const HowPage = lazy(() => import("./pages/how"))
const UnitPricing = lazy(() => import("./pages/unit/pricing"))
const Terms = lazy(() => import("./pages/terms"))
const Privacy = lazy(() => import("./pages/privacy"))
/* A judge's own unit (UNITS-BRIEF): /start, the invite link, and /u/:unitId/… */
const Start = lazy(() => import("./pages/units/start"))
const JoinUnit = lazy(() => import("./pages/units/join"))
const UnitShell = lazy(() => import("./pages/units/shell"))
const UOverview = lazy(() => import("./pages/units/overview"))
const UInvite = lazy(() => import("./pages/units/invite"))
const USubmit = lazy(() => import("./pages/units/submit"))
const UReleases = lazy(() => import("./pages/units/releases"))
const UVote = lazy(() => import("./pages/units/vote"))
const UVerify = lazy(() => import("./pages/units/verify"))
const UStand = lazy(() => import("./pages/units/stand"))

const s = (node: ReactNode) => <Suspense fallback={null}>{node}</Suspense>
/** Document title for a route: "<title> · Bandsheet" (set by Root). */
const t = (title: string): RouteHandle => ({ title })

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/pricing", element: s(<Pricing />), handle: t("Pricing") },
      { path: "/terms", element: s(<Terms />), handle: t("Terms") },
      { path: "/privacy", element: s(<Privacy />), handle: t("Privacy") },
      { path: "/how", element: s(<HowPage />), handle: t("How it works") },
      /* Signing in starts at /start: connect a wallet to start a unit, or explore the example chapel. */
      { path: "/signin", element: <Navigate to="/start" replace /> },
      { path: "/unit/join", element: s(<Join />), handle: t("Join your chapel") },
      {
        path: "/unit",
        element: s(<AppShell />),
        errorElement: <RouteError />,
        handle: t("Overview"),
        children: [
          { index: true, element: s(<Overview />) },
          { path: "submit", element: s(<Submit />), handle: t("Submit a payslip") },
          { path: "releases", element: s(<Releases />), handle: t("Releases") },
          { path: "attack", element: s(<Attack />), handle: t("Attack lab") },
          { path: "vote", element: s(<Vote />), handle: t("Chapel vote") },
          { path: "stand", element: s(<Stand />), handle: t("Where do I stand") },
          { path: "verify", element: s(<Verify />), handle: t("Verify") },
          { path: "how", element: s(<How />), handle: t("How it works") },
          { path: "help", element: s(<Help />), handle: t("Help") },
          { path: "pricing", element: s(<UnitPricing />), handle: t("Pricing") },
          { path: "*", element: <UnitNotFound />, handle: t("Page not found") },
        ],
      },
      { path: "/start", element: s(<Start />), handle: t("Start your unit") },
      { path: "/join/:unitId", element: s(<JoinUnit />), handle: t("Join a unit") },
      {
        path: "/u/:unitId",
        element: s(<UnitShell />),
        errorElement: <RouteError />,
        handle: t("Your unit"),
        children: [
          { index: true, element: s(<UOverview />) },
          { path: "invite", element: s(<UInvite />), handle: t("Invite and council") },
          { path: "submit", element: s(<USubmit />), handle: t("Submit a payslip") },
          { path: "releases", element: s(<UReleases />), handle: t("Release ledger") },
          { path: "vote", element: s(<UVote />), handle: t("Council vote") },
          { path: "verify", element: s(<UVerify />), handle: t("Verify") },
          { path: "stand", element: s(<UStand />), handle: t("Where do I stand") },
          { path: "*", element: <UnitNotFound />, handle: t("Page not found") },
        ],
      },
      { path: "*", element: <NotFound />, handle: t("Page not found") },
    ],
  },
])
