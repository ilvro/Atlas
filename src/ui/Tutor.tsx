import { useEffect, useRef } from 'preact/hooks';
import { viewport } from '../app/app.ts';
import { abaDoInspetor, modo } from '../app/modo.ts';
import { apagarMapaDeTreino, iniciarLicao, mapaDeTreino, tutor } from '../app/tutoriais.ts';
import { medir } from '../tutorial/condicoes.ts';
import { estadoDoTutor } from '../app/tutoriais.ts';
import type { Acao, Passo } from '../tutorial/tutor.ts';
import { navegar } from '../app/app.ts';
import { LICOES } from '../tutorial/licoes.ts';

const acoesDe = (p: Passo): readonly Acao[] => (p.acao ? (Array.isArray(p.acao[0]) || (p.acao as readonly unknown[]).length === 0 ? p.acao : [p.acao]) as readonly Acao[] : []);
const pontosDe = (p: Passo): readonly (readonly [number, number])[] => {
  if (p.ponto) return (Array.isArray(p.ponto[0]) ? p.ponto : [p.ponto]) as readonly (readonly [number, number])[];
  return acoesDe(p).flatMap(a => (a[0] === 'mapa' ? [a[1]] : a[0] === 'retangulo' || a[0] === 'arrastar' ? [a[1], a[2]] : []));
};
const mostrarNumero = (v: string): string => (/^-?\d+(\.\d+)?$/.test(v) ? v.replace('.', ',') : v);

/** Os valores que um passo pede, como a pessoa os lê na tela: o rótulo de cada campo e o que vai nele (saem das ações do teste). */
function valoresDoPasso(p: Passo): string {
  if (p.valores) return p.valores;
  const rotuloDe = (seletor: string): string | null => { const campo = document.querySelector(seletor)?.closest('[data-campo]'); return campo?.getAttribute('data-campo') ?? null; };
  return acoesDe(p).filter(a => a[0] === 'preencher' || a[0] === 'escolher' || a[0] === 'cor').map(a => { const r = rotuloDe((a as readonly [string, string, string])[1]); return r ? `<b>${r}</b>: ${mostrarNumero((a as readonly [string, string, string])[2])}` : ''; }).filter(Boolean).join(' · ');
}

const caixaDe = (el: Element): { left: number; top: number; right: number; bottom: number; width: number; height: number } => el.getBoundingClientRect();

/** O tutor sobre a interface de verdade: anel no alvo, marcas no mapa, o cartão do passo (com ajuda em degraus) e o cartão final. Nunca faz o passo pela pessoa. */
export function Tutor() {
  void tutor.versao.value;
  const info = tutor.info(), fim = tutor.fim.value, passo = tutor.passo();
  const anel = useRef<HTMLDivElement>(null), cartao = useRef<HTMLElement>(null), marcas = useRef<HTMLDivElement>(null), gauge = useRef<{ inicial: number }>({ inicial: 0 });
  useEffect(() => {
    if (!tutor.info()) return;
    let quadro = 0, perdido = 0, ultimo = -1;
    const laco = () => {
      quadro = requestAnimationFrame(laco);
      const p = tutor.passo(); if (!p) return;
      if (tutor.info()!.indice !== ultimo) {
        ultimo = tutor.info()!.indice;
        perdido = 0;
        gauge.current.inicial = 0;
        const pts = pontosDe(p);
        if (pts.length > 0 && viewport.atual) {
          const area = document.querySelector('[data-testid="area-do-mapa"]')?.getBoundingClientRect();
          const todosVisiveis = area && pts.every(pt => {
            const lugar = viewport.atual?.clientDe([pt[0], pt[1]]);
            return lugar && lugar[0] >= area.left + 50 && lugar[0] <= area.right - 50 && lugar[1] >= area.top + 50 && lugar[1] <= area.bottom - 50;
          });
          if (!todosVisiveis) {
            viewport.atual.enquadrar();
          }
        }
      }
      if (tutor.tique()) return;
      const sozinho = !!p.tentar && !tutor.ajuda().mostrouOnde;
      if (p.aba && abaDoInspetor.peek() !== p.aba) abaDoInspetor.value = p.aba as 'mapa' | 'selecao' | 'historico';
      const alvo = p.alvo && !sozinho ? document.querySelector(p.alvo) : null, r = anel.current, c = cartao.current;
      // Um campo (input, select) é apontado com o rótulo junto: o anel e o espaço livre do cartão pegam a linha inteira.
      const area = alvo && alvo.matches('input, select, textarea') ? alvo.closest('[data-campo]') ?? alvo : alvo, caixa = area ? caixaDe(area) : null;
      const visivel = !!caixa && caixa.width > 0 && caixa.bottom > 0 && caixa.top < innerHeight;
      if (alvo && !visivel && caixa && caixa.width > 0) alvo.scrollIntoView({ block: 'center' });
      if (r) {
        r.hidden = !visivel;
        if (visivel && caixa) { const pad = 5; Object.assign(r.style, { left: `${caixa.left - pad}px`, top: `${caixa.top - pad}px`, width: `${caixa.width + pad * 2}px`, height: `${caixa.height + pad * 2}px` }); }
        r.classList.toggle('insiste', tutor.ajuda().insiste);
      }
      // O alvo sumiu da tela por um tempo (não só abrindo um painel): avisa uma vez e o cartão mostra a saída.
      const sumiu = !!p.alvo && !sozinho && !visivel; perdido = sumiu ? perdido + 1 : 0;
      if (perdido === 90) tutor.perdido();
      c?.querySelector<HTMLElement>('.tutor-perdido')?.toggleAttribute('hidden', perdido < 90);
      // Onde clicar no mapa: uma marca em cada ponto, seguida enquanto a câmera anda; vários são numerados.
      const lista = sozinho ? [] : pontosDe(p), v = viewport.atual;
      const areaMapa = document.querySelector('[data-testid="area-do-mapa"]')?.getBoundingClientRect();
      let algumFora = false;
      marcas.current?.querySelectorAll<HTMLElement>('.tutor-ponto').forEach((el, i) => {
        const pt = lista[i], lugar = pt && v ? v.clientDe([pt[0], pt[1]]) : null;
        const dentro = !!lugar && !!areaMapa && lugar[0] >= areaMapa.left && lugar[0] <= areaMapa.right && lugar[1] >= areaMapa.top && lugar[1] <= areaMapa.bottom;
        if (!dentro && pt) algumFora = true;
        el.hidden = !dentro; el.dataset.ordem = lista.length > 1 ? String(i + 1) : '';
        if (dentro && lugar) { el.style.left = `${Math.round(lugar[0])}px`; el.style.top = `${Math.round(lugar[1])}px`; }
      });
      c?.querySelector<HTMLElement>('.tutor-focar-pontos')?.toggleAttribute('hidden', !algumFora || lista.length === 0);
      // “Quase lá”: quanto falta num passo de valor.
      const l = medir(p.feito, estadoDoTutor()), perto = c?.querySelector<HTMLElement>('.tutor-perto');
      if (perto) {
        if (!l) perto.hidden = true;
        else { gauge.current.inicial = Math.max(gauge.current.inicial, l.falta); const cheio = gauge.current.inicial > 0 ? Math.max(0, Math.min(1, 1 - l.falta / gauge.current.inicial)) : 0; perto.hidden = false; perto.querySelector('span')!.textContent = l.texto; (perto.querySelector('b') as HTMLElement).style.width = `${(cheio * 100).toFixed(0)}%`; }
      }
      // O cartão procura um lugar que não cubra nem o alvo nem os pontos do mapa a clicar (senão atrapalharia o próprio passo).
      if (c) {
        const w = c.offsetWidth, h = c.offsetHeight, folga = 16, M = 12;
        const alvosLivres: { left: number; top: number; right: number; bottom: number }[] = [];
        if (visivel && caixa) alvosLivres.push({ left: caixa.left - 8, top: caixa.top - 8, right: caixa.right + 8, bottom: caixa.bottom + 8 });
        for (const painel of document.querySelectorAll<HTMLElement>('.dock-painel, .editor-momento')) {
          const r = painel.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            alvosLivres.push({ left: r.left - 8, top: r.top - 8, right: r.right + 8, bottom: r.bottom + 8 });
          }
        }

        const pontosLivres: { left: number; top: number; right: number; bottom: number }[] = [];
        for (const pt of lista) {
          const lugar = v ? v.clientDe([pt[0], pt[1]]) : null;
          if (lugar && areaMapa && lugar[0] >= areaMapa.left && lugar[0] <= areaMapa.right && lugar[1] >= areaMapa.top && lugar[1] <= areaMapa.bottom) {
            pontosLivres.push({ left: lugar[0] - 32, top: lugar[1] - 32, right: lugar[0] + 56, bottom: lugar[1] + 32 });
          }
        }

        const candidatos: [number, number][] = [];
        if (visivel && caixa) {
          candidatos.push([caixa.right + folga, caixa.top]);
          candidatos.push([caixa.right + folga, innerHeight - h - 60]);
          candidatos.push([caixa.left, caixa.bottom + folga]);
          candidatos.push([caixa.left - folga - w, caixa.top]);
          candidatos.push([caixa.left, caixa.top - folga - h]);
        }
        candidatos.push(
          [innerWidth - w - 24, innerHeight - h - 60],
          [innerWidth - w - 320, innerHeight - h - 60],
          [innerWidth - w - 24, 70],
          [innerWidth - w - 320, 70],
          [innerWidth / 2 - w / 2, innerHeight - h - 60],
          [24, innerHeight - h - 60],
          [innerWidth / 2 - w / 2, 70],
          [24, 70]
        );

        const cabeTudo = ([x, y]: [number, number]) =>
          x >= M && y >= M && x + w <= innerWidth - M && y + h <= innerHeight - M &&
          !alvosLivres.some(r => x < r.right && x + w > r.left && y < r.bottom && y + h > r.top) &&
          !pontosLivres.some(r => x < r.right && x + w > r.left && y < r.bottom && y + h > r.top);

        const cabePontos = ([x, y]: [number, number]) =>
          x >= M && y >= M && x + w <= innerWidth - M && y + h <= innerHeight - M &&
          !pontosLivres.some(r => x < r.right && x + w > r.left && y < r.bottom && y + h > r.top);

        const cabeTela = ([x, y]: [number, number]) =>
          x >= M && y >= M && x + w <= innerWidth - M && y + h <= innerHeight - M;

        const [esq, topo] =
          candidatos.find(cabeTudo) ??
          candidatos.find(cabePontos) ??
          candidatos.find(cabeTela) ??
          [innerWidth - w - 24, innerHeight - h - 60];

        c.style.left = `${Math.round(esq)}px`; c.style.top = `${Math.round(topo)}px`;
      }
    };
    quadro = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(quadro);
  }, [info?.id, info ? true : false]);

  if (fim) {
    const proxima = fim.proxima ? LICOES.find(l => l.id === fim.proxima) : null, treino = mapaDeTreino.value;
    return (
      <div class="tutor" data-testid="tutor-fim">
        <section class="tutor-cartao fim" role="dialog" aria-label="Tutorial">
          <header><span class="eyebrow">{fim.titulo}</span><button type="button" class="quieto" data-testid="tutor-fechar" onClick={() => tutor.fecharFim()}>Fechar</button></header>
          <p class="tutor-diga">{fim.concluida ? 'Concluído.' : 'Você saiu do tutorial. O progresso fica guardado.'}</p>
          {fim.aprendeu.length > 0 && <><p class="tutor-porque">O que você aprendeu:</p><ul class="tutor-aprendeu">{fim.aprendeu.map((a, i) => <li key={i}>{typeof a === 'string' ? a : <><kbd>{a[0]}</kbd> {a[1]}</>}</li>)}</ul></>}
          {fim.concluida && <figure class="tutor-alvo" data-testid="tutor-alvo"><img src={`${import.meta.env.BASE_URL}tutoriais/${fim.id}.jpg`} alt="" onError={e => { (e.currentTarget.parentElement as HTMLElement).hidden = true; }} /><figcaption>Como deve ficar. Compare com o mapa atrás deste cartão.</figcaption></figure>}
          {treino && <p class="tutor-porque">Esta lição aconteceu no mapa de treino “{treino.nome}”. O seu mapa não foi tocado.</p>}
          <footer>
            {treino && <button type="button" class="botao-pilula" data-testid="tutor-apagar-treino" onClick={() => { tutor.fecharFim(); void apagarMapaDeTreino(); }}>Apagar o mapa de treino</button>}
            {treino && <button type="button" class="botao-pilula" data-testid="tutor-galeria" onClick={() => { tutor.fecharFim(); navegar({ tipo: 'galeria' }); }}>Ir para a galeria</button>}
            {proxima && <button type="button" class="botao-pilula destaque" data-testid="tutor-proxima" onClick={() => { tutor.fecharFim(); void iniciarLicao(proxima.id); }}>Próxima: {proxima.titulo}</button>}
          </footer>
        </section>
      </div>
    );
  }
  if (!info || !passo) return null;
  const ajuda = tutor.ajuda(), ultimo = info.indice === info.total - 1, espera = passo.feito[0] === 'ler', etapas = tutor.passo() ? [] : [];
  void etapas; void modo;
  const etapa = (() => { const l = LICOES.find(x => x.id === info.id); return l ? l.passos.slice(0, info.indice + 1).findLast(p => p.etapa)?.etapa ?? null : null; })();
  const valores = ajuda.valores ? valoresDoPasso(passo) : '';
  const pontos = pontosDe(passo);
  return (
    <div class="tutor" data-testid="tutor" data-passo={info.indice} data-licao={info.id}>
      <div class="tutor-anel" ref={anel} hidden data-testid="tutor-anel" />
      <div ref={marcas}>{(pontos.length ? pontos : []).map((_, i) => <div key={i} class="tutor-ponto" hidden data-testid="tutor-ponto"><i /></div>)}</div>
      <section class="tutor-cartao" ref={cartao} role="dialog" aria-live="polite" aria-label="Tutorial" data-testid="tutor-cartao">
        <header><span class="eyebrow">{info.titulo} · {info.indice + 1} de {info.total}</span><button type="button" class="quieto" data-testid="tutor-sair" onClick={() => tutor.parar()} aria-label="Sair do tutorial">Sair</button></header>
        <div class="tutor-progresso"><i style={{ width: `${((info.indice + 1) / info.total) * 100}%` }} /></div>
        {etapa && <p class="tutor-etapa">{etapa}</p>}
        {passo.tentar && <p class="tutor-sozinho">Agora sozinho</p>}
        <p class="tutor-diga" data-testid="tutor-diga" dangerouslySetInnerHTML={{ __html: passo.diga }} />
        {passo.porque && <p class="tutor-porque" dangerouslySetInnerHTML={{ __html: passo.porque }} />}
        <div class="tutor-perto" hidden><span /><i><b /></i></div>
        {valores && <p class="tutor-valores" data-testid="tutor-valores" dangerouslySetInnerHTML={{ __html: valores }} />}
        <button type="button" class="quieto tutor-focar-pontos" hidden data-testid="tutor-focar" onClick={() => viewport.atual?.enquadrar()} title="Enquadrar o mapa (F)">📍 Focar nos pontos do mapa (F)</button>
        <p class="tutor-perdido" hidden>Não encontrei este controle na tela. Siga a instrução acima; se não der, pule o passo.</p>
        {ajuda.oferecer && <div class="tutor-ajuda">
          {passo.tentar && passo.alvo && !ajuda.mostrouOnde && <button type="button" class="quieto" data-testid="tutor-onde" onClick={() => tutor.mostrarOnde()}>Mostrar onde</button>}
          {!ajuda.valores && valoresDoPasso(passo) !== '' && <button type="button" class="quieto" data-testid="tutor-valores-botao" onClick={() => tutor.pedirValores()}>Mostrar os valores</button>}
        </div>}
        <footer>
          <button type="button" class="quieto" data-testid="tutor-voltar" disabled={info.indice === 0} onClick={() => tutor.voltar()}>Voltar</button>
          {!espera && <button type="button" class="quieto" data-testid="tutor-pular" onClick={() => tutor.pular()}>Pular</button>}
          {espera && <button type="button" class="botao-pilula destaque" data-testid="tutor-continuar" onClick={() => tutor.continuar()}>{ultimo ? 'Concluir' : 'Continuar'}</button>}
        </footer>
      </section>
    </div>
  );
}
