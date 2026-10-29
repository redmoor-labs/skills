**Status** binding · **Life** living · **Reader** whoever builds Loans, whenever the picture doesn't
say

# Loans: the questions a picture can't answer

Answered by the owner in review, 29 Oct, unless a citation closes it.

| ID | Question | Answer | Source |
|---|---|---|---|
| B01 | When a filter has **0** loans, is its chip inert or still pressable? | **Pressable.** Pressing it shows the empty state for that filter ("Nothing overdue. 🎉"). Greying it out would hide good news. | owner |
| B02 | What does the list show when there are **no loans at all**? | One line, "Nothing's out right now.", and a link to Tools. No illustration. | owner |
| B03 | If the counts fail to load but the list loads, what happens? | List shows normally; chips show no numbers (P02 *loading*). No error message: the counts are a nice-to-have. | owner |
| B04 | **How many** filters can be selected at once? Can none be selected? | **Exactly one**, always. *All* is the default. The band owns selection. | owner |
| B05 | Does *Mark returned* need a confirm? | Yes, the existing confirm dialog: "Mark the {tool} as returned by {name}?" | existing ADR-004 (all state changes confirm) |
| B06 | What order is the list in? Can the user change it? | Overdue first (most overdue at the top), then due today, then by due date. **Not user-sortable.** | owner |
| B07 | Can a loan have no due date or no status? | No. Due date is required at checkout; status is derived from it. | data model |
| B08 | At 375, *Mark returned* is removed from the row. **Is there another route?** | **Open.** The detail page has it, so there is a route, but it's two taps instead of one. Owner to check with the Saturday volunteers, who mostly use phones. | open: owner, by 5 Nov |
