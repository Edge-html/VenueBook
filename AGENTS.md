<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Always push to GitHub

The user wants every change committed and pushed to GitHub after each prompt.

- Remote is `origin` (`https://github.com/Edge-html/VenueBook.git`), branch `main`.
- Before committing: run `tsc --noEmit`, `eslint .`, and `next build`. Do not push
  a red build — fix it first.
- `npm`/`npx` are blocked by PowerShell execution policy on this machine. Call the
  binaries directly instead:
  `& "C:\Program Files\nodejs\node.exe" ".\node_modules\typescript\bin\tsc" --noEmit`,
  `& "C:\Program Files\nodejs\node.exe" ".\node_modules\eslint\bin\eslint.js" .`,
  `& "C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" build`.
- Note: `next lint` no longer exists in Next 16 — use the `eslint` binary.
- Commit message style in this repo: imperative sentence case, no trailing period
  ("Replace one-shot reads with live Firestore subscriptions").
- Never commit `.env.local`, `.next/`, or `node_modules/`.
