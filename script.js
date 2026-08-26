document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    // Elementos principais
    const tbody = document.getElementById('table-body');
    const recordsText = document.getElementById('records-text');
    const pageIndicator = document.getElementById('page-indicator');
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear-filters');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    const filterCnaeInput = document.getElementById('filter-cnae');
    const cnaeSuggestions = document.getElementById('cnae-suggestions');
    const filterUf = document.getElementById('filter-uf');
    const filterStatus = document.getElementById('filter-status');

    // Modais
    const detailsModal = document.getElementById('details-modal');
    const detailsClose = document.getElementById('close-details-modal');
    const genericModal = document.getElementById('generic-modal');
    const genericClose = document.getElementById('close-generic-modal');
    const segmentModal = document.getElementById('segment-modal');
    const segmentClose = document.getElementById('close-segment-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmClose = document.getElementById('close-confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const btnConfirmOk = document.getElementById('btn-confirm-ok');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    let confirmCallback = null;

    const genericModalBody = document.getElementById('generic-modal-body');
    const genericModalTitle = document.getElementById('generic-modal-title');
    const genericModalSubtitle = document.getElementById('generic-modal-subtitle');
    const genericSearch = document.getElementById('generic-search');

    const segmentSearch = document.getElementById('segment-search');
    const segmentNome = document.getElementById('segment-nome');
    const segmentDesc = document.getElementById('segment-desc');
    const btnSaveSegment = document.getElementById('btn-save-segment');
    const btnCancelSegment = document.getElementById('btn-cancel-segment');
    const segmentFormCard = document.getElementById('segment-form-card');
    const segmentFormTitle = document.getElementById('segment-form-title');
    const segmentListContainer = document.getElementById('segment-list-container');
    const filterSegmento = document.getElementById('filter-segmento');

    let editingSegmentId = null;
    let currentGenericContext = null;

    // Listas
    let cnaeData = []; // Cache de todos os CNAEs para preencher o modal lateral
    let situacoesData = [];
    let ufData = [];
    let selectedCnaeCode = null; // Guarda o código do CNAE selecionado no autocomplete

    // Mock inicial
    const mockData = [
        { cnpj: '06.771.019/0001-31', fantasia: 'MATADOURO FICAGNA', razao: 'ZELO FICAGNA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 3722-4664', ddd: '51', segmento: 'Frigorífico', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: '-' },
        { cnpj: '01.234.172/0001-82', fantasia: 'FRIGORIFICO BONNA', razao: 'FRIGORIFICO BONNA CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(54) 3231-0000', ddd: '54', segmento: 'Frigorífico', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 100.000,00', inicio: '15/08/1999', dataSit: '15/08/1999', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD BR 116', numero: 'KM 45', complemento: 'SALA 1', bairro: 'ZONA RURAL', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '-', email: 'contato@bonnacarne.com.br' },
        { cnpj: '01.246.405/0001-58', fantasia: 'IMAOS SCHMALITZ', razao: 'IRMAOS SCHMALITZ LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '', ddd: '', segmento: 'Atacado', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 50.000,00', inicio: '10/01/1995', dataSit: '10/01/1995', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'AV BRASIL', numero: '1000', complemento: '-', bairro: 'CENTRO', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '(54) 9999-0000', email: 'contato@schmalitz.com.br' },
        { cnpj: '01.323.689/0001-58', fantasia: 'MATADOURO PINHAL', razao: 'IRMAOS SALVATI LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '', ddd: '', segmento: 'Varejo', municipio: 'Pelotas', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '01/06/2001', dataSit: '01/06/2001', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'ESTRADA DO PINHAL', numero: '500', complemento: '-', bairro: 'INTERIOR', cep: '96000-000', municipio: 'PELOTAS - RS', tel2: '-', email: '-' },
        { cnpj: '01.332.595/0001-02', fantasia: 'FRIGORIFICO COOPES', razao: 'COOPERATIVA AGROPECUARIA SUL CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 37224664', ddd: '51', segmento: 'Cooperativa', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: 'financeiro@coopes.com.br' }
    ];

    let segmentData = [
        { id: 1, nome: 'Varejo', descricao: 'Comércio varejista' },
        { id: 2, nome: 'Atacado', descricao: 'Comércio atacadista' },
        { id: 3, nome: 'Serviços', descricao: 'Prestação de serviços gerais' },
        { id: 4, nome: 'Frigorífico', descricao: 'Abate e processamento de carnes' },
        { id: 5, nome: 'Cooperativa', descricao: 'Cooperativa agropecuária' }
    ];
    let nextSegmentId = 6;

    let currentPage = 1;
    const rowsPerPage = 5;
    let filteredData = [];
    let currentItems = [];

    // ==========================================
    // FUNÇÕES DE API (UFs, Situações, CNAEs)
    // ==========================================
    async function fetchFromAPI(urls) {
        for (const url of urls) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return Array.isArray(data) ? data : (data.data || data.results || []);
            } catch (e) {
                console.warn(`Falha ao tentar: ${url}`, e);
            }
        }
        return null;
    }

    async function carregarUFsDaAPI() {
        const data = await fetchFromAPI(['http://192.168.1.230:8080/api/ufs', 'http://localhost:8080/api/ufs']);
        if (data) {
            ufData = data.map(item => ({ sigla: item.uf || item.sigla, nome: item.nome || item.descricao, full: item.ufNome || `${item.uf} - ${item.nome}` })).filter(uf => uf.sigla);
            filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(uf => `<option value="${uf.sigla}">${uf.sigla}</option>`).join('');
            if (currentGenericContext === 'uf' && genericModal.style.display === 'flex') renderGenericList(ufData);
        } else {
            console.error("Erro ao carregar UFs: API não acessível.");
        }
    }

    async function carregarSituacoesDaAPI() {
        const data = await fetchFromAPI(['http://192.168.1.230:8080/api/situacoes-cadastrais', 'http://localhost:8080/api/situacoes-cadastrais']);
        if (data) {
            situacoesData = data.map(item => ({ nome: item.nome || item.descricao || item.situacao || item.label })).filter(s => s.nome);
            filterStatus.innerHTML = '<option value="">Todas</option>' + situacoesData.map(s => `<option value="${s.nome}">${s.nome}</option>`).join('');
        } else {
            console.error("Erro ao carregar Situações: API não acessível.");
        }
    }

    // Função para buscar CNAEs dinamicamente pelo parâmetro "filtro"
    async function buscarCnaes(filtro) {
        const urls = [
            `http://192.168.1.230:8080/api/cnaes?filtro=${encodeURIComponent(filtro)}`,
            `http://localhost:8080/api/cnaes?filtro=${encodeURIComponent(filtro)}`
        ];
        const data = await fetchFromAPI(urls);
        return data ? data.map(item => ({
            codigo: item.codigo || item.cnae || item.id,
            descricao: item.descricao || item.nome || '',
            full: item.codigoDescricao || `${item.codigo} - ${item.descricao}`
        })).filter(c => c.codigo) : [];
    }

    // Função inicial para carregar os primeiros 150 (sem filtro)
    async function carregarCnaesIniciais() {
        const data = await buscarCnaes(''); // Busca sem filtro, retorna 150
        if (data.length > 0) {
            cnaeData = data;
            // Preenche o dropdown do modal lateral com todos os 150
            // Não preenche mais o input, pois ele virou autocomplete
            console.log("CNAEs iniciais carregadas:", cnaeData.length);
        }
    }

    // ==========================================
    // LÓGICA DO AUTOCOMPLETE DE CNAE
    // ==========================================
    let debounceTimer;
    filterCnaeInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const termo = this.value.trim();

        if (termo.length === 0) {
            cnaeSuggestions.classList.remove('active');
            selectedCnaeCode = null;
            return;
        }

        // Aguarda 300ms após parar de digitar para chamar a API
        debounceTimer = setTimeout(async () => {
            const resultados = await buscarCnaes(termo);
            renderSuggestions(resultados);
        }, 300);
    });

    function renderSuggestions(resultados) {
        cnaeSuggestions.innerHTML = '';
        if (resultados.length === 0) {
            cnaeSuggestions.classList.remove('active');
            return;
        }

        resultados.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('autocomplete-item');
            div.innerHTML = `<span class="code">${item.codigo}</span> <span class="desc">- ${item.descricao}</span>`;
            div.addEventListener('click', function() {
                filterCnaeInput.value = `${item.codigo} - ${item.descricao}`;
                selectedCnaeCode = item.codigo;
                cnaeSuggestions.classList.remove('active');
                applyFilters(); // Aplica o filtro imediatamente
            });
            cnaeSuggestions.appendChild(div);
        });

        cnaeSuggestions.classList.add('active');
    }

    // Fecha o dropdown de sugestões se clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-container')) {
            cnaeSuggestions.classList.remove('active');
        }
    });

    // ==========================================
    // LÓGICA DOS MODAIS E FECHAMENTO (ESC)
    // ==========================================
    function closeAllModals() {
        if (detailsModal.style.display === 'flex') detailsModal.style.display = 'none';
        if (genericModal.style.display === 'flex') genericModal.style.display = 'none';
        if (segmentModal.style.display === 'flex') segmentModal.style.display = 'none';
        if (confirmModal.style.display === 'flex') confirmModal.style.display = 'none';
        confirmCallback = null;
    }

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllModals();
            cnaeSuggestions.classList.remove('active');
        }
    });

    detailsClose.addEventListener('click', function() { detailsModal.style.display = 'none'; });
    genericClose.addEventListener('click', function() { genericModal.style.display = 'none'; });
    segmentClose.addEventListener('click', function() { segmentModal.style.display = 'none'; });
    confirmClose.addEventListener('click', function() { confirmModal.style.display = 'none'; });

    detailsModal.addEventListener('click', function(e) { if(e.target === this) detailsModal.style.display = 'none'; });
    genericModal.addEventListener('click', function(e) { if(e.target === this) genericModal.style.display = 'none'; });
    segmentModal.addEventListener('click', function(e) { if(e.target === this) segmentModal.style.display = 'none'; });
    confirmModal.addEventListener('click', function(e) { if(e.target === this) confirmModal.style.display = 'none'; });

    function showConfirm(title, message, callback) {
        confirmTitle.innerText = title;
        confirmMessage.innerText = message;
        confirmCallback = callback;
        confirmModal.style.display = 'flex';
    }

    btnConfirmOk.addEventListener('click', function() {
        if (confirmCallback) confirmCallback();
        confirmModal.style.display = 'none';
        confirmCallback = null;
    });

    btnConfirmCancel.addEventListener('click', function() {
        confirmModal.style.display = 'none';
        confirmCallback = null;
    });

    // ==========================================
    // LÓGICA DA TABELA E DETALHES
    // ==========================================
    function renderTable(data) {
        tbody.innerHTML = '';
        if(data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum resultado encontrado.</td></tr>`;
            recordsText.innerText = `Exibindo 0 registros`;
            btnPrev.disabled = true; btnNext.disabled = true;
            pageIndicator.innerText = `Página 0`;
            return;
        }
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = data.slice(startIndex, endIndex);
        const totalRecords = data.length;
        const totalPages = Math.ceil(totalRecords / rowsPerPage);
        
        paginatedData.forEach(item => {
            const row = `<tr>
                <td>${item.cnpj}</td>
                <td>${item.fantasia}</td>
                <td>${item.razao}</td>
                <td>${item.situacao}</td>
                <td>${item.uf}</td>
                <td>${item.telefone}</td>
                <td><button class="btn-detail">Detalhes</button></td>
            </tr>`;
            tbody.innerHTML += row;
        });
        
        recordsText.innerText = `Exibindo ${startIndex + 1} - ${Math.min(endIndex, totalRecords)} de ${totalRecords} registros`;
        pageIndicator.innerText = `Página ${currentPage}`;
        btnPrev.disabled = currentPage === 1;
        btnNext.disabled = currentPage === totalPages;
    }

    function openDetailsModal(cnpj) {
        const company = filteredData.find(item => item.cnpj === cnpj);
        if(!company) return;
        document.getElementById('det-cnpj').innerText = company.cnpj;
        document.getElementById('det-razao').innerText = company.razao;
        document.getElementById('det-fantasia').innerText = company.fantasia;
        const situacaoElement = document.getElementById('det-situacao');
        situacaoElement.innerText = company.situacao;
        situacaoElement.className = company.situacao === 'ATIVA' ? 'badge badge-green' : 'badge badge-blue';
        document.getElementById('det-tipo').innerText = company.tipo;
        document.getElementById('det-natureza').innerText = company.natureza;
        document.getElementById('det-porte').innerText = company.porte;
        document.getElementById('det-capital').innerText = company.capital;
        document.getElementById('det-inicio').innerText = company.inicio;
        document.getElementById('det-data-sit').innerText = company.dataSit;
        
        // Tenta encontrar a descrição do CNAE no cache
        const cnaeEncontrado = cnaeData.find(c => c.codigo === company.cnae_principal);
        const cnaeDisplay = cnaeEncontrado ? cnaeEncontrado.full : company.cnae_principal;
        document.getElementById('det-cnae').innerText = cnaeDisplay;

        document.getElementById('det-logradouro').innerText = company.logradouro;
        document.getElementById('det-numero').innerText = company.numero;
        document.getElementById('det-complemento').innerText = company.complemento;
        document.getElementById('det-bairro').innerText = company.bairro;
        document.getElementById('det-cep').innerText = company.cep;
        document.getElementById('det-municipio').innerText = company.municipio;
        document.getElementById('det-tel1').innerText = company.telefone || '-';
        document.getElementById('det-tel2').innerText = company.tel2 || '-';
        document.getElementById('det-email').innerText = company.email || '-';
        detailsModal.style.display = 'flex'; 
    }

    tbody.addEventListener('click', function(e) {
        if(e.target.classList.contains('btn-detail')) {
            const row = e.target.closest('tr');
            const cnpj = row.cells[0].innerText;
            openDetailsModal(cnpj);
        }
    });

    // ==========================================
    // LÓGICA CRUD SEGMENTOS
    // ==========================================
    function resetSegmentForm() {
        segmentNome.value = '';
        segmentDesc.value = '';
        editingSegmentId = null;
        segmentFormTitle.innerText = 'Novo Segmento';
        btnSaveSegment.innerText = 'Salvar';
        segmentFormCard.classList.remove('edit-mode');
        btnCancelSegment.style.display = 'none';
    }

    function renderSegments(filterText = '') {
        const term = filterText.toLowerCase();
        let html = `<table class="segment-table"><thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>`;
        segmentData.filter(seg => seg.nome.toLowerCase().includes(term)).forEach(seg => {
            html += `<tr><td>${seg.nome}</td><td>${seg.descricao || '-'}</td><td>
                <button class="action-btn edit" onclick="editSegment(${seg.id})"><i class="fas fa-pen"></i></button>
                <button class="action-btn delete" onclick="deleteSegment(${seg.id})"><i class="fas fa-trash"></i></button>
            </td></tr>`;
        });
        html += '</tbody></table>';
        segmentListContainer.innerHTML = html;
    }

    function updateSegmentFilter() {
        let options = '<option value="">Todos</option>';
        segmentData.forEach(seg => {
            options += `<option value="${seg.nome}">${seg.nome}</option>`;
        });
        filterSegmento.innerHTML = options;
    }

    window.editSegment = function(id) {
        const segment = segmentData.find(seg => seg.id === id);
        if(!segment) return;
        editingSegmentId = id;
        segmentNome.value = segment.nome;
        segmentDesc.value = segment.descricao;
        segmentFormTitle.innerText = 'Editar Segmento';
        btnSaveSegment.innerText = 'Atualizar';
        segmentFormCard.classList.add('edit-mode');
        btnCancelSegment.style.display = 'inline-block';
        segmentNome.focus();
    };

    window.deleteSegment = function(id) {
        const segment = segmentData.find(seg => seg.id === id);
        showConfirm('Excluir Segmento', `Tem certeza que deseja excluir o segmento "${segment.nome}"?`, function() {
            segmentData = segmentData.filter(seg => seg.id !== id);
            renderSegments(segmentSearch.value);
            updateSegmentFilter();
            if(editingSegmentId === id) resetSegmentForm();
        });
    };

    segmentSearch.addEventListener('input', function() { renderSegments(this.value); });

    btnSaveSegment.addEventListener('click', function() {
        const nome = segmentNome.value.trim();
        const descricao = segmentDesc.value.trim();
        if(!nome) { alert('Por favor, informe o nome do segmento.'); return; }
        
        const duplicado = segmentData.find(seg => seg.nome.toLowerCase() === nome.toLowerCase());
        if(duplicado && editingSegmentId === null) {
            alert(`Já existe um segmento com o nome "${nome}". Não é possível cadastrar duplicados.`);
            segmentSearch.value = nome;
            renderSegments(nome);
            return;
        }

        if(editingSegmentId !== null) {
            showConfirm('Salvar Alteração', 'Você deseja salvar a alteração no cadastro?', function() {
                const index = segmentData.findIndex(seg => seg.id === editingSegmentId);
                if(index !== -1) segmentData[index] = { id: editingSegmentId, nome, descricao };
                resetSegmentForm(); segmentSearch.value = ''; renderSegments(); updateSegmentFilter();
            });
        } else {
            showConfirm('Salvar Cadastro', 'Você deseja salvar o cadastro?', function() {
                segmentData.push({ id: nextSegmentId, nome, descricao });
                nextSegmentId++;
                resetSegmentForm(); segmentSearch.value = ''; renderSegments(); updateSegmentFilter();
            });
        }
    });

    btnCancelSegment.addEventListener('click', function() { resetSegmentForm(); });

    document.getElementById('menu-segmentos').addEventListener('click', function() {
        segmentSearch.value = ''; renderSegments(); resetSegmentForm(); segmentModal.style.display = 'flex';
    });

    // ==========================================
    // PESQUISAS E MODAIS GENÉRICOS
    // ==========================================
    const auxData = {
        'natureza': ['Sociedade Empresária Limitada', 'Empresa Individual de Responsabilidade Limitada', 'Sociedade Anônima']
    };

    function formatAsCard(item) {
        if (item && typeof item === 'object' && item.codigo) return { sigla: item.codigo, nome: item.descricao, full: item.full || `${item.codigo} - ${item.descricao}` };
        if (typeof item === 'string') return { sigla: '', nome: item, full: item };
        return { sigla: item.sigla || '', nome: item.nome || '', full: item.full || `${item.sigla} - ${item.nome}` };
    }

    function openGenericModal(title, subtitle, items, context) {
        genericModalTitle.innerText = title;
        genericModalSubtitle.innerText = subtitle;
        currentGenericContext = context || null; 
        currentItems = items; 
        genericSearch.value = ''; 
        renderGenericList(items); 
        genericModal.style.display = 'flex';
    }

    function renderGenericList(items) {
        if (!items || items.length === 0) {
            genericModalBody.innerHTML = '<p style="padding: 15px; text-align: center; color: #666;">Nenhum item encontrado.</p>';
            return;
        }
        let html = '<ul class="generic-list">';
        items.forEach((item, index) => {
            const card = formatAsCard(item);
            const cardHtml = card.sigla ? `<div class="card-info"><span class="card-sigla">${card.sigla}</span><span class="card-nome" style="color: #9ca3af; font-size: 12px;">${card.nome}</span></div>` : `<div class="card-info"><span class="card-nome" style="font-weight:bold;">${card.nome}</span></div>`;
            html += `<li class="generic-card" data-index="${index}">${cardHtml}<button class="card-btn">OK</button></li>`;
        });
        html += '</ul>';
        genericModalBody.innerHTML = html;
    }

    genericSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredItems = currentItems.filter(item => {
            const card = formatAsCard(item);
            return card.full.toLowerCase().includes(searchTerm) || card.nome.toLowerCase().includes(searchTerm);
        });
        renderGenericList(filteredItems);
    });

    genericModalBody.addEventListener('click', function(e) {
        const li = e.target.closest('.generic-card');
        if (li) {
            genericModalBody.querySelectorAll('.generic-card').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');
            if (e.target.classList.contains('card-btn')) {
                const index = li.getAttribute('data-index');
                const originalItem = currentItems[index];

                if (currentGenericContext === 'cnae') {
                    if (originalItem && originalItem.codigo) {
                        filterCnaeInput.value = originalItem.full;
                        selectedCnaeCode = originalItem.codigo;
                    }
                    genericModal.style.display = 'none';
                } else if (currentGenericContext === 'uf') {
                    if (originalItem && originalItem.sigla) {
                        filterUf.value = originalItem.sigla;
                    }
                    applyFilters();
                    genericModal.style.display = 'none';
                } else {
                    genericModal.style.display = 'none';
                }
            }
        }
    });

    document.getElementById('menu-cnaes').addEventListener('click', () => openGenericModal('Pesquisa CNAE', 'Informe o CNAE:', cnaeData, 'cnae'));
    document.getElementById('menu-municipios').addEventListener('click', () => openGenericModal('Pesquisa Município', 'Informe o município:', ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Porto Alegre - RS', 'Cachoeira do Sul - RS'], 'municipio'));
    document.getElementById('menu-natureza').addEventListener('click', () => openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', auxData.natureza, 'natureza'));

    // ==========================================
    // FILTROS E PAGINAÇÃO
    // ==========================================
    function applyFilters() {
        const uf = filterUf.value;
        const status = filterStatus.value;
        const ddd = document.getElementById('filter-ddd').value.trim();
        const segmento = filterSegmento.value;
        const cnae = selectedCnaeCode ? selectedCnaeCode : filterCnaeInput.value.trim();
        const tipoCnae = document.getElementById('filter-tipo-cnae').value;

        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Carregando dados...</td></tr>`;

        setTimeout(() => {
            filteredData = mockData.filter(item => {
                const matchUF = uf ? item.uf === uf : true;
                const matchStatus = status ? item.situacao === status : true;
                const matchDDD = ddd ? item.ddd === ddd : true;
                const matchSegmento = segmento ? item.segmento === segmento : true;
                
                let matchCnae = true;
                if (cnae) {
                    const codigoCnae = cnae.split(' - ')[0].trim();
                    if (tipoCnae === 'principal') matchCnae = item.cnae_principal.includes(codigoCnae);
                    else matchCnae = item.cnae_principal.includes(codigoCnae) || item.cnae_secundario.includes(codigoCnae);
                }

                return matchUF && matchStatus && matchDDD && matchSegmento && matchCnae; 
            });
            currentPage = 1;
            renderTable(filteredData);
        }, 400);
    }

    function clearFilters() {
        filterUf.value = '';
        filterStatus.value = '';
        document.getElementById('filter-ddd').value = '';
        filterSegmento.value = '';
        filterCnaeInput.value = '';
        selectedCnaeCode = null;
        document.getElementById('filter-tipo-cnae').value = '';
        cnaeSuggestions.classList.remove('active');
        applyFilters();
    }

    function changePage(direction) {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if(direction === 'next' && currentPage < totalPages) currentPage++;
        if(direction === 'prev' && currentPage > 1) currentPage--;
        renderTable(filteredData);
    }

    // Inicializações
    updateSegmentFilter();
    
    carregarUFsDaAPI();
    carregarSituacoesDaAPI();
    carregarCnaesIniciais(); // Carrega os 150 primeiros para o modal lateral
    
    btnSearch.addEventListener('click', applyFilters);
    btnClear.addEventListener('click', clearFilters);
    btnPrev.addEventListener('click', function() { changePage('prev'); });
    btnNext.addEventListener('click', function() { changePage('next'); });
    applyFilters();
});