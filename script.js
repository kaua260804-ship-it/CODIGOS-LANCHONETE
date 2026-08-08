// Configurações
const CONFIG = {
    SPREADSHEET_ID: '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54',
    SHEET_NAME: 'BASE',
    RANGE: 'A:C',
    CLIENT_ID: 'SEU_CLIENT_ID.apps.googleusercontent.com',
    API_KEY: 'SUA_API_KEY',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};

// Estado da aplicação
let state = {
    accessToken: null,
    isAuthenticated: false,
    googleInitialized: false,
    gapiLoaded: false,
    products: [],
    holes: [],
    currentHoleIndex: 0
};

// Garantir que a API do Google seja carregada apenas uma vez
function onGoogleApiLoad() {
    state.gapiLoaded = true;
    console.log('Google API carregada');
    initializeGoogleAuth();
}

// Inicialização do Google Identity Services
function initializeGoogleAuth() {
    // Evitar inicialização múltipla
    if (state.googleInitialized) {
        console.log('Google Auth já inicializado');
        return;
    }

    try {
        google.accounts.id.initialize({
            client_id: CONFIG.CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: false
        });

        google.accounts.id.renderButton(
            document.getElementById('google-signin-btn'),
            { 
                theme: 'outline', 
                size: 'large',
                type: 'standard',
                text: 'sign_in_with',
                shape: 'rectangular'
            }
        );

        state.googleInitialized = true;
        console.log('Google Auth inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar Google Auth:', error);
        showError('Erro ao inicializar autenticação Google. Verifique se o Client ID está correto.');
    }
}

// Manipular resposta de credenciais
async function handleCredentialResponse(response) {
    try {
        console.log('Resposta de credenciais recebida');
        
        // Validar resposta
        if (!response || !response.credential) {
            throw new Error('Credenciais inválidas recebidas');
        }

        state.accessToken = response.credential;
        
        // Mostrar loading
        showLoading(true);
        
        // Inicializar Google API Client se necessário
        if (!state.gapiLoaded) {
            await new Promise((resolve) => {
                const checkGapi = setInterval(() => {
                    if (typeof gapi !== 'undefined' && gapi.client) {
                        clearInterval(checkGapi);
                        resolve();
                    }
                }, 100);
            });
        }
        
        // Carregar Google API Client
        await loadGoogleApiClient();
        
        // Configurar token
        gapi.client.setToken({
            access_token: state.accessToken
        });
        
        // Atualizar estado
        state.isAuthenticated = true;
        
        // Carregar dados da planilha
        await loadSheetData();
        
        // Atualizar UI
        updateUIForAuth();
        
        console.log('Autenticação bem-sucedida!');
        
    } catch (error) {
        console.error('Erro na autenticação:', error);
        showError('Erro ao autenticar: ' + error.message);
        showLoading(false);
    }
}

// Carregar Google API Client
async function loadGoogleApiClient() {
    return new Promise((resolve, reject) => {
        gapi.load('client', {
            callback: async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.API_KEY,
                        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                    });
                    console.log('Google API Client inicializado');
                    resolve();
                } catch (error) {
                    console.error('Erro ao inicializar API Client:', error);
                    reject(error);
                }
            },
            onerror: function() {
                reject(new Error('Erro ao carregar biblioteca client'));
            },
            timeout: 5000,
            ontimeout: function() {
                reject(new Error('Timeout ao carregar biblioteca client'));
            }
        });
    });
}

// Carregar dados da planilha
async function loadSheetData() {
    if (!state.isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    showLoading(true);
    hideError();

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!${CONFIG.RANGE}`,
        });

        console.log('Dados recebidos da planilha:', response);

        const data = response.result.values || [];
        
        // Processar dados
        state.products = [];
        let startRow = 1; // Google Sheets começa em 1
        
        for (let i = 0; i < data.length; i++) {
            if (data[i].length >= 3 && data[i][0]) {
                // Verificar se não é cabeçalho
                const firstCell = data[i][0].toString().toLowerCase();
                if (firstCell === 'código' || firstCell === 'codigo' || firstCell === 'code') {
                    continue;
                }
                
                state.products.push({
                    row: startRow + i,
                    code: data[i][0],
                    description: data[i][1] || '',
                    un: data[i][2] || ''
                });
            }
        }

        console.log('Produtos processados:', state.products);

        // Ordenar por código
        state.products.sort((a, b) => {
            const numA = parseInt(a.code);
            const numB = parseInt(b.code);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.code.localeCompare(b.code);
        });
        
        // Encontrar buracos/falhas na sequência
        findHoles();
        
        // Atualizar tabelas
        updateTable();
        updateHoleDisplay();
        
        showLoading(false);
        document.getElementById('login-message').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showError('Erro ao carregar dados da planilha: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
}

// Encontrar buracos na sequência numérica
function findHoles() {
    state.holes = [];
    
    if (state.products.length === 0) {
        state.holes.push(1); // Sugerir código 1 se não houver produtos
        return;
    }
    
    // Extrair códigos numéricos
    const codes = state.products
        .map(p => parseInt(p.code))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b);
    
    if (codes.length === 0) {
        state.holes.push(1);
        return;
    }
    
    // Encontrar falhas na sequência
    for (let i = codes[0]; i < codes[codes.length - 1]; i++) {
        if (!codes.includes(i)) {
            state.holes.push(i);
        }
    }
    
    // Sempre sugerir o próximo código após o último
    const nextCode = codes[codes.length - 1] + 1;
    if (!state.holes.includes(nextCode)) {
        state.holes.push(nextCode);
    }
    
    state.currentHoleIndex = 0;
}

// Atualizar display do buraco atual
function updateHoleDisplay() {
    const holeDisplay = document.getElementById('current-hole');
    const totalHoles = document.getElementById('total-holes');
    const holeCode = document.getElementById('hole-code');
    
    if (state.holes.length > 0 && state.currentHoleIndex < state.holes.length) {
        const currentHole = state.holes[state.currentHoleIndex];
        holeDisplay.textContent = currentHole;
        holeCode.value = currentHole;
        totalHoles.textContent = state.holes.length;
    } else {
        holeDisplay.textContent = '--';
        holeCode.value = '';
        totalHoles.textContent = '0';
    }
}

// Mostrar próximo buraco
function showNextHole() {
    if (state.holes.length === 0) {
        alert('Não há códigos faltantes na sequência!');
        return;
    }
    
    state.currentHoleIndex = (state.currentHoleIndex + 1) % state.holes.length;
    updateHoleDisplay();
    
    // Limpar campos do formulário
    document.getElementById('hole-description').value = '';
    document.getElementById('hole-un').value = '';
}

// Adicionar produto com código faltante
document.getElementById('add-product-form').addEventListener('submit', async function(e) {
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

    showLoading(true);
    hideError();

    try {
        // Verificar se o código já existe
        const existingProduct = state.products.find(p => p.code === code);
        
        if (existingProduct) {
            // Atualizar produto existente
            await updateSheetCell(existingProduct.row, [code, description, un]);
            alert('Produto atualizado com sucesso!');
        } else {
            // Adicionar novo produto
            await appendToSheet([code, description, un]);
            alert('Produto adicionado com sucesso!');
        }
        
        // Recarregar dados
        await loadSheetData();
        
        // Limpar formulário
        document.getElementById('hole-description').value = '';
        document.getElementById('hole-un').value = '';
        
    } catch (error) {
        console.error('Erro ao adicionar/atualizar produto:', error);
        showError('Erro ao salvar produto: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
});

// Adicionar dados à planilha
async function appendToSheet(values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!A:C`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [values]
            }
        });
        console.log('Dados adicionados com sucesso:', response);
    } catch (error) {
        console.error('Erro ao adicionar dados:', error);
        throw error;
    }
}

// Atualizar dados na planilha
async function updateSheetCell(row, values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${CONFIG.SHEET_NAME}!A${row}:C${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        console.log('Dados atualizados com sucesso:', response);
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
        throw error;
    }
}

// Atualizar tabela de visualização
function updateTable(filterText = '') {
    const tbody = document.getElementById('table-body');
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
        tr.innerHTML = `
            <td>${product.code}</td>
            <td>${product.description}</td>
            <td>${product.un}</td>
            <td>
                <button class="edit-btn" onclick='editProduct(${JSON.stringify(product).replace(/'/g, "&#39;")})'>
                    ✏️ Editar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtrar tabela
function filterTable() {
    const searchText = document.getElementById('table-search').value;
    updateTable(searchText);
}

// Editar produto
function editProduct(product) {
    document.getElementById('edit-row').value = product.row;
    document.getElementById('edit-code').value = product.code;
    document.getElementById('edit-description').value = product.description;
    document.getElementById('edit-un').value = product.un;
    
    document.getElementById('edit-modal').style.display = 'block';
}

// Fechar modal de edição
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// Salvar edição
document.getElementById('edit-form').addEventListener('submit', async function(e) {
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

    showLoading(true);
    hideError();

    try {
        await updateSheetCell(row, [code, description, un]);
        await loadSheetData();
        closeEditModal();
        alert('Produto atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        showError('Erro ao atualizar produto: ' + (error.result?.error?.message || error.message));
        showLoading(false);
    }
});

// Alternar entre abas
function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativar aba selecionada
    if (tabName === 'search') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('search-tab').classList.add('active');
    } else if (tabName === 'table') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('table-tab').classList.add('active');
    }
}

// Logout
document.getElementById('logout-btn').addEventListener('click', function() {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
    }
    
    // Limpar estado
    state.accessToken = null;
    state.isAuthenticated = false;
    state.products = [];
    state.holes = [];
    state.googleInitialized = false;
    
    // Resetar UI
    document.getElementById('app-content').style.display = 'none';
    document.getElementById('login-message').style.display = 'block';
    updateUIForAuth();
    
    // Limpar campos
    document.getElementById('hole-description').value = '';
    document.getElementById('hole-un').value = '';
    document.getElementById('table-search').value = '';
    
    // Reinicializar Google Auth
    setTimeout(() => {
        initializeGoogleAuth();
    }, 100);
});

// Atualizar UI baseado no estado de autenticação
function updateUIForAuth() {
    const loginMessage = document.getElementById('login-message');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (state.isAuthenticated) {
        loginMessage.style.display = 'none';
        logoutBtn.style.display = 'flex';
        
        // Tentar obter informações do usuário do token
        try {
            if (state.accessToken) {
                const payload = JSON.parse(atob(state.accessToken.split('.')[1]));
                document.getElementById('user-name').textContent = payload.name || payload.email || 'Usuário';
            }
        } catch (e) {
            document.getElementById('user-name').textContent = 'Usuário';
        }
    } else {
        loginMessage.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

// Mostrar/esconder loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Mostrar erro
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Esconder erro
function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Inicializar quando a página carregar
window.addEventListener('load', function() {
    console.log('Página carregada, aguardando APIs do Google...');
    
    // Verificar se as APIs já foram carregadas
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleAuth();
    }
});
