// Records that existed before the hub kept payroll: the first pay run
// (28 Sep – 4 Oct 2026, paid 6 Oct), copied from the payslips Jack emailed
// from the old Pay Run page, plus the employee details on those payslips.
// Loaded into the store once, the first time the Team & pay page opens.

const lines = [
  { label: "Ordinary hours, Mon–Fri", hrs: 7.5, rate: 37.5, ot: false },
  { label: "Saturday", hrs: 7.6, rate: 47.39, ot: false },
  { label: "Overtime, first 2 hrs", hrs: 1.4, rate: 47.39, ot: true },
];
const shifts = [
  { date: "2026-10-02", hrs: 7.5, kind: "wk" },
  { date: "2026-10-03", hrs: 9, kind: "sat" },
];

export const SEED_PROFILES = {
  tmup6bkj2hc51: { email: "mariamcamara91@outlook.fr", level: "1", type: "casual", tft: "2", superFund: "Fund Super", superNo: "1077471757", status: "active" },
  tmunw8b91btcp: { email: "Sergio.martin.gomez2003@gmail.com", level: "1", type: "casual", tft: "2", superFund: "Essential Super", superNo: "FSF1332AU", status: "active" },
};

const base = { periodStart: "2026-09-28", periodEnd: "2026-10-04", paidOn: "2026-10-06", cycle: 1, level: "1", lines, shifts, tax: 66, source: "import", sentAt: "2026-10-06T23:32:00Z" };

export const SEED_SLIPS = [
  { ...base, id: "s20261004mc", num: "BC-20261004-MC", pid: "tmup6bkj2hc51", name: "Mariam Camara", superFund: "Fund Super", superNo: "1077471757", sentTo: "mariamcamara91@outlook.fr", sentAt: "2026-10-06T23:34:08Z" },
  { ...base, id: "s20261004smg", num: "BC-20261004-SMG", pid: "tmunw8b91btcp", name: "Sergio Martin Gomez", superFund: "Essential Super", superNo: "FSF1332AU", sentTo: "Sergio.martin.gomez2003@gmail.com", sentAt: "2026-10-06T23:31:42Z" },
];
