# WAVIVI — New painted icons needed

Open this file in Word (`File → Open → All files (*.*)` then pick this
`.md`) or paste the contents into a blank Word doc. Each row describes
one painted asset still missing from the brand canon.

The file emoji column shows what the app falls back to today. After you
ship a painted PNG for an entry, drop the same file into all three
theme folders:

- `public/icons/rustic/<name>.png` — Light Rustic / default
- `public/icons/sketch/<name>.png` — Sketch theme
- `public/icons/journal/<name>.png` — Journal theme

`ThemeImgSwap` retargets `/icons/rustic/<name>.png` → `/icons/sketch/<name>.png`
/ `/icons/journal/<name>.png` automatically at runtime, so no code
change is needed once the PNGs land at the matching path.

If you don't ship all three variants, the missing themes fall back
gracefully to the rustic original via `ThemeImgSwap`'s `onError`
handler — no broken icons.

---

## Icons to make

| # | Proposed filename | Today (emoji) | Where it's used | Notes for the artist |
|---|---|---|---|---|
| 1 | `facebook.png` | 📘 | Admin channel column header in `/admin/stays`, `/admin/eat`, `/admin/experiences`, `/admin/toolbox/[regionId]` (stays/restaurants/experiences/utilities-list channel pills + chips) | Match the `instagram_badge.png` size + treatment (already shipped) so the FB + IG pair reads as a set. |
| 2 | `phone.png` | 📞 | Same 4 admin channel surfaces as #1 | Single line-art handset; match the painted `mail.png` weight. |
| 3 | `ticket.png` | 🎟️ | `/list-with-travejor` partner-type pills + `group-editor.tsx` group-category metadata | Single torn-edge ticket. Used in two places, one shape works. |
| 4 | `bed.png` | 🛏️ | `/list-with-travejor` partner-type pill (Stays category) | Travel bed / sleeping silhouette. We already have `hostel.png` if you'd prefer to reuse — let me know. |
| 5 | `sunrise.png` | 🌅 | `experience-editor.tsx` time-of-day picker (morning option) | Half sun above horizon line. Pair with #6. |
| 6 | `moon.png` | 🌙 | `experience-editor.tsx` time-of-day picker (night option) | Crescent moon. Pair with #5. |
| 7 | `sunset.png` | 🌅 | `card-image.tsx` image-fail fallback for venue cards (currently shows 🌅 emoji) | Could be the same art as `sunrise.png` if the orientation isn't an issue. |
| 8 | `arrow_up.png` | ▲ | `admin/stat-card.tsx` trend indicator (positive) | Optional — typographic ▲/▼ is acceptable. Only commission if the artist wants a consistent painted set for admin charts. |
| 9 | `arrow_down.png` | ▼ | `admin/stat-card.tsx` trend indicator (negative) | Pair with #8. |
| 10 | `target.png` | 🎯 | `where-to-next/questionnaire.tsx` step header (goal selection) | Bullseye / dartboard. Used once. |
| 11 | `thumbs_down.png` | 👎 | `admin/experiences-list.tsx` rating display | We already have `thumbs_up_orange.png`; make the down variant in the same style. |
| 12 | `vibe_party.png` | 🎉 | `vibe-map.tsx` vibe-glyph map markers | Part of a 5-icon vibe set — see #12–#16. |
| 13 | `vibe_chill.png` | 🌿 | `vibe-map.tsx` vibe-glyph map markers | Leaf / calm. |
| 14 | `vibe_nightlife.png` | 🌙 | `vibe-map.tsx` vibe-glyph map markers | Different visual from #6 — this one needs the "going out" energy, not "bedtime." |
| 15 | `vibe_fire.png` | 🔥 | `vibe-map.tsx` vibe-glyph map markers | "Hot spot" / trending. |
| 16 | `vibe_social.png` | 🥂 | `vibe-map.tsx` vibe-glyph map markers | Clinking glasses / social cheers. |

---

## Reuse candidates (already painted — no new art needed)

These came up in the audit but already have a viable painted match in
the canon. Just need wiring (already shipped or trivial):

- 🎉 group-editor "event" category → `23_success.png` (already wired in the notification row + group-editor warning commit)
- 🗓️ calendar prefixes → existing `calendar.png` (will replace in a follow-up if you want)
- 🎒 backpack rating → existing `backpack_filled.png`
- 🌐 website channel → already wired to `globe.png`
- 📍 location prefixes → all wired to `01_map_pin.png`
- ⚠️ warnings → all wired to `24_warning.png`
- 🚫 missing photo placeholder → wired to `close_x.png`
- 📷 instagram → wired to `instagram_badge.png`
- ✉️ email → wired to `mail.png`
- 💬 chat → wired to `01_chat_bubble.png`
- 🧭 compass → wired to `07_compass_ring.png`

---

## Once a new icon lands

1. Drop all three theme PNGs into the corresponding `/public/icons/<theme>/`
   folder with the **same filename** in each.
2. If the icon is referenced through `<Icon name="...">`, also add a
   row to `RUSTIC_ICONS` in [`src/lib/rustic-icons.ts`](../src/lib/rustic-icons.ts)
   so the typed icon system picks it up.
3. The emoji fallback in the codebase can then be removed in a small
   follow-up commit — search for the emoji to find every reference.

Ping me with which group you want shipped next and I'll wire it through.
