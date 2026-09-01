document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    // ===== CONFIGURAÇÃO DA API =====
    const API_URL = 'http://api.deltafrio.com.br:8080';

    try {
        // ===== MODO ESCURO =====
        const btnDarkMode = document.getElementById('btn-dark-mode');
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            if (btnDarkMode) btnDarkMode.innerHTML = '<i class="fas fa-sun"></i>';
        }
        if (btnDarkMode) {
            btnDarkMode.addEventListener('click', function() {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', isDark);
                btnDarkMode.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            });
        }

        // ===== SIDEBAR =====
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function() {
                sidebar.classList.toggle('collapsed');
            });
        }

        // ===== ELEMENTOS DA TELA PRINCIPAL =====
        const mainScreen = document.getElementById('main-screen');
        const segmentScreen = document.getElementById('segment-screen');
        const tbody = document.getElementById('table-body');
        const pageIndicator = document.getElementById('page-indicator');
        const btnSearch = document.getElementById('btn-search');
        const btnClear = document.getElementById('btn-clear-filters');
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const recordsFooter = document.getElementById('records-footer');

        const filterCnaeInput = document.getElementById('filter-cnae');
        const cnaeSuggestions = document.getElementById('cnae-suggestions');
        const filterUf = document.getElementById('filter-uf');
        const filterDdd = document.getElementById('filter-ddd');
        const filterSegmento = document.getElementById('filter-segmento');
        const filterTipoCnae = document.getElementById('filter-tipo-cnae');
        const filterMunicipio = document.getElementById('filter-municipio');
        const campoMunicipio = document.getElementById('campo-municipio');

        // ===== ELEMENTOS DA TELA DE SEGMENTOS =====
        const btnSaveSegment = document.getElementById('btn-save-segment');
        const btnCancelSegment = document.getElementById('btn-cancel-segment');
        const segmentNome = document.getElementById('segment-nome');
        const segmentSearch = document.getElementById('segment-search');
        const segmentTableBody = document.getElementById('segment-table-body');
        const linkCnaeSelect = document.getElementById('link-cnae-select');
        const linkedCnaeList = document.getElementById('linked-cnae-list');
        const formTitle = document.getElementById('form-title');
        const segmentFormCard = document.getElementById('segment-form-card');

        // ===== MODAIS =====
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
        const btnConfirmDiscard = document.getElementById('btn-confirm-discard');
        const btnIgnoreCadastro = document.getElementById('btn-ignore-cadastro');
        let confirmCallback = null;

        const genericModalBody = document.getElementById('generic-modal-body');
        const genericModalTitle = document.getElementById('generic-modal-title');
        const genericModalSubtitle = document.getElementById('generic-modal-subtitle');
        const genericSearch = document.getElementById('generic-search');

        // ===== DADOS =====
        let editingSegmentId = null;
        let currentLinkedCnaes = [];
        let originalLinkedCnaes = [];
        let allCnaesCache = [];
        let segmentoCnaeLinks = [];
        let segmentData = [];
        let nextSegmentId = 1;
        let ufData = [];
        let selectedCnaeCode = null;
        let cnaeData = [];
        let currentGenericContext = null;
        let currentItems = [];

        // Paginação (API)
        let currentPage = 1;
        let ultimoCnpj = null;
        let temMais = false;
        let registros = [];
        let municipiosCache = null; // Cache para a lista de municípios da sidebar

        // Controle de alterações não salvas
        let isDirty = false;

        function setDirty(value) {
            isDirty = value;
        }

        // ===== FUNÇÃO PARA NORMALIZAR TEXTOS =====
        function normalizarTexto(texto) {
            return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        }

        // ===== FUNÇÕES GENÉRICAS DE API =====
        async function apiGet(url) {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (!text) return {};
            try {
                return JSON.parse(text);
            } catch (e) {
                console.warn("Resposta não é JSON:", text);
                return {};
            }
        }

        async function apiPost(url, body) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(body)
                });
                const text = await response.text();
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }
                if (!text) return {};
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return {};
                }
            } catch (error) {
                console.error("❌ Erro no apiPost:", error);
                throw error;
            }
        }

        async function apiPut(url, body) {
            try {
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(body)
                });
                const text = await response.text();
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                if (!text) return {};
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return {};
                }
            } catch (error) {
                console.error("❌ Erro no apiPut:", error);
                throw error;
            }
        }

        async function apiDelete(url) {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.status === 204 ? null : await response.json();
        }

        // ===== FUNÇÃO AUXILIAR PARA TENTAR VÁRIAS URLs =====
        async function fetchFromAPI(urls) {
            for (const url of urls) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    return Array.isArray(data) ? data : (data.data || data.results || []);
                } catch (e) {
                    console.warn(`Falha em ${url}:`, e);
                }
            }
            return null;
        }

        // ===== CARREGAR DADOS AUXILIARES =====
        async function carregarUFs() {
            try {
                const data = await apiGet(`${API_URL}/api/ufs`);
                ufData = data.map(item => ({ sigla: item.uf, nome: item.nome, full: item.ufNome || `${item.uf} - ${item.nome}` }));
                filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(uf => `<option value="${uf.sigla}">${uf.sigla}</option>`).join('');
                refreshCustomSelect(filterUf);
            } catch (error) {
                console.error("Erro ao carregar UFs:", error);
            }
        }

        // ===== CARREGAR DDDs =====
        async function carregarDDDs() {
            try {
                const data = await apiGet(`${API_URL}/api/ddds`);
                const selectDDD = document.getElementById('filter-ddd');
                
                selectDDD.innerHTML = '<option value="">Todos</option>';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.ddd;
                    option.textContent = `${item.ddd} - ${item.descricao}`;
                    selectDDD.appendChild(option);
                });
                refreshCustomSelect(selectDDD);
            } catch (error) {
                console.error("Erro ao carregar DDDs:", error);
            }
        }

        // ===== CARREGAR MUNICÍPIOS POR DDD =====
        async function carregarMunicipiosPorDDD(ddd) {
            const selectMunicipio = document.getElementById('filter-municipio');
            const campoMunicipio = document.getElementById('campo-municipio');
            
            if (!ddd) {
                campoMunicipio.style.display = 'none';
                selectMunicipio.innerHTML = '<option value="">Todos</option>';
                return;
            }

            try {
                const data = await apiGet(`${API_URL}/api/ddds/${ddd}/municipios`);
                campoMunicipio.style.display = 'block';
                
                selectMunicipio.innerHTML = '<option value="">Todos</option>';
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.municipio;
                    option.textContent = item.municipio;
                    selectMunicipio.appendChild(option);
                });
                refreshCustomSelect(selectMunicipio);
            } catch (error) {
                console.error("Erro ao carregar municípios:", error);
                campoMunicipio.style.display = 'none';
                selectMunicipio.innerHTML = '<option value="">Todos</option>';
            }
        }

        // ===== CARREGAR SEGMENTOS E SEUS VÍNCULOS =====
        async function carregarSegmentos() {
            try {
                const data = await apiGet(`${API_URL}/api/segmentos`);
                segmentData = data.map(item => ({ id: item.codigo, nome: item.descricao }));
                
                // Busca os CNAEs vinculados para cada segmento e atualiza o array segmentoCnaeLinks
                segmentoCnaeLinks = [];
                for (const seg of segmentData) {
                    try {
                        const cnaesVinculados = await apiGet(`${API_URL}/api/segmentos/${seg.id}/cnaes`);
                        cnaesVinculados.forEach(cnae => {
                            segmentoCnaeLinks.push({ segmentoId: seg.id, cnaeCodigo: cnae.codigo });
                        });
                    } catch (e) {
                        console.warn(`Erro ao buscar CNAEs do segmento ${seg.id}:`, e);
                    }
                }
                
                updateSegmentFilter();
                renderSegmentTable();
            } catch (error) {
                console.error("Erro ao carregar Segmentos:", error);
            }
        }

        // ===== BUSCAR CNAES (CONSULTA DIRETA NA API) =====
        async function buscarCnaes(filtro) {
            const urls = [
                `${API_URL}/api/cnaes?filtro=${encodeURIComponent(filtro)}`,
                `http://localhost:8080/api/cnaes?filtro=${encodeURIComponent(filtro)}`
            ];
            
            const data = await fetchFromAPI(urls);
            
            if (data) {
                const resultados = data.map(item => ({
                    codigo: item.codigo || item.cnae || item.id,
                    descricao: item.descricao || item.nome || '',
                    full: item.codigoDescricao || `${item.codigo} - ${item.descricao}`
                })).filter(c => c.codigo);

                if (filtro) {
                    const novosCodigos = resultados.map(r => r.codigo);
                    allCnaesCache = allCnaesCache.filter(c => !novosCodigos.includes(c.codigo));
                    allCnaesCache.push(...resultados);
                }
                
                return resultados;
            }
            
            if (allCnaesCache.length > 0) {
                return allCnaesCache.filter(item => {
                    const termo = normalizarTexto(filtro);
                    return normalizarTexto(item.codigo).includes(termo) || 
                           normalizarTexto(item.descricao).includes(termo) ||
                           normalizarTexto(item.full).includes(termo);
                });
            }
            
            return [];
        }

        // ===== CARREGAR CNAEs INICIAIS =====
        async function carregarCnaesIniciais() {
            try {
                const data = await fetchFromAPI([`${API_URL}/api/cnaes`]);
                if (data) {
                    allCnaesCache = data.map(item => ({
                        codigo: item.codigo || item.cnae || item.id,
                        descricao: item.descricao || item.nome || '',
                        full: item.codigoDescricao || `${item.codigo} - ${item.descricao}`
                    })).filter(c => c.codigo);
                    cnaeData = allCnaesCache;
                    populateLinkSelect();
                    console.log("CNAEs carregados (inicial):", allCnaesCache.length);
                }
            } catch (error) {
                console.error("Erro ao carregar CNAEs iniciais:", error);
                allCnaesCache = [];
            }
        }

        // ===== CARREGAR MUNICÍPIOS VIA API (para o menu) =====
        async function carregarMunicipiosDaAPI() {
            try {
                const dddData = await apiGet(`${API_URL}/api/ddds`);
                const listaMunicipios = [];
                for (const ddd of dddData) {
                    try {
                        const municipios = await apiGet(`${API_URL}/api/ddds/${ddd.ddd}/municipios`);
                        municipios.forEach(m => {
                            listaMunicipios.push(`${m.municipio} - ${ddd.ddd}`);
                        });
                    } catch (e) {}
                }
                return [...new Set(listaMunicipios)].sort();
            } catch (error) {
                console.error("Erro ao carregar municípios:", error);
                return ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Porto Alegre - RS'];
            }
        }

        // ===== CARREGAR SITUAÇÕES CADASTRAIS =====
        async function carregarSituacoesCadastrais() {
            try {
                const data = await apiGet(`${API_URL}/api/situacoes-cadastrais`);
                return data.map(item => `${item.codigoDescricao}`);
            } catch (error) {
                return ['ATIVA', 'BAIXADA', 'SUSPENSA'];
            }
        }

        // ===== DROPDOWNS CUSTOMIZADOS =====
        function initializeCustomSelects() {
    const selects = document.querySelectorAll('select.input');

    selects.forEach(select => {
        if (select.closest('.custom-select')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        const textSpan = document.createElement('span');
        textSpan.className = 'custom-select-text';
        textSpan.textContent = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '';
        const icon = document.createElement('i');
        icon.className = 'fas fa-chevron-down';
        trigger.appendChild(textSpan);
        trigger.appendChild(icon);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';

        // Função para renderizar opções (com filtro)
        function renderOptions(filterText = '') {
            optionsContainer.innerHTML = '';
            const termo = filterText.toLowerCase().trim();

            Array.from(select.options).forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'custom-option' + (option.selected ? ' selected' : '');
                optionDiv.dataset.value = option.value;
                optionDiv.textContent = option.text;

                // Filtro por texto (se houver termo digitado)
                if (termo && !option.text.toLowerCase().includes(termo) && !option.value.toLowerCase().includes(termo)) {
                    optionDiv.style.display = 'none';
                } else {
                    optionDiv.style.display = 'block';
                }

                optionDiv.addEventListener('click', function() {
                    select.selectedIndex = index;
                    textSpan.textContent = this.textContent;
                    optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                    wrapper.classList.remove('open');
                    select.dispatchEvent(new Event('change'));
                    // Limpa o filtro após selecionar
                    inputBuffer = '';
                });

                optionsContainer.appendChild(optionDiv);
            });
        }

        // Renderiza inicialmente
        renderOptions();

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsContainer);

        // ===== BUSCA POR TECLADO =====
        let inputBuffer = '';

        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            document.querySelectorAll('.custom-select.open').forEach(cs => {
                if (cs !== wrapper) cs.classList.remove('open');
            });
            wrapper.classList.toggle('open');
            
            // Se abriu, limpa o filtro e renderiza tudo
            if (wrapper.classList.contains('open')) {
                inputBuffer = '';
                renderOptions('');
            }
        });

        // Adiciona evento de digitação no trigger
        trigger.setAttribute('tabindex', '0'); // Permite foco via teclado
        trigger.addEventListener('keydown', function(e) {
            if (!wrapper.classList.contains('open')) return;
            
            // Se for Backspace, remove último caractere
            if (e.key === 'Backspace') {
                inputBuffer = inputBuffer.slice(0, -1);
            } 
            // Se for Escape, fecha o dropdown
            else if (e.key === 'Escape') {
                wrapper.classList.remove('open');
                inputBuffer = ''; // Limpa ao fechar
                renderOptions(''); // Restaura lista completa
                return;
            }
            // Se for Enter, seleciona a primeira opção visível (se houver)
            else if (e.key === 'Enter') {
                const firstVisible = optionsContainer.querySelector('.custom-option:not([style*="display: none"])');
                if (firstVisible) {
                    firstVisible.click();
                }
                return;
            }
            // Se for letra ou número, adiciona ao buffer
            else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
                inputBuffer += e.key;
            } else {
                return; // ignora outras teclas
            }

            // Atualiza o filtro imediatamente
            renderOptions(inputBuffer);
        });

        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('open');
                inputBuffer = '';
                renderOptions(''); // Restaura lista completa ao fechar
            }
        });

        select.addEventListener('change', function() {
            const selectedText = select.options[select.selectedIndex].text;
            textSpan.textContent = selectedText;
            optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.value === select.value);
            });
        });
    });
}

        function refreshCustomSelect(select) {
            if (!select) return;
            const wrapper = select.closest('.custom-select');
            if (!wrapper) return;

            const textSpan = wrapper.querySelector('.custom-select-text');
            const optionsContainer = wrapper.querySelector('.custom-select-options');

            optionsContainer.innerHTML = '';

            Array.from(select.options).forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'custom-option' + (option.selected ? ' selected' : '');
                optionDiv.dataset.value = option.value;
                optionDiv.textContent = option.text;

                optionDiv.addEventListener('click', function() {
                    select.selectedIndex = index;
                    textSpan.textContent = this.textContent;
                    optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                    wrapper.classList.remove('open');
                    select.dispatchEvent(new Event('change'));
                });

                optionsContainer.appendChild(optionDiv);
            });

            if (select.options[select.selectedIndex]) {
                textSpan.textContent = select.options[select.selectedIndex].text;
            } else {
                textSpan.textContent = '';
            }
        }

        // ===== PESQUISA DE PROSPECÇÃO =====
        let pesquisaController = null;

        async function pesquisarProspeccao() {
            const uf = filterUf.value.trim();
            const ddd = filterDdd.value;
            const segmento = filterSegmento.value;
            
            let cnae = selectedCnaeCode;
            if (!cnae && filterCnaeInput.value.trim() !== '') {
                filterCnaeInput.value = '';
                cnae = null;
            }
            
            const escopoCnae = filterTipoCnae ? filterTipoCnae.value : 'PRINCIPAL';

            const body = {
                uf: uf || null,
                ddd: uf ? null : (ddd || null),
                cnae: cnae || null,
                segmento: cnae ? null : (segmento ? parseInt(segmento) : null),
                escopoCnae: (cnae || segmento) ? escopoCnae : null,
                ultimoCnpj: ultimoCnpj,
                limite: 20
            };

            if (!body.uf && !body.ddd && !body.segmento && !body.cnae) {
                alert("Informe pelo menos um filtro de pesquisa (UF, DDD, Segmento ou CNAE).");
                return;
            }

            btnSearch.disabled = true;
            btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pesquisando...';

            if (pesquisaController) {
                pesquisaController.abort();
            }
            pesquisaController = new AbortController();

            try {
                const response = await fetch(`${API_URL}/api/prospeccao/pesquisar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(body),
                    signal: pesquisaController.signal
                });

                const text = await response.text();
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }

                const data = text ? JSON.parse(text) : {};
                
                registros = data.registros || [];
                temMais = data.temMais || false;
                ultimoCnpj = data.ultimoCnpj || null;
                currentPage = 1;
                renderTable(registros);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("❌ Erro na pesquisa:", error);
                    alert("Erro ao pesquisar. Verifique o console (F12).");
                }
            } finally {
                btnSearch.disabled = false;
                btnSearch.innerHTML = '<i class="fas fa-search"></i> &nbsp; Pesquisar';
                pesquisaController = null;
            }
        }

        // ===== RENDERIZAR TABELA =====
        function renderTable(data) {
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum resultado encontrado.</td></tr>`;
                recordsFooter.textContent = 'Exibindo 0 registros';
                btnPrev.disabled = true;
                btnNext.disabled = !temMais;
                pageIndicator.textContent = 'Página 1';
                return;
            }

            data.forEach(item => {
                const row = `<tr>
                    <td>${item.cnpjFormatado}</td>
                    <td>${item.nomeFantasia || '-'}</td>
                    <td>${item.razaoSocial || '-'}</td>
                    <td><span class="status"><span class="status-dot-small"></span> ATIVA</span></td>
                    <td>${item.uf || '-'}</td>
                    <td>${item.telefone1 ? `(${item.ddd || ''}) ${item.telefone1}` : '-'}</td>
                    <td><button class="btn-detail"><i class="fas fa-info-circle"></i> Detalhes</button></td>
                </tr>`;
                tbody.innerHTML += row;
            });

            const start = (currentPage - 1) * 50 + 1;
            const end = Math.min(currentPage * 50, data.length);
            recordsFooter.textContent = `Exibindo ${start} - ${end} de ${data.length} registros`;
            pageIndicator.textContent = `Página ${currentPage}`;
            btnPrev.disabled = true;
            btnNext.disabled = !temMais;
        }

        // ===== DETALHES =====
        function openDetailsModal(cnpj) {
            const company = registros.find(item => item.cnpj === cnpj);
            if(!company) return;
            document.getElementById('det-cnpj').innerText = company.cnpjFormatado;
            document.getElementById('det-razao').innerText = company.razaoSocial || '-';
            document.getElementById('det-fantasia').innerText = company.nomeFantasia || '-';
            const situacaoElement = document.getElementById('det-situacao');
            situacaoElement.innerText = 'ATIVA';
            situacaoElement.className = 'badge badge-green';
            document.getElementById('det-tipo').innerText = 'MATRIZ';
            document.getElementById('det-natureza').innerText = '-';
            document.getElementById('det-porte').innerText = '-';
            document.getElementById('det-capital').innerText = '-';
            document.getElementById('det-inicio').innerText = '-';
            document.getElementById('det-data-sit').innerText = '-';
            document.getElementById('det-cnae').innerText = '-';
            document.getElementById('det-logradouro').innerText = '-';
            document.getElementById('det-numero').innerText = '-';
            document.getElementById('det-complemento').innerText = '-';
            document.getElementById('det-bairro').innerText = '-';
            document.getElementById('det-cep').innerText = '-';
            document.getElementById('det-municipio').innerText = company.municipio || '-';
            document.getElementById('det-tel1').innerText = company.telefone1 || '-';
            document.getElementById('det-tel2').innerText = company.telefone2 || '-';
            document.getElementById('det-email').innerText = company.email || '-';
            detailsModal.style.display = 'flex';
        }

        // ===== TELA DE SEGMENTOS =====
        function openSegmentScreen() {
            mainScreen.style.display = 'none';
            segmentScreen.style.display = 'block';
            resetSegmentForm();
            renderSegmentTable();
            populateLinkSelect();
        }

        function closeSegmentScreen() {
            setDirty(false);
            segmentScreen.style.display = 'none';
            mainScreen.style.display = 'block';
        }

        if (document.getElementById('menu-dashboard')) {
            document.getElementById('menu-dashboard').addEventListener('click', function() {
                if (isDirty) {
                    showUnsavedChangesModal(
                        'Deseja salvar antes de sair?',
                        function() {
                            document.getElementById('segmentoForm').requestSubmit();
                            closeSegmentScreen();
                        },
                        function() {
                            resetSegmentForm();
                            closeSegmentScreen();
                        }
                    );
                } else {
                    closeSegmentScreen();
                    closeAllModals();
                }
            });
        }

        window.novoSegmento = function() {
            if (isDirty) {
                showUnsavedChangesModal(
                    'Deseja salvar antes de criar um novo segmento?',
                    function() {
                        document.getElementById('segmentoForm').requestSubmit();
                        resetSegmentForm();
                    },
                    function() {
                        resetSegmentForm();
                    }
                );
            } else {
                resetSegmentForm();
            }
        };

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
            originalLinkedCnaes = [];
            linkCnaeSelect.value = '';
            refreshCustomSelect(linkCnaeSelect);
            setDirty(false);
        }

        function renderSegmentTable(searchTerm = '') {
            segmentTableBody.innerHTML = '';
            const term = searchTerm.toLowerCase();

            segmentData.filter(seg => seg.nome.toLowerCase().includes(term)).forEach(seg => {
                const links = segmentoCnaeLinks.filter(link => link.segmentoId === seg.id);
                const qtdLinks = links.length;

                let tooltipContent = '';
                if (qtdLinks > 0) {
                    tooltipContent += '<div class="cnae-tooltip-content">';
                    links.forEach(link => {
                        const cnae = allCnaesCache.find(c => c.codigo === link.cnaeCodigo);
                        if (cnae) {
                            tooltipContent += `<div class="tooltip-item"><strong>${cnae.codigo}</strong> - ${cnae.descricao}</div>`;
                        }
                    });
                    tooltipContent += '</div>';
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${seg.nome}</td>
                    <td>
                        <div class="cnae-tooltip">
                            <span class="tooltip-trigger">${qtdLinks}</span>
                            ${tooltipContent}
                        </div>
                    </td>
                    <td>
                        <div class="cell-actions">
                            <button class="btn-table" data-action="edit" data-id="${seg.id}">Editar</button>
                            <button class="btn-table btn-delete" data-action="delete" data-id="${seg.id}">Excluir</button>
                        </div>
                    </td>
                `;
                segmentTableBody.appendChild(tr);
            });

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

            segmentTableBody.querySelectorAll('.cnae-tooltip').forEach(tooltip => {
                const trigger = tooltip.querySelector('.tooltip-trigger');
                trigger.addEventListener('click', function(e) {
                    e.stopPropagation();
                    document.querySelectorAll('.cnae-tooltip.open').forEach(t => {
                        if (t !== tooltip) t.classList.remove('open');
                    });
                    tooltip.classList.toggle('open');
                });
            });
        }

        function updateSegmentFilter() {
            let options = '<option value="">Todos</option>';
            segmentData.forEach(seg => options += `<option value="${seg.id}">${seg.nome}</option>`);
            if (filterSegmento) {
                filterSegmento.innerHTML = options;
                refreshCustomSelect(filterSegmento);
            }
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
            refreshCustomSelect(linkCnaeSelect);
        }

        window.vincularCNAE = function() {
            const cnaeCodigo = linkCnaeSelect.value;
            if (!cnaeCodigo) {
                showWarning('Selecione um CNAE para vincular.');
                return;
            }
            const cnae = allCnaesCache.find(c => c.codigo === cnaeCodigo);
            if (cnae) {
                currentLinkedCnaes.push(cnae);
                renderLinkedCnaes();
                populateLinkSelect();
                linkCnaeSelect.value = '';
                refreshCustomSelect(linkCnaeSelect);
                setDirty(true);
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
            setDirty(true);
        };

        document.getElementById('segmentoForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const nome = segmentNome.value.trim();
            if (!nome) {
                showWarning('Informe o nome do segmento.');
                return;
            }

            try {
                let segId = editingSegmentId;

                // 1. Salva o segmento (cria ou atualiza)
                if (editingSegmentId !== null) {
                    await apiPut(`${API_URL}/api/segmentos/${editingSegmentId}`, { descricao: nome });
                    const seg = segmentData.find(s => s.id === editingSegmentId);
                    if (seg) seg.nome = nome;
                } else {
                    const novo = await apiPost(`${API_URL}/api/segmentos`, { descricao: nome });
                    segId = novo.codigo;
                    segmentData.push({ id: segId, nome });
                }

                // 2. Sincroniza os CNAEs vinculados
                if (segId) {
                    const cnaesAtuais = currentLinkedCnaes.map(c => c.codigo);
                    const cnaesOriginais = originalLinkedCnaes.map(c => c.codigo);

                    // Remove os CNAEs que estavam vinculados antes e não estão mais
                    for (const cnae of cnaesOriginais) {
                        if (!cnaesAtuais.includes(cnae)) {
                            try {
                                await apiDelete(`${API_URL}/api/segmentos/${segId}/cnaes/${cnae}`);
                            } catch (e) {
                                console.warn(`Erro ao desvincular CNAE ${cnae}:`, e);
                            }
                        }
                    }

                    // Adiciona APENAS os CNAEs NOVOS (que não estavam na lista original)
                    for (const cnae of currentLinkedCnaes) {
                        if (cnaesOriginais.includes(cnae.codigo)) continue; // Pula os que já estavam vinculados
                        try {
                            await apiPost(`${API_URL}/api/segmentos/${segId}/cnaes`, { cnae: cnae.codigo });
                        } catch (e) {
                            if (e.message !== 'HTTP 409') console.warn(`Erro ao vincular CNAE ${cnae.codigo}:`, e);
                        }
                    }
                }

                // 3. Reseta o formulário e recarrega dados
                setDirty(false);
                resetSegmentForm();
                await carregarSegmentos();
                updateSegmentFilter();
                confirmModal.style.display = 'none';
                showWarning('Segmento salvo com sucesso!', 'Sucesso');
            } catch (error) {
                console.error("Erro ao salvar segmento:", error);
                showWarning('Erro ao salvar segmento.');
            }
        });

        if (btnCancelSegment) {
            btnCancelSegment.addEventListener('click', function() {
                resetSegmentForm();
            });
        }

        segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });

        async function editarSegmento(id) {
            const seg = segmentData.find(s => s.id === id);
            if (!seg) return;
            editingSegmentId = id;
            segmentNome.value = seg.nome;
            btnSaveSegment.innerText = 'Atualizar segmento';
            btnSaveSegment.classList.add('editing-btn');
            btnCancelSegment.style.display = 'inline-block';
            formTitle.innerText = 'Editar segmento';
            segmentFormCard.classList.add('editing-mode');

            try {
                const cnaesVinculados = await apiGet(`${API_URL}/api/segmentos/${id}/cnaes`);
                currentLinkedCnaes = allCnaesCache.filter(cnae => cnaesVinculados.some(v => v.codigo === cnae.codigo));
                originalLinkedCnaes = [...currentLinkedCnaes];
                renderLinkedCnaes();
                populateLinkSelect();
            } catch (e) {
                currentLinkedCnaes = [];
                originalLinkedCnaes = [];
                renderLinkedCnaes();
                populateLinkSelect();
            }
            setDirty(true);
        }

        function excluirSegmento(id) {
            const seg = segmentData.find(s => s.id === id);
            if (!seg) {
                showWarning('Segmento não encontrado.');
                return;
            }
            showConfirm('Excluir Segmento', `Tem certeza que deseja excluir o segmento "${seg.nome}"?`, async function() {
                try {
                    await apiDelete(`${API_URL}/api/segmentos/${id}`);
                    segmentData = segmentData.filter(s => s.id !== id);
                    segmentoCnaeLinks = segmentoCnaeLinks.filter(link => link.segmentoId !== id);
                    renderSegmentTable(segmentSearch.value);
                    updateSegmentFilter();
                    if (editingSegmentId === id) resetSegmentForm();
                } catch (error) {
                    showWarning('Erro ao excluir segmento. Verifique se há CNAEs vinculados.');
                }
            });
        }

        // ===== MODAIS =====
        function closeAllModals() {
            if (detailsModal && detailsModal.style.display === 'flex') detailsModal.style.display = 'none';
            if (genericModal && genericModal.style.display === 'flex') genericModal.style.display = 'none';
            if (confirmModal && confirmModal.style.display === 'flex') confirmModal.style.display = 'none';
            confirmCallback = null;
        }

        document.addEventListener('keydown', function(event) { if (event.key === 'Escape') closeAllModals(); });

        if (detailsClose) detailsClose.addEventListener('click', function() { detailsModal.style.display = 'none'; });
        if (genericClose) genericClose.addEventListener('click', function() { genericModal.style.display = 'none'; });
        if (confirmClose) confirmClose.addEventListener('click', function() { confirmModal.style.display = 'none'; });

        if (detailsModal) detailsModal.addEventListener('click', function(e) { if(e.target === this) detailsModal.style.display = 'none'; });
        if (genericModal) genericModal.addEventListener('click', function(e) { if(e.target === this) genericModal.style.display = 'none'; });
        if (confirmModal) confirmModal.addEventListener('click', function(e) { if(e.target === this) confirmModal.style.display = 'none'; });

        if (btnIgnoreCadastro) {
            btnIgnoreCadastro.addEventListener('click', function() {
                showConfirm('Ignorar Cadastro', 'Tem certeza que deseja ignorar este cadastro? Esta ação não poderá ser desfeita.', function() {
                    detailsModal.style.display = 'none';
                });
            });
        }

        function showConfirm(title, message, callback) {
            confirmTitle.innerText = title;
            confirmMessage.innerText = message;
            btnConfirmOk.innerText = 'Confirmar';
            btnConfirmCancel.innerText = 'Cancelar';
            btnConfirmDiscard.style.display = 'none';
            confirmCallback = callback;
            btnConfirmCancel.style.display = 'inline-block';
            confirmModal.style.display = 'flex';
        }

        function showWarning(message, title = 'Aviso') {
            confirmTitle.innerText = title;
            confirmMessage.innerText = message;
            btnConfirmOk.innerText = 'OK';
            btnConfirmCancel.style.display = 'none';
            btnConfirmDiscard.style.display = 'none';
            confirmCallback = null;
            confirmModal.style.display = 'flex';
        }

        function showUnsavedChangesModal(message, onSave, onDiscard) {
            confirmTitle.innerText = 'Alterações não salvas';
            confirmMessage.innerText = message;
            btnConfirmOk.innerText = 'Salvar';
            btnConfirmCancel.innerText = 'Cancelar';
            btnConfirmDiscard.style.display = 'inline-block';
            confirmCallback = onSave;
            confirmModal.style.display = 'flex';

            btnConfirmDiscard.onclick = function() {
                if (onDiscard) onDiscard();
                confirmModal.style.display = 'none';
                btnConfirmDiscard.style.display = 'none';
                btnConfirmCancel.style.display = 'inline-block';
                btnConfirmOk.innerText = 'Confirmar';
                confirmCallback = null;
            };
        }

        btnConfirmOk.addEventListener('click', function() {
            if (confirmCallback) {
                const callback = confirmCallback;
                confirmCallback = null;
                callback();
            }
            confirmModal.style.display = 'none';
            btnConfirmCancel.style.display = 'inline-block';
            btnConfirmOk.innerText = 'Confirmar';
            btnConfirmDiscard.style.display = 'none';
        });

        btnConfirmCancel.addEventListener('click', function() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
            btnConfirmDiscard.style.display = 'none';
        });

        // ===== AUTOCOMPLETE DE CNAE =====
        let debounceTimer;
        filterCnaeInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            const termo = this.value.trim();
            if (termo.length === 0) { 
                cnaeSuggestions.classList.remove('active'); 
                selectedCnaeCode = null; 
                return; 
            }
            debounceTimer = setTimeout(async () => {
                const resultados = await buscarCnaes(termo);
                renderSuggestions(resultados);
            }, 250);
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
                });
                cnaeSuggestions.appendChild(div);
            });
            cnaeSuggestions.classList.add('active');
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.autocomplete-container')) cnaeSuggestions.classList.remove('active');
        });

        // ===== FUNÇÕES GENÉRICAS (MODAIS) =====
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

        genericSearch.addEventListener('input', async function() {
            const searchTerm = this.value.toLowerCase();
            if (currentGenericContext === 'cnae') {
                const resultados = await buscarCnaes(searchTerm);
                renderGenericList(resultados);
            } else {
                const filteredItems = currentItems.filter(item => {
                    const card = formatAsCard(item);
                    return card.full.toLowerCase().includes(searchTerm) || card.nome.toLowerCase().includes(searchTerm);
                });
                renderGenericList(filteredItems);
            }
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
                        pesquisarProspeccao();
                        genericModal.style.display = 'none';
                    } else { genericModal.style.display = 'none'; }
                }
            }
        });

        // ===== MENUS DA SIDEBAR =====
        document.getElementById('menu-cnaes').addEventListener('click', async () => {
            const cnaesDaApi = await buscarCnaes('');
            openGenericModal('Pesquisa CNAE', 'Informe o CNAE:', cnaesDaApi, 'cnae');
        });

        document.getElementById('menu-municipios').addEventListener('click', async () => {
            const municipios = await carregarMunicipiosDaAPI();
            openGenericModal('Pesquisa Município', 'Informe o município:', municipios, 'municipio');
        });

        document.getElementById('menu-natureza').addEventListener('click', async () => {
            const situacoes = await carregarSituacoesCadastrais();
            openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', situacoes, 'natureza');
        });

        document.getElementById('menu-segmentos').addEventListener('click', () => {
            openSegmentScreen();
        });

        // ===== LIMPAR FILTROS =====
        function clearFilters() {
            filterUf.value = '';
            filterDdd.value = '';
            filterSegmento.value = '';
            filterCnaeInput.value = '';
            selectedCnaeCode = null;
            filterTipoCnae.value = 'PRINCIPAL';
            cnaeSuggestions.classList.remove('active');
            
            if (filterMunicipio) {
                filterMunicipio.innerHTML = '<option value="">Todos</option>';
            }
            if (campoMunicipio) {
                campoMunicipio.style.display = 'none';
            }

            refreshCustomSelect(filterUf);
            refreshCustomSelect(filterDdd);
            refreshCustomSelect(filterSegmento);
            refreshCustomSelect(filterTipoCnae);
            if (filterMunicipio) refreshCustomSelect(filterMunicipio);

            registros = [];
            ultimoCnpj = null;
            temMais = false;
            currentPage = 1;
            renderTable([]);
        }

        function changePage(direction) {
            if (direction === 'next' && temMais) {
                currentPage++;
                pesquisarProspeccao();
            } else if (direction === 'prev' && currentPage > 1) {
                console.warn("Paginação anterior não suportada pela API");
            }
        }

        // ===== EVENTOS =====
        btnSearch.addEventListener('click', function() {
            ultimoCnpj = null;
            pesquisarProspeccao();
        });

        btnClear.addEventListener('click', clearFilters);
        btnPrev.addEventListener('click', function() { changePage('prev'); });
        btnNext.addEventListener('click', function() { changePage('next'); });

        tbody.addEventListener('click', function(e) {
            if(e.target.classList.contains('btn-detail')) {
                const row = e.target.closest('tr');
                openDetailsModal(row.cells[0].innerText.replace(/\D/g, ''));
            }
        });

        // ===== EVENTO DE MUDANÇA DO DDD =====
        document.getElementById('filter-ddd').addEventListener('change', function() {
            const ddd = this.value;
            carregarMunicipiosPorDDD(ddd);
        });

        // ===== INICIALIZAÇÃO =====
        initializeCustomSelects();
        carregarUFs();
        carregarSegmentos();
        carregarCnaesIniciais();
        carregarDDDs();
        updateSegmentFilter();

    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
    }
});