// ============================================
// Gerenciador de Códigos - Lanchonete
// Versão para GitHub Pages com Google Sheets
// ============================================

class ProductManager {
    constructor() {
        // Configuração da planilha Google
        this.SHEET_ID = '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54';
        this.SHEET_NAME = 'Sheet1'; // Nome da aba da planilha
        
        // Configuração OAuth (substitua com suas credenciais)
        this.CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';
        this.REDIRECT_URI = 'https://kaua260804-ship-it.github.io/CODIGOS-LANCHONETE';
        
        // Estado da aplicação
        this.products = [];
        this.currentHoleIndex = -1;
        this.holes = [];
        this.isAuthenticated = false;
        this.ACCESS_TOKEN = null;
        
        // Elementos DOM
        this.initializeDOM();
        
        // Event Listeners
        this.setupEventListeners();
        
        // Verificar autenticação ao carregar
        this.checkAuthentication();
    }

    // Inicializa referências aos elementos DOM
    initializeDOM() {
        // Autenticação
        this.authSection = document.getElementById('authSection');
        this.authButton = document.getElementById('authButton');
        this.authStatus = document.getElementById('authStatus');
        
        // Status do arquivo
        this.uploadBox = document.getElementById('uploadBox');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.totalProducts = document.getElementById('totalProducts');
        this.syncStatus = document.getElementById('syncStatus');
        
        // Pesquisa
        this.findNextBtn = document.getElementById('findNextBtn');
        this.resetSearchBtn = document.getElementById('resetSearchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.noResults = document.getElementById('noResults');
        
        // Campos de exibição
        this.infCodigo = document.getElementById('infCodigo');
        this.infDescricao = document.getElementById('infDescricao');
        this.infUN = document.getElementById('infUN');
        this.missingCodigo = document.getElementById('missingCodigo');
        this.supCodigo = document.getElementById('supCodigo');
        this.supDescricao = document.getElementById('supDescricao');
        this.supUN = document.getElementById('supUN');
        
        // Formulário de inserção
        this.newDescricao = document.getElementById('newDescricao');
        this.newUN = document.getElementById('newUN');
        this.saveNewBtn = document.getElementById('saveNewBtn');
        
        // Edição
        this.exportBtn = document.getElementById('exportBtn');
        this.syncNowBtn = document.getElementById('syncNowBtn');
        this.tableBody = document.getElementById('tableBody');
        this.tableCount = document.getElementById('tableCount');
        
        // Tabs
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    // Configura todos os event listeners
    setupEventListeners() {
        // Autenticação
        if (this.authButton) {
            this.authButton.addEventListener('click', () => this.authenticate());
        }
        
        // Upload manual (fallback)
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Drag and drop
        this.uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = 'var(--primary-color)';
        });
        
        this.uploadBox.addEventListener('dragleave', () => {
            this.uploadBox.style.borderColor = 'var(--border-color)';
        });
        
        this.uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = 'var(--border-color)';
            const file = e.dataTransfer.files[0];
            if (file) {
                this.processFile(file);
            }
        });
        
        // Pesquisa
        this.findNextBtn.addEventListener('click', () => this.findNextHole());
        this.resetSearchBtn.addEventListener('click', () => this.resetSearch());
        
        // Salvar novo produto
        this.saveNewBtn.addEventListener('click', () => this.saveNewProduct());
        
        // Exportar/Download
        this.exportBtn.addEventListener('click', () => this.downloadExcel());
        
        // Sincronizar manualmente
        if (this.syncNowBtn) {
            this.syncNowBtn.addEventListener('click', () => this.syncWithGoogleSheets());
        }
        
        // Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    // Verifica autenticação (token na URL ou localStorage)
    checkAuthentication() {
        // Verifica se há token na URL (retorno do OAuth)
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            
            if (accessToken) {
                this.ACCESS_TOKEN = accessToken;
                localStorage.setItem('googleAccessToken', accessToken);
                this.isAuthenticated = true;
                
                // Limpa a URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                this.updateAuthUI(true);
                this.loadGoogleSheet();
                return;
            }
        }
        
        // Verifica token salvo no localStorage
        const savedToken = localStorage.getItem('googleAccessToken');
        if (savedToken) {
            this.ACCESS_TOKEN = savedToken;
            this.isAuthenticated = true;
            this.updateAuthUI(true);
            this.loadGoogleSheet();
        } else {
            this.updateAuthUI(false);
            this.loadFromLocalStorage();
        }
    }

    // Atualiza UI de autenticação
    updateAuthUI(authenticated) {
        if (this.authStatus) {
            if (authenticated) {
                this.authStatus.innerHTML = '✅ Conectado ao Google Sheets';
                this.authStatus.style.color = '#4CAF50';
                if (this.authButton) {
                    this.authButton.textContent = '🔄 Reconectar Google Sheets';
                    this.authButton.className = 'btn btn-secondary';
                }
            } else {
                this.authStatus.innerHTML = '⚠️ Não conectado - Clique para autenticar';
                this.authStatus.style.color = '#ff9800';
                if (this.authButton) {
                    this.authButton.textContent = '🔑 Conectar Google Sheets';
                    this.authButton.className = 'btn btn-primary';
                }
            }
        }
    }

    // Autenticação OAuth 2.0 para GitHub Pages
    authenticate() {
        const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
        
        // Construir URL de autenticação
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.append('client_id', this.CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', this.REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'token');
        authUrl.searchParams.append('scope', SCOPES);
        authUrl.searchParams.append('prompt', 'consent');
        authUrl.searchParams.append('access_type', 'offline');
        
        // Redireciona para autenticação Google
        window.location.href = authUrl.toString();
    }

    // Carrega dados da planilha Google
    async loadGoogleSheet() {
        if (!this.isAuthenticated || !this.ACCESS_TOKEN) {
            console.log('Não autenticado, usando cache local');
            return;
        }
        
        try {
            this.showLoading('Carregando dados da planilha...');
            
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${this.SHEET_NAME}!A:C`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.ACCESS_TOKEN}`
                    }
                }
            );
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expirado
                    this.isAuthenticated = false;
                    localStorage.removeItem('googleAccessToken');
                    this.updateAuthUI(false);
                    throw new Error('Sessão expirada. Faça login novamente.');
                }
                throw new Error('Erro ao carregar planilha');
            }
            
            const data = await response.json();
            
            if (data.values && data.values.length > 1) {
                this.products = [];
                
                // Pula cabeçalho
                for (let i = 1; i < data.values.length; i++) {
                    const row = data.values[i];
                    if (row && row.length >= 3 && row[0] && !isNaN(row[0])) {
                        this.products.push({
                            codigo: parseInt(row[0]),
                            descricao: row[1] || '',
                            un: row[2] || 'UN'
                        });
                    }
                }
                
                this.products.sort((a, b) => a.codigo - b.codigo);
                this.updateAfterLoad();
                this.hideLoading();
                
                if (this.syncStatus) {
                    this.syncStatus.innerHTML = '✅ Sincronizado com Google Sheets';
                    this.syncStatus.style.background = '#e8f5e9';
                    this.syncStatus.style.color = '#2e7d32';
                }
            }
            
        } catch (error) {
            console.error('Erro ao carregar planilha:', error);
            this.hideLoading();
            alert('Erro ao conectar: ' + error.message);
            this.loadFromLocalStorage();
            
            if (this.syncStatus) {
                this.syncStatus.innerHTML = '❌ Erro na sincronização';
                this.syncStatus.style.background = '#ffebee';
                this.syncStatus.style.color = '#c62828';
            }
        }
    }

    // Salva dados na planilha Google
    async saveToGoogleSheet() {
        if (!this.isAuthenticated || !this.ACCESS_TOKEN) {
            this.showNotification('⚠️ Conecte ao Google Sheets primeiro');
            return false;
        }
        
        try {
            this.showLoading('Salvando na planilha...');
            
            // Prepara dados
            const values = [
                ['Código', 'Descrição', 'UN'],
                ...this.products.map(p => [p.codigo.toString(), p.descricao, p.un])
            ];
            
            // Limpa planilha existente
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${this.SHEET_NAME}!A:C:clear`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Escreve novos dados
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${this.SHEET_NAME}!A1:C${values.length}?valueInputOption=RAW`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: values
                    })
                }
            );
            
            if (!response.ok) {
                throw new Error('Erro ao salvar');
            }
            
            this.hideLoading();
            this.showNotification('✅ Planilha atualizada com sucesso!');
            
            if (this.syncStatus) {
                this.syncStatus.innerHTML = '✅ Sincronizado com Google Sheets';
                this.syncStatus.style.background = '#e8f5e9';
                this.syncStatus.style.color = '#2e7d32';
            }
            
            return true;
            
        } catch (error) {
            console.error('Erro ao salvar:', error);
            this.hideLoading();
            alert('Erro ao salvar na planilha. Tente novamente.');
            
            if (this.syncStatus) {
                this.syncStatus.innerHTML = '❌ Erro na sincronização';
                this.syncStatus.style.background = '#ffebee';
                this.syncStatus.style.color = '#c62828';
            }
            
            return false;
        }
    }

    // Sincronização manual
    async syncWithGoogleSheets() {
        if (!this.isAuthenticated) {
            alert('Conecte ao Google Sheets primeiro!');
            return;
        }
        
        await this.saveToGoogleSheet();
    }

    // Atualiza interface após carregar
    updateAfterLoad() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        this.uploadBox.querySelector('h3').textContent = '☁️ Google Sheets';
        this.uploadBox.querySelector('p').textContent = 'Planilha conectada na nuvem';
        
        const hint = this.uploadBox.querySelector('.upload-hint');
        if (hint) {
            hint.textContent = 'Alterações são sincronizadas automaticamente';
        }
        
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        this.findAllHoles();
        this.renderTable();
        this.saveToLocalStorage();
    }

    // Processa upload manual
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    // Processa arquivo
    processFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                this.parseData(jsonData);
                
                // Se estiver autenticado, sincroniza com Google Sheets
                if (this.isAuthenticated) {
                    this.saveToGoogleSheet();
                }
            } catch (error) {
                alert('Erro ao ler arquivo.');
                console.error('Erro:', error);
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    // Converte dados brutos
    parseData(rawData) {
        if (!rawData || rawData.length < 2) {
            alert('Planilha vazia.');
            return;
        }

        this.products = [];
        
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (row && row.length >= 3 && row[0] && !isNaN(row[0])) {
                this.products.push({
                    codigo: parseInt(row[0]),
                    descricao: row[1] || '',
                    un: row[2] || 'UN'
                });
            }
        }

        this.products.sort((a, b) => a.codigo - b.codigo);
        this.updateAfterUpload();
    }

    // Atualiza após upload manual
    updateAfterUpload() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        this.findAllHoles();
        this.renderTable();
        this.saveToLocalStorage();
    }

    // Download Excel
    downloadExcel() {
        if (this.products.length === 0) {
            alert('Não há produtos para exportar.');
            return;
        }
        
        const exportData = [
            ['Código', 'Descrição', 'UN'],
            ...this.products.map(p => [p.codigo, p.descricao, p.un])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
        
        XLSX.writeFile(wb, 'CodigoLanchonete.xlsx');
    }

    // Salva no localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('productData', JSON.stringify(this.products));
        } catch (error) {
            console.warn('Erro ao salvar cache local:', error);
        }
    }

    // Carrega do localStorage
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('productData');
            if (savedData) {
                this.products = JSON.parse(savedData);
                this.products.sort((a, b) => a.codigo - b.codigo);
                
                this.fileInfo.style.display = 'block';
                this.totalProducts.textContent = this.products.length;
                
                this.uploadBox.querySelector('h3').textContent = '💾 Dados Locais';
                this.uploadBox.querySelector('p').textContent = 'Usando cache do navegador';
                
                const hint = this.uploadBox.querySelector('.upload-hint');
                if (hint) {
                    hint.textContent = 'Conecte ao Google Sheets para sincronizar';
                }
                
                this.findNextBtn.disabled = false;
                this.exportBtn.disabled = false;
                
                this.findAllHoles();
                this.renderTable();
                
                if (this.syncStatus) {
                    this.syncStatus.innerHTML = '💾 Dados locais (não sincronizado)';
                    this.syncStatus.style.background = '#fff3e0';
                    this.syncStatus.style.color = '#e65100';
                }
            }
        } catch (error) {
            console.warn('Erro ao carregar cache:', error);
        }
    }

    // Encontra buracos
    findAllHoles() {
        this.holes = [];
        this.currentHoleIndex = -1;
        
        for (let i = 0; i < this.products.length - 1; i++) {
            const currentCode = this.products[i].codigo;
            const nextCode = this.products[i + 1].codigo;
            
            if (nextCode - currentCode > 1) {
                for (let code = currentCode + 1; code < nextCode; code++) {
                    this.holes.push({
                        missingCode: code,
                        inferiorIndex: i,
                        superiorIndex: i + 1
                    });
                }
            }
        }
    }

    // Próximo buraco
    findNextHole() {
        if (this.products.length === 0) {
            alert('Carregue os dados primeiro!');
            return;
        }
        
        if (this.holes.length === 0) {
            this.resultsContainer.style.display = 'none';
            this.noResults.style.display = 'block';
            return;
        }
        
        this.currentHoleIndex++;
        if (this.currentHoleIndex >= this.holes.length) {
            this.currentHoleIndex = 0;
        }
        
        this.displayCurrentHole();
    }

    // Exibe buraco atual
    displayCurrentHole() {
        if (this.currentHoleIndex < 0 || this.currentHoleIndex >= this.holes.length) {
            return;
        }
        
        const hole = this.holes[this.currentHoleIndex];
        const inferior = this.products[hole.inferiorIndex];
        const superior = this.products[hole.superiorIndex];
        
        this.infCodigo.textContent = inferior.codigo;
        this.infDescricao.textContent = inferior.descricao;
        this.infUN.textContent = inferior.un;
        
        this.missingCodigo.textContent = hole.missingCode;
        
        this.supCodigo.textContent = superior.codigo;
        this.supDescricao.textContent = superior.descricao;
        this.supUN.textContent = superior.un;
        
        this.newDescricao.value = '';
        this.newUN.value = '';
        
        this.resultsContainer.style.display = 'block';
        this.noResults.style.display = 'none';
    }

    // Salva novo produto
    async saveNewProduct() {
        if (this.currentHoleIndex < 0) {
            alert('Nenhum buraco selecionado.');
            return;
        }
        
        const descricao = this.newDescricao.value.trim();
        const un = this.newUN.value.trim();
        
        if (!descricao) {
            alert('Informe a descrição.');
            return;
        }
        
        if (!un) {
            alert('Informe a unidade.');
            return;
        }
        
        const hole = this.holes[this.currentHoleIndex];
        
        this.products.push({
            codigo: hole.missingCode,
            descricao: descricao.toUpperCase(),
            un: un.toUpperCase()
        });
        
        this.products.sort((a, b) => a.codigo - b.codigo);
        this.findAllHoles();
        this.updateAfterSave();
        
        // Salva na nuvem
        if (this.isAuthenticated) {
            await this.saveToGoogleSheet();
        } else {
            this.showNotification('⚠️ Produto salvo localmente. Conecte ao Google Sheets para sincronizar.');
        }
    }

    // Atualiza após salvar
    updateAfterSave() {
        this.renderTable();
        this.totalProducts.textContent = this.products.length;
        this.saveToLocalStorage();
        
        if (this.holes.length === 0) {
            this.resultsContainer.style.display = 'none';
            this.noResults.style.display = 'block';
        } else {
            if (this.currentHoleIndex >= this.holes.length) {
                this.currentHoleIndex = this.holes.length - 1;
            }
            this.displayCurrentHole();
        }
    }

    // Reinicia pesquisa
    resetSearch() {
        this.currentHoleIndex = -1;
        this.findAllHoles();
        this.resultsContainer.style.display = 'none';
        this.noResults.style.display = 'none';
    }

    // Renderiza tabela
    renderTable() {
        this.tableBody.innerHTML = '';
        
        if (this.products.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-message">
                        📋 Nenhum produto carregado
                    </td>
                </tr>
            `;
            this.tableCount.textContent = '0';
            return;
        }
        
        this.products.forEach((product, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.codigo}</td>
                <td class="editable" data-field="descricao" data-index="${index}">
                    ${product.descricao}
                </td>
                <td class="editable" data-field="un" data-index="${index}">
                    ${product.un}
                </td>
                <td>
                    <button class="btn btn-danger" onclick="productManager.deleteProduct(${index})">
                        🗑️
                    </button>
                </td>
            `;
            
            this.tableBody.appendChild(row);
        });
        
        this.tableCount.textContent = this.products.length;
        this.setupEditListeners();
    }

    // Edit listeners
    setupEditListeners() {
        const editableCells = document.querySelectorAll('.editable');
        
        editableCells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                const field = cell.dataset.field;
                const index = parseInt(cell.dataset.index);
                const currentValue = this.products[index][field];
                
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentValue;
                input.className = 'edit-input';
                
                cell.innerHTML = '';
                cell.appendChild(input);
                input.focus();
                
                const saveEdit = async () => {
                    const newValue = input.value.trim();
                    if (newValue && newValue !== currentValue) {
                        this.products[index][field] = newValue.toUpperCase();
                        this.saveToLocalStorage();
                        this.renderTable();
                        
                        if (this.isAuthenticated) {
                            await this.saveToGoogleSheet();
                        }
                    } else {
                        cell.textContent = currentValue;
                    }
                };
                
                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        await saveEdit();
                    }
                });
            });
        });
    }

    // Deleta produto
    async deleteProduct(index) {
        if (confirm('Excluir este produto?')) {
            this.products.splice(index, 1);
            this.findAllHoles();
            this.renderTable();
            this.totalProducts.textContent = this.products.length;
            this.saveToLocalStorage();
            
            if (this.isAuthenticated) {
                await this.saveToGoogleSheet();
            }
        }
    }

    // Loading
    showLoading(message) {
        let loading = document.getElementById('loadingOverlay');
        if (!loading) {
            loading = document.createElement('div');
            loading.id = 'loadingOverlay';
            loading.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            document.body.appendChild(loading);
        }
        
        loading.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
                <div class="spinner"></div>
                <p style="margin-top: 15px;">${message}</p>
            </div>
        `;
    }

    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.remove();
        }
    }

    // Notificação
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }

    // Alterna abas
    switchTab(tabId) {
        this.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(tabId);
        
        if (activeBtn && activeContent) {
            activeBtn.classList.add('active');
            activeContent.classList.add('active');
        }
        
        if (tabId === 'tab-edicao') {
            this.renderTable();
        }
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    window.productManager = new ProductManager();
});
