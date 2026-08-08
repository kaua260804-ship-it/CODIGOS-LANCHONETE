// ============================================
// Gerenciador de Códigos - Lanchonete
// Versão com leitura/escrita direta do arquivo
// ============================================

class ProductManager {
    constructor() {
        // Estado da aplicação
        this.products = [];
        this.currentHoleIndex = -1;
        this.holes = [];
        this.fileName = 'CodigoLanchonete.xlsx';
        this.isFileLoaded = false;
        
        // Elementos DOM
        this.initializeDOM();
        
        // Event Listeners
        this.setupEventListeners();
        
        // Carregar arquivo automaticamente
        this.loadDefaultFile();
    }

    // Inicializa referências aos elementos DOM
    initializeDOM() {
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
        
        // Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Auto-save antes de fechar
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                this.saveToLocalStorage();
                this.downloadExcelSilent();
            }
        });
    }

    // Carrega o arquivo padrão da pasta raiz
    async loadDefaultFile() {
        try {
            // Tenta carregar o arquivo da mesma pasta
            const response = await fetch(this.fileName);
            
            if (!response.ok) {
                throw new Error('Arquivo não encontrado');
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            // Processa o arquivo
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            this.parseData(jsonData);
            this.isFileLoaded = true;
            this.showSuccessMessage();
            
        } catch (error) {
            console.warn('Arquivo padrão não encontrado:', error);
            this.showFileNotFound();
            
            // Tenta carregar do localStorage como fallback
            this.loadFromLocalStorage();
        }
    }

    // Mostra mensagem de sucesso
    showSuccessMessage() {
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        // Remove mensagem de erro se existir
        const errorMsg = document.querySelector('.warning-message');
        if (errorMsg) {
            errorMsg.remove();
        }
        
        // Atualiza upload box
        this.uploadBox.querySelector('h3').textContent = '📁 Arquivo Carregado';
        this.uploadBox.querySelector('p').textContent = 'CodigoLanchonete.xlsx';
        
        const hint = this.uploadBox.querySelector('.upload-hint');
        if (hint) {
            hint.textContent = 'As alterações serão salvas automaticamente no arquivo';
        }
    }

    // Mostra arquivo não encontrado
    showFileNotFound() {
        const uploadBox = this.uploadBox;
        
        // Verifica se já existe mensagem
        if (!document.querySelector('.warning-message')) {
            const warning = document.createElement('div');
            warning.className = 'warning-message';
            warning.innerHTML = `
                ⚠️ Arquivo <strong>CodigoLanchonete.xlsx</strong> não encontrado na pasta raiz.<br>
                Faça upload manual de um arquivo ou crie o arquivo na mesma pasta do site.
            `;
            uploadBox.appendChild(warning);
        }
        
        uploadBox.querySelector('h3').textContent = '📤 Upload Manual';
        uploadBox.querySelector('p').textContent = 'Arquivo padrão não encontrado';
        
        const hint = uploadBox.querySelector('.upload-hint');
        if (hint) {
            hint.textContent = 'Formatos aceitos: CSV, XLS, XLSX';
        }
    }

    // Processa upload manual
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileName = file.name;
            this.processFile(file);
        }
    }

    // Processa arquivo (comum para todos os métodos)
    processFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                this.parseData(jsonData);
                this.isFileLoaded = true;
                this.showSuccessMessage();
                
            } catch (error) {
                alert('Erro ao ler o arquivo. Verifique se é um formato válido (CSV, XLS, XLSX).');
                console.error('Erro:', error);
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    // Converte os dados brutos para o formato interno
    parseData(rawData) {
        if (!rawData || rawData.length < 2) {
            alert('A planilha está vazia ou não possui dados suficientes.');
            return;
        }

        this.products = [];
        
        // Pula a primeira linha (cabeçalho)
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

        if (this.products.length === 0) {
            alert('Nenhum produto válido encontrado na planilha.');
            return;
        }

        // Ordena por código
        this.products.sort((a, b) => a.codigo - b.codigo);
        
        // Atualiza interface
        this.updateAfterUpload();
    }

    // Atualiza interface após upload
    updateAfterUpload() {
        this.totalProducts.textContent = this.products.length;
        
        // Habilita botões
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        // Encontra todos os buracos
        this.findAllHoles();
        
        // Salva no localStorage como cache
        this.saveToLocalStorage();
        
        // Atualiza tabela se estiver visível
        this.renderTable();
    }

    // Gera o Excel para download
    generateExcel() {
        const exportData = [
            ['Código', 'Descrição', 'UN'],
            ...this.products.map(p => [p.codigo, p.descricao, p.un])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
        
        return wb;
    }

    // Download do Excel (visível para o usuário)
    downloadExcel() {
        if (this.products.length === 0) {
            alert('Não há produtos para exportar.');
            return;
        }
        
        const wb = this.generateExcel();
        XLSX.writeFile(wb, this.fileName);
        
        // Mostra mensagem
        this.showSaveConfirmation();
    }

    // Download silencioso (auto-save)
    downloadExcelSilent() {
        if (this.products.length === 0) return;
        
        try {
            const wb = this.generateExcel();
            XLSX.writeFile(wb, this.fileName);
        } catch (error) {
            console.warn('Auto-save falhou:', error);
        }
    }

    // Mostra confirmação de salvamento
    showSaveConfirmation() {
        // Cria elemento de notificação
        const notification = document.createElement('div');
        notification.className = 'save-notification';
        notification.innerHTML = '✅ Arquivo salvo com sucesso!';
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
        
        // Remove após animação
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
        // Adiciona estilos de animação se não existirem
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Verifica se há alterações não salvas
    hasUnsavedChanges() {
        const savedData = localStorage.getItem('productData');
        if (!savedData) return true;
        
        try {
            const savedProducts = JSON.parse(savedData);
            return JSON.stringify(this.products) !== JSON.stringify(savedProducts);
        } catch {
            return true;
        }
    }

    // Salva no localStorage (cache)
    saveToLocalStorage() {
        try {
            localStorage.setItem('productData', JSON.stringify(this.products));
        } catch (error) {
            console.warn('Não foi possível salvar no localStorage:', error);
        }
    }

    // Carrega do localStorage (fallback)
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('productData');
            if (savedData) {
                this.products = JSON.parse(savedData);
                this.products.sort((a, b) => a.codigo - b.codigo);
                this.updateAfterUpload();
                this.isFileLoaded = true;
                
                console.log('Dados carregados do cache local');
                
                // Atualiza interface
                this.fileInfo.style.display = 'block';
                this.uploadBox.querySelector('h3').textContent = '💾 Dados em Cache';
                this.uploadBox.querySelector('p').textContent = 'Usando dados salvos localmente';
                
                const hint = this.uploadBox.querySelector('.upload-hint');
                if (hint) {
                    hint.textContent = 'Faça upload de um arquivo para atualizar';
                }
            }
        } catch (error) {
            console.warn('Não foi possível carregar do localStorage:', error);
        }
    }

    // Encontra todos os buracos na sequência
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

    // Encontra o próximo buraco
    findNextHole() {
        if (!this.isFileLoaded || this.products.length === 0) {
            alert('Carregue um arquivo primeiro!');
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

    // Exibe o buraco atual
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

    // Salva um novo produto
    saveNewProduct() {
        if (this.currentHoleIndex < 0) {
            alert('Nenhum buraco selecionado.');
            return;
        }
        
        const descricao = this.newDescricao.value.trim();
        const un = this.newUN.value.trim();
        
        if (!descricao) {
            alert('Por favor, informe a descrição do produto.');
            return;
        }
        
        if (!un) {
            alert('Por favor, informe a unidade de medida.');
            return;
        }
        
        const hole = this.holes[this.currentHoleIndex];
        
        const newProduct = {
            codigo: hole.missingCode,
            descricao: descricao.toUpperCase(),
            un: un.toUpperCase()
        };
        
        this.products.push(newProduct);
        this.products.sort((a, b) => a.codigo - b.codigo);
        
        this.findAllHoles();
        this.updateAfterSave();
        
        // Auto-download do arquivo atualizado
        this.downloadExcel();
    }

    // Atualiza interface após salvar
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

    // Reinicia a pesquisa
    resetSearch() {
        this.currentHoleIndex = -1;
        this.findAllHoles();
        this.resultsContainer.style.display = 'none';
        this.noResults.style.display = 'none';
        
        if (this.holes.length > 0) {
            this.findNextBtn.disabled = false;
        }
    }

    // Renderiza a tabela de produtos
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

    // Configura listeners para edição inline
    setupEditListeners() {
        const editableCells = document.querySelectorAll('.editable');
        
        editableCells.forEach(cell => {
            cell.addEventListener('click', (e) => {
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
                
                const saveEdit = () => {
                    const newValue = input.value.trim();
                    if (newValue && newValue !== currentValue) {
                        this.products[index][field] = newValue.toUpperCase();
                        this.saveToLocalStorage();
                        this.renderTable();
                        
                        // Auto-download
                        this.downloadExcel();
                    } else {
                        cell.textContent = currentValue;
                    }
                };
                
                input.addEventListener('blur', saveEdit);
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveEdit();
                    }
                });
            });
        });
    }

    // Deleta um produto
    deleteProduct(index) {
        if (confirm('Tem certeza que deseja excluir este produto?')) {
            this.products.splice(index, 1);
            this.findAllHoles();
            this.renderTable();
            this.totalProducts.textContent = this.products.length;
            this.saveToLocalStorage();
            
            // Auto-download
            this.downloadExcel();
        }
    }

    // Alterna entre abas
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

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.productManager = new ProductManager();
    
    // Adiciona botão de salvamento manual no header
    const header = document.querySelector('.header');
    const saveButtonContainer = document.createElement('div');
    saveButtonContainer.style.cssText = `
        margin-top: 15px;
        position: relative;
        z-index: 1;
    `;
    
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-success';
    saveButton.innerHTML = '💾 Salvar Arquivo Agora';
    saveButton.onclick = () => {
        if (window.productManager && window.productManager.products.length > 0) {
            window.productManager.downloadExcel();
        }
    };
    
    saveButtonContainer.appendChild(saveButton);
    header.appendChild(saveButtonContainer);
});
