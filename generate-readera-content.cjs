/**
 * Batch-generate Readera "engaging edition" summaries for books in public/books.json.
 *
 * For ~11k titles: run in slices, e.g.
 *   node generate-readera-content.cjs --limit=25 --offset=0
 *   node generate-readera-content.cjs --limit=25 --offset=25
 *
 * Env (OpenAI-compatible API):
 *   OPENAI_API_KEY   (required)
 *   OPENAI_BASE_URL  (optional, e.g. https://api.openai.com/v1 or NVIDIA integrate URL)
 *   OPENAI_MODEL     (optional, default gpt-4o-mini)
 *
 * Resume: skips books where full_content_text already looks complete (long + pagebreaks or many chapters).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const booksPath = path.join(__dirname, 'public', 'books.json');
const DELAY_MS = parseInt(process.env.READERA_GEN_DELAY_MS || '2500', 10);

function parseArgs() {
    const a = process.argv.slice(2);
    const out = { limit: Infinity, offset: 0, dry: false };
    for (const x of a) {
        if (x.startsWith('--limit=')) out.limit = parseInt(x.split('=')[1], 10) || 0;
        else if (x.startsWith('--offset=')) out.offset = parseInt(x.split('=')[1], 10) || 0;
        else if (x === '--dry-run') out.dry = true;
    }
    return out;
}

const GENRE_RULES = {
    Fiction: 'Rich descriptions, emotional depth, metaphor and imagery. Preserve character arcs and key emotional beats.',
    'Sci-Fi': 'Strong world-building and plausible future tech. Ground inventions in believable cause and effect.',
    Mystery: 'Tension, suspense, short punchy sentences where appropriate, twists that feel earned.',
    Thriller: 'Rapid pacing, cliffhangers, sensory detail under pressure.',
    Romance: 'Chemistry, emotional stakes, meet-cute / conflict / movement toward resolution.',
    'Self-Help': 'Direct "you" voice, actionable steps, end each chapter with a Key Takeaway block.',
    Biography: 'Chronological highlights, pivotal scenes, one memorable line per era where possible.',
    Fantasy: 'Clear magic or world rules, stakes of the quest, lore without encyclopedic lists.',
    History: 'Dates and figures woven into narrative; cause and effect.',
    Horror: 'Atmosphere, dread, sound/smell/touch; restraint is scarier than gore.',
    Business: 'Frameworks, examples, numbered takeaways where useful.',
    General: 'Match tone to the title; balance narrative momentum with clarity.',
};

function genreHint(g) {
    if (!g) return GENRE_RULES.General;
    const k = Object.keys(GENRE_RULES).find(
        (x) => x.toLowerCase() === String(g).toLowerCase()
    );
    return GENRE_RULES[k] || GENRE_RULES.General;
}

function buildPrompt(book) {
    const title = book.title || 'Untitled';
    const author = book.author && book.author !== 'Unknown' ? book.author : 'the credited author';
    const genre = book.genre || 'General';
    return `You are a professional book summarizer for the digital library "Readera".

CONTENT RULES:
- Assume original book length ~500 pages. Your output is a condensed "Readera edition" (~10% length feel: substantial but readable in one or two sittings).
- Preserve original essence, emotional through-line, and landmark moments.
- Chapter-wise structure: 10–15 chapters.
- Each chapter: 800–1200 words, short paragraphs (2–4 lines each) for mobile reading.
- Insert an HTML comment exactly as shown every 300–400 words: <!-- pagebreak -->
- End each chapter with a line that creates curiosity for the next (one sentence cliffhanger).
- Start each chapter with a line like: Chapter 3: [Short Title] • X min read (estimate X from word count at ~200 wpm).

Genre: ${genre}
Genre guidance: ${genreHint(genre)}

OUTPUT FORMAT:
- Use ## for chapter headings (with the "Chapter N: … • … min read" text inside that heading line).
- Use **bold** for emphasis sparingly.
- For self-help / motivational sections, after the chapter body add:
  Key Takeaway: [2–4 sentences]

BOOK:
Title: ${title}
Author: ${author}

Write the full Readera edition now in markdown (## / ### / paragraphs). Do not include preface about being an AI.`;
}

function needsGeneration(book) {
    const t = book.full_content_text || '';
    if (t.length < 4000) return true;
    if (t.length > 8000 && /###\s*📚\s*Chapter/i.test(t)) return false;
    const breaks = (t.match(/<!--\s*pagebreak\s*-->/gi) || []).length;
    const chapters = (t.match(/^##\s+/gm) || []).length;
    if (breaks >= 8 && chapters >= 8) return false;
    return t.length < 12000;
}

async function generate(client, model, book) {
    const res = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: buildPrompt(book) }],
        temperature: 0.65,
        max_tokens: 16000,
    });
    return res.choices[0]?.message?.content?.trim() || '';
}

function loadBooks() {
    return JSON.parse(fs.readFileSync(booksPath, 'utf8'));
}

function saveBooks(books) {
    fs.writeFileSync(booksPath, JSON.stringify(books, null, 2));
}

async function main() {
    const { limit, offset, dry } = parseArgs();
    const key = process.env.OPENAI_API_KEY;
    if (!key && !dry) {
        console.error('Set OPENAI_API_KEY in .env (never commit keys).');
        process.exit(1);
    }

    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const client = dry
        ? null
        : new OpenAI({
              apiKey: key,
              baseURL,
          });

    let books = loadBooks();
    const candidates = books.map((b, i) => ({ b, i })).filter(({ b }) => needsGeneration(b));
    const slice = candidates.slice(offset, offset + limit);

    console.log(`Total books: ${books.length}`);
    console.log(`Candidates needing richer content: ${candidates.length}`);
    console.log(`This run: offset ${offset}, count ${slice.length}${dry ? ' (dry-run)' : ''}`);
    console.log(`Model: ${model}\n`);

    let ok = 0;
    let fail = 0;

    for (let j = 0; j < slice.length; j++) {
        const { b, i } = slice[j];
        const label = `${j + 1}/${slice.length} id=${b.id} ${(b.title || '').slice(0, 48)}…`;
        console.log(label);

        if (dry) {
            console.log('  [dry-run] skip API');
            continue;
        }

        try {
            const content = await generate(client, model, b);
            if (!content || content.length < 500) throw new Error('empty or too short response');

            books[i].full_content_text = content;
            books[i].preview_content =
                content.slice(0, 1200).trim() + '\n\n🔒 Full edition in Readera library.';
            saveBooks(books);
            ok++;
            console.log(`  saved ${content.length} chars`);
        } catch (e) {
            fail++;
            console.error(`  ERROR: ${e.message}`);
        }

        await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    console.log(`\nDone. OK: ${ok}, failed: ${fail}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
