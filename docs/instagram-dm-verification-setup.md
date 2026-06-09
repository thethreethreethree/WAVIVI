# Instagram DM verification — Meta-side setup

The schema, webhook route, server actions, and UI for DM-based Instagram
verification are all shipped. The flow stays inert until you complete the
steps below — that's deliberate; the absence of the env vars makes the
"Start verification" button surface a friendly *"DM verification isn't
configured yet"* error rather than letting users start a token that can
never be claimed.

## What you need to set up

### 1. Brand Instagram account

- Create or designate the Instagram account users will DM (e.g.
  `@wondavu_official`).
- Convert it to a **Business** or **Creator** account in the IG app
  (Settings → Account type and tools).
- In Settings → Privacy → Messages, set **Allow DM access to anyone**.
  Webhook receipts require the account to accept inbound messages.

### 2. Facebook Page

- Create a Facebook Page that you can link the IG account to (Meta's
  Graph API surfaces Instagram messaging *through* a Page).
- In your Page settings → Linked accounts → Instagram, connect the
  brand IG account from step 1.

### 3. Meta developer app

- Go to <https://developers.facebook.com/apps/> and create a new app.
  Pick the **Business** type when prompted.
- Add the **Instagram Graph API** product to the app.
- Add the **Webhooks** product.
- Note these IDs from the App Dashboard:
  - **App ID** (public, fine to share)
  - **App Secret** (private — this is the HMAC key for signature
    verification). This goes into the env as
    `INSTAGRAM_APP_SECRET`.

### 4. Subscribe to message webhooks

- In the App Dashboard, go to **Webhooks → Instagram**.
- Click **Configure** for the `instagram` object.
- **Callback URL**: `https://wondavu.com/api/instagram/webhook`
- **Verify Token**: pick a random opaque string (e.g. a UUID) and paste
  the same value into `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in the Vercel
  env. Meta will GET the URL with that token; our route echoes the
  challenge back when it matches.
- Subscribe to the **`messages`** field.
- Confirm the subscription — Meta's UI will show "Verified" once the
  GET handshake succeeds.

### 5. Connect the IG account to the app

- Still in the App Dashboard, add the Instagram account (the one from
  step 1) under **Instagram → Roles → Instagram tester** (Development
  mode) so it can receive messages on your behalf without App Review.

### 6. App Review (production rollout)

To accept DMs from **any** Instagram user (not just testers), submit
the app for review and request:

- `instagram_business_manage_messages`
- `pages_messaging`

Meta usually approves within 1–2 weeks for messaging permissions if
the use case is clearly explained ("traveler-account verification via
a code-paste DM").

## Environment variables

Set these in Vercel (and in your local `.env.local` for dev):

```
INSTAGRAM_BRAND_HANDLE=wondavu_official
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=<random-string-you-also-paste-into-the-app-dashboard>
INSTAGRAM_APP_SECRET=<Meta App Secret from the App Dashboard>
```

After setting them, redeploy so the server picks up the new values.

## How to test

1. After the env vars are live, open `/profile` while signed in as a
   traveler. The new **"Verify with Instagram DM"** card appears
   under the existing Instagram connect card (as long as the
   traveler isn't already verified).
2. Tap **Start verification** — a `wavivi-xxxxxx` token shows up.
3. Tap **Copy + Open IG** — your IG opens to the brand profile and
   the token's on your clipboard.
4. Send the brand IG account a DM that contains the token.
5. Wait a few seconds. The card polls every 3s and flips to **"✓
   Verified as @yourhandle"** as soon as the webhook claims the token.

If anything goes wrong, the Vercel function logs for
`/api/instagram/webhook` and the browser console for
`pollInstagramDmVerification` will surface the cause.

## Migration to run in Supabase SQL editor

```
0065_ig_dm_verify_pending.sql
notify pgrst, 'reload schema';
```

## Files added in code

- `supabase/migrations/0065_ig_dm_verify_pending.sql`
- `src/app/api/instagram/webhook/route.ts` — GET handshake + POST events
- `src/features/instagram/webhook.ts` — Meta signature helper + payload parser
- `src/features/instagram/dm-verify-actions.ts` — `start…` + `poll…` server actions
- `src/features/instagram/instagram-dm-verify-card.tsx` — Profile UI
- `src/lib/env.ts` — new env vars
- `src/types/supabase.ts` — `IgDmVerifyPendingRow` + Tables registration
