const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/timon', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Content Schema
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['code', 'notes', 'files'], required: true },
    content: { type: String }, // For code and notes
    filePath: { type: String }, // For uploaded files
    fileName: { type: String }, // Original filename
    author: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Allow all file types for study purposes
        cb(null, true);
    }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Routes

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            password: hashedPassword,
            userType: userType || 'user'
        });

        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password, userType } = req.body;

        // Find user
        const user = await User.findOne({ username, userType });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, username: user.username, userType: user.userType },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                userType: user.userType
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Content Routes
app.get('/api/content', async (req, res) => {
    try {
        const { type } = req.query;
        let filter = {};
        if (type && type !== 'all') {
            filter.type = type;
        }

        const content = await Content.find(filter).sort({ createdAt: -1 });
        res.json(content);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/content', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, type, content } = req.body;
        
        const newContent = new Content({
            title,
            description,
            type,
            content,
            author: req.user.username
        });

        await newContent.save();
        res.status(201).json({ message: 'Content created successfully', content: newContent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/content/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { title, description } = req.body;
        
        const newContent = new Content({
            title,
            description,
            type: 'files',
            filePath: req.file.path,
            fileName: req.file.originalname,
            author: req.user.username
        });

        await newContent.save();
        res.status(201).json({ message: 'File uploaded successfully', content: newContent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/content/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({ message: 'Content not found' });
        }
        res.json(content);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/content/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, type, content } = req.body;
        
        const updatedContent = await Content.findByIdAndUpdate(
            req.params.id,
            { title, description, type, content },
            { new: true }
        );

        if (!updatedContent) {
            return res.status(404).json({ message: 'Content not found' });
        }

        res.json({ message: 'Content updated successfully', content: updatedContent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.delete('/api/content/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) {
            return res.status(404).json({ message: 'Content not found' });
        }

        // Delete file if it exists
        if (content.filePath && fs.existsSync(content.filePath)) {
            fs.unlinkSync(content.filePath);
        }

        await Content.findByIdAndDelete(req.params.id);
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/download/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content || content.type !== 'files') {
            return res.status(404).json({ message: 'File not found' });
        }

        if (!fs.existsSync(content.filePath)) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        res.download(content.filePath, content.fileName);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Initialize default admin user
async function initializeDefaultUsers() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                userType: 'admin'
            });
            await admin.save();
            console.log('Default admin user created (username: admin, password: admin123)');
        }

        const userExists = await User.findOne({ username: 'user' });
        if (!userExists) {
            const hashedPassword = await bcrypt.hash('user123', 10);
            const user = new User({
                username: 'user',
                password: hashedPassword,
                userType: 'user'
            });
            await user.save();
            console.log('Default user created (username: user, password: user123)');
        }
    } catch (error) {
        console.error('Error initializing default users:', error);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeDefaultUsers();
});
