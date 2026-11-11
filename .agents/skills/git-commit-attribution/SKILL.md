---
name: git-commit-attribution
description: How to author git commits and pushes in this repository — always as the user's own git identity, with no AI/agent attribution anywhere in the commit history.
---

# Git commit attribution

The user requires that every commit in this repository's history looks
like it was written by them personally. Agent/tool attribution is never
acceptable.

## Rules

- Commit using the repository's configured git identity
  (`git config user.name` / `user.email`). Never override it, and never
  invent an author.
- Do NOT add any of the following to commit messages or trailers:
  - "Generated with ..." lines
  - `Co-Authored-By:` trailers naming an agent, bot, or AI tool
  - Any mention of Devin, Cognition, Claude, GPT, Copilot, or similar
  - Tool names, session IDs, or "AI-assisted" disclaimers
- Keep commit messages in the repository's existing style: a concise
  imperative subject line, optionally a short body explaining *why*.
- Do not amend or rewrite existing commits to strip attribution unless
  the user explicitly asks for it.
- Only commit and push when the user asks (or when a standing
  instruction for the current task says to).

## Example

Good:

```
git commit -m "Add per-set weight and reps targets to routines"
```

Bad:

```
git commit -m "Add feature

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <...>"
```
