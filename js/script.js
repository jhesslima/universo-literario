document.addEventListener('DOMContentLoaded', () => {
    const contentCache = {};
    const contentBaseBySection = {};
    const contentContainer = document.getElementById('app-content') || document.body;
    
    function showLoading(targetSection) {
        if (targetSection) {
            targetSection.innerHTML = '<div class="loading-spinner">Carregando...</div>'; 
            targetSection.classList.add('loading');
        }
    }

    function hideLoading(targetSection) {
        if (targetSection) {
            targetSection.classList.remove('loading');
        }
    }

    async function loadSectionContent(sectionId) {
        if (contentCache[sectionId]) return; 
        
        try {
           
            let fileName = sectionId.substring(1);
            if (fileName.startsWith('resenha-')) {
                const slug = fileName.replace(/^resenha-/, '');
                fileName = `resenhas/${slug}`;
            }
            const fetchUrl = `html/${fileName}.html`;
            const response = await fetch(fetchUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const html = await response.text();

            try { contentBaseBySection[sectionId] = response.url || new URL(fetchUrl, location.href).href; } catch (e) { contentBaseBySection[sectionId] = new URL(fetchUrl, location.href).href; }
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const contentElement = doc.querySelector('.content') || doc.querySelector('section') || doc.querySelector('main') || doc.body;
            if (contentElement) {
                contentCache[sectionId] = contentElement.innerHTML;
            } else {
                contentCache[sectionId] = `<p>Atenção: Conteúdo da seção '${fileName}' não encontrado.</p>`;
            }
            
        } catch (error) {
            contentCache[sectionId] = `<p>Erro ao carregar o conteúdo para ${sectionId}. Verifique o console para mais detalhes.</p>`;
            console.error('Erro ao carregar o conteúdo da seção:', sectionId, error);
        }
    }

    async function showSection(sectionId) {
        const validSectionId = sectionId || '#Home';
        let targetSection = document.querySelector(validSectionId);

        if (!targetSection) {
            if (validSectionId.startsWith('#resenha-')) {
                const id = validSectionId.slice(1);
                targetSection = document.createElement('section');
                targetSection.id = id;
                targetSection.className = 'content';
                contentContainer.appendChild(targetSection);
            } else {
                console.warn(`Seção não encontrada no DOM: ${validSectionId}`);
                return;
            }
        }

        document.querySelectorAll('.content.active').forEach(section => {
            section.innerHTML = ''; 
            section.classList.remove('active');
        });
        
        showLoading(targetSection);

        await loadSectionContent(validSectionId);
        
        hideLoading(targetSection);
        targetSection.innerHTML = contentCache[validSectionId];
        targetSection.classList.add('active');
        
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === validSectionId);
        });
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href');
            await showSection(sectionId);
            history.pushState(null, null, sectionId);
        });
    });

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

    document.addEventListener('click', async (e) => {
        const a = e.target.closest('a.Learn-more');
        if (!a) return;

        const href = a.getAttribute('href');
        if (!href) return;
        let baseForResolve = location.href;
        const parentSection = a.closest('section.content');
        if (parentSection && parentSection.id) {
            const parentKey = `#${parentSection.id}`;
            if (contentBaseBySection[parentKey]) baseForResolve = contentBaseBySection[parentKey];
        }
        const url = new URL(href, baseForResolve).href;

        if (href.includes('resenhas')) {
            e.preventDefault();

            console.debug('[resenha] clique detectado, href=', href, 'resolved=', url);

            const fileName = url.split('/').pop().replace(/\.html?$/i, '');
            const sectionId = `#resenha-${fileName}`;

            let target = document.getElementById(sectionId.slice(1));
            if (!target) {
                target = document.createElement('section');
                target.id = sectionId.slice(1);
                target.className = 'content';
                contentContainer.appendChild(target);
            }

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

            showLoading(target);
            try {
                console.debug('[resenha] iniciando fetch de', url);
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                console.debug('[resenha] fetch ok', url, 'status=', res.status);
                const text = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');

                const remoteSection = doc.querySelector('section') || doc.querySelector('.content') || doc.querySelector('main') || doc.body;
                const inner = remoteSection ? remoteSection.innerHTML : text;

                contentCache[sectionId] = inner;
                hideLoading(target);

                try {
                    await showSection(sectionId);
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

        e.preventDefault();
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            const remoteMain = doc.querySelector('main') || doc.querySelector('section') || doc.body;

            let overlay = document.getElementById('resenha-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'resenha-overlay';
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

                overlay.querySelector('.resenha-close').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    document.body.style.overflow = '';
                });
                overlay.addEventListener('click', (ev) => {
                    if (ev.target === overlay) {
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
                window.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape' && overlay.style.display === 'flex') {
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
            }

            const container = overlay.querySelector('.resenha-content');
            container.innerHTML = remoteMain ? remoteMain.innerHTML : text;
            overlay.style.display = 'flex';
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


    const initialSection = window.location.hash || '#Home';
    showSection(initialSection);

    if (window.location.hash !== initialSection) {
        history.replaceState(null, null, initialSection);
    }

    window.addEventListener('popstate', () => {
        const sectionId = window.location.hash || '#Home';
        showSection(sectionId);
    });
});