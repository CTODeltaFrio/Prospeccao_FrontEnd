// ============================================================
// VENDEDORES — módulo independente
// Endpoints: /api/prospeccao/vendedores/*
//            /api/prospeccao/empresas
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // ✅ ESPERA O APPCORE REAL (não o fallback)
    // ============================================================
    function esperarAppCoreReal() {
        return new Promise((resolve, reject) => {
            let tentativas = 0;
            const MAX = 600; // 30 segundos
            const timer = setInterval(() => {
                if (window.AppCore && !window.AppCore.__isFallback) {
                    clearInterval(timer);
                    console.log('✅ [vendedores] AppCore REAL detectado');
                    resolve(window.AppCore);
                } else if (++tentativas >= MAX) {
                    clearInterval(timer);
                    reject(new Error('Timeout aguardando AppCore real (30s)'));
                }
            }, 50);
        });
    }

    (async () => {
        try { await esperarAppCoreReal(); }
        catch (err) { console.error('[vendedores] AppCore real nunca ficou pronto:', err.message); return; }

        console.log('✅ [vendedores] módulo inicializando...');

        // ============================================================
        // ✅ WRAPPERS DINÂMICOS — sempre pegam a versão ATUAL do AppCore
        // ============================================================
        const apiGet        = (...args) => window.AppCore.apiGet(...args);
        const apiPost       = (...args) => window.AppCore.apiPost(...args);
        const apiPut        = (...args) => window.AppCore.apiPut(...args);
        const apiPatch      = (...args) => window.AppCore.apiPatch(...args);
        const apiDelete     = (...args) => window.AppCore.apiDelete(...args);
        const apiGetEnvelope= (...args) => window.AppCore.apiGetEnvelope(...args);
        const showScreen    = (...args) => window.AppCore.showScreen(...args);
        const showWarning   = (...args) => window.AppCore.showWarning(...args);
        const showConfirm   = (...args) => window.AppCore.showConfirm(...args);
        const API_URL = '/api';

        const ENDPOINT = `${API_URL}/prospeccao/vendedores`;

        // ============================================================
        // EXTRAIR MENSAGEM DE ERRO
        // ============================================================
        function extrairMensagemErro(err) {
            if (!err) return 'Erro desconhecido';
            if (typeof err === 'string') return err;

            const traceId = err?.__raw?.traceId || err?.traceId || '';
            const sufixo = traceId ? ` (código: ${traceId})` : '';

            if (err instanceof Error) {
                const m = err.message || '';
                if (m === '[object Object]') {
                    const r = err.__raw;
                    const motivo = r?.erros?.[0]?.motivo || r?.message || 'Erro ao processar requisição';
                    return motivo + sufixo;
                }
                return m + sufixo;
            }
            if (err.erros && Array.isArray(err.erros) && err.erros.length) {
                const p = err.erros[0];
                return (p.motivo || p.message || p.title || 'Erro') + sufixo;
            }
            if (err.mensagem) return err.mensagem + sufixo;
            if (err.message) return err.message + sufixo;
            return String(err) + sufixo;
        }

        // --- Elementos ---
        const vendedoresScreen  = document.getElementById('vendedores-screen');
        const vendedorTableBody = document.getElementById('vendedor-table-body');
        const vendedorSearch    = document.getElementById('vendedor-search');
        const vendedorModal     = document.getElementById('vendedor-modal');
        const vendedorForm      = document.getElementById('vendedorForm');
        const btnSaveVendedor   = document.getElementById('btn-save-vendedor');

        const vendNome         = document.getElementById('vend-nome');
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

        const vendCidadeSearch  = document.getElementById('vend-cidade-search');
        const vendCidadeSugg    = document.getElementById('vend-cidade-suggestions');
        const vendCidadesList   = document.getElementById('vend-cidades-list');

        const vendDddSearch     = document.getElementById('vend-ddd-search');
        const vendDddSugg       = document.getElementById('vend-ddd-suggestions');
        const vendDddsList      = document.getElementById('vend-ddds-list');

        const vendUsuarioSearch = document.getElementById('vend-usuario-search');
        const vendUsuarioSugg   = document.getElementById('vend-usuario-suggestions');
        const vendUsuarioCard   = document.getElementById('vend-usuario-selected');
        const vendUsuarioAvatar = document.getElementById('vend-usuario-avatar');
        const vendUsuarioNome   = document.getElementById('vend-usuario-nome');
        const vendUsuarioEmail  = document.getElementById('vend-usuario-email');
        const vendUsuarioRemove = document.getElementById('vend-usuario-remove');

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
        let originalVendedorEmpresas = []; // ✅ Guarda o estado original das empresas

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

        function flashAutoFill(el) {
            if (!el) return;
            el.classList.remove('auto-filled');
            void el.offsetWidth;
            el.classList.add('auto-filled');
            setTimeout(() => el.classList.remove('auto-filled'), 1500);
        }

        function atualizarLimitesDocumento() {
            if (!vendCpfCnpj) return;
            const tipo = vendTipoPessoa?.value || '';
            const max = tipo === 'PF' ? 11 : 14;
            vendCpfCnpj.maxLength = max;

            let cleaned;
            if (tipo === 'PF') {
                cleaned = vendCpfCnpj.value.replace(/\D/g, '').slice(0, max);
            } else {
                cleaned = vendCpfCnpj.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
            }
            if (vendCpfCnpj.value !== cleaned) vendCpfCnpj.value = cleaned;
        }

        function higienizarFone() {
            if (!vendFone) return;
            const digits = vendFone.value.replace(/\D/g, '').slice(0, 11);
            if (vendFone.value !== digits) vendFone.value = digits;
        }

        // ============================================================
        // DROPDOWN DE CORES
        // ============================================================
        const CORES_DISPONIVEIS = [
            { hex: '#2463eb', nome: 'Azul' }, { hex: '#0ea5e9', nome: 'Céu' },
            { hex: '#06b6d4', nome: 'Ciano' }, { hex: '#14b8a6', nome: 'Teal' },
            { hex: '#10b981', nome: 'Esmeralda' }, { hex: '#22c55e', nome: 'Verde' },
            { hex: '#84cc16', nome: 'Lima' }, { hex: '#eab308', nome: 'Amarelo' },
            { hex: '#f59e0b', nome: 'Âmbar' }, { hex: '#f97316', nome: 'Laranja' },
            { hex: '#ef4444', nome: 'Vermelho' }, { hex: '#dc2626', nome: 'Carmim' },
            { hex: '#ec4899', nome: 'Rosa' }, { hex: '#a855f7', nome: 'Violeta' },
            { hex: '#8b5cf6', nome: 'Roxo' }, { hex: '#64748b', nome: 'Cinza' }
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
                return `<button type="button" class="${classes.join(' ')}" data-color="${c.hex}" data-nome="${c.nome}" title="${title}" style="background:${c.hex}; color:${c.hex};" ${isUsed ? 'disabled' : ''}></button>`;
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

        function abrirColorSelect() { if (!vendCorSelect) return; renderColorOptions(); vendCorSelect.classList.add('open'); }
        function fecharColorSelect() { if (vendCorSelect) vendCorSelect.classList.remove('open'); }

        if (vendCorTrigger) {
            vendCorTrigger.addEventListener('click', function (e) {
                e.stopPropagation();
                if (vendCorSelect.classList.contains('open')) fecharColorSelect();
                else abrirColorSelect();
            });
        }

        document.addEventListener('click', function (e) {
            if (vendCorSelect && !e.target.closest('#vend-cor-select')) fecharColorSelect();
        });

        if (vendTipoPessoa) vendTipoPessoa.addEventListener('change', atualizarLimitesDocumento);
        if (vendCpfCnpj) vendCpfCnpj.addEventListener('input', atualizarLimitesDocumento);
        if (vendFone) {
            vendFone.addEventListener('input', higienizarFone);
            vendFone.addEventListener('paste', () => setTimeout(higienizarFone, 0));
        }

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

            if (vendTipoPessoa && !vendTipoPessoa.value && u.cpf) {
                vendTipoPessoa.value = 'PF';
            }
            atualizarLimitesDocumento();

            if (u.nome && vendNome) {
                vendNome.value = u.nome;
                flashAutoFill(vendNome);
            }
            if (u.cpf && vendCpfCnpj) {
                const cpfDigitos = String(u.cpf).replace(/\D/g, '').slice(0, 11);
                if (cpfDigitos) {
                    vendCpfCnpj.value = cpfDigitos;
                    flashAutoFill(vendCpfCnpj);
                }
            }
            if (u.email && vendEmail) {
                vendEmail.value = u.email;
                flashAutoFill(vendEmail);
            }
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
        // EMPRESAS
        // ============================================================
        async function carregarListaEmpresas(forceRefresh = false) {
            if (!forceRefresh && empresasLista && empresasLista.length > 0) return empresasLista;
            if (empresasCarregando && empresasPromise) return empresasPromise;

            empresasCarregando = true;
            empresasPromise = (async () => {
                let lista = [];
                let fonte = 'nenhuma';

                try {
                    const ctx = window.AppCore.getContexto?.();
                    const empresasCtx = ctx?.empresas || [];
                    if (Array.isArray(empresasCtx) && empresasCtx.length > 0) {
                        lista = empresasCtx.map(e => ({
                            id: e.id ?? e.codigo,
                            nome: e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`,
                            cnpj: e.cnpj || ''
                        })).filter(e => e.id);
                        fonte = 'contexto';
                    }
                } catch (e) {}

                if (lista.length === 0) {
                    try {
                        const dados = await apiGetEnvelope(`${API_URL}/prospeccao/empresas`);
                        const arr = Array.isArray(dados) ? dados
                                  : (dados && Array.isArray(dados.registros))  ? dados.registros
                                  : (dados && Array.isArray(dados.itens))      ? dados.itens
                                  : (dados && Array.isArray(dados.empresas))   ? dados.empresas
                                  : (dados && Array.isArray(dados.content))    ? dados.content
                                  : [];

                        lista = arr.map(e => ({
                            id: e.id ?? e.codigo,
                            nome: e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`,
                            cnpj: e.cnpj || ''
                        })).filter(e => e.id);
                        fonte = 'endpoint';
                    } catch (e) {
                        console.warn('[vendedores] erro em GET /prospeccao/empresas:', e.message);
                    }
                }

                empresasLista = lista;
                console.log(`✅ [vendedores] ${empresasLista.length} empresa(s) carregada(s) (fonte: ${fonte})`);
                empresasCarregando = false;
                empresasPromise = null;
                return empresasLista;
            })();

            return empresasPromise;
        }

        window.__recarregarEmpresasVendedor = function () {
            empresasLista = null;
            return carregarListaEmpresas(true);
        };

        function buscarEmpresas(termo) {
            if (!empresasLista || !empresasLista.length) return [];
            if (!termo) return empresasLista.slice(0, 20);
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

            if (!empresasLista || empresasLista.length === 0) {
                vendEmpresaSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhuma empresa disponível.</div>';
                vendEmpresaSugg.classList.add('active');
                return;
            }

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

                if (t.length === 0 && empresasLista && empresasLista.length > 0) {
                    renderSugestoesEmpresas(empresasLista.slice(0, 20));
                    return;
                }

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
                await carregarListaEmpresas();
                if (!empresasLista || empresasLista.length === 0) {
                    renderSugestoesEmpresas([]);
                    return;
                }
                const t = vendEmpresaSearch.value.trim();
                if (t.length === 0) renderSugestoesEmpresas(empresasLista.slice(0, 20));
                else if (t.length >= 2) renderSugestoesEmpresas(buscarEmpresas(t));
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
                } catch (e) {
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
                    const r = await fetch(`${API_URL}/mapas/municipios`, { credentials: 'include', headers: { 'Accept': 'application/json' } });
                    if (r.ok) {
                        const geojson = await r.json();
                        if (geojson && Array.isArray(geojson.features) && geojson.features.length) {
                            municipiosLista = geojson.features.map(f => ({
                                codigoIbge: String(f.properties?.codigoIbge || f.properties?.codigo || '').trim(),
                                nome: f.properties?.nome || f.properties?.municipio || '',
                                uf: (f.properties?.uf || '').toUpperCase()
                            })).filter(m => m.codigoIbge && m.nome);
                            return municipiosLista;
                        }
                    }
                } catch (e) {}

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
                            return municipiosLista;
                        }
                    }
                } catch (e) {}

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
                console.log(`✅ [vendedores] ${vendedores.length} vendedor(es) carregado(s)`);
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
                const subPartes = [];
                if (v.empresaIds?.length) subPartes.push(`${v.empresaIds.length} empresa${v.empresaIds.length > 1 ? 's' : ''}`);
                if (v.ddds?.length) subPartes.push(`${v.ddds.length} DDD${v.ddds.length > 1 ? 's' : ''}`);
                if (v.cidades?.length) subPartes.push(`${v.cidades.length} cidade${v.cidades.length > 1 ? 's' : ''}`);
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
            if (vendNome) vendNome.value = '';
            if (vendTipoPessoa) vendTipoPessoa.value = '';
            if (vendCpfCnpj) { vendCpfCnpj.value = ''; vendCpfCnpj.maxLength = 14; }
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
            originalVendedorEmpresas = [];

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

            if (vendNome) vendNome.value = v.nome || '';
            if (vendTipoPessoa) vendTipoPessoa.value = v.tipoPessoa || '';
            atualizarLimitesDocumento();
            if (vendCpfCnpj) vendCpfCnpj.value = v.cpfCnpj || '';
            if (vendEmail) vendEmail.value = v.email || '';
            if (vendFone) vendFone.value = v.fone || '';
            aplicarCorSelecionada(v.cor || '#2463eb');

            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Editar vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Atualizar vendedor';

            currentVendedorCidades = Array.isArray(v.cidades) ? v.cidades.map(c => ({ ...c })) : [];
            currentVendedorDdds = Array.isArray(v.ddds) ? v.ddds.map(d => ({ ...d })) : [];
            currentVendedorEmpresas = Array.isArray(v.empresas)
                ? v.empresas.map(e => ({ id: e.id || e.empresaId, nome: e.nomeFantasia || e.razaoSocial || e.nome || `#${e.id}` }))
                : [];
            originalVendedorEmpresas = currentVendedorEmpresas.map(e => ({ ...e })); // ✅ Salva cópia

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
        // SINCRONIZAÇÃO DE CONCESSÕES
        // ============================================================
        async function sincronizarConcessoes(usuarioId, empresasIds) {
            if (!usuarioId) return { ok: false, motivo: 'usuarioId ausente' };
            if (!Array.isArray(empresasIds) || empresasIds.length === 0) {
                return { ok: false, motivo: 'nenhuma empresa vinculada' };
            }
            const novasEmpresas = [...new Set(empresasIds.map(id => Number(id)).filter(n => !isNaN(n) && n > 0))];
            if (novasEmpresas.length === 0) return { ok: false, motivo: 'IDs inválidos' };

            const fetchAcessos = async () => {
                try {
                    const resp = await apiGet(`${API_URL}/prospeccao/admin/usuarios/${usuarioId}/acessos`);
                    const dados = resp?.dados ?? resp;
                    return {
                        versao: dados?.versao ?? 0,
                        empresas: Array.isArray(dados?.empresas)
                            ? dados.empresas.map(e => Number(e.id ?? e.empresaId)).filter(n => !isNaN(n))
                            : [],
                        municipios: dados?.municipios || { modalidade: 'TODOS', ufs: [], ddds: [], codigosIbge: [] },
                        cnaes: dados?.cnaes || { modalidade: 'TODOS', codigos: [] }
                    };
                } catch (e) {
                    return {
                        versao: 0, empresas: [],
                        municipios: { modalidade: 'TODOS', ufs: [], ddds: [], codigosIbge: [] },
                        cnaes: { modalidade: 'TODOS', codigos: [] }
                    };
                }
            };

            const tentarSalvar = async (tentativa = 1) => {
                const atual = await fetchAcessos();
                const empresasFinal = [...new Set([...atual.empresas, ...novasEmpresas])];
                const payload = {
                    versao: atual.versao,
                    empresas: empresasFinal,
                    municipios: atual.municipios,
                    cnaes: atual.cnaes
                };
                try {
                    await apiPut(`${API_URL}/prospeccao/admin/usuarios/${usuarioId}/acessos`, payload);
                    console.log(`✅ [vendedores] Concessão sincronizada (user ${usuarioId}, ${empresasFinal.length} empresa(s))`);
                    return { ok: true, empresas: empresasFinal };
                } catch (err) {
                    const codigo = err?.codigo || '';
                    const ehConflito = codigo === 'versao_desatualizada' || codigo === 409;
                    if (ehConflito && tentativa < 2) return await tentarSalvar(tentativa + 1);
                    throw err;
                }
            };

            try {
                return await tentarSalvar(1);
            } catch (err) {
                console.warn('[vendedores] erro ao sincronizar concessão:', err?.message || err);
                return { ok: false, motivo: extrairMensagemErro(err), err };
            }
        }

        window.__sincronizarConcessoesVendedor = sincronizarConcessoes;

        // ============================================================
        // SUBMIT — com a lógica correta de PUT + POST/PATCH de empresas
        // ============================================================
        if (vendedorForm) {
            vendedorForm.addEventListener('submit', async e => {
                e.preventDefault();
                const nome = vendNome?.value.trim() || '';
                if (!nome) return showWarning('Informe o nome do vendedor.');
                if (!currentVendedorUsuario) return showWarning('Selecione um usuário do sistema para vincular ao vendedor.');

                const tipoPessoaRaw = (vendTipoPessoa?.value || '').toUpperCase().trim();
                const tipoPessoa = tipoPessoaRaw === 'F'  ? 'PF'
                                 : tipoPessoaRaw === 'J'  ? 'PJ'
                                 : tipoPessoaRaw === 'PF' ? 'PF'
                                 : tipoPessoaRaw === 'PJ' ? 'PJ'
                                 : '';
                if (!tipoPessoa) return showWarning('Informe o Tipo de Pessoa (Física ou Jurídica).');

                higienizarFone();
                atualizarLimitesDocumento();

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

                let resultadoConcessao = null;

                try {
                    let vendedorId = editingVendedorId;

                    if (editingVendedorId) {
                        // 1. Atualiza dados básicos (PUT)
                        await apiPut(`${ENDPOINT}/${editingVendedorId}`, payloadUpdate);
                        console.log(`[vendedores] PUT ok — id=${editingVendedorId}`);

                        // 2. Sincroniza Empresas (Adicionar / Remover)
                        const origIds = originalVendedorEmpresas.map(e => String(e.id));
                        const currIds = currentVendedorEmpresas.map(e => String(e.id));

                        const toAdd = currentVendedorEmpresas.filter(e => !origIds.includes(String(e.id)));
                        const toRemove = originalVendedorEmpresas.filter(e => !currIds.includes(String(e.id)));

                        for (const e of toAdd) {
                            try { 
                                await apiPost(`${ENDPOINT}/${editingVendedorId}/empresas`, { empresaId: e.id }); 
                                console.log(`[vendedores] Empresa ${e.id} adicionada.`);
                            } catch (err) { console.warn('Falha ao adicionar empresa:', err); }
                        }

                        for (const e of toRemove) {
                            try { 
                                await apiPatch(`${ENDPOINT}/${editingVendedorId}/empresas/${e.id}`, { ativo: 'N' }); 
                                console.log(`[vendedores] Empresa ${e.id} removida.`);
                            } catch (err) { console.warn('Falha ao remover empresa:', err); }
                        }

                    } else {
                        // 3. Cria novo vendedor (POST)
                        try {
                            const resp = await apiPost(ENDPOINT, payloadCadastro);
                            const dados = resp?.dados ?? resp;
                            vendedorId = dados?.id ?? dados?.codigo ?? dados?.vendedorId;
                            console.log(`[vendedores] POST ok — id=${vendedorId}`);
                        } catch (errCriacao) {
                            const msg = extrairMensagemErro(errCriacao).toLowerCase();
                            const eh503 = String(errCriacao?.message || '').includes('503')
                                       || msg.includes('não foi possível concluir');
                            if (!eh503) throw errCriacao;

                            const payloadMinimo = {
                                tipoPessoa, cpfCnpj: payloadCadastro.cpfCnpj, nome,
                                email: payloadCadastro.email, fone: payloadCadastro.fone,
                                loginIds: [], empresaIds: []
                            };
                            const resp = await apiPost(ENDPOINT, payloadMinimo);
                            const dados = resp?.dados ?? resp;
                            vendedorId = dados?.id ?? dados?.codigo ?? dados?.vendedorId;
                            console.log(`[vendedores] POST fallback ok — id=${vendedorId}`);

                            if (vendedorId && currentVendedorUsuario?.id) {
                                try { await apiPost(`${ENDPOINT}/${vendedorId}/logins`, { loginId: currentVendedorUsuario.id }); } catch (e) {}
                            }
                            if (vendedorId && currentVendedorEmpresas.length) {
                                for (const emp of currentVendedorEmpresas) {
                                    try { await apiPost(`${ENDPOINT}/${vendedorId}/empresas`, { empresaId: emp.id }); } catch (e) {}
                                }
                            }
                        }
                    }

                    // 4. Sincroniza Concessões
                    if (currentVendedorUsuario?.id && currentVendedorEmpresas.length > 0) {
                        resultadoConcessao = await sincronizarConcessoes(
                            currentVendedorUsuario.id,
                            currentVendedorEmpresas.map(e => e.id)
                        );
                    }

                    vendedorModal.style.display = 'none';
                    resetVendedorForm();
                    await carregarVendedores();

                    if (resultadoConcessao && resultadoConcessao.ok) {
                        showWarning('Vendedor salvo e acesso concedido com sucesso!', 'Sucesso');
                    } else if (resultadoConcessao && !resultadoConcessao.ok) {
                        showWarning('Vendedor salvo, mas não foi possível conceder acesso: ' + (resultadoConcessao.motivo || 'erro'), 'Aviso');
                    } else {
                        showWarning('Vendedor salvo com sucesso!', 'Sucesso');
                    }

                } catch (err) {
                    console.error('[vendedores] erro no submit:', err);
                    const msg = extrairMensagemErro(err);
                    showWarning('Erro ao salvar vendedor: ' + msg);
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
            carregarListaEmpresas(true).catch(() => {});
            carregarListaMunicipios().catch(() => {});
            carregarListaDdds().catch(() => {});
            carregarListaUsuarios().catch(() => {});
            vendedorModal.style.display = 'flex';
        };

        // ============================================================
        // BOOT DO MÓDULO
        // ============================================================
        await carregarVendedores();
        await carregarListaUsuarios().catch(() => {});
        await carregarListaEmpresas().catch(() => {});

        console.log('✅ [vendedores] módulo carregado.');
    })();
});