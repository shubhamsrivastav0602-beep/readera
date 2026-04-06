/**
 * Sync Internet Archive (Hindi collection) → public/books.json
 *
 * هدف: Vercel/static deploy me bhi browse.html ko books milen (no DB required).
 *
 * It fetches first N items from:
 *   collection:booksbylanguage_hindi AND mediatype:texts
 * Then for each identifier, it pulls metadata and picks PDF + TXT download URLs.
 *
 * NOTE: STRICT MODE: only items with explicit Public Domain or Creative Commons rights.
 */
const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, '..', 'public', 'books.json');
const IA_ADVANCED_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_METADATA = 'https://archive.org/metadata';

function toArray(v) {
  return Array.isArray(v) ? v : v != null ? [v] : [];
}

function first(v, fallback = '') {
  const arr = toArray(v);
  return (arr[0] ?? fallback);
}

function safeText(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function isStrictPdOrCc(meta) {
  const md = meta?.metadata || {};
  const rightsText = `${md.rights || ''}`.toLowerCase();
  const licenseUrl = `${md.licenseurl || ''}`.toLowerCase();
  const restricted = `${md['access-restricted-item'] || ''}`.toLowerCase();
  if (restricted && restricted !== 'false') return false;
  if (rightsText.includes('public domain')) return true;
  if (licenseUrl.includes('creativecommons.org')) return true;
  if (rightsText.includes('creativecommons')) return true;
  return false;
}

function pickIaFiles(meta) {
  const files = Array.isArray(meta?.files) ? meta.files : [];
  let pdfFile = null;
  let textFile = null;

  for (const f of files) {
    const format = String(f.format || '').toLowerCase();
    const name = String(f.name || '');
    const lowerName = name.toLowerCase();

    if (!pdfFile && (format.includes('pdf') || lowerName.endsWith('.pdf'))) {
      pdfFile = name;
    }
    if (!textFile && (format.includes('plain text') || lowerName.endsWith('.txt'))) {
      textFile = name;
    }
    if (pdfFile && textFile) break;
  }
  return { pdfFile, textFile };
}

async function fetchJson(url) {
  const tries = 3;
  let lastErr = null;
  for (let t = 0; t < tries; t++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'ReaderaSync/1.0 (books.json generator)' },
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise((r) => setTimeout(r, 800 * (t + 1)));
    }
  }
  throw lastErr || new Error('Fetch failed');
}

async function fetchPreview(url, maxChars = 400) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ReaderaSync/1.0' } })
      .finally(() => clearTimeout(timer));
    if (!res.ok) return '';
    const text = await res.text();
    return String(text || '').slice(0, maxChars);
  } catch {
    return '';
  }
}

async function poolMap(items, concurrency, mapper) {
  const out = new Array(items.length);
  let i = 0;
  const n = Math.max(1, Math.floor(concurrency || 8));

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await mapper(items[idx], idx).catch(() => null);
    }
  }

  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function buildBook(d, identifier, md, pdfFile, textFile, preview_content, mode, legal_notice, id) {
  const title = safeText(d.title || identifier);
  const author = safeText(first(d.creator, 'Unknown')) || 'Unknown';
  const description = safeText(first(d.description, `Imported from Internet Archive (${identifier})`));
  const language = safeText(first(d.language, 'Hindi')) || 'Hindi';
  const subject = safeText(first(d.subject, ''));

  const source_url = `https://archive.org/details/${identifier}`;
  const external_pdf_url = `https://archive.org/download/${identifier}/${encodeURIComponent(pdfFile)}`;
  const external_text_url = `https://archive.org/download/${identifier}/${encodeURIComponent(textFile)}`;
  const cover_url = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;

  const genre = mode === 'strict-1000' && /self/i.test(subject) ? 'Self-Help' : 'Public Domain';

  return {
    id,
    title,
    author,
    description,
    preview_content: preview_content || description.slice(0, 400),
    price: 1,
    genre,
    cover_url,
    pdf_url: external_pdf_url,
    text_url: external_text_url,
    language,
    source_name: 'internet_archive',
    source_url,
    legal_notice,
    is_public_domain: 1,
  };
}

async function main() {
  const limit = Math.min(Number(process.argv[2] || 50) || 50, 1000);
  // Accept "hindi" (default) or "strict-1000" across Hindi+English+self-help
  const mode = String(process.argv[3] || 'hindi').toLowerCase();
  const queries =
    mode === 'strict-1000'
      ? [
          '(collection:booksbylanguage_hindi) AND mediatype:texts',
          '(collection:opensource) AND mediatype:texts AND language:English',
          '(collection:opensource) AND mediatype:texts AND language:English AND (subject:\"self help\" OR subject:\"self-help\" OR subject:productivity OR subject:motivation)',
        ]
      : ['(collection:booksbylanguage_hindi) AND mediatype:texts'];
  const fl = [
    'identifier',
    'title',
    'creator',
    'description',
    'year',
    'language',
    'licenseurl',
    'rights',
  ].map((f) => `fl[]=${encodeURIComponent(f)}`).join('&');

  const out = [];
  const legal_notice =
    'Imported from Internet Archive where rights indicate Public Domain or Creative Commons. Verify rights/license before redistribution.';

  let idCounter = 900000; // avoid clashing with local DB ids

  for (const qRaw of queries) {
    if (out.length >= limit) break;
    let page = 1;
    while (out.length < limit && page <= 50) {
      const q = encodeURIComponent(qRaw);
      const searchUrl = `${IA_ADVANCED_SEARCH}?q=${q}&${fl}&rows=100&page=${page}&output=json`;
      let searchJson;
      try {
        searchJson = await fetchJson(searchUrl);
      } catch (e) {
        // If a page fails, skip it instead of crashing whole job.
        page++;
        continue;
      }
      const docs = (searchJson?.response?.docs || []);
      if (!docs.length) break;

      // Process this page with limited concurrency for speed
      const remaining = Math.max(0, limit - out.length);
      const batch = docs.slice(0, Math.min(docs.length, Math.max(remaining * 2, 120)));

      const results = await poolMap(batch, 8, async (d) => {
        const identifier = d.identifier;
        if (!identifier) return null;

        let md;
        try {
          md = await fetchJson(`${IA_METADATA}/${encodeURIComponent(identifier)}`);
        } catch {
          return null;
        }
        if (!isStrictPdOrCc(md)) return null;

        const { pdfFile, textFile } = pickIaFiles(md);
        if (!pdfFile || !textFile) return null;

        const external_text_url = `https://archive.org/download/${identifier}/${encodeURIComponent(textFile)}`;
        const preview_content = await fetchPreview(external_text_url, 400);

        // reserve id only for accepted books
        const id = idCounter++;
        return buildBook(d, identifier, md, pdfFile, textFile, preview_content, mode, legal_notice, id);
      });

      for (const b of results) {
        if (!b) continue;
        out.push(b);
        if (out.length >= limit) break;
      }

      page++;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} books → ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

