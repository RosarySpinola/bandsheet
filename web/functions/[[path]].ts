import { isSpaPath } from "../src/route-paths"

type Ctx = { request: Request; next: () => Promise<Response> }

/**
 * Page requests outside /api (static assets are excluded in public/_routes.json). Known app paths pass through to the
 * SPA. Any other path still gets the app, which renders its "not found" page, but with HTTP 404 instead of 200.
 */
export const onRequest = async ({ request, next }: Ctx): Promise<Response> => {
  const res = await next()
  if (request.method !== "GET" && request.method !== "HEAD") return res
  if (isSpaPath(new URL(request.url).pathname)) return res
  if (res.status !== 200 || !(res.headers.get("content-type") ?? "").includes("text/html")) return res
  const headers = new Headers(res.headers)
  headers.set("cache-control", "no-store")
  return new Response(res.body, { status: 404, statusText: "Not Found", headers })
}
