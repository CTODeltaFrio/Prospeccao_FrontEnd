document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    // Elementos da tela principal
    const mainScreen = document.getElementById('main-screen');
    const segmentScreen = document.getElementById('segment-screen');
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
    const filterRegiao = document.getElementById('filter-regiao');
    const filterTypeToggle = document.getElementById('filter-type-toggle');
    const groupSegmento = document.getElementById('group-segmento');
    const groupEscopoSegmento = document.getElementById('group-escopo-segmento');
    const groupCnae = document.getElementById('group-cnae');
    const groupEscopoCnae = document.getElementById('group-escopo-cnae');

    // Elementos da tela de segmentos
    const btnHome = document.getElementById('btn-home');
    const btnBackMain = document.getElementById('btn-back-main');
    const btnSaveSegment = document.getElementById('btn-save-segment');
    const btnCancelSegment = document.getElementById('btn-cancel-segment');
    const segmentNome = document.getElementById('segment-nome');
    const segmentSearch = document.getElementById('segment-search');
    const segmentTableBody = document.getElementById('segment-table-body');
    const linkCnaeSelect = document.getElementById('link-cnae-select');
    const linkedCnaeList = document.getElementById('linked-cnae-list');
    const formTitle = document.getElementById('form-title');
    const segmentFormCard = document.getElementById('segment-form-card');

    // Modais
    const detailsModal = document.getElementById('details-modal');
    const detailsClose = document.getElementById('close-details-modal');
    const genericModal = document.getElementById('generic-modal');
    const genericClose = document.getElementById('close-generic-modal');
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

    // Dados
    let editingSegmentId = null;
    let currentLinkedCnaes = [];
    let allCnaesCache = [];
    let segmentoCnaeLinks = [];
    let segmentData = [ { id: 1, nome: 'Varejo' }, { id: 2, nome: 'Atacado' }, { id: 3, nome: 'Serviços' }, { id: 4, nome: 'Frigorífico' }, { id: 5, nome: 'Cooperativa' } ];
    let nextSegmentId = 6;
    let ufData = [];
    let selectedCnaeCode = null;
    let cnaeData = []; // será preenchido pela API, se falhar fica vazio
    let currentGenericContext = null;

    const mockData = [
        { cnpj: '06.771.019/0001-31', fantasia: 'MATADOURO FICAGNA', razao: 'ZELO FICAGNA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 3722-4664', ddd: '51', segmento: 'Frigorífico', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: '-' },
        { cnpj: '01.234.172/0001-82', fantasia: 'FRIGORIFICO BONNA', razao: 'FRIGORIFICO BONNA CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(54) 3231-0000', ddd: '54', segmento: 'Frigorífico', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 100.000,00', inicio: '15/08/1999', dataSit: '15/08/1999', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD BR 116', numero: 'KM 45', complemento: 'SALA 1', bairro: 'ZONA RURAL', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '-', email: 'contato@bonnacarne.com.br' },
        { cnpj: '01.246.405/0001-58', fantasia: 'IMAOS SCHMALITZ', razao: 'IRMAOS SCHMALITZ LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '', ddd: '', segmento: 'Atacado', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 50.000,00', inicio: '10/01/1995', dataSit: '10/01/1995', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'AV BRASIL', numero: '1000', complemento: '-', bairro: 'CENTRO', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '(54) 9999-0000', email: 'contato@schmalitz.com.br' },
        { cnpj: '01.323.689/0001-58', fantasia: 'MATADOURO PINHAL', razao: 'IRMAOS SALVATI LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '', ddd: '', segmento: 'Varejo', municipio: 'Pelotas', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '01/06/2001', dataSit: '01/06/2001', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'ESTRADA DO PINHAL', numero: '500', complemento: '-', bairro: 'INTERIOR', cep: '96000-000', municipio: 'PELOTAS - RS', tel2: '-', email: '-' },
        { cnpj: '01.332.595/0001-02', fantasia: 'FRIGORIFICO COOPES', razao: 'COOPERATIVA AGROPECUARIA SUL CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 37224664', ddd: '51', segmento: 'Cooperativa', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: 'financeiro@coopes.com.br' }
    ];

    const ufRegiaoMap = {
        'AC': 'Norte', 'AM': 'Norte', 'AP': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
        'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste', 'PE': 'Nordeste', 'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
        'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste',
        'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
        'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul'
    };

    let currentPage = 1;
    const rowsPerPage = 5;
    let filteredData = [];
    let currentItems = [];

    // ========== FUNÇÕES DA API ==========
    async function fetchFromAPI(urls) {
        for (const url of urls) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return Array.isArray(data) ? data : (data.data || data.results || []);
            } catch (e) { console.warn(`Falha em ${url}:`, e); }
        }
        return null;
    }

    async function carregarUFsDaAPI() {
        const data = await fetchFromAPI(['http://192.168.1.230:8080/api/ufs', 'http://localhost:8080/api/ufs']);
        if (data) {
            ufData = data.map(item => ({ sigla: item.uf || item.sigla, nome: item.nome || item.descricao, full: item.ufNome || `${item.uf} - ${item.nome}` })).filter(uf => uf.sigla);
            filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(uf => `<option value="${uf.sigla}">${uf.sigla}</option>`).join('');
        } else {
            console.error("Erro ao carregar UFs. API indisponível.");
        }
    }

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

    async function carregarCnaesIniciais() {
        const data = await buscarCnaes('');
        cnaeData = data;
        allCnaesCache = data;
        populateLinkSelect();
        console.log("CNAEs carregados:", cnaeData.length);
    }

    // ========== TELA DE SEGMENTOS ==========
    function openSegmentScreen() {
        mainScreen.style.display = 'none';
        segmentScreen.style.display = 'block';
        resetSegmentForm();
        renderSegmentTable();
        populateLinkSelect();
    }

    function closeSegmentScreen() {
        segmentScreen.style.display = 'none';
        mainScreen.style.display = 'block';
        updateSegmentFilter();
    }

    btnBackMain.addEventListener('click', closeSegmentScreen);
    btnHome.addEventListener('click', function() { closeSegmentScreen(); closeAllModals(); });

    function novoSegmento() { resetSegmentForm(); }

    // Expõe a função globalmente para o onclick do HTML
    window.novoSegmento = novoSegmento;

    function resetSegmentForm() {
        segmentNome.value = '';
        editingSegmentId = null;
        btnCancelSegment.style.display = 'none';
        btnSaveSegment.innerText = 'Salvar segmento';
        btnSaveSegment.classList.remove('editing-btn');
        formTitle.innerText = 'Cadastro de segmento';
        segmentFormCard.classList.remove('editing-mode');
        linkedCnaeList.innerHTML = 'Nenhum CNAE vinculado.';
        currentLinkedCnaes = [];
        linkCnaeSelect.value = '';
    }

    // ===== FUNÇÃO CORRIGIDA: renderSegmentTable com event listeners =====
    function renderSegmentTable(searchTerm = '') {
        segmentTableBody.innerHTML = '';
        const term = searchTerm.toLowerCase();

        segmentData.filter(seg => seg.nome.toLowerCase().includes(term)).forEach(seg => {
            const qtdLinks = segmentoCnaeLinks.filter(link => link.segmentoId === seg.id).length;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="cell-id">#${seg.id.toString().padStart(4, '0')}</td>
                <td>${seg.nome}</td>
                <td>${qtdLinks}</td>
                <td>
                    <div class="cell-actions">
                        <button class="btn-table" data-action="edit" data-id="${seg.id}">Editar</button>
                        <button class="btn-table btn-delete" data-action="delete" data-id="${seg.id}">Excluir</button>
                    </div>
                </td>
            `;
            segmentTableBody.appendChild(tr);
        });

        // Adiciona listeners aos botões dinâmicos
        segmentTableBody.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                if (this.dataset.action === 'edit') {
                    editarSegmento(id);
                } else if (this.dataset.action === 'delete') {
                    excluirSegmento(id);
                }
            });
        });
    }

    function populateLinkSelect() {
        linkCnaeSelect.innerHTML = '<option value="">Selecione um CNAE para vincular...</option>';
        allCnaesCache.forEach(cnae => {
            const alreadyLinked = currentLinkedCnaes.some(c => c.codigo === cnae.codigo);
            if (!alreadyLinked) {
                const option = document.createElement('option');
                option.value = cnae.codigo;
                option.innerText = cnae.full;
                linkCnaeSelect.appendChild(option);
            }
        });
    }

    window.vincularCNAE = function() {
        const cnaeCodigo = linkCnaeSelect.value;
        if (!cnaeCodigo) { alert('Selecione um CNAE para vincular.'); return; }
        const cnae = allCnaesCache.find(c => c.codigo === cnaeCodigo);
        if (cnae) {
            currentLinkedCnaes.push(cnae);
            renderLinkedCnaes();
            populateLinkSelect();
            linkCnaeSelect.value = '';
        }
    };

    function renderLinkedCnaes() {
        linkedCnaeList.innerHTML = '';
        if (currentLinkedCnaes.length === 0) {
            linkedCnaeList.innerHTML = 'Nenhum CNAE vinculado.';
            return;
        }
        currentLinkedCnaes.forEach((cnae, index) => {
            const div = document.createElement('div');
            div.classList.add('linked-item');
            div.innerHTML = `<span>${cnae.codigo} - ${cnae.descricao}</span><button onclick="removerCNAE(${index})"><i class="fas fa-times"></i></button>`;
            linkedCnaeList.appendChild(div);
        });
    }

    window.removerCNAE = function(index) {
        currentLinkedCnaes.splice(index, 1);
        renderLinkedCnaes();
        populateLinkSelect();
    };

    document.getElementById('segmentoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const nome = segmentNome.value.trim();
        if (!nome) { alert('Informe o nome do segmento.'); return; }
        if (editingSegmentId !== null) {
            const seg = segmentData.find(s => s.id === editingSegmentId);
            if (seg) seg.nome = nome;
            segmentoCnaeLinks = segmentoCnaeLinks.filter(link => link.segmentoId !== editingSegmentId);
            currentLinkedCnaes.forEach(cnae => segmentoCnaeLinks.push({ segmentoId: editingSegmentId, cnaeCodigo: cnae.codigo }));
        } else {
            const newId = nextSegmentId++;
            segmentData.push({ id: newId, nome });
            currentLinkedCnaes.forEach(cnae => segmentoCnaeLinks.push({ segmentoId: newId, cnaeCodigo: cnae.codigo }));
        }
        resetSegmentForm();
        renderSegmentTable(segmentSearch.value);
        updateSegmentFilter();
    });

    btnCancelSegment.addEventListener('click', function() { resetSegmentForm(); });

    segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });

    function editarSegmento(id) {
        const seg = segmentData.find(s => s.id === id);
        if (!seg) return;
        editingSegmentId = id;
        segmentNome.value = seg.nome;
        btnSaveSegment.innerText = 'Atualizar segmento';
        btnSaveSegment.classList.add('editing-btn');
        btnCancelSegment.style.display = 'inline-block';
        formTitle.innerText = 'Editar segmento';
        segmentFormCard.classList.add('editing-mode');
        
        currentLinkedCnaes = allCnaesCache.filter(cnae => segmentoCnaeLinks.some(link => link.segmentoId === id && link.cnaeCodigo === cnae.codigo));
        renderLinkedCnaes();
        populateLinkSelect();
    }

    window.editarSegmento = editarSegmento;

    function excluirSegmento(id) {
        const seg = segmentData.find(s => s.id === id);
        showConfirm('Excluir Segmento', `Tem certeza que deseja excluir o segmento "${seg.nome}"?`, function() {
            segmentData = segmentData.filter(s => s.id !== id);
            segmentoCnaeLinks = segmentoCnaeLinks.filter(link => link.segmentoId !== id);
            renderSegmentTable(segmentSearch.value);
            updateSegmentFilter();
            if (editingSegmentId === id) resetSegmentForm();
        });
    }

    window.excluirSegmento = excluirSegmento;

    // ========== MODAIS ==========
    function closeAllModals() {
        if (detailsModal.style.display === 'flex') detailsModal.style.display = 'none';
        if (genericModal.style.display === 'flex') genericModal.style.display = 'none';
        if (confirmModal.style.display === 'flex') confirmModal.style.display = 'none';
        confirmCallback = null;
    }

    document.addEventListener('keydown', function(event) { if (event.key === 'Escape') closeAllModals(); });

    detailsClose.addEventListener('click', function() { detailsModal.style.display = 'none'; });
    genericClose.addEventListener('click', function() { genericModal.style.display = 'none'; });
    confirmClose.addEventListener('click', function() { confirmModal.style.display = 'none'; });

    detailsModal.addEventListener('click', function(e) { if(e.target === this) detailsModal.style.display = 'none'; });
    genericModal.addEventListener('click', function(e) { if(e.target === this) genericModal.style.display = 'none'; });
    confirmModal.addEventListener('click', function(e) { if(e.target === this) confirmModal.style.display = 'none'; });

    function showConfirm(title, message, callback) {
        confirmTitle.innerText = title;
        confirmMessage.innerText = message;
        confirmCallback = callback;
        confirmModal.style.display = 'flex';
    }

    btnConfirmOk.addEventListener('click', function() { if (confirmCallback) confirmCallback(); confirmModal.style.display = 'none'; confirmCallback = null; });
    btnConfirmCancel.addEventListener('click', function() { confirmModal.style.display = 'none'; confirmCallback = null; });

    // ========== TABELA PRINCIPAL ==========
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
            openDetailsModal(row.cells[0].innerText);
        }
    });

    // ========== AUTOCOMPLETE ==========
    let debounceTimer;
    filterCnaeInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const termo = this.value.trim();
        if (termo.length === 0) { cnaeSuggestions.classList.remove('active'); selectedCnaeCode = null; return; }
        debounceTimer = setTimeout(async () => {
            const resultados = await buscarCnaes(termo);
            renderSuggestions(resultados);
        }, 300);
    });

    function renderSuggestions(resultados) {
        cnaeSuggestions.innerHTML = '';
        if (resultados.length === 0) { cnaeSuggestions.classList.remove('active'); return; }
        resultados.forEach(item => {
            const div = document.createElement('div');
            div.classList.add('autocomplete-item');
            div.innerHTML = `<span class="code">${item.codigo}</span> <span class="desc">- ${item.descricao}</span>`;
            div.addEventListener('click', function() {
                filterCnaeInput.value = `${item.codigo} - ${item.descricao}`;
                selectedCnaeCode = item.codigo;
                cnaeSuggestions.classList.remove('active');
                applyFilters();
            });
            cnaeSuggestions.appendChild(div);
        });
        cnaeSuggestions.classList.add('active');
    }

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-container')) cnaeSuggestions.classList.remove('active');
    });

    // ========== FUNÇÕES GENÉRICAS (MODAIS) ==========
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
            genericModalBody.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Nenhum item encontrado.</p>';
            return;
        }
        let html = '<ul class="generic-list">';
        items.forEach((item, index) => {
            const card = formatAsCard(item);
            const cardHtml = card.sigla ? `<div class="card-info"><span class="card-sigla">${card.sigla}</span><span class="card-nome" style="color:#9ca3af; font-size:12px;">${card.nome}</span></div>` : `<div class="card-info"><span class="card-nome" style="font-weight:bold;">${card.nome}</span></div>`;
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
                } else { genericModal.style.display = 'none'; }
            }
        }
    });

    // ========== EVENTOS DA SIDEBAR ==========
    document.getElementById('menu-cnaes').addEventListener('click', () => {
        console.log("Clicou em CNAEs");
        openGenericModal('Pesquisa CNAE', 'Informe o CNAE:', cnaeData, 'cnae');
    });

    document.getElementById('menu-municipios').addEventListener('click', () => {
        console.log("Clicou em Municípios");
        openGenericModal('Pesquisa Município', 'Informe o município:', ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Porto Alegre - RS', 'Cachoeira do Sul - RS'], 'municipio');
    });

    document.getElementById('menu-natureza').addEventListener('click', () => {
        console.log("Clicou em Natureza Jurídica");
        openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', ['Sociedade Empresária Limitada', 'Empresa Individual de Responsabilidade Limitada', 'Sociedade Anônima'], 'natureza');
    });

    document.getElementById('menu-segmentos').addEventListener('click', () => {
        console.log("Clicou em Segmentos");
        openSegmentScreen();
    });

    // ========== FILTROS ==========
    function handleFilterTypeChange() {
        const type = filterTypeToggle.value;
        if (type === 'segmento') {
            groupSegmento.style.display = 'flex'; groupEscopoSegmento.style.display = 'flex';
            groupCnae.style.display = 'none'; groupEscopoCnae.style.display = 'none';
        } else {
            groupSegmento.style.display = 'none'; groupEscopoSegmento.style.display = 'none';
            groupCnae.style.display = 'flex'; groupEscopoCnae.style.display = 'flex';
        }
    }
    filterTypeToggle.addEventListener('change', handleFilterTypeChange);
    handleFilterTypeChange();

    function updateSegmentFilter() {
        let options = '<option value="">Todos</option>';
        segmentData.forEach(seg => options += `<option value="${seg.nome}">${seg.nome}</option>`);
        document.getElementById('filter-segmento').innerHTML = options;
    }

    function applyFilters() {
        const uf = filterUf.value;
        const regiao = filterRegiao.value;
        const ddd = document.getElementById('filter-ddd').value.trim();
        const segmento = document.getElementById('filter-segmento').value;
        const escopoSegmento = document.getElementById('filter-escopo-segmento').value;
        const cnae = selectedCnaeCode ? selectedCnaeCode : filterCnaeInput.value.trim();
        const tipoCnae = document.getElementById('filter-tipo-cnae').value;
        const filterType = filterTypeToggle.value;
        
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Carregando dados...</td></tr>`;
        
        setTimeout(() => {
            filteredData = mockData.filter(item => {
                const matchUF = uf ? item.uf === uf : true;
                const matchRegiao = regiao ? (ufRegiaoMap[item.uf] === regiao) : true;
                const matchDDD = ddd ? item.ddd === ddd : true;
                const matchStatus = item.situacao === 'ATIVA';
                
                let matchCategoria = true;
                if (filterType === 'segmento') {
                    if (segmento) matchCategoria = item.segmento === segmento;
                } else if (filterType === 'cnae') {
                    if (cnae) {
                        const codigoCnae = cnae.split(' - ')[0].trim();
                        if (tipoCnae === 'principal') matchCategoria = item.cnae_principal.includes(codigoCnae);
                        else if (tipoCnae === 'secundario') matchCategoria = item.cnae_principal.includes(codigoCnae) || item.cnae_secundario.includes(codigoCnae);
                    }
                }

                return matchUF && matchRegiao && matchDDD && matchStatus && matchCategoria;
            });
            currentPage = 1;
            renderTable(filteredData);
        }, 400);
    }

    function clearFilters() {
        filterUf.value = '';
        filterRegiao.value = '';
        document.getElementById('filter-ddd').value = '';
        document.getElementById('filter-segmento').value = '';
        document.getElementById('filter-escopo-segmento').value = 'secundario';
        filterCnaeInput.value = '';
        selectedCnaeCode = null;
        document.getElementById('filter-tipo-cnae').value = 'secundario';
        filterTypeToggle.value = 'segmento';
        handleFilterTypeChange();
        cnaeSuggestions.classList.remove('active');
        applyFilters();
    }

    function changePage(direction) {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if(direction === 'next' && currentPage < totalPages) currentPage++;
        if(direction === 'prev' && currentPage > 1) currentPage--;
        renderTable(filteredData);
    }

    // ========== INICIALIZAÇÃO ==========
    updateSegmentFilter();
    carregarUFsDaAPI();
    carregarCnaesIniciais();
    btnSearch.addEventListener('click', applyFilters);
    btnClear.addEventListener('click', clearFilters);
    btnPrev.addEventListener('click', function() { changePage('prev'); });
    btnNext.addEventListener('click', function() { changePage('next'); });
    applyFilters();
});