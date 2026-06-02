// 供 vitest 用 — Node 環境的 msw server
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
