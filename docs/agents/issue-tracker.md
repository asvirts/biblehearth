# Issue tracker

This repo's issue tracker is **GitHub Issues on `youversion/biblehearth`**. Skills that
read or write tickets (`wayfinder` and anything else that asks for "the issue tracker")
use it and nothing else. Refer to issues by title in anything a person reads; the
number and URL ride inside the title's link.

Agents in Claude Code cloud sessions have no `gh` CLI. They use the GitHub MCP tools
(`mcp__github__*`), which act as the signed-in GitHub user. Local sessions with `gh`
can do the same operations with `gh issue` and `gh api`.

## Labels

Already created on the repo:

| Label | Meaning |
| --- | --- |
| `wayfinder:map` | The map: one index issue per effort |
| `wayfinder:research` | AFK research ticket |
| `wayfinder:prototype` | HITL prototype ticket |
| `wayfinder:grilling` | HITL grilling ticket |
| `wayfinder:task` | Task ticket, HITL or AFK |

## Wayfinding operations

**Create the map.** `issue_write` with `method: create`, `labels: ["wayfinder:map"]`,
and the map body from the wayfinder skill.

**Create a ticket.** `issue_write` with `method: create`, `parent_issue_number: <map>`
and one `wayfinder:<type>` label. That creates the issue and attaches it as a GitHub
sub-issue of the map in one call. To attach an existing issue instead, use
`sub_issue_write` with `method: add`. It takes the issue's `id`, not its number.

**List a map's tickets.** `issue_read` with `method: get_sub_issues` on the map.

**Comments are the record.** Several sessions may work one map at once, and
`issue_write` replaces an issue's whole body, so two sessions editing the same body
can erase each other's change without either noticing. Comments are append-only and
totally ordered, so nothing posted as a comment can be lost that way. Every piece of
state that sessions share (claims, releases, blocking edges, answers, rulings) is
therefore recorded as a comment. Issue bodies and the map's lists are views for
people to read, and any session that finds one out of date repairs it from the
comments.

**Claim a ticket.** Every session acts as the same GitHub user, so the assignee
alone can't tell two sessions apart. Claim in three steps, before any other work:

1. `issue_write` with `method: update` and `assignees: [<driver>]`. The driver is the
   person running the map, `asvirts` unless the map's Notes name someone else.
2. Post a comment with `add_issue_comment` that reads `Claimed by <session URL>`.
3. Read the comments back with `issue_read` `method: get_comments`. A claim is
   active until a release frees it (see **Release a claim**). The oldest active claim
   holds the ticket. If it isn't yours, post `Released <link to your claim comment>: lost claim`,
   then leave the ticket alone and pick the next one on the frontier.

**Release a claim.** Post `Released <link to the claim comment>: <why>`. A release
that links to the claim holding the ticket frees every claim posted before it, so a
losing session that died before releasing can't leave its claim behind. A release
that links to any other claim frees only that one, so a late release from a stale
session can't clear a newer claim. Release the holding claim when a session stops
before resolving its ticket, when the person driving the map frees a ticket whose
session died, and when anyone reopens a closed ticket.

**Block a ticket.** Post `Blocked by #<n>` on the blocked ticket, one comment per
edge. When charting, wire the edges in a second pass, once every ticket has a
number. To remove an edge, post `Unblocked from #<n>: <why>`. For each blocker, the
newer of those two comments decides whether the edge stands.

Two views mirror the comments:

- The ticket body's `## Blocked by` section, for people reading the issue:

  ```markdown
  ## Blocked by

  - #12
  - #15
  ```

- GitHub's native issue dependencies ("Blocked by" in the issue sidebar), so the
  frontier shows up in GitHub's UI. The MCP tools can't read or write those, so a
  cloud session asks the person driving the map to add or remove each sidebar link.
  Where `gh` is available, run
  `gh api repos/youversion/biblehearth/issues/<n>/dependencies/blocked_by -f issue_id=<blocker id>`
  to add one, or
  `gh api -X DELETE repos/youversion/biblehearth/issues/<n>/dependencies/blocked_by/<blocker id>`
  to remove one.

Anyone who changes a blocker in the sidebar or the body also posts the comment, or
sessions won't see the change.

**Find the frontier.** Get the map's sub-issues and read each open one's comments.
Keep the tickets that have no active claim and whose standing blockers are all
closed with `state_reason: completed`. A blocker closed as `not_planned` doesn't
count as done: the ticket it blocks stays off the frontier until someone resolves
the edge (see **Rule a ticket out of scope**). Take the frontier in sub-issue order.
If a ticket's `## Blocked by` section doesn't match its comments, rewrite the
section from the comments.

**Resolve a ticket.** Post the answer with `add_issue_comment`, then close it with
`issue_write`: `state: closed` and `state_reason: completed`. Then add its line to
the map's **Decisions so far** (see **Update the map**).

**Rule a ticket out of scope.** Post the ruling with `add_issue_comment`: the gist
and why it's beyond the destination. Close the ticket with `state_reason: not_planned`
and add one line to the map's **Out of scope** section. Then find every ticket with
a standing edge to it. For each one, either post `Unblocked from #<n>: <why>` (the
work doesn't depend on it after all) or rule that ticket out of scope too.

**Update the map.** The map's lists are views of the closed tickets:

1. Re-read the map body right before you write, and change only the lines you're
   adding or editing.
2. After writing, read it back and check that your line is there.
3. Each time you load the map, compare **Decisions so far** with the map's sub-issues
   closed as `completed`. Restore the line for any that's missing, gisted from the
   ticket's resolution comment. Do the same for **Out of scope** and the tickets
   closed as `not_planned`, using the ruling comment.
4. The prose sections (**Destination**, **Notes**, **Not yet specified**) have no
   tickets to rebuild them from. Before editing one, post a `Map edit: <what changed>`
   comment on the map. Each time you load the map, check that every `Map edit`
   comment is reflected in the body. Re-apply the missing ones in order, skipping any
   that a later `Map edit` supersedes.

**Assets.** Link them from the issue: a branch, a PR, or a file in the repo. Research
findings go on a throwaway `research/<name>` branch, linked from the ticket. A cloud
session that may push only to its one assigned branch writes them to
`docs/research/<effort>/<name>.md` on that branch instead. The map's Notes and each
ticket's resolution name the branch and link the file on it
(`https://github.com/youversion/biblehearth/blob/<branch>/docs/research/...`), so the
link works before the branch merges. Parallel research subagents each write their own file and leave
committing to the session that spawned them, so they don't race on one branch.

## Skill names in Claude Code cloud sessions

Observed in cloud sessions on 2026-09-26. Installed skills vary by session and
machine, so check the session's skill list first and treat this as a hint, not a rule.

- `wayfinder` is installed as `anthropic-skills:wayfinder`. The
  `mattpocock-skills:` prefix isn't installed.
- No `domain-modeling` skill was installed. Where wayfinder calls for "grilling" and
  "domain-modeling" and only grilling is available, run `anthropic-skills:grilling`
  alone.
- `research` is `anthropic-skills:research`.

## Maps

| Map | Destination |
| --- | --- |
| [Map: Grow organic search traffic to BibleHearth](https://github.com/youversion/biblehearth/issues/19) | A ranked SEO roadmap with each workstream's approach decided |
