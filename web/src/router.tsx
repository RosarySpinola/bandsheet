import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Navigate } from "react-router"
import { LandingPage } from "./pages/landing"
import Root, { type RouteHandle } from "./pages/root"
import { NotFound, RouteError, UnitNotFound } from "./pages/not-found"

/* Route map is owned by the Opus owner. UI workers create the page files named here. */
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
const Terms = lazy(() => import("./pages/terms"))
const Privacy = lazy(() => import("./pages/privacy"))

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
      { path: "/how", element: <Navigate to="/unit/how" replace /> },
      { path: "/signin", element: <Navigate to="/unit/join" replace /> },
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
          { path: "*", element: <UnitNotFound />, handle: t("Page not found") },
        ],
      },
      { path: "*", element: <NotFound />, handle: t("Page not found") },
    ],
  },
])
