# Instagram bio proxy (Cloudflare Worker)

Tiny edge worker that fetches Instagram's public `web_profile_info` JSON
on behalf of the WAVIVI app. Cloudflare's edge IPs are typically accepted
by Instagram in cases where Vercel's data-center IPs are rate-limited.

## Deploy

You need a free Cloudflare account.

```bash
# 1. Install Wrangler globally (first time only).
npm install -g wrangler

# 2. From this folder.
cd cloudflare/instagram-proxy

# 3. Log in to Cloudflare.
wrangler login

# 4. Generate a random shared secret and store it on the Worker.
#    (Paste any long random string when prompted.)
wrangler secret put PROXY_SECRET

# 5. Ship it.
wrangler deploy
```

Wrangler prints the live URL, e.g.

```
https://wavivi-instagram-proxy.<your-subdomain>.workers.dev
```

## Wire the app to it

In **Vercel → Project → Settings → Environment Variables** add:

| Variable                   | Value                                                            |
|----------------------------|------------------------------------------------------------------|
| `INSTAGRAM_PROXY_URL`      | The URL Wrangler printed                                         |
| `INSTAGRAM_PROXY_SECRET`   | The same string you typed into `wrangler secret put PROXY_SECRET`|

Redeploy the app and the bio verifier will route through the Worker
automatically. Without those env vars, the verifier still works — it
just talks to Instagram directly (and may get blocked from Vercel).

## Verify the Worker by hand

```bash
curl -H "x-wavivi-proxy-secret: <your-secret>" \
  "https://wavivi-instagram-proxy.<sub>.workers.dev/?username=instagram"
```

You should see JSON with `data.user.biography` populated.

## Cost

Cloudflare's free Workers tier handles 100 000 requests/day, well above
what bio verification will need.
