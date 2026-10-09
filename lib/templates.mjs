// Client text templates: one library for Messages, quotes, invoices, receipts,
// booking confirmations and the quote-request auto-reply. Jack's edits are
// stored as overrides in the "smstpl" blob; anything he hasn't edited uses the
// default below, so improving a default reaches him automatically.
//
// Variables are written {name}. A variable the hub can't fill stays in the
// text as {name}, so it's obvious what to type before sending.
// {name?} (with a question mark) means: if there's nothing to fill, drop that
// whole paragraph. Used for optional links like the live job link.
//
// Links always sit on their own line, with nothing straight after them, so
// every phone turns them into a tappable link.

export const SECTIONS = [
  ["leads", "New enquiries"],
  ["quotes", "Quotes"],
  ["bookings", "Bookings & deposits"],
  ["before", "Before the clean"],
  ["after", "After the clean"],
  ["payments", "Invoices & payments"],
  ["hiring", "Hiring"],
];

// [key, what it is, sample used in previews]
export const VARS = [
  ["first", "Client's first name", "Sarah"],
  ["name", "Client's full name", "Sarah Nguyen"],
  ["service", "Service, in a sentence", "pre-sale clean"],
  ["service_size", "Service with beds and baths", "Pre-sale clean (3 bed, 2 bath)"],
  ["address", "Property address", "12 Smith Street, Bardon"],
  ["suburb", "Suburb", "Bardon"],
  ["date", "Clean date", "Thu 16 Oct"],
  ["time", "Team arrival time", "8am"],
  ["when", "Day(s) and arrival time, one line per day", "Thu 16 Oct, team arrives 8am"],
  ["duration", "Length of the clean", "6 hours"],
  ["quote_no", "Quote number", "172"],
  ["quote_total", "Quote total", "$880.00"],
  ["valid_until", "Quote valid until", "Fri 7 Nov"],
  ["deposit", "Deposit amount", "$440.00"],
  ["invoice_no", "Invoice number", "259"],
  ["amount_due", "Amount owing on the invoice", "$440.00"],
  ["due_date", "Invoice due date", "Thu 9 Oct"],
  ["paid", "Payment just received", "$440.00"],
  ["balance", "Left to pay after that payment", "$440.00"],
  ["quote_link", "Link to their quote", "/q/3f9a…"],
  ["invoice_link", "Link to their invoice", "/i/7c21…"],
  ["receipt_link", "Link to their receipt", "/r/7c21…"],
  ["job_link", "Their live job page", "/v/b04e…"],
  ["report_link", "Job report with photos (same page, after the clean)", "/v/b04e…"],
  ["quote_form_link", "Your quote request form", "/quote"],
  ["review_link", "Your Google review link (set it on the Templates page)", "https://g.page/r/…"],
];
export const LINK_VARS = VARS.map((v) => v[0]).filter((k) => k.endsWith("_link"));

const SIGN = "Jack, Bardon Clean";

// id, section, title, when to use it, text. auto = sent by the hub itself.
export const DEFAULTS = [
  // ---- New enquiries ----
  { id: "lead_auto", section: "leads", auto: true, title: "Auto-reply to a website quote request", use: "Sent automatically the moment someone fills in the quote form.",
    text: `Hi {first}, thanks for your quote request for a {service} in {suburb}. I'll look over the details and be in touch. If there's anything else that would help with the quote, just reply to this text.\n\n${SIGN}` },
  { id: "lead_first", section: "leads", title: "First reply to a new enquiry", use: "Someone called, texted or messaged and you're replying for the first time.",
    text: `Hi {first}, it's Jack from Bardon Clean. Thanks for getting in touch about your {service}. So I can quote it properly, what's the address, and how many bedrooms and bathrooms?` },
  { id: "lead_form", section: "leads", title: "Send the quote form", use: "You'd rather they give you everything in one go, with photos.",
    text: `Hi {first}, it's Jack from Bardon Clean. The easiest way to get an accurate quote is this short form. It asks for everything I need and you can add photos:\n{quote_form_link}\n\nAny questions, just reply here.` },
  { id: "lead_details", section: "leads", title: "Ask for property details", use: "You need the basics before you can quote.",
    text: `Thanks {first}. So I can quote accurately, could you let me know:\n- Bedrooms and bathrooms\n- Furnished or empty\n- The date you need it done by` },
  { id: "lead_photos", section: "leads", title: "Ask for photos", use: "Photos would help you quote. Texts to this number can't carry photos, so this points them to email or the form.",
    text: `Thanks {first}. A few photos of the kitchen, bathrooms and any areas that need extra attention would help me quote accurately. Photos don't come through on this number, so please email them to hello@bardonclean.au or add them here:\n{quote_form_link}` },
  { id: "lead_visit", section: "leads", title: "Offer a walk-through", use: "Bigger or heavier jobs you want to see before quoting.",
    text: `Hi {first}, for a property like this I'd like to have a quick look before quoting, so there are no surprises on the day. Would {alt_date} suit?\n\n${SIGN}` },
  { id: "missed_call", section: "leads", title: "Missed call", use: "You couldn't pick up.",
    text: `Hi, it's Jack from Bardon Clean. Sorry I missed your call. What can I help you with? Reply here, or I'll call you back.` },
  { id: "lead_followup", section: "leads", title: "Follow up a quiet enquiry", use: "They asked about a clean, then went quiet.",
    text: `Hi {first}, it's Jack from Bardon Clean following up on your {service} enquiry. Are you still looking for a hand? Happy to answer any questions.` },
  { id: "lead_booked_out", section: "leads", title: "Booked out on their date", use: "You can't do the date they need.",
    text: `Hi {first}, thanks for thinking of Bardon Clean. Unfortunately we're fully booked on {date}. I could do {alt_date} if that works for you. If not, I'm sorry we can't help this time.\n\n${SIGN}` },
  { id: "lead_out_of_area", section: "leads", title: "Outside our area", use: "The property is too far away.",
    text: `Hi {first}, thanks for getting in touch. {suburb} is outside the area we service, so we're not able to take this one on. Sorry we can't help this time.\n\n${SIGN}` },

  // ---- Quotes ----
  { id: "quote_send", section: "quotes", title: "Send a quote", use: "Used when you send a quote from Quotes & Invoices.",
    text: `Hi {first}, here's your quote for the {service} at {address}:\n{quote_link}\n\nIt has the full scope, and you can accept it online. Any questions, just reply here.\n\n${SIGN}` },
  { id: "quote_follow", section: "quotes", title: "Quote follow-up", use: "A few days after sending, no reply yet.",
    text: `Hi {first}, just checking your quote for the {service} came through OK. Happy to adjust the scope or talk anything through.\n{quote_link}\n\n${SIGN}` },
  { id: "quote_expiring", section: "quotes", title: "Quote about to expire", use: "A couple of days before the quote's valid-until date.",
    text: `Hi {first}, a heads-up that your quote for the {service} is valid until {valid_until}. If you'd like to go ahead, you can accept it here:\n{quote_link}\n\n${SIGN}` },
  { id: "quote_revised", section: "quotes", title: "Updated quote", use: "You've changed the quote after talking to them.",
    text: `Hi {first}, I've updated your quote with the changes we discussed:\n{quote_link}\n\n${SIGN}` },

  // ---- Bookings & deposits ----
  { id: "booking_confirmed", section: "bookings", title: "Booking confirmed", use: "Booking confirmation when the deposit is paid, or no deposit applies.",
    text: `Hi {first}, your Bardon Clean booking is confirmed.\n\n{service_size}\n{when}\n{address}\n\nFollow your clean live on the day, with before and after photos:\n{job_link?}\n\nAny questions, just reply here.\n${SIGN}` },
  { id: "booking_pending", section: "bookings", title: "Booking details, deposit still due", use: "Booking confirmation while the deposit is unpaid.",
    text: `Hi {first}, thanks for booking with Bardon Clean. Here are your booking details.\n\n{service_size}\n{when}\n{address}\n\nYour booking is tentative until the {amount_due} deposit is paid. You can pay it here:\n{invoice_link}\n\nFollow your clean live on the day:\n{job_link?}\n\n${SIGN}` },
  { id: "deposit_invoice", section: "bookings", title: "Send the deposit invoice", use: "Used when you send a deposit invoice.",
    text: `Hi {first}, here's your deposit invoice for {amount_due}, due today. Your booking is tentative until it's paid:\n{invoice_link}\n\n${SIGN}` },
  { id: "deposit_reminder", section: "bookings", title: "Deposit reminder", use: "The deposit hasn't come through.",
    text: `Hi {first}, a reminder that the {amount_due} deposit for your {service} on {date} hasn't come through yet. Your booking is tentative until it's paid:\n{invoice_link}\n\nIf you've already paid, thank you, please ignore this.\n${SIGN}` },
  { id: "deposit_received", section: "bookings", title: "Deposit received", use: "Receipt for a deposit paid in full.",
    text: `Hi {first}, thanks, your deposit of {paid} has been received and your {service} on {date} is locked in. Your receipt:\n{receipt_link}\n\n${SIGN}` },
  { id: "reschedule_done", section: "bookings", title: "Rescheduled at their request", use: "They asked to move the date and you've done it.",
    text: `Hi {first}, no problem. Your {service} is now booked for {date}, with the team arriving at {time}. Reply here if anything else changes.\n\n${SIGN}` },
  { id: "reschedule_ask", section: "bookings", title: "We need to move the booking", use: "You need to change the date.",
    text: `Hi {first}, I'm sorry, but I need to move your {service} on {date}. Could {alt_date} work instead? Let me know what suits and I'll lock it in.\n\n${SIGN}` },
  { id: "cancel_ack", section: "bookings", title: "Cancellation confirmed", use: "They've cancelled.",
    text: `Hi {first}, thanks for letting me know. I've cancelled your {service} on {date}. If you'd like to rebook down the track, just reply here.\n\n${SIGN}` },

  // ---- Before the clean ----
  { id: "day_before", section: "before", title: "Day-before reminder", use: "Pre-sale, bond and deep cleans, the day before.",
    text: `Hi {first}, a reminder that your {service} with Bardon Clean is booked for tomorrow, {date}, with the team arriving at {time}. We bring all the equipment and products. If anything has changed with access, parking or the property, just reply to this message.\n\nFollow along on the day:\n{job_link?}\n\n${SIGN}` },
  { id: "day_before_regular", section: "before", title: "Day-before reminder, regular clean", use: "Your existing recurring-clean reminder.",
    text: `Hi {first}, your {service} with Bardon Clean is booked in for tomorrow at {time}. Equipment and products will be provided and the service will take approximately {duration}. If you need to update access instructions, parking info, or make any changes before the service, just reply to this message. Looking forward to delivering a great service for you.\n\n${SIGN}` },
  { id: "access_check", section: "before", title: "Check access", use: "You don't know yet how the team gets in.",
    text: `Hi {first}, a quick one before your clean on {date}. How will the team get in: keys, a lockbox code, or will someone be home? Please also make sure the power and water are on.` },
  { id: "on_the_way", section: "before", title: "Team on the way", use: "Morning of the clean.",
    text: `Hi {first}, the team is on the way and should be with you around {time}. You can follow along here:\n{job_link}\n\n${SIGN}` },
  { id: "running_late", section: "before", title: "Running late", use: "The team is behind.",
    text: `Hi {first}, the team is running about {minutes} minutes behind. Sorry for the delay, they're on their way.\n\n${SIGN}` },

  // ---- After the clean ----
  { id: "clean_done", section: "after", title: "Clean finished, with report", use: "Job is done and nothing is owing.",
    text: `Hi {first}, your clean at {address} is finished. Your job report, with before and after photos, is here:\n{report_link}\n\nIf you or your agent spot anything within 5 days, let me know and we'll come back and fix it at no cost.\n\n${SIGN}` },
  { id: "clean_done_balance", section: "after", title: "Clean finished, with balance invoice", use: "Used when you send a balance invoice for a job with a report.",
    text: `Hi {first}, your clean at {address} is finished. Your job report, with before and after photos, is here:\n{report_link}\n\nHere's the balance invoice #{invoice_no} for {amount_due}:\n{invoice_link}\n\nThanks for choosing Bardon Clean.\nJack` },
  { id: "review_request", section: "after", title: "Ask for a Google review", use: "A day or two after a happy client's clean.",
    text: `Hi {first}, thanks again for choosing Bardon Clean. If you were happy with the clean, a Google review would really help a small local business like ours:\n{review_link}\n\nJack` },
  { id: "issue_reply", section: "after", title: "Reply to a complaint", use: "They've raised something that wasn't right.",
    text: `Hi {first}, I'm sorry to hear that, and thanks for letting me know. Could you email a photo or two to hello@bardonclean.au so I can see exactly what needs fixing? I'll organise for the team to come back and sort it.\n\nJack` },
  { id: "inspection_check", section: "after", title: "After the bond inspection", use: "Bond cleans, once the final inspection should be done.",
    text: `Hi {first}, just checking in. Did the final inspection go smoothly? If the agent has raised anything, send it through and I'll take care of it.\n\nJack` },
  { id: "movein_offer", section: "after", title: "Offer a move-in clean", use: "Pre-sale or bond clients who are moving house.",
    text: `Hi {first}, good luck with the move. If you'd like your new place cleaned before you unpack, we do move-in cleans too. Happy to put a quote together whenever suits.\n\n${SIGN}` },
  { id: "regular_offer", section: "after", title: "Offer regular cleans", use: "A client who might want ongoing help.",
    text: `Hi {first}, if you'd like help keeping the place in shape, we also do regular cleans weekly, fortnightly or every four weeks. Happy to put a quote together if that's of interest.\n\n${SIGN}` },

  // ---- Invoices & payments ----
  { id: "hire_screen", section: "hiring", title: "Book a phone chat", use: "A new applicant looks worth a call.",
    text: `Hi {first}, it's Jack from Bardon Clean. Thanks for applying. Do you have 15 minutes for a quick phone chat this week? Let me know a time that suits.\n\nJack` },
  { id: "hire_trial", section: "hiring", title: "Offer a paid trial shift", use: "After a good phone chat.",
    text: `Hi {first}, thanks for the chat. I'd like to book you in for a paid trial shift working alongside me. I'll send the day, time and address once we've locked it in. Wear black shorts or tights and clean enclosed sneakers; the shirt, equipment and products are provided.\n\nJack` },
  { id: "hire_welcome", section: "hiring", title: "Welcome to the team", use: "They're joining. Send before the onboarding form and roster link.",
    text: `Hi {first}, welcome to Bardon Clean! Next I'll send your onboarding form (tax, super and bank details) and your link to the team roster, where you'll see and confirm your shifts.\n\nJack` },
  { id: "hire_decline", section: "hiring", title: "Not going ahead", use: "Letting an applicant know kindly.",
    text: `Hi {first}, thanks for your interest in working with Bardon Clean. We won't be going ahead this time, but I appreciate you taking the time to apply and wish you all the best.\n\nJack` },
  { id: "invoice_send", section: "payments", title: "Send an invoice", use: "Used when you send an invoice that isn't a deposit or a balance with a report.",
    text: `Hi {first}, here's invoice #{invoice_no} for {amount_due}:\n{invoice_link}\n\nThe link has the payment options. Thanks for choosing Bardon Clean.\nJack` },
  { id: "invoice_overdue", section: "payments", title: "Overdue invoice reminder", use: "Used when you send a reminder for an overdue invoice.",
    text: `Hi {first}, a friendly reminder that invoice #{invoice_no} for {amount_due} was due {due_date}. You can view and pay it here:\n{invoice_link}\n\nIf you've already paid, thank you, please ignore this.\n${SIGN}` },
  { id: "receipt_full", section: "payments", title: "Receipt, paid in full", use: "Used when you send a receipt that clears the invoice.",
    text: `Hi {first}, thanks for your payment of {paid}. Invoice #{invoice_no} is now paid in full. Your receipt:\n{receipt_link}\n\n${SIGN}` },
  { id: "receipt_part", section: "payments", title: "Receipt, part payment", use: "Used when you send a receipt and something is still owing.",
    text: `Hi {first}, thanks for your payment of {paid}. {balance} remains on invoice #{invoice_no}. Your receipt:\n{receipt_link}\n\n${SIGN}` },
];

const DEF = Object.fromEntries(DEFAULTS.map((t) => [t.id, t]));
const clean = (v, n) => (typeof v === "string" ? v.replace(/\r/g, "").slice(0, n) : "");

export async function loadTemplates(s) {
  const st = (await s.get("smstpl")) || {};
  const over = st.over || {};
  const list = DEFAULTS.map((t) => ({ ...t, text: over[t.id] ?? t.text, edited: over[t.id] != null && over[t.id] !== t.text, def: t.text }));
  for (const c of st.custom || []) list.push({ ...c, custom: true });
  return { list, reviewLink: st.reviewLink || "" };
}

// Returns the new state, or { error }.
export async function updateTemplates(s, b) {
  const st = (await s.get("smstpl")) || {};
  st.over ||= {}; st.custom ||= [];
  if (b.action === "save") {
    const text = clean(b.text, 1500).trim();
    if (!text) return { error: "The template is empty" };
    const c = st.custom.find((x) => x.id === b.id);
    if (c) { c.text = text; if (typeof b.title === "string" && b.title.trim()) c.title = clean(b.title, 80).trim(); }
    else if (DEF[b.id]) { if (text === DEF[b.id].text) delete st.over[b.id]; else st.over[b.id] = text; }
    else return { error: "That template doesn't exist" };
  } else if (b.action === "reset") {
    delete st.over[b.id];
  } else if (b.action === "add") {
    const title = clean(b.title, 80).trim(), text = clean(b.text, 1500).trim();
    if (!title || !text) return { error: "Add a name and the message" };
    const section = SECTIONS.some((x) => x[0] === b.section) ? b.section : "leads";
    if (st.custom.length >= 60) return { error: "That's the limit for your own templates" };
    st.custom.push({ id: "c" + Date.now().toString(36), section, title, use: "Your own template.", text });
  } else if (b.action === "delete") {
    st.custom = st.custom.filter((x) => x.id !== b.id);
  } else if (b.action === "review") {
    const v = clean(b.reviewLink, 300).trim();
    if (v && !/^https:\/\/\S+$/.test(v)) return { error: "Paste the full link, starting with https://" };
    st.reviewLink = v;
  } else return { error: "Unknown action" };
  await s.set("smstpl", st);
  return { ok: true };
}

// Fill a template. Mirrors BCTpl.fill in /lib/templates.js.
export function fill(text, vars) {
  const has = (k) => vars[k] != null && String(vars[k]).trim() !== "";
  const missing = [];
  const paras = String(text).split(/\n{2,}/).filter((p) => {
    const opt = [...p.matchAll(/\{(\w+)\?\}/g)].map((m) => m[1]);
    return opt.every(has);
  });
  let out = paras.join("\n\n").replace(/\{(\w+)\??\}/g, (m, k) => {
    if (has(k)) return String(vars[k]);
    if (!missing.includes(k)) missing.push(k);
    return `{${k}}`;
  });
  out = linksOnOwnLine(out);
  return { text: out.trim(), missing };
}

// Keep each link tappable: nothing glued to the end of a URL on its line.
export function linksOnOwnLine(t) {
  return t.split("\n").map((line) => line.replace(/(https?:\/\/[^\s]+?)([.,;:!?)\]]*)(\s+\S.*)?$/, (m, url, punct, rest) => (rest ? url + "\n" + rest.trim() : url))).join("\n");
}
