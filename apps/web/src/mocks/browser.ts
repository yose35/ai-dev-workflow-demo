import { setupWorker } from "msw/browser";
import { handlers, seedDemoData } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMsw() {
  if (typeof window === "undefined") return;
  seedDemoData();
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
  // eslint-disable-next-line no-console
  console.log("[msw] ✓ Service Worker started — BE 不在也能跑");
}
