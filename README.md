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
    wraps; set `fullWidth` for long values, or `trailing` for a compact chip —
    e.g. the `M`/`T` voucher-origin markers — that sits after the value without
    stretching the tile) and `actions` (buttons wrap under the fields, so a row
    with an action button never needs a horizontal scroll).
    Cards that are pure data carry every value as a `field` — the dashboard's
    recent transactions lead with the router name as the `title` and keep the
    credit/debit status in the `badge`. Action `tone`
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

   | Secret | Encoding | Value |
   | --- | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | base64 | `base64 -w0 upload.keystore` |
   | `ANDROID_KEYSTORE_PASSWORD` | plain | keystore password |
   | `ANDROID_KEY_ALIAS` | plain | `upload` |
   | `ANDROID_KEY_PASSWORD` | plain | key password |
   | `PLAY_SERVICE_ACCOUNT_JSON` | plain JSON | the whole `*.json` key file from step 3, pasted as-is |
   | `GOOGLE_SERVICES_JSON` | base64 or plain JSON | `base64 -w0 google-services.json` — the complete Firebase Android config, required for push in release builds |

   Only the two file blobs are base64 — `ANDROID_KEYSTORE_BASE64` because the
   workflow decodes it back to a keystore, and `GOOGLE_SERVICES_JSON` by
   convention (the workflow also accepts the raw file and validates it before
   the build). Use the full `google-services.json` downloaded from Firebase,
   not just an API key or another credential. The service account stays
   **raw JSON**: the Play upload action reads it as plain text
   (`serviceAccountJsonPlainText`), so a base64 value there would fail auth.

3. **Play service account** — this produces the `PLAY_SERVICE_ACCOUNT_JSON`
   value. It is a server credential that can publish to your listing, so treat
   it like a password and never commit it (the local copy lives in the
   gitignored `.env`):

   a. Google Cloud Console → the project that will own the uploader (the app's
      Firebase project works) → **IAM & Admin → Service accounts → Create
      service account**, e.g. `play-publisher`. No Cloud IAM roles are needed —
      Play permissions come from Play Console in step (d).
   b. Open the account → **Keys → Add key → Create new key → JSON**. The browser
      downloads `<project>-<key id>.json`; that file *is* the secret.
   c. **APIs & Services → Library → Google Play Android Developer API → Enable**
      for that project.
   d. Play Console → **Setup → API access** → link the Cloud project, then grant
      the service account release permissions for the app (*Users and
      permissions* → the account → *App permissions*): at minimum **Release to
      testing tracks**, plus **Release to production** if CI publishes there.
   e. Copy the downloaded JSON verbatim into the `PLAY_SERVICE_ACCOUNT_JSON`
      secret (multi-line is fine).

   If the key leaks, delete it in Cloud Console and repeat (b)–(e).

4. **Encoding the blob secrets** (Git Bash):

   ```bash
   base64 -w0 upload.keystore; echo        # ANDROID_KEYSTORE_BASE64
   base64 -w0 google-services.json; echo   # GOOGLE_SERVICES_JSON
   ```

   PowerShell — `[Convert]` is .NET, so this does not run in Git Bash:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path 'upload.keystore')))
   [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path 'google-services.json')))
   ```

   Add `| clip` (bash) or `| Set-Clipboard` (PowerShell) to copy the line
   without selecting it. A machine that already builds locally can read
   `ANDROID_KEYSTORE_BASE64` and `PLAY_SERVICE_ACCOUNT_JSON` straight out of the
   gitignored `.env`.

5. **Optional repository variables**: `API_BASE_URL`, `COUNTRY_CODE`,
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
- Google Play requires new uploads to target API 36 (Android 16). Expo SDK 53's
  React Native catalog still defaults to 35, so the level is pinned in
  `android/gradle.properties` (`android.compileSdkVersion`,
  `android.targetSdkVersion`, `android.buildToolsVersion`) and mirrored in the
  `expo-build-properties` block in `app.config.js` so an `expo prebuild` keeps
  it. Raise both together, and the `for package in …` list in the release
  workflow, when Expo ships a catalog that matches.
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

## Development builds

Expo Go cannot receive remote push notifications from SDK 53 onwards, and it
cannot load the Firebase config, so push only works in a development build (or a
release build). `expo-dev-client` is installed for this.

| Command | What it does |
| --- | --- |
| `npm run dev:android` | builds the debug/dev-client APK and installs it on the connected emulator or device |
| `npm run dev:ios` | same for the iOS simulator or a connected device |
| `npm run dev:start` | starts Metro for an already-installed dev build (no native rebuild) |
| `npm run android` / `npm run ios` | same build, with a picker when several devices are attached |

Expo CLI loads `.env` automatically, so `API_BASE_URL` (and the rest) come from
there — no `dotenv` wrapper needed. On Android, `android/app/google-services.json`
must exist before the build (see [Push notifications](#push-notifications)) or the
APK ships without FCM. Push also needs a device image with Google Play services;
a plain AOSP emulator has no FCM.

Gradle needs a JDK 17+, but an outdated machine-wide `JAVA_HOME` (a Java 8
folder, or the `bin` directory itself) makes every build die with
`JAVA_HOME is set to an invalid directory`. The Android scripts therefore run
through `scripts/with-java.js`, which finds a usable JDK and passes it to Gradle
only:

1. `BIM_JAVA_HOME`, 2. the current `JAVA_HOME` if it is a real JDK 17+, 3. Android
Studio's bundled JBR, 4. an installed JDK (Adoptium, Microsoft, `/usr/lib/jvm`, …),
5. whichever `java` is on `PATH`.

Check what it would pick with `node ./scripts/with-java.js --print`. To fix the
variable itself (so plain `./gradlew` works too), point it at the JDK root — not
its `bin` folder — and reopen the terminal:

```powershell
# Windows: machine-wide value needs an elevated shell; setx writes the user value
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr" /M
```

```bash
# macOS / Linux
export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
```

Installing the dev build over a Play-signed copy fails with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE: … signatures do not match`, because the
debug APK uses `debug.keystore`. Uninstall the store version once
(`adb uninstall com.muganwas.BIMmobile` — this also removes its data) or install
on an emulator.

### Cleartext HTTP on a LAN backend

`<domain>` entries in a network security config match **one literal host** — IPs
included — and the format has no wildcard or subnet syntax, so `192.168.1.*` is
not expressible. Instead, debug builds get their own config:
`network_security_config.debug.xml` is copied to
`android/app/src/debug/res/xml/network_security_config.xml`, where the debug
source set overrides the main resource with:

```xml
<base-config cleartextTrafficPermitted="true" />
```

That permits plain HTTP to any address while developing, so the backend can sit
on any `192.168.1.x`. Release builds keep the narrow list in
`network_security_config.xml` — add an address there only if a release build
must reach a fixed LAN host. `android:usesCleartextTraffic` is ignored on API 24+
while a network security config is present, so it is not an alternative.

A device plugged in over USB can skip the whole question with a reverse tunnel:
`adb reverse tcp:8000 tcp:8000`, then point `API_BASE_URL` at
`http://localhost:8000` (`localhost` is allowed in the release config too).

## Push notifications

The app registers each install with `POST /push-devices` and the backend fans
out over FCM.

- **Android** needs the Firebase config at `android/app/google-services.json`.
  It is gitignored, so copy `google-services.json` there after cloning; without
  it the `google-services` plugin is skipped and the build ships without push.
  The release workflow writes the file from the `GOOGLE_SERVICES_JSON` secret.
- **iOS** needs the *Push Notifications* capability and an APNs key uploaded to
  the Firebase project.
- The notification icon is `assets/images/notification-icon.png`, generated from
  the BIM wordmark by `scripts/make-notification-icon.ps1`.
