document.addEventListener('DOMContentLoaded', () => {
    const contentCache = {};
    // mantém a URL base de onde cada seção foi carregada (para resolver hrefs relativos)
    const contentBaseBySection = {};
    
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
            const fetchUrl = `html/${fileName}.html`;
            const response = await fetch(fetchUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();

            // armazena a URL base usada para resolver links relativos dentro desta seção
            try { contentBaseBySection[sectionId] = response.url || new URL(fetchUrl, location.href).href; } catch (e) { contentBaseBySection[sectionId] = new URL(fetchUrl, location.href).href; }
            
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

    // Delegation: quando clicar em links .Learn-more, carregar a resenha dentro do index
    document.addEventListener('click', async (e) => {
        const a = e.target.closest('a.Learn-more');
        if (!a) return; // não é um link de resenha

        const href = a.getAttribute('href');
        if (!href) return;
        // Resolve href relative à seção pai (se conhecida) para suportar links como "resenhas/arquivo.html"
        let baseForResolve = location.href;
        const parentSection = a.closest('section.content');
        if (parentSection && parentSection.id) {
            const parentKey = `#${parentSection.id}`;
            if (contentBaseBySection[parentKey]) baseForResolve = contentBaseBySection[parentKey];
        }
        const url = new URL(href, baseForResolve).href;

        // Se for uma resenha (path contendo 'resenhas'), carregamos via DOM no estilo das sections
        if (href.includes('resenhas')) {
            e.preventDefault();

            console.debug('[resenha] clique detectado, href=', href, 'resolved=', url);

            // derive nome do arquivo para criar um id único
            const fileName = url.split('/').pop().replace(/\.html?$/i, '');
            const sectionId = `#resenha-${fileName}`;

            // cria a section no DOM se ainda não existir
            let target = document.getElementById(sectionId.slice(1));
            if (!target) {
                target = document.createElement('section');
                target.id = sectionId.slice(1);
                target.className = 'content';
                // opcional: inserir ao final do container de conteúdo
                contentContainer.appendChild(target);
            }

            // se já carregamos antes, apenas mostramos
            if (contentCache[sectionId]) {
                console.debug('[resenha] usando cache para', sectionId);
                try {
                    await showSection(sectionId);
                    history.pushState(null, null, sectionId);
                } catch (err) {
                    console.error('[resenha] erro ao mostrar seção cached', sectionId, err);
                }
                return;
            }

            // mostra loading e busca o arquivo
            showLoading(target);
            try {
                console.debug('[resenha] iniciando fetch de', url);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                console.debug('[resenha] fetch ok', url, 'status=', res.status);
                const text = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                // preferir <section id=...> ou .content ou <main>
                const remoteSection = doc.querySelector('section') || doc.querySelector('.content') || doc.querySelector('main') || doc.body;
                const inner = remoteSection ? remoteSection.innerHTML : text;

                // cacheia com chave igual ao sectionId usado pelo showSection
                contentCache[sectionId] = inner;
                hideLoading(target);

                // exibe a seção (reaproveita showSection)
                try {
                    await showSection(sectionId);
                    // atualiza o histórico para permitir voltar
                    history.pushState(null, null, sectionId);
                } catch (err) {
                    console.error('[resenha] erro ao mostrar seção após fetch', sectionId, err);
                    target.innerHTML = '<p>Erro ao exibir a resenha. Veja o console.</p>';
                }

            } catch (err) {
                hideLoading(target);
                console.error('Erro ao carregar resenha via DOM:', err);
                target.innerHTML = `<p>Não foi possível carregar a resenha. Verifique o console para mais detalhes.</p>`;
            }

            return;
        }

        // Caso contrário, para outros Learn-more, manter comportamento anterior (overlay)
        e.preventDefault();
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // tenta extrair o conteúdo principal (main ou section)
            const remoteMain = doc.querySelector('main') || doc.querySelector('section') || doc.body;

            // cria/obtém overlay
            let overlay = document.getElementById('resenha-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'resenha-overlay';
                // estilos básicos inline para não depender do CSS
                overlay.style.position = 'fixed';
                overlay.style.inset = '0';
                overlay.style.background = 'rgba(0,0,0,0.75)';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.zIndex = '9999';
                overlay.innerHTML = `
                    <div class="resenha-box" style="background:#fff;color:#111;max-width:900px;width:90%;max-height:90%;overflow:auto;border-radius:8px;padding:20px;position:relative;">
                        <button class="resenha-close" style="position:absolute;right:12px;top:12px;padding:6px 10px;">Fechar</button>
                        <div class="resenha-content"></div>
                    </div>`;
                document.body.appendChild(overlay);

                // handlers de fechamento
                overlay.querySelector('.resenha-close').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    document.body.style.overflow = '';
                });
                // fechar ao clicar no backdrop
                overlay.addEventListener('click', (ev) => {
                    if (ev.target === overlay) {
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
                // ESC fecha
                window.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape' && overlay.style.display === 'flex') {
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
            }

            // injeta o conteúdo da resenha
            const container = overlay.querySelector('.resenha-content');
            container.innerHTML = remoteMain ? remoteMain.innerHTML : text;
            overlay.style.display = 'flex';
            // evita scroll do body enquanto overlay aberto
            document.body.style.overflow = 'hidden';

        } catch (err) {
            console.error('Erro ao carregar resenha:', err);
            alert('Não foi possível carregar a resenha. Verifique se o servidor está rodando.');
        }
    });

    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.nav-links');
        if (nav) nav.classList.remove('active');
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

    // Validação simples do formulário de contato
    
    document.addEventListener('submit', function (e) {
    const form = e.target;
    if (!form.classList.contains('contact-form')) return;

    e.preventDefault();

    const required = form.querySelectorAll('input[required], textarea[required]');
    const allFilled = Array.from(required).every(el => el.value.trim() !== '');

    if (allFilled) {
        alert('Mensagem enviada com sucesso');
        form.reset();
    } else {
        alert('Preencha todos os campos');
    }
    });
});