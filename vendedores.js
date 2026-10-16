// ============================================================
// VENDEDORES — módulo independente
// Endpoints:
//   /api/prospeccao/vendedores/*       (vendedores)
//   /api/prospeccao/empresas           (vínculo com empresas locais)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    function esperarAppCore() {
        return new Promise((resolve, reject) => {
            if (window.AppCore) return resolve(window.AppCore);
            let tentativas = 0;
            const MAX = 300;
            const timer = setInterval(() => {
                if (window.AppCore) { clearInterval(timer); resolve(window.AppCore); }
                else if (++tentativas >= MAX) { clearInterval(timer); reject(new Error('Timeout aguardando window.AppCore')); }
            }, 50);
        });
    }

    (async () => {
        let Core;
        try { Core = await esperarAppCore(); }
        catch (err) { console.error('[vendedores] AppCore nunca foi exposto:', err.message); return; }

        console.log('✅ [vendedores] AppCore obtido, inicializando módulo...');

        const { apiGet, apiPost, apiPut, apiDelete, apiGetEnvelope,
                showScreen, showWarning, showConfirm, API_URL } = Core;

        const ENDPOINT = `${API_URL}/prospeccao/vendedores`;

        // ============================================================
        // EXTRAIR MENSAGEM DE ERRO (envelope do backend)
        // ============================================================
        function extrairMensagemErro(err) {
            if (!err) return 'Erro desconhecido';
            if (typeof err === 'string') return err;
            if (err instanceof Error) {
                const m = err.message || '';
                if (m === '[object Object]') {
                    const r = err.__raw;
                    if (r && r.erros && Array.isArray(r.erros) && r.erros.length) {
                        const p = r.erros[0];
                        return p.motivo || p.message || p.title || JSON.stringify(p);
                    }
                    if (r && r.message) return r.message;
                    return 'Erro ao processar requisição';
                }
                return m;
            }
            if (err.erros && Array.isArray(err.erros) && err.erros.length) {
                const p = err.erros[0];
                return p.motivo || p.message || p.title || JSON.stringify(p);
            }
            if (err.message) return err.message;
            if (err.mensagem) return err.mensagem;
            if (err.detail) return err.detail;
            if (err.title) return err.title;
            if (err.traceId) return `Erro (traceId: ${err.traceId})`;
            return String(err);
        }

        // --- Elementos ---
        const vendedoresScreen  = document.getElementById('vendedores-screen');
        const vendedorTableBody = document.getElementById('vendedor-table-body');
        const vendedorSearch    = document.getElementById('vendedor-search');
        const vendedorModal     = document.getElementById('vendedor-modal');
        const vendedorForm      = document.getElementById('vendedorForm');
        const btnSaveVendedor   = document.getElementById('btn-save-vendedor');

        const vendTipoPessoa   = document.getElementById('vend-tipo-pessoa');
        const vendCpfCnpj      = document.getElementById('vend-cpf-cnpj');
        const vendEmail        = document.getElementById('vend-email');
        const vendFone         = document.getElementById('vend-fone');
        const vendCorInput     = document.getElementById('vend-cor');
        const vendCorSelect    = document.getElementById('vend-cor-select');
        const vendCorTrigger   = document.getElementById('vend-cor-trigger');
        const vendCorPreview   = document.getElementById('vend-cor-preview');
        const vendCorLabel     = document.getElementById('vend-cor-label');
        const vendCorOptions   = document.getElementById('vend-cor-options');

        // Cidades
        const vendCidadeSearch  = document.getElementById('vend-cidade-search');
        const vendCidadeSugg    = document.getElementById('vend-cidade-suggestions');
        const vendCidadesList   = document.getElementById('vend-cidades-list');

        // DDDs
        const vendDddSearch     = document.getElementById('vend-ddd-search');
        const vendDddSugg       = document.getElementById('vend-ddd-suggestions');
        const vendDddsList      = document.getElementById('vend-ddds-list');

        // Usuário
        const vendUsuarioSearch = document.getElementById('vend-usuario-search');
        const vendUsuarioSugg   = document.getElementById('vend-usuario-suggestions');
        const vendUsuarioCard   = document.getElementById('vend-usuario-selected');
        const vendUsuarioAvatar = document.getElementById('vend-usuario-avatar');
        const vendUsuarioNome   = document.getElementById('vend-usuario-nome');
        const vendUsuarioEmail  = document.getElementById('vend-usuario-email');
        const vendUsuarioRemove = document.getElementById('vend-usuario-remove');

        // Empresas
        const vendEmpresaSearch = document.getElementById('vend-empresa-search');
        const vendEmpresaSugg   = document.getElementById('vend-empresa-suggestions');
        const vendEmpresasList  = document.getElementById('vend-empresas-list');

        if (!vendedoresScreen) {
            console.warn('[vendedores] Tela não encontrada no DOM.');
            return;
        }

        // --- Estado ---
        let vendedores = [];
        let vendedoresCarregados = false;
        let editingVendedorId = null;

        let currentVendedorCidades = [];
        let currentVendedorDdds = [];
        let currentVendedorUsuario = null;
        let currentVendedorEmpresas = [];

        let municipiosLista = null;
        let municipiosCarregando = false;
        let municipiosPromise = null;
        let cidadeDebounce = null;

        let dddsDisponiveis = null;
        let dddsCarregando = false;
        let dddsPromise = null;

        let usuariosSistema = null;
        let usuariosCarregando = false;
        let usuarioDebounce = null;

        let empresasLista = null;
        let empresasCarregando = false;
        let empresasPromise = null;
        let empresaDebounce = null;

        // --- Helpers ---
        function formatarCPF(v) {
            const n = String(v || '').replace(/\D/g, '').slice(0, 11);
            if (!n) return '';
            return n.replace(/^(\d{3})(\d)/, '$1.$2')
                    .replace(/^(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        const iniciais = nome =>
            String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
        const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

        // ============================================================
        // DROPDOWN DE CORES
        // ============================================================
        const CORES_DISPONIVEIS = [
            { hex: '#2463eb', nome: 'Azul' },
            { hex: '#0ea5e9', nome: 'Céu' },
            { hex: '#06b6d4', nome: 'Ciano' },
            { hex: '#14b8a6', nome: 'Teal' },
            { hex: '#10b981', nome: 'Esmeralda' },
            { hex: '#22c55e', nome: 'Verde' },
            { hex: '#84cc16', nome: 'Lima' },
            { hex: '#eab308', nome: 'Amarelo' },
            { hex: '#f59e0b', nome: 'Âmbar' },
            { hex: '#f97316', nome: 'Laranja' },
            { hex: '#ef4444', nome: 'Vermelho' },
            { hex: '#dc2626', nome: 'Carmim' },
            { hex: '#ec4899', nome: 'Rosa' },
            { hex: '#a855f7', nome: 'Violeta' },
            { hex: '#8b5cf6', nome: 'Roxo' },
            { hex: '#64748b', nome: 'Cinza' }
        ];

        function coresEmUso() {
            const usadas = new Set();
            for (const v of vendedores) {
                if (editingVendedorId !== null && String(v.id) === String(editingVendedorId)) continue;
                if (v.cor) usadas.add(String(v.cor).toLowerCase());
            }
            return usadas;
        }

        function renderColorOptions() {
            if (!vendCorOptions) return;
            const corAtual = (vendCorInput?.value || '#2463eb').toLowerCase();
            const usadas = coresEmUso();

            vendCorOptions.innerHTML = CORES_DISPONIVEIS.map(c => {
                const corLower = c.hex.toLowerCase();
                const isSelected = corLower === corAtual;
                const isUsed = usadas.has(corLower) && !isSelected;
                const classes = ['color-option'];
                if (isSelected) classes.push('selected');
                if (isUsed) classes.push('used');
                const title = isUsed ? `${c.nome} (em uso por outro vendedor)` : c.nome;
                return `<button type="button"
                            class="${classes.join(' ')}"
                            data-color="${c.hex}"
                            data-nome="${c.nome}"
                            title="${title}"
                            style="background:${c.hex}; color:${c.hex};"
                            ${isUsed ? 'disabled' : ''}></button>`;
            }).join('');

            vendCorOptions.querySelectorAll('.color-option:not(.used)').forEach(btn => {
                btn.addEventListener('click', function () {
                    aplicarCorSelecionada(this.dataset.color);
                    fecharColorSelect();
                });
            });
        }

        function aplicarCorSelecionada(cor) {
            const corLower = String(cor || '#2463eb').toLowerCase();
            if (vendCorInput) vendCorInput.value = corLower;
            if (vendCorPreview) vendCorPreview.style.background = corLower;
            const info = CORES_DISPONIVEIS.find(c => c.hex.toLowerCase() === corLower);
            if (vendCorLabel) vendCorLabel.textContent = info ? info.nome : corLower;
            if (vendCorOptions) {
                vendCorOptions.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.toggle('selected', opt.dataset.color.toLowerCase() === corLower);
                    opt.style.color = opt.dataset.color;
                });
            }
        }

        function abrirColorSelect() {
            if (!vendCorSelect) return;
            renderColorOptions();
            vendCorSelect.classList.add('open');
        }
        function fecharColorSelect() {
            if (vendCorSelect) vendCorSelect.classList.remove('open');
        }

        if (vendCorTrigger) {
            vendCorTrigger.addEventListener('click', function (e) {
                e.stopPropagation();
                if (vendCorSelect.classList.contains('open')) fecharColorSelect();
                else abrirColorSelect();
            });
        }

        document.addEventListener('click', function (e) {
            if (vendCorSelect && !e.target.closest('#vend-cor-select')) {
                fecharColorSelect();
            }
        });

        // ============================================================
        // USUÁRIOS DO SISTEMA
        // ============================================================
        async function carregarListaUsuarios() {
            if (usuariosSistema) return usuariosSistema;
            if (usuariosCarregando) return [];

            usuariosCarregando = true;
            try {
                let r;
                try { r = await apiGet(`${API_URL}/auth/v2/admin/usuarios`); }
                catch (e) { r = await apiGet(`${API_URL}/logindelta/admin/usuarios`); }

                const lista = Array.isArray(r) ? r
                            : (r && Array.isArray(r.dados))    ? r.dados
                            : (r && Array.isArray(r.content))  ? r.content
                            : (r && Array.isArray(r.data))     ? r.data
                            : (r && Array.isArray(r.usuarios)) ? r.usuarios
                            : [];
                usuariosSistema = lista.map(u => ({
                    id: u.id, nome: u.nome || '', email: u.email || '',
                    cpf: u.cpf || '', situacao: u.situacao || ''
                }));
                console.log(`✅ [vendedores] ${usuariosSistema.length} usuários carregados`);
            } catch (e) { usuariosSistema = []; }
            usuariosCarregando = false;
            return usuariosSistema;
        }

        function buscarUsuarios(termo) {
            if (!usuariosSistema || !termo) return [];
            const t = normalizar(termo);
            const tCpf = String(termo).replace(/\D/g, '');
            const res = [];
            for (const u of usuariosSistema) {
                if (normalizar(u.nome).includes(t) ||
                    normalizar(u.email).includes(t) ||
                    (tCpf && String(u.cpf).replace(/\D/g, '').includes(tCpf))) {
                    res.push(u);
                    if (res.length >= 20) break;
                }
            }
            return res;
        }

        function renderUsuarioSelecionado() {
            if (!vendUsuarioCard) return;
            if (!currentVendedorUsuario) { vendUsuarioCard.style.display = 'none'; return; }
            vendUsuarioCard.style.display = 'flex';
            if (vendUsuarioAvatar) vendUsuarioAvatar.textContent = iniciais(currentVendedorUsuario.nome);
            if (vendUsuarioNome)   vendUsuarioNome.textContent = currentVendedorUsuario.nome || '—';
            if (vendUsuarioEmail)  vendUsuarioEmail.textContent = currentVendedorUsuario.email || (currentVendedorUsuario.cpf ? formatarCPF(currentVendedorUsuario.cpf) : '—');
        }

        function selecionarUsuario(u) {
            if (!u) return;
            currentVendedorUsuario = { ...u };
            renderUsuarioSelecionado();
            if (vendUsuarioSearch) vendUsuarioSearch.value = '';
            if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }
        }

        function renderSugestoesUsuarios(lista) {
            if (!vendUsuarioSugg) return;
            if (!lista.length) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; return; }
            vendUsuarioSugg.innerHTML = lista.map((u, i) => `
                <div class="autocomplete-item usuario-sugg-item" data-index="${i}">
                    <div class="usuario-sugg-avatar">${iniciais(u.nome)}</div>
                    <div class="usuario-sugg-info">
                        <span class="code">${u.nome || '—'}</span>
                        <span class="desc">${u.email || '—'}</span>
                    </div>
                </div>
            `).join('');
            vendUsuarioSugg.classList.add('active');
            vendUsuarioSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    selecionarUsuario(lista[i]);
                });
            });
        }

        if (vendUsuarioSearch) {
            vendUsuarioSearch.addEventListener('input', function () {
                clearTimeout(usuarioDebounce);
                const t = this.value.trim();
                if (t.length < 2) {
                    vendUsuarioSugg?.classList.remove('active');
                    if (vendUsuarioSugg) vendUsuarioSugg.innerHTML = '';
                    return;
                }
                usuarioDebounce = setTimeout(async () => {
                    await carregarListaUsuarios();
                    if (!usuariosSistema || !usuariosSistema.length) {
                        if (vendUsuarioSugg) {
                            vendUsuarioSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhum usuário disponível.</div>';
                            vendUsuarioSugg.classList.add('active');
                        }
                        return;
                    }
                    renderSugestoesUsuarios(buscarUsuarios(t));
                }, 250);
            });
            vendUsuarioSearch.addEventListener('focus', async () => {
                if (vendUsuarioSearch.value.trim().length >= 2) return;
                await carregarListaUsuarios();
            });
        }

        if (vendUsuarioRemove) {
            vendUsuarioRemove.addEventListener('click', () => {
                currentVendedorUsuario = null;
                renderUsuarioSelecionado();
            });
        }

        // ============================================================
        // EMPRESAS — lista local do PROSPECT (/api/prospeccao/empresas)
        // ============================================================
        async function carregarListaEmpresas() {
            if (empresasLista) return empresasLista;
            if (empresasCarregando && empresasPromise) return empresasPromise;

            empresasCarregando = true;
            empresasPromise = (async () => {
                try {
                    const dados = await apiGetEnvelope(`${API_URL}/prospeccao/empresas`);

                    const lista = Array.isArray(dados) ? dados
                                : (dados && Array.isArray(dados.registros))  ? dados.registros
                                : (dados && Array.isArray(dados.itens))      ? dados.itens
                                : (dados && Array.isArray(dados.empresas))   ? dados.empresas
                                : (dados && Array.isArray(dados.content))    ? dados.content
                                : [];

                    empresasLista = lista.map(e => ({
                        id: e.id ?? e.codigo,
                        nome: e.nomeFantasia || e.razaoSocial || `#${e.id}`,
                        cnpj: e.cnpj || ''
                    })).filter(e => e.id);

                    console.log(`✅ [vendedores] ${empresasLista.length} empresas carregadas de /prospeccao/empresas`);
                } catch (e) {
                    console.warn('[vendedores] erro ao carregar empresas:', e.message);
                    empresasLista = [];
                } finally {
                    empresasCarregando = false;
                    empresasPromise = null;
                }
                return empresasLista;
            })();

            return empresasPromise;
        }

        function buscarEmpresas(termo) {
            if (!empresasLista || !empresasLista.length) return [];
            if (!termo) return [];
            const t = normalizar(termo);
            const tNumeros = String(termo).replace(/\D/g, '');
            return empresasLista.filter(e => {
                if (normalizar(e.nome).includes(t)) return true;
                if (tNumeros && String(e.cnpj || '').includes(tNumeros)) return true;
                return false;
            }).slice(0, 20);
        }

        function renderEmpresasSelecionadas() {
            if (!vendEmpresasList) return;
            if (!currentVendedorEmpresas.length) {
                vendEmpresasList.innerHTML = '<span class="cidades-empty">Nenhuma empresa vinculada ainda.</span>';
                return;
            }
            vendEmpresasList.innerHTML = currentVendedorEmpresas.map((e, i) => `
                <span class="cidade-chip empresa-chip" data-index="${i}">
                    <span class="chip-nome">${e.nome}</span>
                    <button type="button" class="chip-remove" data-index="${i}" title="Remover">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');
            vendEmpresasList.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    currentVendedorEmpresas.splice(i, 1);
                    renderEmpresasSelecionadas();
                });
            });
        }

        function adicionarEmpresa(e) {
            if (!e) return;
            if (currentVendedorEmpresas.some(x => String(x.id) === String(e.id))) {
                showWarning('Esta empresa já está vinculada.');
                return;
            }
            currentVendedorEmpresas.push({ id: e.id, nome: e.nome });
            renderEmpresasSelecionadas();
        }

        function renderSugestoesEmpresas(lista) {
            if (!vendEmpresaSugg) return;
            if (!lista.length) {
                vendEmpresaSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhuma empresa encontrada.</div>';
                vendEmpresaSugg.classList.add('active');
                return;
            }
            vendEmpresaSugg.innerHTML = lista.map((e, i) => `
                <div class="autocomplete-item" data-index="${i}">
                    <span class="code">${e.nome}</span>
                    <span class="desc">${e.cnpj ? ' - ' + e.cnpj : ''}</span>
                </div>
            `).join('');
            vendEmpresaSugg.classList.add('active');
            vendEmpresaSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    adicionarEmpresa(lista[i]);
                    if (vendEmpresaSearch) vendEmpresaSearch.value = '';
                    vendEmpresaSugg.classList.remove('active');
                    vendEmpresaSugg.innerHTML = '';
                });
            });
        }

        if (vendEmpresaSearch) {
            vendEmpresaSearch.addEventListener('input', function () {
                clearTimeout(empresaDebounce);
                const t = this.value.trim();
                if (t.length < 2) {
                    vendEmpresaSugg?.classList.remove('active');
                    if (vendEmpresaSugg) vendEmpresaSugg.innerHTML = '';
                    return;
                }
                empresaDebounce = setTimeout(async () => {
                    await carregarListaEmpresas();
                    renderSugestoesEmpresas(buscarEmpresas(t));
                }, 200);
            });
            vendEmpresaSearch.addEventListener('focus', async () => {
                if (vendEmpresaSearch.value.trim().length >= 2) return;
                if (!empresasLista) await carregarListaEmpresas();
            });
        }

        // ============================================================
        // DDDs
        // ============================================================
        async function carregarListaDdds() {
            if (dddsDisponiveis && dddsDisponiveis.length > 0) return dddsDisponiveis;
            if (dddsCarregando && dddsPromise) return dddsPromise;

            dddsCarregando = true;
            dddsPromise = (async () => {
                try {
                    const r = await apiGet(`${API_URL}/ddds`);
                    const lista = Array.isArray(r) ? r
                                : (r && Array.isArray(r.data))    ? r.data
                                : (r && Array.isArray(r.results)) ? r.results
                                : [];
                    dddsDisponiveis = lista.map(d => ({
                        ddd: String(d.ddd || '').trim(),
                        descricao: d.descricao || ''
                    })).filter(d => d.ddd);
                    console.log(`✅ [vendedores] ${dddsDisponiveis.length} DDDs carregados`);
                } catch (e) {
                    console.warn('[vendedores] erro ao carregar DDDs:', e.message);
                    dddsDisponiveis = [];
                } finally {
                    dddsCarregando = false;
                    dddsPromise = null;
                }
                return dddsDisponiveis;
            })();

            return dddsPromise;
        }

        function buscarDdds(termo) {
            if (!dddsDisponiveis || !termo) return [];
            const t = String(termo).replace(/\D/g, '');
            if (!t) return [];
            return dddsDisponiveis.filter(d => d.ddd.startsWith(t)).slice(0, 20);
        }

        function renderVendedorDdds() {
            if (!vendDddsList) return;
            if (!currentVendedorDdds.length) {
                vendDddsList.innerHTML = '<span class="cidades-empty">Nenhum DDD vinculado ainda.</span>';
                return;
            }
            vendDddsList.innerHTML = currentVendedorDdds.map((d, i) => `
                <span class="cidade-chip ddd-chip" data-index="${i}">
                    <span class="chip-nome">DDD ${d.ddd}</span>
                    <span class="chip-uf">${d.descricao || ''}</span>
                    <button type="button" class="chip-remove" data-index="${i}" title="Remover">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');
            vendDddsList.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    currentVendedorDdds.splice(i, 1);
                    renderVendedorDdds();
                });
            });
        }

        function adicionarDdd(ddd) {
            if (!ddd) return;
            if (currentVendedorDdds.some(d => String(d.ddd) === String(ddd.ddd))) {
                showWarning('Este DDD já está vinculado.');
                return;
            }
            currentVendedorDdds.push({ ddd: String(ddd.ddd), descricao: ddd.descricao || '' });
            renderVendedorDdds();
        }

        function renderSugestoesDdds(lista) {
            if (!vendDddSugg) return;
            if (!lista.length) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; return; }
            vendDddSugg.innerHTML = lista.map((d, i) => `
                <div class="autocomplete-item" data-index="${i}">
                    <span class="code">DDD ${d.ddd}</span>
                    <span class="desc"> - ${d.descricao || '—'}</span>
                </div>
            `).join('');
            vendDddSugg.classList.add('active');
            vendDddSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    adicionarDdd(lista[i]);
                    if (vendDddSearch) vendDddSearch.value = '';
                    vendDddSugg.classList.remove('active');
                    vendDddSugg.innerHTML = '';
                });
            });
        }

        if (vendDddSearch) {
            vendDddSearch.addEventListener('input', async function () {
                const raw = this.value.replace(/\D/g, '').slice(0, 3);
                this.value = raw;
                if (!raw) { vendDddSugg?.classList.remove('active'); if (vendDddSugg) vendDddSugg.innerHTML = ''; return; }
                await carregarListaDdds();
                renderSugestoesDdds(buscarDdds(raw));
            });
            vendDddSearch.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const raw = this.value.replace(/\D/g, '');
                if (!raw) return;
                const match = (dddsDisponiveis || []).find(d => d.ddd === raw);
                if (match) {
                    adicionarDdd(match);
                    this.value = '';
                    vendDddSugg?.classList.remove('active');
                    if (vendDddSugg) vendDddSugg.innerHTML = '';
                } else {
                    showWarning(`DDD ${raw} não encontrado.`);
                }
            });
            vendDddSearch.addEventListener('focus', async () => { await carregarListaDdds(); });
        }

        // ============================================================
        // CIDADES
        // ============================================================
        async function carregarListaMunicipios() {
            if (municipiosLista) return municipiosLista;
            if (municipiosCarregando && municipiosPromise) return municipiosPromise;

            municipiosCarregando = true;
            municipiosPromise = (async () => {
                try {
                    const r = await fetch(`${API_URL}/mapas/municipios`, { headers: { 'Accept': 'application/json' } });
                    if (r.ok) {
                        const geojson = await r.json();
                        if (geojson && Array.isArray(geojson.features) && geojson.features.length) {
                            municipiosLista = geojson.features.map(f => ({
                                codigoIbge: String(f.properties?.codigoIbge || f.properties?.codigo || '').trim(),
                                nome: f.properties?.nome || f.properties?.municipio || '',
                                uf: (f.properties?.uf || '').toUpperCase()
                            })).filter(m => m.codigoIbge && m.nome);
                            console.log(`✅ [vendedores] ${municipiosLista.length} municípios carregados`);
                            return municipiosLista;
                        }
                    }
                } catch (e) { /* segue */ }

                try {
                    const cached = localStorage.getItem('deltafrio_municipios_geojson_v10');
                    if (cached) {
                        const geojson = JSON.parse(cached);
                        if (geojson.features) {
                            municipiosLista = geojson.features.map(f => ({
                                codigoIbge: String(f.properties?.codigoIbge || f.properties?.codigo || '').trim(),
                                nome: f.properties?.nome || f.properties?.municipio || '',
                                uf: (f.properties?.uf || '').toUpperCase()
                            })).filter(m => m.codigoIbge && m.nome);
                            console.log(`✅ [vendedores] ${municipiosLista.length} municípios do cache`);
                            return municipiosLista;
                        }
                    }
                } catch (e) { /* segue */ }

                municipiosLista = [];
                return municipiosLista;
            })();

            try { return await municipiosPromise; }
            finally { municipiosCarregando = false; municipiosPromise = null; }
        }

        function buscarMunicipios(termo) {
            if (!municipiosLista || !termo) return [];
            const t = normalizar(termo);
            const res = [];
            for (const m of municipiosLista) {
                if (normalizar(m.nome).includes(t)) { res.push(m); if (res.length >= 20) break; }
            }
            return res;
        }

        function renderVendedorCidades() {
            if (!vendCidadesList) return;
            if (!currentVendedorCidades.length) {
                vendCidadesList.innerHTML = '<span class="cidades-empty">Nenhuma cidade vinculada ainda.</span>';
                return;
            }
            vendCidadesList.innerHTML = currentVendedorCidades.map((c, i) => `
                <span class="cidade-chip" data-index="${i}">
                    <span class="chip-nome">${c.nome}</span>
                    <span class="chip-uf">${c.uf || ''}</span>
                    <button type="button" class="chip-remove" data-index="${i}" title="Remover">
                        <i class="fas fa-times"></i>
                    </button>
                </span>
            `).join('');
            vendCidadesList.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    currentVendedorCidades.splice(i, 1);
                    renderVendedorCidades();
                });
            });
        }

        function adicionarCidade(m) {
            if (!m) return;
            if (currentVendedorCidades.some(c => c.codigoIbge === m.codigoIbge)) {
                showWarning('Esta cidade já está vinculada.');
                return;
            }
            currentVendedorCidades.push({ codigoIbge: m.codigoIbge, nome: m.nome, uf: m.uf || '' });
            renderVendedorCidades();
        }

        function renderSugestoesCidades(lista) {
            if (!vendCidadeSugg) return;
            if (!lista.length) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; return; }
            vendCidadeSugg.innerHTML = lista.map((m, i) => `
                <div class="autocomplete-item" data-index="${i}">
                    <span class="code">${m.nome}</span>
                    <span class="desc"> - ${m.uf || '—'} · ${m.codigoIbge}</span>
                </div>
            `).join('');
            vendCidadeSugg.classList.add('active');
            vendCidadeSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () {
                    const i = parseInt(this.dataset.index, 10);
                    adicionarCidade(lista[i]);
                    vendCidadeSearch.value = '';
                    vendCidadeSugg.classList.remove('active');
                    vendCidadeSugg.innerHTML = '';
                });
            });
        }

        if (vendCidadeSearch) {
            vendCidadeSearch.addEventListener('input', function () {
                clearTimeout(cidadeDebounce);
                const t = this.value.trim();
                if (t.length < 2) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; return; }
                cidadeDebounce = setTimeout(async () => {
                    await carregarListaMunicipios();
                    renderSugestoesCidades(buscarMunicipios(t));
                }, 200);
            });
            vendCidadeSearch.addEventListener('focus', async () => {
                if (vendCidadeSearch.value.trim().length >= 2) return;
                if (!municipiosLista) await carregarListaMunicipios();
            });
        }

        document.addEventListener('click', (e) => {
            if (vendCidadeSearch && !e.target.closest('.cidade-search-wrapper')) vendCidadeSugg?.classList.remove('active');
            if (vendDddSearch && !e.target.closest('.cidade-search-wrapper')) vendDddSugg?.classList.remove('active');
            if (vendUsuarioSearch && !e.target.closest('#vend-usuario-wrapper')) vendUsuarioSugg?.classList.remove('active');
            if (vendEmpresaSearch && !e.target.closest('#vend-empresa-wrapper')) vendEmpresaSugg?.classList.remove('active');
        });

        // ============================================================
        // CARREGAR VENDEDORES
        // ============================================================
        async function carregarVendedores() {
            try {
                const dados = await apiGetEnvelope(ENDPOINT);
                const lista = Array.isArray(dados) ? dados
                            : (dados && Array.isArray(dados.registros))  ? dados.registros
                            : (dados && Array.isArray(dados.itens))      ? dados.itens
                            : (dados && Array.isArray(dados.vendedores)) ? dados.vendedores
                            : [];
                vendedores = lista.map(normalizarVendedor);
                vendedoresCarregados = true;
                renderVendedorTable();
            } catch (e) {
                console.warn('[vendedores] erro ao carregar:', e.message);
                vendedores = [];
                vendedoresCarregados = true;
                renderVendedorTable();
            }
        }

        function normalizarVendedor(v) {
            const usuarioId = v.usuarioId ?? v.loginId ?? (Array.isArray(v.loginIds) ? v.loginIds[0] : null);
            const empresaIds = Array.isArray(v.empresaIds) ? v.empresaIds : (Array.isArray(v.empresas) ? v.empresas.map(e => e.id) : []);
            return {
                id: v.id ?? v.codigo,
                nome: v.nome || '',
                email: v.email || '',
                fone: v.fone || v.telefone || '',
                tipoPessoa: v.tipoPessoa || '',
                cpfCnpj: v.cpfCnpj || '',
                ativo: v.ativo !== false && v.ativo !== '0' && v.ativo !== 'N',
                cor: v.cor || '#2463eb',
                usuarioId: usuarioId,
                empresaIds: empresaIds,
                empresas: Array.isArray(v.empresas) ? v.empresas : [],
                cidades: Array.isArray(v.cidades) ? v.cidades : [],
                ddds: Array.isArray(v.ddds) ? v.ddds : [],
                empresasCount: v.empresasCount ?? empresaIds.length ?? 0
            };
        }

        // ============================================================
        // RENDERIZAR TABELA
        // ============================================================
        function renderVendedorTable(filtro = '') {
            if (!vendedorTableBody) return;
            const term = String(filtro).toLowerCase().trim();
            vendedorTableBody.innerHTML = '';
            const lista = !term ? vendedores : vendedores.filter(v =>
                v.nome.toLowerCase().includes(term) ||
                (v.email || '').toLowerCase().includes(term) ||
                (v.fone || '').toLowerCase().includes(term) ||
                (v.cpfCnpj || '').includes(term)
            );
            if (!lista.length) {
                vendedorTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">Nenhum vendedor cadastrado.</td></tr>`;
                return;
            }
            lista.forEach(v => {
                const cls = v.ativo ? 'on' : 'off';
                const txt = v.ativo ? 'Ativo' : 'Inativo';
                const totalCidades = (v.cidades || []).length;
                const totalDdds = (v.ddds || []).length;
                const totalEmpresas = (v.empresaIds || []).length;
                const subPartes = [];
                if (totalEmpresas) subPartes.push(`${totalEmpresas} empresa${totalEmpresas > 1 ? 's' : ''}`);
                if (totalDdds)    subPartes.push(`${totalDdds} DDD${totalDdds > 1 ? 's' : ''}`);
                if (totalCidades) subPartes.push(`${totalCidades} cidade${totalCidades > 1 ? 's' : ''}`);
                const sub = subPartes.length ? subPartes.join(' • ') : 'Sem vínculos';

                const usuario = v.usuarioId ? (usuariosSistema || []).find(u => String(u.id) === String(v.usuarioId)) : null;
                const usuarioHtml = usuario
                    ? `<span class="vendedor-usuario-chip"><i class="fas fa-user-check"></i> ${usuario.nome}</span>`
                    : (v.usuarioId
                        ? `<span class="vendedor-usuario-chip pendente"><i class="fas fa-user"></i> #${v.usuarioId}</span>`
                        : `<span class="vendedor-usuario-chip ausente"><i class="fas fa-user-slash"></i></span>`);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div class="avatar-mini" style="background:${v.cor};">${iniciais(v.nome)}</div></td>
                    <td><strong>${v.nome || '-'}</strong><br><small style="color:var(--text-secondary);font-size:11px;">${usuarioHtml}</small></td>
                    <td>${v.email || '-'}</td>
                    <td>${v.fone || '—'}</td>
                    <td>${sub}</td>
                    <td style="text-align:center;"><strong>${v.empresasCount || 0}</strong></td>
                    <td style="text-align:center;"><span class="vendedor-ativo-badge ${cls}">${txt}</span></td>
                    <td style="text-align:center;white-space:nowrap;">
                        <button class="btn-table btn-edit" data-action="edit" data-id="${v.id}" title="Editar"><i class="fas fa-pen"></i></button>
                    </td>`;
                vendedorTableBody.appendChild(tr);
            });
            vendedorTableBody.querySelectorAll('button[data-action]').forEach(b => {
                b.addEventListener('click', function () {
                    const { action, id } = this.dataset;
                    if (action === 'edit') editarVendedor(id);
                });
            });
        }

        // ============================================================
        // FORM
        // ============================================================
        function resetVendedorForm() {
            editingVendedorId = null;
            const nomeEl = document.getElementById('vend-nome'); if (nomeEl) nomeEl.value = '';
            if (vendTipoPessoa) vendTipoPessoa.value = '';
            if (vendCpfCnpj) vendCpfCnpj.value = '';
            if (vendEmail) vendEmail.value = '';
            if (vendFone) vendFone.value = '';
            aplicarCorSelecionada('#2463eb');
            fecharColorSelect();
            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Cadastro de vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Salvar vendedor';

            currentVendedorCidades = [];
            currentVendedorDdds = [];
            currentVendedorUsuario = null;
            currentVendedorEmpresas = [];

            if (vendCidadeSearch) vendCidadeSearch.value = '';
            if (vendCidadeSugg) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; }
            if (vendDddSearch) vendDddSearch.value = '';
            if (vendDddSugg) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; }
            if (vendUsuarioSearch) vendUsuarioSearch.value = '';
            if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }
            if (vendEmpresaSearch) vendEmpresaSearch.value = '';
            if (vendEmpresaSugg) { vendEmpresaSugg.classList.remove('active'); vendEmpresaSugg.innerHTML = ''; }

            renderVendedorCidades();
            renderVendedorDdds();
            renderUsuarioSelecionado();
            renderEmpresasSelecionadas();
        }

        async function editarVendedor(id) {
            const v = vendedores.find(x => String(x.id) === String(id)); if (!v) return;
            editingVendedorId = v.id;

            const nomeEl = document.getElementById('vend-nome'); if (nomeEl) nomeEl.value = v.nome || '';
            if (vendTipoPessoa) vendTipoPessoa.value = v.tipoPessoa || '';
            if (vendCpfCnpj) vendCpfCnpj.value = v.cpfCnpj || '';
            if (vendEmail) vendEmail.value = v.email || '';
            if (vendFone) vendFone.value = v.fone || '';
            aplicarCorSelecionada(v.cor || '#2463eb');

            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Editar vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Atualizar vendedor';

            currentVendedorCidades = Array.isArray(v.cidades) ? v.cidades.map(c => ({ ...c })) : [];
            currentVendedorDdds = Array.isArray(v.ddds) ? v.ddds.map(d => ({ ...d })) : [];
            currentVendedorEmpresas = Array.isArray(v.empresas)
                ? v.empresas.map(e => ({ id: e.id, nome: e.nomeFantasia || e.razaoSocial || e.nome || `#${e.id}` }))
                : [];

            await carregarListaUsuarios();
            if (v.usuarioId) {
                const u = (usuariosSistema || []).find(x => String(x.id) === String(v.usuarioId));
                currentVendedorUsuario = u ? { ...u } : { id: v.usuarioId, nome: `Usuário #${v.usuarioId}`, email: '', cpf: '' };
            } else {
                currentVendedorUsuario = null;
            }

            renderVendedorCidades();
            renderVendedorDdds();
            renderUsuarioSelecionado();
            renderEmpresasSelecionadas();

            carregarListaMunicipios().catch(() => {});
            carregarListaDdds().catch(() => {});
            carregarListaEmpresas().catch(() => {});
            renderColorOptions();

            vendedorModal.style.display = 'flex';
        }

        // ============================================================
        // SUBMIT — vendedor com tipoPessoa PF/PJ (exigido pelo backend)
        // ============================================================
        if (vendedorForm) {
            vendedorForm.addEventListener('submit', async e => {
                e.preventDefault();
                const nome = document.getElementById('vend-nome').value.trim();
                if (!nome) return showWarning('Informe o nome do vendedor.');
                if (!currentVendedorUsuario) return showWarning('Selecione um usuário do sistema para vincular ao vendedor.');

                // tipoPessoa é obrigatório (PF ou PJ)
                const tipoPessoaRaw = (vendTipoPessoa?.value || '').toUpperCase().trim();
                const tipoPessoa = tipoPessoaRaw === 'F'  ? 'PF'
                                 : tipoPessoaRaw === 'J'  ? 'PJ'
                                 : tipoPessoaRaw === 'PF' ? 'PF'
                                 : tipoPessoaRaw === 'PJ' ? 'PJ'
                                 : '';
                if (!tipoPessoa) return showWarning('Informe o Tipo de Pessoa (Física ou Jurídica).');

                // Monta payload completo
                const payloadCadastro = {
                    tipoPessoa,
                    cpfCnpj: vendCpfCnpj?.value.trim() || null,
                    nome,
                    email: vendEmail?.value.trim() || null,
                    fone:  vendFone?.value.trim()  || null,
                    loginIds: [currentVendedorUsuario.id],
                    empresaIds: currentVendedorEmpresas.map(e => e.id)
                };

                const payloadUpdate = {
                    tipoPessoa,
                    cpfCnpj: payloadCadastro.cpfCnpj,
                    nome: payloadCadastro.nome,
                    email: payloadCadastro.email,
                    fone:  payloadCadastro.fone
                };

                btnSaveVendedor.disabled = true;
                const orig = btnSaveVendedor.innerText;
                btnSaveVendedor.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

                try {
                    let vendedorId = editingVendedorId;

                    // ---------- ETAPA 1: criar/atualizar vendedor ----------
                    if (editingVendedorId) {
                        await apiPut(`${ENDPOINT}/${editingVendedorId}`, payloadUpdate);
                        console.log(`[vendedores] PUT ok — id=${editingVendedorId}`);
                    } else {
                        console.log('[vendedores] POST payload =', JSON.stringify(payloadCadastro, null, 2));
                        try {
                            const resp = await apiPost(ENDPOINT, payloadCadastro);
                            const dados = resp?.dados ?? resp;
                            vendedorId = dados?.id ?? dados?.codigo ?? dados?.vendedorId;
                            console.log(`[vendedores] POST ok — id=${vendedorId}`);
                        } catch (errCriacao) {
                            // Fallback: se der 503 por causa de loginIds/empresaIds, tenta sem eles
                            const msg = extrairMensagemErro(errCriacao).toLowerCase();
                            const eh503 = String(errCriacao?.message || '').includes('503')
                                       || msg.includes('não foi possível concluir');
                            if (!eh503) throw errCriacao;

                            console.warn('[vendedores] POST falhou com 503 — tentando sem loginIds/empresaIds...');
                            const payloadMinimo = {
                                tipoPessoa,
                                cpfCnpj: payloadCadastro.cpfCnpj,
                                nome,
                                email: payloadCadastro.email,
                                fone:  payloadCadastro.fone,
                                loginIds: [],
                                empresaIds: []
                            };
                            console.log('[vendedores] POST fallback payload =', JSON.stringify(payloadMinimo, null, 2));
                            const resp = await apiPost(ENDPOINT, payloadMinimo);
                            const dados = resp?.dados ?? resp;
                            vendedorId = dados?.id ?? dados?.codigo ?? dados?.vendedorId;
                            console.log(`[vendedores] POST fallback ok — id=${vendedorId}`);

                            // vincula login e empresas separadamente
                            if (vendedorId && currentVendedorUsuario?.id) {
                                try {
                                    await apiPost(`${ENDPOINT}/${vendedorId}/logins`, { loginId: currentVendedorUsuario.id });
                                    console.log(`[vendedores] login vinculado`);
                                } catch (errL) {
                                    console.warn('[vendedores] falha ao vincular login:', errL);
                                }
                            }
                            if (vendedorId && currentVendedorEmpresas.length) {
                                for (const emp of currentVendedorEmpresas) {
                                    try {
                                        await apiPost(`${ENDPOINT}/${vendedorId}/empresas`, { empresaId: emp.id });
                                        console.log(`[vendedores] empresa ${emp.id} vinculada`);
                                    } catch (errE) {
                                        console.warn(`[vendedores] falha ao vincular empresa ${emp.id}:`, errE);
                                    }
                                }
                            }
                        }
                    }

                    vendedorModal.style.display = 'none';
                    resetVendedorForm();
                    await carregarVendedores();
                    showWarning('Vendedor salvo com sucesso!', 'Sucesso');

                } catch (err) {
                    console.error('[vendedores] erro no submit:', err);
                    showWarning('Erro ao salvar vendedor: ' + extrairMensagemErro(err));
                } finally {
                    btnSaveVendedor.disabled = false;
                    btnSaveVendedor.innerText = orig;
                }
            });
        }

        // ============================================================
        // EVENTOS DOS MODAIS
        // ============================================================
        document.getElementById('btn-cancel-vendedor')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        document.getElementById('close-vendedor-modal')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        vendedorModal?.addEventListener('click', e => { if (e.target === vendedorModal) { vendedorModal.style.display = 'none'; resetVendedorForm(); } });

        vendedorSearch?.addEventListener('input', function () { renderVendedorTable(this.value); });

        document.getElementById('menu-vendedores')?.addEventListener('click', () => {
            showScreen('vendedores');
            if (window.__ativarAbaVendedoresEmpresas) {
                window.__ativarAbaVendedoresEmpresas('vendedores');
            }
        });

        window.novoVendedor = function () {
            resetVendedorForm();
            renderColorOptions();
            carregarListaMunicipios().catch(() => {});
            carregarListaDdds().catch(() => {});
            carregarListaEmpresas().catch(() => {});
            carregarListaUsuarios().catch(() => {});
            vendedorModal.style.display = 'flex';
        };

        if (Core.registerScreen && vendedoresScreen) {
            Core.registerScreen('vendedores', vendedoresScreen);
        }

        // Pré-carrega
        carregarVendedores();
        carregarListaUsuarios().catch(() => {});
        carregarListaEmpresas().catch(() => {});

        console.log('✅ [vendedores] módulo carregado.');
    })();
});