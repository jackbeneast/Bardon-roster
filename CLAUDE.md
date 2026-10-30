# Bardon Clean Hub

Jack's business hub for Bardon Clean: roster, team app, quotes and invoices, books, pay, messages, client and agent links, growth tools. Static pages in `public/`, Netlify functions in `netlify/functions/`, shared server code in `lib/`. Pushing to `main` deploys to bardon-roster.netlify.app.

## Keep the Hub Playbook current (required)

`public/guide/index.html` is Jack's user manual for the whole hub (Tools → Help → Hub playbook, at `/guide/`).

Every change that adds, removes, renames or changes how something works for Jack, his team, clients or agents must update the playbook **in the same commit**:

1. Edit the relevant topic (or add a new `<details class="t">` under the right section). Use the exact button and screen names from the UI, plain words, short steps.
2. Add a line at the top of "What's changed" (`#changes`): `<li><b>D Mon YYYY</b> · what changed, in a sentence.</li>`
3. Update "Last updated" near the top of the page.
4. If a new automatic ping or background job is added (e.g. in `netlify/functions/checks.mjs`), add it to "What happens automatically".

Pure bug fixes, styling and internal refactors with no visible change don't need a playbook edit.

## Copy rules for anything client-facing

- No promised quote turnaround times or quote-to-clean timeframes.
- Don't advertise the bond-clean return visit.
- Call checklist groups "areas", not "rooms".
- Never use "restored" or "restoration".
- No made-up statistics or unsourced claims.
- Nothing is sent to a client automatically unless Jack has switched that specific thing on.
