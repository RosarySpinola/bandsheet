import { type WorkerEnv, handle } from "../../../server/src/worker";

/** Pages Functions catch-all: every /api/* request is served by the Hono app, same origin as the SPA. */
export const onRequest = (ctx: { request: Request; env: WorkerEnv }): Promise<Response> => handle(ctx.request, ctx.env);
