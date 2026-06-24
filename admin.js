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
