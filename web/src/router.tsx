import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router"
import { LandingPage } from "./pages/landing"

/* Route map is owned by the Opus owner. UI workers create the page files named here. */
const AppShell = lazy(() => import("./pages/unit/app-shell"))
const Overview = lazy(() => import("./pages/unit/overview"))
const Submit = lazy(() => import("./pages/unit/submit"))
const Releases = lazy(() => import("./pages/unit/releases"))
const Attack = lazy(() => import("./pages/unit/attack"))
const Vote = lazy(() => import("./pages/unit/vote"))
const Stand = lazy(() => import("./pages/unit/stand"))
const Verify = lazy(() => import("./pages/unit/verify"))

const s = (node: ReactNode) => <Suspense fallback={null}>{node}</Suspense>

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/unit",
    element: s(<AppShell />),
    children: [
      { index: true, element: s(<Overview />) },
      { path: "submit", element: s(<Submit />) },
      { path: "releases", element: s(<Releases />) },
      { path: "attack", element: s(<Attack />) },
      { path: "vote", element: s(<Vote />) },
      { path: "stand", element: s(<Stand />) },
      { path: "verify", element: s(<Verify />) },
    ],
  },
])
