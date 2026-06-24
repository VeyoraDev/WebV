const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const axios = require('axios');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/products', express.static('products'));
app.use('/qr', express.static('public/qr'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'VStoreSecretKey2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Create directories
['uploads', 'products'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Create public/qr directory if not exists
const qrDir = path.join(__dirname, 'public', 'qr');
if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
}

// Database
const db = new sqlite3.Database('database.db');

// Initialize database
db.serialize(() => {
    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        whatsapp TEXT NOT NULL,
        pool_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        receipt_image TEXT,
        status TEXT DEFAULT 'Menunggu Semakan',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_name TEXT,
        telegram_bot_token TEXT,
        telegram_owner_id TEXT,
        payment_qr TEXT,
        admin_username TEXT,
        admin_password TEXT
    )`);

    // Insert default admin if not exists
    db.get(`SELECT * FROM settings WHERE admin_username = 'admin'`, async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('VeyoraAdmin', 10);
            const defaultQr = 'https://files.catbox.moe/2o6t0v.jpg';
            db.run(`INSERT INTO settings (admin_username, admin_password, store_name, payment_qr) 
                    VALUES (?, ?, ?, ?)`, ['admin', hashedPassword, 'VStore', defaultQr]);
        }
    });

    // Insert default products if not exists
    db.get(`SELECT * FROM products WHERE name = '100M Coin'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO products (name, price, image, enabled) VALUES (?, ?, ?, ?)`, 
                ['100M Coin', 25, '/products/100m.png', 1]);
        }
    });

    db.get(`SELECT * FROM products WHERE name = '200M Coin'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO products (name, price, image, enabled) VALUES (?, ?, ?, ?)`, 
                ['200M Coin', 45, '/products/200m.png', 1]);
        }
    });
});

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'receipt') {
            cb(null, 'uploads/');
        } else if (file.fieldname === 'product_image') {
            cb(null, 'products/');
        } else if (file.fieldname === 'payment_qr') {
            cb(null, path.join(__dirname, 'public', 'qr'));
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Telegram notification function
async function sendTelegramNotification(orderData) {
    try {
        const settings = await getSettings();
        if (!settings.telegram_bot_token || !settings.telegram_owner_id) {
            console.log('Telegram not configured');
            return;
        }

        const message = `🛒 ORDER BARU - VStore

Nama: ${orderData.customer_name}
WhatsApp: ${orderData.whatsapp}
ID 8 Ball Pool: ${orderData.pool_id}

Produk: ${orderData.product_name}
Harga: RM${orderData.price}

Tarikh: ${new Date().toLocaleString('ms-MY')}

Status: Menunggu Semakan`;

        const url = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
        await axios.post(url, {
            chat_id: settings.telegram_owner_id,
            text: message,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Telegram notification error:', error.message);
    }
}

// Helper function to get settings
function getSettings() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM settings WHERE id = 1`, (err, row) => {
            if (err) reject(err);
            resolve(row || {});
        });
    });
}

// ============ ROUTES ============

// Get all products
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products WHERE enabled = 1 ORDER BY id`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get all products (admin)
app.get('/api/admin/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY id`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add product
app.post('/api/admin/products', upload.single('product_image'), async (req, res) => {
    try {
        const { name, price } = req.body;
        const image = req.file ? `/products/${req.file.filename}` : null;
        
        db.run(`INSERT INTO products (name, price, image, enabled) VALUES (?, ?, ?, ?)`,
            [name, price, image, 1],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ id: this.lastID, message: 'Product added successfully' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
app.put('/api/admin/products/:id', upload.single('product_image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, enabled } = req.body;
        const image = req.file ? `/products/${req.file.filename}` : null;

        let query = `UPDATE products SET name = ?, price = ?, enabled = ?`;
        let params = [name, price, enabled];

        if (image) {
            query += `, image = ?`;
            params.push(image);
        }

        query += ` WHERE id = ?`;
        params.push(id);

        db.run(query, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Product updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product
app.delete('/api/admin/products/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM products WHERE id = ?`, id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Product deleted successfully' });
    });
});

// Get orders
app.get('/api/admin/orders', (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Update order status
app.put('/api/admin/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Order status updated successfully' });
    });
});

// Create order
app.post('/api/orders', upload.single('receipt'), async (req, res) => {
    try {
        const { customer_name, whatsapp, pool_id, product_name, price } = req.body;
        const receipt_image = req.file ? `/uploads/${req.file.filename}` : null;

        db.run(`INSERT INTO orders (customer_name, whatsapp, pool_id, product_name, price, receipt_image, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [customer_name, whatsapp, pool_id, product_name, price, receipt_image, 'Menunggu Semakan'],
            async function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // Send Telegram notification
                await sendTelegramNotification({
                    customer_name,
                    whatsapp,
                    pool_id,
                    product_name,
                    price
                });

                res.json({ 
                    id: this.lastID, 
                    message: 'Tempahan berjaya dihantar dan sedang menunggu semakan.' 
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get settings
app.get('/api/admin/settings', async (req, res) => {
    try {
        const settings = await getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update settings
app.post('/api/admin/settings', upload.single('payment_qr'), async (req, res) => {
    try {
        const { 
            store_name, 
            telegram_bot_token, 
            telegram_owner_id, 
            admin_username,
            payment_qr_url
        } = req.body;
        
        let payment_qr = null;
        
        // If file uploaded, use file path
        if (req.file) {
            payment_qr = `/qr/${req.file.filename}`;
        } 
        // If URL provided, use URL
        else if (payment_qr_url && payment_qr_url.trim() !== '') {
            payment_qr = payment_qr_url.trim();
        }

        let query = `UPDATE settings SET 
                     store_name = ?, 
                     telegram_bot_token = ?, 
                     telegram_owner_id = ?, 
                     admin_username = ?`;
        let params = [store_name, telegram_bot_token, telegram_owner_id, admin_username];

        if (payment_qr) {
            query += `, payment_qr = ?`;
            params.push(payment_qr);
        }

        query += ` WHERE id = 1`;
        params.push(1);

        db.run(query, params, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Settings updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change admin password
app.post('/api/admin/change-password', async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        const settings = await getSettings();
        const isValid = await bcrypt.compare(current_password, settings.admin_password);
        
        if (!isValid) {
            res.status(400).json({ error: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        db.run(`UPDATE settings SET admin_password = ? WHERE id = 1`, [hashedPassword], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Password changed successfully' });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const settings = await getSettings();
        
        if (username !== settings.admin_username) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValid = await bcrypt.compare(password, settings.admin_password);
        
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        req.session.admin = true;
        res.json({ message: 'Login successful' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Check session
app.get('/api/admin/check-session', (req, res) => {
    res.json({ loggedIn: !!req.session.admin });
});

// Dashboard stats
app.get('/api/admin/stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const queries = {
        ordersToday: `SELECT COUNT(*) as count, SUM(price) as total FROM orders WHERE date(created_at) = date('now')`,
        ordersMonth: `SELECT COUNT(*) as count, SUM(price) as total FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
        ordersTotal: `SELECT COUNT(*) as count, SUM(price) as total FROM orders`
    };

    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (err) {
                console.error(err);
                results[key] = { count: 0, total: 0 };
            } else {
                results[key] = { count: row?.count || 0, total: row?.total || 0 };
            }
            completed++;
            if (completed === totalQueries) {
                res.json({
                    orders_today: results.ordersToday.count,
                    revenue_today: results.ordersToday.total || 0,
                    orders_month: results.ordersMonth.count,
                    revenue_month: results.ordersMonth.total || 0,
                    orders_total: results.ordersTotal.count,
                    revenue_total: results.ordersTotal.total || 0
                });
            }
        });
    });
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 VStore running on http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
    console.log(`👤 Username: admin`);
    console.log(`🔑 Password: VeyoraAdmin`);
    console.log(`📱 QR Code: https://files.catbox.moe/2o6t0v.jpg`);
});
