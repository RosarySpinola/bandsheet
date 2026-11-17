import { useEffect, useSyncExternalStore } from "react"
import { Outlet, useMatches } from "react-router"

export const SITE = "Bandsheet"
const HOME_TITLE = "Bandsheet · Every band published, nobody exposed"

/** Route `handle` shape: a page name, shown as "<title> · Bandsheet". */
export type RouteHandle = { title?: string }

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : HOME_TITLE
  }, [title])
}

/* A page's state can outrank its route title (a unit that is missing or could not be read). Root reads it, so the
   override wins whichever effect runs last. */
let override: string | undefined
const listeners = new Set<() => void>()
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const setOverride = (t: string | undefined) => {
  if (override === t) return
  override = t
  listeners.forEach((fn) => fn())
}

/** Replace the route's document title while `title` is set; the route title returns when it clears or unmounts. */
export function useTitleOverride(title: string | undefined) {
  useEffect(() => {
    setOverride(title)
    return () => setOverride(undefined)
  }, [title])
}

/** Pathless root: sets each route's document title from the deepest `handle.title`, then renders the page. */
export default function Root() {
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.title).find(Boolean)
  const forced = useSyncExternalStore(subscribe, () => override)
  useDocumentTitle(forced ?? title)
  return <Outlet />
}
