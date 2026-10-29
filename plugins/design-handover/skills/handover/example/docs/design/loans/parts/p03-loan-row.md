**Status** binding · **Life** living · **Reader** whoever builds a row in the loans list

## P03 · LoanRow

1. **Purpose** — one borrowed tool: what, who, when it's due, its status, and the one thing you can
   do about it.

2. **Anatomy** — in DOM order: tool name (link) · borrower line · *[note line, if any]* · due date ·
   status pill (P01) · Mark returned (existing secondary button).

3. **States** — default · hover · focus-within · returning (after confirm, before the server
   replies) · not-permitted (no *returns* role). *selected · disabled · empty · loading · error*: n/a
   for the row itself; list-level empty/loading/error are `B01`–`B03`.

   **Content shapes:** *standard* · *with note* (adds a line under the borrower: e.g. "Charger
   missing", `--type-sm` `--color-warn`, max one line, truncates).

4. **Values**

   | Element | Values |
   |---|---|
   | Row | grid: `1fr 180px 120px 120px`, gap 16px, padding 12px 0, bottom border 1px `--color-line`. Min height 68px (standard), 86px (with note) |
   | Row hover | background `--color-surface-weak` (`T01`) |
   | Tool name | `--type-base` UI 15/22 weight 600, `--color-ink`; one line, ellipsis; underline on hover only |
   | Borrower line | `--type-sm` UI 13/18 `--color-muted`: "{name} · #{member no.}", member no. in mono |
   | Due date | `--type-sm` **mono** 13/18 `--color-ink`, "Due {d MMM}" |
   | Returning | whole row opacity 0.5, button label "Returning…", button disabled |

5. **Interaction** — tool name opens the loan detail page. *Mark returned* opens the existing confirm
   dialog (`B05`). On confirm the row enters *returning*, then leaves the list (unless the
   *Returned this week* filter is on, where it re-appears with the *returned* pill).

6. **Keyboard** — two tab stops per row, in DOM order: tool name, then Mark returned. The row is not
   a tab stop. Owner: each element; the list adds nothing.

7. **Breakpoints** — at 375 the row stacks: tool name / borrower / note on top; due date and pill on
   one line below; **Mark returned is removed from the row** and moves to the detail page (`B08`).

8. **Failure states** — return fails: row returns to default and the existing toast shows "Couldn't
   mark as returned. Try again." Reached by the return request failing.

9. **Reuse** — built from P01 and the existing secondary button. Used in LoanList.

10. **Open** — `B08`: whether removing the button at 375 strands volunteers who only use phones.
