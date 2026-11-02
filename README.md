# BIM-mobile
 BIM wifi business mobile app

## UI design language

Tabs and record lists are shared primitives. Use them instead of ad-hoc tables so
rows never scroll horizontally on a phone.

- **Tabs**: `components/SegmentedTabs.tsx` — pill tabs that scroll horizontally
  on their own, with an optional count per tab (`count`).
- **Radio group**: `components/ThemedRadioButtons.tsx` — a single-choice list for
  forms (`options: { key, label, description }`, `value`, `onChange`). Rows carry
  a label plus a description of what the choice does, so it never looks like the
  tab strip above: pills switch views, radios pick one value.
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

## CI/CD

Two workflows live in `.github/workflows`:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | PRs, pushes to `develop`/`main` | `npm ci`, lint, tests. The type check is advisory while the pre-existing `InternetPackage` errors remain. |
| `android-release.yml` | push to `main`, or manual dispatch | builds a signed `.aab` and uploads it to Google Play |

### One-time setup

1. **Upload keystore** — generate it once and keep it backed up offline; Play
   validates every future upload against this key. Never commit it
   (`release.keystore` is already gitignored).

   ```bash
   keytool -genkeypair -v -keystore upload.keystore -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | `base64 -w0 upload.keystore` |
   | `ANDROID_KEYSTORE_PASSWORD` | keystore password |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | key password |
   | `PLAY_SERVICE_ACCOUNT_JSON` | raw JSON key of the Play Developer API service account |

3. **Google Play API access** — enable *Google Play Android Developer API* in
   Google Cloud, create a service account, then in Play Console → *Setup → API
   access* link that account and grant it release permissions for the tracks you
   deploy to.

4. **Optional repository variables**: `API_BASE_URL`, `COUNTRY_CODE`,
   `COUNTRY_NAME`, `PHONE_NUMBER_LENGTH`, `VERSION_CODE_OFFSET`,
   `RELEASE_TRACK` and `RELEASE_STATUS`. Defaults match production, with the
   release going to `internal` as a **draft**.

### Releasing

Releases run on every merge to `main`, and on demand from *Actions → Android
Release → Run workflow*.

- The first run uploads a **draft** to `internal` — the bundle is on Play but not
  rolled out, so you can inspect it before testers see it. Once the pipeline has
  proven itself, set the `RELEASE_STATUS` repository variable to `completed` so
  later merges roll out to internal testers automatically.
- Keeping `RELEASE_STATUS=draft` is also a valid policy: every merge lands as a
  draft and you release manually from the Play Console.
- `versionName` comes from `package.json` (`version`), so bump it when you want a
  release to read differently; `versionCode` is `VERSION_CODE_OFFSET +
  github.run_number`, so it always increases.
- Promoting from `internal` to production stays a manual step in Play Console.
- Raise the `VERSION_CODE_OFFSET` variable if the Play listing already has higher
  codes (it is `1000` by default and the current listing is at `1`).

Local release builds work unchanged: without an upload key configured, `release`
falls back to the debug keystore. To sign locally, point the same variables at
your keystore first:

```bash
# bash / macOS / Linux
BIM_UPLOAD_STORE_FILE=upload.keystore BIM_UPLOAD_STORE_PASSWORD=YOUR_STORE_PASSWORD \
BIM_UPLOAD_KEY_ALIAS=upload BIM_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD ./gradlew bundleRelease
```

```powershell
# PowerShell (Windows)
$env:BIM_UPLOAD_STORE_FILE='upload.keystore'; $env:BIM_UPLOAD_STORE_PASSWORD='YOUR_STORE_PASSWORD'
$env:BIM_UPLOAD_KEY_ALIAS='upload'; $env:BIM_UPLOAD_KEY_PASSWORD='YOUR_KEY_PASSWORD'
cd android; .\gradlew.bat bundleRelease
```

