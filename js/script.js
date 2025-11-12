document.addEventListener('DOMContentLoaded', () => {
    const contentCache = {};
    const contentBaseBySection = {};
    const contentContainer = document.getElementById('app-content') || document.body;

    const baseEl = document.querySelector('base');
    if (baseEl) {
        if (isPages) {
            const repo = location.pathname.split('/')[1] || '';
            baseEl.href = `/${repo}/`;
        } else {
            baseEl.href = './';
        }
    }

    function fixRelativeUrls(root = document) {
        const fixAttr = (el, attr) => {
        const v = el.getAttribute(attr);
        if (!v) return;
        if (/^(\.\/)?(\.\.\/)+/.test(v)) {
            el.setAttribute(attr, v.replace(/^(\.\/)?(\.\.\/)+/, ''));
        }
        };
        root.querySelectorAll('img[src]').forEach(el => fixAttr(el, 'src'));
        root.querySelectorAll('a[href]').forEach(el => fixAttr(el, 'href'));
        root.querySelectorAll('[style*="url("]').forEach(el => {
        const s = el.getAttribute('style');
        if (s) el.setAttribute('style', s.replace(/url\((['"]?)(\.\/)?(\.\.\/)+/g, 'url($1'));
        });
    }

    const container = document.getElementById('app-content') || document.body;
    fixRelativeUrls(container);
    const mo = new MutationObserver(() => fixRelativeUrls(container));
    mo.observe(container, { childList: true, subtree: true });
    
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

    // Normaliza hashes/ids: remove .html e tenta encontrar id com case-insensitive
    function normalizeSectionId(hashOrId) {
        if (!hashOrId) return '#Home';
        let id = hashOrId.startsWith('#') ? hashOrId.slice(1) : hashOrId;
        id = id.replace(/\.html?$/i, '');
        // se existir id exato
        if (document.getElementById(id)) return `#${id}`;
        // procurar case-insensitive entre sections
        const secs = Array.from(document.querySelectorAll('main section, section.content'));
        const lower = id.toLowerCase();
        for (const s of secs) {
            if (!s.id) continue;
            if (s.id.toLowerCase() === lower) return `#${s.id}`;
        }
        // tentar capitalizar primeira letra
        const cap = id.charAt(0).toUpperCase() + id.slice(1);
        if (document.getElementById(cap)) return `#${cap}`;
        return `#${id}`;
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
            const raw = link.getAttribute('href');
            const sectionId = normalizeSectionId(raw);
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
        let resolvedUrlObj, url;
        try {
            resolvedUrlObj = new URL(href, baseForResolve);
            url = resolvedUrlObj.href;
            // Se for hash interno na mesma página (ex.: '#Fantasia' ou 'index.html#Fantasia'),
            // tratamos como link da navbar
            if (resolvedUrlObj.origin === location.origin && resolvedUrlObj.pathname === location.pathname && resolvedUrlObj.hash) {
                e.preventDefault();
                const sectionId = normalizeSectionId(resolvedUrlObj.hash);
                await showSection(sectionId);
                history.pushState(null, null, sectionId);
                return;
            }
        } catch (err) {
            // falha ao resolver URL; continua com lógica padrão
            console.debug('Falha ao resolver URL para', href, err);
            url = href;
        }

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

        // Outros casos: não interceptamos — permitir comportamento padrão (navegação normal)
    });

    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.nav-links');
        if (nav) nav.classList.remove('active');
    });


    const initialSection = normalizeSectionId(window.location.hash || '#Home');
    showSection(initialSection);

    if (window.location.hash !== initialSection) {
        history.replaceState(null, null, initialSection);
    }

    window.addEventListener('popstate', () => {
        const sectionId = normalizeSectionId(window.location.hash || '#Home');
        showSection(sectionId);
    });
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
