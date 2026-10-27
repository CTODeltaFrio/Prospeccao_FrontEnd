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
        // ✅ WRAPPERS DINÂMICOS
        // ============================================================
        const apiGet        = (...args) => window.AppCore.apiGet(...args);
        const apiPost       = (...args) => window.AppCore.apiPost(...args);
        const apiPut        = (...args) => window.AppCore.apiPut(...args);
        const apiGetEnvelope= (...args) => window.AppCore.apiGetEnvelope(...args);
        const showScreen    = (...args) => window.AppCore.showScreen(...args);
        const showWarning   = (...args) => window.AppCore.showWarning(...args);
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

        if (!vendedoresScreen) return console.warn('[vendedores] Tela não encontrada no DOM.');

        // --- Estado ---
        let vendedores = [];
        let editingVendedorId = null;
        let currentVendedorCidades = [];
        let currentVendedorDdds = [];
        let currentVendedorUsuario = null;
        let currentVendedorEmpresas = [];
        let originalVendedorEmpresas = []; 
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
            return n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
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
            if (tipo === 'PF') cleaned = vendCpfCnpj.value.replace(/\D/g, '').slice(0, max);
            else cleaned = vendCpfCnpj.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, max);
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
                const lista = Array.isArray(r) ? r : (r && Array.isArray(r.dados)) ? r.dados : (r && Array.isArray(r.content)) ? r.content : (r && Array.isArray(r.data)) ? r.data : (r && Array.isArray(r.usuarios)) ? r.usuarios : [];
                usuariosSistema = lista.map(u => ({ id: u.id, nome: u.nome || '', email: u.email || '', cpf: u.cpf || '', situacao: u.situacao || '' }));
            } catch (e) { usuariosSistema = []; }
            usuariosCarregando = false;
            return usuariosSistema;
        }

        function buscarUsuarios(termo) {
            if (!usuariosSistema || !termo) return [];
            const t = normalizar(termo); const tCpf = String(termo).replace(/\D/g, '');
            const res = [];
            for (const u of usuariosSistema) {
                if (normalizar(u.nome).includes(t) || normalizar(u.email).includes(t) || (tCpf && String(u.cpf).replace(/\D/g, '').includes(tCpf))) {
                    res.push(u); if (res.length >= 20) break;
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
            if (vendTipoPessoa && !vendTipoPessoa.value && u.cpf) vendTipoPessoa.value = 'PF';
            atualizarLimitesDocumento();
            if (u.nome && vendNome) { vendNome.value = u.nome; flashAutoFill(vendNome); }
            if (u.cpf && vendCpfCnpj) {
                const cpfDigitos = String(u.cpf).replace(/\D/g, '').slice(0, 11);
                if (cpfDigitos) { vendCpfCnpj.value = cpfDigitos; flashAutoFill(vendCpfCnpj); }
            }
            if (u.email && vendEmail) { vendEmail.value = u.email; flashAutoFill(vendEmail); }
        }

        function renderSugestoesUsuarios(lista) {
            if (!vendUsuarioSugg) return;
            if (!lista.length) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; return; }
            vendUsuarioSugg.innerHTML = lista.map((u, i) => `
                <div class="autocomplete-item usuario-sugg-item" data-index="${i}">
                    <div class="usuario-sugg-avatar">${iniciais(u.nome)}</div>
                    <div class="usuario-sugg-info"><span class="code">${u.nome || '—'}</span><span class="desc">${u.email || '—'}</span></div>
                </div>`).join('');
            vendUsuarioSugg.classList.add('active');
            vendUsuarioSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); selecionarUsuario(lista[i]); });
            });
        }

        if (vendUsuarioSearch) {
            vendUsuarioSearch.addEventListener('input', function () {
                clearTimeout(usuarioDebounce);
                const t = this.value.trim();
                if (t.length < 2) { vendUsuarioSugg?.classList.remove('active'); if (vendUsuarioSugg) vendUsuarioSugg.innerHTML = ''; return; }
                usuarioDebounce = setTimeout(async () => {
                    await carregarListaUsuarios();
                    if (!usuariosSistema || !usuariosSistema.length) {
                        if (vendUsuarioSugg) { vendUsuarioSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhum usuário disponível.</div>'; vendUsuarioSugg.classList.add('active'); }
                        return;
                    }
                    renderSugestoesUsuarios(buscarUsuarios(t));
                }, 250);
            });
            vendUsuarioSearch.addEventListener('focus', async () => { if (vendUsuarioSearch.value.trim().length >= 2) return; await carregarListaUsuarios(); });
        }

        if (vendUsuarioRemove) { vendUsuarioRemove.addEventListener('click', () => { currentVendedorUsuario = null; renderUsuarioSelecionado(); }); }

        // ============================================================
        // EMPRESAS
        // ============================================================
        async function carregarListaEmpresas(forceRefresh = false) {
            if (!forceRefresh && empresasLista && empresasLista.length > 0) return empresasLista;
            if (empresasCarregando && empresasPromise) return empresasPromise;
            empresasCarregando = true;
            empresasPromise = (async () => {
                let lista = [];
                try {
                    const ctx = window.AppCore.getContexto?.();
                    if (Array.isArray(ctx?.empresas) && ctx.empresas.length > 0) {
                        lista = ctx.empresas.map(e => ({ id: e.id ?? e.codigo, nome: e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`, cnpj: e.cnpj || '' })).filter(e => e.id);
                    }
                } catch (e) {}
                if (lista.length === 0) {
                    try {
                        const dados = await apiGetEnvelope(`${API_URL}/prospeccao/empresas`);
                        const arr = Array.isArray(dados) ? dados : (dados && Array.isArray(dados.registros)) ? dados.registros : (dados && Array.isArray(dados.itens)) ? dados.itens : (dados && Array.isArray(dados.empresas)) ? dados.empresas : (dados && Array.isArray(dados.content)) ? dados.content : [];
                        lista = arr.map(e => ({ id: e.id ?? e.codigo, nome: e.nome || e.nomeFantasia || e.razaoSocial || `#${e.id}`, cnpj: e.cnpj || '' })).filter(e => e.id);
                    } catch (e) {}
                }
                empresasLista = lista;
                empresasCarregando = false;
                empresasPromise = null;
                return empresasLista;
            })();
            return empresasPromise;
        }

        function buscarEmpresas(termo) {
            if (!empresasLista || !empresasLista.length) return [];
            if (!termo) return empresasLista.slice(0, 20);
            const t = normalizar(termo); const tNumeros = String(termo).replace(/\D/g, '');
            return empresasLista.filter(e => normalizar(e.nome).includes(t) || (tNumeros && String(e.cnpj || '').includes(tNumeros))).slice(0, 20);
        }

        function renderEmpresasSelecionadas() {
            if (!vendEmpresasList) return;
            if (!currentVendedorEmpresas.length) { vendEmpresasList.innerHTML = '<span class="cidades-empty">Nenhuma empresa vinculada ainda.</span>'; return; }
            vendEmpresasList.innerHTML = currentVendedorEmpresas.map((e, i) => `
                <span class="cidade-chip empresa-chip" data-index="${i}">
                    <span class="chip-nome">${e.nome}</span>
                    <button type="button" class="chip-remove" data-index="${i}" title="Remover"><i class="fas fa-times"></i></button>
                </span>`).join('');
            vendEmpresasList.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); currentVendedorEmpresas.splice(i, 1); renderEmpresasSelecionadas(); });
            });
        }

        function adicionarEmpresa(e) {
            if (!e) return;
            if (currentVendedorEmpresas.some(x => String(x.id) === String(e.id))) return showWarning('Esta empresa já está vinculada.');
            currentVendedorEmpresas.push({ id: e.id, nome: e.nome });
            renderEmpresasSelecionadas();
        }

        function renderSugestoesEmpresas(lista) {
            if (!vendEmpresaSugg) return;
            if (!empresasLista || empresasLista.length === 0) { vendEmpresaSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhuma empresa disponível.</div>'; vendEmpresaSugg.classList.add('active'); return; }
            if (!lista.length) { vendEmpresaSugg.innerHTML = '<div class="usuario-sugg-empty">Nenhuma empresa encontrada.</div>'; vendEmpresaSugg.classList.add('active'); return; }
            vendEmpresaSugg.innerHTML = lista.map((e, i) => `<div class="autocomplete-item" data-index="${i}"><span class="code">${e.nome}</span><span class="desc">${e.cnpj ? ' - ' + e.cnpj : ''}</span></div>`).join('');
            vendEmpresaSugg.classList.add('active');
            vendEmpresaSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); adicionarEmpresa(lista[i]); if (vendEmpresaSearch) vendEmpresaSearch.value = ''; vendEmpresaSugg.classList.remove('active'); vendEmpresaSugg.innerHTML = ''; });
            });
        }

        if (vendEmpresaSearch) {
            vendEmpresaSearch.addEventListener('input', function () {
                clearTimeout(empresaDebounce);
                const t = this.value.trim();
                if (t.length === 0 && empresasLista && empresasLista.length > 0) { renderSugestoesEmpresas(empresasLista.slice(0, 20)); return; }
                if (t.length < 2) { vendEmpresaSugg?.classList.remove('active'); if (vendEmpresaSugg) vendEmpresaSugg.innerHTML = ''; return; }
                empresaDebounce = setTimeout(async () => { await carregarListaEmpresas(); renderSugestoesEmpresas(buscarEmpresas(t)); }, 200);
            });
            vendEmpresaSearch.addEventListener('focus', async () => { await carregarListaEmpresas(); if (!empresasLista || empresasLista.length === 0) { renderSugestoesEmpresas([]); return; } const t = vendEmpresaSearch.value.trim(); if (t.length === 0) renderSugestoesEmpresas(empresasLista.slice(0, 20)); else if (t.length >= 2) renderSugestoesEmpresas(buscarEmpresas(t)); });
        }

        // ============================================================
        // DDDs e CIDADES
        // ============================================================
        async function carregarListaDdds() {
            if (dddsDisponiveis && dddsDisponiveis.length > 0) return dddsDisponiveis;
            if (dddsCarregando && dddsPromise) return dddsPromise;
            dddsCarregando = true;
            dddsPromise = (async () => {
                try {
                    const r = await apiGet(`${API_URL}/ddds`);
                    const lista = Array.isArray(r) ? r : (r && Array.isArray(r.data)) ? r.data : (r && Array.isArray(r.results)) ? r.results : [];
                    dddsDisponiveis = lista.map(d => ({ ddd: String(d.ddd || '').trim(), descricao: d.descricao || '' })).filter(d => d.ddd);
                } catch (e) { dddsDisponiveis = []; } finally { dddsCarregando = false; dddsPromise = null; }
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
            if (!currentVendedorDdds.length) { vendDddsList.innerHTML = '<span class="cidades-empty">Nenhum DDD vinculado ainda.</span>'; return; }
            vendDddsList.innerHTML = currentVendedorDdds.map((d, i) => `<span class="cidade-chip ddd-chip" data-index="${i}"><span class="chip-nome">DDD ${d.ddd}</span><span class="chip-uf">${d.descricao || ''}</span><button type="button" class="chip-remove" data-index="${i}" title="Remover"><i class="fas fa-times"></i></button></span>`).join('');
            vendDddsList.querySelectorAll('.chip-remove').forEach(btn => {
                btn.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); currentVendedorDdds.splice(i, 1); renderVendedorDdds(); });
            });
        }

        async function adicionarDdd(ddd) {
            if (!ddd) return;
            if (currentVendedorDdds.some(d => String(d.ddd) === String(ddd.ddd))) return showWarning('Este DDD já está vinculado.');
            
            currentVendedorDdds.push({ ddd: String(ddd.ddd), descricao: ddd.descricao || '' });
            renderVendedorDdds();
            
            // ✅ NOVO: Auto-popular cidades do DDD
            try {
                const res = await apiGet(`${API_URL}/ddds/${ddd.ddd}/municipios`);
                const lista = Array.isArray(res) ? res : (res && Array.isArray(res.dados)) ? res.dados : [];
                if (!municipiosLista) await carregarListaMunicipios(); // Garante a lista global para pegar o código IBGE
                
                let novasCidades = 0;
                for (const m of lista) {
                    let cod = m.codigoIbge || m.codigo;
                    const nome = m.municipio || m.nome;
                    
                    // Fallback: tenta achar o IBGE na lista geral pelo nome
                    if (!cod && municipiosLista) {
                        const found = municipiosLista.find(x => normalizar(x.nome) === normalizar(nome));
                        if (found) cod = found.codigoIbge;
                    }
                    
                    if (cod && !currentVendedorCidades.some(c => c.codigoIbge === String(cod))) {
                        currentVendedorCidades.push({ codigoIbge: String(cod), nome: nome, uf: m.uf || ddd.descricao || '' });
                        novasCidades++;
                    }
                }
                
                if (novasCidades > 0) {
                    renderVendedorCidades();
                }
            } catch (e) {
                console.warn('Erro ao buscar cidades do DDD', e);
            }
        }

        function renderSugestoesDdds(lista) {
            if (!vendDddSugg) return;
            if (!lista.length) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; return; }
            vendDddSugg.innerHTML = lista.map((d, i) => `<div class="autocomplete-item" data-index="${i}"><span class="code">DDD ${d.ddd}</span><span class="desc"> - ${d.descricao || '—'}</span></div>`).join('');
            vendDddSugg.classList.add('active');
            vendDddSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); adicionarDdd(lista[i]); if (vendDddSearch) vendDddSearch.value = ''; vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; });
            });
        }

        if (vendDddSearch) {
            vendDddSearch.addEventListener('input', async function () {
                const raw = this.value.replace(/\D/g, '').slice(0, 3); this.value = raw;
                if (!raw) { vendDddSugg?.classList.remove('active'); if (vendDddSugg) vendDddSugg.innerHTML = ''; return; }
                await carregarListaDdds(); renderSugestoesDdds(buscarDdds(raw));
            });
            vendDddSearch.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return; e.preventDefault();
                const raw = this.value.replace(/\D/g, ''); if (!raw) return;
                const match = (dddsDisponiveis || []).find(d => d.ddd === raw);
                if (match) { adicionarDdd(match); this.value = ''; vendDddSugg?.classList.remove('active'); if (vendDddSugg) vendDddSugg.innerHTML = ''; }
                else showWarning(`DDD ${raw} não encontrado.`);
            });
            vendDddSearch.addEventListener('focus', async () => { await carregarListaDdds(); });
        }

        async function carregarListaMunicipios() {
            if (municipiosLista) return municipiosLista;
            if (municipiosCarregando && municipiosPromise) return municipiosPromise;
            municipiosCarregando = true;
            municipiosPromise = (async () => {
                try {
                    const r = await apiGet(`${API_URL}/prospeccao/vendedores/catalogos/cidades`);
                    const lista = Array.isArray(r) ? r : (r && Array.isArray(r.dados)) ? r.dados : [];
                    if (lista.length > 0) {
                        municipiosLista = lista.map(m => ({ codigoIbge: String(m.codigoIbge || m.codigo || '').trim(), nome: m.nome || '', uf: '' })).filter(m => m.codigoIbge && m.nome);
                        return municipiosLista;
                    }
                } catch (e) {}
                try {
                    const cached = localStorage.getItem('deltafrio_municipios_geojson_v10');
                    if (cached) {
                        const geojson = JSON.parse(cached);
                        if (geojson.features) {
                            municipiosLista = geojson.features.map(f => ({ codigoIbge: String(f.properties?.codigoIbge || f.properties?.codigo || '').trim(), nome: f.properties?.nome || f.properties?.municipio || '', uf: (f.properties?.uf || '').toUpperCase() })).filter(m => m.codigoIbge && m.nome);
                            return municipiosLista;
                        }
                    }
                } catch (e) {}
                municipiosLista = [];
                return municipiosLista;
            })();
            try { return await municipiosPromise; } finally { municipiosCarregando = false; municipiosPromise = null; }
        }

        function buscarMunicipios(termo) {
            if (!municipiosLista || !termo) return [];
            const t = normalizar(termo); const res = [];
            for (const m of municipiosLista) { if (normalizar(m.nome).includes(t)) { res.push(m); if (res.length >= 20) break; } }
            return res;
        }

        function renderVendedorCidades() {
            if (!vendCidadesList) return;
            
            const filterWrapper = document.getElementById('vend-cidades-filter-wrapper');
            const filterInput = document.getElementById('vend-cidade-filter');
            
            if (!currentVendedorCidades.length) { 
                vendCidadesList.innerHTML = '<span class="cidades-empty">Nenhuma cidade vinculada ainda.</span>'; 
                if (filterWrapper) filterWrapper.style.display = 'none';
                return; 
            }
            
            // ✅ NOVO: Mostra o filtro se tiver cidades
            if (filterWrapper) filterWrapper.style.display = 'block';
            const termo = filterInput ? normalizar(filterInput.value) : '';
            
            const cidadesFiltradas = currentVendedorCidades.filter(c => normalizar(c.nome).includes(termo));
            
            if (!cidadesFiltradas.length) {
                vendCidadesList.innerHTML = '<span class="cidades-empty">Nenhuma cidade encontrada com este filtro.</span>';
                return;
            }
            
            vendCidadesList.innerHTML = cidadesFiltradas.map((c) => {
                const originalIndex = currentVendedorCidades.findIndex(x => x.codigoIbge === c.codigoIbge);
                return `<span class="cidade-chip" data-index="${originalIndex}">
                    <span class="chip-nome">${c.nome}</span>
                    <span class="chip-uf">${c.uf || ''}</span>
                    <button type="button" class="chip-remove" data-index="${originalIndex}" title="Remover"><i class="fas fa-times"></i></button>
                </span>`;
            }).join('');
            
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
            if (currentVendedorCidades.some(c => c.codigoIbge === m.codigoIbge)) return showWarning('Esta cidade já está vinculada.');
            currentVendedorCidades.push({ codigoIbge: m.codigoIbge, nome: m.nome, uf: m.uf || '' });
            renderVendedorCidades();
        }

        function renderSugestoesCidades(lista) {
            if (!vendCidadeSugg) return;
            if (!lista.length) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; return; }
            vendCidadeSugg.innerHTML = lista.map((m, i) => `<div class="autocomplete-item" data-index="${i}"><span class="code">${m.nome}</span><span class="desc"> - ${m.uf || '—'} · ${m.codigoIbge}</span></div>`).join('');
            vendCidadeSugg.classList.add('active');
            vendCidadeSugg.querySelectorAll('.autocomplete-item').forEach(el => {
                el.addEventListener('click', function () { const i = parseInt(this.dataset.index, 10); adicionarCidade(lista[i]); vendCidadeSearch.value = ''; vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; });
            });
        }

        if (vendCidadeSearch) {
            vendCidadeSearch.addEventListener('input', function () {
                clearTimeout(cidadeDebounce); const t = this.value.trim();
                if (t.length < 2) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; return; }
                cidadeDebounce = setTimeout(async () => { await carregarListaMunicipios(); renderSugestoesCidades(buscarMunicipios(t)); }, 200);
            });
            vendCidadeSearch.addEventListener('focus', async () => { if (vendCidadeSearch.value.trim().length >= 2) return; if (!municipiosLista) await carregarListaMunicipios(); });
        }

        document.addEventListener('click', (e) => {
            if (vendCidadeSearch && !e.target.closest('.cidade-search-wrapper')) vendCidadeSugg?.classList.remove('active');
            if (vendDddSearch && !e.target.closest('.cidade-search-wrapper')) vendDddSugg?.classList.remove('active');
            if (vendUsuarioSearch && !e.target.closest('#vend-usuario-wrapper')) vendUsuarioSugg?.classList.remove('active');
            if (vendEmpresaSearch && !e.target.closest('#vend-empresa-wrapper')) vendEmpresaSugg?.classList.remove('active');
        });

        // ✅ Evento de filtro das cidades no modal
        const vendCidadeFilter = document.getElementById('vend-cidade-filter');
        if (vendCidadeFilter) {
            vendCidadeFilter.addEventListener('input', renderVendedorCidades);
        }

        // ============================================================
        // CARREGAR VENDEDORES E RENDERIZAR TABELA
        // ============================================================
        async function carregarVendedores() {
            try {
                const dados = await apiGetEnvelope(ENDPOINT);
                const lista = Array.isArray(dados) ? dados : (dados && Array.isArray(dados.dados)) ? dados.dados : (dados && Array.isArray(dados.registros)) ? dados.registros : (dados && Array.isArray(dados.itens)) ? dados.itens : (dados && Array.isArray(dados.vendedores)) ? dados.vendedores : [];
                vendedores = lista.map(normalizarVendedor);
                renderVendedorTable();
            } catch (e) { vendedores = []; renderVendedorTable(); }
        }

                function normalizarVendedor(v) {
            const usuarioId = v.usuarioId ?? v.loginId ?? (Array.isArray(v.loginIds) ? v.loginIds[0] : null);
            const empresaIds = Array.isArray(v.empresaIds) ? v.empresaIds.map(Number) : [];
            const empresasObj = Array.isArray(v.empresas) ? v.empresas : [];
            const ativo = v.situacao !== 'I' && v.situacao !== 'X' && v.situacao !== 'B';
            
            // ✅ CORREÇÃO: Conta as empresas olhando para as duas formas possíveis (lista de IDs ou lista de objetos)
            const countEmpresas = empresasObj.length > 0 ? empresasObj.length : empresaIds.length;

            return {
                id: v.id ?? v.codigo, 
                nome: v.nome || '', 
                email: v.email || '', 
                fone: v.fone || v.telefone || '', 
                tipoPessoa: v.tipoPessoa || '', 
                cpfCnpj: v.cpfCnpj || '',
                ativo: ativo, 
                cor: v.corMapa || v.cor || '#2463eb', 
                versao: v.versao, 
                usuarioId: usuarioId, 
                empresaIds: empresaIds, 
                empresas: empresasObj,
                cidades: Array.isArray(v.cidades) ? v.cidades : [], 
                ddds: Array.isArray(v.ddds) ? v.ddds : [], 
                empresasCount: countEmpresas, // ✅ Agora envia o número correto
                regiao: v.regiao || ''
            };
        }

        function renderVendedorTable(filtro = '') {
            if (!vendedorTableBody) return;
            const term = String(filtro).toLowerCase().trim();
            vendedorTableBody.innerHTML = '';
            const lista = !term ? vendedores : vendedores.filter(v => v.nome.toLowerCase().includes(term) || (v.email || '').toLowerCase().includes(term) || (v.fone || '').toLowerCase().includes(term) || (v.cpfCnpj || '').includes(term));
            if (!lista.length) { vendedorTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">Nenhum vendedor cadastrado.</td></tr>`; return; }
            
            lista.forEach(v => {
                const cls = v.ativo ? 'on' : 'off'; const txt = v.ativo ? 'Ativo' : 'Inativo';
                const infoCor = CORES_DISPONIVEIS.find(c => c.hex.toLowerCase() === String(v.cor).toLowerCase()); const nomeCor = infoCor ? infoCor.nome : 'Cor';
                const dddsList = Array.isArray(v.ddds) && v.ddds.length ? v.ddds.map(d => typeof d === 'object' ? d.ddd : d).join(', ') : '';
                const regiaoTexto = v.regiao ? v.regiao : (dddsList ? `DDDs: ${dddsList}` : '—');
                const usuario = v.usuarioId ? (usuariosSistema || []).find(u => String(u.id) === String(v.usuarioId)) : null;
                const usuarioHtml = usuario ? `<span class="vendedor-usuario-chip"><i class="fas fa-user-check"></i> ${usuario.nome}</span>` : (v.usuarioId ? `<span class="vendedor-usuario-chip pendente"><i class="fas fa-user"></i> #${v.usuarioId}</span>` : `<span class="vendedor-usuario-chip ausente"><i class="fas fa-user-slash"></i></span>`);
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div class="avatar-mini" style="background:${v.cor}; box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px ${v.cor};" title="Cor do Mapa: ${nomeCor}">${iniciais(v.nome)}</div></td>
                    <td><strong>${v.nome || '-'}</strong><br><small style="color:var(--text-secondary);font-size:11px;">${usuarioHtml}</small></td>
                    <td>${v.email || '-'}</td>
                    <td>${v.fone || '—'}</td>
                    <td>${regiaoTexto}</td>
                    <td style="text-align:center;"><strong>${v.empresasCount || 0}</strong></td>
                    <td style="text-align:center;"><span class="vendedor-ativo-badge ${cls}">${txt}</span></td>
                    <td style="text-align:center;white-space:nowrap;"><button class="btn-table btn-edit" data-action="edit" data-id="${v.id}" title="Editar"><i class="fas fa-pen"></i></button></td>`;
                vendedorTableBody.appendChild(tr);
            });
            vendedorTableBody.querySelectorAll('button[data-action]').forEach(b => {
                b.addEventListener('click', function () { const { action, id } = this.dataset; if (action === 'edit') editarVendedor(id); });
            });
        }

        // ============================================================
        // FORM E EDIÇÃO
        // ============================================================
        function resetVendedorForm() {
            editingVendedorId = null;
            if (vendNome) vendNome.value = ''; if (vendTipoPessoa) vendTipoPessoa.value = ''; if (vendCpfCnpj) { vendCpfCnpj.value = ''; vendCpfCnpj.maxLength = 14; } if (vendEmail) vendEmail.value = ''; if (vendFone) vendFone.value = '';
            aplicarCorSelecionada('#2463eb'); fecharColorSelect();
            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Cadastro de vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Salvar vendedor';
            currentVendedorCidades = []; currentVendedorDdds = []; currentVendedorUsuario = null; currentVendedorEmpresas = []; originalVendedorEmpresas = [];
            if (vendCidadeSearch) vendCidadeSearch.value = ''; if (vendCidadeSugg) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; }
            if (vendDddSearch) vendDddSearch.value = ''; if (vendDddSugg) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; }
            if (vendUsuarioSearch) vendUsuarioSearch.value = ''; if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }
            if (vendEmpresaSearch) vendEmpresaSearch.value = ''; if (vendEmpresaSugg) { vendEmpresaSugg.classList.remove('active'); vendEmpresaSugg.innerHTML = ''; }
            
            const filterInput = document.getElementById('vend-cidade-filter');
            if (filterInput) filterInput.value = '';
            
            renderVendedorCidades(); renderVendedorDdds(); renderUsuarioSelecionado(); renderEmpresasSelecionadas();
        }

        async function editarVendedor(id) {
            const v = vendedores.find(x => String(x.id) === String(id)); if (!v) return;
            editingVendedorId = v.id;
            if (vendNome) vendNome.value = v.nome || ''; if (vendTipoPessoa) vendTipoPessoa.value = v.tipoPessoa || '';
            atualizarLimitesDocumento(); if (vendCpfCnpj) vendCpfCnpj.value = v.cpfCnpj || ''; if (vendEmail) vendEmail.value = v.email || ''; if (vendFone) vendFone.value = v.fone || '';
            aplicarCorSelecionada(v.cor || '#2463eb');
            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Editar vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Atualizar vendedor';
            await carregarListaMunicipios().catch(() => {}); await carregarListaDdds().catch(() => {}); await carregarListaEmpresas().catch(() => {});
            
            const rawCidades = Array.isArray(v.cidades) ? v.cidades : [];
            currentVendedorCidades = rawCidades.map(c => {
                const cod = typeof c === 'object' ? (c.codigoIbge || c.codigo) : c;
                const m = (municipiosLista || []).find(x => String(x.codigoIbge) === String(cod));
                return m ? { ...m } : { codigoIbge: String(cod), nome: `Cidade ${cod}`, uf: '' };
            });

            const rawDdds = Array.isArray(v.ddds) ? v.ddds : [];
            currentVendedorDdds = rawDdds.map(d => {
                const cod = typeof d === 'object' ? d.ddd : d;
                const dd = (dddsDisponiveis || []).find(x => String(x.ddd) === String(cod));
                return dd ? { ...dd } : { ddd: String(cod), descricao: '' };
            });

            if (Array.isArray(v.empresas) && v.empresas.length > 0) {
                currentVendedorEmpresas = v.empresas.map(e => ({ id: e.empresaId, nome: e.nomeFantasia || `Empresa #${e.empresaId}` }));
            } else {
                currentVendedorEmpresas = (v.empresaIds || []).map(empId => {
                    const e = (empresasLista || []).find(x => String(x.id) === String(empId));
                    return e ? { id: e.id, nome: e.nome } : { id: empId, nome: `Empresa #${empId}` };
                });
            }
            originalVendedorEmpresas = currentVendedorEmpresas.map(e => ({ ...e }));

            await carregarListaUsuarios();
            if (v.usuarioId) {
                const u = (usuariosSistema || []).find(x => String(x.id) === String(v.usuarioId));
                currentVendedorUsuario = u ? { ...u } : { id: v.usuarioId, nome: `Usuário #${v.usuarioId}`, email: '', cpf: '' };
            } else { currentVendedorUsuario = null; }

            const filterInput = document.getElementById('vend-cidade-filter');
            if (filterInput) filterInput.value = '';

            renderVendedorCidades(); renderVendedorDdds(); renderUsuarioSelecionado(); renderEmpresasSelecionadas(); renderColorOptions();
            vendedorModal.style.display = 'flex';
        }

        // ============================================================
        // SUBMIT (SALVAR)
        // ============================================================
        if (vendedorForm) {
            vendedorForm.addEventListener('submit', async e => {
                e.preventDefault();
                const nome = vendNome?.value.trim() || '';
                if (!nome) return showWarning('Informe o nome do vendedor.');
                if (!currentVendedorUsuario) return showWarning('Selecione um usuário do sistema para vincular ao vendedor.');
                if (!currentVendedorEmpresas || currentVendedorEmpresas.length === 0) return showWarning('Vincule pelo menos uma empresa.');
                if (!currentVendedorCidades || currentVendedorCidades.length === 0) return showWarning('Vincule pelo menos uma cidade.');

                const tipoPessoaRaw = (vendTipoPessoa?.value || '').toUpperCase().trim();
                const tipoPessoa = tipoPessoaRaw === 'F' ? 'PF' : tipoPessoaRaw === 'J' ? 'PJ' : tipoPessoaRaw === 'PF' ? 'PF' : tipoPessoaRaw === 'PJ' ? 'PJ' : '';
                if (!tipoPessoa) return showWarning('Informe o Tipo de Pessoa (Física ou Jurídica).');

                higienizarFone(); atualizarLimitesDocumento();
                btnSaveVendedor.disabled = true;
                const orig = btnSaveVendedor.innerText;
                btnSaveVendedor.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

                try {
                    const payload = {
                        tipoPessoa,
                        cpfCnpj: vendCpfCnpj?.value.trim() || null,
                        nome,
                        email: vendEmail?.value.trim() || null,
                        fone:  vendFone?.value.trim()  || null,
                        loginIds: currentVendedorUsuario ? [Number(currentVendedorUsuario.id)] : [],
                        empresaIds: currentVendedorEmpresas.map(e => Number(e.id)),
                        corMapa: vendCorInput?.value || '#2463eb',
                        cidades: currentVendedorCidades.map(c => String(c.codigoIbge)),
                        ddds: currentVendedorDdds.map(d => String(d.ddd))
                    };

                    if (editingVendedorId) {
                        const vendedorAtual = vendedores.find(v => String(v.id) === String(editingVendedorId));
                        if (vendedorAtual && vendedorAtual.versao !== undefined) payload.versao = Number(vendedorAtual.versao);
                        await apiPut(`${ENDPOINT}/${editingVendedorId}`, payload);
                    } else {
                        await apiPost(ENDPOINT, payload);
                    }

                    vendedorModal.style.display = 'none';
                    resetVendedorForm();
                    await carregarVendedores();

                    // ✅ Recarrega os dados do mapa (para atualizar a cor e as cidades)
                    if (window.AppCore && window.AppCore.recarregarMapaDados) {
                        window.AppCore.recarregarMapaDados().catch(console.warn);
                    }

                    showWarning('Vendedor salvo com sucesso!', 'Sucesso');
                } catch (err) {
                    showWarning('Erro ao salvar vendedor: ' + extrairMensagemErro(err));
                } finally {
                    btnSaveVendedor.disabled = false;
                    btnSaveVendedor.innerText = orig;
                }
            });
        }

        // ============================================================
        // EVENTOS E BOOT
        // ============================================================
        document.getElementById('btn-cancel-vendedor')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        document.getElementById('close-vendedor-modal')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        vendedorModal?.addEventListener('click', e => { if (e.target === vendedorModal) { vendedorModal.style.display = 'none'; resetVendedorForm(); } });
        vendedorSearch?.addEventListener('input', function () { renderVendedorTable(this.value); });
        document.getElementById('menu-vendedores')?.addEventListener('click', () => { showScreen('vendedores'); if (window.__ativarAbaVendedoresEmpresas) window.__ativarAbaVendedoresEmpresas('vendedores'); });
        window.novoVendedor = function () { resetVendedorForm(); renderColorOptions(); carregarListaEmpresas(true).catch(() => {}); carregarListaMunicipios().catch(() => {}); carregarListaDdds().catch(() => {}); carregarListaUsuarios().catch(() => {}); vendedorModal.style.display = 'flex'; };

        await carregarVendedores(); await carregarListaUsuarios().catch(() => {}); await carregarListaEmpresas().catch(() => {});
        console.log('✅ [vendedores] módulo carregado.');
    })();
});