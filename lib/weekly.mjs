// Monday morning push: last week's profit, and what's stopping the number being right.
import { loadRoster } from "./core.mjs";
import { loadDocs, loadSettings } from "./docs.mjs";
import { loadBooks, loadExpenses, quoteTotals, SETUP } from "./books.mjs";
import { pnl, toWrap } from "../public/lib/profit.mjs";
import { money } from "./notify.mjs";

const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export async function weeklyMoney(s, today) {
  const [roster, books, docs, expenses, set] = await Promise.all([loadRoster(s), loadBooks(s), loadDocs(s), loadExpenses(s), loadSettings(s)]);
  const from = addDays(today, -7), to = addDays(today, -1);
  const D = { jobs: roster.jobs, team: roster.team, pay: roster.pay, books, expenses, quoteTotals: quoteTotals(docs), gstReg: set.gst !== false, payments: [] };
  const p = pnl(D, from, to);
  if (!p.jobs.length && !p.expCount) return null;
  const todo = [];
  if (p.unpriced.length) todo.push(`${p.unpriced.length} job${p.unpriced.length === 1 ? " has" : "s have"} no price`);
  if (!p.expCount) todo.push("no expenses logged last week");
  const wrap = toWrap(D, today, "").length;
  if (wrap) todo.push(`${wrap} finished job${wrap === 1 ? "" : "s"} need actual hours logged`);
  const left = SETUP.filter(([k]) => !books.setup[k]).length;
  if (left) todo.push(`${left} regular outgoing${left === 1 ? "" : "s"} still to check`);
  return {
    type: "money_week",
    title: `Last week: ${money(p.profit)} profit on ${money(p.rev)}`,
    body: `${p.jobs.length} job${p.jobs.length === 1 ? "" : "s"} · wages + super ${money(p.wages + p.sup)} · other costs ${money(p.otherCosts)}${p.perHour ? `\nEarned ${money(p.perHour.rate)}/hr worked (${money(p.perHour.profit)}/hr profit) on ${p.perHour.jobs} wrapped job${p.perHour.jobs === 1 ? "" : "s"}` : ""}${todo.length ? "\nTo make this right: " + todo.join(", ") + "." : ""}`,
    tags: "chart_with_upwards_trend", priority: todo.length ? 4 : 3, url: "/books/",
  };
}
