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
| Screen title / description | `ScreenHeader` (`components/ScreenHeader.tsx`) |
| Scrolling screen body | `ParallaxScrollView` (supports pull-to-refresh) |
| Section container | `TileContainer` (`flat` inside a screen) |
| Record list | `RecordList` + `RecordCard` (`components/RecordList.tsx`) |
| In-screen tabs | `SegmentedTabs` (`components/SegmentedTabs.tsx`) |
| One value out of a few (form) | `ThemedRadioButtons` (`components/ThemedRadioButtons.tsx`) |
| Modal / form | `OverlayContainer` (+ a per-form overlay in `views/`) |
| Destructive confirm | `Prompt` (`components/Prompt.tsx`) |
| Paging | `ListPagination` |

Every screen opens with its own header tile, separated from the content below:

```tsx
<ScreenHeader
  id='reports-header'
  title={t.title}
  description={t.description}
  loading={loading}
  action={canCreate ? <ThemedButton title={t.create} icon='plus' … /> : undefined}
/>

<TileContainer id='reports-tile' flat backgroundColor={background} …>
  {/* content */}
</TileContainer>
```

The header is a **sibling tile**, never the first rows of the content tile, and
`RecordList` inside a screen does not repeat the title (`title`/`description`
there are for sub-lists within a screen).

Nested screens get a header back chevron from `useHeaderBack(parentPath)`;
screens that sit directly under the Accounts hub use `useAccountsBack()`.
Top-level drawer destinations (`home`, `access`, `banks`, …) call neither — the
header keeps its drawer button. A new drawer link needs three entries in
`app/(authenticated)/_layout.tsx`: the route in `allowedRoutes`, an icon in the
`switch`, and a `<Drawer.Screen name='…' />`, plus a
`categories.navigation['<route>']` label. Role-specific links are added to
`allowedRoutes` conditionally (e.g. `payment-gateway` and `broadcasts` only
when `isPlatformAdmin(user)`).

The app-bar search (`components/Header.tsx`) is a **feature search**: it lists
screens the current user may open and navigates to the one that is picked. The
catalog lives in `helpers/featureSearch.ts` — add an entry there (with its
`audience`: `everyone`, `staff` or `admin`, and optional `keywords`) plus
`features['<id>.label']` / `features['<id>.description']` in
`constants/Trans.ts` so a new screen can be found by name, by what it does, or
by a synonym (e.g. "sms" → Broadcast).

`SegmentedTabs` switches *what a screen shows* (tab panels, filters); a
single-value form field uses `ThemedRadioButtons`, whose rows carry a label and
a description. Never render pills for a radio choice — they read as tabs.

Overlays render through `components/Portal.tsx`. Its `mount`/`update`/`unmount`
must stay **synchronous** — they run from a child layout effect, so deferring
them (a `setTimeout`, animation frame, etc.) makes the portal render the previous
node for a macrotask. Any controlled input inside an overlay then flashes its
old value and silently drops characters when typed into quickly.

`OverlayContainer` owns the keyboard handling: it reserves keyboard space at the
bottom of its container (Android runs edge-to-edge, so `adjustResize` no longer
shrinks the window) — a centred card lifts only as far as the keyboard requires,
so a short form never floats high above it. It also keeps the keyboard up while
its `ScrollView` scrolls and scrolls the focused input into view. Do not add a
`KeyboardAvoidingView` or another keyboard-inset padding inside an overlay — the
keyboard gets counted twice and leaves a screen-sized gap under the content.

It also renders the card's close affordance: pass `onRequestClose` and a labelled
X appears in the top-right corner, wired to that handler, so Cancel at the
bottom of a long form is never the only way out. Opt out with
`showCloseButton={false}` when the card supplies its own close control or the
card is not full width (e.g. `Prompt`).

## RecordCard actions — always an icon

Every action on a `RecordCard` must carry an icon. Text-only action buttons are
not allowed: the icon is what tells users at a glance that a tile is
interactive.

Row actions that mirror the web's icon-only table buttons pass `iconOnly`: the
glyph stays, the visible text is dropped, and `label` becomes the accessible
name (`RecordCard` hands it to `ThemedButton` as `accessibilityLabel`). The
vouchers list uses that mode with the web's colours — edit `info`, reset
`neutral`, disable `primary`, delete `danger`, enable `success` — on a row of
equal-width icon buttons.

Page-level actions belong in the **header container**, not in a floating row
between the header and the content: pass a single button as `ScreenHeader`'s
`action`, or a row of them as `children`. Every header action also carries an
icon (`plus` for create, `documents`/`printer` for exports, `refresh` for
retry, …). Form submit/reset buttons stay with the form they submit.

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
- Modal card titles are **Title Case** (`Create Router`, `Withdraw Funds from
  Router`, `Generate Bulk Vouchers`) — short articles and prepositions stay
  lowercase, matching the web dashboard. Body copy, hints and prompts stay
  sentence case.

## Data and API

- `backend-api.json` is the contract, but the Laravel handlers win when they
  disagree. `ApiResponse::paginated()` (used by `/sites`, `/transactions`,
  `/disbursement-records`, …) returns `{ success, message, <key>: [...rows],
  <key>_metadata: { current_page, last_page, total, … } }` with **no** `data`
  wrapper, even where the spec shows a nested paginator.
  `ApiResponse::success($message, $payload)` splices `$payload`'s keys at the
  top level the same way, so a documented `data` object is usually read as
  `getApiData(body)?.payment_provider` (e.g. `/admin/payment-provider`), not as
  `body.data`.
- Read payloads with `getApiData(body)` and paging with
  `getApiPagination(body, key)` / `getPageInfo(body, key)` from
  `helpers/apiResponse.ts`; they accept the top-level, `data`-nested and legacy
  `*_meta` / `*_metadata` shapes. Never hand-roll `body.data.x.data`.
- Add request/response types to `types/index.ts` and put matching calls in
  `services/`.
- Follow the server's verb choices literally (some "updates" are `POST`, e.g.
  `POST /sites/{router}/access-points/{apId}`).
- Gate destructive or role-specific UI with the helpers in
  `helpers/permissions.ts`; the API is the real enforcement point.

## Push notifications

The backend fans out over FCM, so the app registers its own device token with
`POST /push-devices`; it never talks to Expo's push service.

- `hooks/usePushNotifications.ts` is mounted by
  `app/(authenticated)/_layout.tsx`. It asks for the OS permission, opens the
  Android `default` channel, posts the device token, re-posts it when the token
  rolls, and on a tap opens the route in the payload's `link.app`
  (`helpers/pushNotifications.ts` resolves it; unknown or stale links land on
  `/(authenticated)/notifications`).
- Push only works in a development or release build — Expo Go dropped remote
  notifications in SDK 53, so the hook bails out there with a pointer to
  `npm run dev:android` / `dev:ios`. `expo-dev-client` is installed for this;
  `npm run dev:start` re-attaches Metro to an already-built client.
- The Android scripts run through `scripts/with-java.js` so a stale machine
  `JAVA_HOME` cannot break the build; never hardcode a JDK path in a committed
  file.
- LAN cleartext HTTP is a debug-only allowance: `network_security_config.debug.xml`
  overrides the main network security config for the `debug` source set. Android
  network security configs match literal hosts only (no `192.168.1.*`), so never
  widen the main config just to reach a new dev address.
- `GeneralContext.handleLogout` calls `DELETE /push-devices/{id}` before the
  bearer token is dropped. The token identifies the install, so skipping this
  leaves the next user receiving the previous user's pushes.
- The header bell and `views/NotificationsScreen.tsx` read `GET /inbox`, mapped
  into the `notifications` state by `GeneralContext.fetchNotifications`. `/inbox`
  is the caller's own approval/decision feed — `/notifications` is the
  paid-customer transaction log and is a different list.
- `fetchNotifications` re-runs when the bearer token arrives (login) or rotates;
  while authenticated a 60s timer polls `GET /inbox/unread-count` for the bell
  badge, so a push delivered to another device is still reflected. Opening the
  bell reloads the list. Opening a row (bell dropdown or list) marks it read
  with `POST /inbox/{id}/read`; the list's "mark all read" action uses
  `POST /inbox/read-all`.
- `components/ApprovalBanners` mirrors the web dashboard's Pending Approvals and
  Profit Withdrawals cards. The counts (`pendingApprovalCount`,
  `myPendingCount`, `profitPendingApprovalCount`, `myProfitPendingCount`) are
  per-user fields merged into `GET /dashboard`, so the banner needs no extra
  request; `refreshDashboard(true)` re-reads them after a submit or decision.
  The copy distinguishes an approver (“need your response”) from an initiator
  (“waiting for a response”).
- The per-category channel switches (`GET`/`PATCH /inbox/settings`) live on the
  Settings screen (`views/SettingsScreen.tsx`), reachable from the drawer and
  from the avatar menu in the header. `locked` rows (the in-app inbox) render
  disabled, and a failed PATCH rolls the switch back.
- Android builds need `android/app/google-services.json` (a gitignored copy of
  the Firebase config) or the gradle plugin is skipped and the app ships without
  FCM; the release workflow writes it from the `GOOGLE_SERVICES_JSON` secret
  (base64, or the raw file — both are accepted). iOS still needs the Push
  Notifications capability (`aps-environment`) and an APNs key in the Firebase
  project.
- Android builds target API 36 (Android 16) because Play rejects lower targets.
  Expo SDK 53's catalog defaults to 35, so `android/gradle.properties` pins
  `android.compileSdkVersion` / `android.targetSdkVersion` /
  `android.buildToolsVersion` and `app.config.js` mirrors them through
  `expo-build-properties`; change the two together.

## Validation

- `npm test` (Jest) and `npm run lint` (Expo ESLint).
- `npx tsc --noEmit` — the repo currently has 12 pre-existing
  `InternetPackage` type errors; do not add new ones.
- Do **not** run Prettier: the project has no Prettier config and the source is
  tab-indented, so Prettier rewrites whole files.
