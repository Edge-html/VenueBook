# 📸 Your images go here

**Copy your photos into this folder** (`public/images/`) using the file names
below. That is all you need to do — no code changes.

```
public/images/
├── knchs-building.jpg    ← landing page hero background
├── gymnasium.jpg         ← Gymnasium card
├── avr.jpg               ← AVR card
└── placeholders/         ← do not touch, used until you add the real files
```

The site checks this folder when it builds, so a file that isn't here is never
requested (no broken-image icons in the console) and `placeholders/` is shown
instead. **Add your photos one at a time** — each one is picked up on the next
deploy without affecting the others.

## Recommended sizes

| File                 | Size        | Shape      |
| -------------------- | ----------- | ---------- |
| `knchs-building.jpg` | 1920×900+   | landscape  |
| `gymnasium.jpg`      | 800×450     | landscape  |
| `avr.jpg`            | 800×450     | landscape  |

JPG, PNG, or WEBP all work. Keep each file **under ~400 KB** so pages stay fast.

## After adding them

Push to GitHub — Vercel rebuilds and picks them up automatically. To preview
locally instead:

```bash
npm run build && npm run start
```

`npm run dev` will not show new images until you restart it, because the
folder is only scanned at build time.

---

Need a different size or a different file name? Change it in
`src/lib/constants.ts` (`HERO_IMAGE` and `FACILITIES`).