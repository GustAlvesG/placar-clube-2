// Utilitários de interface das telas de operação (configuração e mídia), no
// lugar de alert()/confirm(): o diálogo nativo trava a página, some do tablet
// com um toque fora e não deixa explicar a consequência com calma.
//
//   ic('nome')                  → <svg> do ícone (sprite injetado abaixo)
//   esc(texto)                  → escapa para HTML
//   toast('texto')              → aviso curto que some sozinho
//   avisar(titulo, texto)       → diálogo com "Entendi"; devolve Promise
//   confirmar({ titulo, texto, sim, perigo }) → Promise<boolean>
//   [data-segurar]              → botão que só dispara depois de 1,2 s
//                                  pressionado; emite o evento 'segurado'
(function () {
    const ICONES = {
        'voltar': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        'board': '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M12 5v14M7 10v4M17 10v4"/>',
        'gear': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        'film': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4"/>',
        'image': '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
        'star': '<path d="M11.52 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
        'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        'file': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
        'trash': '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
        'plus': '<path d="M5 12h14M12 5v14"/>',
        'x': '<path d="M18 6 6 18M6 6l12 12"/>',
        'check': '<path d="M20 6 9 17l-5-5"/>',
        'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
        'stop': '<rect width="14" height="14" x="5" y="5" rx="2"/>',
        'left': '<path d="m15 18-6-6 6-6"/>',
        'right': '<path d="m9 18 6-6-6-6"/>',
        'refresh': '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
        'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        'save': '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
        'power': '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
        'reset': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
        'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
        'video': '<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.76-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
        'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
        'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        'repeat': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
        'listplus': '<path d="M11 12H3M16 6H3M16 18H3M18 9v6M21 12h-6"/>',
        'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
    };

    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sprite.setAttribute('width', '0'); sprite.setAttribute('height', '0');
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.position = 'absolute';
    sprite.innerHTML = Object.entries(ICONES).map(([n, p]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${p}</symbol>`).join('');
    document.addEventListener('DOMContentLoaded', () => document.body.prepend(sprite));

    window.ic = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
    window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---- Toast ----
    let toastEl = null, toastTimer = null;
    window.toast = (texto) => {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast';
            toastEl.setAttribute('role', 'status');
            toastEl.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = texto;
        void toastEl.offsetWidth;
        toastEl.classList.add('on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2800);
    };

    // ---- Diálogos ----
    let fecharAtual = null;
    function abrirDialogo({ titulo, texto, botoes }) {
        if (fecharAtual) fecharAtual(null);
        return new Promise((resolve) => {
            const veu = document.createElement('div');
            veu.className = 'veu';
            const paragrafos = String(texto || '').split('\n').filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
            veu.innerHTML = `<div class="folha" role="alertdialog" aria-modal="true" aria-label="${esc(titulo)}">
                <div class="folha-cab"><h2>${esc(titulo)}</h2></div>
                <div class="folha-corpo">${paragrafos}</div>
                <div class="folha-pe">${botoes.map((b, i) => `<button type="button" class="btn grande ${b.classe || ''}" data-i="${i}">${b.html}</button>`).join('')}</div></div>`;
            const fechar = (valor) => {
                veu.remove();
                document.removeEventListener('keydown', teclas);
                fecharAtual = null;
                resolve(valor);
            };
            const teclas = (ev) => { if (ev.key === 'Escape') fechar(botoes.find(b => b.cancelar)?.valor ?? null); };
            veu.addEventListener('click', (ev) => {
                const b = ev.target.closest('[data-i]');
                if (b) fechar(botoes[Number(b.dataset.i)].valor);
                else if (ev.target === veu) fechar(botoes.find(x => x.cancelar)?.valor ?? null);
            });
            document.addEventListener('keydown', teclas);
            fecharAtual = fechar;
            document.body.appendChild(veu);
            veu.querySelector(`[data-i="${botoes.length - 1}"]`)?.focus();
        });
    }

    window.avisar = (titulo, texto) => abrirDialogo({ titulo, texto, botoes: [{ html: 'Entendi', classe: 'claro', valor: true, cancelar: true }] });

    window.confirmar = ({ titulo, texto, sim = 'Confirmar', nao = 'Cancelar', perigo = false }) =>
        abrirDialogo({
            titulo, texto,
            botoes: [
                { html: nao, classe: '', valor: false, cancelar: true },
                { html: sim, classe: perigo ? 'perigo' : 'claro', valor: true }
            ]
        }).then(v => v === true);

    // ---- Segurar para confirmar ----
    let segurando = null;
    function comecar(el) {
        if (segurando || el.disabled) return;
        if (!el.querySelector('.enche')) el.insertAdjacentHTML('afterbegin', '<span class="enche"></span>');
        el.classList.add('cheio');
        segurando = { el, t: setTimeout(() => {
            el.classList.remove('cheio'); segurando = null;
            el.dispatchEvent(new CustomEvent('segurado', { bubbles: true }));
        }, 1200) };
    }
    function soltar() {
        if (!segurando) return;
        clearTimeout(segurando.t); segurando.el.classList.remove('cheio'); segurando = null;
    }
    document.addEventListener('pointerdown', (ev) => { const el = ev.target.closest('[data-segurar]'); if (el) { ev.preventDefault(); comecar(el); } });
    ['pointerup', 'pointercancel'].forEach(e => document.addEventListener(e, soltar));
    document.addEventListener('pointerout', (ev) => { if (segurando && ev.target.closest('[data-segurar]') === segurando.el && !segurando.el.contains(ev.relatedTarget)) soltar(); });
    document.addEventListener('contextmenu', (ev) => { if (ev.target.closest('[data-segurar]')) ev.preventDefault(); });
    document.addEventListener('keydown', (ev) => {
        const el = document.activeElement;
        if ((ev.key === 'Enter' || ev.key === ' ') && el?.dataset?.segurar !== undefined && !ev.repeat) { ev.preventDefault(); comecar(el); }
    });
    document.addEventListener('keyup', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') soltar(); });
})();
