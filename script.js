// Load products
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        renderProducts(products);
        populateProductSelect(products);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #888;">Tiada produk tersedia</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const status = product.enabled ? 'available' : 'closed';
        const statusText = product.enabled ? 'Tersedia' : 'CLOSED';
        
        card.innerHTML = `
            <div class="product-image">
                <img src="${product.image || '/products/default.png'}" alt="${product.name}">
            </div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">RM${product.price}</div>
            <div class="product-status ${status}">${statusText}</div>
            <button class="btn-buy" onclick="selectProduct(${product.id})" ${!product.enabled ? 'disabled' : ''}>
                ${product.enabled ? '<i class="fas fa-shopping-cart"></i> Beli' : 'Tutup'}
            </button>
        `;
        
        grid.appendChild(card);
    });
}

function populateProductSelect(products) {
    const select = document.getElementById('productSelect');
    select.innerHTML = '<option value="">-- Pilih Produk --</option>';
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} - RM${product.price}`;
        select.appendChild(option);
    });
}

function selectProduct(productId) {
    const select = document.getElementById('productSelect');
    select.value = productId;
    document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
}

// Load QR
async function loadQR() {
    try {
        const response = await fetch('/api/admin/settings');
        const settings = await response.json();
        
        if (settings.payment_qr) {
            document.querySelector('#qrDisplay img').src = settings.payment_qr;
        }
    } catch (error) {
        console.error('Error loading QR:', error);
    }
}

// Handle checkout
document.getElementById('checkoutForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const productSelect = document.getElementById('productSelect');
    const productId = productSelect.value;
    const productName = productSelect.options[productSelect.selectedIndex].text.split(' - ')[0];
    const price = productSelect.options[productSelect.selectedIndex].text.split('RM')[1] || '0';
    
    formData.append('customer_name', document.getElementById('customerName').value);
    formData.append('whatsapp', document.getElementById('whatsapp').value);
    formData.append('pool_id', document.getElementById('poolId').value);
    formData.append('product_name', productName);
    formData.append('price', price);
    formData.append('receipt', document.getElementById('receiptUpload').files[0]);
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(result.message);
            this.reset();
            document.getElementById('productSelect').value = '';
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Terjadi ralat. Sila cuba lagi.');
    }
});

function showSuccess(message) {
    const modal = document.getElementById('successModal');
    document.getElementById('successMessage').textContent = message;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('successModal').classList.remove('active');
}

// Mobile navigation toggle
document.getElementById('navToggle').addEventListener('click', function() {
    document.querySelector('.nav-links').classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.remove('active');
    });
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Initialize
loadProducts();
loadQR();
