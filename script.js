document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    try {
        // ===== MODO ESCURO =====
        const btnDarkMode = document.getElementById('btn-dark-mode');

        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            btnDarkMode.innerHTML = '<i class="fas fa-sun"></i>';
        }

        btnDarkMode.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            btnDarkMode.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });

        // ===== SIDEBAR COLAPSÁVEL =====
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });

        // Elementos da tela principal
        const mainScreen = document.getElementById('main-screen');
        const segmentScreen = document.getElementById('segment-screen');
        const tbody = document.getElementById('table-body');
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
        const btnConfirmDiscard = document.getElementById('btn-confirm-discard');
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
        let cnaeData = [];
        let currentGenericContext = null;

        // Controle de alterações não salvas
        let isDirty = false;

        function setDirty(value) {
            isDirty = value;
        }

        // =====================================================
        // TRANSFORMAR TODOS OS SELECTS EM DROPDOWNS CUSTOMIZADOS
        // =====================================================
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

                Array.from(select.options).forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'custom-option' + (option.selected ? ' selected' : '');
                    optionDiv.dataset.value = option.value;
                    optionDiv.textContent = option.text;
                    if (option.selected) optionDiv.classList.add('selected');

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

                wrapper.appendChild(trigger);
                wrapper.appendChild(optionsContainer);

                trigger.addEventListener('click', function(e) {
                    e.stopPropagation();
                    document.querySelectorAll('.custom-select.open').forEach(cs => {
                        if (cs !== wrapper) cs.classList.remove('open');
                    });
                    wrapper.classList.toggle('open');
                });

                document.addEventListener('click', function(e) {
                    if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
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

        // ========== DADOS MOCK (20 empresas) ==========
        const mockData = [
            { cnpj: '06.771.019/0001-31', fantasia: 'MATADOURO FICAGNA', razao: 'ZELO FICAGNA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 3722-4664', ddd: '51', segmento: 'Frigorífico', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: '-' },
            { cnpj: '01.234.172/0001-82', fantasia: 'FRIGORIFICO BONNA', razao: 'FRIGORIFICO BONNA CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(54) 3231-0000', ddd: '54', segmento: 'Frigorífico', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 100.000,00', inicio: '15/08/1999', dataSit: '15/08/1999', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD BR 116', numero: 'KM 45', complemento: 'SALA 1', bairro: 'ZONA RURAL', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '-', email: 'contato@bonnacarne.com.br' },
            { cnpj: '01.246.405/0001-58', fantasia: 'IRMAOS SCHMALITZ', razao: 'IRMAOS SCHMALITZ LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 3722-4664', ddd: '51', segmento: 'Atacado', municipio: 'Caxias do Sul', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 50.000,00', inicio: '10/01/1995', dataSit: '10/01/1995', cnae_principal: '1011201', cnae_secundario: '4637101', logradouro: 'AV BRASIL', numero: '1000', complemento: '-', bairro: 'CENTRO', cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '(54) 9999-0000', email: 'contato@schmalitz.com.br' },
            { cnpj: '01.323.689/0001-58', fantasia: 'MATADOURO PINHAL', razao: 'IRMAOS SALVATI LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '', ddd: '', segmento: 'Varejo', municipio: 'Pelotas', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00', inicio: '01/06/2001', dataSit: '01/06/2001', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'ESTRADA DO PINHAL', numero: '500', complemento: '-', bairro: 'INTERIOR', cep: '96000-000', municipio: 'PELOTAS - RS', tel2: '-', email: '-' },
            { cnpj: '01.332.595/0001-02', fantasia: 'FRIGORIFICO COOPES', razao: 'COOPERATIVA AGROPECUARIA SUL CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 37224664', ddd: '51', segmento: 'Cooperativa', municipio: 'Cachoeira do Sul', tipo: 'FILIAL', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 0,00', inicio: '02/05/2002', dataSit: '02/05/2002', cnae_principal: '1011201', cnae_secundario: '4711301', logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS', cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: 'financeiro@coopes.com.br' },
            { cnpj: '02.123.456/0001-10', fantasia: 'FRIGORIFICO SERRA', razao: 'FRIGORIFICO SERRA LTDA', situacao: 'ATIVA', uf: 'SC', telefone: '(48) 1234-5678', ddd: '48', segmento: 'Frigorífico', municipio: 'Lages', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 200.000,00', inicio: '20/03/2010', dataSit: '20/03/2010', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD SC 114', numero: 'KM 12', complemento: '-', bairro: 'ZONA RURAL', cep: '88500-000', municipio: 'LAGES - SC', tel2: '-', email: 'vendas@frigorificoserra.com.br' },
            { cnpj: '03.456.789/0001-20', fantasia: 'DISTRIBUIDORA VALE', razao: 'DISTRIBUIDORA VALE ALIMENTOS LTDA', situacao: 'ATIVA', uf: 'PR', telefone: '(41) 9876-5432', ddd: '41', segmento: 'Atacado', municipio: 'Curitiba', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 300.000,00', inicio: '10/06/2015', dataSit: '10/06/2015', cnae_principal: '4637101', cnae_secundario: '4711301', logradouro: 'AV DAS TORRES', numero: '1500', complemento: 'LOJA 02', bairro: 'CIDADE INDUSTRIAL', cep: '81000-000', municipio: 'CURITIBA - PR', tel2: '(41) 9999-1111', email: 'contato@distribuidoravale.com.br' },
            { cnpj: '04.567.890/0001-30', fantasia: 'SUPERMERCADO BOM PRECO', razao: 'SUPERMERCADO BOM PRECO SA', situacao: 'ATIVA', uf: 'SP', telefone: '(11) 2345-6789', ddd: '11', segmento: 'Varejo', municipio: 'São Paulo', tipo: 'MATRIZ', natureza: 'Sociedade Anônima', porte: 'Demais', capital: 'R$ 1.000.000,00', inicio: '01/01/2000', dataSit: '01/01/2000', cnae_principal: '4711301', cnae_secundario: '5611201', logradouro: 'AV PAULISTA', numero: '2000', complemento: 'ANDAR 10', bairro: 'BELA VISTA', cep: '01310-100', municipio: 'SAO PAULO - SP', tel2: '(11) 9999-2222', email: 'contato@bompreco.com.br' },
            { cnpj: '05.678.901/0001-40', fantasia: 'TRANSPORTES RAPIDO', razao: 'TRANSPORTES RAPIDO LTDA', situacao: 'ATIVA', uf: 'MG', telefone: '(31) 3456-7890', ddd: '31', segmento: 'Serviços', municipio: 'Belo Horizonte', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 80.000,00', inicio: '05/09/2012', dataSit: '05/09/2012', cnae_principal: '4930202', cnae_secundario: '5212501', logradouro: 'RUA DOS INCONFIDENTES', numero: '700', complemento: '-', bairro: 'SAVASSI', cep: '30140-120', municipio: 'BELO HORIZONTE - MG', tel2: '(31) 8888-3333', email: 'contato@transportesrapido.com.br' },
            { cnpj: '06.789.012/0001-50', fantasia: 'FRIGORIFICO NORTE', razao: 'FRIGORIFICO NORTE CARNE LTDA', situacao: 'ATIVA', uf: 'PR', telefone: '(44) 4567-8901', ddd: '44', segmento: 'Frigorífico', municipio: 'Maringá', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 500.000,00', inicio: '10/10/2008', dataSit: '10/10/2008', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD PR 317', numero: 'KM 120', complemento: '-', bairro: 'ZONA RURAL', cep: '87000-000', municipio: 'MARINGA - PR', tel2: '-', email: 'contato@frigorificonorte.com.br' },
            { cnpj: '07.890.123/0001-60', fantasia: 'COOPERATIVA AGRICOLA', razao: 'COOPERATIVA AGRICOLA REGIONAL LTDA', situacao: 'ATIVA', uf: 'SC', telefone: '(47) 5678-9012', ddd: '47', segmento: 'Cooperativa', municipio: 'Joaçaba', tipo: 'MATRIZ', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 600.000,00', inicio: '15/05/2005', dataSit: '15/05/2005', cnae_principal: '1011201', cnae_secundario: '4623101', logradouro: 'RUA DA COOPERATIVA', numero: '500', complemento: '-', bairro: 'CENTRO', cep: '89600-000', municipio: 'JOACABA - SC', tel2: '(47) 8888-4444', email: 'contato@cooperativaagricola.com.br' },
            { cnpj: '08.901.234/0001-70', fantasia: 'ATACADAO CENTRAL', razao: 'ATACADAO CENTRAL LTDA', situacao: 'ATIVA', uf: 'SP', telefone: '(11) 6789-0123', ddd: '11', segmento: 'Atacado', municipio: 'Campinas', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 750.000,00', inicio: '01/02/2018', dataSit: '01/02/2018', cnae_principal: '4637101', cnae_secundario: '4711301', logradouro: 'AV BRASIL', numero: '1000', complemento: 'GALPAO A', bairro: 'NORTE', cep: '13000-000', municipio: 'CAMPINAS - SP', tel2: '(19) 9999-5555', email: 'vendas@atacadaocentral.com.br' },
            { cnpj: '09.012.345/0001-80', fantasia: 'RESTAURANTE SABOR', razao: 'RESTAURANTE SABOR LTDA', situacao: 'ATIVA', uf: 'RJ', telefone: '(21) 7890-1234', ddd: '21', segmento: 'Serviços', municipio: 'Rio de Janeiro', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 20.000,00', inicio: '20/11/2019', dataSit: '20/11/2019', cnae_principal: '5611201', cnae_secundario: '5630301', logradouro: 'AV ATLANTICA', numero: '5000', complemento: 'LOJA 101', bairro: 'COPACABANA', cep: '22070-011', municipio: 'RIO DE JANEIRO - RJ', tel2: '(21) 9999-6666', email: 'contato@restaurantesabor.com.br' },
            { cnpj: '10.123.456/0001-90', fantasia: 'MERCADO ECONOMICO', razao: 'MERCADO ECONOMICO LTDA', situacao: 'ATIVA', uf: 'MG', telefone: '(32) 8901-2345', ddd: '32', segmento: 'Varejo', municipio: 'Juiz de Fora', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 40.000,00', inicio: '10/01/2016', dataSit: '10/01/2016', cnae_principal: '4711301', cnae_secundario: '4721101', logradouro: 'RUA HALFELD', numero: '450', complemento: '-', bairro: 'CENTRO', cep: '36010-000', municipio: 'JUIZ DE FORA - MG', tel2: '(32) 9999-7777', email: 'contato@mercadoeconomico.com.br' },
            { cnpj: '11.234.567/0001-00', fantasia: 'FRIGORIFICO SUL', razao: 'FRIGORIFICO SUL LTDA', situacao: 'ATIVA', uf: 'PR', telefone: '(42) 9012-3456', ddd: '42', segmento: 'Frigorífico', municipio: 'Ponta Grossa', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 320.000,00', inicio: '02/07/2011', dataSit: '02/07/2011', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'ROD BR 153', numero: 'KM 80', complemento: '-', bairro: 'ZONA RURAL', cep: '84000-000', municipio: 'PONTA GROSSA - PR', tel2: '(42) 9999-8888', email: 'contato@frigorificosul.com.br' },
            { cnpj: '12.345.678/0001-11', fantasia: 'DISTRIBUIDORA CENTRAL', razao: 'DISTRIBUIDORA CENTRAL LTDA', situacao: 'ATIVA', uf: 'SP', telefone: '(19) 1122-3344', ddd: '19', segmento: 'Atacado', municipio: 'Campinas', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 400.000,00', inicio: '12/12/2013', dataSit: '12/12/2013', cnae_principal: '4637101', cnae_secundario: '4711301', logradouro: 'AV ANDRADE NEVES', numero: '900', complemento: 'SALA 3', bairro: 'CENTRO', cep: '13000-000', municipio: 'CAMPINAS - SP', tel2: '(19) 9999-9999', email: 'contato@distribuidoracentral.com.br' },
            { cnpj: '13.456.789/0001-22', fantasia: 'PADARIA PAO QUENTE', razao: 'PADARIA PAO QUENTE LTDA', situacao: 'ATIVA', uf: 'SP', telefone: '(11) 2233-4455', ddd: '11', segmento: 'Varejo', municipio: 'São Paulo', tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 15.000,00', inicio: '05/08/2020', dataSit: '05/08/2020', cnae_principal: '4721101', cnae_secundario: '5611201', logradouro: 'RUA VERGUEIRO', numero: '1200', complemento: 'LOJA 12', bairro: 'LIBERDADE', cep: '01504-000', municipio: 'SAO PAULO - SP', tel2: '(11) 9999-0000', email: 'contato@padariapaoquente.com.br' },
            { cnpj: '14.567.890/0001-33', fantasia: 'LOGISTICA EXPRESSA', razao: 'LOGISTICA EXPRESSA LTDA', situacao: 'ATIVA', uf: 'RJ', telefone: '(21) 3344-5566', ddd: '21', segmento: 'Serviços', municipio: 'Niterói', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 100.000,00', inicio: '01/03/2017', dataSit: '01/03/2017', cnae_principal: '4930202', cnae_secundario: '5212501', logradouro: 'ALAMEDA SÃO BOAVENTURA', numero: '300', complemento: 'SALA 502', bairro: 'FONSECA', cep: '24120-000', municipio: 'NITEROI - RJ', tel2: '(21) 9999-1111', email: 'contato@logisticaexpressa.com.br' },
            { cnpj: '15.678.901/0001-44', fantasia: 'COOPERATIVA LEITE', razao: 'COOPERATIVA LEITE E DERIVADOS LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 4455-6677', ddd: '51', segmento: 'Cooperativa', municipio: 'Santa Rosa', tipo: 'MATRIZ', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 800.000,00', inicio: '10/04/2009', dataSit: '10/04/2009', cnae_principal: '1051101', cnae_secundario: '4623101', logradouro: 'ROD RS 344', numero: 'KM 10', complemento: '-', bairro: 'ZONA RURAL', cep: '98900-000', municipio: 'SANTA ROSA - RS', tel2: '(55) 9999-2222', email: 'contato@cooperativaleite.com.br' },
            { cnpj: '16.789.012/0001-55', fantasia: 'FRIGORIFICO VALE', razao: 'FRIGORIFICO VALE CARNE LTDA', situacao: 'ATIVA', uf: 'SC', telefone: '(48) 5566-7788', ddd: '48', segmento: 'Frigorífico', municipio: 'Chapecó', tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 900.000,00', inicio: '22/09/2014', dataSit: '22/09/2014', cnae_principal: '1011201', cnae_secundario: '1013901', logradouro: 'AV GETULIO VARGAS', numero: '1500', complemento: '-', bairro: 'CENTRO', cep: '89800-000', municipio: 'CHAPECO - SC', tel2: '(49) 9999-3333', email: 'contato@frigorificovale.com.br' }
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
                refreshCustomSelect(filterUf);
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
            setDirty(false);
            segmentScreen.style.display = 'none';
            mainScreen.style.display = 'block';
            updateSegmentFilter();
        }

        // ========== FUNÇÕES DOS MODAIS ==========
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

        // ===== CONFIRMAÇÃO AO IGNORAR CADASTRO =====
            const btnIgnoreCadastro = document.getElementById('btn-ignore-cadastro');

            if (btnIgnoreCadastro) {
                btnIgnoreCadastro.addEventListener('click', function() {
                    showConfirm('Ignorar Cadastro', 'Tem certeza que deseja ignorar este cadastro? Esta ação não poderá ser desfeita.', function() {
                        // Fecha o modal de detalhes
                        detailsModal.style.display = 'none';
                        // FUTURAMENTE: excluir o registro da tela aqui
                    });
                });
            }
        detailsModal.addEventListener('click', function(e) { if(e.target === this) detailsModal.style.display = 'none'; });
        genericModal.addEventListener('click', function(e) { if(e.target === this) genericModal.style.display = 'none'; });
        confirmModal.addEventListener('click', function(e) { if(e.target === this) confirmModal.style.display = 'none'; });

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

        // Função específica para alterações não salvas (mostra 3 botões)
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

        // ========== EVENTOS DE NAVEGAÇÃO (COM ALTERAÇÕES NÃO SALVAS) ==========
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

        // ========== NOVO SEGMENTO ==========
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

        // ========== RESET DO FORMULÁRIO ==========
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
            refreshCustomSelect(linkCnaeSelect);
            setDirty(false);
        }

        // ========== RENDER TABELA DE SEGMENTOS ==========
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

        // ========== SUBMIT ==========
        document.getElementById('segmentoForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const nome = segmentNome.value.trim();
            if (!nome) {
                showWarning('Informe o nome do segmento.');
                return;
            }
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
            setDirty(false);
            resetSegmentForm();
            renderSegmentTable(segmentSearch.value);
            updateSegmentFilter();
            confirmModal.style.display = 'none';
        });

        // ========== BOTÃO CANCELAR EDIÇÃO ==========
        btnCancelSegment.addEventListener('click', function() {
            resetSegmentForm();
        });

        segmentSearch.addEventListener('input', function() { renderSegmentTable(this.value); });

        // ========== EDITAR ==========
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
            setDirty(true);
        }

        // ========== EXCLUIR ==========
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

        // ========== TABELA PRINCIPAL ==========
        function renderTable(data) {
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum resultado encontrado.</td></tr>`;
                const footer = document.getElementById('records-footer');
                if (footer) footer.textContent = 'Exibindo 0 registros';
                btnPrev.disabled = true;
                btnNext.disabled = true;
                pageIndicator.textContent = 'Página 0';
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
                    <td><button class="btn-detail"><i class="fas fa-info-circle"></i> Detalhes</button></td>
                </tr>`;
                tbody.innerHTML += row;
            });

            const textoExibicao = `Exibindo ${startIndex + 1} - ${Math.min(endIndex, totalRecords)} de ${totalRecords} registros`;
            const footer = document.getElementById('records-footer');
            if (footer) footer.textContent = textoExibicao;
            pageIndicator.textContent = `Página ${currentPage}`;
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
            refreshCustomSelect(document.getElementById('filter-segmento'));
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
            refreshCustomSelect(filterUf);
            refreshCustomSelect(filterRegiao);
            refreshCustomSelect(document.getElementById('filter-segmento'));
            refreshCustomSelect(document.getElementById('filter-escopo-segmento'));
            refreshCustomSelect(filterTypeToggle);
            refreshCustomSelect(document.getElementById('filter-tipo-cnae'));
            applyFilters();
        }

        function changePage(direction) {
            const totalPages = Math.ceil(filteredData.length / rowsPerPage);
            if (direction === 'next' && currentPage < totalPages) {
                currentPage++;
            } else if (direction === 'prev' && currentPage > 1) {
                currentPage--;
            } else {
                return;
            }
            renderTable(filteredData);
        }

        // ========== LISTENER GLOBAL PARA FECHAR TOOLTIPS AO CLICAR FORA ==========
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.cnae-tooltip')) {
                document.querySelectorAll('.cnae-tooltip.open').forEach(t => t.classList.remove('open'));
            }
        });

        // ========== INICIALIZAÇÃO ==========
        initializeCustomSelects();
        updateSegmentFilter();
        carregarUFsDaAPI();
        carregarCnaesIniciais();
        btnSearch.addEventListener('click', applyFilters);
        btnClear.addEventListener('click', clearFilters);
        btnPrev.addEventListener('click', function() { changePage('prev'); });
        btnNext.addEventListener('click', function() { changePage('next'); });
        applyFilters();

    } catch (error) {
        console.error('❌ Erro durante a inicialização:', error);
    }
});