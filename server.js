import http from "http";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname, normalize } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const BCA_URL = "https://www.bca.co.id/id/informasi/kurs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
};

/** Parse an Indonesian-formatted number ("16.250,00") into a Number. */
function parseIdNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\./g, "").replace(/,/g, ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Extract the USD rates from BCA's kurs page HTML (no HTML-parser dependency).
 * BCA's USD row columns, in order:
 *   Mata Uang | e-Rate (Jual | Beli) | TT Counter (Jual | Beli) | Bank Notes (Jual | Beli)
 * so the first number in the row is e-Rate Jual.
 */
function extractUsd(html) {
  const stripTags = (s) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Indonesian rate tokens always carry a thousands separator (USD ~ 16.xxx,00),
  // which avoids matching stray single digits from markup.
  const NUM = /\d{1,3}(?:\.\d{3})+(?:,\d+)?/g;

  // 1) Prefer the <tr> row whose text contains USD as a standalone token.
  let rowText = null;
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const text = stripTags(row);
    if (/\bUSD\b/i.test(text)) {
      rowText = text;
      break;
    }
  }

  // 2) Fallback: take the text right after the first USD mention.
  if (!rowText) {
    const full = stripTags(html);
    const m = full.match(/\bUSD\b([\s\S]{0,200})/i);
    if (m) rowText = m[1];
  }

  if (!rowText) return null;

  const nums = (rowText.match(NUM) || [])
    .map(parseIdNumber)
    .filter((n) => n != null && n > 0);

  if (!nums.length) return null;

  return {
    eRateJual: nums[0] ?? null,
    eRateBeli: nums[1] ?? null,
    ttCounterJual: nums[2] ?? null,
    ttCounterBeli: nums[3] ?? null,
    bankNotesJual: nums[4] ?? null,
    bankNotesBeli: nums[5] ?? null,
    allNumbers: nums,
  };
}

async function handleKurs(res) {
  try {
    const upstream = await fetch(BCA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });

    if (!upstream.ok) {
      return sendJson(res, 502, { error: `BCA returned HTTP ${upstream.status}` });
    }

    const html = await upstream.text();
    const usd = extractUsd(html);

    if (!usd || usd.eRateJual == null) {
      return sendJson(res, 502, {
        error:
          "Could not find the USD rate in BCA's page. The page layout may have changed.",
      });
    }

    sendJson(res, 200, {
      currency: "USD",
      kursJual: usd.eRateJual, // e-Rate Jual — used by the calculator
      rates: usd,
      source: BCA_URL,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    sendJson(res, 502, { error: `Failed to reach BCA: ${err.message}` });
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(req.url.split("?")[0]);
  if (pathname === "/") pathname = "/index.html";

  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.split("?")[0] === "/api/kurs") {
    handleKurs(res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`kurs-bca running at http://localhost:${PORT}`);
});
