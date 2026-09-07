document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    // ===== CONFIGURAÇÃO DA API =====
    const API_URL = '/api';

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

        // ===== ELEMENTOS DAS TELAS =====
        const mainScreen = document.getElementById('main-screen');
        const segmentScreen = document.getElementById('segment-screen');
        const ignoradosScreen = document.getElementById('ignorados-screen');
        const mapScreen = document.getElementById('map-screen'); // NOVO

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

        // ===== ELEMENTOS DA TELA DE IGNORADOS =====
        const ignoradosSearch = document.getElementById('ignorados-search');

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
        let ufData = [];
        let selectedCnaeCode = null;
        let cnaeData = [];
        let currentGenericContext = null;
        let currentItems = [];
        let ignorados = [];
        let ignoradosCarregados = false;
        let ignoradosFiltrados = [];

        // Paginação (API)
        let currentPage = 1;
        let ultimoCnpj = null;
        let cursorAtual = null;
        let historicoCursors = [null]; 
        let temMais = false;
        let registros = [];
        let municipiosCache = null;
        let municipiosCarregando = false;
        let municipiosPromise = null;

        // === EXPOR VARIÁVEIS PARA DEPURAÇÃO NO CONSOLE ===
        window.registros = registros;

        // Controle de alterações não salvas
        let isDirty = false;

        function setDirty(value) {
            isDirty = value;
        }

        // ===== GERENCIAMENTO DO ITEM ATIVO NA SIDEBAR =====
        function setActiveMenuItem(id) {
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            const target = document.getElementById(id);
            if (target) target.classList.add('active');
        }

        let previousMenuItemId = null;

        function saveActiveMenuItem() {
            const active = document.querySelector('.menu-item.active');
            if (active) previousMenuItemId = active.id;
        }

        function restoreActiveMenuItem() {
            if (previousMenuItemId) {
                setActiveMenuItem(previousMenuItemId);
                previousMenuItemId = null;
            }
        }

        // ===== NAVEGAÇÃO ENTRE TELAS =====
        function showScreen(screen) {
            if (screen === 'main') {
                mainScreen.style.display = 'block';
                segmentScreen.style.display = 'none';
                ignoradosScreen.style.display = 'none';
                mapScreen.style.display = 'none';
                setActiveMenuItem('menu-dashboard');
            } else if (screen === 'segment') {
                mainScreen.style.display = 'none';
                segmentScreen.style.display = 'block';
                ignoradosScreen.style.display = 'none';
                mapScreen.style.display = 'none';
                setActiveMenuItem('menu-segmentos');
                resetSegmentForm();
                renderSegmentTable();
                populateLinkSelect();
            } else if (screen === 'ignorados') {
                mainScreen.style.display = 'none';
                segmentScreen.style.display = 'none';
                ignoradosScreen.style.display = 'block';
                mapScreen.style.display = 'none';
                setActiveMenuItem('menu-ignorados');
                // Carrega ignorados se ainda não carregou
                if (!ignoradosCarregados) {
                    carregarIgnorados();
                } else {
                    renderIgnoradosTable();
                }
            } else if (screen === 'mapa') {
                mainScreen.style.display = 'none';
                segmentScreen.style.display = 'none';
                ignoradosScreen.style.display = 'none';
                mapScreen.style.display = 'block';
                setActiveMenuItem('menu-mapa');
                // Inicializar mapa se ainda não foi inicializado
                if (!window.mapInstance) {
                    initMap();
                } else {
                    // Forçar redimensionamento se necessário
                    setTimeout(() => {
                        window.mapInstance.invalidateSize();
                    }, 100);
                }
            }
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
                const data = await apiGet(`${API_URL}/ufs`);
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
                const data = await apiGet(`${API_URL}/ddds`);
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

        // ===== CARREGAR MUNICÍPIOS POR DDD (DESATIVADO) =====
        async function carregarMunicipiosPorDDD(ddd) {
            const selectMunicipio = document.getElementById('filter-municipio');
            const campoMunicipio = document.getElementById('campo-municipio');
            campoMunicipio.style.display = 'none';
            selectMunicipio.innerHTML = '<option value="">Todos</option>';
            refreshCustomSelect(selectMunicipio);
        }

        // ===== BUSCAR DETALHES DE UM CNAE =====
        async function buscarDetalhesCnae(codigo) {
            const codigoNormalizado = String(codigo).trim();

            const cnaeNoCache = allCnaesCache.find(
                c => String(c.codigo).trim() === codigoNormalizado
            );
            if (cnaeNoCache) {
                return cnaeNoCache;
            }
            
            try {
                const lista = await fetchFromAPI([
                    `${API_URL}/cnaes?filtro=${encodeURIComponent(codigoNormalizado)}`
                ]);

                if (Array.isArray(lista)) {
                    const encontrado = lista.find(item => {
                        const codigoApi = item.codigo ?? item.cnae ?? item.id;
                        return String(codigoApi).trim() === codigoNormalizado;
                    });

                    if (encontrado) {
                        const resultado = {
                            codigo: encontrado.codigo ?? encontrado.cnae ?? encontrado.id,
                            descricao: encontrado.descricao ?? encontrado.nome ?? '',
                            full: encontrado.codigoDescricao ?? `${encontrado.codigo ?? encontrado.cnae ?? encontrado.id} - ${encontrado.descricao ?? encontrado.nome ?? ''}`
                        };
                        allCnaesCache.push(resultado);
                        return resultado;
                    }
                }
            } catch (e) {
                console.error(`Erro ao procurar CNAE ${codigoNormalizado} na lista geral:`, e);
            }

            console.warn(`CNAE ${codigoNormalizado} não encontrado na lista da API.`);
            return null;
        }

        // ===== CARREGAR SEGMENTOS E SEUS VÍNCULOS =====
        async function carregarSegmentos() {
            if (segmentData.length > 0) {
                updateSegmentFilter();
                renderSegmentTable();
                return;
            }

            try {
                const data = await apiGet(`${API_URL}/segmentos`);
                segmentData = data.map(item => ({ id: item.codigo, nome: item.descricao }));

                segmentoCnaeLinks = [];
                const promises = [];

                for (const seg of segmentData) {
                    try {
                        const cnaesVinculados = await apiGet(`${API_URL}/segmentos/${seg.id}/cnaes`);
                        
                        cnaesVinculados.forEach(cnae => {
                            const exists = segmentoCnaeLinks.some(link => 
                                link.segmentoId === seg.id && link.cnaeCodigo === cnae.codigo
                            );
                            if (!exists) {
                                segmentoCnaeLinks.push({ segmentoId: seg.id, cnaeCodigo: cnae.codigo });
                            }

                            const codigoVinculado = String(cnae.codigo).trim();
                            const cnaeJaExiste = allCnaesCache.some(
                                c => String(c.codigo).trim() === codigoVinculado
                            );
                            if (!cnaeJaExiste) {
                                const promise = buscarDetalhesCnae(codigoVinculado).then(detalhes => {
                                    if (detalhes) {
                                        const jaExiste = allCnaesCache.some(
                                            c => String(c.codigo).trim() === String(detalhes.codigo).trim()
                                        );
                                        if (!jaExiste) {
                                            allCnaesCache.push(detalhes);
                                        }
                                        populateLinkSelect();
                                    }
                                });
                                promises.push(promise);
                            }
                        });
                    } catch (e) {
                        console.warn(`Erro ao buscar CNAEs do segmento ${seg.id}:`, e);
                    }
                }

                await Promise.all(promises);

                updateSegmentFilter();
                renderSegmentTable();
            } catch (error) {
                console.error("Erro ao carregar Segmentos:", error);
                if (filterSegmento) {
                    filterSegmento.innerHTML = '<option value="">Todos</option>';
                    refreshCustomSelect(filterSegmento);
                }
            }
        }

        // ===== BUSCAR CNAES (CONSULTA DIRETA NA API) =====
        async function buscarCnaes(filtro) {
            const urls = [
                `${API_URL}/cnaes?filtro=${encodeURIComponent(filtro)}`,
                `http://localhost:8080/cnaes?filtro=${encodeURIComponent(filtro)}`
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
                const data = await fetchFromAPI([`${API_URL}/cnaes`]);
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

        // ===== CARREGAR MUNICÍPIOS VIA API =====
        async function carregarMunicipiosDaAPI() {
            if (municipiosCache) {
                console.log("⚡ Usando cache de municípios");
                return municipiosCache;
            }

            if (municipiosCarregando) {
                console.log("⏳ Municípios já estão sendo carregados...");
                return null;
            }

            municipiosCarregando = true;

            try {
                const dddData = await apiGet(`${API_URL}/ddds`);

                const promises = dddData.map(async (ddd) => {
                    try {
                        const municipios = await apiGet(`${API_URL}/ddds/${ddd.ddd}/municipios`);
                        return municipios.map(m => `${m.municipio} - ${ddd.ddd}`);
                    } catch (e) {
                        return [];
                    }
                });

                const resultados = await Promise.all(promises);
                const listaMunicipios = [...new Set(resultados.flat())].sort();

                municipiosCache = listaMunicipios;
                municipiosCarregando = false;

                console.log("✅ Municípios carregados:", listaMunicipios.length);
                return listaMunicipios;
            } catch (error) {
                console.error("Erro ao carregar municípios:", error);
                municipiosCarregando = false;
                return ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Porto Alegre - RS'];
            }
        }

        // ===== CARREGAR SITUAÇÕES CADASTRAIS =====
        async function carregarSituacoesCadastrais() {
            try {
                const data = await apiGet(`${API_URL}/situacoes-cadastrais`);
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

                function renderOptions(filterText = '') {
                    optionsContainer.innerHTML = '';
                    const termo = filterText.toLowerCase().trim();

                    Array.from(select.options).forEach((option, index) => {
                        const optionDiv = document.createElement('div');
                        optionDiv.className = 'custom-option' + (option.selected ? ' selected' : '');
                        optionDiv.dataset.value = option.value;
                        optionDiv.textContent = option.text;

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
                            inputBuffer = '';
                        });

                        optionsContainer.appendChild(optionDiv);
                    });
                }

                renderOptions();

                wrapper.appendChild(trigger);
                wrapper.appendChild(optionsContainer);

                let inputBuffer = '';

                trigger.addEventListener('click', function(e) {
                    e.stopPropagation();
                    document.querySelectorAll('.custom-select.open').forEach(cs => {
                        if (cs !== wrapper) cs.classList.remove('open');
                    });
                    wrapper.classList.toggle('open');
                    
                    if (wrapper.classList.contains('open')) {
                        inputBuffer = '';
                        renderOptions('');
                    }
                });

                trigger.setAttribute('tabindex', '0');
                trigger.addEventListener('keydown', function(e) {
                    if (!wrapper.classList.contains('open')) return;
                    
                    if (e.key === 'Backspace') {
                        inputBuffer = inputBuffer.slice(0, -1);
                    } else if (e.key === 'Escape') {
                        wrapper.classList.remove('open');
                        inputBuffer = '';
                        renderOptions('');
                        return;
                    } else if (e.key === 'Enter') {
                        const firstVisible = optionsContainer.querySelector('.custom-option:not([style*="display: none"])');
                        if (firstVisible) {
                            firstVisible.click();
                        }
                        return;
                    } else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
                        inputBuffer += e.key;
                    } else {
                        return;
                    }

                    renderOptions(inputBuffer);
                });

                document.addEventListener('click', function(e) {
                    if (!wrapper.contains(e.target)) {
                        wrapper.classList.remove('open');
                        inputBuffer = '';
                        renderOptions('');
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

        // ===== FUNÇÃO AUXILIAR PARA FORMATAR TELEFONE =====
        function formatarTelefone(ddd, numero) {
            if (!numero) return '-';
            let numeroLimpo = String(numero).replace(/\D/g, '');
            if (numeroLimpo.length === 0) return '-';
            
            let dddNum = null;
            const dddStr = String(ddd || '').trim();
            
            if (dddStr && dddStr !== '0' && dddStr !== 'null') {
                const parsed = parseInt(dddStr, 10);
                if (!isNaN(parsed) && parsed > 0) {
                    dddNum = parsed;
                }
            }
            
            if (!dddNum) {
                if (numeroLimpo.length >= 10) {
                    const possivelDDD = parseInt(numeroLimpo.substring(0, 2), 10);
                    if (possivelDDD >= 10 && possivelDDD <= 99) {
                        dddNum = possivelDDD;
                        numeroLimpo = numeroLimpo.substring(2);
                    }
                }
            }
            
            if (!dddNum) {
                return numeroLimpo;
            }
            
            return `(${dddNum}) ${numeroLimpo}`;
        }

        // ===== PERSISTÊNCIA DOS IGNORADOS (API) =====
        async function salvarStatusIgnorado(cnpj) {
            try {
                const response = await fetch(`${API_URL}/prospeccao/status-estabelecimentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ 
                        cnpjCompleto: cnpj, 
                        status: 'X'
                    })
                });
                if (!response.ok) {
                    const text = await response.text();
                    console.warn(`Erro ao salvar status (${response.status}):`, text);
                }
            } catch (error) {
                console.error('Erro ao salvar status:', error);
            }
        }

        async function removerStatusIgnorado(cnpj) {
            console.log(`Restaurando localmente o CNPJ ${cnpj} (não há API para remover status)`);
        }

        async function carregarIgnorados() {
            if (ignoradosCarregados) return;
            try {
                const response = await fetch(`${API_URL}/prospeccao/status-estabelecimentos?status=X`, {
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                
                if (data && data.registros && Array.isArray(data.registros)) {
                    ignorados = data.registros.map(item => ({
                        cnpj: item.cnpj,
                        cnpjFormatado: item.cnpjFormatado,
                        razaoSocial: item.razaoSocial,
                        nomeFantasia: item.nomeFantasia,
                        uf: item.uf,
                        municipio: item.municipio,
                        telefone1: item.telefone1,
                        telefone2: item.telefone2,
                        email: item.email
                    }));
                } else {
                    ignorados = [];
                }
                ignoradosCarregados = true;
                // Aplica filtro (se houver termo de busca)
                ignoradosFiltrados = [...ignorados];
                renderIgnoradosTable();
            } catch (error) {
                console.error('Erro ao carregar ignorados:', error);
                ignorados = [];
                ignoradosFiltrados = [];
                renderIgnoradosTable();
            }
        }

        // ===== FILTRO DA TELA DE IGNORADOS =====
        function filtrarIgnorados() {
            const termo = ignoradosSearch ? ignoradosSearch.value.toLowerCase().trim() : '';
            
            if (!termo) {
                ignoradosFiltrados = [...ignorados];
            } else {
                ignoradosFiltrados = ignorados.filter(item => {
                    return (
                        (item.cnpj && item.cnpj.includes(termo)) ||
                        (item.cnpjFormatado && item.cnpjFormatado.includes(termo)) ||
                        (item.razaoSocial && item.razaoSocial.toLowerCase().includes(termo)) ||
                        (item.nomeFantasia && item.nomeFantasia.toLowerCase().includes(termo)) ||
                        (item.uf && item.uf.toLowerCase().includes(termo)) ||
                        (item.telefone1 && item.telefone1.includes(termo)) ||
                        (item.municipio && item.municipio.toLowerCase().includes(termo))
                    );
                });
            }
            renderIgnoradosTable();
        }

        // ===== RENDERIZAR TABELA =====
        function renderTable(data) {
            console.log('📊 Dados recebidos para renderizar:', data);

            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum resultado encontrado.</td></tr>`;
                recordsFooter.textContent = 'Nenhum registro encontrado';
                btnPrev.disabled = true;
                btnNext.disabled = true;
                pageIndicator.textContent = 'Página 1';
                if (tbody) tbody.scrollTop = 0;
                return;
            }

            data.forEach(item => {
                console.log(`🔍 CNPJ: ${item.cnpjFormatado} | Razão: ${item.razaoSocial}`);

                const row = `<tr>
                    <td>${item.cnpjFormatado}</td>
                    <td>${item.nomeFantasia || '-'}</td>
                    <td>${item.razaoSocial || '-'}</td>
                    <td><span class="status"><span class="status-dot-small"></span> ATIVA</span></td>
                    <td>${item.uf || '-'}</td>
                    <td>${formatarTelefone(item.ddd, item.telefone1)}</td>
                    <td><button class="btn-detail" data-cnpj="${item.cnpj}"><i class="fas fa-info-circle"></i> Detalhes</button></td>
                </tr>`;
                tbody.innerHTML += row;
            });

            const limite = 50;
            const start = (currentPage - 1) * limite + 1;
            const end = start + data.length - 1;

            recordsFooter.textContent = `Exibindo ${start} - ${end}`;
            pageIndicator.textContent = `Página ${currentPage}`;

            btnPrev.disabled = (currentPage === 1);
            btnNext.disabled = !temMais;

            if (!temMais && data.length < limite) {
                btnNext.disabled = true;
            }

            if (tbody) tbody.scrollTop = 0;

            tbody.querySelectorAll('.btn-detail').forEach(btn => {
                btn.addEventListener('click', function() {
                    const cnpj = this.dataset.cnpj;
                    openDetailsModal(cnpj, false);
                });
            });

            setupCellTooltips();
        }

        // ===== FUNÇÃO PARA ADICIONAR TOOLTIP EM CÉLULAS CORTADAS =====
        function setupCellTooltips() {
            const tables = document.querySelectorAll('#main-screen .table-responsive tbody, #ignorados-screen .table-responsive tbody');
            
            tables.forEach(tbody => {
                const cells = tbody.querySelectorAll('td');
                cells.forEach(td => {
                    if (td.querySelector('button')) return;
                    if (td._tooltipHandler) {
                        td.removeEventListener('mouseenter', td._tooltipHandler);
                    }
                    const handler = function() {
                        if (this.scrollWidth > this.clientWidth) {
                            this.title = this.textContent.trim();
                        } else {
                            this.title = '';
                        }
                    };
                    td.addEventListener('mouseenter', handler);
                    td._tooltipHandler = handler;
                });
            });
        }

        // ===== RENDERIZAR TABELA DE IGNORADOS =====
        function renderIgnoradosTable() {
            const tbodyIgnorados = document.getElementById('ignorados-table-body');
            const footerIgnorados = document.getElementById('ignorados-footer');
            if (!tbodyIgnorados || !footerIgnorados) return;
            tbodyIgnorados.innerHTML = '';

            const showingDiv = footerIgnorados.querySelector('.showing');
            if (!showingDiv) return;

            const data = ignoradosFiltrados || [];

            if (data.length === 0) {
                tbodyIgnorados.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum registro ignorado.</td></tr>`;
                footerIgnorados.style.display = 'none';
                return;
            }

            footerIgnorados.style.display = 'flex';

            data.forEach((item) => {
                const row = `<tr>
                    <td>${item.cnpjFormatado}</td>
                    <td>${item.nomeFantasia || '-'}</td>
                    <td>${item.razaoSocial || '-'}</td>
                    <td><span class="status"><span class="status-dot-small"></span> ATIVA</span></td>
                    <td>${item.uf || '-'}</td>
                    <td>${formatarTelefone(item.ddd, item.telefone1)}</td>
                    <td>
                        <button class="btn-detail" data-cnpj="${item.cnpj}"><i class="fas fa-info-circle"></i> Detalhes</button>
                    </td>
                </tr>`;
                tbodyIgnorados.innerHTML += row;
            });

            showingDiv.textContent = `Total: ${data.length} registros ignorados.`;

            tbodyIgnorados.querySelectorAll('.btn-detail').forEach(btn => {
                btn.addEventListener('click', function() {
                    const cnpj = this.dataset.cnpj;
                    openDetailsModal(cnpj, true);
                });
            });

            setupCellTooltips();
        }

        function restaurarIgnorado(index) {
            const item = ignorados[index];
            if (!item) return;

            ignorados.splice(index, 1);
            ignoradosFiltrados = [...ignorados];
            removerStatusIgnorado(item.cnpj);
            renderIgnoradosTable();
            showWarning('Registro removido da lista de ignorados.', 'Restaurado');
        }

        function restaurarIgnoradoPorCnpj(cnpj) {
            const index = ignorados.findIndex(item => item.cnpj === cnpj);
            if (index === -1) {
                showWarning('Registro não encontrado nos ignorados.', 'Erro');
                return;
            }
            const item = ignorados[index];
            ignorados.splice(index, 1);
            ignoradosFiltrados = [...ignorados];
            removerStatusIgnorado(cnpj);
            renderIgnoradosTable();
            detailsModal.style.display = 'none';
            showWarning('Registro removido da lista de ignorados.', 'Restaurado');
        }

        // ===== PESQUISA DE PROSPECÇÃO =====
        let pesquisaController = null;

        async function pesquisarProspeccao(botao = null, cursor = null) {
            const btn = botao || btnSearch;
            const cursorParaEnvio = (cursor !== undefined) ? cursor : cursorAtual;

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
                ultimoCnpj: cursorParaEnvio,
                limite: 50
            };

            if (!body.uf && !body.ddd && !body.segmento && !body.cnae) {
                alert("Informe pelo menos um filtro de pesquisa (UF, DDD, Segmento ou CNAE).");
                return;
            }

            btn.disabled = true;
            const originalBtnHtml = btn.innerHTML;
            const originalPageHtml = pageIndicator.innerHTML;

            if (btn.classList.contains('page-btn')) {
                pageIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            } else {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            }

            if (pesquisaController) {
                pesquisaController.abort();
            }
            pesquisaController = new AbortController();

            try {
                const response = await fetch(`${API_URL}/prospeccao/pesquisar`, {
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
                const ultimoCnpjRetornado = data.ultimoCnpj || null;

                cursorAtual = ultimoCnpjRetornado;

                renderTable(registros);
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("❌ Erro na pesquisa:", error);
                    alert("Erro ao pesquisar. Verifique o console (F12).");
                }
                if (btn.classList.contains('page-btn')) {
                    pageIndicator.innerHTML = originalPageHtml;
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
                pesquisaController = null;
            }
        }

        // ===== DETALHES =====
        function openDetailsModal(cnpj, isIgnorado = false) {
            const list = isIgnorado ? ignorados : registros;
            const company = list.find(item => item.cnpj === cnpj);
            if (!company) return;

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
            document.getElementById('det-tel1').innerText = formatarTelefone(company.ddd, company.telefone1);
            document.getElementById('det-tel2').innerText = formatarTelefone(company.ddd, company.telefone2);
            document.getElementById('det-email').innerText = company.email || '-';

            const btn = document.getElementById('btn-ignore-cadastro');
            if (isIgnorado) {
                btn.innerText = 'Restaurar';
                btn.className = 'btn-secondary';
                btn.onclick = function() {
                    restaurarIgnoradoPorCnpj(cnpj);
                };
            } else {
                btn.innerText = 'Ignorar Cadastro';
                btn.className = 'btn-secondary';
                btn.onclick = function() {
                    const companyToIgnore = registros.find(item => item.cnpj === cnpj);
                    if (!companyToIgnore) {
                        showWarning('Registro não encontrado.', 'Erro');
                        return;
                    }
                    showConfirm('Ignorar Cadastro', 
                        `Tem certeza que deseja ignorar o cadastro "${companyToIgnore.razaoSocial || companyToIgnore.nomeFantasia || 'sem nome'}"? Esta ação não poderá ser desfeita.`, 
                        function() {
                            const index = registros.findIndex(item => item.cnpj === cnpj);
                            if (index !== -1) registros.splice(index, 1);
                            if (!ignorados.some(item => item.cnpj === cnpj)) {
                                ignorados.push(companyToIgnore);
                                ignoradosFiltrados = [...ignorados];
                                salvarStatusIgnorado(cnpj);
                            }
                            renderTable(registros);
                            renderIgnoradosTable();
                            detailsModal.style.display = 'none';
                            showWarning('Cadastro ignorado com sucesso!', 'Ignorado');
                        }
                    );
                };
            }

            detailsModal.style.display = 'flex';
        }

        // ========================================================================
        // ===== SEÇÃO DE SEGMENTOS =====
        // ========================================================================

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
            const term = searchTerm.toLowerCase().trim();

            segmentData.filter(seg => seg.nome.toLowerCase().includes(term)).forEach(seg => {
                const links = segmentoCnaeLinks.filter(link => link.segmentoId === seg.id);
                const qtdLinks = links.length;

                let tooltipContent = '';
                if (qtdLinks > 0) {
                    tooltipContent = '<div class="cnae-tooltip-content">';
                    links.forEach(link => {
                        const cnae = allCnaesCache.find(
                            c => String(c.codigo).trim() === String(link.cnaeCodigo).trim()
                        );
                        if (cnae) {
                            tooltipContent += `<div class="tooltip-item"><strong>${cnae.codigo}</strong> - ${cnae.descricao}</div>`;
                        } else {
                            tooltipContent += `<div class="tooltip-item"><strong>${link.cnaeCodigo}</strong> - (descrição não disponível)</div>`;
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

            document.addEventListener('click', function(e) {
                if (!e.target.closest('.cnae-tooltip')) {
                    document.querySelectorAll('.cnae-tooltip.open').forEach(t => t.classList.remove('open'));
                }
            });

            setupTooltips();
        }

        function setupTooltips() {
            document.querySelectorAll('.cnae-tooltip').forEach(tooltip => {
                const trigger = tooltip.querySelector('.tooltip-trigger');
                const content = tooltip.querySelector('.cnae-tooltip-content');
                if (!trigger || !content) return;

                let hideTimeout = null;

                function positionTooltip() {
                    const rect = trigger.getBoundingClientRect();
                    content.style.display = 'block';
                    content.classList.add('tooltip-visible');
                    const tooltipWidth = content.offsetWidth;
                    const tooltipHeight = content.offsetHeight;

                    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                    let top = rect.top - tooltipHeight - 12;

                    if (left < 10) left = 10;
                    if (left + tooltipWidth > window.innerWidth - 10) {
                        left = window.innerWidth - tooltipWidth - 10;
                    }
                    if (top < 10) top = 10;

                    content.style.left = `${left}px`;
                    content.style.top = `${top}px`;
                    content.style.right = 'auto';
                    content.style.bottom = 'auto';
                    content.style.transform = 'none';
                }

                function showTooltip() {
                    clearTimeout(hideTimeout);
                    if (content.parentElement !== document.body) {
                        document.body.appendChild(content);
                    }
                    tooltip.classList.add('open');
                    content.classList.add('tooltip-visible');
                    content.style.display = 'block';
                    positionTooltip();
                }

                function hideTooltip() {
                    hideTimeout = setTimeout(() => {
                        content.classList.remove('tooltip-visible');
                        content.style.display = 'none';
                        tooltip.classList.remove('open');
                    }, 100);
                }

                trigger.addEventListener('mouseenter', showTooltip);
                trigger.addEventListener('mouseleave', hideTooltip);
                content.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
                content.addEventListener('mouseleave', hideTooltip);
                trigger.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (content.classList.contains('tooltip-visible')) {
                        hideTooltip();
                    } else {
                        showTooltip();
                    }
                });

                window.addEventListener('resize', () => {
                    if (content.classList.contains('tooltip-visible')) positionTooltip();
                });
                window.addEventListener('scroll', () => {
                    if (content.classList.contains('tooltip-visible')) positionTooltip();
                }, true);
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
            const cnaeCodigo = String(linkCnaeSelect.value || '').trim();
            if (!cnaeCodigo) {
                showWarning('Selecione um CNAE para vincular.');
                return;
            }
            const cnae = allCnaesCache.find(c => String(c.codigo).trim() === cnaeCodigo);
            if (!cnae) {
                showWarning(`O CNAE ${cnaeCodigo} não foi encontrado na lista de CNAEs carregada.`);
                return;
            }
            const jaVinculado = currentLinkedCnaes.some(c => String(c.codigo).trim() === cnaeCodigo);
            if (jaVinculado) {
                showWarning(`O CNAE ${cnaeCodigo} já está vinculado a este segmento.`);
                return;
            }
            currentLinkedCnaes.push(cnae);
            renderLinkedCnaes();
            populateLinkSelect();
            linkCnaeSelect.value = '';
            refreshCustomSelect(linkCnaeSelect);
            setDirty(true);
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

        // ===== EVENTO DE SUBMIT DO FORMULÁRIO (SALVAR) =====
        document.getElementById('segmentoForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const nome = segmentNome.value.trim();
            if (!nome) {
                showWarning('Informe o nome do segmento.');
                return;
            }

            try {
                let segId = editingSegmentId;

                if (editingSegmentId !== null) {
                    await apiPut(`${API_URL}/segmentos/${editingSegmentId}`, { descricao: nome });
                    const seg = segmentData.find(s => s.id === editingSegmentId);
                    if (seg) seg.nome = nome;
                } else {
                    const novo = await apiPost(`${API_URL}/segmentos`, { descricao: nome });
                    segId = novo.codigo;
                    segmentData.push({ id: segId, nome });
                }

                if (segId) {
                    const cnaesAtuais = currentLinkedCnaes.map(c => c.codigo);
                    const cnaesOriginais = originalLinkedCnaes.map(c => c.codigo);

                    for (const cnae of cnaesOriginais) {
                        if (!cnaesAtuais.includes(cnae)) {
                            try {
                                await apiDelete(`${API_URL}/segmentos/${segId}/cnaes/${cnae}`);
                            } catch (e) {
                                console.warn(`Erro ao desvincular CNAE ${cnae}:`, e);
                            }
                        }
                    }

                    for (const cnae of currentLinkedCnaes) {
                        if (cnaesOriginais.includes(cnae.codigo)) continue;
                        try {
                            await apiPost(`${API_URL}/segmentos/${segId}/cnaes`, { cnae: cnae.codigo });
                        } catch (e) {
                            if (e.message !== 'HTTP 409') console.warn(`Erro ao vincular CNAE ${cnae.codigo}:`, e);
                        }
                    }
                }

                setDirty(false);
                originalLinkedCnaes = [...currentLinkedCnaes];
                resetSegmentForm();
                await carregarSegmentos();
                updateSegmentFilter();
                confirmModal.style.display = 'none';
                showWarning('Segmento salvo com sucesso!', 'Sucesso');
            } catch (error) {
                console.error("Erro ao salvar segmento:", error);
                showWarning('Erro ao salvar segmento. Detalhes no console (F12).');
            }
        });

        // ===== BOTÃO CANCELAR =====
        if (btnCancelSegment) {
            btnCancelSegment.addEventListener('click', function() {
                resetSegmentForm();
            });
        }

        // ===== BUSCA NA TABELA DE SEGMENTOS =====
        segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });

        // ===== EDITAR SEGMENTO =====
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
                const cnaesVinculados = await apiGet(`${API_URL}/segmentos/${id}/cnaes`);
                
                const cnaesCompletos = [];
                for (const cnae of cnaesVinculados) {
                    let cnaeCompleto = allCnaesCache.find(c => c.codigo === cnae.codigo);
                    if (!cnaeCompleto) {
                        cnaeCompleto = await buscarDetalhesCnae(cnae.codigo);
                        if (cnaeCompleto) {
                            allCnaesCache.push(cnaeCompleto);
                        } else {
                            cnaeCompleto = { codigo: cnae.codigo, descricao: 'CNAE não encontrado', full: cnae.codigo };
                        }
                    }
                    cnaesCompletos.push(cnaeCompleto);
                }

                currentLinkedCnaes = cnaesCompletos;
                originalLinkedCnaes = [...currentLinkedCnaes];
                renderLinkedCnaes();
                populateLinkSelect();
            } catch (e) {
                console.error("Erro ao carregar CNAEs vinculados:", e);
                currentLinkedCnaes = [];
                originalLinkedCnaes = [];
                renderLinkedCnaes();
                populateLinkSelect();
            }
            setDirty(true);
        }

        // ===== EXCLUIR SEGMENTO =====
        function excluirSegmento(id) {
            const seg = segmentData.find(s => s.id === id);
            if (!seg) {
                showWarning('Segmento não encontrado.');
                return;
            }
            showConfirm('Excluir Segmento', `Tem certeza que deseja excluir o segmento "${seg.nome}"?`, async function() {
                try {
                    await apiDelete(`${API_URL}/segmentos/${id}`);
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

        // ========================================================================
        // ===== FIM DA SEÇÃO DE SEGMENTOS =====
        // ========================================================================

        // ===== MODAIS =====
        function closeAllModals() {
            if (detailsModal && detailsModal.style.display === 'flex') detailsModal.style.display = 'none';
            if (genericModal && genericModal.style.display === 'flex') {
                genericModal.style.display = 'none';
                restoreActiveMenuItem();
            }
            if (confirmModal && confirmModal.style.display === 'flex') {
                confirmModal.style.display = 'none';
                restoreActiveMenuItem();
            }
            confirmCallback = null;
        }

        document.addEventListener('keydown', function(event) { if (event.key === 'Escape') closeAllModals(); });

        if (detailsClose) detailsClose.addEventListener('click', function() { detailsModal.style.display = 'none'; });
        if (genericClose) {
            genericClose.addEventListener('click', function() {
                genericModal.style.display = 'none';
                restoreActiveMenuItem();
            });
        }
        if (confirmClose) {
            confirmClose.addEventListener('click', function() {
                confirmModal.style.display = 'none';
                restoreActiveMenuItem();
            });
        }

        if (detailsModal) detailsModal.addEventListener('click', function(e) { if(e.target === this) detailsModal.style.display = 'none'; });
        if (genericModal) {
            genericModal.addEventListener('click', function(e) {
                if(e.target === this) {
                    genericModal.style.display = 'none';
                    restoreActiveMenuItem();
                }
            });
        }
        if (confirmModal) {
            confirmModal.addEventListener('click', function(e) {
                if(e.target === this) {
                    confirmModal.style.display = 'none';
                    restoreActiveMenuItem();
                }
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
                restoreActiveMenuItem();
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
            restoreActiveMenuItem();
        });

        btnConfirmCancel.addEventListener('click', function() {
            confirmModal.style.display = 'none';
            confirmCallback = null;
            btnConfirmDiscard.style.display = 'none';
            restoreActiveMenuItem();
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
            renderGenericList();
            genericModal.style.display = 'flex';
            saveActiveMenuItem();
            if (context === 'cnae') setActiveMenuItem('menu-cnaes');
            else if (context === 'municipio') setActiveMenuItem('menu-municipios');
            else if (context === 'natureza') setActiveMenuItem('menu-natureza');
        }

        function renderGenericList() {
            const items = currentItems;
            if (!items || items.length === 0) {
                genericModalBody.innerHTML = '<p style="padding:15px; text-align:center; color:#666;">Nenhum item encontrado.</p>';
                return;
            }
            let html = '<ul class="generic-list">';
            items.forEach((item, index) => {
                const card = formatAsCard(item);
                const cardHtml = card.sigla
                    ? `<div class="card-info"><span class="card-sigla">${card.sigla}</span><span class="card-nome" style="color:#9ca3af; font-size:12px;">${card.nome}</span></div>`
                    : `<div class="card-info"><span class="card-nome" style="font-weight:bold;">${card.nome}</span></div>`;
                html += `<li class="generic-card" data-index="${index}">${cardHtml}<button class="card-btn">OK</button></li>`;
            });
            html += '</ul>';
            genericModalBody.innerHTML = html;
        }

        let genericSearchDebounce;
        genericSearch.addEventListener('input', function() {
            clearTimeout(genericSearchDebounce);
            const searchTerm = this.value.toLowerCase().trim();

            if (currentGenericContext === 'cnae') {
                genericSearchDebounce = setTimeout(async () => {
                    if (!searchTerm) {
                        currentItems = [...originalItems];
                        renderGenericList();
                        return;
                    }
                    const resultados = await buscarCnaes(searchTerm);
                    currentItems = resultados;
                    renderGenericList();
                }, 250);
                return;
            }

            if (!searchTerm) {
                if (originalItems) {
                    currentItems = [...originalItems];
                    renderGenericList();
                }
                return;
            }
            const filteredItems = currentItems.filter(item => {
                const card = formatAsCard(item);
                return card.full.toLowerCase().includes(searchTerm) || card.nome.toLowerCase().includes(searchTerm);
            });
            currentItems = filteredItems;
            renderGenericList();
        });

        let originalItems = [];

        genericModalBody.addEventListener('click', function(e) {
            const li = e.target.closest('.generic-card');
            if (!li) return;

            genericModalBody.querySelectorAll('.generic-card').forEach(item => item.classList.remove('selected'));
            li.classList.add('selected');

            const isOkButton = e.target.classList.contains('card-btn') || e.target.closest('.card-btn');
            if (!isOkButton) return;

            const index = parseInt(li.dataset.index);
            const originalItem = currentItems[index];

            genericModal.style.display = 'none';

            switch (currentGenericContext) {
                case 'cnae':
                    if (originalItem && originalItem.codigo) {
                        filterCnaeInput.value = originalItem.full;
                        selectedCnaeCode = originalItem.codigo;
                        cnaeSuggestions.classList.remove('active');
                        showScreen('main');
                    }
                    break;

                case 'uf':
                    if (originalItem && originalItem.sigla) {
                        filterUf.value = originalItem.sigla;
                        refreshCustomSelect(filterUf);
                        showScreen('main');
                    }
                    break;

                case 'municipio':
                    if (originalItem && typeof originalItem === 'string') {
                        const idx = originalItem.lastIndexOf(' - ');
                        if (idx !== -1) {
                            const ddd = originalItem.substring(idx + 3).trim();
                            filterDdd.value = ddd;
                            refreshCustomSelect(filterDdd);
                            if (filterMunicipio) {
                                filterMunicipio.value = '';
                                refreshCustomSelect(filterMunicipio);
                            }
                            showScreen('main');
                        }
                    }
                    break;

                case 'natureza':
                    showScreen('main');
                    break;

                default:
                    showScreen('main');
                    break;
            }
        });

        // ===== MENUS DA SIDEBAR =====
        document.getElementById('menu-cnaes').addEventListener('click', async () => {
            const cnaesDaApi = await buscarCnaes('');
            originalItems = cnaesDaApi;
            openGenericModal('Pesquisa CNAE', 'Informe o CNAE:', cnaesDaApi, 'cnae');
        });

        document.getElementById('menu-municipios').addEventListener('click', async () => {
            if (municipiosCarregando) {
                openGenericModal('Pesquisa Município e DDDs', 'Carregando municípios e DDDs...', [], 'municipio');
                const resultado = await municipiosPromise;
                if (resultado) {
                    originalItems = resultado;
                    currentItems = resultado;
                    renderGenericList();
                    genericModalSubtitle.innerText = 'Informe o município ou DDD:';
                }
                return;
            }

            if (municipiosCache) {
                originalItems = municipiosCache;
                openGenericModal('Pesquisa Município e DDDs', 'Informe o município ou DDD:', municipiosCache, 'municipio');
                return;
            }

            municipiosCarregando = true;
            openGenericModal('Pesquisa Município e DDDs', 'Carregando municípios...', [], 'municipio');
            
            municipiosPromise = carregarMunicipiosDaAPI();
            const municipios = await municipiosPromise;
            
            if (municipios) {
                originalItems = municipios;
                currentItems = municipios;
                renderGenericList();
                genericModalSubtitle.innerText = 'Informe o município ou DDD:';
            }
        });

        document.getElementById('menu-natureza').addEventListener('click', async () => {
            const situacoes = await carregarSituacoesCadastrais();
            originalItems = situacoes;
            openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', situacoes, 'natureza');
        });

        // ===== EVENTOS DE NAVEGAÇÃO ENTRE TELAS =====

        document.getElementById('menu-dashboard').addEventListener('click', function() {
            if (segmentScreen.style.display === 'block') {
                if (isDirty) {
                    showUnsavedChangesModal(
                        'Deseja salvar antes de sair?',
                        function() {
                            document.getElementById('segmentoForm').requestSubmit();
                            showScreen('main');
                        },
                        function() {
                            resetSegmentForm();
                            showScreen('main');
                        }
                    );
                } else {
                    showScreen('main');
                }
                return;
            }

            if (mainScreen.style.display !== 'block') {
                showScreen('main');
            } else {
                setActiveMenuItem('menu-dashboard');
                closeAllModals();
            }
        });

        document.getElementById('menu-segmentos').addEventListener('click', function() {
            if (segmentScreen.style.display === 'block') {
                setActiveMenuItem('menu-segmentos');
                return;
            }
            showScreen('segment');
        });

        document.getElementById('menu-ignorados').addEventListener('click', function() {
            if (ignoradosScreen.style.display === 'block') {
                setActiveMenuItem('menu-ignorados');
                return;
            }
            showScreen('ignorados');
        });

        // ===== NOVO: EVENTO DO MENU MAPA =====
        document.getElementById('menu-mapa').addEventListener('click', function() {
            showScreen('mapa');
        });

        // ===== FILTRO DE IGNORADOS =====
        if (ignoradosSearch) {
            ignoradosSearch.addEventListener('input', function() {
                filtrarIgnorados();
            });
        }

        // ===== LIMPAR FILTROS =====
        function clearFilters() {
            filterUf.value = '';
            filterDdd.value = '';
            filterSegmento.value = '';
            filterCnaeInput.value = '';
            selectedCnaeCode = null;
            filterTipoCnae.value = 'PRINCIPAL';
            cnaeSuggestions.classList.remove('active');
            
            if (campoMunicipio) {
                campoMunicipio.style.display = 'none';
            }
            if (filterMunicipio) {
                filterMunicipio.innerHTML = '<option value="">Todos</option>';
                refreshCustomSelect(filterMunicipio);
            }

            refreshCustomSelect(filterUf);
            refreshCustomSelect(filterDdd);
            refreshCustomSelect(filterSegmento);
            refreshCustomSelect(filterTipoCnae);

            currentPage = 1;
            historicoCursors = [null];
            cursorAtual = null;
            registros = [];
            temMais = false;
            renderTable([]);
        }

        function changePage(direction, botao) {
            if (direction === 'next' && temMais) {
                currentPage++;
                pesquisarProspeccao(botao);
            } else if (direction === 'prev' && currentPage > 1) {
                showWarning('A navegação para páginas anteriores não é suportada pela API no momento. Use a pesquisa novamente para recomeçar.', 'Aviso');
            }
        }

        // Verifica se está em notebook e colapsa a sidebar
        function checkAndCollapseSidebar() {
            const width = window.innerWidth;
            if (width >= 769 && width <= 1366) {
                sidebar.classList.add('collapsed');
                // Atualiza o ícone do botão toggle se necessário
                const toggleBtn = document.getElementById('sidebar-toggle');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '<i class="fas fa-bars"></i>'; // ou outro ícone
                }
            }
        }

        // Chama no carregamento e no resize
        checkAndCollapseSidebar();
        window.addEventListener('resize', function() {
            // Se a largura sair da faixa, podemos remover a classe collapsed? Melhor manter a decisão do usuário.
            // Mas para simplificar, só aplicamos se estiver na faixa e a sidebar não tiver sido expandida manualmente?
            // Talvez seja melhor não forçar no resize para não atrapalhar.
        });

        // ===== EVENTOS =====
        btnSearch.addEventListener('click', function() {
            currentPage = 1;
            historicoCursors = [null];
            cursorAtual = null;
            pesquisarProspeccao();
        });

        btnClear.addEventListener('click', clearFilters);
        
        btnPrev.addEventListener('click', function() {
            if (currentPage > 1 && historicoCursors.length > 1) {
                historicoCursors.pop();
                currentPage--;
                const cursorAnterior = historicoCursors[historicoCursors.length - 1];
                cursorAtual = cursorAnterior;
                pesquisarProspeccao(this, cursorAnterior);
            } else {
                showWarning('Você já está na primeira página.', 'Aviso');
            }
        });

        btnNext.addEventListener('click', function() {
            if (temMais) {
                historicoCursors.push(cursorAtual);
                currentPage++;
                pesquisarProspeccao(this, cursorAtual);
            } else {
                showWarning('Você já está na última página.', 'Aviso');
            }
        });

        document.getElementById('filter-ddd').addEventListener('change', function() {
            // Não faz nada
        });

        // ===== INICIALIZAÇÃO =====
        if (campoMunicipio) {
            campoMunicipio.style.display = 'none';
        }

        initializeCustomSelects();

        carregarUFs();
        carregarDDDs();

        (async function carregarDadosIniciais() {
            await carregarCnaesIniciais();
            await carregarSegmentos();
            updateSegmentFilter();
            showScreen('main');
        })();

        carregarIgnorados();

        carregarMunicipiosDaAPI().then(municipios => {
            console.log("Municípios pré-carregados com sucesso!");
        });

        // ===== INICIALIZAÇÃO DO MAPA (FUNÇÃO) =====
        function initMap() {
            const mapContainer = document.getElementById('map');
            if (!mapContainer) return;

            // Cria o mapa centralizado no Brasil
            const map = L.map('map').setView([-14.2350, -51.9253], 4);

            // Adiciona camada de tiles (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Guardar instância para futuras manipulações
            window.mapInstance = map;
        }

    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
    }
});