// ============================================
// Gerenciador de Códigos - Lanchonete
// Versão com Google Sheets API
// ============================================

class ProductManager {
    constructor() {
        // Configuração da planilha Google
        this.SHEET_ID = '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54';
        this.SHEET_NAME = 'Sheet1'; // Nome da aba
        this.API_KEY = ''; // Opcional, para leitura pública
        this.CLIENT_ID = ''; // Necessário para escrita
        this.ACCESS_TOKEN = ''; // Token de acesso OAuth
        
        // Estado da aplicação
        this.products = [];
        this.currentHoleIndex = -1;
        this.holes = [];
        this.isAuthenticated = false;
        
        // Elementos DOM
        this.initializeDOM();
        
        // Event Listeners
        this.setupEventListeners();
        
        // Verificar autenticação
        this.checkAuth();
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
        this.tableBody = document.getElementById('tableBody');
        
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
        
        // Exportar/Download (fallback)
        this.exportBtn.addEventListener('click', () => this.downloadExcel());
        
        // Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    // Verifica autenticação
    checkAuth() {
        // Verifica se há token salvo
        const token = localStorage.getItem('googleAccessToken');
        if (token) {
            this.ACCESS_TOKEN = token;
            this.isAuthenticated = true;
            this.updateAuthUI(true);
            this.loadGoogleSheet();
        } else {
            this.updateAuthUI(false);
            // Carrega do localStorage como fallback
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
                    this.authButton.textContent = '🔄 Reconectar';
                    this.authButton.className = 'btn btn-secondary';
                }
            } else {
                this.authStatus.innerHTML = '⚠️ Não conectado - Clique para autenticar';
                this.authStatus.style.color = '#ff9800';
                if (this.authButton) {
                    this.authButton.textContent = '🔑 Conectar Google';
                    this.authButton.className = 'btn btn-primary';
                }
            }
        }
    }

    // Autenticação OAuth 2.0
    async authenticate() {
        // Configuração OAuth (substitua com suas credenciais)
        const CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';
        const REDIRECT_URI = window.location.origin + window.location.pathname;
        const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
        
        // Gera URL de autenticação
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
            `response_type=token&` +
            `scope=${encodeURIComponent(SCOPES)}&` +
            `prompt=consent`;
        
        // Verifica se já retornou com token
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            
            if (accessToken) {
                this.ACCESS_TOKEN = accessToken;
                localStorage.setItem('googleAccessToken', accessToken);
                this.isAuthenticated = true;
                
                // Limpa URL
                window.location.hash = '';
                
                this.updateAuthUI(true);
                await this.loadGoogleSheet();
            }
        } else {
            // Redireciona para autenticação
            window.location.href = authUrl;
        }
    }

    // Carrega dados da planilha Google
    async loadGoogleSheet() {
        if (!this.isAuthenticated || !this.ACCESS_TOKEN) {
            console.log('Não autenticado, usando cache local');
            return;
        }
        
        try {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${this.SHEET_NAME}!A:C`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.ACCESS_TOKEN}`
                    }
                }
            );
            
            if (!response.ok) {
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
            }
            
        } catch (error) {
            console.error('Erro ao carregar planilha:', error);
            alert('Erro ao conectar com Google Sheets. Usando dados locais.');
            this.loadFromLocalStorage();
        }
    }

    // Salva dados na planilha Google
    async saveToGoogleSheet() {
        if (!this.isAuthenticated || !this.ACCESS_TOKEN) {
            alert('Autenticação necessária. Clique em "Conectar Google".');
            return false;
        }
        
        try {
            // Prepara dados para enviar
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
            
            this.showNotification('✅ Planilha atualizada com sucesso!');
            return true;
            
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar na planilha. Tente novamente.');
            return false;
        }
    }

    // Atualiza interface após carregar
    updateAfterLoad() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        this.uploadBox.querySelector('h3').textContent = '☁️ Google Sheets Conectado';
        this.uploadBox.querySelector('p').textContent = 'Dados carregados da nuvem';
        
        const hint = this.uploadBox.querySelector('.upload-hint');
        if (hint) {
            hint.textContent = 'Alterações salvas automaticamente na nuvem';
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
        
        this.uploadBox.querySelector('h3').textContent = '📁 Arquivo Local';
        this.uploadBox.querySelector('p').textContent = 'Dados carregados do arquivo';
        
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        this.findAllHoles();
        this.renderTable();
        this.saveToLocalStorage();
        
        // Tenta salvar na nuvem se autenticado
        if (this.isAuthenticated) {
            this.saveToGoogleSheet();
        }
    }

    // Download Excel (fallback)
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
                    hint.textContent = 'Conecte ao Google Sheets para salvar na nuvem';
                }
                
                this.findNextBtn.disabled = false;
                this.exportBtn.disabled = false;
                
                this.findAllHoles();
                this.renderTable();
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
        await this.saveToGoogleSheet();
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
                        Nenhum produto carregado
                    </td>
                </tr>
            `;
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
                        
                        // Salva na nuvem
                        await this.saveToGoogleSheet();
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
            
            // Salva na nuvem
            await this.saveToGoogleSheet();
        }
    }

    // Notificação
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: slideIn 0.3s ease, fadeOut 0.5s ease 2s forwards;
            font-weight: 600;
        `;
        
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
