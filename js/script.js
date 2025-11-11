document.addEventListener('DOMContentLoaded', () => {
    const contentCache = {};
    
    // Seções de conteúdo devem estar dentro de um container principal
    // Exemplo: <div id="app-content"> <section class="content" id="Home">...</section> </div>
    const contentContainer = document.getElementById('app-content') || document.body;
    
    // Função auxiliar para mostrar um indicador de carregamento
    function showLoading(targetSection) {
        if (targetSection) {
             // Adiciona um spinner/mensagem simples
            targetSection.innerHTML = '<div class="loading-spinner">Carregando...</div>'; 
            targetSection.classList.add('loading');
        }
    }

    // Função auxiliar para remover o indicador de carregamento
    function hideLoading(targetSection) {
        if (targetSection) {
            targetSection.classList.remove('loading');
            // O conteúdo será sobrescrito logo em seguida, então não é preciso limpar aqui
        }
    }

    async function loadSectionContent(sectionId) {
        // Se já está em cache, retorna rapidamente
        if (contentCache[sectionId]) return; 
        
        try {
            // Remove o '#' para formar o nome do arquivo
            const fileName = sectionId.substring(1); 
            const response = await fetch(`html/${fileName}.html`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Tenta obter o conteúdo da classe '.content'
            const contentElement = doc.querySelector('.content');
            if (contentElement) {
                contentCache[sectionId] = contentElement.innerHTML;
            } else {
                 // Caso o arquivo HTML não tenha a classe '.content'
                contentCache[sectionId] = `<p>Atenção: Conteúdo da seção '${fileName}' não encontrado dentro do seletor .content.</p>`;
            }
            
        } catch (error) {
             // Tratamento de erro mais informativo
            contentCache[sectionId] = `<p>Erro ao carregar o conteúdo para ${sectionId}. Verifique o console para mais detalhes.</p>`;
            console.error('Erro ao carregar o conteúdo da seção:', sectionId, error);
        }
    }

    async function showSection(sectionId) {
        // CORREÇÃO PREVENTIVA: Se por algum motivo o sectionId for vazio, usa #Home
        const validSectionId = sectionId || '#Home';
        const targetSection = document.querySelector(validSectionId);

        if (!targetSection) {
            console.warn(`Seção não encontrada no DOM: ${validSectionId}`);
            return;
        }

        // 1. Otimização na Limpeza: Remove a classe 'active' de todas as seções e esvazia o conteúdo.
        document.querySelectorAll('.content.active').forEach(section => {
            section.innerHTML = ''; 
            section.classList.remove('active');
        });
        
        // 2. Exibe o loading antes de carregar o conteúdo
        showLoading(targetSection);

        // 3. Aguarda o carregamento do conteúdo (ou uso do cache)
        await loadSectionContent(validSectionId);
        
        // 4. Remove o loading e insere o conteúdo
        hideLoading(targetSection);
        targetSection.innerHTML = contentCache[validSectionId];
        targetSection.classList.add('active');
        
        // 5. Atualiza o estado da navegação
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === validSectionId);
        });
    }

    // Event listeners (Links de Navegação)
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href');
            await showSection(sectionId);
            // 'pushState' adiciona ao histórico do navegador
            history.pushState(null, null, sectionId);
        });
    });

    // Menu Hamburguer (se existir no DOM)
    const menuIcon = document.querySelector('.menu-icon');
    if (menuIcon) {
        menuIcon.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) navLinks.classList.toggle('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-links') && !e.target.closest('.menu-icon')) {
            document.querySelector('.nav-links').classList.remove('active');
        }
    });

    window.addEventListener('scroll', () => {
        document.querySelector('.nav-links').classList.remove('active');
    });

    // --- SEÇÃO CORRIGIDA ---

    // Inicialização
    // Garante que, se o hash for vazio (""), ele use '#Home' como padrão.
    const initialSection = window.location.hash || '#Home';
    showSection(initialSection);

    // MELHORIA: Se o usuário acessou 'index.html' (sem hash),
    // atualiza a URL para 'index.html#Home' sem recarregar a página.
    if (window.location.hash !== initialSection) {
        // 'replaceState' atualiza a URL sem criar uma nova entrada no histórico
        history.replaceState(null, null, initialSection);
    }

    // Evento para botões "voltar" e "avançar" do navegador
    window.addEventListener('popstate', () => {
        // CORREÇÃO: Garante que, se o hash ficar vazio (ex: voltou para a raiz),
        // ele carregue a #Home, e não uma seção vazia.
        const sectionId = window.location.hash || '#Home';
        showSection(sectionId);
    });
});