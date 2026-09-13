# Kurs BCA — USD Calculator

Reads **real-time** BCA exchange rates from
<https://www.bca.co.id/id/informasi/kurs>, watches the **USD Kurs Jual
(e-Rate)**, and converts USD → IDR with a BCA-rate calculator.

## Features

- Live USD **Kurs Jual** (e-Rate) with a **Refresh** button to always pull the newest rate.
- Calculator: type a USD amount → **Base Conversion** (large, bold).
- Below it: **Base Conversion + 1.01%** (BCA rate markup), in smaller text.
- **Copy** button copies exactly:

  ```
  YYYYMMDD HH:MM
  <Base Conversion>
  With BCA Rate 1.01% <Base Conversion + 1.01%>
  ```

## Why a small server?

Browsers can't fetch `bca.co.id` directly (CORS is not allowed by BCA), so a
tiny Node server scrapes the page server-side and exposes a clean
`GET /api/kurs` endpoint. The frontend is a static page served by the same
server.

The server uses **only Node's built-in modules** — no npm dependencies — so
`npm install` pulls nothing and there's nothing to keep up to date. Needs
**Node 18+** (for the built-in `fetch`).

## Run

```bash
npm install
npm start
```

Then open <http://localhost:3000>. Change the port with `PORT=8080 npm start`.

### One-click launch (macOS)

After the one-time `npm install` above, just **double-click `Kurs BCA.command`**
in Finder. It starts the server (if it isn't already running) and opens the app
in your browser — no terminal typing needed. A small terminal window stays open
while the app runs; close it (or press Ctrl+C) to stop the server.

Tip: drag `Kurs BCA.command` to the Finder sidebar or your Dock for quick
access. If macOS blocks it the first time, right-click → **Open** once to
approve it.

## How the rate is picked

BCA's USD row has three columns (each Jual/Beli): **e-Rate**, **TT Counter**,
**Bank Notes**. In that row the first numeric cell is **e-Rate Jual**, which is
the value the calculator uses. `GET /api/kurs` also returns all six parsed
numbers under `rates` for transparency, so you can verify against the site.

If BCA changes its page layout, the endpoint returns a clear error
(`Could not find the USD rate…`) instead of a wrong number.
