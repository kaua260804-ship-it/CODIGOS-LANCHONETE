// Configurações (Suas chaves originais mantidas)
const CONFIG = {
    SPREADSHEET_ID: '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54',
    SHEET_NAME: 'BASE',
    RANGE: 'A:C',
    CLIENT_ID: '32531060917-d8sek11tkrmq3u5jaqhni6ri0ujvr3ff.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDObnjtRPUZc7_oiEWA41MNeej_IXkklr0', // Garanta que a Google Sheets API está ativa para este projeto no Cloud
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4'
};

// Estado da aplicação
let state = {
    accessToken: null,
    isAuthenticated: false,
    products: [],
    holes: [],
    currentHoleIndex: 0,
    tokenClient: null,
    gapiLoaded: false,
    gisLoaded: false
};

// Callbacks de carregamento das APIs chamados pelo index.html
function onGapiLoad() {
    console.log('✅ Google API (gapi) carregada');
    state.gapiLoaded = true;
    initGapiClient();
}

function onGisLoad() {
    console.log('✅ Google Identity Services (GIS) carregado');
    state.gisLoaded = true;
    checkAllLoaded();
}

// Inicializar gapi client com tratamento robusto (Evita o erro 403 quebrando a tela)
async function initGapiClient() {
    try {
        await new Promise((resolve, reject) => {
            gapi.load('client', {
                callback: async () => {
                    try {
                        await gapi.client.init({
                            apiKey: CONFIG.API_KEY,
                            discoveryDocs: [CONFIG.DISCOVERY_DOC],
                        });
                        console.log('✅ gapi client inicializado');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: () => reject(new Error('Erro ao carregar gapi client')),
                timeout: 10000
            });
        });
        checkAllLoaded();
    } catch (error) {
        console.error('❌ Erro ao inicializar gapi:', error);
        showError('Erro 403: Verifique se a "Google Sheets API" está ativada no Google Cloud Console.');
    }
}

// Verifica se ambas as APIs (GAPI e GIS) carregaram antes de liberar o app
function checkAllLoaded() {
    if (state.gapiLoaded && state.gisLoaded) {
        console.log('✅ Todas as APIs carregadas, inicializando aplicação...');
        initApp();
    }
}

// Inicializa a aplicação (Evita o erro "google is not defined")
function initApp() {
    console.log('🚀 Inicializando aplicação...');

    // Configurar botões
    const authorizeBtn = document.getElementById('authorize-btn');
    if (authorizeBtn) authorizeBtn.addEventListener('click', handleAuthClick);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleSignoutClick);

    // Configurar formulários
    setupForms();

    // Inicializar o Token Client (Google Identity Services) de forma segura
    try {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: async (tokenResponse) => {
                console.log('🔑 Token recebido');
                if (tokenResponse && tokenResponse.access_token) {
                    state.accessToken = tokenResponse.access_token;
                    state.isAuthenticated = true;
                    
                    sessionStorage.setItem('google_access_token', tokenResponse.access_token);
                    gapi.client.setToken({ access_token: state.accessToken });
                    
                    updateUIForAuth();
                    await loadSheetData();
                }
            },
            error_callback: (error) => {
                console.error('❌ Erro na autenticação:', error);
                showError('Erro ao autenticar: ' + (error.message || 'Erro desconhecido'));
            }
        });
        console.log('✅ Token Client configurado.');
    } catch (error) {
        console.error('❌ Erro ao configurar o Token Client:', error);
        showError('Erro interno do Google Identity Services.');
    }

    // Verificar se já existe sessão
    checkExistingSession();
}

function setupForms() {
    const addForm = document.getElementById('add-product-form');
    if (addForm) addForm.addEventListener('submit', handleAddProduct);

    const editForm = document.getElementById('edit-form');
    if (editForm) editForm.addEventListener('submit', handleEditProduct);
}

function checkExistingSession() {
    const savedToken = sessionStorage.getItem('google_access_token');
    if (savedToken) {
        console.log('🔑 Token encontrado na sessão');
        state.accessToken = savedToken;
        state.isAuthenticated = true;
        gapi.client.setToken({ access_token: savedToken });
        updateUIForAuth();
        loadSheetData();
    }
}

// Acionado ao clicar no botão "Entrar com Google"
function handleAuthClick() {
    console.log('🔐 Iniciando autenticação...');
    if (!state.tokenClient) {
        showError('O sistema de login ainda não foi carregado. Aguarde um momento.');
        return;
    }
    state.tokenClient.requestAccessToken();
}

// Acionado ao clicar no botão "Sair"
function handleSignoutClick() {
    console.log('👋 Realizando logout...');
    if (state.accessToken) {
        google.accounts.oauth2.revoke(state.accessToken, () => console.log('✅ Token revogado'));
        sessionStorage.removeItem('google_access_token');
    }

    state.accessToken = null;
    state.isAuthenticated = false;
    state.products = [];
    state.holes = [];
    gapi.client.setToken(null);

    document.getElementById('app-content').style.display = 'none';
    document.getElementById('login-message').style.display = 'block';
    updateUIForAuth();
}

// Carregar dados da planilha
async function loadSheetData() {
    if (!state.isAuthenticated) return;
    
    showLoading(true, 'Carregando dados da planilha...');
    hideError();

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!${CONFIG.RANGE}`,
        });
        
        console.log('✅ Dados recebidos');
        const data = response.result.values || [];
        state.products = [];

        for (let i = 0; i < data.length; i++) {
            if (data[i].length >= 3 && data[i][0]) {
                const firstCell = data[i][0].toString().toLowerCase();
                if (firstCell === 'código' || firstCell === 'codigo' || firstCell === 'code') continue;

                state.products.push({
                    row: i + 1,
                    code: data[i][0],
                    description: data[i][1] || '',
                    un: data[i][2] || ''
                });
            }
        }

        state.products.sort((a, b) => {
            const numA = parseInt(a.code);
            const numB = parseInt(b.code);
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.code.localeCompare(b.code);
        });

        findHoles();
        updateTable();
        updateHoleDisplay();
        
        showLoading(false);
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        let errorMessage = 'Erro ao carregar dados. ';
        if (error.result && error.result.error) {
            errorMessage += error.result.error.message;
        }
        if (error.status === 401 || error.status === 403) {
            errorMessage = 'Sessão expirada ou sem permissão. Faça login novamente.';
            handleSignoutClick();
        }
        showError(errorMessage);
        showLoading(false);
    }
}

// Encontrar buracos na sequência
function findHoles() {
    state.holes = [];
    if (state.products.length === 0) {
        state.holes.push(1);
        return;
    }

    const codes = state.products
        .map(p => parseInt(p.code))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b);

    if (codes.length === 0) {
        state.holes.push(1);
        return;
    }

    for (let i = codes[0]; i < codes[codes.length - 1]; i++) {
        if (!codes.includes(i)) state.holes.push(i);
    }

    const nextCode = codes[codes.length - 1] + 1;
    if (!state.holes.includes(nextCode)) state.holes.push(nextCode);
    
    state.currentHoleIndex = 0;
}

function updateHoleDisplay() {
    const holeDisplay = document.getElementById('current-hole');
    const totalHoles = document.getElementById('total-holes');
    const holeCode = document.getElementById('hole-code');

    if (state.holes.length > 0 && state.currentHoleIndex < state.holes.length) {
        const currentHole = state.holes[state.currentHoleIndex];
        if (holeDisplay) holeDisplay.textContent = currentHole;
        if (holeCode) holeCode.value = currentHole;
        if (totalHoles) totalHoles.textContent = state.holes.length;
    } else {
        if (holeDisplay) holeDisplay.textContent = '--';
        if (holeCode) holeCode.value = '';
        if (totalHoles) totalHoles.textContent = '0';
    }
}

function showNextHole() {
    if (state.holes.length === 0) {
        alert('Não há códigos faltantes na sequência!');
        return;
    }
    state.currentHoleIndex = (state.currentHoleIndex + 1) % state.holes.length;
    updateHoleDisplay();
    
    const holeDesc = document.getElementById('hole-description');
    const holeUn = document.getElementById('hole-un');
    if (holeDesc) holeDesc.value = '';
    if (holeUn) holeUn.value = '';
}

// Adicionar / Editar Produto
async function handleAddProduct(e) {
    e.preventDefault();
    if (!state.isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    const code = document.getElementById('hole-code').value;
    const description = document.getElementById('hole-description').value.trim();
    const un = document.getElementById('hole-un').value.trim();

    if (!code || !description || !un) {
        alert('Preencha todos os campos.');
        return;
    }

    showLoading(true, 'Salvando produto...');
    hideError();

    try {
        const existingProduct = state.products.find(p => p.code === code);
        if (existingProduct) {
            await updateSheetCell(existingProduct.row, [code, description, un]);
            alert('✅ Produto atualizado com sucesso!');
        } else {
            await appendToSheet([code, description, un]);
            alert('✅ Produto adicionado com sucesso!');
        }
        
        await loadSheetData();
        document.getElementById('hole-description').value = '';
        document.getElementById('hole-un').value = '';
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showError('Erro ao salvar: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    if (!state.isAuthenticated) return;

    const row = document.getElementById('edit-row').value;
    const code = document.getElementById('edit-code').value;
    const description = document.getElementById('edit-description').value.trim();
    const un = document.getElementById('edit-un').value.trim();

    showLoading(true, 'Atualizando produto...');
    hideError();

    try {
        await updateSheetCell(row, [code, description, un]);
        await loadSheetData();
        closeEditModal();
        alert('✅ Produto atualizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        showError('Erro ao atualizar: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

// Comunicação com a API do Google Sheets
async function appendToSheet(values) {
    await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A:C`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [values] }
    });
}

async function updateSheetCell(row, values) {
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A${row}:C${row}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] }
    });
}

// Interface (Tabs, Tabelas, UI)
function updateTable(filterText = '') {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredProducts = filterText 
        ? state.products.filter(p => p.code.toString().includes(filterText) || p.description.toLowerCase().includes(filterText.toLowerCase()))
        : state.products;

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum produto encontrado</td></tr>';
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
    const searchText = document.getElementById('table-search').value;
    updateTable(searchText);
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
    } else if (tabName === 'table') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('table-tab').classList.add('active');
    }
}

function updateUIForAuth() {
    const authorizeBtn = document.getElementById('authorize-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginMessage = document.getElementById('login-message');

    if (state.isAuthenticated) {
        if (authorizeBtn) authorizeBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (loginMessage) loginMessage.style.display = 'none';
        
        try {
            if (state.accessToken) {
                const payload = JSON.parse(atob(state.accessToken.split('.')[1]));
                const userName = document.getElementById('user-name');
                if (userName) userName.textContent = payload.name || payload.email || 'Usuário';
            }
        } catch (e) {
            const userName = document.getElementById('user-name');
            if (userName) userName.textContent = 'Usuário';
        }
    } else {
        if (authorizeBtn) authorizeBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginMessage) loginMessage.style.display = 'block';
    }
}

function showLoading(show, message = 'Carregando...') {
    const loading = document.getElementById('loading');
    const loadingMessage = document.getElementById('loading-message');
    if (loading) loading.style.display = show ? 'block' : 'none';
    if (loadingMessage && show) loadingMessage.textContent = message;
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = '❌ ' + message;
        errorDiv.style.display = 'block';
    }
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.style.display = 'none';
}
