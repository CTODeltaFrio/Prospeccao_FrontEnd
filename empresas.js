// ============================================================
// EMPRESAS — aba dentro da tela Vendedores
// Endpoints:
//   POST /api/prospeccao/empresas
//   PUT  /api/prospeccao/empresas/:id
//   GET  /api/prospeccao/empresas          (listagem — assumido)
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
        catch (err) { console.error('[empresas] AppCore nunca foi exposto:', err.message); return; }

        console.log('✅ [empresas] AppCore obtido, inicializando módulo...');

        const { apiGetEnvelope, apiPost, apiPut, showWarning, API_URL } = Core;

        const ENDPOINT = `${API_URL}/prospeccao/empresas`;

        // ---------- Elementos ----------
        const empresaTableBody = document.getElementById('empresa-table-body');
        const empresaSearch    = document.getElementById('empresa-search');
        const empresaModal     = document.getElementById('empresa-modal');
        const empresaForm      = document.getElementById('empresaForm');
        const btnSaveEmpresa   = document.getElementById('btn-save-empresa');

        const empCnpj     = document.getElementById('emp-cnpj');
        const empRazao    = document.getElementById('emp-razao');
        const empFantasia = document.getElementById('emp-fantasia');

        if (!empresaTableBody) {
            console.warn('[empresas] aba não encontrada no DOM.');
            return;
        }

        // ---------- Estado ----------
        let empresas = [];
        let empresasCarregadas = false;
        let editingEmpresaId = null;

        // ---------- Helpers ----------
        function normalizar(s) {
            return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        }

        function formatarCnpj(cnpj) {
            const c = String(cnpj || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (c.length !== 14) return c || '—';
            return c.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
        }

        function formatarData(iso) {
            if (!iso) return '—';
            try {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return String(iso);
                const data = d.toLocaleDateString('pt-BR');
                const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return `${data} ${hora}`;
            } catch { return String(iso); }
        }

        function validarCnpj(cnpjOriginal) {
            const c = String(cnpjOriginal || '').trim();
            if (!c) return 'Informe o CNPJ.';
            if (c.length !== 14) return `CNPJ deve ter exatamente 14 caracteres (informado: ${c.length}).`;
            for (let i = 0; i < 12; i++) {
                if (!/[A-Za-z0-9]/.test(c[i])) {
                    return `Caractere inválido na posição ${i + 1}. Use apenas letras A–Z e dígitos 0–9.`;
                }
            }
            for (let i = 12; i < 14; i++) {
                if (!/[0-9]/.test(c[i])) {
                    return `As duas últimas posições devem ser dígitos (posição ${i + 1}).`;
                }
            }
            return null;
        }

        function extrairMensagemErro(err) {
            if (!err) return 'Erro desconhecido';
            if (typeof err === 'string') return err;
            if (err instanceof Error) return err.message || 'Erro ao processar requisição';
            if (err.erros && Array.isArray(err.erros) && err.erros.length) {
                const p = err.erros[0];
                return p.motivo || p.message || p.title || JSON.stringify(p);
            }
            return err.message || err.mensagem || err.detail || err.title || String(err);
        }

        // ---------- Carregar lista ----------
        async function carregarEmpresas() {
            try {
                const dados = await apiGetEnvelope(ENDPOINT);
                const lista = Array.isArray(dados) ? dados
                            : (dados && Array.isArray(dados.registros))  ? dados.registros
                            : (dados && Array.isArray(dados.itens))      ? dados.itens
                            : (dados && Array.isArray(dados.empresas))   ? dados.empresas
                            : (dados && Array.isArray(dados.content))    ? dados.content
                            : [];
                empresas = lista;
                empresasCarregadas = true;
                renderEmpresaTable(empresaSearch ? empresaSearch.value : '');
            } catch (e) {
                console.warn('[empresas] erro ao carregar:', e.message);
                empresas = [];
                empresasCarregadas = true;
                renderEmpresaTable();
            }
        }

        // ---------- Render ----------
        function renderEmpresaTable(filtro = '') {
            if (!empresaTableBody) return;
            const term = normalizar(filtro);
            empresaTableBody.innerHTML = '';

            const lista = !term ? empresas : empresas.filter(e =>
                normalizar(e.cnpj).includes(term) ||
                normalizar(e.razaoSocial).includes(term) ||
                normalizar(e.nomeFantasia).includes(term)
            );

            if (!lista.length) {
                empresaTableBody.innerHTML =
                    `<tr><td colspan="6" style="text-align:center;padding:22px;color:var(--text-secondary);">
                        ${empresasCarregadas ? 'Nenhuma empresa cadastrada.' : 'Carregando…'}
                    </td></tr>`;
                return;
            }

            lista.forEach(e => {
                const ativo = (e.ativo === 'S' || e.ativo === '1' || e.ativo === true || e.ativo === 'true');
                const cls   = ativo ? 'on' : 'off';
                const txt   = ativo ? 'Ativo' : 'Inativo';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${formatarCnpj(e.cnpj)}</strong></td>
                    <td>${e.razaoSocial || '—'}</td>
                    <td>${e.nomeFantasia || '—'}</td>
                    <td style="text-align:center;">
                        <span class="vendedor-ativo-badge ${cls}">${txt}</span>
                    </td>
                    <td style="text-align:center;">${formatarData(e.dataCad)}</td>
                    <td style="text-align:center;white-space:nowrap;">
                        <button class="btn-table btn-edit" data-action="edit" data-id="${e.id}" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                    </td>`;
                empresaTableBody.appendChild(tr);
            });

            empresaTableBody.querySelectorAll('button[data-action]').forEach(b => {
                b.addEventListener('click', function () {
                    if (this.dataset.action === 'edit') editarEmpresa(this.dataset.id);
                });
            });
        }

        // ---------- Form ----------
        function resetEmpresaForm() {
            editingEmpresaId = null;
            if (empCnpj)     empCnpj.value = '';
            if (empRazao)    empRazao.value = '';
            if (empFantasia) empFantasia.value = '';
            const t = document.getElementById('empresa-modal-title');
            if (t) t.innerText = 'Cadastro de empresa';
            if (btnSaveEmpresa) btnSaveEmpresa.innerText = 'Salvar empresa';
        }

        function editarEmpresa(id) {
            const e = empresas.find(x => String(x.id) === String(id));
            if (!e) return;
            editingEmpresaId = e.id;
            if (empCnpj)     empCnpj.value = e.cnpj || '';
            if (empRazao)    empRazao.value = e.razaoSocial || '';
            if (empFantasia) empFantasia.value = e.nomeFantasia || '';
            const t = document.getElementById('empresa-modal-title');
            if (t) t.innerText = 'Editar empresa';
            if (btnSaveEmpresa) btnSaveEmpresa.innerText = 'Atualizar empresa';
            empresaModal.style.display = 'flex';
        }

        // ---------- Submit ----------
        if (empresaForm) {
            empresaForm.addEventListener('submit', async ev => {
                ev.preventDefault();

                const cnpj         = (empCnpj?.value     || '').trim().toUpperCase();
                const razaoSocial  = (empRazao?.value    || '').trim();
                const nomeFantasia = (empFantasia?.value || '').trim();

                const errCnpj = validarCnpj(cnpj);
                if (errCnpj) return showWarning(errCnpj);
                if (!razaoSocial)  return showWarning('Informe a Razão Social.');
                if (razaoSocial.length > 200)  return showWarning('Razão Social deve ter no máximo 200 caracteres.');
                if (!nomeFantasia) return showWarning('Informe o Nome Fantasia.');
                if (nomeFantasia.length > 200) return showWarning('Nome Fantasia deve ter no máximo 200 caracteres.');

                const payload = { cnpj, razaoSocial, nomeFantasia };

                btnSaveEmpresa.disabled = true;
                const orig = btnSaveEmpresa.innerText;
                btnSaveEmpresa.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

                try {
                    if (editingEmpresaId) {
                        await apiPut(`${ENDPOINT}/${editingEmpresaId}`, payload);
                    } else {
                        await apiPost(ENDPOINT, payload);
                    }
                    empresaModal.style.display = 'none';
                    resetEmpresaForm();
                    await carregarEmpresas();
                    showWarning('Empresa salva com sucesso!', 'Sucesso');
                } catch (err) {
                    console.error('[empresas] erro no submit:', err);
                    showWarning('Erro ao salvar empresa: ' + extrairMensagemErro(err));
                } finally {
                    btnSaveEmpresa.disabled = false;
                    btnSaveEmpresa.innerText = orig;
                }
            });
        }

        // ---------- Eventos ----------
        document.getElementById('btn-cancel-empresa')
            ?.addEventListener('click', () => { empresaModal.style.display = 'none'; resetEmpresaForm(); });

        document.getElementById('close-empresa-modal')
            ?.addEventListener('click', () => { empresaModal.style.display = 'none'; resetEmpresaForm(); });

        empresaModal?.addEventListener('click', e => {
            if (e.target === empresaModal) { empresaModal.style.display = 'none'; resetEmpresaForm(); }
        });

        empresaSearch?.addEventListener('input', function () {
            renderEmpresaTable(this.value);
        });

        // Força maiúsculas no CNPJ enquanto digita
        empCnpj?.addEventListener('input', function () {
            const pos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(pos, pos);
        });

        window.novaEmpresa = function () {
            resetEmpresaForm();
            empresaModal.style.display = 'flex';
            setTimeout(() => empCnpj?.focus(), 100);
        };

        // ============================================================
        // INTEGRAÇÃO COM AS ABAS DA TELA VENDEDORES
        // ============================================================
        const vhTitle    = document.getElementById('vh-title');
        const vhSubtitle = document.getElementById('vh-subtitle');
        const vhBtnNovo  = document.getElementById('vh-btn-novo');
        const vhBtnText  = document.getElementById('vh-btn-novo-text');

        function ativarAba(tab) {
            document.querySelectorAll('#vendedores-screen .vtab').forEach(b =>
                b.classList.toggle('active', b.dataset.tab === tab)
            );
            document.querySelectorAll('#vendedores-screen .vtab-panel').forEach(p =>
                p.classList.toggle('active', p.id === `vtab-panel-${tab}`)
            );

            if (tab === 'vendedores') {
                if (vhTitle)    vhTitle.innerText    = 'Gerenciar vendedores';
                if (vhSubtitle) vhSubtitle.innerText = 'Cadastre vendedores e vincule às empresas';
                if (vhBtnText)  vhBtnText.innerText  = 'Novo vendedor';
                if (vhBtnNovo)  vhBtnNovo.setAttribute('onclick', 'novoVendedor()');
            } else if (tab === 'empresas') {
                if (vhTitle)    vhTitle.innerText    = 'Gerenciar empresas';
                if (vhSubtitle) vhSubtitle.innerText = 'Cadastre empresas locais do PROSPECT';
                if (vhBtnText)  vhBtnText.innerText  = 'Nova empresa';
                if (vhBtnNovo)  vhBtnNovo.setAttribute('onclick', 'novaEmpresa()');
                if (!empresasCarregadas) carregarEmpresas();
            }
        }

        document.querySelectorAll('#vendedores-screen .vtab').forEach(b => {
            b.addEventListener('click', () => ativarAba(b.dataset.tab));
        });

        // Expõe globalmente para o vendedores.js chamar
        window.__ativarAbaVendedoresEmpresas = ativarAba;

        console.log('✅ [empresas] módulo carregado.');
    })();
});