# Venue photos

The site ships with on-brand SVG placeholders in `placeholders/`, so there are
no broken images while you collect real photos.

Drop your files in this folder using exactly these names and they will be used
automatically on the next build — no code changes needed:

| File                 | Used by                                    |
| -------------------- | ------------------------------------------ |
| `knchs-building.jpg` | Landing page hero background               |
| `gymnasium.jpg`      | Gymnasium card                             |
| `avr.jpg`            | AVR card                                   |

Candidates are checked against disk while the page is generated, so a missing
file is never requested. The placeholder is only used when the real photo is
absent.

Recommended sizes:

- `knchs-building.jpg` — 1920×900 or wider, landscape
- `gymnasium.jpg` — 800×450, landscape
- `avr.jpg` — 800×450, landscape

JPG, PNG, or WEBP all work. Keep each file under ~400 KB so the page stays fast.