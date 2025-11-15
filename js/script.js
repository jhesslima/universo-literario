document.addEventListener('DOMContentLoaded', () => {
  const baseEl = document.querySelector('base');
  if (baseEl) {
    const isPages = location.hostname.endsWith('github.io');
    const repo = location.pathname.split('/').filter(Boolean)[0] || '';
    baseEl.href = isPages ? `/${repo}/` : './';
  }

  const contentContainer =
    document.getElementById('app-content') ||
    (() => {
      const m = document.createElement('main');
      m.id = 'app-content';
      document.body.appendChild(m);
      return m;
    })();

  const contentCache = Object.create(null);
  const contentBaseBySection = Object.create(null);

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

  function ensureSection(id) {
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement('section');
      s.id = id;
      s.className = 'content';
      contentContainer.appendChild(s);
    }
    return s;
  }

  function fileFor(id) {
    let name = id;
    if (name.toLowerCase().startsWith('resenha-')) {
      return `html/resenhas/${name.replace(/^resenha-/i, '')}.html`;
    }
    return `html/${name}.html`;
  }

  async function fetchFragment(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const el =
      doc.querySelector('.content') ||
      doc.querySelector('main > section') ||
      doc.querySelector('section') ||
      doc.querySelector('main') ||
      doc.body;
    return { html: el ? el.innerHTML : text, baseUrl: res.url };
  }

  async function load(id) {
    if (contentCache[id]) return contentCache[id];
    const url = fileFor(id);
    const { html, baseUrl } = await fetchFragment(url);
    contentCache[id] = html;
    contentBaseBySection[id] = baseUrl;
    return html;
  }

  function showOnly(id) {
    contentContainer.querySelectorAll('section.content').forEach(sec => {
      sec.style.display = sec.id === id ? '' : 'none';
    });
    document.querySelectorAll('.nav-links .links').forEach(a => {
      const target = (a.getAttribute('href') || '').replace(/^#/, '');
      a.classList.toggle('active', target.toLowerCase() === id.toLowerCase());
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function show(id) {
    const section = ensureSection(id);
    section.innerHTML = '<div class="loading-spinner">Carregando...</div>';
    try {
      const html = await load(id);
      section.innerHTML = html;
      fixRelativeUrls(section);
      showOnly(id);
    } catch (e) {
      console.error('Erro ao carregar seção', id, e);
      section.innerHTML = `<p class="text">Erro ao carregar ${id}.</p>`;
    }
  }

  function normalize(input) {
    if (!input) return 'Home';
    let id = input.replace(/^#/, '');
    id = id.replace(/\.html?$/i, '');
    if (id.startsWith('resenhas/')) {
      id = 'resenha-' + id.split('/').pop();
    }
    return id;
  }

  document.addEventListener('click', async (e) => {
    const navA = e.target.closest('.nav-links a[href^="#"]');
    if (navA) {
      e.preventDefault();
      const id = normalize(navA.getAttribute('href'));
      await show(id);
      history.pushState(null, '', `#${id}`);
      return;
    }
  });

  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a.Learn-more, a.learn-more');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href.includes('resenhas')) return;

    e.preventDefault();
    const file = href.split('/').pop().replace(/\.html?$/i, '');
    const id = `resenha-${file}`;
    await show(id);
    history.pushState(null, '', `#${id}`);
  });

  window.addEventListener('hashchange', () => {
    const id = normalize(location.hash || '#Home');
    show(id);
  });

  const startId = normalize(location.hash || '#Home');
  show(startId);
});

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