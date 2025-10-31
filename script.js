// Global variables
let currentUser = null;
let isAdmin = false;
let allContent = [];
let authToken = null;

// API Base URL
const API_BASE = 'http://localhost:3000/api';

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const adminBtn = document.getElementById('adminBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const adminModal = document.getElementById('adminModal');
const contentGrid = document.getElementById('contentGrid');
const loginForm = document.getElementById('loginForm');
const addContentForm = document.getElementById('addContentForm');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadContent();
});

function initializeApp() {
    // Check if user is logged in (from localStorage)
    const savedUser = localStorage.getItem('currentUser');
    const savedToken = localStorage.getItem('authToken');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        authToken = savedToken;
        isAdmin = currentUser.userType === 'admin';
        updateUI();
    }
}

function setupEventListeners() {
    // Login button
    loginBtn.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    // Admin button
    adminBtn.addEventListener('click', () => {
        adminModal.style.display = 'block';
        loadContentManagement();
    });

    // Logout button
    logoutBtn.addEventListener('click', logout);

    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Login form
    loginForm.addEventListener('submit', handleLogin);

    // Add content form
    addContentForm.addEventListener('submit', handleAddContent);

    // Content type change
    document.getElementById('contentType').addEventListener('change', handleContentTypeChange);

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterContent(e.target.dataset.filter);
        });
    });

    // Admin tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
        });
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');
    const userType = formData.get('userType');

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, userType })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            authToken = data.token;
            isAdmin = currentUser.userType === 'admin';
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('authToken', authToken);
            
            updateUI();
            loginModal.style.display = 'none';
            showMessage('Login successful!', 'success');
            loadContent(); // Reload content after login
        } else {
            showMessage(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

function logout() {
    currentUser = null;
    isAdmin = false;
    authToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateUI();
    showMessage('Logged out successfully!', 'success');
}

function updateUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        if (isAdmin) {
            adminBtn.style.display = 'inline-block';
        }
    } else {
        loginBtn.style.display = 'inline-block';
        adminBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

function handleContentTypeChange() {
    const contentType = document.getElementById('contentType').value;
    const codeGroup = document.getElementById('codeGroup');
    const fileGroup = document.getElementById('fileGroup');

    if (contentType === 'code') {
        codeGroup.style.display = 'block';
        fileGroup.style.display = 'none';
    } else if (contentType === 'files') {
        codeGroup.style.display = 'none';
        fileGroup.style.display = 'block';
    } else {
        codeGroup.style.display = 'none';
        fileGroup.style.display = 'none';
    }
}

async function handleAddContent(e) {
    e.preventDefault();
    const formData = new FormData(addContentForm);
    const contentType = formData.get('contentType');
    const title = formData.get('title');
    const description = formData.get('description');
    const code = formData.get('code');
    const file = formData.get('file');

    try {
        let response;
        
        if (contentType === 'files' && file && file.size > 0) {
            // Handle file upload
            const uploadFormData = new FormData();
            uploadFormData.append('title', title);
            uploadFormData.append('description', description);
            uploadFormData.append('file', file);

            response = await fetch(`${API_BASE}/content/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: uploadFormData
            });
        } else {
            // Handle code/notes
            response = await fetch(`${API_BASE}/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    type: contentType,
                    content: contentType === 'code' ? code : (contentType === 'notes' ? code : null)
                })
            });
        }

        const data = await response.json();

        if (response.ok) {
            addContentForm.reset();
            showMessage('Content added successfully!', 'success');
            loadContent();
            loadContentManagement();
        } else {
            showMessage(data.message || 'Failed to add content', 'error');
        }
    } catch (error) {
        console.error('Error adding content:', error);
        showMessage('Network error adding content', 'error');
    }
}

async function loadContent() {
    try {
        const response = await fetch(`${API_BASE}/content`);
        if (response.ok) {
            allContent = await response.json();
            displayContent(allContent);
        } else {
            console.error('Failed to load content');
            showMessage('Failed to load content', 'error');
        }
    } catch (error) {
        console.error('Error loading content:', error);
        showMessage('Network error loading content', 'error');
    }
}

function displayContent(content) {
    contentGrid.innerHTML = '';
    
    if (content.length === 0) {
        contentGrid.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">No content available.</p>';
        return;
    }

    content.forEach(item => {
        const contentCard = createContentCard(item);
        contentGrid.appendChild(contentCard);
    });
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.type = item.type;

    const typeColors = {
        'code': '#28a745',
        'notes': '#17a2b8',
        'files': '#ffc107'
    };

    const typeIcons = {
        'code': 'fas fa-code',
        'notes': 'fas fa-sticky-note',
        'files': 'fas fa-file'
    };

    card.innerHTML = `
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        ${item.type === 'code' && item.content ? `<div class="code-block">${escapeHtml(item.content)}</div>` : ''}
        ${item.type === 'notes' && item.content ? `<p><strong>Notes:</strong> ${item.content}</p>` : ''}
        ${item.type === 'files' ? `<p><i class="fas fa-download"></i> <a href="#" onclick="downloadFile('${item._id}')">Download ${item.fileName}</a></p>` : ''}
        <div class="content-meta">
            <span class="content-type" style="background: ${typeColors[item.type]}">
                <i class="${typeIcons[item.type]}"></i> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </span>
            <span class="content-date">${new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
    `;

    return card;
}

function filterContent(filter) {
    let filteredContent = allContent;
    
    if (filter !== 'all') {
        filteredContent = allContent.filter(item => item.type === filter);
    }
    
    displayContent(filteredContent);
}

async function loadContentManagement() {
    const contentList = document.getElementById('contentList');
    contentList.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE}/content`);
        if (response.ok) {
            const content = await response.json();
            
            content.forEach(item => {
                const contentItem = document.createElement('div');
                contentItem.className = 'content-item';
                contentItem.innerHTML = `
                    <div>
                        <h4>${item.title}</h4>
                        <p>Type: ${item.type} | Author: ${item.author} | Date: ${new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="content-actions">
                        <button class="btn btn-primary btn-small" onclick="editContent('${item._id}')">Edit</button>
                        <button class="btn btn-danger btn-small" onclick="deleteContent('${item._id}')">Delete</button>
                    </div>
                `;
                contentList.appendChild(contentItem);
            });
        }
    } catch (error) {
        console.error('Error loading content management:', error);
    }
}

async function editContent(id) {
    try {
        const response = await fetch(`${API_BASE}/content/${id}`);
        if (response.ok) {
            const item = await response.json();
            
            // Pre-fill the form with existing data
            document.getElementById('contentType').value = item.type;
            document.getElementById('title').value = item.title;
            document.getElementById('description').value = item.description;
            if (item.content) {
                document.getElementById('code').value = item.content;
            }
            
            // Switch to add content tab
            document.querySelector('[data-tab="add-content"]').click();
            handleContentTypeChange();
            
            // Update form to edit mode
            addContentForm.dataset.editId = id;
            addContentForm.querySelector('button[type="submit"]').textContent = 'Update Content';
        }
    } catch (error) {
        console.error('Error loading content for edit:', error);
        showMessage('Error loading content for editing', 'error');
    }
}

async function deleteContent(id) {
    if (confirm('Are you sure you want to delete this content?')) {
        try {
            const response = await fetch(`${API_BASE}/content/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (response.ok) {
                showMessage('Content deleted successfully!', 'success');
                loadContent();
                loadContentManagement();
            } else {
                const data = await response.json();
                showMessage(data.message || 'Failed to delete content', 'error');
            }
        } catch (error) {
            console.error('Error deleting content:', error);
            showMessage('Network error deleting content', 'error');
        }
    }
}

function downloadFile(id) {
    window.open(`${API_BASE}/download/${id}`, '_blank');
}

function scrollToContent() {
    document.getElementById('content').scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.insertBefore(messageDiv, document.body.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Update the add content form to handle both add and edit
addContentForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(addContentForm);
    const contentType = formData.get('contentType');
    const title = formData.get('title');
    const description = formData.get('description');
    const code = formData.get('code');
    const file = formData.get('file');

    const editId = addContentForm.dataset.editId;
    
    if (editId) {
        // Update existing content
        try {
            const response = await fetch(`${API_BASE}/content/${editId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    type: contentType,
                    content: contentType === 'code' ? code : (contentType === 'notes' ? code : null)
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('Content updated successfully!', 'success');
                addContentForm.reset();
                addContentForm.removeAttribute('data-edit-id');
                addContentForm.querySelector('button[type="submit"]').textContent = 'Add Content';
                loadContent();
                loadContentManagement();
            } else {
                showMessage(data.message || 'Failed to update content', 'error');
            }
        } catch (error) {
            console.error('Error updating content:', error);
            showMessage('Network error updating content', 'error');
        }
    } else {
        // Add new content
        handleAddContent(e);
    }
});
