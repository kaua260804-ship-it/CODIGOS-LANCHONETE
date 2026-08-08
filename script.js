// ============================================
// Gerenciador de Códigos - Lanchonete
// Versão com Google Sheets API (Service Account)
// ============================================

class ProductManager {
    constructor() {
        // Configuração da planilha Google
        this.SHEET_ID = '1UEGdjjJ416O4SdqtBhncViDwS7E-wId-LFa9HpV9D54';
        this.SHEET_NAME = 'Sheet1';
        this.API_KEY = 'AIzaSyDObnjtRPUZc7_oiEWA41MNeej_IXkklr0'; // Vamos criar isso
        
        // Estado da aplicação
        this.products = [];
        this.currentHoleIndex = -1;
        this.holes = [];
        this.isConnected = false;
        
        // Elementos DOM
        this.initializeDOM();
        
        // Event Listeners
        this.setupEventListeners();
        
        // Carregar dados automaticamente
        this.loadGoogleSheet();
    }

    initializeDOM() {
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

    setupEventListeners() {
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

    // Carrega dados da planilha Google (usando API Key)
    async loadGoogleSheet() {
        try {
            this.showLoading('Carregando dados da planilha...');
            
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${this.SHEET_NAME}!A:C?key=${this.API_KEY}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Erro ao carregar planilha');
            }
            
            const data = await response.json();
            
            if (data.values && data.values.length > 1) {
                this.products = [];
                
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
                this.isConnected = true;
                this.updateAfterLoad();
                this.hideLoading();
                
                if (this.syncStatus) {
                    this.syncStatus.innerHTML = '✅ Conectado ao Google Sheets';
                    this.syncStatus.style.background = '#e8f5e9';
                    this.syncStatus.style.color = '#2e7d32';
                }
            }
            
        } catch (error) {
            console.error('Erro ao carregar planilha:', error);
            this.hideLoading();
            this.loadFromLocalStorage();
            
            if (this.syncStatus) {
                this.syncStatus.innerHTML = '⚠️ Usando dados locais (planilha não acessível)';
                this.syncStatus.style.background = '#fff3e0';
                this.syncStatus.style.color = '#e65100';
            }
        }
    }

    // Para escrita, vamos usar um Google Apps Script como intermediário
    async saveToGoogleSheet() {
        // Como a API Key só permite leitura, vamos salvar localmente
        // e oferecer download para atualizar a planilha manualmente
        this.saveToLocalStorage();
        this.showNotification('💾 Dados salvos localmente. Use o botão "Download Backup" para baixar a planilha atualizada.');
        
        if (this.syncStatus) {
            this.syncStatus.innerHTML = '💾 Salvo localmente - Faça download para atualizar a planilha';
            this.syncStatus.style.background = '#e3f2fd';
            this.syncStatus.style.color = '#1565c0';
        }
    }

    async syncWithGoogleSheets() {
        alert('Para atualizar a planilha Google:\n\n1. Clique em "Download Backup"\n2. Abra sua planilha no Google Sheets\n3. Vá em Arquivo > Importar > Upload\n4. Selecione o arquivo baixado\n5. Substitua a planilha atual');
    }

    updateAfterLoad() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        this.uploadBox.querySelector('h3').textContent = '☁️ Google Sheets';
        this.uploadBox.querySelector('p').textContent = 'Dados carregados da planilha online';
        
        const hint = this.uploadBox.querySelector('.upload-hint');
        if (hint) {
            hint.textContent = 'Leitura online | Para salvar, use Download Backup';
        }
        
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        this.findAllHoles();
        this.renderTable();
        this.saveToLocalStorage();
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

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

    updateAfterUpload() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        this.findAllHoles();
        this.renderTable();
        this.saveToLocalStorage();
    }

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
        this.showNotification('✅ Planilha baixada! Importe no Google Sheets para atualizar.');
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('productData', JSON.stringify(this.products));
        } catch (error) {
            console.warn('Erro ao salvar cache local:', error);
        }
    }

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
                    hint.textContent = 'Carregue um arquivo ou configure a API do Google Sheets';
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
        
        await this.saveToGoogleSheet();
    }

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

    resetSearch() {
        this.currentHoleIndex = -1;
        this.findAllHoles();
        this.resultsContainer.style.display = 'none';
        this.noResults.style.display = 'none';
    }

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

    async deleteProduct(index) {
        if (confirm('Excluir este produto?')) {
            this.products.splice(index, 1);
            this.findAllHoles();
            this.renderTable();
            this.totalProducts.textContent = this.products.length;
            this.saveToLocalStorage();
            await this.saveToGoogleSheet();
        }
    }

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

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
    }

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
