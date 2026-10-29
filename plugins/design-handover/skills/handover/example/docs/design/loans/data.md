**Status** §1 illustrative · §2–§3 binding · **Life** living · **Reader** whoever writes the fixtures
and seed data

# Loans: example content and test data

## 1 · Where the examples came from

The four rows in the design are made up. **No example value is a requirement:** "Cordless drill
(18V)" is not a real tool and `#0412` is not a real member.

## 2 · Test data that must exist

Every state in the part files must be reachable from seed data:

| Must exist | Reaches |
|---|---|
| at least one loan due later than today | P01 *on-loan* |
| at least one loan due today | P01 *due-today*, P02 count > 0 |
| at least one loan overdue by 5+ days | P01 *overdue*, B06 ordering |
| at least one loan returned this week | P01 *returned*, the *Returned this week* filter |
| at least one loan with a note | P03 *with note* |
| a tool name longer than 40 characters | P03 truncation |
| a filter with **zero** loans (e.g. no overdue loans in one fixture) | P02 *zero-count*, B01 empty state |
| a fixture with **no loans at all** | B02 |
| a volunteer without the *returns* role | P03 *not-permitted* |

## 3 · Wording

| Where | Text |
|---|---|
| Empty, all | Nothing's out right now. [Browse tools] |
| Empty, a filter | Nothing {due today / overdue / returned this week}. 🎉 |
| Return failed | Couldn't mark as returned. Try again. |
