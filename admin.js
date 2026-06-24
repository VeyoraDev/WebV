// Check login status
async function checkSession() {
    try {
        const response = await fetch('/api/admin/check-session');
        const data = await response.json();
        if (data.loggedIn) {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminContainer').style.display = 'block';
            loadDashboard();
            loadProducts();
            loadOrders();
            loadSettings();
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminContainer').style.display = 'block';
            document.getElementById('loginError').textContent = '';
            loadDashboard();
            loadProducts();
            loadOrders();
            loadSettings();
        } else {
            document.getElementById('loginError').textContent = 'Username atau password salah!';
        }
    } catch (error) {
        document.getElementById('loginError').textContent = 'Ralat server. Sila cuba lagi.';
    }
});

// Logout
async function logout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('adminContainer').style.display = 'none';
        document.getElementById('loginPassword').value = '';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Show tab
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'products') loadProducts();
    if (tabId === 'orders') loadOrders();
    if (tabId === 'settings') loadSettings();
}

// Load dashboard stats
async function loadDashboard() {
    try {
        const response = await fetch('/api/admin/stats');
        const stats = await response.json();
        
        document.getElementById('ordersToday').textContent = stats.orders_today || 0;
        document.getElementById('ordersMonth').textContent = stats.orders_month || 0;
        document.getElementById('revenueToday').textContent = `RM${(stats.revenue_today || 0).toFixed(2)}`;
        document.getElementById('revenueMonth').textContent = `RM${(stats.revenue_month || 0).toFixed(2)}`;
        document.getElementById('revenueTotal').textContent = `RM${(stats.revenue_total || 0).toFixed(2)}`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load products
async function loadProducts() {
    try {
        const response = await fetch('/api/admin/products');
        const products = await response.json();
        renderProductsTable(products);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';
    
    products.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.id}</td>
            <td><img src="${product.image || '/products/default.png'}" alt="${product.name}"></td>
            <td>${product.name}</td>
            <td>RM${product.price}</td>
            <td><span class="status-badge ${product.enabled ? 'status-dibayar' : 'status-ditolak'}">${product.enabled ? 'Aktif' : 'Tutup'}</span></td>
            <td>
                <button class="btn-action btn-edit" onclick="editProduct(${product.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-delete" onclick="deleteProduct(${product.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Show add product modal
function showAddProduct() {
    document.getElementById('addProductModal').classList.add('active');
    document.getElementById('addProductForm').reset();
}

// Add product
document.getElementById('addProductForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value);
    formData.append('price', document.getElementById('productPrice').value);
    formData.append('product_image', document.getElementById('productImage').files[0]);
    
    try {
        const response = await fetch('/api/admin/products', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            closeModal('addProductModal');
            loadProducts();
            alert('Produk berjaya ditambah!');
        } else {
            const result = await response.json();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
});

// Edit product
async function editProduct(id) {
    try {
        const response = await fetch('/api/admin/products');
        const products = await response.json();
        const product = products.find(p => p.id === id);
        
        if (product) {
            document.getElementById('editProductId').value = product.id;
            document.getElementById('editProductName').value = product.name;
            document.getElementById('editProductPrice').value = product.price;
            document.getElementById('editProductStatus').value = product.enabled;
            document.getElementById('editProductModal').classList.add('active');
        }
    } catch (error) {
        console.error('Error loading product:', error);
    }
}

// Update product
document.getElementById('editProductForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('editProductId').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('editProductName').value);
    formData.append('price', document.getElementById('editProductPrice').value);
    formData.append('enabled', document.getElementById('editProductStatus').value);
    formData.append('product_image', document.getElementById('editProductImage').files[0]);
    
    try {
        const response = await fetch(`/api/admin/products/${id}`, {
            method: 'PUT',
            body: formData
        });
        
        if (response.ok) {
            closeModal('editProductModal');
            loadProducts();
            alert('Produk berjaya dikemaskini!');
        } else {
            const result = await response.json();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
});

// Delete product
async function deleteProduct(id) {
    if (!confirm('Anda pasti mahu padam produk ini?')) return;
    
    try {
        const response = await fetch(`/api/admin/products/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadProducts();
            alert('Produk berjaya dipadam!');
        } else {
            const result = await response.json();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
}

// Load orders
async function loadOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        const orders = await response.json();
        renderOrdersTable(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #888;">Tiada tempahan</td></tr>';
        return;
    }
    
    orders.forEach(order => {
        const tr = document.createElement('tr');
        const statusClass = {
            'Menunggu Semakan': 'status-menunggu',
            'Dibayar': 'status-dibayar',
            'Sedang Diproses': 'status-proses',
            'Selesai': 'status-selesai',
            'Ditolak': 'status-ditolak'
        }[order.status] || '';
        
        tr.innerHTML = `
            <td>${order.id}</td>
            <td>${order.customer_name}</td>
            <td>${order.whatsapp}</td>
            <td>${order.pool_id}</td>
            <td>${order.product_name}</td>
            <td>RM${order.price}</td>
            <td><span class="status-badge ${statusClass}">${order.status}</span></td>
            <td>
                ${order.receipt_image ? `<a href="${order.receipt_image}" target="_blank"><i class="fas fa-image"></i> Lihat</a>` : '-'}
            </td>
            <td>${new Date(order.created_at).toLocaleDateString('ms-MY')}</td>
            <td>
                <select onchange="updateOrderStatus(${order.id}, this.value)" class="btn-action-sm">
                    <option value="Menunggu Semakan" ${order.status === 'Menunggu Semakan' ? 'selected' : ''}>Menunggu</option>
                    <option value="Dibayar" ${order.status === 'Dibayar' ? 'selected' : ''}>Dibayar</option>
                    <option value="Sedang Diproses" ${order.status === 'Sedang Diproses' ? 'selected' : ''}>Diproses</option>
                    <option value="Selesai" ${order.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                    <option value="Ditolak" ${order.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update order status
async function updateOrderStatus(id, status) {
    try {
        const response = await fetch(`/api/admin/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            loadOrders();
        } else {
            const result = await response.json();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
}

// Load settings
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        const settings = await response.json();
        
        document.getElementById('storeName').value = settings.store_name || '';
        document.getElementById('adminUsername').value = settings.admin_username || '';
        document.getElementById('telegramBotToken').value = settings.telegram_bot_token || '';
        document.getElementById('telegramOwnerId').value = settings.telegram_owner_id || '';
        
        if (settings.payment_qr) {
            const preview = document.getElementById('qrPreview');
            preview.style.display = 'block';
            preview.querySelector('img').src = settings.payment_qr;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Update settings
document.getElementById('settingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('store_name', document.getElementById('storeName').value);
    formData.append('admin_username', document.getElementById('adminUsername').value);
    formData.append('telegram_bot_token', document.getElementById('telegramBotToken').value);
    formData.append('telegram_owner_id', document.getElementById('telegramOwnerId').value);
    formData.append('payment_qr', document.getElementById('paymentQr').files[0]);
    
    try {
        const response = await fetch('/api/admin/settings', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Tetapan berjaya disimpan!');
            loadSettings();
        } else {
            const result = await response.json();
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
});

// Change password
document.getElementById('passwordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    
    if (newPassword.length < 6) {
        alert('Password baru mestilah sekurang-kurangnya 6 aksara.');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Password berjaya ditukar!');
            document.getElementById('passwordForm').reset();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Ralat server. Sila cuba lagi.');
    }
});

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Close modal on click outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});

// Mobile navigation toggle
document.getElementById('adminNavToggle').addEventListener('click', function() {
    document.querySelector('.nav-links').classList.toggle('active');
});

// Auto login check
checkSession();

// Auto refresh stats every 30 seconds
setInterval(() => {
    if (document.getElementById('dashboard').classList.contains('active')) {
        loadDashboard();
    }
}, 30000);
