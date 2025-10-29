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
        const targetSection = document.querySelector(sectionId);

        if (!targetSection) {
            console.warn(`Seção não encontrada no DOM: ${sectionId}`);
            return;
        }

        // 1. Otimização na Limpeza: Remove a classe 'active' de todas as seções e esvazia o conteúdo.
        // O código original limpava *todos* os elementos com a classe .content, o que pode ser demais.
        // O ideal é remover a classe 'active' do item atualmente ativo.
        document.querySelectorAll('.content.active').forEach(section => {
             // Limpa o conteúdo *apenas* se estiver ativo (opcional, mas economiza memória)
            section.innerHTML = ''; 
            section.classList.remove('active');
        });
        
        // 2. Exibe o loading antes de carregar o conteúdo
        showLoading(targetSection);

        // 3. Aguarda o carregamento do conteúdo (ou uso do cache)
        await loadSectionContent(sectionId);
        
        // 4. Remove o loading e insere o conteúdo
        hideLoading(targetSection);
        targetSection.innerHTML = contentCache[sectionId];
        targetSection.classList.add('active');
        
        // 5. Atualiza o estado da navegação
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === sectionId);
        });
    }


    // Restante do código (Event listeners, Menu, Inicialização) permanece o mesmo, pois está correto.

    // Event listeners
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href');
            await showSection(sectionId);
            history.pushState(null, null, sectionId);
        });
    });

    // Menu Hamburguer
    document.querySelector('.menu-icon').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-links') && !e.target.closest('.menu-icon')) {
            document.querySelector('.nav-links').classList.remove('active');
        }
    });

    window.addEventListener('scroll', () => {
        document.querySelector('.nav-links').classList.remove('active');
    });

    // Inicialização
    const initialSection = window.location.hash || '#Home';
    showSection(initialSection);
    atualizarContadorVisitas(); // Chamada da função que você definiu (deve estar em outro lugar)

    window.addEventListener('popstate', () => {
        showSection(window.location.hash);
    });
});