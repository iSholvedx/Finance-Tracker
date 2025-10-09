const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

// File paths
const USERS_FILE = 'users.json';
const DATA_FILE = 'data.json';

// Load JSON files
function loadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if (file === USERS_FILE) {
            // Default user jika file kosong
            const defaultUsers = { users: [{ username: 'admin', password: 'password' }] };
            fs.writeFileSync(file, JSON.stringify(defaultUsers, null, 2));
            return defaultUsers;
        } else {
            // Default data kosong
            const defaultData = { expenses: [], income: [], debts: [], upcomingIncome: [] };
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Middleware untuk check login
function requireLogin(req, res, next) {
    const session = req.cookies.session;
    if (!session) {
        return res.redirect('/index.html');
    }
    next();
}

// API Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadJSON(USERS_FILE);
    const user = users.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        res.cookie('session', username, { maxAge: 3600000 }); // 1 jam
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Username atau password salah' });
    }
});

// API Logout
app.post('/logout', (req, res) => {
    res.clearCookie('session');
    res.json({ success: true });
});

// API untuk data (hanya jika login)
app.get('/api/data', requireLogin, (req, res) => {
    const data = loadJSON(DATA_FILE);
    res.json(data);
});

app.post('/api/data/:category', requireLogin, (req, res) => {
    const category = req.params.category;
    const item = req.body;
    const data = loadJSON(DATA_FILE);
    data[category].push({ id: Date.now(), ...item }); // ID unik berdasarkan timestamp
    saveJSON(DATA_FILE, data);
    res.json({ success: true });
});

app.put('/api/data/:category/:id', requireLogin, (req, res) => {
    const category = req.params.category;
    const id = parseInt(req.params.id);
    const updatedItem = req.body;
    const data = loadJSON(DATA_FILE);
    const index = data[category].findIndex(item => item.id === id);
    if (index !== -1) {
        data[category][index] = { ...data[category][index], ...updatedItem };
        saveJSON(DATA_FILE, data);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.delete('/api/data/:category/:id', requireLogin, (req, res) => {
    const category = req.params.category;
    const id = parseInt(req.params.id);
    const data = loadJSON(DATA_FILE);
    data[category] = data[category].filter(item => item.id !== id);
    saveJSON(DATA_FILE, data);
    res.json({ success: true });
});

// Serve login page jika belum login
app.get('/', (req, res) => {
    if (req.cookies.session) {
        res.redirect('/dashboard.html');
    } else {
        res.redirect('/index.html');
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});