import { useEffect } from "react"
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

/** Pathless root: sets each route's document title from the deepest `handle.title`, then renders the page. */
export default function Root() {
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.title).find(Boolean)
  useDocumentTitle(title)
  return <Outlet />
}
