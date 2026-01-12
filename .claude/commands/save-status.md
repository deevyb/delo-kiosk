---
description: Save session progress to documentation before ending work
allowed-tools: Read, Edit, Write, Bash, Grep
---

Save all session progress so the next session can continue seamlessly.

## Steps

1. **Check git status** — Run `git status` to see what's changed

2. **Update .claude/rules/status.md** with:
   - "Last Updated" date
   - Current route/feature statuses
   - "What's Next" with specific actionable steps
   - Any blockers or pending decisions

3. **Update TECHNICAL.md** (only if schema, API, or architecture changed)

4. **Commit and push** — Single commit with message summarizing the session's work

## Output

End with a brief summary:
- What was accomplished
- What's next
- Any uncommitted changes or blockers

Do NOT ask for confirmation — just execute all steps and report results.
