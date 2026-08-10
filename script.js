// ==========================================
// CONFIGURAÇÕES DA APLICAÇÃO E GOOGLE API
// ==========================================
const CONFIG = {
    SPREADSHEET_ID: '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54',
    SHEET_NAME: 'BASE',
    RANGE: 'A:C',
    CLIENT_ID: '32531060917-d8sek11tkrmq3u5jaqhni6ri0ujvr3ff.apps.googleusercontent.com',
    
    // ATENÇÃO: Garanta que esta API Key pertence ao MESMO projeto do Client ID (KPY-IA-Projeto) no Google Cloud Console!
    API_KEY: 'AIzaSyDObnjtRPUZc7_oiEWA41MNeej_IXkklr0', 
    
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4'
};

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
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

// ==========================================
// INICIALIZAÇÃO DAS BIBLIOTECAS DO GOOGLE
// ==========================================

// Called by index.html when api.js loads
window.onGapiLoad = function() {
    console.log('✅ Google API (gapi) script carregado');
    initGapiClient();
};

// Called by index.html when gsi/client loads
window.onGisLoad = function() {
    console.log('✅ Google Identity Services (GIS) script carregado');
    state.gisLoaded = true;
    checkAllLoaded();
};

// Inicializa o gapi client e carrega as descobertas da Sheets API
async function initGapiClient() {
    try {
        await new Promise((resolve, reject) => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.API_KEY,
                        discoveryDocs: [CONFIG.DISCOVERY_DOC],
                    });
                    console.log('✅ gapi client inicializado com sucesso!');
                    state.gapiLoaded = true; // Só marca como carregado APÓS o init concluir
                    resolve();
                } catch (error) {
                    console.error('❌ Erro no gapi.client.init:', error);
                    reject(error);
                }
            });
        });
        checkAllLoaded();
    } catch (error) {
        console.error('❌ Erro ao inicializar gapi:', error);
        showError('Erro de inicialização da API. Verifique a API Key e se a Sheets API está ativa no Google Cloud.');
    }
}

// Libera a aplicação apenas quando AMBAS as bibliotecas estiverem 100% prontas
function checkAllLoaded() {
    if (state.gapiLoaded && state.gisLoaded) {
        console.log('🚀 Bibliotecas Google prontas! Inicializando app...');
        initApp();
    }
}

// Configura os botões, eventos de formulário e o cliente OAuth
function initApp() {
    const authorizeBtn = document.getElementById('authorize-btn');
    if (authorizeBtn) authorizeBtn.addEventListener('click', handleAuthClick);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleSignoutClick);

    setupForms();

    try {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    console.log('🔑 Login efetuado com sucesso!');
                    state.accessToken = tokenResponse.access_token;
                    state.isAuthenticated = true;
                    
                    sessionStorage.setItem('google_access_token', tokenResponse.access_token);
                    
                    if (gapi.client) {
                        gapi.client.setToken({ access_token: state.accessToken });
                    }
                    
                    updateUIForAuth();
                    await loadSheetData();
                }
            },
            error_callback: (error) => {
                console.error('❌ Erro de Autenticação:', error);
                showError('Erro na autenticação: ' + (error.message || 'Janela fechada ou acesso negado.'));
            }
        });
    } catch (error) {
        console.error('❌ Erro ao configurar GIS Token Client:', error);
    }

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
        console.log('🔑 Restaurando sessão anterior...');
        state.accessToken = savedToken;
        state.isAuthenticated = true;
        
        if (gapi.client) {
            gapi.client.setToken({ access_token: savedToken });
        }
        
        updateUIForAuth();
        loadSheetData();
    }
}

// ==========================================
// FLUXO DE LOGIN E LOGOUT
// ==========================================

function handleAuthClick() {
    if (typeof google === 'undefined') {
        showError('A biblioteca de login do Google foi bloqueada por extensões do seu navegador.');
        return;
    }
    if (!state.tokenClient) {
        showError('O sistema de login ainda está inicializando. Aguarde 2 segundos e tente novamente.');
        return;
    }
    state.tokenClient.requestAccessToken();
}

function handleSignoutClick() {
    if (state.accessToken) {
        google.accounts.oauth2.revoke(state.accessToken, () => {});
        sessionStorage.removeItem('google_access_token');
    }
    
    state.accessToken = null;
    state.isAuthenticated = false;
    state.products = [];
    state.holes = [];

    if (gapi.client) {
        gapi.client.setToken(null);
    }

    document.getElementById('app-content').style.display = 'none';
    document.getElementById('login-message').style.display = 'block';
    updateUIForAuth();
}

// ==========================================
// OPERAÇÕES COM A GOOGLE SHEETS API
// ==========================================

async function loadSheetData() {
    if (!state.isAuthenticated) return;
    
    // Trava de segurança para garantir que o cliente de planilhas existe
    if (!gapi.client || !gapi.client.sheets) {
        console.warn('⚠️ Aguardando inicialização completa do gapi.client.sheets...');
        setTimeout(loadSheetData, 500);
        return;
    }

    showLoading(true, 'Buscando dados da planilha BASE...');
    hideError();

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!${CONFIG.RANGE}`,
        });
        
        const data = response.result.values || [];
        state.products = [];

        for (let i = 0; i < data.length; i++) {
            if (data[i].length > 0 && data[i][0]) {
                const firstCell = data[i][0].toString().toLowerCase();
                if (firstCell === 'código' || firstCell === 'codigo' || firstCell === 'code') continue;

                state.products.push({
                    row: i + 1,
                    code: data[i][0].toString().trim(),
                    description: data[i][1] ? data[i][1].toString().trim() : '',
                    un: data[i][2] ? data[i][2].toString().trim() : ''
                });
            }
        }

        // Ordenação estritamente numérica
        state.products.sort((a, b) => {
            const numA = parseInt(a.code, 10);
            const numB = parseInt(b.code, 10);
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.code.localeCompare(b.code);
        });

        findHoles();
        updateTable();
        updateHoleDisplay();
        
        showLoading(false);
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';

    } catch (error) {
        console.error('❌ Erro na leitura:', error);
        if (error.status === 401 || error.status === 403) {
            showError('Sessão expirada ou sem permissão na planilha. Faça login novamente.');
            handleSignoutClick();
        } else if (error.status === 400) {
            showError('Erro 400: Verifique se a sua API Key e Client ID são do mesmo projeto no Google Cloud Console.');
        } else {
            showError('Erro ao carregar os dados da planilha.');
        }
        showLoading(false);
    }
}

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

// ==========================================
// DETECÇÃO DE BURACOS (CÓDIGOS FALTANTES)
// ==========================================

function findHoles() {
    state.holes = [];
    const codes = state.products
        .map(p => parseInt(p.code, 10))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b);

    if (codes.length === 0) {
        state.holes.push(1);
        return;
    }

    // Identifica falhas na sequência numérica
    for (let i = codes[0]; i < codes[codes.length - 1]; i++) {
        if (!codes.includes(i)) {
            state.holes.push(i);
        }
    }

    // Adiciona também o próximo código da sequência final
    const nextCode = codes[codes.length - 1] + 1;
    if (!state.holes.includes(nextCode)) {
        state.holes.push(nextCode);
    }
    
    state.currentHoleIndex = 0;
}

function updateHoleDisplay() {
    const holeDisplay = document.getElementById('current-hole');
    const totalHoles = document.getElementById('total-holes');
    const holeCodeInput = document.getElementById('hole-code');

    if (state.holes.length > 0 && state.currentHoleIndex < state.holes.length) {
        const currentHole = state.holes[state.currentHoleIndex];
        if (holeDisplay) holeDisplay.textContent = currentHole;
        if (holeCodeInput) holeCodeInput.value = currentHole;
        if (totalHoles) totalHoles.textContent = state.holes.length;
    } else {
        if (holeDisplay) holeDisplay.textContent = '--';
        if (holeCodeInput) holeCodeInput.value = '';
        if (totalHoles) totalHoles.textContent = '0';
    }
}

function showNextHole() {
    if (state.holes.length === 0) {
        alert('Nenhum código faltante encontrado na sequência.');
        return;
    }
    state.currentHoleIndex = (state.currentHoleIndex + 1) % state.holes.length;
    updateHoleDisplay();
    
    const descInput = document.getElementById('hole-description');
    const unInput = document.getElementById('hole-un');
    if (descInput) descInput.value = '';
    if (unInput) unInput.value = '';
}

// ==========================================
// FORMULÁRIOS E INTERFACE DO USUÁRIO
// ==========================================

async function handleAddProduct(e) {
    e.preventDefault();
    if (!state.isAuthenticated) return;

    const code = document.getElementById('hole-code').value;
    const description = document.getElementById('hole-description').value.trim();
    const un = document.getElementById('hole-un').value.trim();

    if (!code || !description || !un) {
        alert('Por favor, preencha todos os campos!');
        return;
    }

    showLoading(true, 'Salvando novo produto na planilha...');
    try {
        const existingProduct = state.products.find(p => p.code === code);
        if (existingProduct) {
            await updateSheetCell(existingProduct.row, [code, description, un]);
        } else {
            await appendToSheet([code, description, un]);
        }
        
        await loadSheetData();
        document.getElementById('hole-description').value = '';
        document.getElementById('hole-un').value = '';
        alert('✅ Produto gravado com sucesso no Google Sheets!');
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showError('Erro ao gravar produto na planilha.');
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

    showLoading(true, 'Atualizando linha na planilha...');
    try {
        await updateSheetCell(row, [code, description, un]);
        await loadSheetData();
        closeEditModal();
        alert('✅ Produto atualizado!');
    } catch (error) {
        console.error('Erro ao editar:', error);
        showError('Erro ao atualizar produto.');
        showLoading(false);
    }
}

function updateTable(filterText = '') {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filteredProducts = filterText 
        ? state.products.filter(p => 
            p.code.toString().includes(filterText) || 
            p.description.toLowerCase().includes(filterText.toLowerCase())
          )
        : state.products;

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum produto cadastrado</td></tr>';
        return;
    }

    filteredProducts.forEach(product => {
        const tr = document.createElement('tr');
        const safeProduct = JSON.stringify(product).replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        tr.innerHTML = `
            <td><strong>${product.code}</strong></td>
            <td>${product.description}</td>
            <td>${product.un}</td>
            <td><button class="edit-btn" onclick='editProduct(${safeProduct})'>✏️ Editar</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable() {
    const text = document.getElementById('table-search').value;
    updateTable(text);
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

function updateUIForAuth() {
    const authorizeBtn = document.getElementById('authorize-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginMessage = document.getElementById('login-message');

    if (state.isAuthenticated) {
        if (authorizeBtn) authorizeBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (loginMessage) loginMessage.style.display = 'none';
    } else {
        if (authorizeBtn) authorizeBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (loginMessage) loginMessage.style.display = 'block';
    }
}

function showLoading(show, message = 'Carregando...') {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'block' : 'none';
    const msg = document.getElementById('loading-message');
    if (msg && show) msg.textContent = message;
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
