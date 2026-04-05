const bcrypt = require('bcrypt');

module.exports = function (db) {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            phone TEXT,
            password_hash TEXT,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Books Table
        db.run(`CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            author TEXT,
            description TEXT,
            price INTEGER,
            cover_url TEXT,
            genre TEXT,
            is_featured BOOLEAN DEFAULT 0,
            sample_content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            razorpay_order_id TEXT UNIQUE,
            razorpay_payment_id TEXT,
            user_id INTEGER,
            amount INTEGER,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Order Items Table
        db.run(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            book_id INTEGER,
            price_at_purchase INTEGER,
            FOREIGN KEY (order_id) REFERENCES orders (id),
            FOREIGN KEY (book_id) REFERENCES books (id)
        )`);

        // User Library Table
        db.run(`CREATE TABLE IF NOT EXISTS user_library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (book_id) REFERENCES books (id)
        )`);

        // Wishlist Table
        db.run(`CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (book_id) REFERENCES books (id)
        )`);

        // Seed Sample Books if Empty
        db.get("SELECT COUNT(*) AS count FROM books", (err, row) => {
            if (!err && row.count === 0) {
                console.log("Seeding sample books...");
                const sampleBooks = [
                    {
                        title: "The Midnight Library", 
                        author: "Matt Haig", 
                        price: 399, 
                        genre: "Fiction",
                        cover_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=600&auto=format&fit=crop",
                        description: "Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices... Would you have done anything different, if you had the chance to undo your regrets? A dazzling novel about all the choices that go into a life well lived.",
                        is_featured: 1,
                        sample_content: "<h2>Chapter 1: A Conversation About Rain</h2><p>Nineteen years before she decided to die, Nora Seed sat in the warmth of the small library at Hazeldene School in the town of Bedford.</p><p>She sat at a low table staring at a chess board. 'Nora dear, it's natural to worry about your future,' said Mrs Elm, the librarian, her eyes twinkling.</p>"
                    },
                    {
                        title: "Atomic Habits", 
                        author: "James Clear", 
                        price: 499, 
                        genre: "Self-Help",
                        cover_url: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=600&auto=format&fit=crop",
                        description: "No matter your goals, Atomic Habits offers a proven framework for improving--every day. James Clear, one of the world's leading experts on habit formation, reveals practical strategies that will teach you exactly how to form good habits, break bad ones, and master the tiny behaviors that lead to remarkable results. If you're having trouble changing your habits, the problem isn't you. The problem is your system.",
                        is_featured: 1,
                        sample_content: "<h2>Introduction</h2><p>My story begins on the last day of my sophomore year of high school. I was hit in the face with a baseball bat. It wasn't an intentional strike, but the bat slipped out of my teammate's hands, flew through the air, and struck me right between the eyes. My nose was smashed into a distorted U-shape. The collision sent the soft tissue of my brain slamming into the inside of my skull.</p>"
                    },
                    {
                        title: "Project Hail Mary", 
                        author: "Andy Weir", 
                        price: 449, 
                        genre: "Sci-Fi",
                        cover_url: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=600&auto=format&fit=crop",
                        description: "Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself will perish. Except that right now, he doesn't know that. He can't even remember his own name, let alone the nature of his assignment or how to complete it. All he knows is that he's been asleep for a very, very long time. And he's just been awakened to find himself millions of miles from home.",
                        is_featured: 1,
                        sample_content: "<h2>Chapter 1</h2><p>I wake up.</p><p>First thing I noticed is my mind functioning. I'm thinking. I have thoughts. I'm a conscious entity. The second thing I notice is I'm warm. The third thing is that I'm hurting. I groan. A bright light shines in my eyes. I try to close them but they are already closed.</p>"
                    },
                    {
                        title: "Dune", 
                        author: "Frank Herbert", 
                        price: 599, 
                        genre: "Fiction",
                        cover_url: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=600&auto=format&fit=crop",
                        description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness. Coveted across the known universe, melange is a prize worth killing for...",
                        is_featured: 1,
                        sample_content: "<h2>Book One: Dune</h2><p>A beginning is the time for taking the most delicate care that the balances are correct. This every sister of the Bene Gesserit knows. To begin your study of the life of Muad'Dib, then, take care that you first place him in his time: born in the 57th year of the Padishah Emperor, Shaddam IV.</p>"
                    },
                    {
                        title: "The Psychology of Money", 
                        author: "Morgan Housel", 
                        price: 349, 
                        genre: "Finance",
                        cover_url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600&auto=format&fit=crop",
                        description: "Doing well with money isn't necessarily about what you know. It's about how you behave. And behavior is hard to teach, even to really smart people. Money—investing, personal finance, and business decisions—is typically taught as a math-based field, where data and formulas tell us exactly what to do. But in the real world people don't make financial decisions on a spreadsheet.",
                        is_featured: 0,
                        sample_content: "<h2>Introduction</h2><p>The premise of this book is that doing well with money has a little to do with how smart you are and a lot to do with how you behave. Ronald Read was a philanthropist, investor, janitor, and gas station attendant. He fixed cars for 25 years. He died at age 92. And he left behind an $8 million fortune.</p>"
                    },
                    {
                        title: "Clean Code", 
                        author: "Robert Martin", 
                        price: 699, 
                        genre: "Tech",
                        cover_url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop",
                        description: "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees. Every year, countless hours and significant resources are lost because of poorly written code. But it doesn't have to be that way. Noted software expert Robert C. Martin presents a revolutionary paradigm with Clean Code.",
                        is_featured: 0,
                        sample_content: "<h2>Chapter 1: Clean Code</h2><p>You are reading this book for two reasons. First, you are a programmer. Second, you want to be a better programmer. Good. We need better programmers. It is easy to write code that a computer can understand. Good programmers write code that humans can understand.</p>"
                    },
                    {
                        title: "Becoming", 
                        author: "Michelle Obama", 
                        price: 449, 
                        genre: "Biography",
                        cover_url: "https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?q=80&w=600&auto=format&fit=crop",
                        description: "In a life filled with meaning and accomplishment, Michelle Obama has emerged as one of the most iconic and compelling women of our era. As First Lady of the United States of America—the first African American to serve in that role—she helped create the most welcoming and inclusive White House in history.",
                        is_featured: 0,
                        sample_content: "<h2>Preface</h2><p>When I was a kid, my aspirations were simple. I wanted a dog. I wanted a house that had stairs in it—two floors for one family. I wanted, for some reason, a four-door station wagon instead of the two-door Buick that was my father's pride and joy. I used to tell people that when I grew up, I was going to be a pediatrician. Why? Because I loved being around little kids.</p>"
                    },
                    {
                        title: "Ikigai", 
                        author: "Hector Garcia", 
                        price: 299, 
                        genre: "Self-Help",
                        cover_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600&auto=format&fit=crop",
                        description: "According to the Japanese, everyone has an ikigai—a reason for living. And according to the residents of the Japanese village with the world's longest-living people, finding it is the key to a happier and longer life. Having a strong sense of ikigai—the place where passion, mission, vocation, and profession intersect—means that each day is infused with meaning.",
                        is_featured: 0,
                        sample_content: "<h2>Prologue</h2><p>IKIGAI: A MYSTERIOUS WORD. This book first came into being on a rainy night in Tokyo, when its authors sat down together for the first time in one of the city's tiny bars. We had read each other's work but had never met, thanks to the thousands of miles that separate Barcelona from the capital of Japan.</p>"
                    }
                ];

                const stmt = db.prepare(`INSERT INTO books (title, author, description, price, cover_url, genre, is_featured, sample_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                sampleBooks.forEach(b => {
                    stmt.run(b.title, b.author, b.description, b.price, b.cover_url, b.genre, b.is_featured, b.sample_content);
                });
                stmt.finalize();

                // Create default admin user
                const passHash = bcrypt.hashSync('admin123', 10);
                db.run(`INSERT INTO users (name, email, password_hash, is_admin) VALUES ('Admin', 'admin@example.com', ?, 1)`, [passHash]);
            }
        });
    });
};
