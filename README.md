# BIM-mobile
 BIM wifi business mobile app

## UI design language

Tabs and record lists are shared primitives. Use them instead of ad-hoc tables so
rows never scroll horizontally on a phone.

- **Tabs**: `components/SegmentedTabs.tsx` — pill tabs that scroll horizontally
  on their own, with an optional count per tab (`count`).
- **Lists**: `components/RecordList.tsx`
  - `RecordList` renders the list shell with loading/empty states and an optional
    header action (`title`, `description`, `headerAction`, `loading`, `isEmpty`).
  - `RecordCard` renders one record: optional `title`/`subtitle`, `badge` (status
    pill), `fields` (compact two-column grid of inline label/value pairs that
    wraps; set `fullWidth` for long values) and `actions` (buttons wrap under the
    fields, so a row with an action button never needs a horizontal scroll).
    Cards that are pure data — e.g. transactions — omit `title`/`subtitle` and
    carry every value (including the site/router name) as a `field`. Action `tone`
    keeps the app's colour coding: `primary` (the brand `bim` colour) for
    view/open and for single-action cards, `warning` (yellow) for edit, `danger`
    (red) for delete/block, `success` (lime) for approve/confirm,
    `info`/`neutral` for everything else.
  - Every action button pairs an **icon with its label** — text-only actions are
    not allowed, the icon is what signals a tile is interactive. `view` uses
    `eye.outline`, `edit` uses `edit.outline`, `delete` uses `delete.outline`,
    create uses `plus`, and `view` keeps the brand `bim` colour through
    `tone: 'primary'`. The full table lives in [AGENTS.md](./AGENTS.md#recordcard-actions--always-icon--label).
- **Screen header**: every screen starts with a `ScreenHeader`
  (`components/ScreenHeader.tsx`) in its **own** `TileContainer`, then its content
  in separate tile(s) below — never as the first rows of the content tile. The
  component renders the title, an optional `description`, a `loading` spinner and
  an optional `action` on the right; pass extra header content (tabs, a second
  button row) as `children`. `RecordList` inside a screen should not repeat the
  page title — its `title`/`description` are for sub-lists within a screen.
- Every list sits on one elevated container: wrap `RecordList` in a
  `TileContainer`, unless the list already lives inside one (e.g. the dashboard
  transactions and the router-details tab panels).
- `TileContainer` is flat: white background plus a 1px border, no shadow. Tiles
  span the content area, whose `paddingHorizontal` is 10 — never add an extra
  `marginHorizontal` to a tile or its wrapper.
- Parent/container tiles (list wrappers, tab panels) pass `flat`; the child tiles
  they hold (record cards, package cards) stay raised with the default soft shadow.
- Lists on tabs share a single elevated container for the tab panel — do not give
  each list inside a tab its own tile (see `packages-tab-panel` and the
  router-details tile).
- A list's title and description belong inside the tile with the list (pass
  `title`/`description` to `RecordList` instead of rendering text above it) so the
  header and rows read as one group.
- Screens that render a list must scroll: use `ParallaxScrollView` and pass
  `onRefresh`/`refreshing` for pull-to-refresh.
- All copy goes through `constants/Trans.ts` (`translateWithVariables` for
  strings with placeholders); never inline strings in a screen.
