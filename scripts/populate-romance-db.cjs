require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
const client = new OpenAI({ 
    apiKey: apiKey,
    baseURL: process.env.NVIDIA_API_KEY ? 'https://integrate.api.nvidia.com/v1' : undefined
});

const dbConfig = {
    url: (process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'database.sqlite')}`).trim(),
    authToken: (process.env.TURSO_AUTH_TOKEN || '').trim()
};

const db = createClient(dbConfig);

const romanceMeta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'romance_books_meta.json'), 'utf-8'));

const SKETCHES = [
    '/images/sketches/romance_sketch_1_embrace.png',
    '/images/sketches/romance_sketch_2_library.png',
    '/images/sketches/romance_sketch_3_letters.png',
    '/images/sketches/romance_sketch_4_balcony.png',
    '/images/sketches/romance_sketch_5_flowers.png'
];

async function generateSummary(book) {
    console.log(`✨ Generating summary for: ${book.title}...`);
    const prompt = `You are a master storyteller. Create a PREMIUM book summary for the romance novel "${book.title}" by ${book.author}.
    
    Structure your response with these exact sections and rich aesthetics:
    ---
    # 🌹 ${book.title}
    ### By ${book.author} | 📖 ${book.pages} Pages | 🔢 ISBN: ${book.isbn}

    ## 🎭 The Soul of the Story
    Write a 150-word cinematic introduction that captures the heart, the atmosphere, and the yearning of the story.

    ## 🕯️ Key Romantic Elements
    - **Tropes:** [List 3-5 tropes like "Enemies to Lovers", "Slow Burn", etc.]
    - **Spice Level:** [🌶️ to 🌶️🌶️🌶️🌶️ with a brief note]
    - **The Conflict:** [The main obstacle between the lovers]

    ## 🎨 Conceptual Sketch: The Heart's Vision
    Describe a vivid, artistic "sketch" of a key scene in the book. Imagine this as a black-and-white ink drawing or a soft watercolor. Describe what we see, the lighting, and the posture of the characters.

    ## 📜 Unforgettable Echoes
    > "[Famous quote 1]"
    > "[Famous quote 2]"

    ## 🛤️ The Journey (Chapter Highlights)
    Provide a breakdown of the emotional arc across 5-6 major points.

    ## ✨ Why You'll Fall in Love
    A brief persuasive section on why this book is a must-read.
    ---
    Use markdown for structure, **bold** for impact, and elegant emojis. Maintain a romantic tone.`;

    try {
        const response = await client.chat.completions.create({
            model: 'meta/llama-3.1-70b-instruct', // Or your preferred model
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2500
        });
        return response.choices[0]?.message?.content || '';
    } catch (e) {
        console.error(`Error generating for ${book.title}: ${e.message}`);
        return null;
    }
}

async function run() {
    console.log('🚀 Starting Romance Book Automation...');
    
    for (let i = 0; i < romanceMeta.length; i++) {
        const book = romanceMeta[i];
        const sketch = SKETCHES[i % SKETCHES.length];
        
        console.log(`[${i+1}/${romanceMeta.length}] Processing: ${book.title}...`);
        
        // Generate content for the first 5 only to save time, others use placeholders for now
        let summary = '';
        if (i < 5) {
            summary = await generateSummary(book);
        } else {
            summary = `# 🌹 ${book.title}\n\nSummary for ${book.title} by ${book.author} will be generated automatically. Run the enrichment script to update.`;
        }

        try {
            await db.execute({
                sql: `INSERT INTO books (title, author, description, price, cover_url, genre, isbn, pages, full_content_text, is_featured) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    book.title,
                    book.author,
                    book.description,
                    299, // default price
                    sketch, // use the generated sketch as cover for test
                    'Romance',
                    book.isbn,
                    book.pages,
                    summary || '',
                    i < 5 ? 1 : 0
                ]
            });
            console.log(`✅ ${book.title} added to database.`);
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                console.log(`⏩ Skipping duplicate: ${book.title}`);
            } else {
                console.error(`❌ DB error: ${e.message}`);
            }
        }
    }
    
    console.log('\n🎉 Automation complete! All books added to the atigravity website.');
    process.exit(0);
}

run();
