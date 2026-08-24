document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ Página carregada! O JavaScript está rodando.");

    const tbody = document.getElementById('table-body');
    const recordsText = document.getElementById('records-text');
    const pageIndicator = document.getElementById('page-indicator');
    const btnSearch = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear-filters');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    const modalOverlay = document.getElementById('details-modal');
    const closeModal = document.querySelector('.close-modal');

    const genericModalOverlay = document.getElementById('generic-modal');
    const genericModalBody = document.getElementById('generic-modal-body');
    const genericModalTitle = document.getElementById('generic-modal-title');
    const genericModalSubtitle = document.getElementById('generic-modal-subtitle');
    const genericSearch = document.getElementById('generic-search');
    const closeGenericModal = document.getElementById('close-generic-modal');

    const mockData = [
        { cnpj: '06.771.019/0001-31', fantasia: 'MATADOURO FICAGNA', razao: 'ZELO FICAGNA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 3722-4664',
          tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '02/05/2002', dataSit: '02/05/2002', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS',
          cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: '-' },
        { cnpj: '01.234.172/0001-82', fantasia: 'FRIGORIFICO BONNA', razao: 'FRIGORIFICO BONNA CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '',
          tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 100.000,00',
          inicio: '15/08/1999', dataSit: '15/08/1999', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'ROD BR 116', numero: 'KM 45', complemento: 'SALA 1', bairro: 'ZONA RURAL',
          cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '-', email: 'contato@bonnacarne.com.br' },
        { cnpj: '01.246.405/0001-58', fantasia: 'IMAOS SCHMALITZ', razao: 'IRMAOS SCHMALITZ LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '',
          tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 50.000,00',
          inicio: '10/01/1995', dataSit: '10/01/1995', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'AV BRASIL', numero: '1000', complemento: '-', bairro: 'CENTRO',
          cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '(54) 9999-0000', email: 'contato@schmalitz.com.br' },
        { cnpj: '01.323.689/0001-58', fantasia: 'MATADOURO PINHAL', razao: 'IRMAOS SALVATI LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '',
          tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '01/06/2001', dataSit: '01/06/2001', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'ESTRADA DO PINHAL', numero: '500', complemento: '-', bairro: 'INTERIOR',
          cep: '96000-000', municipio: 'PELOTAS - RS', tel2: '-', email: '-' },
        { cnpj: '01.332.595/0001-02', fantasia: 'FRIGORIFICO COOPES', razao: 'COOPERATIVA AGROPECUARIA SUL CARNE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 37224664',
          tipo: 'FILIAL', natureza: 'Cooperativa', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '02/05/2002', dataSit: '02/05/2002', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'LOCALIDADE DE TRES VENDAS', numero: 'S/N', complemento: '-', bairro: 'TRES VENDAS',
          cep: '96501-035', municipio: 'CACHOEIRA DO SUL - RS', tel2: '-', email: 'financeiro@coopes.com.br' },
        { cnpj: '01.758.482/0001-35', fantasia: 'FREESE CASA DE CARNES', razao: 'FRIGORIFICO FREESE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '',
          tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '01/02/2000', dataSit: '01/02/2000', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'RUA CENTRAL', numero: '100', complemento: '-', bairro: 'CENTRO',
          cep: '97000-000', municipio: 'SANTA MARIA - RS', tel2: '-', email: '-' },
        { cnpj: '01.758.482/0001-35', fantasia: 'FREESE CASA DE CARNES', razao: 'FRIGORIFICO FREESE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 37431987',
          tipo: 'FILIAL', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '01/02/2000', dataSit: '01/02/2000', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'RUA SANTA CLARA', numero: '200', complemento: '-', bairro: 'JARDIM',
          cep: '97000-000', municipio: 'SANTA MARIA - RS', tel2: '-', email: '-' },
        { cnpj: '02.018.744/0001-49', fantasia: 'PRODUTOS COLECION', razao: 'FRIGORIFICO SILVA RIO GRANDE LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(053) 3310499',
          tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '01/01/1990', dataSit: '01/01/1990', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'ROD RS 471', numero: 'KM 12', complemento: '-', bairro: 'VILA NOVA',
          cep: '96000-000', municipio: 'PELOTAS - RS', tel2: '-', email: '-' },
        { cnpj: '02.052.326/0001-79', fantasia: 'CERVIER AGRO-INDUSTRIAL', razao: 'CERVIER AGRO INDUSTRIAL LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '',
          tipo: 'MATRIZ', natureza: 'Sociedade Empresária Limitada', porte: 'Demais', capital: 'R$ 0,00',
          inicio: '01/01/1995', dataSit: '01/01/1995', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'AV INDUSTRIAL', numero: '5000', complemento: '-', bairro: 'INDUSTRIAL',
          cep: '95000-000', municipio: 'CAXIAS DO SUL - RS', tel2: '-', email: '-' },
        { cnpj: '02.200.523/0001-67', fantasia: 'ABATEDOURO BERGENTHAL', razao: 'FRIVEFRIG SUL FRIGORIFICO EMPA LTDA', situacao: 'ATIVA', uf: 'RS', telefone: '(51) 98881640',
          tipo: 'FILIAL', natureza: 'Sociedade Anônima', porte: 'Demais', capital: 'R$ 10.000.000,00',
          inicio: '01/09/1998', dataSit: '01/09/1998', cnae: '1011201 - Frigorífico - abate de bovinos',
          logradouro: 'ROD ESTADUAL', numero: '30', complemento: '-', bairro: 'ZONA RURAL',
          cep: '93000-000', municipio: 'SÃO LEOPOLDO - RS', tel2: '(51) 9888-1234', email: 'administrativo@frivefrig.com.br' }
    ];

    let currentPage = 1;
    const rowsPerPage = 5;
    let filteredData = [];
    let currentItems = [];

    function renderTable(data) {
        tbody.innerHTML = '';
        if(data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhum resultado encontrado.</td></tr>`;
            recordsText.innerText = `Exibindo 0 registros`;
            btnPrev.disabled = true; btnNext.disabled = true;
            pageIndicator.innerText = `Página 0`;
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
                <td><button class="btn-detail">Detalhes</button></td>
            </tr>`;
            tbody.innerHTML += row;
        });

        recordsText.innerText = `Exibindo ${startIndex + 1} - ${Math.min(endIndex, totalRecords)} de ${totalRecords} registros`;
        pageIndicator.innerText = `Página ${currentPage}`;
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
        document.getElementById('det-cnae').innerText = company.cnae;
        document.getElementById('det-logradouro').innerText = company.logradouro;
        document.getElementById('det-numero').innerText = company.numero;
        document.getElementById('det-complemento').innerText = company.complemento;
        document.getElementById('det-bairro').innerText = company.bairro;
        document.getElementById('det-cep').innerText = company.cep;
        document.getElementById('det-municipio').innerText = company.municipio;
        document.getElementById('det-tel1').innerText = company.telefone || '-';
        document.getElementById('det-tel2').innerText = company.tel2 || '-';
        document.getElementById('det-email').innerText = company.email || '-';

        modalOverlay.style.display = 'flex'; 
    }

    tbody.addEventListener('click', function(e) {
        if(e.target.classList.contains('btn-detail')) {
            const row = e.target.closest('tr');
            const cnpj = row.cells[0].innerText;
            openDetailsModal(cnpj);
        }
    });

    closeModal.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
    modalOverlay.addEventListener('click', function(e) {
        if(e.target === this) { modalOverlay.style.display = 'none'; }
    });

    const ufData = [
        { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
        { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
        { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
        { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
        { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
        { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
        { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' }, { sigla: 'RS', nome: 'Rio Grande do Sul' },
        { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
        { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' }
    ];

    const auxData = {
        'cnpjs': ['Empresa 1 - 06.771.019/0001-31', 'Empresa 2 - 01.234.172/0001-82', 'Empresa 3 - 01.246.405/0001-58'],
        'municipios': ['São Paulo - SP', 'Rio de Janeiro - RJ', 'Belo Horizonte - MG', 'Porto Alegre - RS'],
        'natureza': ['Sociedade Empresária Limitada', 'Empresa Individual de Responsabilidade Limitada', 'Sociedade Anônima'],
        'qualificacoes': ['Sócio Administrador', 'Sócio', 'Procurador'],
        'paises': ['Brasil', 'Estados Unidos', 'Argentina', 'Portugal'],
        'motivos': ['Motivo 1', 'Motivo 2', 'Motivo 3']
    };

    function formatAsCard(item) {
        if (typeof item === 'string') return { sigla: '', nome: item, full: item };
        return { sigla: item.sigla || '', nome: item.nome || '', full: item.sigla ? `${item.sigla} - ${item.nome}` : item.nome };
    }

    function openGenericModal(title, subtitle, items) {
        genericModalTitle.innerText = title;
        genericModalSubtitle.innerText = subtitle;
        currentItems = items; 
        genericSearch.value = ''; 
        renderGenericList(items); 
        genericModalOverlay.style.display = 'flex';
    }

    function renderGenericList(items) {
        if (!items || items.length === 0) {
            genericModalBody.innerHTML = '<p style="padding: 15px; text-align: center; color: #666;">Nenhum item encontrado.</p>';
            return;
        }

        let html = '<ul class="generic-list">';
        items.forEach((item, index) => {
            const card = formatAsCard(item);
            const cardHtml = card.sigla ? `
                <div class="card-info">
                    <span class="card-sigla">${card.sigla}</span>
                    <span class="card-nome">${card.nome}</span>
                    <span class="card-full">${card.full}</span>
                </div>
            ` : `
                <div class="card-info">
                    <span class="card-nome" style="font-weight:bold;">${card.nome}</span>
                </div>
            `;

            html += `<li class="generic-card" data-index="${index}">
                ${cardHtml}
                <button class="card-btn">OK</button>
            </li>`;
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
                setTimeout(() => { genericModalOverlay.style.display = 'none'; }, 200);
            }
        }
    });

    closeGenericModal.addEventListener('click', () => { genericModalOverlay.style.display = 'none'; });
    genericModalOverlay.addEventListener('click', function(e) {
        if(e.target === this) { genericModalOverlay.style.display = 'none'; }
    });

    // Menu lateral
    document.getElementById('menu-cnpjs').addEventListener('click', () => openGenericModal('Pesquisa CNPJ', 'Informe o CNPJ:', auxData.cnpjs));
    document.getElementById('menu-municipios').addEventListener('click', () => openGenericModal('Pesquisa Município', 'Informe o município:', auxData.municipios));
    document.getElementById('menu-natureza').addEventListener('click', () => openGenericModal('Pesquisa Natureza Jurídica', 'Informe a natureza:', auxData.natureza));
    document.getElementById('menu-qualificacoes').addEventListener('click', () => openGenericModal('Pesquisa Qualificação', 'Informe a qualificação:', auxData.qualificacoes));
    document.getElementById('menu-paises').addEventListener('click', () => openGenericModal('Pesquisa País', 'Informe o país:', auxData.paises));
    document.getElementById('menu-motivos').addEventListener('click', () => openGenericModal('Pesquisa Motivo', 'Informe o motivo:', auxData.motivos));

    // --- LÓGICA DE FILTROS (Voltou para o select do HTML) ---
    function applyFilters() {
        const uf = document.getElementById('filter-uf').value;
        const status = document.getElementById('filter-status').value;
        
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px;">Carregando dados...</td></tr>`;

        setTimeout(() => {
            filteredData = mockData.filter(item => {
                const matchUF = uf ? item.uf === uf : true;
                const matchStatus = status ? item.situacao === status : true;
                return matchUF && matchStatus; 
            });
            currentPage = 1;
            renderTable(filteredData);
        }, 400);
    }

    function clearFilters() {
        document.getElementById('filter-uf').value = '';
        document.getElementById('filter-status').value = 'ATIVA';
        document.getElementById('filter-cnae').value = '';
        applyFilters();
    }

    function changePage(direction) {
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        if(direction === 'next' && currentPage < totalPages) currentPage++;
        if(direction === 'prev' && currentPage > 1) currentPage--;
        renderTable(filteredData);
    }

    btnSearch.addEventListener('click', applyFilters);
    btnClear.addEventListener('click', clearFilters);
    btnPrev.addEventListener('click', function() { changePage('prev'); });
    btnNext.addEventListener('click', function() { changePage('next'); });

    applyFilters();
});