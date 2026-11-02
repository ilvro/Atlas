// Painel do protótipo, na linguagem da Ficha: faixas rasgadas, chips, dock em pílulas, toasts e transições.

const GRUPOS = [
  { titulo: 'Renderizador', chave: 'estilo', opcoes: [['ilustrado', 'Ilustrado'], ['pixel', 'Pixel']], atalho: 'P' },
  { titulo: 'Pixels por célula', chave: 'ppc', opcoes: [[12, '12'], [16, '16'], [24, '24']], so: e => e.estilo === 'pixel' },
  { titulo: 'Paredes', chave: 'paredes', opcoes: [['caixa', 'Caixa'], ['solida', 'Sólida']], atalho: 'B' },
  { titulo: 'Clima', chave: 'clima', opcoes: [['dia', 'Dia', '1'], ['tempestade', 'Tempestade', '2'], ['noite', 'Noite', '3'], ['apagao', 'Apagão', '4']] },
  { titulo: 'Visão', chave: 'visao', opcoes: [['jogadores', 'Jogadores'], ['mestre', 'Mestre']], atalho: 'M' },
  { titulo: 'Tema', chave: 'tema', opcoes: [['ordem', 'Ordem'], ['prata', 'Prata']] },
];

const ICONES = {
  raio: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  lanterna: '<svg viewBox="0 0 24 24"><path d="M9 2h6v4l2 3v13H7V9l2-3z"/><path d="M12 13v3"/></svg>',
  porta: '<svg viewBox="0 0 24 24"><path d="M5 21V3h11v18"/><path d="M16 5l3 1v15h-3"/><circle cx="13" cy="12" r=".8"/></svg>',
  grade: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
  som: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>',
  enquadrar: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

export function montarPainel({ estado, mudar, relampago, lanterna, porta, enquadrar }) {
  const raiz = document.getElementById('interface');
  raiz.innerHTML = `
    <div class="marca"><span class="marca-escudo">◈</span> ATLAS <small>protótipo</small></div>
    <aside class="painel" aria-label="Controles do protótipo">
      ${GRUPOS.map(g => `
        <section class="secao" data-grupo="${g.chave}">
          <h2 class="faixa">${g.titulo}${g.atalho ? `<kbd>${g.atalho}</kbd>` : ''}</h2>
          <div class="opcoes">${g.opcoes.map(([v, rotulo, tecla]) => `<button type="button" class="chip" data-chave="${g.chave}" data-valor="${v}">${rotulo}${tecla ? `<kbd>${tecla}</kbd>` : ''}</button>`).join('')}</div>
        </section>`).join('')}
    </aside>
    <nav class="dock" aria-label="Ações de sessão">
      <button type="button" class="pilula" data-acao="relampago" title="Relâmpago (R)">${ICONES.raio}Relâmpago</button>
      <button type="button" class="pilula" data-acao="lanterna" title="Lanterna (L)">${ICONES.lanterna}Lanterna</button>
      <button type="button" class="pilula" data-acao="porta" title="Porta (E ou clique nela)">${ICONES.porta}Porta</button>
      <button type="button" class="pilula" data-acao="grade" title="Grade (G)">${ICONES.grade}Grade</button>
      <button type="button" class="pilula" data-acao="som" title="Som dos trovões">${ICONES.som}Som</button>
      <button type="button" class="pilula" data-acao="enquadrar" title="Enquadrar (F)">${ICONES.enquadrar}</button>
    </nav>
    <footer class="rodape">
      <span><kbd>clique</kbd> andar · <kbd>WASD</kbd> passo · <kbd>botão direito</kbd>/<kbd>espaço</kbd> arrastar · <kbd>roda</kbd> zoom</span>
      <output class="diagnostico" aria-live="off"></output>
    </footer>
    <div class="toasts" aria-live="polite"></div>
    <div class="transicao" aria-hidden="true"><i></i><i></i><i></i></div>`;

  raiz.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { const v = chip.dataset.valor, chave = chip.dataset.chave; mudar({ [chave]: chave === 'ppc' ? Number(v) : v }); pulso(chip); return; }
    const pil = e.target.closest('.pilula'); if (!pil) return;
    pulso(pil);
    ({ relampago, lanterna, porta, enquadrar, grade: () => mudar({ grade: !estado.grade }), som: () => { estado.som = !estado.som; toast(estado.som ? 'Som ligado' : 'Som desligado'); atualizar(estado); } })[pil.dataset.acao]?.();
  });

  const diag = raiz.querySelector('.diagnostico');
  function atualizar(e) {
    for (const b of raiz.querySelectorAll('.chip')) b.classList.toggle('ativo', String(e[b.dataset.chave]) === b.dataset.valor);
    for (const g of GRUPOS) if (g.so) raiz.querySelector(`[data-grupo="${g.chave}"]`).hidden = !g.so(e);
    raiz.querySelector('[data-acao="lanterna"]').classList.toggle('ativo', e.lanterna);
    raiz.querySelector('[data-acao="grade"]').classList.toggle('ativo', e.grade);
    raiz.querySelector('[data-acao="som"]').classList.toggle('ativo', e.som);
  }
  return { atualizar, diagnostico: t => { diag.textContent = t; } };
}

function pulso(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}

export function toast(texto) {
  const caixa = document.querySelector('.toasts'); if (!caixa) return;
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = texto; caixa.appendChild(t);
  while (caixa.children.length > 3) caixa.firstElementChild.remove();
  setTimeout(() => { t.classList.add('saindo'); setTimeout(() => t.remove(), 320); }, 1800);
}

/** Transição de renderizador ou de paredes: glitch no tema Ordem, mancha de tinta no Prata. A troca acontece no meio. */
export function transicao(tema, trocar) {
  const el = document.querySelector('.transicao');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { trocar(); return Promise.resolve(); }
  el.className = `transicao ${tema === 'prata' ? 'tinta' : 'glitch'} ativa`;
  return new Promise(ok => {
    setTimeout(() => { trocar(); setTimeout(() => { el.className = 'transicao'; ok(); }, 260); }, 190);
  });
}
