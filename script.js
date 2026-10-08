document.addEventListener('DOMContentLoaded', async function() {
    console.log("Página carregada! O JavaScript está rodando.");

    const API_URL = '/api';
    const API_MAPAS = '/api/mapas';

    // ============================================================
    // CACHE EM localStorage (com TTL)
    // ============================================================
    const CACHE = {
        UFS:       { key: 'deltafrio_ufs_v2',        ttl: 24 * 60 * 60 * 1000 },
        DDDS:      { key: 'deltafrio_ddds_v2',       ttl: 24 * 60 * 60 * 1000 },
        CNAES:     { key: 'deltafrio_cnaes_v4',      ttl: 12 * 60 * 60 * 1000 },
        SEGMENTOS: { key: 'deltafrio_segmentos_v2',  ttl: 5 * 60 * 1000 },
        IGNORADOS: { key: 'deltafrio_ignorados_v2',  ttl: 5 * 60 * 1000 },
        MUNICIPIOS:{ key: 'deltafrio_municipios_v2', ttl: 24 * 60 * 60 * 1000 }
    };

    function cacheGet(chave) {
        try {
            const raw = localStorage.getItem(chave.key);
            if (!raw) return null;
            const { ts, dados } = JSON.parse(raw);
            if (Date.now() - ts > chave.ttl) { localStorage.removeItem(chave.key); return null; }
            return dados;
        } catch (e) { return null; }
    }
    function cacheSet(chave, dados) {
        try { localStorage.setItem(chave.key, JSON.stringify({ ts: Date.now(), dados })); }
        catch (e) { /* silencioso */ }
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function executarEmLotesComPausa(itens, limite, pausaMs, fn, onProgress) {
        let proximo = 0;
        let concluidos = 0;
        async function worker() {
            while (true) {
                const i = proximo++;
                if (i >= itens.length) return;
                try { await fn(itens[i], i); } catch (e) { /* silencioso */ }
                concluidos++;
                if (onProgress) onProgress(concluidos, itens.length);
                await sleep(pausaMs);
            }
        }
        await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
    }

    // ============================================================
    // ===== CONFIGURAÇÃO DOS VENDEDORES =====
    // ============================================================
    const VENDEDORES = [
        { id: 'v1', nome: 'Vendedor 1', cor: '#2463eb', regiao: 'Região Metropolitana',
          cidades: ['4314902', '4304606', '4318705', '4313409', '4309209'] },
        { id: 'v2', nome: 'Vendedor 2', cor: '#10b981', regiao: 'Serra Gaúcha',
          cidades: ['4305108', '4302105', '4307906', '4308607', '4322509'] },
        { id: 'v3', nome: 'Vendedor 3', cor: '#f59e0b', regiao: 'Sul / Fronteira',
          cidades: ['4314407', '4315602', '4301602', '4316907', '4321204'] }
    ];

    function normalizar(str) {
        return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase().trim();
    }

    function getVendedorDaCidade(props) {
        if (!props) return null;
        const codigo = String(props.codigoIbge || props.codigo || '').trim();
        const nome = normalizar(props.nome);
        for (const v of VENDEDORES) {
            for (const c of v.cidades) {
                const cStr = String(c).trim();
                if (codigo && codigo === cStr) return v;
                if (!/^\d+$/.test(cStr) && nome === normalizar(cStr)) return v;
            }
        }
        return null;
    }

    // ===== AUTENTICAÇÃO =====
    try {
        const respostaSessao = await fetch(`${API_URL}/sessao`, {
            method: 'GET', credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (respostaSessao.status === 401) {
            window.location.replace('/index.html');
            return;
        }
        if (respostaSessao.ok) {
            try { await respostaSessao.json(); } catch (e) {}
        }
    } catch (erro) {
        /* silencioso */
    }

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
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

        // ===== ELEMENTOS =====
        const mainScreen = document.getElementById('main-screen');
        const segmentScreen = document.getElementById('segment-screen');
        const ignoradosScreen = document.getElementById('ignorados-screen');
        const mapScreen = document.getElementById('map-screen');

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

        const btnSaveSegment = document.getElementById('btn-save-segment');
        const btnCancelSegment = document.getElementById('btn-cancel-segment');
        const segmentNome = document.getElementById('segment-nome');
        const segmentSearch = document.getElementById('segment-search');
        const segmentTableBody = document.getElementById('segment-table-body');
        const linkCnaeSelect = document.getElementById('link-cnae-select');
        const linkedCnaeList = document.getElementById('linked-cnae-list');
        const formTitle = document.getElementById('form-title');
        const segmentFormCard = document.getElementById('segment-form-card');
        const ignoradosSearch = document.getElementById('ignorados-search');

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
        let currentPage = 1, cursorAtual = null;
        let historicoCursors = [null], temMais = false, registros = [];
        let municipiosCache = null, municipiosCarregando = false, municipiosPromise = null;

        window.registros = registros;
        let isDirty = false;
        function setDirty(v) { isDirty = v; }

        function setActiveMenuItem(id) {
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            const t = document.getElementById(id); if (t) t.classList.add('active');
        }
        let previousMenuItemId = null;
        function saveActiveMenuItem() { const a = document.querySelector('.menu-item.active'); if (a) previousMenuItemId = a.id; }
        function restoreActiveMenuItem() { if (previousMenuItemId) { setActiveMenuItem(previousMenuItemId); previousMenuItemId = null; } }

        const registeredScreens = {};
        function registerScreen(nome, el) { if (el) registeredScreens[nome] = el; }

        function showScreen(screen) {
            [mainScreen, segmentScreen, ignoradosScreen, mapScreen, ...Object.values(registeredScreens)]
                .forEach(s => { if (s) s.style.display = 'none'; });

            if (screen === 'main') {
                mainScreen.style.display = 'block';
                setActiveMenuItem('menu-dashboard');
            } else if (screen === 'segment') {
                segmentScreen.style.display = 'block';
                setActiveMenuItem('menu-segmentos');
                resetSegmentForm(); renderSegmentTable(); populateLinkSelect();
            } else if (screen === 'ignorados') {
                ignoradosScreen.style.display = 'block';
                setActiveMenuItem('menu-ignorados');
                if (!ignoradosCarregados) carregarIgnorados(); else renderIgnoradosTable();
            } else if (screen === 'mapa') {
                mapScreen.style.display = 'block';
                setActiveMenuItem('menu-mapa');
                if (!window.mapInstance) initMap();
                else setTimeout(() => window.mapInstance.invalidateSize(), 100);
            } else if (registeredScreens[screen]) {
                registeredScreens[screen].style.display = 'block';
                if (screen === 'empresas')   setActiveMenuItem('menu-empresas');
                if (screen === 'vendedores') setActiveMenuItem('menu-vendedores');
            }
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async function () {
                if (!confirm('Deseja realmente sair?')) return;
                btnLogout.disabled = true;
                btnLogout.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    const csrf = document.cookie.split('; ').find(c => c.startsWith('login_delta_csrf='));
                    const csrfValor = csrf ? decodeURIComponent(csrf.split('=')[1]) : '';
                    await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: csrfValor ? { 'X-CSRF-Token': csrfValor } : {} });
                } catch (e) { /* silencioso */ }
                window.location.href = 'https://www.sistemas.deltafrio.com.br/central.html';
            });
        }

        function normalizarTexto(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

        // ============================================================
        // API
        // ============================================================
        async function apiGet(url) {
            const r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const t = await r.text(); if (!t) return {};
            try { return JSON.parse(t); } catch (e) { return {}; }
        }
        async function apiPost(url, body) {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) });
            const t = await r.text();
            if (!r.ok) { let msg = `HTTP ${r.status}`; try { msg = JSON.parse(t).message || msg; } catch (e) {} throw new Error(msg); }
            if (!t) return {}; try { return JSON.parse(t); } catch (e) { return {}; }
        }
        async function apiPut(url, body) {
            const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) });
            const t = await r.text(); if (!r.ok) throw new Error(`HTTP ${r.status}`);
            if (!t) return {}; try { return JSON.parse(t); } catch (e) { return {}; }
        }
        async function apiDelete(url) {
            const r = await fetch(url, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.status === 204 ? null : await r.json();
        }
        async function fetchFromAPI(urls) {
            for (const url of urls) {
                try {
                    const r = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    const d = await r.json();
                    return Array.isArray(d) ? d : (d.data || d.results || []);
                } catch (e) { /* silencioso */ }
            }
            return null;
        }

        // ============================================================
        // CARREGAMENTOS COM CACHE
        // ============================================================
        async function carregarUFs() {
            const cache = cacheGet(CACHE.UFS);
            if (cache) {
                ufData = cache;
                filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(u => `<option value="${u.sigla}">${u.sigla}</option>`).join('');
                refreshCustomSelect(filterUf);
                return;
            }
            try {
                const data = await apiGet(`${API_URL}/ufs`);
                ufData = data.map(i => ({ sigla: i.uf, nome: i.nome, full: i.ufNome || `${i.uf} - ${i.nome}` }));
                filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(u => `<option value="${u.sigla}">${u.sigla}</option>`).join('');
                refreshCustomSelect(filterUf);
                cacheSet(CACHE.UFS, ufData);
            } catch (e) { console.error("Erro UFs:", e); }
        }

        async function carregarDDDs() {
            const cache = cacheGet(CACHE.DDDS);
            if (cache) {
                const selectDDD = document.getElementById('filter-ddd');
                selectDDD.innerHTML = '<option value="">Todos</option>';
                cache.forEach(i => { const o = document.createElement('option'); o.value = i.ddd; o.textContent = `${i.ddd} - ${i.descricao}`; selectDDD.appendChild(o); });
                refreshCustomSelect(selectDDD);
                return;
            }
            try {
                const data = await apiGet(`${API_URL}/ddds`);
                const selectDDD = document.getElementById('filter-ddd');
                selectDDD.innerHTML = '<option value="">Todos</option>';
                data.forEach(i => { const o = document.createElement('option'); o.value = i.ddd; o.textContent = `${i.ddd} - ${i.descricao}`; selectDDD.appendChild(o); });
                refreshCustomSelect(selectDDD);
                cacheSet(CACHE.DDDS, data.map(i => ({ ddd: i.ddd, descricao: i.descricao })));
            } catch (e) { console.error("Erro DDDs:", e); }
        }

        async function carregarCnaesIniciais() {
            const cache = cacheGet(CACHE.CNAES);
            if (cache) {
                allCnaesCache = cache;
                cnaeData = allCnaesCache;
                populateLinkSelect();
                return;
            }
            try {
                const data = await fetchFromAPI([`${API_URL}/cnaes`]);
                if (data) {
                    allCnaesCache = data.map(i => ({
                        codigo: i.codigo || i.cnae || i.id,
                        descricao: i.descricao || i.nome || '',
                        full: i.codigoDescricao || `${i.codigo} - ${i.descricao}`
                    })).filter(c => c.codigo);
                    cnaeData = allCnaesCache;
                    populateLinkSelect();
                    cacheSet(CACHE.CNAES, allCnaesCache);
                }
            } catch (e) { console.error("Erro CNAEs iniciais:", e); allCnaesCache = []; }
        }

        async function buscarDetalhesCnae(codigo) {
            const c = String(codigo).trim();
            const cache = allCnaesCache.find(x => String(x.codigo).trim() === c);
            if (cache) return cache;
            try {
                const lista = await fetchFromAPI([`${API_URL}/cnaes?filtro=${encodeURIComponent(c)}`]);
                if (Array.isArray(lista)) {
                    const enc = lista.find(x => String(x.codigo ?? x.cnae ?? x.id).trim() === c);
                    if (enc) {
                        const r = { codigo: enc.codigo ?? enc.cnae ?? enc.id, descricao: enc.descricao ?? enc.nome ?? '', full: enc.codigoDescricao ?? `${enc.codigo ?? enc.cnae ?? enc.id} - ${enc.descricao ?? enc.nome ?? ''}` };
                        allCnaesCache.push(r); return r;
                    }
                }
            } catch (e) { /* silencioso */ }
            return null;
        }

        // ============================================================
        // SEGMENTOS
        // ============================================================
        async function carregarSegmentos() {
            if (segmentData.length > 0) { updateSegmentFilter(); renderSegmentTable(); return; }

            const cache = cacheGet(CACHE.SEGMENTOS);
            if (cache) {
                segmentData = cache.segmentData || [];
                segmentoCnaeLinks = cache.segmentoCnaeLinks || [];
                updateSegmentFilter(); renderSegmentTable(); populateLinkSelect();
                console.log(`✅ Segmentos do cache (${segmentData.length} itens, ${segmentoCnaeLinks.length} vínculos)`);
                return;
            }

            try {
                console.log('⏳ Carregando lista de segmentos...');
                const data = await apiGet(`${API_URL}/segmentos`);
                segmentData = data.map(i => ({ id: i.codigo, nome: i.descricao }));
                segmentoCnaeLinks = [];

                const cnaesVistos = new Set(allCnaesCache.map(x => String(x.codigo).trim()));

                await executarEmLotesComPausa(segmentData, 3, 20, async (seg) => {
                    try {
                        const cnaes = await apiGet(`${API_URL}/segmentos/${seg.id}/cnaes`);
                        cnaes.forEach(c => {
                            if (!segmentoCnaeLinks.some(l => l.segmentoId === seg.id && l.cnaeCodigo === c.codigo)) {
                                segmentoCnaeLinks.push({ segmentoId: seg.id, cnaeCodigo: c.codigo });
                            }
                            const cv = String(c.codigo).trim();
                            if (!cnaesVistos.has(cv)) {
                                cnaesVistos.add(cv);
                                allCnaesCache.push({
                                    codigo: cv,
                                    descricao: c.descricao || '',
                                    full: c.descricao ? `${cv} - ${c.descricao}` : cv
                                });
                            }
                        });
                    } catch (e) { /* silencioso */ }
                            });

                updateSegmentFilter();
                renderSegmentTable();
                populateLinkSelect();

                console.log(`✅ Segmentos carregados (${segmentData.length} itens, ${segmentoCnaeLinks.length} vínculos, ${allCnaesCache.length} CNAEs no cache)`);

                cacheSet(CACHE.SEGMENTOS, { segmentData, segmentoCnaeLinks });
                cacheSet(CACHE.CNAES, allCnaesCache);

            } catch (e) {
                console.error("Erro Segmentos:", e);
                if (filterSegmento) {
                    filterSegmento.innerHTML = '<option value="">Todos</option>';
                    refreshCustomSelect(filterSegmento);
                }
            }
        }

        async function buscarCnaes(filtro) {
            const data = await fetchFromAPI([`${API_URL}/cnaes?filtro=${encodeURIComponent(filtro)}`]);
            if (data) {
                const r = data.map(i => ({ codigo: i.codigo || i.cnae || i.id, descricao: i.descricao || i.nome || '', full: i.codigoDescricao || `${i.codigo} - ${i.descricao}` })).filter(c => c.codigo);
                if (filtro) { const nc = r.map(x => x.codigo); allCnaesCache = allCnaesCache.filter(c => !nc.includes(c.codigo)); allCnaesCache.push(...r); }
                return r;
            }
            if (allCnaesCache.length > 0) {
                return allCnaesCache.filter(i => { const t = normalizarTexto(filtro); return normalizarTexto(i.codigo).includes(t) || normalizarTexto(i.descricao).includes(t) || normalizarTexto(i.full).includes(t); });
            }
            return [];
        }

        // ============================================================
        // MUNICÍPIOS
        // ============================================================
        async function carregarMunicipiosDaAPI() {
            if (municipiosCache && municipiosCache.length > 0) return municipiosCache;

            const cache = cacheGet(CACHE.MUNICIPIOS);
            if (cache && cache.length > 0) {
                municipiosCache = cache;
                console.log(`✅ Municípios do cache (${cache.length})`);
                return municipiosCache;
            }

            if (municipiosCarregando && municipiosPromise) return municipiosPromise;

            municipiosCarregando = true;
            municipiosPromise = (async () => {
                try {
                    const dddData = await apiGet(`${API_URL}/ddds`);
                    const acumulado = [];

                    await executarEmLotesComPausa(dddData, 5, 20, async (d) => {
                        try {
                            const m = await apiGet(`${API_URL}/ddds/${d.ddd}/municipios`);
                            m.forEach(x => acumulado.push(`${x.municipio} - ${d.ddd}`));
                        } catch (e) { /* silencioso */ }
                    });

                    if (acumulado.length > 0) {
                        municipiosCache = [...new Set(acumulado)].sort();
                        cacheSet(CACHE.MUNICIPIOS, municipiosCache);
                    }
                    console.log(`✅ Municípios da API (${acumulado.length})`);
                    return municipiosCache || [];
                } catch (e) {
                    console.error("Erro municípios:", e);
                    return [];
                } finally {
                    municipiosCarregando = false;
                    municipiosPromise = null;
                }
            })();

            return municipiosPromise;
        }

        async function carregarSituacoesCadastrais() {
            try { const d = await apiGet(`${API_URL}/situacoes-cadastrais`); return d.map(i => `${i.codigoDescricao}`); }
            catch (e) { return ['ATIVA', 'BAIXADA', 'SUSPENSA']; }
        }

        // ============================================================
        // IGNORADOS
        // ============================================================
        async function carregarIgnorados() {
            if (ignoradosCarregados) return;

            const cache = cacheGet(CACHE.IGNORADOS);
            if (cache) {
                ignorados = cache;
                ignoradosCarregados = true;
                ignoradosFiltrados = [...ignorados];
                renderIgnoradosTable();
                return;
            }

            try {
                const r = await fetch(`${API_URL}/prospeccao/status-estabelecimentos?status=X`, { headers: { 'Accept': 'application/json' } });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const d = await r.json();
                ignorados = d.registros?.map(i => ({ cnpj: i.cnpj, cnpjFormatado: i.cnpjFormatado, razaoSocial: i.razaoSocial, nomeFantasia: i.nomeFantasia, uf: i.uf, municipio: i.municipio, telefone1: i.telefone1, telefone2: i.telefone2, email: i.email })) || [];
                ignoradosCarregados = true;
                ignoradosFiltrados = [...ignorados];
                renderIgnoradosTable();
                cacheSet(CACHE.IGNORADOS, ignorados);
            } catch (e) {
                console.error(e);
                ignorados = []; ignoradosFiltrados = [];
                renderIgnoradosTable();
            }
        }

        // ============================================================
        // CUSTOM SELECT
        // ============================================================
        function initializeCustomSelects() {
            document.querySelectorAll('select.input').forEach(select => {
                if (select.closest('.custom-select')) return;
                const wrapper = document.createElement('div'); wrapper.className = 'custom-select';
                select.parentNode.insertBefore(wrapper, select); wrapper.appendChild(select);
                const trigger = document.createElement('div'); trigger.className = 'custom-select-trigger';
                const textSpan = document.createElement('span'); textSpan.className = 'custom-select-text';
                textSpan.textContent = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : '';
                const icon = document.createElement('i'); icon.className = 'fas fa-chevron-down';
                trigger.appendChild(textSpan); trigger.appendChild(icon);
                const optionsContainer = document.createElement('div'); optionsContainer.className = 'custom-select-options';
                function renderOptions(ft = '') {
                    optionsContainer.innerHTML = ''; const termo = ft.toLowerCase().trim();
                    Array.from(select.options).forEach((o, i) => {
                        const d = document.createElement('div'); d.className = 'custom-option' + (o.selected ? ' selected' : ''); d.dataset.value = o.value; d.textContent = o.text;
                        if (termo && !o.text.toLowerCase().includes(termo) && !o.value.toLowerCase().includes(termo)) d.style.display = 'none'; else d.style.display = 'block';
                        d.addEventListener('click', function() { select.selectedIndex = i; textSpan.textContent = this.textContent; optionsContainer.querySelectorAll('.custom-option').forEach(x => x.classList.remove('selected')); this.classList.add('selected'); wrapper.classList.remove('open'); select.dispatchEvent(new Event('change')); inputBuffer = ''; });
                        optionsContainer.appendChild(d);
                    });
                }
                renderOptions(); wrapper.appendChild(trigger); wrapper.appendChild(optionsContainer);
                let inputBuffer = '';
                trigger.addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.custom-select.open').forEach(cs => { if (cs !== wrapper) cs.classList.remove('open'); }); wrapper.classList.toggle('open'); if (wrapper.classList.contains('open')) { inputBuffer = ''; renderOptions(''); } });
                trigger.setAttribute('tabindex', '0');
                trigger.addEventListener('keydown', e => {
                    if (!wrapper.classList.contains('open')) return;
                    if (e.key === 'Backspace') inputBuffer = inputBuffer.slice(0, -1);
                    else if (e.key === 'Escape') { wrapper.classList.remove('open'); inputBuffer = ''; renderOptions(''); return; }
                    else if (e.key === 'Enter') { const f = optionsContainer.querySelector('.custom-option:not([style*="display: none"])'); if (f) f.click(); return; }
                    else if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) inputBuffer += e.key; else return;
                    renderOptions(inputBuffer);
                });
                document.addEventListener('click', e => { if (!wrapper.contains(e.target)) { wrapper.classList.remove('open'); inputBuffer = ''; renderOptions(''); } });
                select.addEventListener('change', function() { const st = select.options[select.selectedIndex].text; textSpan.textContent = st; optionsContainer.querySelectorAll('.custom-option').forEach(x => x.classList.toggle('selected', x.dataset.value === select.value)); });
            });
        }
        function refreshCustomSelect(select) {
            if (!select) return; const wrapper = select.closest('.custom-select'); if (!wrapper) return;
            const textSpan = wrapper.querySelector('.custom-select-text'); const optionsContainer = wrapper.querySelector('.custom-select-options');
            optionsContainer.innerHTML = '';
            Array.from(select.options).forEach((o, i) => {
                const d = document.createElement('div'); d.className = 'custom-option' + (o.selected ? ' selected' : ''); d.dataset.value = o.value; d.textContent = o.text;
                d.addEventListener('click', function() { select.selectedIndex = i; textSpan.textContent = this.textContent; optionsContainer.querySelectorAll('.custom-option').forEach(x => x.classList.remove('selected')); this.classList.add('selected'); wrapper.classList.remove('open'); select.dispatchEvent(new Event('change')); });
                optionsContainer.appendChild(d);
            });
            if (select.options[select.selectedIndex]) textSpan.textContent = select.options[select.selectedIndex].text; else textSpan.textContent = '';
        }

        function formatarTelefone(ddd, numero) {
            if (!numero) return '-'; let n = String(numero).replace(/\D/g, ''); if (!n) return '-';
            let d = null; const ds = String(ddd || '').trim();
            if (ds && ds !== '0' && ds !== 'null') { const p = parseInt(ds, 10); if (!isNaN(p) && p > 0) d = p; }
            if (!d && n.length >= 10) { const p = parseInt(n.substring(0, 2), 10); if (p >= 10 && p <= 99) { d = p; n = n.substring(2); } }
            return d ? `(${d}) ${n}` : n;
        }

        async function salvarStatusIgnorado(cnpj) {
            try {
                await fetch(`${API_URL}/prospeccao/status-estabelecimentos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ cnpjCompleto: cnpj, status: 'X' }) });
                localStorage.removeItem(CACHE.IGNORADOS.key);
            } catch (e) { /* silencioso */ }
        }
        function removerStatusIgnorado(cnpj) { localStorage.removeItem(CACHE.IGNORADOS.key); }
        function filtrarIgnorados() {
            const t = ignoradosSearch ? ignoradosSearch.value.toLowerCase().trim() : '';
            ignoradosFiltrados = !t ? [...ignorados] : ignorados.filter(i => (i.cnpj && i.cnpj.includes(t)) || (i.cnpjFormatado && i.cnpjFormatado.includes(t)) || (i.razaoSocial && i.razaoSocial.toLowerCase().includes(t)) || (i.nomeFantasia && i.nomeFantasia.toLowerCase().includes(t)) || (i.uf && i.uf.toLowerCase().includes(t)) || (i.telefone1 && i.telefone1.includes(t)) || (i.municipio && i.municipio.toLowerCase().includes(t)));
            renderIgnoradosTable();
        }
        function renderTable(data) {
            tbody.innerHTML = '';
            if (!data.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">Nenhum resultado encontrado.</td></tr>`; recordsFooter.textContent = 'Nenhum registro'; btnPrev.disabled = true; btnNext.disabled = true; pageIndicator.textContent = 'Página 1'; return; }
            data.forEach(i => { tbody.innerHTML += `<tr><td>${i.cnpjFormatado}</td><td>${i.nomeFantasia || '-'}</td><td>${i.razaoSocial || '-'}</td><td><span class="status"><span class="status-dot-small"></span> ATIVA</span></td><td>${i.uf || '-'}</td><td>${formatarTelefone(i.ddd, i.telefone1)}</td><td><button class="btn-detail" data-cnpj="${i.cnpj}"><i class="fas fa-info-circle"></i> Detalhes</button></td></tr>`; });
            const lim = 50; const start = (currentPage - 1) * lim + 1; const end = start + data.length - 1;
            recordsFooter.textContent = `Exibindo ${start} - ${end}`; pageIndicator.textContent = `Página ${currentPage}`;
            btnPrev.disabled = currentPage === 1; btnNext.disabled = !temMais;
            if (!temMais && data.length < lim) btnNext.disabled = true;
            tbody.querySelectorAll('.btn-detail').forEach(b => b.addEventListener('click', function() { openDetailsModal(this.dataset.cnpj, false); }));
            setupCellTooltips();
        }
        function setupCellTooltips() {
            document.querySelectorAll('#main-screen .table-responsive tbody td, #ignorados-screen .table-responsive tbody td').forEach(td => {
                if (td.querySelector('button')) return; if (td._tooltipHandler) td.removeEventListener('mouseenter', td._tooltipHandler);
                const h = function() { this.title = this.scrollWidth > this.clientWidth ? this.textContent.trim() : ''; };
                td.addEventListener('mouseenter', h); td._tooltipHandler = h;
            });
        }
        function renderIgnoradosTable() {
            const tb = document.getElementById('ignorados-table-body'); const ft = document.getElementById('ignorados-footer');
            if (!tb || !ft) return; tb.innerHTML = ''; const show = ft.querySelector('.showing'); if (!show) return;
            const data = ignoradosFiltrados || [];
            if (!data.length) { tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">Nenhum registro ignorado.</td></tr>`; ft.style.display = 'none'; return; }
            ft.style.display = 'flex';
            data.forEach(i => { tb.innerHTML += `<tr><td>${i.cnpjFormatado}</td><td>${i.nomeFantasia || '-'}</td><td>${i.razaoSocial || '-'}</td><td><span class="status"><span class="status-dot-small"></span> ATIVA</span></td><td>${i.uf || '-'}</td><td>${formatarTelefone(i.ddd, i.telefone1)}</td><td><button class="btn-detail" data-cnpj="${i.cnpj}"><i class="fas fa-info-circle"></i> Detalhes</button></td></tr>`; });
            show.textContent = `Total: ${data.length} registros ignorados.`;
            tb.querySelectorAll('.btn-detail').forEach(b => b.addEventListener('click', function() { openDetailsModal(this.dataset.cnpj, true); }));
            setupCellTooltips();
        }
        function restaurarIgnoradoPorCnpj(cnpj) {
            const i = ignorados.findIndex(x => x.cnpj === cnpj); if (i === -1) { showWarning('Registro não encontrado.', 'Erro'); return; }
            ignorados.splice(i, 1); ignoradosFiltrados = [...ignorados]; removerStatusIgnorado(cnpj); renderIgnoradosTable(); detailsModal.style.display = 'none'; showWarning('Registro removido da lista de ignorados.', 'Restaurado');
        }

        let pesquisaController = null;
        async function pesquisarProspeccao(botao = null, cursor = null) {
            const btn = botao || btnSearch; const cursorEnv = (cursor !== undefined) ? cursor : cursorAtual;
            const uf = filterUf.value.trim(); const ddd = filterDdd.value; const seg = filterSegmento.value;
            let cnae = selectedCnaeCode; if (!cnae && filterCnaeInput.value.trim() !== '') { filterCnaeInput.value = ''; cnae = null; }
            const esc = filterTipoCnae ? filterTipoCnae.value : 'PRINCIPAL';
            const body = { uf: uf || null, ddd: uf ? null : (ddd || null), cnae: cnae || null, segmento: cnae ? null : (seg ? parseInt(seg) : null), escopoCnae: (cnae || seg) ? esc : null, ultimoCnpj: cursorEnv, limite: 50 };
            if (!body.uf && !body.ddd && !body.segmento && !body.cnae) { alert("Informe pelo menos um filtro."); return; }
            btn.disabled = true; const origB = btn.innerHTML; const origP = pageIndicator.innerHTML;
            if (btn.classList.contains('page-btn')) pageIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; else btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            if (pesquisaController) pesquisaController.abort(); pesquisaController = new AbortController();
            try {
                const r = await fetch(`${API_URL}/prospeccao/pesquisar`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body), signal: pesquisaController.signal });
                const t = await r.text(); if (!r.ok) { let m = `HTTP ${r.status}`; try { m = JSON.parse(t).message || m; } catch (e) {} throw new Error(m); }
                const d = t ? JSON.parse(t) : {}; registros = d.registros || []; temMais = d.temMais || false; cursorAtual = d.ultimoCnpj || null; renderTable(registros);
            } catch (e) { if (e.name !== 'AbortError') { console.error(e); alert("Erro ao pesquisar."); } if (btn.classList.contains('page-btn')) pageIndicator.innerHTML = origP; }
            finally { btn.disabled = false; btn.innerHTML = origB; pesquisaController = null; }
        }

        function openDetailsModal(cnpj, isIgn = false) {
            const list = isIgn ? ignorados : registros; const c = list.find(i => i.cnpj === cnpj); if (!c) return;
            document.getElementById('det-cnpj').innerText = c.cnpjFormatado; document.getElementById('det-razao').innerText = c.razaoSocial || '-'; document.getElementById('det-fantasia').innerText = c.nomeFantasia || '-';
            const sit = document.getElementById('det-situacao'); sit.innerText = 'ATIVA'; sit.className = 'badge badge-green'; document.getElementById('det-tipo').innerText = 'MATRIZ';
            document.getElementById('det-natureza').innerText = '-'; document.getElementById('det-porte').innerText = '-'; document.getElementById('det-capital').innerText = '-'; document.getElementById('det-inicio').innerText = '-'; document.getElementById('det-data-sit').innerText = '-'; document.getElementById('det-cnae').innerText = '-'; document.getElementById('det-logradouro').innerText = '-'; document.getElementById('det-numero').innerText = '-'; document.getElementById('det-complemento').innerText = '-'; document.getElementById('det-bairro').innerText = '-'; document.getElementById('det-cep').innerText = '-';
            document.getElementById('det-municipio').innerText = c.municipio || '-'; document.getElementById('det-tel1').innerText = formatarTelefone(c.ddd, c.telefone1); document.getElementById('det-tel2').innerText = formatarTelefone(c.ddd, c.telefone2); document.getElementById('det-email').innerText = c.email || '-';
            const btn = document.getElementById('btn-ignore-cadastro');
            if (isIgn) { btn.innerText = 'Restaurar'; btn.className = 'btn-secondary'; btn.onclick = () => restaurarIgnoradoPorCnpj(cnpj); }
            else { btn.innerText = 'Ignorar Cadastro'; btn.className = 'btn-secondary'; btn.onclick = () => { const co = registros.find(i => i.cnpj === cnpj); if (!co) { showWarning('Registro não encontrado.', 'Erro'); return; } showConfirm('Ignorar Cadastro', `Tem certeza que deseja ignorar "${co.razaoSocial || co.nomeFantasia || 'sem nome'}"?`, function() { const idx = registros.findIndex(i => i.cnpj === cnpj); if (idx !== -1) registros.splice(idx, 1); if (!ignorados.some(i => i.cnpj === cnpj)) { ignorados.push(co); ignoradosFiltrados = [...ignorados]; salvarStatusIgnorado(cnpj); } renderTable(registros); renderIgnoradosTable(); detailsModal.style.display = 'none'; showWarning('Cadastro ignorado!', 'Ignorado'); }); }; }
            detailsModal.style.display = 'flex';
        }

        window.novoSegmento = function() { if (isDirty) { showUnsavedChangesModal('Deseja salvar antes de criar um novo segmento?', function() { document.getElementById('segmentoForm').requestSubmit(); resetSegmentForm(); }, function() { resetSegmentForm(); }); } else resetSegmentForm(); };
        function resetSegmentForm() { segmentNome.value = ''; editingSegmentId = null; btnCancelSegment.style.display = 'none'; btnSaveSegment.innerText = 'Salvar segmento'; btnSaveSegment.classList.remove('editing-btn'); formTitle.innerText = 'Cadastro de segmento'; segmentFormCard.classList.remove('editing-mode'); linkedCnaeList.innerHTML = 'Nenhum CNAE vinculado.'; currentLinkedCnaes = []; originalLinkedCnaes = []; linkCnaeSelect.value = ''; refreshCustomSelect(linkCnaeSelect); setDirty(false); }
        function renderSegmentTable(st = '') {
            segmentTableBody.innerHTML = ''; const term = st.toLowerCase().trim();
            segmentData.filter(s => s.nome.toLowerCase().includes(term)).forEach(seg => {
                const links = segmentoCnaeLinks.filter(l => l.segmentoId === seg.id); const q = links.length;
                let tip = ''; if (q > 0) { tip = '<div class="cnae-tooltip-content">'; links.forEach(l => { const c = allCnaesCache.find(x => String(x.codigo).trim() === String(l.cnaeCodigo).trim()); tip += `<div class="tooltip-item"><strong>${c ? c.codigo : l.cnaeCodigo}</strong> - ${c ? c.descricao : 'Descrição não disponível'}</div>`; }); tip += '</div>'; }
                const tr = document.createElement('tr'); tr.innerHTML = `<td>${seg.nome}</td><td><div class="cnae-tooltip"><span class="tooltip-trigger">${q}</span>${tip}</div></td><td><div class="cell-actions"><button class="btn-table" data-action="edit" data-id="${seg.id}">Editar</button><button class="btn-table btn-delete" data-action="delete" data-id="${seg.id}">Excluir</button></div></td>`; segmentTableBody.appendChild(tr);
            });
            segmentTableBody.querySelectorAll('button[data-action]').forEach(b => b.addEventListener('click', function() { const id = parseInt(this.dataset.id); if (this.dataset.action === 'edit') editarSegmento(id); else excluirSegmento(id); }));
            document.addEventListener('click', e => { if (!e.target.closest('.cnae-tooltip')) document.querySelectorAll('.cnae-tooltip.open').forEach(t => t.classList.remove('open')); }); setupTooltips();
        }
        function setupTooltips() {
            document.querySelectorAll('.cnae-tooltip').forEach(tooltip => {
                const trigger = tooltip.querySelector('.tooltip-trigger'); const content = tooltip.querySelector('.cnae-tooltip-content');
                if (!trigger || !content) return;
                let hideTimeout = null;
                function positionTooltip() {
                    const rect = trigger.getBoundingClientRect(); content.style.display = 'block'; content.classList.add('tooltip-visible');
                    const tw = content.offsetWidth, th = content.offsetHeight;
                    let left = rect.left + (rect.width / 2) - (tw / 2), top = rect.top - th - 12;
                    if (left < 10) left = 10; if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10; if (top < 10) top = 10;
                    content.style.left = `${left}px`; content.style.top = `${top}px`; content.style.right = 'auto'; content.style.bottom = 'auto'; content.style.transform = 'none';
                }
                function show() { clearTimeout(hideTimeout); if (content.parentElement !== document.body) document.body.appendChild(content); tooltip.classList.add('open'); content.classList.add('tooltip-visible'); content.style.display = 'block'; positionTooltip(); }
                function hide() { hideTimeout = setTimeout(() => { content.classList.remove('tooltip-visible'); content.style.display = 'none'; tooltip.classList.remove('open'); }, 100); }
                trigger.addEventListener('mouseenter', show); trigger.addEventListener('mouseleave', hide);
                content.addEventListener('mouseenter', () => clearTimeout(hideTimeout)); content.addEventListener('mouseleave', hide);
                trigger.addEventListener('click', e => { e.stopPropagation(); if (content.classList.contains('tooltip-visible')) hide(); else show(); });
                window.addEventListener('resize', () => { if (content.classList.contains('tooltip-visible')) positionTooltip(); });
                window.addEventListener('scroll', () => { if (content.classList.contains('tooltip-visible')) positionTooltip(); }, true);
            });
        }
        function updateSegmentFilter() { let o = '<option value="">Todos</option>'; segmentData.forEach(s => o += `<option value="${s.id}">${s.nome}</option>`); if (filterSegmento) { filterSegmento.innerHTML = o; refreshCustomSelect(filterSegmento); } }
        function populateLinkSelect() { linkCnaeSelect.innerHTML = '<option value="">Selecione um CNAE...</option>'; allCnaesCache.forEach(c => { if (!currentLinkedCnaes.some(x => x.codigo === c.codigo)) { const opt = document.createElement('option'); opt.value = c.codigo; opt.innerText = c.full; linkCnaeSelect.appendChild(opt); } }); refreshCustomSelect(linkCnaeSelect); }
        window.vincularCNAE = function() { const cc = String(linkCnaeSelect.value || '').trim(); if (!cc) { showWarning('Selecione um CNAE.'); return; } const c = allCnaesCache.find(x => String(x.codigo).trim() === cc); if (!c) { showWarning(`CNAE ${cc} não encontrado.`); return; } if (currentLinkedCnaes.some(x => String(x.codigo).trim() === cc)) { showWarning('Já vinculado.'); return; } currentLinkedCnaes.push(c); renderLinkedCnaes(); populateLinkSelect(); linkCnaeSelect.value = ''; refreshCustomSelect(linkCnaeSelect); setDirty(true); };
        function renderLinkedCnaes() { linkedCnaeList.innerHTML = ''; if (!currentLinkedCnaes.length) { linkedCnaeList.innerHTML = 'Nenhum CNAE vinculado.'; return; } currentLinkedCnaes.forEach((c, i) => { const d = document.createElement('div'); d.classList.add('linked-item'); d.innerHTML = `<span>${c.codigo} - ${c.descricao}</span><button onclick="removerCNAE(${i})"><i class="fas fa-times"></i></button>`; linkedCnaeList.appendChild(d); }); }
        window.removerCNAE = function(i) { currentLinkedCnaes.splice(i, 1); renderLinkedCnaes(); populateLinkSelect(); setDirty(true); };
        document.getElementById('segmentoForm').addEventListener('submit', async function(e) {
            e.preventDefault(); const nome = segmentNome.value.trim(); if (!nome) { showWarning('Informe o nome do segmento.'); return; }
            try {
                let segId = editingSegmentId;
                if (editingSegmentId !== null) { await apiPut(`${API_URL}/segmentos/${editingSegmentId}`, { descricao: nome }); const s = segmentData.find(x => x.id === editingSegmentId); if (s) s.nome = nome; }
                else { const novo = await apiPost(`${API_URL}/segmentos`, { descricao: nome }); segId = novo.codigo; segmentData.push({ id: segId, nome }); }
                if (segId) {
                    const atual = currentLinkedCnaes.map(c => c.codigo); const orig = originalLinkedCnaes.map(c => c.codigo);
                    for (const c of orig) if (!atual.includes(c)) { try { await apiDelete(`${API_URL}/segmentos/${segId}/cnaes/${c}`); } catch (e) {} }
                    for (const c of currentLinkedCnaes) { if (orig.includes(c.codigo)) continue; try { await apiPost(`${API_URL}/segmentos/${segId}/cnaes`, { cnae: c.codigo }); } catch (e) {} }
                }
                setDirty(false); originalLinkedCnaes = [...currentLinkedCnaes]; resetSegmentForm();
                localStorage.removeItem(CACHE.SEGMENTOS.key);
                segmentData = []; segmentoCnaeLinks = [];
                await carregarSegmentos();
                updateSegmentFilter(); confirmModal.style.display = 'none'; showWarning('Segmento salvo com sucesso!', 'Sucesso');
            } catch (e) { console.error(e); showWarning('Erro ao salvar segmento.'); }
        });
        if (btnCancelSegment) btnCancelSegment.addEventListener('click', () => resetSegmentForm());
        segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });
        async function editarSegmento(id) {
            const seg = segmentData.find(s => s.id === id); if (!seg) return;
            editingSegmentId = id; segmentNome.value = seg.nome; btnSaveSegment.innerText = 'Atualizar segmento'; btnSaveSegment.classList.add('editing-btn'); btnCancelSegment.style.display = 'inline-block'; formTitle.innerText = 'Editar segmento'; segmentFormCard.classList.add('editing-mode');
            try { const cnaes = await apiGet(`${API_URL}/segmentos/${id}/cnaes`); const list = []; for (const c of cnaes) { let full = allCnaesCache.find(x => x.codigo === c.codigo); if (!full) { full = await buscarDetalhesCnae(c.codigo); if (full) allCnaesCache.push(full); else full = { codigo: c.codigo, descricao: 'CNAE não encontrado', full: c.codigo }; } list.push(full); } currentLinkedCnaes = list; originalLinkedCnaes = [...list]; renderLinkedCnaes(); populateLinkSelect(); }
            catch (e) { console.error(e); currentLinkedCnaes = []; originalLinkedCnaes = []; renderLinkedCnaes(); populateLinkSelect(); }
            setDirty(true);
        }
        function excluirSegmento(id) {
            const seg = segmentData.find(s => s.id === id); if (!seg) { showWarning('Segmento não encontrado.'); return; }
            showConfirm('Excluir Segmento', `Tem certeza que deseja excluir "${seg.nome}"?`, async function() {
                try { await apiDelete(`${API_URL}/segmentos/${id}`); segmentData = segmentData.filter(s => s.id !== id); segmentoCnaeLinks = segmentoCnaeLinks.filter(l => l.segmentoId !== id); localStorage.removeItem(CACHE.SEGMENTOS.key); renderSegmentTable(segmentSearch.value); updateSegmentFilter(); if (editingSegmentId === id) resetSegmentForm(); }
                catch (e) { showWarning('Erro ao excluir segmento.'); }
            });
        }

        function closeAllModals() { if (detailsModal?.style.display === 'flex') detailsModal.style.display = 'none'; if (genericModal?.style.display === 'flex') { genericModal.style.display = 'none'; restoreActiveMenuItem(); } if (confirmModal?.style.display === 'flex') { confirmModal.style.display = 'none'; restoreActiveMenuItem(); } confirmCallback = null; }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
        if (detailsClose) detailsClose.addEventListener('click', () => detailsModal.style.display = 'none');
        if (genericClose) genericClose.addEventListener('click', () => { genericModal.style.display = 'none'; restoreActiveMenuItem(); });
        if (confirmClose) confirmClose.addEventListener('click', () => { confirmModal.style.display = 'none'; restoreActiveMenuItem(); });
        if (detailsModal) detailsModal.addEventListener('click', function(e) { if (e.target === this) detailsModal.style.display = 'none'; });
        if (genericModal) genericModal.addEventListener('click', function(e) { if (e.target === this) { genericModal.style.display = 'none'; restoreActiveMenuItem(); } });
        if (confirmModal) confirmModal.addEventListener('click', function(e) { if (e.target === this) { confirmModal.style.display = 'none'; restoreActiveMenuItem(); } });
        function showConfirm(t, m, cb) { confirmTitle.innerText = t; confirmMessage.innerText = m; btnConfirmOk.innerText = 'Confirmar'; btnConfirmCancel.innerText = 'Cancelar'; btnConfirmDiscard.style.display = 'none'; confirmCallback = cb; btnConfirmCancel.style.display = 'inline-block'; confirmModal.style.display = 'flex'; }
        function showWarning(m, t = 'Aviso') { confirmTitle.innerText = t; confirmMessage.innerText = m; btnConfirmOk.innerText = 'OK'; btnConfirmCancel.style.display = 'none'; btnConfirmDiscard.style.display = 'none'; confirmCallback = null; confirmModal.style.display = 'flex'; }
        function showUnsavedChangesModal(m, onSave, onDiscard) { confirmTitle.innerText = 'Alterações não salvas'; confirmMessage.innerText = m; btnConfirmOk.innerText = 'Salvar'; btnConfirmCancel.innerText = 'Cancelar'; btnConfirmDiscard.style.display = 'inline-block'; confirmCallback = onSave; confirmModal.style.display = 'flex'; btnConfirmDiscard.onclick = function() { if (onDiscard) onDiscard(); confirmModal.style.display = 'none'; btnConfirmDiscard.style.display = 'none'; btnConfirmCancel.style.display = 'inline-block'; btnConfirmOk.innerText = 'Confirmar'; confirmCallback = null; restoreActiveMenuItem(); }; }
        btnConfirmOk.addEventListener('click', function() { if (confirmCallback) { const cb = confirmCallback; confirmCallback = null; cb(); } confirmModal.style.display = 'none'; btnConfirmCancel.style.display = 'inline-block'; btnConfirmOk.innerText = 'Confirmar'; btnConfirmDiscard.style.display = 'none'; restoreActiveMenuItem(); });
        btnConfirmCancel.addEventListener('click', function() { confirmModal.style.display = 'none'; confirmCallback = null; btnConfirmDiscard.style.display = 'none'; restoreActiveMenuItem(); });

        let debounceTimer;
        filterCnaeInput.addEventListener('input', function() {
            clearTimeout(debounceTimer); const t = this.value.trim();
            if (!t) { cnaeSuggestions.classList.remove('active'); selectedCnaeCode = null; return; }
            debounceTimer = setTimeout(async () => { const r = await buscarCnaes(t); renderSuggestions(r); }, 250);
        });
        function renderSuggestions(r) {
            cnaeSuggestions.innerHTML = ''; if (!r.length) { cnaeSuggestions.classList.remove('active'); return; }
            r.forEach(i => { const d = document.createElement('div'); d.classList.add('autocomplete-item'); d.innerHTML = `<span class="code">${i.codigo}</span> <span class="desc">- ${i.descricao}</span>`; d.addEventListener('click', function() { filterCnaeInput.value = `${i.codigo} - ${i.descricao}`; selectedCnaeCode = i.codigo; cnaeSuggestions.classList.remove('active'); }); cnaeSuggestions.appendChild(d); });
            cnaeSuggestions.classList.add('active');
        }
        document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-container')) cnaeSuggestions.classList.remove('active'); });

        function formatAsCard(item) { if (item && typeof item === 'object' && item.codigo) return { sigla: item.codigo, nome: item.descricao, full: item.full || `${item.codigo} - ${item.descricao}` }; if (typeof item === 'string') return { sigla: '', nome: item, full: item }; return { sigla: item.sigla || '', nome: item.nome || '', full: item.full || `${item.sigla} - ${item.nome}` }; }
        function openGenericModal(t, s, items, ctx) { genericModalTitle.innerText = t; genericModalSubtitle.innerText = s; currentGenericContext = ctx || null; currentItems = items; genericSearch.value = ''; renderGenericList(); genericModal.style.display = 'flex'; saveActiveMenuItem(); if (ctx === 'cnae') setActiveMenuItem('menu-cnaes'); else if (ctx === 'municipio') setActiveMenuItem('menu-municipios'); else if (ctx === 'natureza') setActiveMenuItem('menu-natureza'); }
        function renderGenericList() {
            const items = currentItems; if (!items || !items.length) { genericModalBody.innerHTML = '<p style="padding:15px;text-align:center;color:#666;">Nenhum item encontrado.</p>'; return; }
            let html = '<ul class="generic-list">'; items.forEach((item, i) => { const c = formatAsCard(item); const ch = c.sigla ? `<div class="card-info"><span class="card-sigla">${c.sigla}</span><span class="card-nome" style="color:#9ca3af;font-size:12px;">${c.nome}</span></div>` : `<div class="card-info"><span class="card-nome" style="font-weight:bold;">${c.nome}</span></div>`; html += `<li class="generic-card" data-index="${i}">${ch}<button class="card-btn">OK</button></li>`; }); html += '</ul>'; genericModalBody.innerHTML = html;
        }
        let genericSearchDebounce, originalItems = [];
        genericSearch.addEventListener('input', function() {
            clearTimeout(genericSearchDebounce); const st = this.value.toLowerCase().trim();
            if (currentGenericContext === 'cnae') { genericSearchDebounce = setTimeout(async () => { if (!st) { currentItems = [...originalItems]; renderGenericList(); return; } const r = await buscarCnaes(st); currentItems = r; renderGenericList(); }, 250); return; }
            if (!st) { if (originalItems) { currentItems = [...originalItems]; renderGenericList(); } return; }
            currentItems = currentItems.filter(i => { const c = formatAsCard(i); return c.full.toLowerCase().includes(st) || c.nome.toLowerCase().includes(st); }); renderGenericList();
        });
        genericModalBody.addEventListener('click', function(e) {
            const li = e.target.closest('.generic-card'); if (!li) return;
            genericModalBody.querySelectorAll('.generic-card').forEach(x => x.classList.remove('selected')); li.classList.add('selected');
            const isOk = e.target.classList.contains('card-btn') || e.target.closest('.card-btn'); if (!isOk) return;
            const i = parseInt(li.dataset.index); const item = currentItems[i]; genericModal.style.display = 'none';
            switch (currentGenericContext) {
                case 'cnae': if (item?.codigo) { filterCnaeInput.value = item.full; selectedCnaeCode = item.codigo; cnaeSuggestions.classList.remove('active'); showScreen('main'); } break;
                case 'uf': if (item?.sigla) { filterUf.value = item.sigla; refreshCustomSelect(filterUf); showScreen('main'); } break;
                case 'municipio': if (typeof item === 'string') { const idx = item.lastIndexOf(' - '); if (idx !== -1) { filterDdd.value = item.substring(idx + 3).trim(); refreshCustomSelect(filterDdd); if (filterMunicipio) { filterMunicipio.value = ''; refreshCustomSelect(filterMunicipio); } showScreen('main'); } } break;
                default: showScreen('main');
            }
        });

        document.getElementById('menu-cnaes').addEventListener('click', async () => { const c = await buscarCnaes(''); originalItems = c; openGenericModal('Pesquisa CNAE', 'Informe o CNAE:', c, 'cnae'); });
        document.getElementById('menu-municipios').addEventListener('click', async () => {
            if (municipiosCache && municipiosCache.length > 0) {
                originalItems = municipiosCache; currentItems = municipiosCache;
                openGenericModal('Pesquisa Município e DDDs', 'Informe o município ou DDD:', municipiosCache, 'municipio');
                return;
            }
            openGenericModal('Pesquisa Município e DDDs', 'Carregando...', [], 'municipio');
            const m = await carregarMunicipiosDaAPI();
            if (m && m.length > 0) {
                originalItems = m; currentItems = m; renderGenericList();
                genericModalSubtitle.innerText = 'Informe o município ou DDD:';
            } else {
                genericModalBody.innerHTML = '<p style="padding:15px;text-align:center;color:#666;">Nenhum município disponível.</p>';
                genericModalSubtitle.innerText = 'Falha ao carregar municípios.';
            }
        });
        document.getElementById('menu-natureza').addEventListener('click', async () => { const s = await carregarSituacoesCadastrais(); originalItems = s; openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', s, 'natureza'); });
        document.getElementById('menu-dashboard').addEventListener('click', function() { if (segmentScreen.style.display === 'block') { if (isDirty) { showUnsavedChangesModal('Deseja salvar antes de sair?', function() { document.getElementById('segmentoForm').requestSubmit(); showScreen('main'); }, function() { resetSegmentForm(); showScreen('main'); }); } else showScreen('main'); return; } if (mainScreen.style.display !== 'block') showScreen('main'); else { setActiveMenuItem('menu-dashboard'); closeAllModals(); } });
        document.getElementById('menu-segmentos').addEventListener('click', function() { if (segmentScreen.style.display === 'block') { setActiveMenuItem('menu-segmentos'); return; } showScreen('segment'); });
        document.getElementById('menu-ignorados').addEventListener('click', function() { if (ignoradosScreen.style.display === 'block') { setActiveMenuItem('menu-ignorados'); return; } showScreen('ignorados'); });
        document.getElementById('menu-mapa').addEventListener('click', function() { showScreen('mapa'); });
        if (ignoradosSearch) ignoradosSearch.addEventListener('input', () => filtrarIgnorados());

        function clearFilters() {
            filterUf.value = ''; filterDdd.value = ''; filterSegmento.value = ''; filterCnaeInput.value = ''; selectedCnaeCode = null; filterTipoCnae.value = 'PRINCIPAL'; cnaeSuggestions.classList.remove('active');
            if (campoMunicipio) campoMunicipio.style.display = 'none';
            if (filterMunicipio) { filterMunicipio.innerHTML = '<option value="">Todos</option>'; refreshCustomSelect(filterMunicipio); }
            refreshCustomSelect(filterUf); refreshCustomSelect(filterDdd); refreshCustomSelect(filterSegmento); refreshCustomSelect(filterTipoCnae);
            currentPage = 1; historicoCursors = [null]; cursorAtual = null; registros = []; temMais = false; renderTable([]);
            if (window.mapInstance && typeof window.loadMapData === 'function') { window.mapFilters.uf = null; window.loadMapData(); }
        }
        function checkAndCollapseSidebar() { if (window.innerWidth >= 769 && window.innerWidth <= 1366) sidebar.classList.add('collapsed'); }
        checkAndCollapseSidebar();
        btnSearch.addEventListener('click', function() { currentPage = 1; historicoCursors = [null]; cursorAtual = null; pesquisarProspeccao(); });
        btnClear.addEventListener('click', clearFilters);
        btnPrev.addEventListener('click', function() { if (currentPage > 1 && historicoCursors.length > 1) { historicoCursors.pop(); currentPage--; cursorAtual = historicoCursors[historicoCursors.length - 1]; pesquisarProspeccao(this, cursorAtual); } else showWarning('Você já está na primeira página.', 'Aviso'); });
        btnNext.addEventListener('click', function() { if (temMais) { historicoCursors.push(cursorAtual); currentPage++; pesquisarProspeccao(this, cursorAtual); } else showWarning('Você já está na última página.', 'Aviso'); });
        document.getElementById('filter-ddd').addEventListener('change', function() {});

        // ============================================================
        // BOOT
        // ============================================================
        if (campoMunicipio) campoMunicipio.style.display = 'none';
        initializeCustomSelects();
        showScreen('main');

        (async function boot() {
            try {
                console.log('⏳ [boot] Carregando UFs, DDDs e CNAEs...');
                await Promise.all([carregarUFs(), carregarDDDs(), carregarCnaesIniciais()]);

                console.log('⏳ [boot] Carregando segmentos...');
                await carregarSegmentos();
                updateSegmentFilter();

                console.log('⏳ [boot] Carregando ignorados...');
                await carregarIgnorados();

                console.log('✅ [boot] Sistema pronto.');

                // Pré-carrega municípios em background
                console.log('⏳ [background] Pré-carregando municípios...');
                carregarMunicipiosDaAPI()
                    .then(m => console.log(`✅ [background] Municípios pré-carregados: ${m ? m.length : 0}`))
                    .catch(e => { /* silencioso */ });

            } catch (e) {
                console.error('❌ Erro no boot:', e);
            }
        })();

        // ========================================================================
        // ===== MAPA =====
        // ========================================================================
        window.mapFilters = { uf: null };

        let terraLayer = null;
        let stateLayer = null;
        let municipiosLayer = null;
        const vendedoresLayers = {};

        const TERRA_CACHE_KEY = 'deltafrio_terra_geojson_v1';
        const UFS_CACHE_KEY = 'deltafrio_ufs_geojson_v18';
        const MUN_CACHE_KEY = 'deltafrio_municipios_geojson_v10';
        let terraGeojsonCache = null;
        let ufsGeojsonCache = null;
        let municipiosGeojsonCache = null;

        function isDark() { return document.body.classList.contains('dark-mode'); }

        function getTerraStyle() { const d = isDark(); return { color: d ? '#64748b' : '#94a3b8', weight: 0.6, opacity: 0.9, fill: true, fillColor: d ? '#1e293b' : '#f1f5f9', fillOpacity: 1 }; }
        function getStateStyle() { const d = isDark(); return { color: d ? '#94a3b8' : '#475569', weight: 1.5, opacity: 1, fill: true, fillColor: d ? '#334155' : '#e2e8f0', fillOpacity: 1 }; }
        function getMunicipalityStyle() { const d = isDark(); return { color: d ? '#475569' : '#94a3b8', weight: 0.4, opacity: 0.6, fill: false }; }
        function getVendedorStyle(vendedor) { return { color: vendedor.cor, weight: 1.5, opacity: 0.95, fill: true, fillColor: vendedor.cor, fillOpacity: 0.75 }; }
        function getVendedorHoverStyle(vendedor) { return { color: vendedor.cor, weight: 3, opacity: 1, fill: true, fillColor: vendedor.cor, fillOpacity: 0.95 }; }

        async function carregarTerraGeoJSON() {
            if (terraGeojsonCache) return terraGeojsonCache;
            try { const c = localStorage.getItem(TERRA_CACHE_KEY); if (c) { terraGeojsonCache = JSON.parse(c); return terraGeojsonCache; } } catch (e) {}
            try {
                const r = await fetch('https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json');
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                terraGeojsonCache = await r.json();
                try { localStorage.setItem(TERRA_CACHE_KEY, JSON.stringify(terraGeojsonCache)); } catch (e) {}
                return terraGeojsonCache;
            } catch (e) { console.error('Erro terra:', e); return null; }
        }
        async function carregarUfsGeoJSON() {
            if (ufsGeojsonCache) return ufsGeojsonCache;
            try { const c = localStorage.getItem(UFS_CACHE_KEY); if (c) { ufsGeojsonCache = JSON.parse(c); return ufsGeojsonCache; } } catch (e) {}
            try {
                const r = await fetch(`${API_MAPAS}/ufs`, { headers: { 'Accept': 'application/json' } });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                ufsGeojsonCache = await r.json();
                try { localStorage.setItem(UFS_CACHE_KEY, JSON.stringify(ufsGeojsonCache)); } catch (e) {}
                return ufsGeojsonCache;
            } catch (e) { console.error('Erro UFs:', e); return null; }
        }
        async function carregarMunicipiosGeoJSON() {
            if (municipiosGeojsonCache) return municipiosGeojsonCache;
            try { const c = localStorage.getItem(MUN_CACHE_KEY); if (c) { municipiosGeojsonCache = JSON.parse(c); return municipiosGeojsonCache; } } catch (e) {}
            try {
                const r = await fetch(`${API_MAPAS}/municipios`, { headers: { 'Accept': 'application/json' } });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                municipiosGeojsonCache = await r.json();
                try { localStorage.setItem(MUN_CACHE_KEY, JSON.stringify(municipiosGeojsonCache)); } catch (e) { /* silencioso */ }
                return municipiosGeojsonCache;
            } catch (e) { console.error('Erro municípios:', e); return null; }
        }

        function criarCamadaTerra(geojson) { return geojson ? L.geoJSON(geojson, { style: () => getTerraStyle(), interactive: false }) : null; }
        function criarCamadaEstados(geojson) { return geojson ? L.geoJSON(geojson, { style: () => getStateStyle(), interactive: false }) : null; }
        function criarCamadaMunicipios(geojson) { return geojson ? L.geoJSON(geojson, { style: () => getMunicipalityStyle(), interactive: false }) : null; }
        function criarCamadaVendedor(geojson, vendedor) {
            if (!geojson || !geojson.features) return null;
            const features = geojson.features.filter(f => { const v = getVendedorDaCidade(f.properties || {}); return v && v.id === vendedor.id; });
            if (!features.length) return null;
            return L.geoJSON({ type: 'FeatureCollection', features }, {
                style: () => getVendedorStyle(vendedor),
                onEachFeature: (f, l) => {
                    const nome = f.properties?.nome || f.properties?.municipio || 'Cidade';
                    l.bindTooltip(nome, { sticky: true, direction: 'top', offset: [0, -8], className: 'vendedor-tooltip', opacity: 1 });
                    l.on('mouseover', function() { this.setStyle(getVendedorHoverStyle(vendedor)); this.bringToFront(); });
                    l.on('mouseout', function() { this.setStyle(getVendedorStyle(vendedor)); });
                }
            });
        }

        window.loadMapData = function() {
            const map = window.mapInstance;
            if (!map || !stateLayer) return;
            if (window.mapFilters.uf) {
                const uf = window.mapFilters.uf.toUpperCase();
                const feats = stateLayer.getLayers().filter(l => (l.feature.properties?.uf || '').toUpperCase() === uf);
                if (feats.length) { map.fitBounds(L.featureGroup(feats).getBounds(), { padding: [20, 20] }); return; }
            }
            map.fitBounds(stateLayer.getBounds(), { padding: [20, 20] });
        };

        // ============================================================
        // Stats dos vendedores
        // ------------------------------------------------------------
        // Usa POST /api/municipios/populacao/total com os códigos
        // IBGE das cidades de cada vendedor para retornar população.
        // ============================================================
        async function buscarStatsVendedores() {
            const stats = {};

            for (const v of VENDEDORES) {
                stats[v.id] = { cidades: v.cidades.length, pessoas: 0 };

                if (!v.cidades || !v.cidades.length) continue;

                try {
                    const r = await fetch(`${API_URL}/municipios/populacao/total`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({ codigosIbge: v.cidades.map(String) })
                    });

                    if (r.ok) {
                        const dados = await r.json();
                        stats[v.id].pessoas = Number(dados?.populacaoTotal || 0);
                    }
                } catch (e) { /* silencioso */ }
            }

            return stats;
        }

        async function renderStatsVendedores(map) {
            const container = document.getElementById('vendedores-stats');
            if (!container || !map) return;
            const stats = await buscarStatsVendedores();
            let html = '';
            VENDEDORES.forEach(v => {
                const s = stats[v.id] || { cidades: v.cidades.length, pessoas: 0 };
                const pessoasFmt = Number(s.pessoas || 0).toLocaleString('pt-BR');
                html += `
                    <label class="vendedor-stat" data-vendedor="${v.id}" style="--vendedor-cor:${v.cor};">
                        <input type="checkbox" class="vendedor-stat-checkbox" data-vendedor="${v.id}">
                        <div class="vendedor-stat-body">
                            <div class="vendedor-stat-header">
                                <span class="vendedor-stat-color" style="background:${v.cor};"></span>
                                <span class="vendedor-stat-nome">${v.nome}</span>
                            </div>
                            <div class="vendedor-stat-numbers">
                                <div class="vendedor-stat-num"><strong>${s.cidades}</strong><small>cidades</small></div>
                                <div class="vendedor-stat-num"><strong>${pessoasFmt}</strong><small>pessoas</small></div>
                            </div>
                        </div>
                    </label>
                `;
            });
            container.innerHTML = html;
            container.querySelectorAll('.vendedor-stat-checkbox').forEach(cb => {
                cb.addEventListener('change', function(e) {
                    e.stopPropagation();
                    const card = this.closest('.vendedor-stat');
                    const layer = vendedoresLayers[this.dataset.vendedor];
                    if (this.checked) { card.classList.add('active'); if (layer) layer.addTo(map); }
                    else { card.classList.remove('active'); if (layer) map.removeLayer(layer); }
                });
            });
        }

        async function initMap() {
            const container = document.getElementById('map');
            if (!container) return;
            const map = L.map('map', { minZoom: 3, maxZoom: 13, zoomControl: true, attributionControl: false }).setView([-14.2350, -51.9253], 4);
            window.mapInstance = map;

            const terra = await carregarTerraGeoJSON();
            if (terra) { terraLayer = criarCamadaTerra(terra); if (terraLayer) terraLayer.addTo(map); }
            const ufs = await carregarUfsGeoJSON();
            if (ufs) { stateLayer = criarCamadaEstados(ufs); if (stateLayer) { stateLayer.addTo(map); map.fitBounds(stateLayer.getBounds(), { padding: [20, 20] }); } }
            const mun = await carregarMunicipiosGeoJSON();
            if (mun) {
                municipiosLayer = criarCamadaMunicipios(mun);
                if (municipiosLayer) municipiosLayer.addTo(map);
                VENDEDORES.forEach(v => { const layer = criarCamadaVendedor(mun, v); if (layer) vendedoresLayers[v.id] = layer; });
            }

            const origFilterUf = document.getElementById('filter-uf');
            if (origFilterUf) {
                const origOnChange = origFilterUf.onchange;
                origFilterUf.onchange = function(e) {
                    if (origOnChange) origOnChange.call(this, e);
                    window.mapFilters.uf = this.value || null;
                    window.loadMapData();
                };
            }

            const btnTema = document.getElementById('btn-dark-mode');
            if (btnTema) {
                btnTema.addEventListener('click', function() {
                    setTimeout(() => {
                        if (terraLayer) terraLayer.setStyle(() => getTerraStyle());
                        if (stateLayer) stateLayer.setStyle(() => getStateStyle());
                        if (municipiosLayer) municipiosLayer.setStyle(() => getMunicipalityStyle());
                        VENDEDORES.forEach(v => { const l = vendedoresLayers[v.id]; if (l) l.setStyle(() => getVendedorStyle(v)); });
                    }, 100);
                });
            }
            renderStatsVendedores(map);
        }
        window.initMap = initMap;

        window.AppCore = {
            apiGet, apiPost, apiPut, apiDelete,
            showScreen, setActiveMenuItem, registerScreen,
            showWarning, showConfirm,
            refreshCustomSelect, formatarTelefone,
            API_URL,
            getMapInstance: () => window.mapInstance,
            getVendedores: () => VENDEDORES,
        };
        console.log('✅ [AppCore] SDK disponível para módulos externos.');

    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
    }
});