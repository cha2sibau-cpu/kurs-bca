import express from "express";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const BCA_URL = "https://www.bca.co.id/id/informasi/kurs";

app.use(express.static(join(__dirname, "public")));

/**
 * Parse an Indonesian-formatted number string ("16.250,00") into a Number.
 * Thousands separator is "." and decimal separator is ",".
 */
function parseIdNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\./g, "").replace(/,/g, ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Given the full BCA kurs page HTML, extract the USD row rates.
 * BCA's table columns are, in order:
 *   Mata Uang | e-Rate (Jual | Beli) | TT Counter (Jual | Beli) | Bank Notes (Jual | Beli)
 * So the first numeric cell in the USD row is e-Rate Jual.
 */
function extractUsd(html) {
  const $ = cheerio.load(html);
  let result = null;

  $("tr").each((_, tr) => {
    if (result) return;
    const row = $(tr);

    // Match the row whose currency-code cell is USD. Checking per-cell (not the
    // whole concatenated row text) is important: joined text becomes
    // "USD16.375,00…" where \bUSD\b would fail against the following digit.
    let isUsd = false;
    const numbers = [];
    row.find("td").each((__, td) => {
      const cellText = $(td).text().trim();
      if (/\bUSD\b/i.test(cellText)) isUsd = true;
      // Indonesian rate tokens look like "16.250,00" or "16.250"
      const matches = cellText.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g);
      if (matches) {
        for (const m of matches) {
          const n = parseIdNumber(m);
          if (n != null && n > 0) numbers.push(n);
        }
      }
    });

    if (!isUsd) return;

    if (numbers.length >= 1) {
      result = {
        eRateJual: numbers[0] ?? null,
        eRateBeli: numbers[1] ?? null,
        ttCounterJual: numbers[2] ?? null,
        ttCounterBeli: numbers[3] ?? null,
        bankNotesJual: numbers[4] ?? null,
        bankNotesBeli: numbers[5] ?? null,
        allNumbers: numbers,
      };
    }
  });

  return result;
}

app.get("/api/kurs", async (req, res) => {
  try {
    const upstream = await fetch(BCA_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        error: `BCA returned HTTP ${upstream.status}`,
      });
    }

    const html = await upstream.text();
    const usd = extractUsd(html);

    if (!usd || usd.eRateJual == null) {
      return res.status(502).json({
        error:
          "Could not find the USD rate in BCA's page. The page layout may have changed.",
      });
    }

    res.json({
      currency: "USD",
      kursJual: usd.eRateJual, // e-Rate Jual — the value the calculator uses
      rates: usd,
      source: BCA_URL,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(502).json({
      error: `Failed to reach BCA: ${err.message}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`kurs-bca running at http://localhost:${PORT}`);
});
