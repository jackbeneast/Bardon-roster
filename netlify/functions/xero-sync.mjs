// Every 15 minutes: send new payments and expenses to Xero.
// Does nothing (and makes no Xero calls) when Xero isn't connected or nothing has changed.
import { store } from "../../lib/core.mjs";
import { loadXero, sync, plan } from "../../lib/xero.mjs";

export default async () => {
  const s = await store();
  const x = await loadXero(s);
  if (!x.tokens || !x.bank) return new Response("idle");
  const { todo } = await plan(s, x);
  if (!todo.length) return new Response("up to date");
  const r = await sync(s);
  return new Response(JSON.stringify(r));
};

export const config = { schedule: "*/15 * * * *" };
