// Configurações
const CONFIG = {
    SPREADSHEET_ID: '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54',
    SHEET_NAME: 'BASE',
    RANGE: 'A:C',
    CLIENT_ID: '32531060917-d8sek11tkrmq3u5jaqhni6ri0ujvr3ff.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDObnjtRPUZc7_oiEWA41MNeej_IXkklr0',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};

let accessToken = null;
let products = [];
let holes = [];
let currentHoleIndex = 0;
let tokenClient = null;

// Inicializar quando a página carregar
window.onload = function() {
    console.log('Página carregada');
    initApp();
};

function initApp() {
    // Carregar gapi
    gapi.load('client', initGapiClient);
    
    // Configurar botões
    document.getElementById('authorize-btn').onclick = handleAuthClick;
    document.getElementById('logout-btn').onclick = handleSignoutClick;
    
    // Configurar formulários
    document.getElementById('add-product-form').onsubmit = handleAddProduct;
    document.getElementById('edit-form').onsubmit = handleEditProduct;
}

async function initGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        console.log('✅ API inicializada');
    } catch (error) {
        console.error('Erro ao inicializar API:', error);
        showError('Erro ao inicializar Google API');
    }
}

function handleAuthClick() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: async (response) => {
            if (response.access_token) {
                accessToken = response.access_token;
                gapi.client.setToken({ access_token: accessToken });
                
                document.getElementById('authorize-btn').style.display = 'none';
                document.getElementById('logout-btn').style.display = 'flex';
                document.getElementById('login-message').style.display = 'none';
                
                await loadSheetData();
            }
        },
        error_callback: (error) => {
            console.error('Erro na autenticação:', error);
            showError('Erro ao fazer login');
        }
    });
    
    tokenClient.requestAccessToken();
}

function handleSignoutClick() {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token revogado');
        });
    }
    
    accessToken = null;
    products = [];
    holes = [];
    tokenClient = null;
    
    gapi.client.setToken(null);
    
    document.getElementById('authorize-btn').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('login-message').style.display = 'block';
    document.getElementById('app-content').style.display = 'none';
}

async function loadSheetData() {
    showLoading(true, 'Carregando dados da planilha...');
    hideError();

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!${CONFIG.RANGE}`,
        });

        const data = response.result.values || [];
        products = [];
        
        for (let i = 0; i < data.length; i++) {
            if (data[i].length >= 3 && data[i][0]) {
                const firstCell = data[i][0].toString().toLowerCase();
                if (firstCell === 'código' || firstCell === 'codigo' || firstCell === 'code') {
                    continue;
                }
                
                products.push({
                    row: i + 1,
                    code: data[i][0],
                    description: data[i][1] || '',
                    un: data[i][2] || ''
                });
            }
        }

        console.log('✅ ' + products.length + ' produtos carregados');

        products.sort((a, b) => {
            const numA = parseInt(a.code);
            const numB = parseInt(b.code);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.code.localeCompare(b.code);
        });
        
        findHoles();
        updateTable();
        updateHoleDisplay();
        
        showLoading(false);
        document.getElementById('app-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showError('Erro ao carregar dados: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

function findHoles() {
    holes = [];
    
    if (products.length === 0) {
        holes.push(1);
        return;
    }
    
    const codes = products
        .map(p => parseInt(p.code))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b);
    
    if (codes.length === 0) {
        holes.push(1);
        return;
    }
    
    for (let i = codes[0]; i < codes[codes.length - 1]; i++) {
        if (!codes.includes(i)) {
            holes.push(i);
        }
    }
    
    const nextCode = codes[codes.length - 1] + 1;
    if (!holes.includes(nextCode)) {
        holes.push(nextCode);
    }
    
    currentHoleIndex = 0;
}

function updateHoleDisplay() {
    if (holes.length > 0 && currentHoleIndex < holes.length) {
        document.getElementById('current-hole').textContent = holes[currentHoleIndex];
        document.getElementById('hole-code').value = holes[currentHoleIndex];
        document.getElementById('total-holes').textContent = holes.length;
    } else {
        document.getElementById('current-hole').textContent = '--';
        document.getElementById('hole-code').value = '';
        document.getElementById('total-holes').textContent = '0';
    }
}

function showNextHole() {
    if (holes.length === 0) {
        alert('Não há códigos faltantes!');
        return;
    }
    
    currentHoleIndex = (currentHoleIndex + 1) % holes.length;
    updateHoleDisplay();
    
    document.getElementById('hole-description').value = '';
    document.getElementById('hole-un').value = '';
}

async function handleAddProduct(e) {
    e.preventDefault();
    
    if (!accessToken) {
        alert('Faça login primeiro.');
        return;
    }

    const code = document.getElementById('hole-code').value;
    const description = document.getElementById('hole-description').value.trim();
    const un = document.getElementById('hole-un').value.trim();

    if (!code || !description || !un) {
        alert('Preencha todos os campos.');
        return;
    }

    showLoading(true, 'Salvando...');

    try {
        const existingProduct = products.find(p => p.code === code);
        
        if (existingProduct) {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${CONFIG.SHEET_NAME}!A${existingProduct.row}:C${existingProduct.row}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[code, description, un]] }
            });
            alert('✅ Produto atualizado!');
        } else {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SPREADSHEET_ID,
                range: `${CONFIG.SHEET_NAME}!A:C`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [[code, description, un]] }
            });
            alert('✅ Produto adicionado!');
        }
        
        document.getElementById('hole-description').value = '';
        document.getElementById('hole-un').value = '';
        await loadSheetData();
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showError('Erro ao salvar: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    
    if (!accessToken) {
        alert('Faça login primeiro.');
        return;
    }

    const row = document.getElementById('edit-row').value;
    const code = document.getElementById('edit-code').value;
    const description = document.getElementById('edit-description').value.trim();
    const un = document.getElementById('edit-un').value.trim();

    if (!description || !un) {
        alert('Preencha todos os campos.');
        return;
    }

    showLoading(true, 'Atualizando...');

    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!A${row}:C${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[code, description, un]] }
        });
        
        closeEditModal();
        await loadSheetData();
        alert('✅ Produto atualizado!');
        
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        showError('Erro ao atualizar: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

function updateTable(filterText = '') {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const filteredProducts = filterText 
        ? products.filter(p => 
            p.code.toString().toLowerCase().includes(filterText.toLowerCase()) ||
            p.description.toLowerCase().includes(filterText.toLowerCase())
          )
        : products;

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum produto encontrado</td></tr>';
        return;
    }

    filteredProducts.forEach(product => {
        const tr = document.createElement('tr');
        const safeProduct = JSON.stringify(product).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        tr.innerHTML = `
            <td>${product.code}</td>
            <td>${product.description}</td>
            <td>${product.un}</td>
            <td><button class="edit-btn" onclick='editProduct(${safeProduct})'>✏️ Editar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable() {
    updateTable(document.getElementById('table-search').value);
}

function editProduct(product) {
    document.getElementById('edit-row').value = product.row;
    document.getElementById('edit-code').value = product.code;
    document.getElementById('edit-description').value = product.description;
    document.getElementById('edit-un').value = product.un;
    document.getElementById('edit-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'search') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('search-tab').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('table-tab').classList.add('active');
    }
}

function showLoading(show, message = 'Carregando...') {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    if (show) document.getElementById('loading-message').textContent = message;
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    setTimeout(() => { errorDiv.style.display = 'none'; }, 8000);
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

window.onclick = function(event) {
    if (event.target === document.getElementById('edit-modal')) {
        closeEditModal();
    }
}
