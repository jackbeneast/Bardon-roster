// Nightly backup of the hub's records into a separate store (lib/backup.mjs).
import { store } from "../../lib/core.mjs";
import { saveSnapshot } from "../../lib/backup.mjs";
import { notify } from "../../lib/notify.mjs";

export default async () => {
  const s = await store();
  try { const r = await saveSnapshot(s); console.log("backup", r); }
  catch (e) {
    console.error("backup failed", e);
    await notify(s, { type: "money_week", title: "Nightly backup didn't run", body: "Open the desk and tap Back up now, or download a copy.", tags: "warning", priority: 4, url: "/desk/#backup" }).catch(() => {});
  }
};

// 3am Brisbane (17:00 UTC)
export const config = { schedule: "0 17 * * *" };
