// ============================================================
// VENDEDORES — módulo independente
// Depende de window.AppCore (exposto por script.js)
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

        console.log('\u2705 [vendedores] AppCore obtido, inicializando m\u00f3dulo...');

        const { apiGet, apiPost, apiPut, apiDelete, showScreen, showWarning, showConfirm, API_URL } = Core;

        // --- Elementos ---
        const vendedoresScreen  = document.getElementById('vendedores-screen');
        const vendedorTableBody = document.getElementById('vendedor-table-body');
        const vendedorSearch    = document.getElementById('vendedor-search');
        const vendedorModal     = document.getElementById('vendedor-modal');
        const vendedorForm      = document.getElementById('vendedorForm');
        const btnSaveVendedor   = document.getElementById('btn-save-vendedor');

        // Cidades
        const vendCidadeSearch  = document.getElementById('vend-cidade-search');
        const vendCidadeSugg    = document.getElementById('vend-cidade-suggestions');
        const vendCidadesList   = document.getElementById('vend-cidades-list');

        // DDDs
        const vendDddSearch     = document.getElementById('vend-ddd-search');
        const vendDddSugg       = document.getElementById('vend-ddd-suggestions');
        const vendDddsList      = document.getElementById('vend-ddds-list');

        // Usuário do sistema
        const vendUsuarioSearch = document.getElementById('vend-usuario-search');
        const vendUsuarioSugg   = document.getElementById('vend-usuario-suggestions');
        const vendUsuarioCard   = document.getElementById('vend-usuario-selected');
        const vendUsuarioAvatar = document.getElementById('vend-usuario-avatar');
        const vendUsuarioNome   = document.getElementById('vend-usuario-nome');
        const vendUsuarioEmail  = document.getElementById('vend-usuario-email');
        const vendUsuarioRemove = document.getElementById('vend-usuario-remove');

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
        let currentVendedorRegiao = '';
        let currentVendedorUsuario = null;

        let municipiosLista = null;
        let municipiosCarregando = false;
        let cidadeDebounce = null;

        let dddsDisponiveis = null;
        let dddsCarregando = false;

        let usuariosSistema = null;
        let usuariosCarregando = false;
        let usuarioDebounce = null;

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
        // LISTA DE USUÁRIOS DO SISTEMA (login)
        // ============================================================
        async function carregarListaUsuarios() {
            if (usuariosSistema) return usuariosSistema;
            if (usuariosCarregando) return [];

            usuariosCarregando = true;
            try {
                const r = await apiGet(`${API_URL}/auth/v2/admin/usuarios`);
                const lista = Array.isArray(r) ? r
                            : (r && Array.isArray(r.content)) ? r.content
                            : (r && Array.isArray(r.data))    ? r.data
                            : (r && Array.isArray(r.usuarios)) ? r.usuarios
                            : [];
                usuariosSistema = lista.map(u => ({
                    id: u.id,
                    nome: u.nome || '',
                    email: u.email || '',
                    cpf: u.cpf || '',
                    situacao: u.situacao || ''
                }));
                console.log(`? [vendedores] ${usuariosSistema.length} usuários carregados`);
            } catch (e) {
                console.warn('[vendedores] Endpoint de usuários indisponível:', e);
                usuariosSistema = [];
            }
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

        function usuarioJaVinculado(usuarioId) {
            return vendedores.find(v =>
                String(v.usuarioId) === String(usuarioId) &&
                String(v.id) !== String(editingVendedorId)
            );
        }

        function renderUsuarioSelecionado() {
            if (!vendUsuarioCard) return;
            if (!currentVendedorUsuario) {
                vendUsuarioCard.style.display = 'none';
                return;
            }
            vendUsuarioCard.style.display = 'flex';
            if (vendUsuarioAvatar) vendUsuarioAvatar.textContent = iniciais(currentVendedorUsuario.nome);
            if (vendUsuarioNome)   vendUsuarioNome.textContent = currentVendedorUsuario.nome || '—';
            if (vendUsuarioEmail)  vendUsuarioEmail.textContent = currentVendedorUsuario.email || (currentVendedorUsuario.cpf ? formatarCPF(currentVendedorUsuario.cpf) : '—');
        }

        function selecionarUsuario(u) {
            if (!u) return;
            const vinculado = usuarioJaVinculado(u.id);
            if (vinculado) {
                showWarning(`Este usuário já está vinculado ao vendedor "${vinculado.nome}".`);
                return;
            }
            currentVendedorUsuario = { ...u };
            renderUsuarioSelecionado();
            if (vendUsuarioSearch) vendUsuarioSearch.value = '';
            if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }
        }

        function renderSugestoesUsuarios(lista) {
            if (!vendUsuarioSugg) return;
            if (!lista.length) {
                vendUsuarioSugg.classList.remove('active');
                vendUsuarioSugg.innerHTML = '';
                return;
            }
            vendUsuarioSugg.innerHTML = lista.map((u, i) => {
                const vinculado = usuarioJaVinculado(u.id);
                const badge = vinculado ? `<span class="usuario-sugg-badge" title="Já vinculado a ${vinculado.nome}">Em uso</span>` : '';
                return `
                    <div class="autocomplete-item usuario-sugg-item ${vinculado ? 'disabled' : ''}" data-index="${i}">
                        <div class="usuario-sugg-avatar">${iniciais(u.nome)}</div>
                        <div class="usuario-sugg-info">
                            <span class="code">${u.nome || '—'}</span>
                            <span class="desc">${u.email || '—'}</span>
                        </div>
                        ${badge}
                    </div>
                `;
            }).join('');
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
        // LISTA DE MUNICÍPIOS (autocomplete de cidades)
        // Fonte primária: /api/mapas/municipios (GeoJSON)
        // Fallback: cache do localStorage preenchido por script.js
        // ============================================================
        async function carregarListaMunicipios() {
            if (municipiosLista) return municipiosLista;
            if (municipiosCarregando) return [];

            municipiosCarregando = true;

            // 1) Tenta a API oficial de mapas (GeoJSON)
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
                        municipiosCarregando = false;
                        console.log(`? [vendedores] ${municipiosLista.length} municípios carregados de /api/mapas/municipios`);
                        return municipiosLista;
                    }
                }
            } catch (e) {
                console.warn('[vendedores] Falha em /api/mapas/municipios:', e);
            }

            // 2) Fallback: cache do localStorage preenchido por script.js
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
                        municipiosCarregando = false;
                        console.log(`? [vendedores] ${municipiosLista.length} municípios do cache do mapa`);
                        return municipiosLista;
                    }
                }
            } catch (e) {
                console.warn('[vendedores] Falha ao extrair municípios do cache:', e);
            }

            municipiosCarregando = false;
            municipiosLista = [];
            return municipiosLista;
        }

        function buscarMunicipios(termo) {
            if (!municipiosLista || !termo) return [];
            const t = normalizar(termo);
            const res = [];
            for (const m of municipiosLista) {
                if (normalizar(m.nome).includes(t)) {
                    res.push(m);
                    if (res.length >= 20) break;
                }
            }
            return res;
        }

        // ============================================================
        // LISTA DE DDDs (autocomplete)
        // ============================================================
        async function carregarListaDdds() {
            if (dddsDisponiveis) return dddsDisponiveis;
            if (dddsCarregando) return [];

            dddsCarregando = true;
            try {
                const r = await apiGet(`${API_URL}/ddds`);
                dddsDisponiveis = (Array.isArray(r) ? r : []).map(d => ({
                    ddd: String(d.ddd || '').trim(),
                    descricao: d.descricao || ''
                })).filter(d => d.ddd);
                console.log(`? [vendedores] ${dddsDisponiveis.length} DDDs carregados`);
            } catch (e) {
                console.warn('[vendedores] Erro ao carregar DDDs:', e);
                dddsDisponiveis = [];
            }
            dddsCarregando = false;
            return dddsDisponiveis;
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
            if (!lista.length) {
                vendDddSugg.classList.remove('active');
                vendDddSugg.innerHTML = '';
                return;
            }
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
                if (!raw) {
                    vendDddSugg?.classList.remove('active');
                    if (vendDddSugg) vendDddSugg.innerHTML = '';
                    return;
                }
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
        // CHIPS DE CIDADES
        // ============================================================
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
            if (!lista.length) {
                vendCidadeSugg.classList.remove('active');
                vendCidadeSugg.innerHTML = '';
                return;
            }
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
                if (t.length < 2) {
                    vendCidadeSugg.classList.remove('active');
                    vendCidadeSugg.innerHTML = '';
                    return;
                }
                cidadeDebounce = setTimeout(async () => {
                    await carregarListaMunicipios();
                    const res = buscarMunicipios(t);
                    renderSugestoesCidades(res);
                }, 200);
            });

            vendCidadeSearch.addEventListener('focus', async () => {
                if (vendCidadeSearch.value.trim().length >= 2) return;
                if (!municipiosLista) await carregarListaMunicipios();
            });
        }

        document.addEventListener('click', (e) => {
            if (vendCidadeSearch && !e.target.closest('.cidade-search-wrapper')) {
                vendCidadeSugg?.classList.remove('active');
            }
            if (vendDddSearch && !e.target.closest('.cidade-search-wrapper')) {
                vendDddSugg?.classList.remove('active');
            }
            if (vendUsuarioSearch && !e.target.closest('#vend-usuario-wrapper')) {
                vendUsuarioSugg?.classList.remove('active');
            }
        });

        // ============================================================
        // CARREGAMENTO
        // ============================================================
        async function carregarVendedores() {
            try {
                const data = await apiGet(`${API_URL}/vendedores`);
                vendedores = (Array.isArray(data) ? data : []).map(v => ({
                    id: v.id ?? v.codigo,
                    nome: v.nome || '',
                    email: v.email || '',
                    telefone: v.telefone || '',
                    regiao: v.regiao || '',
                    cor: v.cor || '#2463eb',
                    ativo: v.ativo !== false && v.ativo !== 0,
                    usuarioId: v.usuarioId ?? v.usuario_id ?? null,
                    empresasCount: v.empresasCount ?? v.empresas_count ?? v.qtdEmpresas ?? 0,
                    cidades: Array.isArray(v.cidades) ? v.cidades.map(c => ({
                        codigoIbge: String(c.codigoIbge || c.codigo || '').trim(),
                        nome: c.nome || '',
                        uf: (c.uf || '').toUpperCase()
                    })) : [],
                    ddds: Array.isArray(v.ddds) ? v.ddds.map(d => ({
                        ddd: String(d.ddd || d || '').trim(),
                        descricao: d.descricao || ''
                    })).filter(d => d.ddd) : []
                }));
            } catch (e) { console.warn('Erro vendedores:', e); vendedores = []; }
            vendedoresCarregados = true;
            renderVendedorTable();
        }

        function garantirDados() {
            const p = [];
            if (!vendedoresCarregados) p.push(carregarVendedores());
            return Promise.all(p);
        }

        // ============================================================
        // RENDERIZAÇÃO DA TABELA
        // ============================================================
        function renderVendedorTable(filtro = '') {
            if (!vendedorTableBody) return;
            const term = String(filtro).toLowerCase().trim();
            vendedorTableBody.innerHTML = '';
            const lista = !term ? vendedores : vendedores.filter(v =>
                v.nome.toLowerCase().includes(term) ||
                (v.email || '').toLowerCase().includes(term) ||
                (v.telefone || '').toLowerCase().includes(term)
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
                const subPartes = [];
                if (totalCidades) subPartes.push(`${totalCidades} cidade${totalCidades > 1 ? 's' : ''}`);
                if (totalDdds)    subPartes.push(`${totalDdds} DDD${totalDdds > 1 ? 's' : ''}`);
                const sub = subPartes.length ? subPartes.join(' • ') : 'Sem vínculos';

                const usuario = v.usuarioId ? (usuariosSistema || []).find(u => String(u.id) === String(v.usuarioId)) : null;
                const usuarioHtml = usuario
                    ? `<span class="vendedor-usuario-chip" title="${usuario.email || ''}"><i class="fas fa-user-check"></i> ${usuario.nome}</span>`
                    : (v.usuarioId
                        ? `<span class="vendedor-usuario-chip pendente"><i class="fas fa-user"></i> #${v.usuarioId}</span>`
                        : `<span class="vendedor-usuario-chip ausente" title="Sem usuário vinculado"><i class="fas fa-user-slash"></i></span>`);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div class="avatar-mini" style="background:${v.cor};">${iniciais(v.nome)}</div></td>
                    <td><strong>${v.nome || '-'}</strong><br><small style="color:var(--text-secondary);font-size:11px;">${usuarioHtml}</small></td>
                    <td>${v.email || '-'}</td>
                    <td>${v.telefone || '—'}</td>
                    <td>${sub}</td>
                    <td style="text-align:center;"><strong>${v.empresasCount || 0}</strong></td>
                    <td style="text-align:center;"><span class="vendedor-ativo-badge ${cls}">${txt}</span></td>
                    <td style="text-align:center;white-space:nowrap;">
                        <button class="btn-table btn-edit"   data-action="edit"   data-id="${v.id}" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn-table btn-remove" data-action="delete" data-id="${v.id}" title="Excluir"><i class="fas fa-trash"></i></button>
                    </td>`;
                vendedorTableBody.appendChild(tr);
            });
            vendedorTableBody.querySelectorAll('button[data-action]').forEach(b => {
                b.addEventListener('click', function () {
                    const { action, id } = this.dataset;
                    if (action === 'edit') editarVendedor(id);
                    else if (action === 'delete') excluirVendedor(id);
                });
            });
        }

        // ============================================================
        // FORM VENDEDOR
        // ============================================================
        function resetVendedorForm() {
            editingVendedorId = null;
            const nomeEl = document.getElementById('vend-nome'); if (nomeEl) nomeEl.value = '';
            const corEl = document.getElementById('vend-cor'); if (corEl) corEl.value = '#2463eb';
            const titleEl = document.getElementById('vendedor-modal-title'); if (titleEl) titleEl.innerText = 'Cadastro de vendedor';
            if (btnSaveVendedor) btnSaveVendedor.innerText = 'Salvar vendedor';

            currentVendedorCidades = [];
            currentVendedorDdds = [];
            currentVendedorRegiao = '';
            currentVendedorUsuario = null;

            if (vendCidadeSearch) vendCidadeSearch.value = '';
            if (vendCidadeSugg) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; }
            if (vendDddSearch) vendDddSearch.value = '';
            if (vendDddSugg) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; }
            if (vendUsuarioSearch) vendUsuarioSearch.value = '';
            if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }

            renderVendedorCidades();
            renderVendedorDdds();
            renderUsuarioSelecionado();
        }

        function editarVendedor(id) {
            const v = vendedores.find(x => String(x.id) === String(id)); if (!v) return;
            editingVendedorId = v.id;
            document.getElementById('vend-nome').value     = v.nome || '';
            document.getElementById('vend-email').value    = v.email || '';
            document.getElementById('vend-telefone').value = v.telefone || '';
            document.getElementById('vend-cor').value      = v.cor || '#2463eb';
            document.getElementById('vendedor-modal-title').innerText = 'Editar vendedor';
            btnSaveVendedor.innerText = 'Atualizar vendedor';

            currentVendedorCidades = Array.isArray(v.cidades) ? v.cidades.map(c => ({ ...c })) : [];
            currentVendedorDdds    = Array.isArray(v.ddds)   ? v.ddds.map(d => ({ ...d }))   : [];
            currentVendedorRegiao  = v.regiao || '';

            if (v.usuarioId) {
                const u = (usuariosSistema || []).find(x => String(x.id) === String(v.usuarioId));
                currentVendedorUsuario = u ? { ...u } : { id: v.usuarioId, nome: `Usuário #${v.usuarioId}`, email: '', cpf: '' };
            } else {
                currentVendedorUsuario = null;
            }

            if (vendCidadeSearch) vendCidadeSearch.value = '';
            if (vendCidadeSugg) { vendCidadeSugg.classList.remove('active'); vendCidadeSugg.innerHTML = ''; }
            if (vendDddSearch) vendDddSearch.value = '';
            if (vendDddSugg) { vendDddSugg.classList.remove('active'); vendDddSugg.innerHTML = ''; }
            if (vendUsuarioSearch) vendUsuarioSearch.value = '';
            if (vendUsuarioSugg) { vendUsuarioSugg.classList.remove('active'); vendUsuarioSugg.innerHTML = ''; }

            renderVendedorCidades();
            renderVendedorDdds();
            renderUsuarioSelecionado();

            carregarListaMunicipios().catch(() => {});
            carregarListaDdds().catch(() => {});
            carregarListaUsuarios().then(() => renderUsuarioSelecionado()).catch(() => {});

            vendedorModal.style.display = 'flex';
        }

        function excluirVendedor(id) {
            const v = vendedores.find(x => String(x.id) === String(id)); if (!v) return;
            showConfirm('Excluir Vendedor', `Tem certeza que deseja excluir "${v.nome}"?`, async () => {
                try {
                    await apiDelete(`${API_URL}/vendedores/${id}`);
                    vendedores = vendedores.filter(x => String(x.id) !== String(id));
                    renderVendedorTable(vendedorSearch.value);
                } catch (err) { console.error(err); showWarning('Erro ao excluir vendedor.'); }
            });
        }

        // ============================================================
        // SUBMIT DO FORM
        // ============================================================
        vendedorForm.addEventListener('submit', async e => {
            e.preventDefault();
            const nome = document.getElementById('vend-nome').value.trim();
            if (!nome) return showWarning('Informe o nome do vendedor.');
            if (!currentVendedorUsuario) return showWarning('Selecione um usuário do sistema para vincular ao vendedor.');

            const payload = {
                nome,
                email:    document.getElementById('vend-email')?.value.trim() || '',
                telefone: '',
                regiao:   currentVendedorRegiao,
                cor:      document.getElementById('vend-cor').value || '#2463eb',
                ativo:    true,
                usuarioId: currentVendedorUsuario.id,
                cidades:  currentVendedorCidades.map(c => ({
                    codigoIbge: c.codigoIbge,
                    nome: c.nome,
                    uf: c.uf || ''
                })),
                ddds:     currentVendedorDdds.map(d => ({
                    ddd: d.ddd,
                    descricao: d.descricao || ''
                }))
            };
            btnSaveVendedor.disabled = true;
            const orig = btnSaveVendedor.innerText;
            btnSaveVendedor.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            try {
                if (editingVendedorId) {
                    const atual = await apiPut(`${API_URL}/vendedores/${editingVendedorId}`, payload);
                    const i = vendedores.findIndex(x => String(x.id) === String(editingVendedorId));
                    if (i !== -1) vendedores[i] = { ...vendedores[i], ...payload, ...(atual || {}) };
                } else {
                    const novo = await apiPost(`${API_URL}/vendedores`, payload);
                    vendedores.push({ id: novo.id ?? novo.codigo, empresasCount: 0, ...payload });
                }
                vendedorModal.style.display = 'none';
                resetVendedorForm();
                renderVendedorTable(vendedorSearch.value);
                showWarning('Vendedor salvo com sucesso!', 'Sucesso');
            } catch (err) { console.error(err); showWarning('Erro ao salvar vendedor: ' + (err.message || '')); }
            finally { btnSaveVendedor.disabled = false; btnSaveVendedor.innerText = orig; }
        });

        // ============================================================
        // EVENTOS DOS MODAIS
        // ============================================================
        document.getElementById('btn-cancel-vendedor')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        document.getElementById('close-vendedor-modal')?.addEventListener('click', () => { vendedorModal.style.display = 'none'; resetVendedorForm(); });
        vendedorModal?.addEventListener('click', e => { if (e.target === vendedorModal) { vendedorModal.style.display = 'none'; resetVendedorForm(); } });

        vendedorSearch?.addEventListener('input', function () { renderVendedorTable(this.value); });

        document.getElementById('menu-vendedores')?.addEventListener('click', () => showScreen('vendedores'));

        window.novoVendedor = function () {
            resetVendedorForm();
            carregarListaMunicipios().catch(() => {});
            carregarListaDdds().catch(() => {});
            carregarListaUsuarios().catch(() => {});
            vendedorModal.style.display = 'flex';
        };

        if (Core.registerScreen && vendedoresScreen) {
            Core.registerScreen('vendedores', vendedoresScreen);
        }

        // Pré-carrega em background
        garantirDados().catch(() => {});
        carregarListaUsuarios().catch(() => {});

        console.log('\u2705 [vendedores] m\u00f3dulo carregado.');
    })();
});