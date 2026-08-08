// Configurações
const SPREADSHEET_ID = '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54';
const SHEET_NAME = 'BASE';
const RANGE = 'A:C';
const CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'SUA_API_KEY';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let accessToken = null;
let products = [];
let holes = [];
let currentHoleIndex = 0;
let isAuthenticated = false;

// Inicialização do Google Identity Services
window.onload = function() {
    initializeGoogleAuth();
};

function initializeGoogleAuth() {
    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false
    });

    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { theme: 'outline', size: 'large' }
    );
}

// Manipular resposta de credenciais
async function handleCredentialResponse(response) {
    try {
        accessToken = response.credential;
        
        // Inicializar Google API Client
        await loadGoogleApiClient();
        
        // Carregar dados da planilha
        await loadSheetData();
        
        // Atualizar UI
        isAuthenticated = true;
        updateUIForAuth();
        
        console.log('Autenticação bem-sucedida!');
    } catch (error) {
        console.error('Erro na autenticação:', error);
        alert('Erro ao autenticar. Por favor, tente novamente.');
    }
}

// Carregar Google API Client
function loadGoogleApiClient() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: API_KEY,
                    clientId: CLIENT_ID,
                    scope: SCOPES,
                });
                
                // Configurar token de acesso
                gapi.client.setToken({
                    access_token: accessToken
                });
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Carregar dados da planilha
async function loadSheetData() {
    if (!isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    showLoading(true);

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${RANGE}`,
        });

        const data = response.result.values || [];
        
        // Processar dados (pular cabeçalho se existir)
        products = [];
        let startRow = 0;
        
        // Verificar se a primeira linha é cabeçalho
        if (data.length > 0 && (data[0][0] === 'Código' || data[0][0] === 'Codigo')) {
            startRow = 1;
        }

        for (let i = startRow; i < data.length; i++) {
            if (data[i].length >= 3 && data[i][0]) {
                products.push({
                    row: i + 1, // +1 porque as linhas no Google Sheets começam em 1
                    code: data[i][0],
                    description: data[i][1] || '',
                    un: data[i][2] || ''
                });
            }
        }

        // Ordenar por código
        products.sort((a, b) => parseInt(a.code) - parseInt(b.code));
        
        // Encontrar buracos/falhas na sequência
        findHoles();
        
        // Atualizar tabelas
        updateTable();
        updateHoleDisplay();
        
        showLoading(false);
        document.getElementById('app-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showLoading(false);
        alert('Erro ao carregar dados da planilha. Verifique o console para mais detalhes.');
    }
}

// Encontrar buracos na sequência numérica
function findHoles() {
    holes = [];
    
    if (products.length === 0) return;
    
    // Extrair códigos numéricos
    const codes = products.map(p => parseInt(p.code)).filter(code => !isNaN(code));
    
    if (codes.length === 0) return;
    
    codes.sort((a, b) => a - b);
    
    // Encontrar falhas na sequência
    for (let i = codes[0]; i < codes[codes.length - 1]; i++) {
        if (!codes.includes(i)) {
            holes.push(i);
        }
    }
    
    // Sugerir próximo código após o último
    const nextCode = codes[codes.length - 1] + 1;
    if (!holes.includes(nextCode)) {
        holes.push(nextCode);
    }
    
    currentHoleIndex = 0;
}

// Atualizar display do buraco atual
function updateHoleDisplay() {
    const holeDisplay = document.getElementById('current-hole');
    const totalHoles = document.getElementById('total-holes');
    const holeCode = document.getElementById('hole-code');
    
    if (holes.length > 0 && currentHoleIndex < holes.length) {
        holeDisplay.textContent = holes[currentHoleIndex];
        holeCode.value = holes[currentHoleIndex];
        totalHoles.textContent = holes.length;
    } else {
        holeDisplay.textContent = '--';
        holeCode.value = '';
        totalHoles.textContent = '0';
    }
}

// Mostrar próximo buraco
function showNextHole() {
    if (holes.length === 0) {
        alert('Não há códigos faltantes na sequência!');
        return;
    }
    
    currentHoleIndex = (currentHoleIndex + 1) % holes.length;
    updateHoleDisplay();
    
    // Limpar campos do formulário
    document.getElementById('hole-description').value = '';
    document.getElementById('hole-un').value = '';
}

// Adicionar produto com código faltante
document.getElementById('add-product-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    const code = document.getElementById('hole-code').value;
    const description = document.getElementById('hole-description').value;
    const un = document.getElementById('hole-un').value;

    if (!code || !description || !un) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    showLoading(true);

    try {
        // Adicionar nova linha à planilha
        await appendToSheet([code, description, un]);
        
        // Recarregar dados
        await loadSheetData();
        
        // Limpar formulário
        document.getElementById('hole-description').value = '';
        document.getElementById('hole-un').value = '';
        
        alert('Produto adicionado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        showLoading(false);
        alert('Erro ao adicionar produto. Verifique o console para mais detalhes.');
    }
});

// Adicionar dados à planilha
async function appendToSheet(values) {
    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:C`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [values]
            }
        });
    } catch (error) {
        console.error('Erro ao adicionar dados:', error);
        throw error;
    }
}

// Atualizar dados na planilha
async function updateSheetCell(row, values) {
    try {
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A${row}:C${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
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
        ? products.filter(p => 
            p.code.toLowerCase().includes(filterText.toLowerCase()) ||
            p.description.toLowerCase().includes(filterText.toLowerCase())
          )
        : products;

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum produto encontrado</td></tr>';
        return;
    }

    filteredProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${product.code}</td>
            <td>${product.description}</td>
            <td>${product.un}</td>
            <td>
                <button class="edit-btn" onclick='editProduct(${JSON.stringify(product)})'>
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
    
    if (!isAuthenticated) {
        alert('Por favor, faça login primeiro.');
        return;
    }

    const row = document.getElementById('edit-row').value;
    const code = document.getElementById('edit-code').value;
    const description = document.getElementById('edit-description').value;
    const un = document.getElementById('edit-un').value;

    showLoading(true);

    try {
        await updateSheetCell(row, [code, description, un]);
        await loadSheetData();
        closeEditModal();
        alert('Produto atualizado com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        showLoading(false);
        alert('Erro ao atualizar produto. Verifique o console para mais detalhes.');
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
    google.accounts.id.disableAutoSelect();
    accessToken = null;
    isAuthenticated = false;
    products = [];
    holes = [];
    
    document.getElementById('app-content').style.display = 'none';
    updateUIForAuth();
    
    // Limpar campos
    document.getElementById('hole-description').value = '';
    document.getElementById('hole-un').value = '';
    document.getElementById('table-search').value = '';
});

// Atualizar UI baseado no estado de autenticação
function updateUIForAuth() {
    const signInDiv = document.querySelector('.g_id_signin');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (isAuthenticated) {
        signInDiv.style.display = 'none';
        logoutBtn.style.display = 'flex';
        
        // Decodificar o token JWT para obter informações do usuário (opcional)
        try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            document.getElementById('user-name').textContent = payload.name || 'Usuário';
        } catch (e) {
            document.getElementById('user-name').textContent = 'Usuário';
        }
    } else {
        signInDiv.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

// Mostrar/esconder loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeEditModal();
    }
}
