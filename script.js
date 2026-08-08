// ============================================
// Gerenciador de Códigos - Lanchonete
// Versão com File System Access API
// ============================================

class ProductManager {
    constructor() {
        // Estado da aplicação
        this.products = [];
        this.currentHoleIndex = -1;
        this.holes = [];
        this.fileHandle = null; // Referência ao arquivo
        this.currentFileName = '';
        
        // Elementos DOM
        this.initializeDOM();
        
        // Event Listeners
        this.setupEventListeners();
        
        // Verificar suporte à API
        this.checkFileSystemAPISupport();
    }

    // Verifica se o navegador suporta a File System Access API
    checkFileSystemAPISupport() {
        if (!('showOpenFilePicker' in window)) {
            console.warn('File System Access API não suportada. Usando fallback.');
            // Adiciona aviso na interface
            const uploadBox = document.querySelector('.upload-box');
            const warning = document.createElement('div');
            warning.className = 'warning-message';
            warning.innerHTML = `
                ⚠️ Seu navegador não suporta edição direta de arquivos.
                <br>Use Chrome, Edge ou Opera para melhor experiência.
                <br>O sistema usará download/upload como alternativa.
            `;
            warning.style.cssText = `
                background: #fff3cd;
                color: #856404;
                padding: 10px;
                border-radius: 5px;
                margin-top: 10px;
                font-size: 0.9em;
            `;
            uploadBox.appendChild(warning);
        }
    }

    // Inicializa referências aos elementos DOM
    initializeDOM() {
        // Upload
        this.uploadBox = document.getElementById('uploadBox');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInfo = document.getElementById('fileInfo');
        this.totalProducts = document.getElementById('totalProducts');
        
        // Botões de arquivo
        this.createFileButtons();
        
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

    // Cria botões adicionais para gerenciamento de arquivo
    createFileButtons() {
        const fileInfo = document.getElementById('fileInfo');
        
        // Container para botões
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'file-buttons';
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 15px;
            justify-content: center;
            flex-wrap: wrap;
        `;
        
        // Botão Salvar no Arquivo
        const saveToFileBtn = document.createElement('button');
        saveToFileBtn.className = 'btn btn-success';
        saveToFileBtn.textContent = '💾 Salvar no Arquivo Original';
        saveToFileBtn.id = 'saveToFileBtn';
        saveToFileBtn.style.display = 'none';
        
        // Botão Salvar Como
        const saveAsBtn = document.createElement('button');
        saveAsBtn.className = 'btn btn-primary';
        saveAsBtn.textContent = '📁 Salvar Como Novo Arquivo';
        saveAsBtn.id = 'saveAsBtn';
        saveAsBtn.style.display = 'none';
        
        buttonContainer.appendChild(saveToFileBtn);
        buttonContainer.appendChild(saveAsBtn);
        
        // Adiciona após o elemento existente
        fileInfo.appendChild(buttonContainer);
        
        // Atualiza referências
        this.saveToFileBtn = saveToFileBtn;
        this.saveAsBtn = saveAsBtn;
        
        // Event listeners
        saveToFileBtn.addEventListener('click', () => this.saveToOriginalFile());
        saveAsBtn.addEventListener('click', () => this.saveAsNewFile());
    }

    // Configura todos os event listeners
    setupEventListeners() {
        // Upload tradicional
        this.uploadBtn.addEventListener('click', () => {
            if ('showOpenFilePicker' in window) {
                this.openFileWithPicker();
            } else {
                this.fileInput.click();
            }
        });
        
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Drag and drop
        this.uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = 'var(--primary-color)';
        });
        
        this.uploadBox.addEventListener('dragleave', () => {
            this.uploadBox.style.borderColor = 'var(--border-color)';
        });
        
        this.uploadBox.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = 'var(--border-color)';
            
            const file = e.dataTransfer.files[0];
            if (file) {
                // Para drag and drop, não temos file handle, então usamos fallback
                this.fileHandle = null;
                await this.processFile(file);
            }
        });
        
        // Pesquisa
        this.findNextBtn.addEventListener('click', () => this.findNextHole());
        this.resetSearchBtn.addEventListener('click', () => this.resetSearch());
        
        // Salvar novo produto
        this.saveNewBtn.addEventListener('click', () => this.saveNewProduct());
        
        // Exportar (fallback)
        this.exportBtn.addEventListener('click', () => this.exportToExcel());
        
        // Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Auto-save quando houver alterações
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges && this.fileHandle) {
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Deseja sair?';
                return e.returnValue;
            }
        });
    }

    // Abre arquivo usando File System Access API
    async openFileWithPicker() {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'Planilhas',
                        accept: {
                            'text/csv': ['.csv'],
                            'application/vnd.ms-excel': ['.xls'],
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                        }
                    }
                ]
            });
            
            this.fileHandle = fileHandle;
            const file = await fileHandle.getFile();
            await this.processFile(file);
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Erro ao abrir arquivo:', error);
                alert('Erro ao abrir o arquivo.');
            }
        }
    }

    // Processa arquivo (comum para todos os métodos)
    async processFile(file) {
        try {
            this.currentFileName = file.name;
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            this.parseData(jsonData);
            this.hasUnsavedChanges = false;
            
        } catch (error) {
            alert('Erro ao ler o arquivo. Verifique se é um formato válido.');
            console.error('Erro:', error);
        }
    }

    // Processa upload tradicional
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileHandle = null; // Upload tradicional não tem file handle
            this.processFile(file);
        }
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
        // Mostra informações do arquivo
        this.fileInfo.style.display = 'block';
        this.totalProducts.textContent = this.products.length;
        
        // Atualiza nome do arquivo
        const fileInfoDiv = document.querySelector('.file-info');
        let fileNameElement = document.getElementById('currentFileName');
        if (!fileNameElement) {
            fileNameElement = document.createElement('div');
            fileNameElement.id = 'currentFileName';
            fileNameElement.style.cssText = 'margin-top: 10px; color: #666; font-size: 0.9em;';
            fileInfoDiv.insertBefore(fileNameElement, fileInfoDiv.querySelector('.file-buttons'));
        }
        
        if (this.currentFileName) {
            fileNameElement.innerHTML = `📄 Arquivo: <strong>${this.currentFileName}</strong>`;
        }
        
        // Mostra botões de salvamento
        if (this.saveToFileBtn && this.saveAsBtn) {
            this.saveToFileBtn.style.display = this.fileHandle ? 'inline-block' : 'none';
            this.saveAsBtn.style.display = 'inline-block';
        }
        
        // Habilita botões
        this.findNextBtn.disabled = false;
        this.exportBtn.disabled = false;
        
        // Encontra todos os buracos
        this.findAllHoles();
        
        // Atualiza tabela se estiver visível
        this.renderTable();
        
        // Marca como sem alterações
        this.hasUnsavedChanges = false;
    }

    // Salva no arquivo original (File System Access API)
    async saveToOriginalFile() {
        if (!this.fileHandle) {
            alert('Este arquivo foi carregado via upload tradicional. Use "Salvar Como Novo Arquivo".');
            return;
        }
        
        try {
            const writable = await this.fileHandle.createWritable();
            const content = this.generateExcelBuffer();
            await writable.write(content);
            await writable.close();
            
            this.hasUnsavedChanges = false;
            alert('✅ Arquivo salvo com sucesso!');
            
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar o arquivo. Tente usar "Salvar Como".');
        }
    }

    // Salva como novo arquivo
    async saveAsNewFile() {
        try {
            if ('showSaveFilePicker' in window) {
                // Usa API moderna
                const handle = await window.showSaveFilePicker({
                    suggestedName: this.currentFileName || 'produtos_lanchonete.xlsx',
                    types: [
                        {
                            description: 'Planilha Excel',
                            accept: {
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                            }
                        }
                    ]
                });
                
                const writable = await handle.createWritable();
                const content = this.generateExcelBuffer();
                await writable.write(content);
                await writable.close();
                
                // Atualiza o file handle
                this.fileHandle = handle;
                this.hasUnsavedChanges = false;
                
                alert('✅ Arquivo salvo com sucesso!');
                
            } else {
                // Fallback para download
                this.exportToExcel();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Erro ao salvar:', error);
                // Fallback para download
                this.exportToExcel();
            }
        }
    }

    // Gera buffer Excel para salvamento
    generateExcelBuffer() {
        const exportData = [
            ['Código', 'Descrição', 'UN'],
            ...this.products.map(p => [p.codigo, p.descricao, p.un])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
        
        // Gera buffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new Uint8Array(wbout);
    }

    // Exporta para Excel (método tradicional - download)
    exportToExcel() {
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
        
        XLSX.writeFile(wb, this.currentFileName || 'base_produtos_lanchonete.xlsx');
        this.hasUnsavedChanges = false;
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
        
        this.hasUnsavedChanges = true;
        this.findAllHoles();
        this.updateAfterSave();
        
        alert('Produto adicionado com sucesso!');
        
        // Auto-save se tiver file handle
        if (this.fileHandle && confirm('Deseja salvar a alteração no arquivo original?')) {
            this.saveToOriginalFile();
        }
    }

    // Atualiza interface após salvar
    updateAfterSave() {
        this.renderTable();
        this.totalProducts.textContent = this.products.length;
        
        if (this.holes.length === 0) {
            this.resultsContainer.style.display = 'none';
            this.noResults.style.display = 'block';
        } else {
            if (this.currentHoleIndex >= this.holes.length) {
                this.currentHoleIndex = this.holes.length - 1;
            }
            this.displayCurrentHole();
        }
        
        // Atualiza indicador de alterações
        this.updateSaveIndicator();
    }

    // Atualiza indicador visual de alterações não salvas
    updateSaveIndicator() {
        if (this.hasUnsavedChanges && this.fileHandle) {
            document.title = '⚠️ Gerenciador de Códigos - Alterações não salvas';
            
            // Adiciona indicador na interface
            let indicator = document.getElementById('unsavedIndicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'unsavedIndicator';
                indicator.className = 'unsaved-indicator';
                indicator.innerHTML = '⚠️ Alterações não salvas no arquivo original';
                indicator.style.cssText = `
                    background: #fff3cd;
                    color: #856404;
                    padding: 8px 15px;
                    border-radius: 5px;
                    margin: 10px 0;
                    text-align: center;
                    font-weight: bold;
                `;
                const mainContent = document.querySelector('.main-content');
                mainContent.insertBefore(indicator, mainContent.firstChild);
            }
            indicator.style.display = 'block';
        } else {
            document.title = '🍔 Gerenciador de Códigos';
            const indicator = document.getElementById('unsavedIndicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
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
                        this.hasUnsavedChanges = true;
                        this.updateSaveIndicator();
                        this.renderTable();
                        
                        // Auto-save
                        if (this.fileHandle && confirm('Deseja salvar a alteração no arquivo original?')) {
                            this.saveToOriginalFile();
                        }
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
            this.hasUnsavedChanges = true;
            this.findAllHoles();
            this.renderTable();
            this.totalProducts.textContent = this.products.length;
            this.updateSaveIndicator();
            
            // Auto-save
            if (this.fileHandle && confirm('Deseja salvar a exclusão no arquivo original?')) {
                this.saveToOriginalFile();
            }
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

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', () => {
    window.productManager = new ProductManager();
});