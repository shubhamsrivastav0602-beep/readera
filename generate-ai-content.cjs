require('dotenv').config();
const fs = require('fs');
const OpenAI = require('openai');

// ========== NVIDIA NIM CONFIGURATION ==========
// ✅ SAHI ENDPOINT AUR MODEL
const client = new OpenAI({
    apiKey: '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',
    baseURL: 'https://integrate.api.nvidia.com/v1',  // ✅ Sahi endpoint
});

const booksPath = 'public/books.json';
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds

// ========== READ BOOKS ==========
function loadBooks() {
    return JSON.parse(fs.readFileSync(booksPath, 'utf8'));
}

function saveBooks(books) {
    fs.writeFileSync(booksPath, JSON.stringify(books, null, 2));
}

function getBooksToProcess(books) {
    return books.filter(b =>
        !b.full_content_text ||
        b.full_content_text.includes('sample') ||
        b.full_content_text.length < 500
    );
}

// ========== GENERATE CONTENT ==========
async function generateContent(title, author) {
    const prompt = `Generate a detailed book summary for "${title}" by ${author}.

Create approximately 2000-2500 words of content with this EXACT structure:

## ${title} by ${author}

### 📖 Overview
Write a 200-word summary of the book, main themes, and key takeaways.

### 📚 Chapter 1 Summary
Write 300 words covering the main events, key ideas, and important quotes.

### 📚 Chapter 2 Summary
Write 300 words.

### 📚 Chapter 3 Summary
Write 300 words.

### 📚 Chapter 4 Summary
Write 300 words.

### 📚 Chapter 5 Summary
Write 300 words.

### 📚 Chapter 6 Summary
Write 300 words.

### 💡 Key Lessons (3 lessons)
- Lesson 1: Detailed explanation
- Lesson 2: Detailed explanation  
- Lesson 3: Detailed explanation

### 🌟 Final Summary
Write a 150-word conclusion.

Use markdown formatting. Use emojis like 📖, 🌟, 💡. Use **bold** for important concepts. Use --- between sections.`;

    const response = await client.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',  // ✅ Sahi model name
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
    });

    return response.choices[0]?.message?.content || '';
}

// ========== PROCESS ALL BOOKS ==========
async function processAll() {
    let books = loadBooks();
    let booksToProcess = getBooksToProcess(books);

    console.log(`📚 Total books: ${books.length}`);
    console.log(`📝 Books already have content: ${books.length - booksToProcess.length}`);
    console.log(`🎯 Books to process: ${booksToProcess.length}`);
    console.log(`🤖 Using NVIDIA NIM - meta/llama-3.1-70b-instruct\n`);

    let success = 0;
    let failed = 0;
    let total = booksToProcess.length;

    for (let i = 0; i < booksToProcess.length; i++) {
        const book = booksToProcess[i];
        const currentIndex = i + 1;

        console.log(`[${currentIndex}/${total}] 📖 Generating: ${book.title.substring(0, 50)}...`);

        try {
            const content = await generateContent(book.title, book.author || 'Unknown');

            const bookIndex = books.findIndex(b => b.id === book.id);
            if (bookIndex !== -1) {
                books[bookIndex].full_content_text = content;
                books[bookIndex].preview_content = content.substring(0, 1000) + '\n\n🔒 Full content available after purchase.';
            }

            saveBooks(books);
            console.log(`✅ Success! (${content.length} chars)\n`);
            success++;

        } catch (error) {
            console.log(`❌ Failed: ${error.message}\n`);
            failed++;
            saveBooks(books);
        }

        // Delay between requests
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));
    }

    console.log(`\n🎉 Done! Success: ${success}, Failed: ${failed}`);
}

// ========== START ==========
console.log('🚀 Starting AI content generation with NVIDIA NIM...');
console.log('📌 Script will auto-resume if interrupted\n');

processAll().catch(console.error);