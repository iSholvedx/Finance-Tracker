// ====== IMPORT MODUL ======
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

// ====== KONFIGURASI FILE ======
const USERS_FILE = path.join(__dirname, 'users.json');
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ====== DISCORD WEBHOOK ======
const WEBHOOK_URL = "https://discord.com/api/webhooks/1425870787595866112/KqjO_3OawCFkWqpAM2ryZIlJDtWLu68x9nj3dK5DWeG6WJIgcK8ndGhqdG5DQxVgoRcQ";

// ====== MIDDLEWARE ======
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

// ====== UTILITAS ======
function loadJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.warn(`⚠️ File ${file} tidak ditemukan. Membuat file baru.`);
        if (file === USERS_FILE) {
            const defaultUsers = { users: [{ username: 'admin', password: 'password', pin: '1234' }] };
            fs.writeFileSync(file, JSON.stringify(defaultUsers, null, 2));
            return defaultUsers;
        } else {
            const defaultData = { expenses: [], income: [], debts: [], upcomingIncome: [] };
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ====== LOGIN GUARD ======
function requireLogin(req, res, next) {
    if (!req.cookies.session) return res.redirect('/index.html');
    next();
}

// ====== WEBHOOK DISCORD ======
// === Kirim data ke Discord Webhook ===
// === Kirim data ke Discord Webhook ===
async function sendWebhookEmbed() {
    const data = loadJSON(DATA_FILE);

    // Hitung jumlah data
    const expenseCount = data.expenses.length;
    const incomeCount = data.income.length;
    const debtCount = data.debts.length;
    const upcomingCount = data.upcomingIncome.length;

    // Hitung total nominal (ubah string ke number dulu)
    const incomeTotal = data.income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenseTotal = data.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const debtTotal = data.debts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const upcomingTotal = data.upcomingIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // Ambil pengeluaran terbaru
    const latestExpense = data.expenses[expenseCount - 1];
    const expenseText = latestExpense
        ? `🆕 **${latestExpense.description || latestExpense.name}** - ${formatRupiah(Number(latestExpense.amount))}\n📅 ${latestExpense.date || ''}`
        : "Belum ada pengeluaran.";

    const embed = {
        title: "📊 Finance Tracker - Update Otomatis",
        color: 0x00AEFF,
        fields: [
            { name: "💰 Total Income", value: `${incomeCount} data (${formatRupiah(incomeTotal)})`, inline: true },
            { name: "💸 Total Expenses", value: `${expenseCount} data (${formatRupiah(expenseTotal)})`, inline: true },
            { name: "💳 Total Debts", value: `${debtCount} data (${formatRupiah(debtTotal)})`, inline: true },
            { name: "📅 Upcoming Income", value: `${upcomingCount} data (${formatRupiah(upcomingTotal)})`, inline: true },
            { name: "🆕 Pengeluaran Terbaru", value: expenseText }
        ],
        footer: { text: `Dikirim otomatis pada ${new Date().toLocaleString('id-ID')}` },
        timestamp: new Date()
    };

    try {
        const payload = { username: "Finance Tracker Bot", embeds: [embed] };
        const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`✅ Webhook terkirim (${new Date().toLocaleTimeString()})`);
    } catch (err) {
        console.error("❌ Gagal kirim webhook:", err.message);
    }
}

// === Helper format rupiah ===
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
}


// ====== ROUTES ======

// 🔹 Halaman utama
app.get('/', (req, res) => {
    if (req.cookies.session) res.redirect('/dashboard.html');
    else res.redirect('/index.html');
});

// 🔹 Ambil users.json
app.get('/users.json', (req, res) => res.sendFile(USERS_FILE));

// 🔹 LOGIN
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadJSON(USERS_FILE);
    const user = users.users.find(u => u.username === username && u.password === password);

    if (user) {
        res.cookie('session', username, { maxAge: 3600000 }); // 1 jam
        res.json({ success: true, user: username });
    } else {
        res.json({ success: false, message: 'Username atau password salah' });
    }
});

// 🔹 REGISTER
app.post('/register', (req, res) => {
    const { username, password, pin } = req.body;
    if (!username || !password || !pin || pin.length !== 4 || isNaN(pin)) {
        return res.json({ success: false, message: 'Username, password, dan PIN (4 digit) wajib diisi' });
    }

    const users = loadJSON(USERS_FILE);
    if (users.users.find(u => u.username === username)) {
        return res.json({ success: false, message: 'Username sudah terdaftar' });
    }

    users.users.push({ username, password, pin });
    saveJSON(USERS_FILE, users);
    res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
});

// 🔹 FORGOT PASSWORD
app.post('/forgot-password', (req, res) => {
    const { username, pin } = req.body;
    const users = loadJSON(USERS_FILE);
    const user = users.users.find(u => u.username === username && u.pin === pin);

    if (user) res.json({ success: true, password: user.password, message: 'Password ditemukan!' });
    else res.json({ success: false, message: 'Username atau PIN salah' });
});

// 🔹 LOGOUT
app.post('/logout', (req, res) => {
    res.clearCookie('session');
    res.json({ success: true });
});

// === 🔸 API DATA (gabungan dari dua versi) ===

// Ambil semua data
app.get('/api/data', requireLogin, (req, res) => {
    try {
        const data = loadJSON(DATA_FILE);
        res.json(data);
    } catch (err) {
        console.error("Gagal baca data:", err);
        res.status(500).json({ error: "Gagal baca data" });
    }
});

// Simpan full data (overwrite seluruh isi data.json)
app.post('/api/data', requireLogin, (req, res) => {
    try {
        const data = req.body;
        const validData = {
            expenses: data.expenses || [],
            income: data.income || [],
            debts: data.debts || [],
            upcomingIncome: data.upcomingIncome || []
        };
        saveJSON(DATA_FILE, validData);
        res.json({ message: "Data berhasil disimpan!" });
    } catch (err) {
        console.error("Gagal simpan data:", err);
        res.status(500).json({ error: "Gagal simpan data" });
    }
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const filePath = path.join(PUBLIC_DIR, `${page}.html`);
    if (fs.existsSync(filePath)) {
        // Jika halaman membutuhkan login, cek session
        if (['dashboard'].includes(page) && !req.cookies.session) {
            return res.redirect('/index.html');
        }
        return res.sendFile(filePath);
    }
    next(); // lanjut ke 404
});

// Tambah per kategori
app.post('/api/data/:category', requireLogin, (req, res) => {
    const category = req.params.category;
    const item = req.body;
    const data = loadJSON(DATA_FILE);
    data[category].push({ id: Date.now(), ...item });
    saveJSON(DATA_FILE, data);
    res.json({ success: true });
});

// Edit per item
app.put('/api/data/:category/:id', requireLogin, (req, res) => {
    const { category, id } = req.params;
    const updatedItem = req.body;
    const data = loadJSON(DATA_FILE);
    const index = data[category].findIndex(item => item.id === parseInt(id));

    if (index !== -1) {
        data[category][index] = { ...data[category][index], ...updatedItem };
        saveJSON(DATA_FILE, data);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Hapus per item
app.delete('/api/data/:category/:id', requireLogin, (req, res) => {
    const { category, id } = req.params;
    const data = loadJSON(DATA_FILE);
    data[category] = data[category].filter(item => item.id !== parseInt(id));
    saveJSON(DATA_FILE, data);
    res.json({ success: true });
});

// ====== JALANKAN SERVER ======
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    sendWebhookEmbed();
    setInterval(sendWebhookEmbed, 30000);
});
