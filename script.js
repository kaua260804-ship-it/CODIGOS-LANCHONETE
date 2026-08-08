// Configurações
const CONFIG = {
    SPREADSHEET_ID: '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54',
    SHEET_NAME: 'BASE',
    RANGE: 'A:C',
    CLIENT_ID: '32531060917-d8sek11tkrmq3u5jaqhni6ri0ujvr3ff.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDObnjtRPUZc7_oiEWA41MNeej_IXkklr0',
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

// Callbacks de carregamento das APIs
function onGapiLoad() {
    console.log('✅ Google API (gapi) carregada');
    state.gapiLoaded = true;
    initGapiClient();
}

function onGisLoad() {
    console.log('✅ Google Identity Services carregado');
    state.gisLoaded = true;
    checkAllLoaded();
}

// Inicializar gapi client
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
                timeout: 10000,
                ontimeout: () => reject(new Error('Timeout ao carregar gapi client'))
            });
        });
        checkAllLoaded();
    } catch (error) {
        console.error('❌ Erro ao inicializar gapi:', error);
        showError('Erro ao inicializar Google API: ' + error.message);
    }
}

// Verificar se tudo está carregado
function checkAllLoaded() {
    if (state.gapiLoaded && state.gisLoaded) {
        console.log('✅ Todas as APIs carregadas, inicializando aplicação...');
        initApp();
    }
}

// Inicializar aplicação
function initApp() {
    console.log('🚀 Inicializando aplicação...');
    
    // Configurar botão de login
    const authorizeBtn = document.getElementById('authorize-btn');
    if (authorizeBtn) {
        authorizeBtn.addEventListener('click', handleAuthClick);
        console.log('✅ Botão de login configurado');
    } else {
        console.error('❌ Botão de login não encontrado!');
    }
    
    // Configurar botão de logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleSignoutClick);
    }
    
    // Configurar formulários
    setupForms();
    
    // Verificar se já existe sessão
    checkExistingSession();
}

function setupForms() {
    // Formulário de adicionar produto
    const addForm = document.getElementById('add-product-form');
    if (addForm) {
        addForm.addEventListener('submit', handleAddProduct);
    }
    
    // Formulário de editar produto
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditProduct);
    }
}

// Verificar sessão existente
function checkExistingSession() {
    // Tentar obter token do sessionStorage
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

// Função de autenticação
function handleAuthClick() {
    console.log('🔐 Iniciando autenticação...');
    
    if (!state.gisLoaded) {
        showError('Google Identity Services ainda não carregou. Aguarde um momento e tente novamente.');
        return;
    }

    try {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: async (tokenResponse) => {
                console.log('🔑 Token recebido');
                
                if (tokenResponse && tokenResponse.access_token) {
                    state.accessToken = tokenResponse.access_token;
                    state.isAuthenticated = true;
                    
                    // Salvar token na sessão
                    sessionStorage.setItem('google_access_token', tokenResponse.access_token);
                    
                    // Configurar token no gapi
                    gapi.client.setToken({
                        access_token: state.accessToken
                    });
                    
                    updateUIForAuth();
                    
                    // Carregar dados
                    await loadSheetData();
                }
            },
            error_callback: (error) => {
                console.error('❌ Erro na autenticação:', error);
                showError('Erro ao autenticar: ' + (error.message || 'Erro desconhecido'));
            }
        });
        
        // Solicitar token
        state.tokenClient.requestAccessToken();
    } catch (error) {
        console.error('❌ Erro ao criar token client:', error);
        showError('Erro ao iniciar autenticação: ' + error.message);
    }
}

function handleSignoutClick() {
    console.log('👋 Realizando logout...');
    
    if (state.accessToken) {
        // Revogar token
        google.accounts.oauth2.revoke(state.accessToken, () => {
            console.log('✅ Token revogado');
        });
        
        // Limpar sessionStorage
        sessionStorage.removeItem('google_access_token');
    }
    
    // Limpar estado
    state.accessToken = null;
    state.isAuthenticated = false;
    state.products = [];
    state.holes = [];
    state.tokenClient = null;
    
    // Limpar token do gapi
    gapi.client.setToken(null);
    
    // Resetar UI
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('login-message').style.display = 'block';
    updateUIForAuth();
    
    // Limpar campos
    const holeDesc = document.getElementById('hole-description');
    const holeUn = document.getElementById('hole-un');
    const tableSearch = document.getElementById('table-search');
    
    if (holeDesc) holeDesc.value = '';
    if (holeUn) holeUn.value = '';
    if (tableSearch) tableSearch.value = '';
}

// Carregar dados da planilha
async function loadSheetData() {
    if (!state.isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    showLoading(true, 'Carregando dados da planilha...');
    hideError();

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!${CONFIG.RANGE}`,
        });

        console.log('✅ Dados recebidos:', response);

        const data = response.result.values || [];
        
        state.products = [];
        
        for (let i = 0; i < data.length; i++) {
            if (data[i].length >= 3 && data[i][0]) {
                const firstCell = data[i][0].toString().toLowerCase();
                if (firstCell === 'código' || firstCell === 'codigo' || firstCell === 'code') {
                    continue;
                }
                
                state.products.push({
                    row: i + 1,
                    code: data[i][0],
                    description: data[i][1] || '',
                    un: data[i][2] || ''
                });
            }
        }

        console.log(`✅ ${state.products.length} produtos processados`);

        // Ordenar por código
        state.products.sort((a, b) => {
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
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        
        let errorMessage = 'Erro ao carregar dados da planilha.';
        if (error.result && error.result.error) {
            errorMessage += ' ' + error.result.error.message;
        }
        
        // Se for erro de autenticação, fazer logout
        if (error.status === 401 || error.status === 403) {
            errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
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
        if (!codes.includes(i)) {
            state.holes.push(i);
        }
    }
    
    const nextCode = codes[codes.length - 1] + 1;
    if (!state.holes.includes(nextCode)) {
        state.holes.push(nextCode);
    }
    
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

// Handlers de formulários
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
        alert('Por favor, preencha todos os campos.');
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
        showError('Erro ao salvar produto: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

async function handleEditProduct(e) {
    e.preventDefault();
    
    if (!state.isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    const row = document.getElementById('edit-row').value;
    const code = document.getElementById('edit-code').value;
    const description = document.getElementById('edit-description').value.trim();
    const un = document.getElementById('edit-un').value.trim();

    if (!description || !un) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    showLoading(true, 'Atualizando produto...');
    hideError();

    try {
        await updateSheetCell(row, [code, description, un]);
        await loadSheetData();
        closeEditModal();
        alert('✅ Produto atualizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao atualizar:', error);
        showError('Erro ao atualizar produto: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

// Operações na planilha
async function appendToSheet(values) {
    const response = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A:C`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            values: [values]
        }
    });
    console.log('✅ Dados adicionados:', response);
}

async function updateSheetCell(row, values) {
    const response = await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A${row}:C${row}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [values]
        }
    });
    console.log('✅ Dados atualizados:', response);
}

// Interface
function updateTable(filterText = '') {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    const filteredProducts = filterText 
        ? state.products.filter(p => 
            p.code.toString().toLowerCase().includes(filterText.toLowerCase()) ||
            p.description.toLowerCase().includes(filterText.toLowerCase())
          )
        : state.products;

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
            <td>
                <button class="edit-btn" onclick='editProduct(${safeProduct})'>✏️ Editar</button>
            </td>
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
        
        // Tentar obter informações do token
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
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }
    console.error(message);
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) errorDiv.style.display = 'none';
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado');
});
