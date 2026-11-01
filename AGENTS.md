# BIM-mobile — conventions for contributors and coding agents

React Native / Expo app that mirrors the BIM web dashboard (`bim.sibuna.us`,
Laravel `BIM-radius`). Read this before adding screens or buttons so the app
stays visually and behaviourally consistent.

## Project layout

- `views/<Name>Screen.tsx` — the actual screen implementation.
- `app/(authenticated)/<route>.tsx` — thin route files that re-export a view
  (`export { default } from '@/views/...'`).
- `components/` — shared UI. `services/` — one module per API area.
- `types/index.ts` — API payload types (kept in sync with `backend-api.json`).
- `constants/Trans.ts` — all user-facing copy.

## Screen building blocks

| Need | Use |
| --- | --- |
| Scrolling screen body | `ParallaxScrollView` (supports pull-to-refresh) |
| Section container | `TileContainer` (`flat` inside a screen) |
| Record list | `RecordList` + `RecordCard` (`components/RecordList.tsx`) |
| In-screen tabs | `SegmentedTabs` (`components/SegmentedTabs.tsx`) |
| Modal / form | `OverlayContainer` (+ a per-form overlay in `views/`) |
| Destructive confirm | `Prompt` (`components/Prompt.tsx`) |
| Paging | `ListPagination` |

Nested screens get a header back chevron from `useHeaderBack(parentPath)`;
screens that sit directly under the Accounts hub use `useAccountsBack()`.

Overlays render through `components/Portal.tsx`. Its `mount`/`update`/`unmount`
must stay **synchronous** — they run from a child layout effect, so deferring
them (a `setTimeout`, animation frame, etc.) makes the portal render the previous
node for a macrotask. Any controlled input inside an overlay then flashes its
old value and silently drops characters when typed into quickly.

## RecordCard actions — always icon + label

Every action on a `RecordCard` must carry an icon. Text-only action buttons are
not allowed: the icon is what tells users at a glance that a tile is
interactive.

| Intent | `icon` | `tone` |
| --- | --- | --- |
| View / open a detail screen | `eye.outline` | `primary` |
| Create / add | `plus` | `primary` |
| Edit | `edit.outline` | `warning` |
| Delete / remove | `delete.outline` | `danger` |
| Approve / confirm | `check` | `success` |
| Anything else (secondary) | closest existing glyph (`cash`, `documents`, `packages`, …) | `neutral` or `info` |

`primary` resolves to the brand `bim` colour, so it is the default for buttons —
a card with a single action uses it. Only when several actions share a row do
the semantic colours (`warning`, `danger`, `success`) take over to tell them
apart.

The same icon names apply to `ThemedButton`'s `icon` prop (e.g. `icon='plus'`
on a create button).

Icons are restricted to `IconSymbolName` — the keys of `MAPPING` in
`components/ui/IconSymbol.tsx`. If a glyph is missing, add an entry there
(MaterialCommunity / Material / Ionicon) instead of inventing a name.

## Copy and translations

- Never hardcode user-facing strings in a component; add a key to
  `constants/Trans.ts` under the relevant category and read it via
  `translations[language].categories.<category>.<key>`.
- Keys are **flat** (`detailOverview`, not `detail.overview`): the
  `Translations` type only allows one level of nesting.
- Only `en` is complete; other languages are partial placeholders, so add new
  keys to `en` only.

## Data and API

- `backend-api.json` is the contract. Add request/response types to
  `types/index.ts` and put matching calls in `services/`.
- Follow the server's verb choices literally (some "updates" are `POST`, e.g.
  `POST /sites/{router}/access-points/{apId}`).
- Gate destructive or role-specific UI with the helpers in
  `helpers/permissions.ts`; the API is the real enforcement point.

## Validation

- `npm test` (Jest) and `npm run lint` (Expo ESLint).
- `npx tsc --noEmit` — the repo currently has 12 pre-existing
  `InternetPackage` type errors; do not add new ones.
- Do **not** run Prettier: the project has no Prettier config and the source is
  tab-indented, so Prettier rewrites whole files.
