#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApi } from "./api.js";
import { buildServer } from "./server.js";

await buildServer(createApi()).connect(new StdioServerTransport());
