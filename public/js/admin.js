// Admin Portal JavaScript
class AdminPortal {
    constructor() {
        this.currentTab = 'dashboard';
        this.books = [];
        this.orders = [];
        this.users = [];
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupFileUploads();
        this.setupForms();
        this.setupImportActions();
        this.checkAuth();
        this.loadDashboard();
    }

    checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!token) {
            window.location.href = 'auth.html';
            return;
        }

        // Check if user is admin (you might want to add an admin role field)
        document.getElementById('admin-name').textContent = user.name || 'Admin User';
    }

    setupTabs() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update panels
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Load data for specific tabs
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'manage-books':
                this.loadBooks();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'users':
                this.loadUsers();
                break;
        }
    }

    setupFileUploads() {
        // Cover image upload
        const coverUpload = document.getElementById('cover-upload');
        const coverInput = document.getElementById('book-cover');
        
        coverUpload.addEventListener('click', () => coverInput.click());
        coverInput.addEventListener('change', (e) => this.handleFileSelect(e, 'cover'));

        // PDF upload
        const pdfUpload = document.getElementById('pdf-upload');
        const pdfInput = document.getElementById('book-pdf');
        
        pdfUpload.addEventListener('click', () => pdfInput.click());
        pdfInput.addEventListener('change', (e) => this.handleFileSelect(e, 'pdf'));

        // TXT upload (optional)
        const textUpload = document.getElementById('text-upload');
        const textInput = document.getElementById('book-text');
        if (textUpload && textInput) {
            textUpload.addEventListener('click', () => textInput.click());
            textInput.addEventListener('change', (e) => this.handleFileSelect(e, 'text'));
        }

        // Drag and drop
        [coverUpload, pdfUpload, textUpload].filter(Boolean).forEach(element => {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                element.classList.add('dragover');
            });
            
            element.addEventListener('dragleave', () => {
                element.classList.remove('dragover');
            });
            
            element.addEventListener('drop', (e) => {
                e.preventDefault();
                element.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const input = element.querySelector('input[type="file"]');
                    input.files = files;
                    let kind = 'pdf';
                    if (element.id.includes('cover')) kind = 'cover';
                    if (element.id.includes('text')) kind = 'text';
                    this.handleFileSelect({ target: input }, kind);
                }
            });
        });
    }

    handleFileSelect(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const uploadElement = type === 'cover' ? document.getElementById('cover-upload') : document.getElementById('pdf-upload');
        
        // Validate file
        if (type === 'cover') {
            if (!file.type.startsWith('image/')) {
                this.showMessage('Please select an image file', 'error');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                this.showMessage('Image size should be less than 10MB', 'error');
                return;
            }
        } else {
            if (type === 'pdf') {
                if (file.type !== 'application/pdf') {
                    this.showMessage('Please select a PDF file', 'error');
                    return;
                }
                if (file.size > 50 * 1024 * 1024) {
                    this.showMessage('PDF size should be less than 50MB', 'error');
                    return;
                }
            } else if (type === 'text') {
                const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
                if (!isTxt) {
                    this.showMessage('Please select a TXT file', 'error');
                    return;
                }
                if (file.size > 20 * 1024 * 1024) {
                    this.showMessage('TXT size should be less than 20MB', 'error');
                    return;
                }
            }
        }

        // Update UI
        uploadElement.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 2rem; color: #10b981; margin-bottom: 0.5rem;"></i>
            <p style="color: #10b981; font-weight: 600;">${file.name}</p>
            <p style="font-size: 0.875rem; color: #64748b;">${this.formatFileSize(file.size)}</p>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setupForms() {
        document.getElementById('add-book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });
    }

    setupImportActions() {
        const btn = document.getElementById('import-ia-btn');
        const strictBtn = document.getElementById('import-ia-strict-1000-btn');
        const out = document.getElementById('ia-import-result');

        const runImport = async (which) => {
            const activeBtn = which === 'strict' ? strictBtn : btn;
            if (!activeBtn) return;
            activeBtn.disabled = true;
            activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing...';
            if (out) {
                out.style.display = 'block';
                out.textContent = which === 'strict'
                    ? 'Starting STRICT import (Public Domain / Creative Commons only)...'
                    : 'Starting Hindi import...';
            }
            try {
                const url = which === 'strict'
                    ? '/api/admin/import/ia-strict'
                    : '/api/admin/import/internet-archive-hindi';
                const payload = which === 'strict' ? { limit: 1000 } : { limit: 50 };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify(payload),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Import failed');
                this.showMessage(`Import complete: ${data.importedCount} imported, ${data.skippedCount} skipped`, 'success');
                if (out) out.textContent = JSON.stringify(data, null, 2);
            } catch (err) {
                this.showMessage(err.message || 'Import failed', 'error');
                if (out) out.textContent = `Error: ${err.message || 'Import failed'}`;
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-download"></i> Import First 50 Hindi Books';
                }
                if (strictBtn) {
                    strictBtn.disabled = false;
                    strictBtn.innerHTML = '<i class="fas fa-shield-halved"></i> Strict PD/CC Import (up to 1000)';
                }
            }
        };

        if (btn) btn.addEventListener('click', () => runImport('hindi'));
        if (strictBtn) strictBtn.addEventListener('click', () => runImport('strict'));
    }

    async loadDashboard() {
        try {
            // Load statistics
            const booksResponse = await fetch('/api/books');
            const booksData = await booksResponse.json();
            const totalBooks = booksData.length || 0;

            const usersResponse = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const usersData = await usersResponse.json();
            const totalUsers = usersData.length || 0;

            const ordersResponse = await fetch('/api/admin/orders', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const ordersData = await ordersResponse.json();
            const totalOrders = ordersData.length || 0;
            const totalRevenue = ordersData.reduce((sum, order) => sum + (order.amount || 0), 0);

            // Update UI
            document.getElementById('total-books').textContent = totalBooks;
            document.getElementById('total-users').textContent = totalUsers;
            document.getElementById('total-orders').textContent = totalOrders;
            document.getElementById('total-revenue').textContent = `₹${totalRevenue.toLocaleString()}`;

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showMessage('Error loading dashboard data', 'error');
        }
    }

    async loadBooks() {
        const loading = document.getElementById('books-loading');
        const tbody = document.getElementById('books-tbody');
        
        try {
            loading.style.display = 'block';
            const response = await fetch('/api/books');
            const books = await response.json();
            
            tbody.innerHTML = '';
            
            books.forEach(book => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <img src="${book.cover_url || 'https://via.placeholder.com/60x80'}" 
                             alt="${book.title}" class="book-cover">
                    </td>
                    <td>
                        <div style="font-weight: 600;">${book.title}</div>
                        <div style="font-size: 0.875rem; color: #64748b;">${book.isbn || 'No ISBN'}</div>
                    </td>
                    <td>${book.author}</td>
                    <td style="font-weight: 600;">₹${book.price}</td>
                    <td>
                        <span style="background: #e2e8f0; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem;">
                            ${book.genre || 'General'}
                        </span>
                    </td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-primary btn-sm" onclick="admin.editBook(${book.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="admin.deleteBook(${book.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading books:', error);
            this.showMessage('Error loading books', 'error');
        } finally {
            loading.style.display = 'none';
        }
    }

    async loadOrders() {
        const loading = document.getElementById('orders-loading');
        const tbody = document.getElementById('orders-tbody');
        
        try {
            loading.style.display = 'block';
            const response = await fetch('/api/admin/orders', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const orders = await response.json();
            
            tbody.innerHTML = '';
            
            orders.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="font-weight: 600;">#${order.id}</td>
                    <td>${order.customer_name || 'Unknown'}</td>
                    <td>${order.book_title || 'Unknown'}</td>
                    <td style="font-weight: 600;">₹${order.amount || 0}</td>
                    <td>
                        <span class="status-badge status-${order.status || 'pending'}">
                            ${order.status || 'Pending'}
                        </span>
                    </td>
                    <td>${new Date(order.created_at).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showMessage('Error loading orders', 'error');
        } finally {
            loading.style.display = 'none';
        }
    }

    async loadUsers() {
        const loading = document.getElementById('users-loading');
        const tbody = document.getElementById('users-tbody');
        
        try {
            loading.style.display = 'block';
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const users = await response.json();
            
            tbody.innerHTML = '';
            
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="font-weight: 600;">${user.id}</td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || 'N/A'}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Error loading users:', error);
            this.showMessage('Error loading users', 'error');
        } finally {
            loading.style.display = 'none';
        }
    }

    async addBook() {
        const form = document.getElementById('add-book-form');
        const formData = new FormData(form);
        
        // Validate required files
        const coverFile = document.getElementById('book-cover').files[0];
        const pdfFile = document.getElementById('book-pdf').files[0];
        const textFile = document.getElementById('book-text')?.files?.[0] || null;
        
        if (!coverFile || !pdfFile) {
            this.showMessage('Please upload both cover image and PDF file', 'error');
            return;
        }

        try {
            this.showMessage('Adding book...', 'success');
            
            // First upload files
            const uploadData = new FormData();
            uploadData.append('cover', coverFile);
            uploadData.append('pdf', pdfFile);
            if (textFile) uploadData.append('text', textFile);
            
            const uploadResponse = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: uploadData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('File upload failed');
            }
            
            const uploadResult = await uploadResponse.json();
            
            // Then add book with file URLs
            const bookData = {
                title: formData.get('title'),
                author: formData.get('author'),
                isbn: formData.get('isbn'),
                price: parseFloat(formData.get('price')),
                genre: formData.get('genre'),
                publisher: formData.get('publisher'),
                pages: parseInt(formData.get('pages')) || null,
                language: formData.get('language'),
                description: formData.get('description'),
                cover_url: uploadResult.coverUrl,
                pdf_url: uploadResult.pdfUrl,
                text_url: uploadResult.textUrl || null,
                full_content_text: uploadResult.fullContentText || ''
            };
            
            const response = await fetch('/api/admin/books', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(bookData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to add book');
            }
            
            this.showMessage('Book added successfully!', 'success');
            form.reset();
            
            // Reset file upload UI
            document.getElementById('cover-upload').innerHTML = `
                <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #64748b; margin-bottom: 0.5rem;"></i>
                <p>Click to upload or drag and drop</p>
                <p style="font-size: 0.875rem; color: #64748b;">PNG, JPG up to 10MB</p>
                <input type="file" id="book-cover" accept="image/*" style="display: none;" required>
            `;
            
            document.getElementById('pdf-upload').innerHTML = `
                <i class="fas fa-file-pdf" style="font-size: 2rem; color: #64748b; margin-bottom: 0.5rem;"></i>
                <p>Click to upload or drag and drop</p>
                <p style="font-size: 0.875rem; color: #64748b;">PDF up to 50MB</p>
                <input type="file" id="book-pdf" accept="application/pdf" style="display: none;" required>
            `;
            const textUpload = document.getElementById('text-upload');
            if (textUpload) {
                textUpload.innerHTML = `
                    <i class="fas fa-file-alt" style="font-size: 2rem; color: #64748b; margin-bottom: 0.5rem;"></i>
                    <p>Click to upload or drag and drop</p>
                    <p style="font-size: 0.875rem; color: #64748b;">TXT up to 20MB</p>
                    <input type="file" id="book-text" accept=".txt,text/plain" style="display: none;">
                `;
            }
            
            // Re-setup file uploads after reset
            this.setupFileUploads();
            
            // Switch to manage books tab
            setTimeout(() => this.switchTab('manage-books'), 1500);
            
        } catch (error) {
            console.error('Error adding book:', error);
            this.showMessage('Error adding book: ' + error.message, 'error');
        }
    }

    editBook(bookId) {
        // TODO: Implement edit book functionality
        this.showMessage('Edit functionality coming soon', 'success');
    }

    async deleteBook(bookId) {
        if (!confirm('Are you sure you want to delete this book?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/books/${bookId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete book');
            }
            
            this.showMessage('Book deleted successfully', 'success');
            this.loadBooks(); // Reload books list
            
        } catch (error) {
            console.error('Error deleting book:', error);
            this.showMessage('Error deleting book', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                messageEl.className = 'message';
                messageEl.textContent = '';
            }, 3000);
        }
    }
}

// Initialize admin portal
const admin = new AdminPortal();

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'auth.html';
}

// Add status badge styles
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 600;
    }
    .status-pending {
        background: #fef3c7;
        color: #92400e;
    }
    .status-completed {
        background: #ecfdf5;
        color: #047857;
    }
    .status-failed {
        background: #fef2f2;
        color: #b91c1c;
    }
`;
document.head.appendChild(style);
