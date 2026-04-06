// enrich-books-ai.js - Advanced AI-powered book content generation with Google Books API
const fs = require('fs');
const https = require('https');
require('dotenv').config();

// ========== CONFIGURATION ==========
// 🔑 Apni REAL Gemini API key yahan daalo
const GEMINI_API_KEY = "AAIzaSyAek5_7a85g5FPhHdW2KBvWfz3OFeiKkVw";

// 🔑 Google Books API key (yahan apni actual key daalo)
const GOOGLE_BOOKS_API_KEY = "YOUR_GOOGLE_BOOKS_API_KEY_HERE"; // Replace with your actual key

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

const booksPath = 'public/books.json';
const books = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

console.log(`📚 Total books: ${books.length}`);
console.log(`🤖 Using Gemini AI + Google Books API for content generation\n`);

// ========== ADVANCED GENRE DETECTION ==========
function detectGenre(book) {
    const title = (book.title || '').toLowerCase();
    const author = (book.author || '').toLowerCase();
    const description = (book.description || '').toLowerCase();
    
    // Combine all text for better detection
    const fullText = `${title} ${author} ${description}`;

    // Fantasy keywords
    if (fullText.includes('harry potter') || fullText.includes('wizard') || fullText.includes('magic') || 
        fullText.includes('dragon') || fullText.includes('kingdom') || fullText.includes('myth') ||
        fullText.includes('lord of the rings') || fullText.includes('game of thrones')) return 'Fantasy';
    
    // Self-Help keywords
    if (fullText.includes('habit') || fullText.includes('self') || fullText.includes('help') || 
        fullText.includes('productivity') || fullText.includes('mindset') || fullText.includes('success') ||
        fullText.includes('wealth') || fullText.includes('motivation') || fullText.includes('growth')) return 'Self-Help';
    
    // Mystery/Thriller keywords
    if (fullText.includes('murder') || fullText.includes('mystery') || fullText.includes('detective') || 
        fullText.includes('crime') || fullText.includes('thriller') || fullText.includes('suspense') ||
        fullText.includes('investigation') || fullText.includes('killer')) return 'Mystery';
    
    // Sci-Fi keywords
    if (fullText.includes('sci-fi') || fullText.includes('space') || fullText.includes('galaxy') || 
        fullText.includes('future') || fullText.includes('robot') || fullText.includes('alien') ||
        fullText.includes('dystopian') || fullText.includes('time travel') || fullText.includes('mars')) return 'Sci-Fi';
    
    // Romance keywords
    if (fullText.includes('love') || fullText.includes('romance') || fullText.includes('heart') || 
        fullText.includes('relationship') || fullText.includes('wedding') || fullText.includes('passion')) return 'Romance';
    
    // Business/Finance keywords
    if (fullText.includes('business') || fullText.includes('money') || fullText.includes('finance') || 
        fullText.includes('investment') || fullText.includes('entrepreneur') || fullText.includes('startup') ||
        fullText.includes('economics') || fullText.includes('stock market')) return 'Finance';
    
    // Tech keywords
    if (fullText.includes('code') || fullText.includes('python') || fullText.includes('tech') || 
        fullText.includes('programming') || fullText.includes('software') || fullText.includes('algorithm') ||
        fullText.includes('artificial intelligence') || fullText.includes('machine learning')) return 'Tech';
    
    // History keywords
    if (fullText.includes('history') || fullText.includes('war') || fullText.includes('ancient') || 
        fullText.includes('historical') || fullText.includes('medieval') || fullText.includes('empire')) return 'History';
    
    // Biography keywords
    if (fullText.includes('biography') || fullText.includes('memoir') || fullText.includes('autobiography') || 
        fullText.includes('life story') || fullText.includes('journal') || fullText.includes('legacy')) return 'Biography';
    
    // Author-based detection
    if (author.includes('rowling')) return 'Fantasy';
    if (author.includes('clear')) return 'Self-Help';
    if (author.includes('weir')) return 'Sci-Fi';
    if (author.includes('king')) return 'Horror';
    if (author.includes('patterson')) return 'Mystery';
    if (author.includes('collins')) return 'Romance';

    return book.genre || 'Fiction';
}

// ========== ADVANCED GENRE-SPECIFIC PROMPTS ==========
const genrePrompts = {
    'Fiction': `Create a captivating and immersive summary of this fiction book that brings the story to life. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Plot Summary**: Main story arc, key events, and narrative flow
2. **Character Development**: Protagonist journey, character growth, relationships
3. **Thematic Elements**: Core themes, symbolism, deeper meanings
4. **Emotional Impact**: How the book makes readers feel, memorable moments
5. **Literary Style**: Writing techniques, narrative voice, unique elements

Use rich, descriptive language that captures the essence of the book. Make it feel like a professional book review that entices readers while giving substantial insight into the story.`,
    
    'Sci-Fi': `Generate an exciting and mind-expanding summary of this science fiction masterpiece. Write approximately {word_count} words (10% of total pages) covering:
1. **World-Building**: Futuristic setting, technological landscape, societal structure
2. **Scientific Concepts**: Hard science, speculative technology, innovative ideas
3. **Core Conflict**: Main struggle, stakes, philosophical questions
4. **Character Arcs**: How characters evolve in this futuristic context
5. **Themes & Commentary**: Social commentary, human condition, future implications

Use vivid, imaginative language that captures the wonder and complexity of science fiction. Make readers feel the excitement of discovery and the depth of conceptual exploration.`,
    
    'Mystery': `Craft a suspenseful and gripping summary of this mystery/thriller that keeps readers on edge. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Central Mystery**: The puzzle, crime, or enigma at the heart of the story
2. **Investigation Process**: Clues, red herrings, detective work
3. **Plot Twists**: Surprising revelations, unexpected turns
4. **Character Motivations**: Why characters do what they do, hidden agendas
5. **Resolution & Impact**: How it all comes together, lasting effects

Use tense, atmospheric language that builds suspense. Create a sense of urgency and intrigue that makes readers desperate to know what happens next.`,
    
    'Self-Help': `Write an inspiring and actionable summary of this self-help book that motivates real change. Write approximately {word_count} words (10% of total pages) covering:
1. **Core Philosophy**: Main premise, fundamental principles, unique approach
2. **Key Strategies**: Actionable techniques, practical methods, step-by-step guidance
3. **Life-Changing Insights**: Paradigm shifts, breakthrough concepts, "aha" moments
4. **Real-World Applications**: How to apply lessons in daily life
5. **Transformation Potential**: Expected results, long-term benefits, success stories

Use empowering, motivational language that inspires action. Make readers feel capable of implementing these changes and excited about their potential growth.`,
    
    'Fantasy': `Create an epic and magical summary of this fantasy adventure that transports readers to another world. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Magic System**: How magic works, rules, limitations, unique elements
2. **World Lore**: History, geography, cultures, mythologies
3. **Hero's Journey**: Protagonist's quest, growth, destiny
4. **Mythical Elements**: Creatures, legends, prophecies, ancient powers
5. **Epic Scale**: Stakes, battles, conflicts that shape the world

Use sweeping, mythic language that captures the grandeur and wonder of fantasy. Make readers feel the magic and adventure leap off the page.`,
    
    'Romance': `Write a heartfelt and passionate summary of this romance novel that captures the emotional journey. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Character Chemistry**: How the protagonists connect, their dynamic
2. **Emotional Journey**: Feelings, conflicts, growth, vulnerability
3. **Relationship Development**: How love builds, obstacles overcome
4. **Romantic Moments**: Key scenes, passionate encounters, tender times
5. **Love Story Arc**: From meeting to resolution, emotional payoff

Use warm, emotive language that makes readers feel the romance. Capture the butterflies, the passion, the heartache, and ultimately the triumph of love.`,
    
    'Tech': `Generate an informative and practical summary of this technology book that demystifies complex concepts. Write approximately {word_count} words (10% of total pages) covering:
1. **Core Concepts**: Fundamental principles, key terminology, basic understanding
2. **Technical Details**: How things work, implementation specifics
3. **Practical Applications**: Real-world uses, case studies, examples
4. **Learning Path**: How to master the subject, progression steps
5. **Industry Impact**: Why this matters, career implications, future trends

Use clear, accessible language that makes complex topics understandable. Balance technical accuracy with approachability for both beginners and experts.`,
    
    'Finance': `Create a smart and insightful summary of this finance book that empowers financial literacy. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Financial Principles**: Core money concepts, wealth-building fundamentals
2. **Investment Strategies**: Specific approaches, risk management, portfolio building
3. **Practical Tips**: Actionable advice, daily habits, money management
4. **Wealth Mindset**: Psychological aspects, behavioral finance, success mentality
5. **Long-Term Impact**: Financial freedom, legacy building, security

Use authoritative yet accessible language that builds confidence. Make readers feel empowered to take control of their financial future.`,
    
    'History': `Write a fascinating and illuminating summary of this history book that brings the past to life. Write approximately {word_count} words (10% of total pages) covering:
1. **Historical Context**: Time period, setting, background circumstances
2. **Key Events**: Major happenings, turning points, significant moments
3. **Important Figures**: Main characters, their roles, motivations, impact
4. **Lasting Legacy**: How these events shaped the world, modern relevance
5. **Lessons Learned**: What history teaches us, parallels to today

Use engaging, narrative language that makes history feel alive and relevant. Connect past events to present-day understanding and future implications.`,
    
    'Biography': `Create an inspiring and intimate summary of this biography that reveals a life's journey. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Life Story Arc**: From beginning to end, major life phases
2. **Achievements & Impact**: What made this person significant, contributions
3. **Struggles & Triumphs**: Obstacles overcome, lessons learned
4. **Personal Insights**: Character, personality, what drove them
5. **Legacy & Inspiration**: How they inspire others, lasting influence

Use respectful, engaging language that honors the subject while making their story relatable. Show both their greatness and their humanity.`,
    
    'default': `Write a comprehensive and engaging summary of this book that captures its essence and value. Write approximately {word_count} words (10% of total pages) focusing on:
1. **Main Content**: Core ideas, story, or information presented
2. **Key Themes**: Underlying messages, important concepts
3. **Unique Value**: What makes this book special or worth reading
4. **Reader Takeaways**: What readers will learn or experience
5. **Overall Impact**: Why this book matters in its field

Use engaging, professional language that showcases the book's strengths and helps readers understand its value and relevance.`
};

// ========== GOOGLE BOOKS API INTEGRATION ==========
// Fetch book details from Google Books API
async function fetchGoogleBooksData(title, author, isbn) {
    return new Promise((resolve, reject) => {
        let query = title;
        if (author && author !== 'Unknown') query += `+inauthor:${author}`;
        if (isbn) query += `+isbn:${isbn}`;
        
        const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(query)}&maxResults=3&key=${GOOGLE_BOOKS_API_KEY}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.items && json.items.length > 0) {
                        const book = json.items[0].volumeInfo;
                        const googleData = {
                            title: book.title || title,
                            authors: book.authors || [author],
                            publisher: book.publisher || 'Unknown',
                            publishedDate: book.publishedDate || 'Unknown',
                            description: book.description || '',
                            pageCount: book.pageCount || 300, // Default fallback
                            categories: book.categories || [],
                            averageRating: book.averageRating || 0,
                            ratingsCount: book.ratingsCount || 0,
                            imageLinks: book.imageLinks || {},
                            previewLink: book.previewLink || '',
                            industryIdentifiers: book.industryIdentifiers || []
                        };
                        resolve(googleData);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Calculate word count based on page count (10% of pages)
function calculateWordCount(pageCount, genre) {
    // Average words per page varies by genre
    const wordsPerPage = {
        'Fiction': 300,
        'Sci-Fi': 320,
        'Fantasy': 350,
        'Mystery': 280,
        'Romance': 300,
        'Self-Help': 250,
        'Biography': 280,
        'History': 300,
        'Tech': 250,
        'Finance': 250,
        'default': 300
    };
    
    const wpp = wordsPerPage[genre] || wordsPerPage.default;
    const targetWords = Math.round(pageCount * wpp * 0.1); // 10% of total words
    
    // Ensure reasonable bounds
    return Math.max(800, Math.min(targetWords, 3000));
}

// Test API keys first
async function testAPIs() {
    console.log("🔑 Testing APIs...");
    
    // Test Gemini API
    const geminiWorking = await new Promise((resolve) => {
        const testPrompt = {
            contents: [{ parts: [{ text: "Say 'API is working!'" }] }],
            generationConfig: { maxOutputTokens: 50 }
        };

        const req = https.request(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.candidates) {
                        console.log("✅ Gemini API is WORKING!");
                        resolve(true);
                    } else if (json.error) {
                        console.log(`❌ Gemini API Error: ${json.error.message}`);
                        resolve(false);
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    console.log(`❌ Gemini Parse error: ${e.message}`);
                    resolve(false);
                }
            });
        });
        req.on('error', () => resolve(false));
        req.write(JSON.stringify(testPrompt));
        req.end();
    });
    
    // Test Google Books API
    const googleBooksWorking = await new Promise((resolve) => {
        if (GOOGLE_BOOKS_API_KEY === "YOUR_GOOGLE_BOOKS_API_KEY_HERE") {
            console.log("⚠️ Google Books API key not configured");
            resolve(false);
            return;
        }
        
        const testUrl = `${GOOGLE_BOOKS_URL}?q=harry+potter&maxResults=1&key=${GOOGLE_BOOKS_API_KEY}`;
        https.get(testUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.items) {
                        console.log("✅ Google Books API is WORKING!");
                        resolve(true);
                    } else {
                        console.log(`❌ Google Books API Error: No results`);
                        resolve(false);
                    }
                } catch (e) {
                    console.log(`❌ Google Books Parse error: ${e.message}`);
                    resolve(false);
                }
            });
        }).on('error', () => {
            console.log("❌ Google Books Network error");
            resolve(false);
        });
    });
    
    console.log("");
    return { geminiWorking, googleBooksWorking };
}

// Generate content for a book with Google Books data integration
async function generateContent(title, author, genre, googleData) {
    const basePrompt = genrePrompts[genre] || genrePrompts.default;
    const wordCount = calculateWordCount(googleData?.pageCount || 300, genre);
    
    // Replace placeholder with actual word count
    const prompt = basePrompt.replace('{word_count}', wordCount.toString());
    
    let fullPrompt = `${prompt}

Book Title: "${title}"
Author: "${author}"
Genre: ${genre}`;
    
    // Add Google Books data if available
    if (googleData) {
        fullPrompt += `

Additional Book Information:
- Publisher: ${googleData.publisher}
- Published: ${googleData.publishedDate}
- Page Count: ${googleData.pageCount}
- Categories: ${googleData.categories.join(', ')}
- Average Rating: ${googleData.averageRating}/5 (${googleData.ratingsCount} ratings)
- Description: ${googleData.description || 'No description available'}`;
    }
    
    fullPrompt += `

Generate approximately ${wordCount} words of engaging, high-quality content. Use markdown formatting with proper headings, bullet points, and emphasis. Make it feel professional, comprehensive, and compelling. Focus on creating content that would make someone want to read this book immediately.`;

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 6000 }
        });

        const req = https.request(GEMINI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) resolve(text);
                    else reject(new Error('No content generated'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Enhanced fallback content with genre-specific touches
function getFallback(book, genre, googleData) {
    const genreSpecific = {
        'Fiction': 'immerses readers in a captivating narrative',
        'Sci-Fi': 'explores futuristic concepts and technological possibilities',
        'Fantasy': 'transports readers to magical realms and epic adventures',
        'Mystery': 'keeps readers guessing with suspenseful twists',
        'Romance': 'celebrates the power of love and human connection',
        'Self-Help': 'provides actionable insights for personal growth',
        'Tech': 'demystifies complex technological concepts',
        'Finance': 'offers practical wisdom for financial success',
        'History': 'illuminates the past to inform our present',
        'Biography': 'inspires through remarkable life stories'
    };
    
    const action = genreSpecific[genre] || 'offers valuable content';
    const pageCount = googleData?.pageCount || 300;
    const rating = googleData?.averageRating ? ` (${googleData.averageRating}/5 stars)` : '';
    
    return `# ${book.title} by ${book.author}

## 📖 Overview
**${book.title}** ${action} in the ${genre.toLowerCase()} genre${rating}. This comprehensive work spans ${pageCount} pages and offers readers an enriching experience.

## 🎯 What Makes This Book Special
- **Genre Excellence**: A standout example of ${genre.toLowerCase()} literature
- **Engaging Content**: Carefully crafted to captivate and inform
- **Reader Value**: Delivers meaningful insights and entertainment
- **Lasting Impact**: Content that resonates long after reading

## 📚 Key Elements
This book explores important themes and ideas relevant to ${genre.toLowerCase()} enthusiasts. The author presents concepts in an accessible, compelling manner that appeals to both newcomers and seasoned readers.

## 🌟 Why You Should Read This Book
Perfect for anyone interested in ${genre.toLowerCase()} literature. Whether you're seeking entertainment, knowledge, or inspiration, this book delivers exceptional value and belongs in your digital library.

## 📊 Additional Information${googleData ? `
- **Publisher**: ${googleData.publisher}
- **Published**: ${googleData.publishedDate}
- **Categories**: ${googleData.categories.join(', ')}
- **Page Count**: ${pageCount}` : ''}

---
*Enhanced AI-generated content with Google Books integration will be available soon. This summary provides a comprehensive overview of what makes this book worth reading.*`;
}

// ========== MAIN PROCESSING FUNCTION ==========
async function processAll() {
    // Test APIs first
    const { geminiWorking, googleBooksWorking } = await testAPIs();
    
    if (!geminiWorking) {
        console.log("⚠️ Gemini API not working - using fallback mode only...");
    }
    if (!googleBooksWorking) {
        console.log("⚠️ Google Books API not working - using basic book info...");
    }
    
    console.log("🚀 Starting book enrichment process...\n");
    
    let aiSuccess = 0;
    let googleBooksSuccess = 0;
    let fallbackCount = 0;
    let total = books.length;

    // Process first 10 books as test (change to books for all 11,000)
    const toProcess = books.slice(0, 10);

    for (let i = 0; i < toProcess.length; i++) {
        const book = toProcess[i];
        const genre = detectGenre(book);
        const current = i + 1;

        console.log(`[${current}/${toProcess.length}] 📖 ${book.title.substring(0, 45)}${book.title.length > 45 ? '...' : ''}`);
        console.log(`   Author: ${book.author || 'Unknown'}`);
        console.log(`   Genre: ${genre}`);
        
        // Fetch Google Books data
        let googleData = null;
        if (googleBooksWorking) {
            try {
                googleData = await fetchGoogleBooksData(book.title, book.author, book.isbn);
                if (googleData) {
                    console.log(`   📚 Google Books data found (${googleData.pageCount} pages, ${googleData.averageRating || 'N/A'}★)`);
                    googleBooksSuccess++;
                    
                    // Update book with Google Books data
                    book.google_books_data = googleData;
                    book.page_count = googleData.pageCount;
                    book.publisher = googleData.publisher;
                    book.published_date = googleData.publishedDate;
                    book.categories = googleData.categories;
                    book.average_rating = googleData.averageRating;
                    book.ratings_count = googleData.ratingsCount;
                } else {
                    console.log(`   ⚠️ No Google Books data found`);
                }
            } catch (error) {
                console.log(`   ❌ Google Books API error: ${error.message}`);
            }
        }
        
        // Generate AI content
        if (geminiWorking) {
            try {
                const content = await generateContent(book.title, book.author || 'Unknown', genre, googleData);
                book.ai_summary = content;
                book.engaging_content = content.substring(0, 500) + '...';
                book.content_word_count = content.length;
                book.content_genre = genre;
                book.enhanced_at = new Date().toISOString();
                
                const wordCount = calculateWordCount(googleData?.pageCount || 300, genre);
                console.log(`   ✅ AI generated! (${content.length} chars, target: ~${wordCount} words)`);
                aiSuccess++;
            } catch (error) {
                console.log(`   ⚠️ AI generation failed: ${error.message}, using enhanced fallback`);
                book.ai_summary = getFallback(book, genre, googleData);
                book.content_genre = genre;
                book.enhanced_at = new Date().toISOString();
                fallbackCount++;
            }
        } else {
            book.ai_summary = getFallback(book, genre, googleData);
            book.content_genre = genre;
            book.enhanced_at = new Date().toISOString();
            fallbackCount++;
        }

        // Save progress after each book
        fs.writeFileSync('books_ai_enriched.json', JSON.stringify(books, null, 2));
        console.log(`   💾 Progress saved`);

        // Rate limiting - wait between requests
        await new Promise(r => setTimeout(r, 2000)); // Increased to 2 seconds for better rate limiting
    }

    console.log(`\n🎉 Enrichment Complete!`);
    console.log(`📊 Statistics:`);
    console.log(`   ✅ AI success: ${aiSuccess}/${toProcess.length}`);
    console.log(`   📚 Google Books success: ${googleBooksSuccess}/${toProcess.length}`);
    console.log(`   ⚠️ Enhanced fallback used: ${fallbackCount}/${toProcess.length}`);
    console.log(`   📁 Output saved to: books_ai_enriched.json`);
    console.log(`\n💡 Next Steps:`);
    console.log(`   • To process ALL 11,000 books, change: toProcess = books`);
    console.log(`   • Configure your Google Books API key for better data`);
    console.log(`   • Monitor API usage to avoid rate limits`);
    console.log(`   • Consider batch processing for large datasets`);
}

processAll().catch(console.error);