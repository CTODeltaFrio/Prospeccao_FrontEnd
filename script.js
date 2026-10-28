document.addEventListener('DOMContentLoaded', async function() {
    console.log("Página carregada! O JavaScript está rodando.");

    const API_URL = '/api';
    const API_MAPAS = '/api/mapas';

    // ============================================================
    // ✅ APPCORE FALLBACK
    // ============================================================
    const criarAppCoreFallback = () => ({
        apiGet: async () => { throw new Error('AppCore não inicializado'); },
        apiPost: async () => { throw new Error('AppCore não inicializado'); },
        apiPut: async () => { throw new Error('AppCore não inicializado'); },
        apiPatch: async () => { throw new Error('AppCore não inicializado'); },
        apiDelete: async () => { throw new Error('AppCore não inicializado'); },
        apiGetEnvelope: async () => null,
        obterCsrf: () => { const m = document.cookie.split('; ').find(c => c.startsWith('login_delta_csrf=')); return m ? decodeURIComponent(m.split('=')[1]) : ''; },
        showScreen: () => {}, setActiveMenuItem: () => {}, registerScreen: () => {},
        showWarning: (msg, t) => alert((t ? t + ': ' : '') + msg),
        showConfirm: (t, m, cb) => { if (confirm(m)) cb(); },
        refreshCustomSelect: () => {}, formatarTelefone: (ddd, num) => num || '-',
        extrairErroResposta: (json, http) => ({ codigo: json?.codigo ?? null, mensagem: json?.mensagem || json?.message || `HTTP ${http || '?'}`, traceId: json?.traceId || '' }),
        extrairErro: (err) => ({ codigo: null, mensagem: String(err), traceId: '' }),
        API_URL: '/api',
        getMapInstance: () => null, getVendedores: () => [], carregarVendedoresMapa: async () => [],
        getContexto: () => null, getEmpresaAtivaId: () => null, setEmpresaAtivaId: () => {}, carregarContexto: async () => null,
        limparCacheIgnorados: () => {}, isAdminGlobal: () => false, temFuncionalidade: () => false, aplicarGuardrailsAdmin: () => {},
    });
    window.AppCore = criarAppCoreFallback();
    window.AppCore.__isFallback = true;

    try {
        // ============================================================
        // CACHE E HELPERS
        // ============================================================
        const CACHE = {
            UFS: { key: 'deltafrio_ufs_v2', ttl: 24 * 60 * 60 * 1000 },
            DDDS: { key: 'deltafrio_ddds_v2', ttl: 24 * 60 * 60 * 1000 },
            CNAES: { key: 'deltafrio_cnaes_v4', ttl: 12 * 60 * 60 * 1000 },
            SEGMENTOS: { key: 'deltafrio_segmentos_v2', ttl: 5 * 60 * 1000 },
            IGNORADOS: { key: 'deltafrio_ignorados_v2', ttl: 5 * 60 * 1000 },
            MUNICIPIOS: { key: 'deltafrio_municipios_v2', ttl: 24 * 60 * 60 * 1000 }
        };

        function cacheGet(chave) { try { const raw = localStorage.getItem(chave.key); if (!raw) return null; const { ts, dados } = JSON.parse(raw); if (Date.now() - ts > chave.ttl) { localStorage.removeItem(chave.key); return null; } return dados; } catch (e) { return null; } }
        function cacheSet(chave, dados) { try { localStorage.setItem(chave.key, JSON.stringify({ ts: Date.now(), dados })); } catch (e) {} }
        function limparCacheIgnorados(empresaId = null) {
            try {
                if (empresaId) localStorage.removeItem(`${CACHE.IGNORADOS.key}_${empresaId}`);
                else { localStorage.removeItem(CACHE.IGNORADOS.key); Object.keys(localStorage).filter(k => k.startsWith(CACHE.IGNORADOS.key + '_')).forEach(k => localStorage.removeItem(k)); }
            } catch (e) {}
        }
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        async function executarEmLotesComPausa(itens, limite, pausaMs, fn, onProgress) {
            let proximo = 0; let concluidos = 0;
            async function worker() {
                while (true) {
                    const i = proximo++; if (i >= itens.length) return;
                    try { await fn(itens[i], i); } catch (e) {}
                    concluidos++; if (onProgress) onProgress(concluidos, itens.length);
                    await sleep(pausaMs);
                }
            }
            await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
        }

        // ✅ NOVO HELPER DE DATA (Correção do Erro)
        function formatarData(isoString) {
            if (!isoString) return '—';
            try {
                const d = new Date(isoString);
                if (isNaN(d.getTime())) return isoString;
                return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) { return isoString; }
        }

        // ============================================================
        // VENDEDORES DO MAPA
        // ============================================================
        const CORES_VENDEDORES = ['#2463eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#0ea5e9', '#dc2626', '#22c55e', '#eab308', '#64748b'];
        let vendedoresMapa = [];
        let vendedoresMapaCarregados = false;
        let vendedoresMapaPromise = null;

        async function carregarVendedoresMapa() {
            if (vendedoresMapaCarregados) return vendedoresMapa;
            if (vendedoresMapaPromise) return vendedoresMapaPromise;
            
            vendedoresMapaPromise = (async () => {
                try {
                    const envelope = await apiGetEnvelope(`${API_URL}/prospeccao/vendedores`);
                    const listaOriginal = Array.isArray(envelope) ? envelope 
                        : (envelope && Array.isArray(envelope.dados)) ? envelope.dados 
                        : (envelope && Array.isArray(envelope.registros)) ? envelope.registros 
                        : (envelope && Array.isArray(envelope.vendedores)) ? envelope.vendedores 
                        : (envelope && Array.isArray(envelope.itens)) ? envelope.itens : [];

                    vendedoresMapa = await Promise.all(listaOriginal.map(async (v, i) => {
                        let cobertura = null;
                        try {
                            const respCob = await apiGet(`${API_URL}/prospeccao/vendedores/${v.id}/cobertura`);
                            cobertura = respCob?.dados ?? respCob;
                        } catch (e) {
                            console.warn(`[mapa] Falha ao buscar cobertura do vendedor ${v.id}`, e);
                        }

                        const cidadesDiretas = (cobertura?.cidadesDiretas || []).map(String);
                        const municipios = (cobertura?.municipios || []).map(m => ({
                            codigoIbge: String(m.codigoIbge || ''),
                            nome: m.nomeMunicipio || '',
                            uf: m.uf || '',
                            populacao: m.populacao || 0
                        }));

                        const cidadesMap = new Map();
                        municipios.forEach(m => {
                            if (!m.codigoIbge) return;
                            const origem = cidadesDiretas.includes(m.codigoIbge) ? 'manual' : 'ddd';
                            cidadesMap.set(m.codigoIbge, { ...m, origem });
                        });

                        return {
                            id: String(v.id ?? v.codigo ?? `v${i}`),
                            nome: v.nome || cobertura?.nome || `Vendedor #${v.id}`,
                            cor: v.corMapa || cobertura?.corMapa || CORES_VENDEDORES[i % CORES_VENDEDORES.length],
                            regiao: v.regiao || '',
                            cidades: Array.from(cidadesMap.values()),
                            ddds: cobertura?.ddds || v.ddds || [],
                            quantidadeMunicipios: cobertura?.quantidadeMunicipios || 0,
                            populacaoTotal: cobertura?.populacaoTotal || 0
                        };
                    })).then(lista => lista.filter(v => v.id));

                    vendedoresMapaCarregados = true;
                } catch (e) { 
                    console.error('[mapa] Erro ao carregar vendedores:', e);
                    vendedoresMapa = []; 
                } finally { 
                    vendedoresMapaPromise = null; 
                }
                return vendedoresMapa;
            })();
            return vendedoresMapaPromise;
        }

        function normalizar(str) { return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase().trim(); }

        function getVendedoresAtivosDaCidade(codigoIbge) {
            if (!codigoIbge) return [];
            const ativos = [];
            for (const v of vendedoresMapa) {
                const cb = document.querySelector(`.vendedor-stat-checkbox[data-vendedor="${v.id}"]`);
                if (!cb || !cb.checked) continue; 

                const match = v.cidades.find(c => c.codigoIbge === codigoIbge);
                if (match) ativos.push({ vendedor: v, origem: match.origem });
            }
            return ativos;
        }

        // ============================================================
        // AUTENTICAÇÃO E MODO ESCURO
        // ============================================================
        let sessaoCache = null;
        try {
            const respostaSessao = await fetch(`${API_URL}/sessao`, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
            if (respostaSessao.status === 401) { window.location.replace('/index.html'); return; }
            if (respostaSessao.ok) { try { const json = await respostaSessao.json(); sessaoCache = json?.dados ?? json; } catch (e) {} }
        } catch (erro) {}

        // Preenche os dados do usuário no popover
        if (sessaoCache?.usuario) {
            const nome = sessaoCache.usuario.nome || 'Usuário';
            const email = sessaoCache.usuario.email || '—';
            const iniciais = nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
            
            const elAvatar = document.getElementById('user-avatar');
            const elNameMini = document.getElementById('user-name-mini');
            const elEmailMini = document.getElementById('user-email-mini');
            const elAvatarPopover = document.getElementById('user-avatar-popover');
            const elNamePopover = document.getElementById('user-name-popover');
            const elEmailPopover = document.getElementById('user-email-popover');
            
            if (elAvatar) elAvatar.textContent = iniciais;
            if (elNameMini) elNameMini.textContent = nome.split(' ')[0];
            if (elEmailMini) elEmailMini.textContent = email;
            if (elAvatarPopover) elAvatarPopover.textContent = iniciais;
            if (elNamePopover) elNamePopover.textContent = nome;
            if (elEmailPopover) elEmailPopover.textContent = email;
        }

        // Abrir/Fechar Popover do Usuário
        const userWrapper = document.getElementById('sidebar-user-wrapper');
        const userBtn = document.getElementById('sidebar-user-btn');
        if (userBtn) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userWrapper.classList.toggle('open');
            });
        }
        document.addEventListener('click', (e) => {
            if (userWrapper && !userWrapper.contains(e.target)) {
                userWrapper.classList.remove('open');
            }
        });

        // Lógica do Botão de Tema (Toggle Claro/Escuro)
        const btnLight = document.getElementById('theme-btn-light');
        const btnDark = document.getElementById('theme-btn-dark');

        function atualizarToggleTema(isDark) {
            if (btnLight) btnLight.classList.toggle('active', !isDark);
            if (btnDark) btnDark.classList.toggle('active', isDark);
        }

        if (localStorage.getItem('darkMode') === 'true') { 
            document.body.classList.add('dark-mode'); 
            atualizarToggleTema(true);
        } else {
            atualizarToggleTema(false);
        }

        if (btnLight) btnLight.addEventListener('click', () => {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
            atualizarToggleTema(false);
        });

        if (btnDark) btnDark.addEventListener('click', () => {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
            atualizarToggleTema(true);
        });

        // Lógica do Botão Sair
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', function () {
                showConfirm('Sair do sistema', 'Deseja realmente sair?', async function() {
                    btnLogout.disabled = true; 
                    btnLogout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saindo...';
                    try { 
                        const csrf = document.cookie.split('; ').find(c => c.startsWith('login_delta_csrf=')); 
                        const csrfValor = csrf ? decodeURIComponent(csrf.split('=')[1]) : ''; 
                        await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: csrfValor ? { 'X-CSRF-Token': csrfValor } : {} }); 
                    } catch (e) {} 
                    window.location.href = 'https://www.sistemas.deltafrio.com.br/central.html';
                });
            });
        }

        // ============================================================
        // SIDEBAR E ELEMENTOS
        // ============================================================
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

        const mainScreen = document.getElementById('main-screen');
        const segmentScreen = document.getElementById('segment-screen');
        const ignoradosScreen = document.getElementById('ignorados-screen');
        const mapScreen = document.getElementById('map-screen');
        const vendedoresScreen = document.getElementById('vendedores-screen');

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
        let confirmCallback = null;
        const genericModalBody = document.getElementById('generic-modal-body');
        const genericModalTitle = document.getElementById('generic-modal-title');
        const genericModalSubtitle = document.getElementById('generic-modal-subtitle');
        const genericSearch = document.getElementById('generic-search');
        const companySelectorWrapper = document.getElementById('company-selector-wrapper');
        const companySelector        = document.getElementById('company-selector');
        const btnClassifyX           = document.getElementById('btn-classify-x');
        const detClassificacao       = document.getElementById('det-classificacao');

        // ✅ VARIÁVEIS DA IA
        const iaDataModal = document.getElementById('ia-data-modal');
        const iaDataEmpresa = document.getElementById('ia-data-empresa');
        const iaDataContent = document.getElementById('ia-data-content');
        const globalLoading = document.getElementById('global-loading');

        // ============================================================
        // DADOS
        // ============================================================
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

        // ============================================================
        // CONTEXTO + EMPRESA ATIVA
        // ============================================================
        let contextoCache = null;
        let empresaAtivaId = null; 

        function obterEmpresaAtivaId() {
            if (empresaAtivaId) return empresaAtivaId;
            if (contextoCache?.empresas?.length === 1) { 
                empresaAtivaId = String(contextoCache.empresas[0].id); 
                return empresaAtivaId; 
            }
            return null;
        }

        function definirEmpresaAtivaId(id) {
            empresaAtivaId = id ? String(id) : null;
            atualizarSeletorEmpresa();
            atualizarHeaderEmpresa(empresaAtivaId); 
        }

        function atualizarSeletorEmpresa() {
            if (!companySelector || !companySelectorWrapper) return;
            
            const empresas = contextoCache?.empresas || [];
            const elEmpresaMini = document.getElementById('user-empresa-mini');

            if (!empresas.length) { 
                companySelectorWrapper.style.display = 'none'; 
                if (elEmpresaMini) elEmpresaMini.style.display = 'none';
                return; 
            }
            
            companySelectorWrapper.style.display = 'block';
            const ativo = obterEmpresaAtivaId();
            companySelector.innerHTML = '';
            
            if (!ativo) { 
                const opt = document.createElement('option'); 
                opt.value = ''; 
                opt.textContent = '— Selecione —'; 
                companySelector.appendChild(opt); 
            }
            
            empresas.forEach(e => { 
                const opt = document.createElement('option'); 
                opt.value = String(e.id); 
                opt.textContent = e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`; 
                companySelector.appendChild(opt); 
            });
            
            if (ativo) companySelector.value = ativo;
            
            refreshCustomSelect(companySelector);

            if (elEmpresaMini) {
                if (ativo) {
                    const emp = empresas.find(e => String(e.id) === String(ativo));
                    if (emp) {
                        const nomeEmp = emp.nome || emp.nomeFantasia || emp.razaoSocial || 'Empresa';
                        elEmpresaMini.innerHTML = `<i class="fas fa-building"></i> ${nomeEmp}`;
                        elEmpresaMini.style.display = 'flex';
                    } else {
                        elEmpresaMini.innerHTML = `<i class="fas fa-building"></i> Selecione uma empresa`;
                        elEmpresaMini.style.display = 'flex';
                    }
                } else {
                    elEmpresaMini.innerHTML = `<i class="fas fa-building"></i> Selecione uma empresa`;
                    elEmpresaMini.style.display = 'flex';
                }
            }
        }

        function atualizarHeaderEmpresa(id) {
            const box = document.getElementById('header-empresa-ativa');
            const nomeEl = document.getElementById('header-empresa-nome');
            if (!box || !nomeEl) return;

            if (id && contextoCache?.empresas) {
                const emp = contextoCache.empresas.find(e => String(e.id) === String(id));
                if (emp) {
                    nomeEl.textContent = emp.nome || emp.nomeFantasia || emp.razaoSocial || `#${emp.id}`;
                    box.style.display = 'flex';
                    return;
                }
            }
            box.style.display = 'none';
        }

        function verificarSelecaoObrigatoria() {
            const modal = document.getElementById('empresa-select-modal');
            const select = document.getElementById('empresa-select-obrigatoria');
            const btn = document.getElementById('btn-confirmar-empresa');
            if (!modal || !select || !btn) return;

            const empresas = contextoCache?.empresas || [];
            if (empresas.length === 0) return;

            if (empresas.length === 1) {
                const idUnico = empresas[0].id;
                if (obterEmpresaAtivaId() !== String(idUnico)) {
                    definirEmpresaAtivaId(idUnico);
                }
                modal.style.display = 'none';
            } else {
                if (!obterEmpresaAtivaId()) {
                    select.innerHTML = '<option value="">— Escolha uma empresa —</option>';
                    empresas.forEach(e => {
                        const opt = document.createElement('option');
                        opt.value = String(e.id);
                        opt.textContent = e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`;
                        select.appendChild(opt);
                    });

                    btn.disabled = true;
                    select.onchange = () => { btn.disabled = !select.value; };
                    btn.onclick = () => {
                        if (select.value) {
                            definirEmpresaAtivaId(select.value);
                            modal.style.display = 'none';
                        }
                    };

                    if (window.AppCore && window.AppCore.refreshCustomSelect) {
                        setTimeout(() => window.AppCore.refreshCustomSelect(select), 100);
                    }

                    modal.style.display = 'flex';
                } else {
                    modal.style.display = 'none';
                }
            }
        }

        async function carregarContexto() {
            try {
                const r = await fetch(`${API_URL}/prospeccao/contexto`, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
                if (r.status === 403) { contextoCache = { administradorGlobal: false, empresas: [], funcionalidades: [], semAcesso: true }; atualizarSeletorEmpresa(); return contextoCache; }
                if (!r.ok) return null;
                const json = await r.json(); const ctx = json?.dados ?? json;
                contextoCache = ctx;
                const ativo = obterEmpresaAtivaId(); const ids = (ctx?.empresas || []).map(e => String(e.id));
                if (ativo && !ids.includes(String(ativo))) definirEmpresaAtivaId(null);
                
                atualizarSeletorEmpresa();
                atualizarHeaderEmpresa(obterEmpresaAtivaId()); 
                verificarSelecaoObrigatoria(); 
                
                return ctx;
            } catch (e) { return null; }
        }

        if (companySelector) {
            companySelector.addEventListener('change', function () {
                const id = this.value || null; definirEmpresaAtivaId(id);
                limparCacheIgnorados(); ignoradosCarregados = false; ignorados = []; ignoradosFiltrados = [];
                if (registros.length) { currentPage = 1; historicoCursors = [null]; cursorAtual = null; registros = []; temMais = false; renderTable([]); }
                if (ignoradosScreen.style.display === 'block') carregarIgnorados();
            });
        }

        // ============================================================
        // GUARDRAILS DE ADMIN
        // ============================================================
        const FUNC_MENUS = { 'ADMINISTRAR_VENDEDORES': ['menu-vendedores'], 'ADMINISTRAR_SEGMENTOS': ['menu-segmentos'], 'CONSULTAR_MAPAS': ['menu-mapa'] };
        const ADMIN_MENU_IDS = ['gestao-menu-title', 'menu-segmentos', 'menu-vendedores', 'menu-mapa'];

        function isAdminGlobal() {
            try { const forcar = sessionStorage.getItem('deltafrio_force_admin'); if (forcar) { const expiraEm = Number(forcar); if (!isNaN(expiraEm) && Date.now() < expiraEm) return true; if (forcar === 'true') return true; sessionStorage.removeItem('deltafrio_force_admin'); } } catch (e) {}
            if (!contextoCache) return false; if (contextoCache.administradorGlobal === true) return true; if (contextoCache.administradorGlobal === false) return false;
            const funcs = contextoCache.funcionalidades;
            if (Array.isArray(funcs)) return funcs.some(f => { const s = String(f).toUpperCase(); return s.startsWith('ADMINISTRAR_') || s === 'CONSULTAR_MAPAS'; });
            return false;
        }

        function temFuncionalidade(nomeFunc) {
            try { const forcar = sessionStorage.getItem('deltafrio_force_admin'); if (forcar) { const expiraEm = Number(forcar); if (!isNaN(expiraEm) && Date.now() < expiraEm) return true; if (forcar === 'true') return true; } } catch (e) {}
            if (!contextoCache) return false; if (contextoCache.administradorGlobal === true) return true;
            const funcs = contextoCache.funcionalidades;
            if (Array.isArray(funcs)) { const alvo = String(nomeFunc).toUpperCase(); return funcs.some(f => String(f).toUpperCase() === alvo); }
            return false;
        }

        function aplicarGuardrailsAdmin() {
            let algumMenuAdminVisivel = false;
            for (const [func, ids] of Object.entries(FUNC_MENUS)) {
                const permitido = temFuncionalidade(func); if (permitido) algumMenuAdminVisivel = true;
                ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = permitido ? '' : 'none'; });
            }
            const titulo = document.getElementById('gestao-menu-title'); if (titulo) titulo.style.display = algumMenuAdminVisivel ? '' : 'none';
            const emTelaAdmin = (segmentScreen.style.display === 'block' && !temFuncionalidade('ADMINISTRAR_SEGMENTOS')) || (vendedoresScreen?.style.display === 'block' && !temFuncionalidade('ADMINISTRAR_VENDEDORES')) || (mapScreen.style.display === 'block' && !temFuncionalidade('CONSULTAR_MAPAS'));
            if (emTelaAdmin) showScreen('main');
        }

        // ============================================================
        // ERRO UNIFICADO E NAVEGAÇÃO
        // ============================================================
        function extrairErroResposta(json, httpStatus) {
            if (!json) return { codigo: null, mensagem: `HTTP ${httpStatus || '?'}`, traceId: '' };
            if (json.codigo != null || (json.mensagem && !json.erros && !json.retorno)) return { codigo: json.codigo ?? null, mensagem: json.mensagem || 'Erro', traceId: json.traceId || '' };
            if (Array.isArray(json.erros) && json.erros.length) { const e = json.erros[0]; return { codigo: e.id ?? null, mensagem: e.motivo || e.message || 'Erro', traceId: json.traceId || '' }; }
            return { codigo: null, mensagem: json.message || json.title || `HTTP ${httpStatus || '?'}`, traceId: json.traceId || '' };
        }

        function setActiveMenuItem(id) { document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active')); const t = document.getElementById(id); if (t) t.classList.add('active'); }
        let previousMenuItemId = null;
        function saveActiveMenuItem() { const a = document.querySelector('.menu-item.active'); if (a) previousMenuItemId = a.id; }
        function restoreActiveMenuItem() { if (previousMenuItemId) { setActiveMenuItem(previousMenuItemId); previousMenuItemId = null; } }
        const registeredScreens = {};
        function registerScreen(nome, el) { if (el) registeredScreens[nome] = el; }

        function showScreen(screen) {
            if (screen === 'segment' && !temFuncionalidade('ADMINISTRAR_SEGMENTOS')) return showWarning('Você não tem permissão para acessar esta área.', 'Acesso negado');
            if (screen === 'vendedores' && !temFuncionalidade('ADMINISTRAR_VENDEDORES')) return showWarning('Você não tem permissão para acessar esta área.', 'Acesso negado');
            if (screen === 'mapa' && !temFuncionalidade('CONSULTAR_MAPAS')) return showWarning('Você não tem permissão para acessar esta área.', 'Acesso negado');
            [mainScreen, segmentScreen, ignoradosScreen, mapScreen, vendedoresScreen, ...Object.values(registeredScreens)].forEach(s => { if (s) s.style.display = 'none'; });
            if (screen === 'main') { mainScreen.style.display = 'block'; setActiveMenuItem('menu-dashboard'); }
            else if (screen === 'segment') { segmentScreen.style.display = 'block'; setActiveMenuItem('menu-segmentos'); resetSegmentForm(); renderSegmentTable(); populateLinkSelect(); }
            else if (screen === 'ignorados') { ignoradosScreen.style.display = 'block'; setActiveMenuItem('menu-ignorados'); if (!ignoradosCarregados) carregarIgnorados(); else renderIgnoradosTable(); }
            else if (screen === 'mapa') { mapScreen.style.display = 'block'; setActiveMenuItem('menu-mapa'); if (!window.mapInstance) initMap(); else setTimeout(() => window.mapInstance.invalidateSize(), 100); }
            else if (screen === 'vendedores' || screen === 'empresas') { if (vendedoresScreen) { vendedoresScreen.style.display = 'block'; setActiveMenuItem('menu-vendedores'); } }
            else if (registeredScreens[screen]) registeredScreens[screen].style.display = 'block';
            try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; const mainEl = document.querySelector('.main'); if (mainEl) mainEl.scrollTop = 0; } catch (e) {}
        }

        function normalizarTexto(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
        function obterCsrf() { const m = document.cookie.split('; ').find(c => c.startsWith('login_delta_csrf=')); return m ? decodeURIComponent(m.split('=')[1]) : ''; }

        // ============================================================
        // API
        // ============================================================
        async function apiGet(url) {
            const r = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } });
            const t = await r.text(); if (!t) return {};
            let json; try { json = JSON.parse(t); } catch (e) { json = {}; }
            if (!r.ok) { const e = extrairErroResposta(json, r.status); const err = new Error(e.mensagem); err.codigo = e.codigo; err.traceId = e.traceId; throw err; }
            return json;
        }

        async function apiGetEnvelope(url) { const r = await apiGet(url); if (r && typeof r === 'object' && 'dados' in r) return r.dados; return r; }

        async function apiPost(url, body) {
            const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }; const csrf = obterCsrf(); if (csrf) headers['X-CSRF-Token'] = csrf;
            const r = await fetch(url, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body) });
            const t = await r.text(); let json; try { json = t ? JSON.parse(t) : {}; } catch (e) { json = {}; }
            if (!r.ok) { const e = extrairErroResposta(json, r.status); const err = new Error(e.mensagem); err.codigo = e.codigo; err.traceId = e.traceId; throw err; }
            return json;
        }

        async function apiPut(url, body) {
            const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }; const csrf = obterCsrf(); if (csrf) headers['X-CSRF-Token'] = csrf;
            const r = await fetch(url, { method: 'PUT', credentials: 'include', headers, body: JSON.stringify(body) });
            const t = await r.text(); let json; try { json = t ? JSON.parse(t) : {}; } catch (e) { json = {}; }
            if (!r.ok) { const e = extrairErroResposta(json, r.status); const err = new Error(e.mensagem); err.codigo = e.codigo; err.traceId = e.traceId; throw err; }
            return json;
        }

        async function apiDelete(url) {
            const headers = { 'Accept': 'application/json' }; const csrf = obterCsrf(); if (csrf) headers['X-CSRF-Token'] = csrf;
            const r = await fetch(url, { method: 'DELETE', credentials: 'include', headers });
            if (!r.ok) { const t = await r.text(); let json; try { json = t ? JSON.parse(t) : {}; } catch (e) { json = {}; } const e = extrairErroResposta(json, r.status); const err = new Error(e.mensagem); err.codigo = e.codigo; err.traceId = e.traceId; throw err; }
            return r.status === 204 ? null : await r.json().catch(() => null);
        }

        async function fetchFromAPI(urls) {
            for (const url of urls) { try { const r = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); const d = await r.json(); return Array.isArray(d) ? d : (d.data || d.results || []); } catch (e) {} }
            return null;
        }

        // ============================================================
        // CARREGAMENTOS AUXILIARES
        // ============================================================
        async function carregarUFs() {
            const cache = cacheGet(CACHE.UFS);
            if (cache) { ufData = cache; filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(u => `<option value="${u.sigla}">${u.sigla}</option>`).join(''); refreshCustomSelect(filterUf); return; }
            try { const data = await apiGet(`${API_URL}/ufs`); ufData = data.map(i => ({ sigla: i.uf, nome: i.nome })); filterUf.innerHTML = '<option value="">Todos</option>' + ufData.map(u => `<option value="${u.sigla}">${u.sigla}</option>`).join(''); refreshCustomSelect(filterUf); cacheSet(CACHE.UFS, ufData); } catch (e) {}
        }

        async function carregarDDDs() {
            const cache = cacheGet(CACHE.DDDS);
            if (cache) { const sel = document.getElementById('filter-ddd'); sel.innerHTML = '<option value="">Todos</option>'; cache.forEach(i => { const o = document.createElement('option'); o.value = i.ddd; o.textContent = `${i.ddd} - ${i.descricao}`; sel.appendChild(o); }); refreshCustomSelect(sel); return; }
            try { const data = await apiGet(`${API_URL}/ddds`); const sel = document.getElementById('filter-ddd'); sel.innerHTML = '<option value="">Todos</option>'; data.forEach(i => { const o = document.createElement('option'); o.value = i.ddd; o.textContent = `${i.ddd} - ${i.descricao}`; sel.appendChild(o); }); refreshCustomSelect(sel); cacheSet(CACHE.DDDS, data.map(i => ({ ddd: i.ddd, descricao: i.descricao }))); } catch (e) {}
        }

        async function carregarCnaesIniciais() {
            const cache = cacheGet(CACHE.CNAES);
            if (cache) { allCnaesCache = cache; cnaeData = allCnaesCache; populateLinkSelect(); return; }
            try { const data = await fetchFromAPI([`${API_URL}/cnaes`]); if (data) { allCnaesCache = data.map(i => ({ codigo: i.codigo || i.cnae || i.id, descricao: i.descricao || i.nome || '', full: i.codigoDescricao || `${i.codigo} - ${i.descricao}` })).filter(c => c.codigo); cnaeData = allCnaesCache; populateLinkSelect(); cacheSet(CACHE.CNAES, allCnaesCache); } } catch (e) { allCnaesCache = []; }
        }

        async function buscarDetalhesCnae(codigo) {
            const c = String(codigo).trim(); const cache = allCnaesCache.find(x => String(x.codigo).trim() === c); if (cache) return cache;
            try { const lista = await fetchFromAPI([`${API_URL}/cnaes?filtro=${encodeURIComponent(c)}`]); if (Array.isArray(lista)) { const enc = lista.find(x => String(x.codigo ?? x.cnae ?? x.id).trim() === c); if (enc) { const r = { codigo: enc.codigo ?? enc.cnae ?? enc.id, descricao: enc.descricao ?? enc.nome ?? '', full: enc.codigoDescricao ?? `${enc.codigo ?? enc.cnae ?? enc.id} - ${enc.descricao ?? enc.nome ?? ''}` }; allCnaesCache.push(r); return r; } } } catch (e) {}
            return null;
        }

        // ============================================================
        // SEGMENTOS
        // ============================================================
        async function carregarSegmentos() {
            if (segmentData.length > 0) { updateSegmentFilter(); renderSegmentTable(); return; }
            const cache = cacheGet(CACHE.SEGMENTOS);
            if (cache) { segmentData = cache.segmentData || []; segmentoCnaeLinks = cache.segmentoCnaeLinks || []; updateSegmentFilter(); renderSegmentTable(); populateLinkSelect(); return; }
            try {
                const data = await apiGet(`${API_URL}/segmentos`);
                segmentData = data.map(i => ({ id: i.codigo, nome: i.descricao })); segmentoCnaeLinks = [];
                const cnaesVistos = new Set(allCnaesCache.map(x => String(x.codigo).trim()));
                await executarEmLotesComPausa(segmentData, 3, 20, async (seg) => {
                    try { const cnaes = await apiGet(`${API_URL}/segmentos/${seg.id}/cnaes`); cnaes.forEach(c => { if (!segmentoCnaeLinks.some(l => l.segmentoId === seg.id && l.cnaeCodigo === c.codigo)) segmentoCnaeLinks.push({ segmentoId: seg.id, cnaeCodigo: c.codigo }); const cv = String(c.codigo).trim(); if (!cnaesVistos.has(cv)) { cnaesVistos.add(cv); allCnaesCache.push({ codigo: cv, descricao: c.descricao || '', full: c.descricao ? `${cv} - ${c.descricao}` : cv }); } }); } catch (e) {}
                });
                updateSegmentFilter(); renderSegmentTable(); populateLinkSelect(); cacheSet(CACHE.SEGMENTOS, { segmentData, segmentoCnaeLinks }); cacheSet(CACHE.CNAES, allCnaesCache);
            } catch (e) { if (filterSegmento) { filterSegmento.innerHTML = '<option value="">Todos</option>'; refreshCustomSelect(filterSegmento); } }
        }

        async function buscarCnaes(filtro) {
            const data = await fetchFromAPI([`${API_URL}/cnaes?filtro=${encodeURIComponent(filtro)}`]);
            if (data) { const r = data.map(i => ({ codigo: i.codigo || i.cnae || i.id, descricao: i.descricao || i.nome || '', full: i.codigoDescricao || `${i.codigo} - ${i.descricao}` })).filter(c => c.codigo); if (filtro) { const nc = r.map(x => x.codigo); allCnaesCache = allCnaesCache.filter(c => !nc.includes(c.codigo)); allCnaesCache.push(...r); } return r; }
            if (allCnaesCache.length > 0) return allCnaesCache.filter(i => { const t = normalizarTexto(filtro); return normalizarTexto(i.codigo).includes(t) || normalizarTexto(i.descricao).includes(t) || normalizarTexto(i.full).includes(t); });
            return [];
        }

        async function carregarMunicipiosDaAPI() {
            if (municipiosCache && municipiosCache.length > 0) return municipiosCache;
            const cache = cacheGet(CACHE.MUNICIPIOS);
            if (cache && cache.length > 0) { municipiosCache = cache; return municipiosCache; }
            if (municipiosCarregando && municipiosPromise) return municipiosPromise;
            municipiosCarregando = true;
            municipiosPromise = (async () => {
                try { const dddData = await apiGet(`${API_URL}/ddds`); const acumulado = []; await executarEmLotesComPausa(dddData, 5, 20, async (d) => { try { const m = await apiGet(`${API_URL}/ddds/${d.ddd}/municipios`); m.forEach(x => acumulado.push(`${x.municipio} - ${d.ddd}`)); } catch (e) {} }); if (acumulado.length > 0) { municipiosCache = [...new Set(acumulado)].sort(); cacheSet(CACHE.MUNICIPIOS, municipiosCache); } return municipiosCache || []; } catch (e) { return []; } finally { municipiosCarregando = false; municipiosPromise = null; }
            })();
            return municipiosPromise;
        }

        async function carregarSituacoesCadastrais() { try { const d = await apiGet(`${API_URL}/situacoes-cadastrais`); return d.map(i => `${i.codigoDescricao}`); } catch (e) { return ['ATIVA', 'BAIXADA', 'SUSPENSA']; } }

        // ============================================================
        // IGNORADOS
        // ============================================================
        async function carregarIgnorados() {
            if (ignoradosCarregados) return;
            const empresaId = obterEmpresaAtivaId();
            if (!empresaId) { ignorados = []; ignoradosFiltrados = []; ignoradosCarregados = true; renderIgnoradosTable(); const tb = document.getElementById('ignorados-table-body'); if (tb) tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary);"><i class="fas fa-info-circle" style="font-size:20px;display:block;margin-bottom:8px;"></i>Selecione uma empresa ativa na barra lateral para ver os ignorados.</td></tr>`; return; }
            const cacheKey = `${CACHE.IGNORADOS.key}_${empresaId}`;
            try { const raw = localStorage.getItem(cacheKey); if (raw) { const { ts, dados } = JSON.parse(raw); if (Date.now() - ts <= CACHE.IGNORADOS.ttl && Array.isArray(dados) && dados.length > 0) { ignorados = dados; ignoradosCarregados = true; ignoradosFiltrados = [...ignorados]; renderIgnoradosTable(); return; } localStorage.removeItem(cacheKey); } } catch (e) {}
            try { localStorage.removeItem(CACHE.IGNORADOS.key); } catch (e) {}
            try {
                const url = `${API_URL}/prospeccao/status-estabelecimentos?status=X&empresaId=${encodeURIComponent(empresaId)}`;
                const r = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
                const raw = await r.text(); if (!r.ok) { let json = {}; try { json = JSON.parse(raw); } catch (e) {} const erro = extrairErroResposta(json, r.status); throw new Error(erro.mensagem || `HTTP ${r.status}`); }
                let d = {}; try { d = raw ? JSON.parse(raw) : {}; } catch (e) {} let lista = [];
                if (Array.isArray(d)) lista = d; else if (Array.isArray(d.registros)) lista = d.registros; else if (Array.isArray(d.dados)) lista = d.dados; else if (Array.isArray(d.dados?.registros)) lista = d.dados.registros; else if (Array.isArray(d.itens)) lista = d.itens; else if (Array.isArray(d.content)) lista = d.content;
                ignorados = lista.map(i => ({ cnpj: i.cnpj, cnpjFormatado: i.cnpjFormatado, razaoSocial: i.razaoSocial, nomeFantasia: i.nomeFantasia, uf: i.uf, municipio: i.municipio, ddd: i.ddd, telefone1: i.telefone1, telefone2: i.telefone2, email: i.email, status: i.status || 'X' }));
                ignoradosCarregados = true; ignoradosFiltrados = [...ignorados]; renderIgnoradosTable();
                if (ignorados.length > 0) { try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), dados: ignorados })); } catch (e) {} }
            } catch (e) { ignorados = []; ignoradosFiltrados = []; ignoradosCarregados = true; renderIgnoradosTable(); const tb = document.getElementById('ignorados-table-body'); if (tb) tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#dc2626;">Erro ao carregar ignorados: ${e?.message || 'erro desconhecido'}</td></tr>`; }
        }

        // ============================================================
        // CUSTOM SELECT, TEL E TABELAS AUXILIARES
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

        async function salvarStatus(cnpj, status) {
            const empresaId = obterEmpresaAtivaId();
            if (!empresaId) throw new Error('Selecione uma empresa ativa antes de classificar.');
            await apiPost(`${API_URL}/prospeccao/status-estabelecimentos?empresaId=${encodeURIComponent(empresaId)}`, { cnpjCompleto: cnpj, status });
            limparCacheIgnorados(empresaId);
        }

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
            recordsFooter.textContent = `Exibindo ${start} - ${end}`; pageIndicator.textContent = `Página ${currentPage}`; btnPrev.disabled = currentPage === 1; btnNext.disabled = !temMais;
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

        let pesquisaController = null;
        async function pesquisarProspeccao(botao = null, cursor = null) {
            const btn = botao || btnSearch; const cursorEnv = (cursor !== undefined) ? cursor : cursorAtual;
            const uf = filterUf.value.trim(); const ddd = filterDdd.value; const seg = filterSegmento.value;
            let cnae = selectedCnaeCode; if (!cnae && filterCnaeInput.value.trim() !== '') { filterCnaeInput.value = ''; cnae = null; }
            const esc = filterTipoCnae ? filterTipoCnae.value : 'PRINCIPAL';
            const body = { uf: uf || null, ddd: uf ? null : (ddd || null), cnae: cnae || null, segmento: cnae ? null : (seg ? parseInt(seg) : null), escopoCnae: (cnae || seg) ? esc : null, ultimoCnpj: cursorEnv, limite: 50 };
            
            if (!body.uf && !body.ddd && !body.segmento && !body.cnae) { showWarning("Informe pelo menos um filtro para realizar a pesquisa.", "Atenção"); return; }
            
            const empresaId = obterEmpresaAtivaId();
            if (!empresaId) { showWarning("Selecione uma empresa ativa na barra lateral antes de pesquisar.", "Atenção"); return; }

            btn.disabled = true; const origB = btn.innerHTML; const origP = pageIndicator.innerHTML;
            if (btn.classList.contains('page-btn')) pageIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; else btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            if (pesquisaController) pesquisaController.abort(); pesquisaController = new AbortController();
            try {
                const r = await fetch(`${API_URL}/prospeccao/pesquisar?empresaId=${encodeURIComponent(empresaId)}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body), signal: pesquisaController.signal });
                const t = await r.text(); let json; try { json = t ? JSON.parse(t) : {}; } catch (e) {}
                if (!r.ok) { const e = extrairErroResposta(json, r.status); const err = new Error(e.mensagem); err.codigo = e.codigo; err.traceId = e.traceId; throw err; }
                const d = json?.dados ?? json; registros = d.registros || []; temMais = d.temMais || false; cursorAtual = d.ultimoCnpj || null; renderTable(registros);
            } catch (e) { 
                if (e.name !== 'AbortError') { console.error(e); showWarning("Erro ao pesquisar: " + (e.message || 'Tente novamente mais tarde.'), "Erro"); } 
                if (btn.classList.contains('page-btn')) pageIndicator.innerHTML = origP; 
            } finally { btn.disabled = false; btn.innerHTML = origB; pesquisaController = null; }
        }

        // ============================================================
        // INTEGRAÇÃO COM A IA
        // ============================================================
        async function solicitarDadosIA(cnpj) {
            showConfirm('Aviso de Espera', 'A busca de dados com Inteligência Artificial pode demorar até 2 minutos e o sistema ficará bloqueado durante o processo. Deseja continuar?', async () => {
                const empresaId = obterEmpresaAtivaId();
                if (!empresaId) return showWarning('Selecione uma empresa ativa antes de continuar.', 'Atenção');

                if (globalLoading) globalLoading.style.display = 'flex';

                try {
                    const url = `${API_URL}/prospeccao/estabelecimentos/${encodeURIComponent(cnpj)}/enriquecimento?empresaId=${encodeURIComponent(empresaId)}`;
                    const json = await apiPost(url, {}); 
                    
                    const dados = json?.dados ?? json;
                    renderIAData(dados);
                    
                } catch (err) {
                    console.error('[IA] Erro:', err);
                    showWarning('Erro ao buscar dados com IA: ' + (err.message || 'Tente novamente mais tarde.'), 'Erro');
                } finally {
                    if (globalLoading) globalLoading.style.display = 'none';
                }
            });
        }

                function renderIAData(data) {
            if (!iaDataContent || !iaDataModal) return;

            const res = data.resultado || {};
            
            iaDataEmpresa.innerHTML = `<strong>${data.razaoSocial || '-'}</strong> • CNPJ: ${data.cnpj || '-'} • Consultado em: ${formatarData(data.consultadoEm)}`;

            let html = '';
            let temDados = false;

            // --- 1. Contatos e Redes ---
            let htmlContatos = '';
            if (res.site) htmlContatos += `<div class="ia-item"><span>Site</span><strong><a href="${res.site}" target="_blank" rel="noopener">${res.site}</a></strong></div>`;
            if (res.linkedin) htmlContatos += `<div class="ia-item"><span>LinkedIn</span><strong><a href="${res.linkedin}" target="_blank">Acessar Perfil</a></strong></div>`;
            if (res.instagram) htmlContatos += `<div class="ia-item"><span>Instagram</span><strong><a href="${res.instagram}" target="_blank">Acessar Perfil</a></strong></div>`;
            if (res.facebook) htmlContatos += `<div class="ia-item"><span>Facebook</span><strong><a href="${res.facebook}" target="_blank">Acessar Perfil</a></strong></div>`;

            let htmlTelefones = '';
            if (res.telefones?.length) htmlTelefones += `<div class="ia-item"><span>Telefones</span><ul class="ia-list">${res.telefones.map(t => `<li><i class="fas fa-phone"></i> ${t}</li>`).join('')}</ul></div>`;
            if (res.whatsapps?.length) htmlTelefones += `<div class="ia-item"><span>WhatsApp</span><ul class="ia-list">${res.whatsapps.map(w => `<li><i class="fab fa-whatsapp" style="color:#10b981;"></i> ${w}</li>`).join('')}</ul></div>`;
            if (res.emails?.length) htmlTelefones += `<div class="ia-item" style="grid-column: 1 / -1;"><span>E-mails</span><ul class="ia-list">${res.emails.map(e => `<li><i class="fas fa-envelope"></i> ${e}</li>`).join('')}</ul></div>`;

            if (htmlContatos || htmlTelefones) {
                temDados = true;
                html += `<div class="ia-section">
                    <h4><i class="fas fa-address-card"></i> Contatos e Presença Digital</h4>
                    <div class="ia-grid">${htmlContatos}</div>
                    ${htmlTelefones ? `<div style="margin-top: 15px; border-top: 1px dashed var(--border-color); padding-top: 15px;"><div class="ia-grid">${htmlTelefones}</div></div>` : ''}
                </div>`;
            }

            // --- 2. Endereço ---
            if (res.enderecoAtualizado) {
                temDados = true;
                html += `<div class="ia-section">
                    <h4><i class="fas fa-map-marker-alt"></i> Endereço Atualizado</h4>
                    <div class="ia-item"><strong>${res.enderecoAtualizado}</strong></div>
                </div>`;
            }

            // --- 3. Descrição e Info ---
            if (res.descricaoEmpresa || res.informacoesAdicionais?.length) {
                temDados = true;
                html += `<div class="ia-section">
                    <h4><i class="fas fa-info-circle"></i> Sobre a Empresa</h4>`;
                if (res.descricaoEmpresa) html += `<p class="ia-description">${res.descricaoEmpresa}</p>`;
                if (res.informacoesAdicionais?.length) {
                    html += `<ul class="ia-additional-list">`;
                    res.informacoesAdicionais.forEach(info => { html += `<li>${info}</li>`; });
                    html += `</ul>`;
                }
                html += `</div>`;
            }

            // --- 4. Empty State (Nenhum dado encontrado) ---
            if (!temDados) {
                html = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-search-minus" style="font-size: 60px; color: #94a3b8; margin-bottom: 20px;"></i>
                    <h3 style="font-size: 18px; color: var(--text-main); margin-bottom: 8px;">Nenhum dado adicional encontrado</h3>
                    <p style="font-size: 14px; max-width: 400px; line-height: 1.5;">A Inteligência Artificial não encontrou novos contatos, sites ou informações públicas para esta empresa.</p>
                </div>`;
            }

            iaDataContent.innerHTML = html;
            iaDataModal.style.display = 'flex';
        }

        // ============================================================
        // DETALHES DO ESTABELECIMENTO
        // ============================================================
        function openDetailsModal(cnpj, isIgn = false) {
            const list = isIgn ? ignorados : registros; const c = list.find(i => i.cnpj === cnpj); if (!c) return;
            const nomeExibicao = c.nomeFantasia || c.razaoSocial || 'sem nome'; const cnpjExibicao = c.cnpjFormatado || c.cnpj || '';
            document.getElementById('det-cnpj').innerText = c.cnpjFormatado; document.getElementById('det-razao').innerText = c.razaoSocial || '-'; document.getElementById('det-fantasia').innerText = c.nomeFantasia || '-';
            const sit = document.getElementById('det-situacao'); sit.innerText = 'ATIVA'; sit.className = 'badge badge-green'; document.getElementById('det-tipo').innerText = 'MATRIZ';
            document.getElementById('det-natureza').innerText = '-'; document.getElementById('det-porte').innerText = '-'; document.getElementById('det-capital').innerText = '-'; document.getElementById('det-inicio').innerText = '-'; document.getElementById('det-data-sit').innerText = '-'; document.getElementById('det-cnae').innerText = '-'; document.getElementById('det-logradouro').innerText = '-'; document.getElementById('det-numero').innerText = '-'; document.getElementById('det-complemento').innerText = '-'; document.getElementById('det-bairro').innerText = '-'; document.getElementById('det-cep').innerText = '-'; document.getElementById('det-municipio').innerText = c.municipio || '-';
            document.getElementById('det-tel1').innerText = formatarTelefone(c.ddd, c.telefone1); document.getElementById('det-tel2').innerText = formatarTelefone(c.ddd, c.telefone2); document.getElementById('det-email').innerText = c.email || '-';
            const statusAtual = c.status || (isIgn ? 'X' : null);
            if (detClassificacao) detClassificacao.style.display = 'none'; 
            if (btnClassifyX) {
                btnClassifyX.classList.remove('btn-classify-x', 'btn-classify-activate');
                if (statusAtual === 'X' || isIgn) { btnClassifyX.innerHTML = '<i class="fas fa-undo"></i> Ativar Cadastro'; btnClassifyX.classList.add('btn-classify-activate'); btnClassifyX.onclick = () => ativarCadastro(cnpj, nomeExibicao, cnpjExibicao); }
                else { btnClassifyX.innerHTML = '<i class="fas fa-ban"></i> Ignorar Cadastro'; btnClassifyX.classList.add('btn-classify-x'); btnClassifyX.onclick = () => classificar(cnpj, 'X', statusAtual, nomeExibicao, cnpjExibicao); }
                btnClassifyX.disabled = false;
            }

            const btnIA = document.getElementById('btn-dados-ia');
            if (btnIA) {
                btnIA.onclick = () => solicitarDadosIA(cnpj);
            }
            
            detailsModal.style.display = 'flex';
        }

        async function classificar(cnpj, novoStatus, statusAtual, nome, cnpjFmt) {
            if (statusAtual === novoStatus) { detailsModal.style.display = 'none'; return; }
            const removerDaTabela = () => { if (novoStatus === 'X') { const idx = registros.findIndex(i => i.cnpj === cnpj); if (idx !== -1) { registros.splice(idx, 1); renderTable(registros); } } };
            if (statusAtual && statusAtual !== novoStatus) {
                showConfirm('Trocar classificação', `Este estabelecimento já está classificado como "${statusAtual}". Para ignorar, é necessário excluir a classificação atual primeiro. Deseja continuar?`, async () => {
                    try { const empresaId = obterEmpresaAtivaId(); await apiDelete(`${API_URL}/prospeccao/status-estabelecimentos/${encodeURIComponent(cnpj)}?empresaId=${encodeURIComponent(empresaId)}`); await salvarStatus(cnpj, novoStatus); removerDaTabela(); await recarregarAposClassificacao(); detailsModal.style.display = 'none'; showWarning(`Cadastro ${nome} e CNPJ ${cnpjFmt} ignorado.`, 'Sucesso'); } catch (e) { if (e.codigo === 409) showWarning('O servidor exige exclusão antes da troca.', 'Atenção'); else showWarning('Erro ao trocar classificação: ' + (e.message || '')); }
                });
                return;
            }
            try { await salvarStatus(cnpj, novoStatus); removerDaTabela(); await recarregarAposClassificacao(); detailsModal.style.display = 'none'; showWarning(`Cadastro ${nome} e CNPJ ${cnpjFmt} ignorado.`, 'Sucesso'); } catch (e) { if (e.codigo === 409) showWarning('Este estabelecimento já possui classificação. Recarregue a página para atualizar.', 'Atenção'); else showWarning('Erro ao ignorar: ' + (e.message || '')); }
        }

        async function ativarCadastro(cnpj, nome, cnpjFmt) {
            try { const empresaId = obterEmpresaAtivaId(); await apiDelete(`${API_URL}/prospeccao/status-estabelecimentos/${encodeURIComponent(cnpj)}?empresaId=${encodeURIComponent(empresaId)}`); const idx = ignorados.findIndex(i => i.cnpj === cnpj); if (idx !== -1) { ignorados.splice(idx, 1); ignoradosFiltrados = [...ignorados]; renderIgnoradosTable(); } await recarregarAposClassificacao(); detailsModal.style.display = 'none'; showWarning(`Cadastro ${nome} e CNPJ ${cnpjFmt} reativado com sucesso!`, 'Sucesso'); } catch (e) { showWarning('Erro ao ativar cadastro: ' + (e.message || '')); }
        }

        async function recarregarAposClassificacao() { const empresaId = obterEmpresaAtivaId(); if (empresaId) limparCacheIgnorados(empresaId); else limparCacheIgnorados(); ignoradosCarregados = false; ignorados = []; ignoradosFiltrados = []; if (ignoradosScreen.style.display === 'block') await carregarIgnorados(); }

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
                function positionTooltip() { const rect = trigger.getBoundingClientRect(); content.style.display = 'block'; content.classList.add('tooltip-visible'); const tw = content.offsetWidth, th = content.offsetHeight; let left = rect.left + (rect.width / 2) - (tw / 2), top = rect.top - th - 12; if (left < 10) left = 10; if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10; if (top < 10) top = 10; content.style.left = `${left}px`; content.style.top = `${top}px`; content.style.right = 'auto'; content.style.bottom = 'auto'; content.style.transform = 'none'; }
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
                
                setDirty(false); originalLinkedCnaes = [...currentLinkedCnaes]; resetSegmentForm(); localStorage.removeItem(CACHE.SEGMENTOS.key); segmentData = []; segmentoCnaeLinks = [];
                
                showWarning('Segmento salvo com sucesso!', 'Sucesso');
                confirmModal.style.display = 'none';

                carregarSegmentos().then(() => {
                    updateSegmentFilter();
                    renderSegmentTable(segmentSearch.value);
                });

            } catch (e) { showWarning('Erro ao salvar segmento.'); }
        });
        if (btnCancelSegment) btnCancelSegment.addEventListener('click', () => resetSegmentForm());
        segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });
        
        async function editarSegmento(id) {
            const seg = segmentData.find(s => s.id === id); if (!seg) return;
            editingSegmentId = id; segmentNome.value = seg.nome; btnSaveSegment.innerText = 'Atualizar segmento'; btnSaveSegment.classList.add('editing-btn'); btnCancelSegment.style.display = 'inline-block'; formTitle.innerText = 'Editar segmento'; segmentFormCard.classList.add('editing-mode');
            try { const cnaes = await apiGet(`${API_URL}/segmentos/${id}/cnaes`); const list = []; for (const c of cnaes) { let full = allCnaesCache.find(x => x.codigo === c.codigo); if (!full) { full = await buscarDetalhesCnae(c.codigo); if (full) allCnaesCache.push(full); else full = { codigo: c.codigo, descricao: 'CNAE não encontrado', full: c.codigo }; } list.push(full); } currentLinkedCnaes = list; originalLinkedCnaes = [...list]; renderLinkedCnaes(); populateLinkSelect(); }
            catch (e) { currentLinkedCnaes = []; originalLinkedCnaes = []; renderLinkedCnaes(); populateLinkSelect(); }
            setDirty(true);
        }
        
        async function excluirSegmento(id) {
            const seg = segmentData.find(s => s.id === id); if (!seg) { showWarning('Segmento não encontrado.'); return; }
            showConfirm('Excluir Segmento', `Tem certeza que deseja excluir "${seg.nome}"?`, async function() {
                try {
                    const cnaes = await apiGet(`${API_URL}/segmentos/${id}/cnaes`);
                    for (const c of cnaes) {
                        try { await apiDelete(`${API_URL}/segmentos/${id}/cnaes/${c.codigo}`); } catch(err) {}
                    }
                    await apiDelete(`${API_URL}/segmentos/${id}`);
                    
                    segmentData = segmentData.filter(s => s.id !== id);
                    segmentoCnaeLinks = segmentoCnaeLinks.filter(l => l.segmentoId !== id);
                    localStorage.removeItem(CACHE.SEGMENTOS.key);
                    renderSegmentTable(segmentSearch.value);
                    updateSegmentFilter();
                    if (editingSegmentId === id) resetSegmentForm();
                    showWarning('Segmento excluído com sucesso!', 'Sucesso');
                } catch (e) { showWarning('Erro ao excluir segmento: ' + (e.message || 'Verifique os vínculos.'), 'Atenção'); }
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

        document.getElementById('close-ia-data-modal')?.addEventListener('click', () => iaDataModal.style.display = 'none');
        iaDataModal?.addEventListener('click', function(e) { if (e.target === this) iaDataModal.style.display = 'none'; });

        function setIconConfirmacao(titulo) {
            const iconWrapper = document.getElementById('confirm-icon-wrapper');
            const iconI = document.getElementById('confirm-icon-i');
            if (!iconWrapper || !iconI) return;

            const t = String(titulo).toLowerCase();
            
            iconWrapper.classList.remove('success', 'error', 'warning');

            if (t.includes('sucesso')) {
                iconWrapper.classList.add('success');
                iconI.className = 'fas fa-check-circle';
            } else if (t.includes('erro') || t.includes('falha') || t.includes('negado') || t.includes('atenção')) {
                iconWrapper.classList.add('error');
                iconI.className = 'fas fa-times-circle';
            } else {
                iconWrapper.classList.add('warning');
                iconI.className = 'fas fa-exclamation-triangle';
            }
        }

        function showConfirm(t, m, cb) { 
            setIconConfirmacao(t);
            confirmTitle.innerText = t; 
            confirmMessage.innerText = m; 
            btnConfirmOk.innerText = 'Confirmar'; 
            btnConfirmCancel.innerText = 'Cancelar'; 
            btnConfirmDiscard.style.display = 'none'; 
            confirmCallback = cb; 
            btnConfirmCancel.style.display = 'inline-block'; 
            confirmModal.style.display = 'flex'; 
        }

        function showWarning(m, t = 'Aviso') { 
            setIconConfirmacao(t);
            confirmTitle.innerText = t; 
            confirmMessage.innerText = m; 
            btnConfirmOk.innerText = 'OK'; 
            btnConfirmCancel.style.display = 'none'; 
            btnConfirmDiscard.style.display = 'none'; 
            confirmCallback = null; 
            confirmModal.style.display = 'flex'; 
        }

        function showUnsavedChangesModal(m, onSave, onDiscard) { 
            setIconConfirmacao('Alterações não salvas');
            confirmTitle.innerText = 'Alterações não salvas'; 
            confirmMessage.innerText = m; 
            btnConfirmOk.innerText = 'Salvar'; 
            btnConfirmCancel.innerText = 'Cancelar'; 
            btnConfirmDiscard.style.display = 'inline-block'; 
            confirmCallback = onSave; 
            confirmModal.style.display = 'flex'; 
            btnConfirmDiscard.onclick = function() { if (onDiscard) onDiscard(); confirmModal.style.display = 'none'; btnConfirmDiscard.style.display = 'none'; btnConfirmCancel.style.display = 'inline-block'; btnConfirmOk.innerText = 'Confirmar'; confirmCallback = null; restoreActiveMenuItem(); }; 
        }

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
            if (municipiosCache && municipiosCache.length > 0) { originalItems = municipiosCache; currentItems = municipiosCache; openGenericModal('Pesquisa Município e DDDs', 'Informe o município ou DDD:', municipiosCache, 'municipio'); return; }
            openGenericModal('Pesquisa Município e DDDs', 'Carregando...', [], 'municipio');
            const m = await carregarMunicipiosDaAPI();
            if (m && m.length > 0) { originalItems = m; currentItems = m; renderGenericList(); genericModalSubtitle.innerText = 'Informe o município ou DDD:'; }
            else { genericModalBody.innerHTML = '<p style="padding:15px;text-align:center;color:#666;">Nenhum município disponível.</p>'; genericModalSubtitle.innerText = 'Falha ao carregar municípios.'; }
        });
        document.getElementById('menu-natureza').addEventListener('click', async () => { const s = await carregarSituacoesCadastrais(); originalItems = s; openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', s, 'natureza'); });
        document.getElementById('menu-dashboard').addEventListener('click', function() { if (segmentScreen.style.display === 'block') { if (isDirty) { showUnsavedChangesModal('Deseja salvar antes de sair?', function() { document.getElementById('segmentoForm').requestSubmit(); showScreen('main'); }, function() { resetSegmentForm(); showScreen('main'); }); } else showScreen('main'); return; } if (mainScreen.style.display !== 'block') showScreen('main'); else { setActiveMenuItem('menu-dashboard'); closeAllModals(); } });
        document.getElementById('menu-segmentos').addEventListener('click', function() { if (segmentScreen.style.display === 'block') { setActiveMenuItem('menu-segmentos'); return; } showScreen('segment'); });
        document.getElementById('menu-ignorados').addEventListener('click', function() { if (ignoradosScreen.style.display === 'block') { setActiveMenuItem('menu-ignorados'); return; } showScreen('ignorados'); });
        document.getElementById('menu-mapa').addEventListener('click', function() { showScreen('mapa'); });
        document.getElementById('menu-vendedores').addEventListener('click', function() { showScreen('vendedores'); if (window.__ativarAbaVendedoresEmpresas) window.__ativarAbaVendedoresEmpresas('vendedores'); });
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

        if (campoMunicipio) campoMunicipio.style.display = 'none';
        initializeCustomSelects();
        showScreen('main');

        (async function boot() {
            try {
                let ctxOk = false;
                try { const ctx = await carregarContexto(); ctxOk = !!ctx; } catch (e) {}
                if (!ctxOk) { ADMIN_MENU_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); const titulo = document.getElementById('gestao-menu-title'); if (titulo) titulo.style.display = 'none'; return; }
                aplicarGuardrailsAdmin();
                if (contextoCache?.semAcesso) {
                    const main = document.getElementById('main-screen');
                    if (main) main.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:70vh;text-align:center;gap:16px;padding:40px;"><i class="fas fa-lock" style="font-size:72px;color:#94a3b8;"></i><h2 style="color:var(--text-main);font-size:24px;margin:0;">Sem acesso ao PROSPECT</h2><p style="color:var(--text-secondary);max-width:480px;font-size:15px;line-height:1.6;margin:0;">Você ainda não tem empresas concedidas.<br>Entre em contato com o administrador para solicitar acesso.</p><p style="color:#94a3b8;font-size:12px;margin-top:20px;">${contextoCache.motivoAcesso || 'Acesso não permitido'}</p></div>`;
                    return;
                }
                await Promise.all([carregarUFs(), carregarDDDs(), carregarCnaesIniciais()]);
                await carregarSegmentos(); updateSegmentFilter(); await carregarIgnorados(); carregarMunicipiosDaAPI().catch(() => {});
            } catch (e) { console.error('❌ Erro no boot:', e); }
        })();

        // ============================================================
        // MAPA
        // ============================================================
        window.mapFilters = { uf: null };
        let terraLayer = null, stateLayer = null, municipiosLayer = null;
        const vendedoresLayers = {};
        const TERRA_CACHE_KEY = 'deltafrio_terra_geojson_v1';
        const UFS_CACHE_KEY = 'deltafrio_ufs_geojson_v18';
        const MUN_CACHE_KEY = 'deltafrio_municipios_geojson_v10';
        let terraGeojsonCache = null, ufsGeojsonCache = null, municipiosGeojsonCache = null;

        function isDark() { return document.body.classList.contains('dark-mode'); }
        function getTerraStyle() { const d = isDark(); return { color: d ? '#64748b' : '#94a3b8', weight: 0.6, opacity: 0.9, fill: true, fillColor: d ? '#1e293b' : '#f1f5f9', fillOpacity: 1 }; }
        function getStateStyle() { const d = isDark(); return { color: d ? '#94a3b8' : '#475569', weight: 1.5, opacity: 1, fill: true, fillColor: d ? '#334155' : '#e2e8f0', fillOpacity: 1 }; }
        function getMunicipalityStyle() { const d = isDark(); return { color: d ? '#475569' : '#94a3b8', weight: 0.4, opacity: 0.6, fill: false }; }
        function getVendedorStyle(v) { return { color: v.cor, weight: 1.5, opacity: 0.95, fill: true, fillColor: v.cor, fillOpacity: 0.75 }; }
        function getVendedorHoverStyle(v) { return { color: v.cor, weight: 3, opacity: 1, fill: true, fillColor: v.cor, fillOpacity: 0.95 }; }

        async function carregarTerraGeoJSON() {
            if (terraGeojsonCache) return terraGeojsonCache;
            try { const c = localStorage.getItem(TERRA_CACHE_KEY); if (c) { terraGeojsonCache = JSON.parse(c); return terraGeojsonCache; } } catch (e) {}
            try { const r = await fetch('https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json'); if (!r.ok) throw new Error(`HTTP ${r.status}`); terraGeojsonCache = await r.json(); try { localStorage.setItem(TERRA_CACHE_KEY, JSON.stringify(terraGeojsonCache)); } catch (e) {} return terraGeojsonCache; } catch (e) { return null; }
        }
        async function carregarUfsGeoJSON() {
            if (ufsGeojsonCache) return ufsGeojsonCache;
            try { const c = localStorage.getItem(UFS_CACHE_KEY); if (c) { ufsGeojsonCache = JSON.parse(c); return ufsGeojsonCache; } } catch (e) {}
            try { const r = await fetch(`${API_MAPAS}/ufs`, { credentials: 'include', headers: { 'Accept': 'application/json' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); ufsGeojsonCache = await r.json(); try { localStorage.setItem(UFS_CACHE_KEY, JSON.stringify(ufsGeojsonCache)); } catch (e) {} return ufsGeojsonCache; } catch (e) { return null; }
        }
        async function carregarMunicipiosGeoJSON() {
            if (municipiosGeojsonCache) return municipiosGeojsonCache;
            try { const c = localStorage.getItem(MUN_CACHE_KEY); if (c) { municipiosGeojsonCache = JSON.parse(c); return municipiosGeojsonCache; } } catch (e) {}
            try { const r = await fetch(`${API_MAPAS}/municipios`, { credentials: 'include', headers: { 'Accept': 'application/json' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); municipiosGeojsonCache = await r.json(); try { localStorage.setItem(MUN_CACHE_KEY, JSON.stringify(municipiosGeojsonCache)); } catch (e) {} return municipiosGeojsonCache; } catch (e) { return null; }
        }

        function criarCamadaTerra(g) { return g ? L.geoJSON(g, { style: () => getTerraStyle(), interactive: false }) : null; }
        function criarCamadaEstados(g) { return g ? L.geoJSON(g, { style: () => getStateStyle(), interactive: false }) : null; }
        function criarCamadaMunicipios(g) { return g ? L.geoJSON(g, { style: () => getMunicipalityStyle(), interactive: false }) : null; }

        function garantirPadraoZebrado(map, cores) {
            const container = map.getRenderer({ options: {} })._container;
            let defs = container.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                container.appendChild(defs);
            }

            const coresLimpa = cores.map(c => c.replace('#', '')).join('-');
            const id = `zebra-${coresLimpa}`;

            if (!defs.querySelector(`#${id}`)) {
                const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
                pattern.setAttribute('id', id);
                pattern.setAttribute('width', '24');
                pattern.setAttribute('height', '24');
                pattern.setAttribute('patternUnits', 'userSpaceOnUse');
                pattern.setAttribute('patternTransform', 'rotate(45)');

                const numCores = cores.length;
                const larguraListra = 24 / numCores;

                cores.forEach((cor, i) => {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('width', larguraListra.toString());
                    rect.setAttribute('height', '24');
                    rect.setAttribute('x', (i * larguraListra).toString());
                    rect.setAttribute('fill', cor);
                    pattern.appendChild(rect);
                });

                defs.appendChild(pattern);
            }
            return id;
        }

        function atualizarEstiloFeature(l, v, map) {
            const f = l.feature;
            const props = f.properties || {};
            const cod = String(props.codigoIbge || props.codigo || '').trim();
            if (!cod) return;

            const ativos = getVendedoresAtivosDaCidade(cod);
            const estaAtivo = ativos.some(a => a.vendedor.id === v.id);

            if (!estaAtivo) {
                l.setStyle({ opacity: 0, fillOpacity: 0 }); 
                return;
            }

            let style = getVendedorStyle(v);
            let tooltipClass = 'vendedor-tooltip custom-tooltip';

            if (ativos.length > 1) {
                const cores = ativos.map(a => a.vendedor.cor);
                const patternId = garantirPadraoZebrado(map, cores);
                style = {
                    color: '#64748b',
                    weight: 1.5,
                    fillColor: `url(#${patternId})`,
                    fillOpacity: 1
                };
                tooltipClass = 'vendedor-tooltip custom-tooltip custom-tooltip-conflict';
            }

            l.setStyle(style);

            const nomeCidade = props.nome || props.municipio || 'Cidade';
            let tooltipTexto = '';
            
            if (ativos.length > 1) {
                tooltipTexto += `<div style="font-size: 20px; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px;">${nomeCidade}</div>`;
                tooltipTexto += `<div style="color: #fbbf24; font-size: 16px; font-weight: bold; margin-bottom: 10px;">⚠️ Sobreposição de Área</div>`;
                ativos.forEach(item => {
                    const label = item.origem === 'manual' ? 'Cidade Direta' : `DDD`;
                    tooltipTexto += `<div style="font-size: 15px; margin-bottom: 6px;">• <strong>${item.vendedor.nome}</strong> <span style="color:#94a3b8; font-size: 13px;">(${label})</span></div>`;
                });
            } else {
                tooltipTexto += `<div style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">${nomeCidade}</div>`;
                tooltipTexto += `<div style="font-size: 14px;">Vendedor: <strong>${v.nome}</strong></div>`;
            }

            l.unbindTooltip();
            l.bindTooltip(tooltipTexto, { 
                direction: 'top', 
                offset: [0, -12], 
                className: tooltipClass,
                opacity: 1 
            });
        }

        function criarCamadaVendedor(g, v) {
            if (!g || !g.features) return null;

            const features = g.features.filter(f => {
                const cod = String(f.properties?.codigoIbge || f.properties?.codigo || '').trim();
                if (!cod) return false;
                return v.cidades.some(c => c.codigoIbge === cod);
            });
            
            if (!features.length) return null;
            
            return L.geoJSON({ type: 'FeatureCollection', features }, {
                onEachFeature: (f, l) => {
                    atualizarEstiloFeature(l, v, window.mapInstance);
                    
                    l.on('mouseover', function() { 
                        if (window.mapInstance) {
                            window.mapInstance.eachLayer(function(layer) {
                                if (layer.closeTooltip && layer !== this) layer.closeTooltip();
                            });
                        }
                        const props = l.feature.properties || {};
                        const cod = String(props.codigoIbge || props.codigo || '').trim();
                        const ativos = getVendedoresAtivosDaCidade(cod);
                        
                        if (ativos.length > 1) {
                            this.setStyle({ weight: 3, color: '#ffffff' }); 
                        } else {
                            this.setStyle(getVendedorHoverStyle(v)); 
                        }
                        this.bringToFront(); 
                        this.openTooltip(); 
                    });
                    
                    l.on('mouseout', function() { 
                        atualizarEstiloFeature(l, v, window.mapInstance);
                        this.closeTooltip(); 
                    });
                }
            });
        }

        function atualizarEstilosVisiveis() {
            if (!window.mapInstance) return;
            Object.keys(vendedoresLayers).forEach(id => {
                const layer = vendedoresLayers[id];
                if (!layer || !layer.eachLayer) return;

                const v = vendedoresMapa.find(x => x.id === id);
                if (!v) return;

                if (window.mapInstance.hasLayer(layer)) {
                    layer.eachLayer(l => {
                        atualizarEstiloFeature(l, v, window.mapInstance);
                    });
                }
            });
        }

        window.loadMapData = function() {
            const map = window.mapInstance; if (!map || !stateLayer) return;
            if (window.mapFilters.uf) { const uf = window.mapFilters.uf.toUpperCase(); const feats = stateLayer.getLayers().filter(l => (l.feature.properties?.uf || '').toUpperCase() === uf); if (feats.length) { map.fitBounds(L.featureGroup(feats).getBounds(), { padding: [20, 20] }); return; } }
            map.fitBounds(stateLayer.getBounds(), { padding: [20, 20] });
        };

        async function renderStatsVendedores(map) {
            const container = document.getElementById('vendedores-stats'); if (!container || !map) return;
            let html = '';
            vendedoresMapa.forEach(v => {
                const qtd = v.quantidadeMunicipios || 0;
                const pf = Number(v.populacaoTotal || 0).toLocaleString('pt-BR');
                
                html += `<label class="vendedor-stat" data-vendedor="${v.id}" style="--vendedor-cor:${v.cor};"><input type="checkbox" class="vendedor-stat-checkbox" data-vendedor="${v.id}"><div class="vendedor-stat-body"><div class="vendedor-stat-header"><span class="vendedor-stat-color" style="background:${v.cor};"></span><span class="vendedor-stat-nome">${v.nome}</span></div><div class="vendedor-stat-numbers"><div class="vendedor-stat-num"><strong>${qtd}</strong><small>cidades</small></div><div class="vendedor-stat-num"><strong>${pf}</strong><small>pessoas</small></div></div></div></label>`;
            });
            container.innerHTML = html;
            container.querySelectorAll('.vendedor-stat-checkbox').forEach(cb => {
                cb.addEventListener('change', function(e) {
                    e.stopPropagation(); 
                    const card = this.closest('.vendedor-stat'); 
                    const layer = vendedoresLayers[this.dataset.vendedor];
                    
                    if (this.checked) { 
                        card.classList.add('active'); 
                        if (layer) layer.addTo(map); 
                    } else { 
                        card.classList.remove('active'); 
                        if (layer) map.removeLayer(layer); 
                    }
                    
                    atualizarEstilosVisiveis();
                });
            });
        }

        async function initMap() {
            const container = document.getElementById('map'); if (!container) return;
            await carregarVendedoresMapa();
            const map = L.map('map', { minZoom: 3, maxZoom: 13, zoomControl: true, attributionControl: false }).setView([-14.2350, -51.9253], 4);
            window.mapInstance = map;
            const terra = await carregarTerraGeoJSON(); if (terra) { terraLayer = criarCamadaTerra(terra); if (terraLayer) terraLayer.addTo(map); }
            const ufs = await carregarUfsGeoJSON(); if (ufs) { stateLayer = criarCamadaEstados(ufs); if (stateLayer) { stateLayer.addTo(map); map.fitBounds(stateLayer.getBounds(), { padding: [20, 20] }); } }
            const mun = await carregarMunicipiosGeoJSON();
            if (mun) {
                municipiosLayer = criarCamadaMunicipios(mun); if (municipiosLayer) municipiosLayer.addTo(map);
                vendedoresMapa.forEach(v => { const layer = criarCamadaVendedor(mun, v); if (layer) vendedoresLayers[v.id] = layer; });
            }
            const origFilterUf = document.getElementById('filter-uf');
            if (origFilterUf) { const origOnChange = origFilterUf.onchange; origFilterUf.onchange = function(e) { if (origOnChange) origOnChange.call(this, e); window.mapFilters.uf = this.value || null; window.loadMapData(); }; }
            const btnTema = document.getElementById('btn-dark-mode');
            if (btnTema) { btnTema.addEventListener('click', function() { setTimeout(() => { if (terraLayer) terraLayer.setStyle(() => getTerraStyle()); if (stateLayer) stateLayer.setStyle(() => getStateStyle()); if (municipiosLayer) municipiosLayer.setStyle(() => getMunicipalityStyle()); vendedoresMapa.forEach(v => { const l = vendedoresLayers[v.id]; if (l) l.setStyle(() => getVendedorStyle(v)); }); }, 100); }); }
            renderStatsVendedores(map);
        }
        window.initMap = initMap;

        window.recarregarMapaDados = async function() {
            if (!window.mapInstance) return;
            vendedoresMapaCarregados = false;
            vendedoresMapa = [];
            Object.keys(vendedoresLayers).forEach(id => {
                if (vendedoresLayers[id]) window.mapInstance.removeLayer(vendedoresLayers[id]);
                delete vendedoresLayers[id];
            });
            await carregarVendedoresMapa();
            const mun = await carregarMunicipiosGeoJSON();
            if (mun && window.mapInstance) {
                vendedoresMapa.forEach(v => {
                    const layer = criarCamadaVendedor(mun, v);
                    if (layer) {
                        vendedoresLayers[v.id] = layer;
                        const cb = document.querySelector(`.vendedor-stat-checkbox[data-vendedor="${v.id}"]`);
                        if (cb && cb.checked) layer.addTo(window.mapInstance);
                    }
                });
                renderStatsVendedores(window.mapInstance);
            }
            atualizarEstilosVisiveis();
        };

        window.limparCacheIgnoradosDebug = function () { limparCacheIgnorados(); console.log('🧹 Cache de ignorados limpo.'); };
        window.recarregarIgnoradosDebug = function () { limparCacheIgnorados(); ignoradosCarregados = false; ignorados = []; ignoradosFiltrados = []; carregarIgnorados(); console.log('🔄 Ignorados recarregados.'); };
        window.forcarAdmin = function () { const expiraEm = Date.now() + 30 * 60 * 1000; sessionStorage.setItem('deltafrio_force_admin', String(expiraEm)); console.log('✅ Admin forçado por 30 minutos. F5 para aplicar.'); };
        window.removerForcarAdmin = function () { sessionStorage.removeItem('deltafrio_force_admin'); console.log('✅ Override removido. F5 para aplicar.'); };
        window.verificarAdmin = function () { console.log('👤 Sessão:', sessaoCache?.usuario || '(não carregada)'); console.log('📋 Contexto:', contextoCache); console.log('🔑 administradorGlobal:', contextoCache?.administradorGlobal); console.log('🔑 semAcesso:', contextoCache?.semAcesso || false); console.log('🔑 funcionalidades:', contextoCache?.funcionalidades); };

        window.AppCore = {
            apiGet, apiPost, apiPut, apiPatch: null, apiDelete,
            apiGetEnvelope,
            obterCsrf,
            showScreen, setActiveMenuItem, registerScreen,
            showWarning, showConfirm,
            refreshCustomSelect, formatarTelefone,
            extrairErroResposta,
            API_URL,
            getMapInstance: () => window.mapInstance,
            getVendedores: () => vendedoresMapa,
            carregarVendedoresMapa,
            recarregarMapaDados: window.recarregarMapaDados,
            getContexto: () => contextoCache,
            getEmpresaAtivaId: () => obterEmpresaAtivaId(),
            setEmpresaAtivaId: (id) => definirEmpresaAtivaId(id),
            carregarContexto,
            limparCacheIgnorados,
            isAdminGlobal,
            temFuncionalidade,
            aplicarGuardrailsAdmin,
        };
        console.log('✅ [AppCore] SDK completo disponível.');

    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
    }
});