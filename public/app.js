const RATE_MARKUP = 1.0101; // Base Conversion + 1.01%

const els = {
  refresh: document.getElementById("refresh"),
  rate: document.getElementById("rate"),
  status: document.getElementById("status"),
  usd: document.getElementById("usd"),
  base: document.getElementById("base"),
  withRate: document.getElementById("withRate"),
  copy: document.getElementById("copy"),
  copied: document.getElementById("copied"),
  fetched: document.getElementById("fetched"),
};

const idr = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// USD input amount — up to 2 decimals, no forced trailing zeros.
const amt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

let kursJual = null; // latest USD e-Rate Jual

/** Parse the USD text input into a Number (accepts "100", "100.5", "100,5"). */
function parseUsd(str) {
  if (!str) return 0;
  let s = str.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const parts = s.split(".");
  if (parts.length > 2) {
    s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Timestamp in "DD/MM/YY HH:MM" format (local time). */
function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${p(d.getFullYear() % 100)} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function recalc() {
  const usd = parseUsd(els.usd.value);
  const valid = kursJual != null && usd > 0;

  if (!valid) {
    els.base.textContent = "—";
    els.withRate.textContent = "With BCA Rate 1.01% —";
    els.copy.disabled = true;
    return;
  }

  const base = usd * kursJual;
  const withRate = base * RATE_MARKUP;

  els.base.textContent = "Rp " + idr.format(base);
  els.withRate.textContent = "With BCA Rate 1.01% Rp " + idr.format(withRate);
  els.copy.disabled = false;
}

async function loadKurs() {
  els.refresh.disabled = true;
  els.refresh.classList.add("loading");
  els.status.classList.remove("error");
  els.status.textContent = "Memuat kurs terbaru…";

  try {
    const res = await fetch("/api/kurs", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    kursJual = data.kursJual;
    els.rate.textContent = "Rp " + idr.format(kursJual);

    const t = new Date(data.fetchedAt);
    els.status.textContent = "Diperbarui " + t.toLocaleString("id-ID");
    els.fetched.textContent = "Kurs Jual USD e-Rate";
    recalc();
  } catch (err) {
    els.status.classList.add("error");
    els.status.textContent = "Gagal memuat kurs: " + err.message;
  } finally {
    els.refresh.disabled = false;
    els.refresh.classList.remove("loading");
  }
}

async function copyResult() {
  const usd = parseUsd(els.usd.value);
  if (kursJual == null || usd <= 0) return;

  const converted = usd * kursJual * RATE_MARKUP; // includes 1.01% BCA markup

  const text =
    `Input Amount: USD ${amt.format(usd)}\n` +
    `Current BCA Rate: ${idr.format(kursJual)}\n` +
    `Converted Amount: Rp ${idr.format(converted)}\n` +
    `Date & Time: ${stamp(new Date())}`;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    els.copied.hidden = false;
    setTimeout(() => (els.copied.hidden = true), 1800);
  } catch (err) {
    els.status.classList.add("error");
    els.status.textContent = "Gagal menyalin: " + err.message;
  }
}

els.refresh.addEventListener("click", loadKurs);
els.usd.addEventListener("input", recalc);
els.copy.addEventListener("click", copyResult);

loadKurs();
