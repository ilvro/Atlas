/**
 * Efeitos de interface em DOM (números flutuantes, partículas), adaptados de `Ficha/src/fx/ui-fx.js`.
 * Tudo vive numa camada própria sobre a interface: nenhum componente precisa ser recriado para animar.
 */
const consultaMovimento = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : undefined;
export const movimentoReduzido = (): boolean => Boolean(consultaMovimento?.matches);

const CHAVE_FX = 'atlas:fx';
let ligado = true;
try { ligado = localStorage.getItem(CHAVE_FX) !== '0'; } catch { /* sem armazenamento: padrão ligado */ }

/** Preferência do usuário (botão "Animações"). Com movimento reduzido no sistema, os efeitos ficam desligados de qualquer forma. */
export const fxPreferido = (): boolean => ligado;
export function definirFx(valor: boolean): void { ligado = valor; try { localStorage.setItem(CHAVE_FX, valor ? '1' : '0'); } catch { /* ignora */ } }
export const fxAtivo = (): boolean => ligado && !movimentoReduzido();

let camada: HTMLElement | null = null;
export function camadaDeFx(): HTMLElement {
  if (camada?.isConnected) return camada;
  camada = document.getElementById('fx-layer') ?? Object.assign(document.createElement('div'), { id: 'fx-layer' });
  if (!camada.isConnected) document.body.appendChild(camada);
  return camada;
}

export interface Retangulo { left: number; top: number; width: number; height: number }
export const retanguloDe = (alvo: string | Element | null): Retangulo | null => {
  const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
  return el?.getBoundingClientRect() ?? null;
};
/** Um ponto da tela como retângulo de tamanho zero, para usar com `flutuar` e `faiscar`. */
export const ponto = (x: number, y: number): Retangulo => ({ left: x, top: y, width: 0, height: 0 });
const aleatorio = (a: number, b: number) => a + Math.random() * (b - a);

/** Número ou palavra que sobe e some (+2, −3, "Pop!"). */
export function flutuar(onde: Retangulo | null, texto: string, { cor = '#fff', tamanho = 18 }: { cor?: string; tamanho?: number } = {}): HTMLElement | null {
  if (!fxAtivo() || !texto) return null;
  const el = document.createElement('div');
  el.className = 'fx-flutuante'; el.textContent = texto; el.style.color = cor; el.style.fontSize = `${tamanho}px`;
  el.style.left = `${onde ? onde.left + onde.width / 2 : innerWidth / 2}px`; el.style.top = `${onde ? onde.top : innerHeight / 2}px`;
  camadaDeFx().appendChild(el);
  el.animate([
    { transform: 'translate(-50%, 0) scale(1.25)', opacity: 1 },
    { transform: 'translate(-50%, -26px) scale(1.08)', opacity: 1, offset: 0.65 },
    { transform: 'translate(-50%, -40px) scale(1)', opacity: 0 },
  ], { duration: 900, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)', fill: 'forwards' }).onfinish = () => el.remove();
  return el;
}

/** Partículas que se espalham (poeira, faíscas). */
export function faiscar(onde: Retangulo | null, { cor = '#e91d25', quantidade = 12, alcance = 40, vida = 700 }: { cor?: string; quantidade?: number; alcance?: number; vida?: number } = {}): void {
  if (!fxAtivo()) return;
  const cx = onde ? onde.left + onde.width / 2 : innerWidth / 2, cy = onde ? onde.top + onde.height / 2 : innerHeight / 2;
  for (let i = 0; i < quantidade; i++) {
    const p = document.createElement('div'), t = aleatorio(8, 16);
    p.className = 'fx-particula'; p.style.cssText = `width:${t}px;height:${t}px;left:${cx}px;top:${cy}px;background:radial-gradient(circle, ${cor} 0%, transparent 75%)`;
    camadaDeFx().appendChild(p);
    const ang = Math.random() * Math.PI * 2, dist = aleatorio(8, alcance), dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - alcance * 0.25;
    p.animate([
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15)`, opacity: 0.85, offset: 0.4 },
      { transform: `translate(calc(-50% + ${dx * 1.35}px), calc(-50% + ${dy * 1.35 - 12}px)) scale(0.15)`, opacity: 0 },
    ], { duration: vida * aleatorio(0.7, 1.3), easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }).onfinish = () => p.remove();
  }
}

/** Partículas que viajam de um ponto a outro (um item que vai para a seleção, uma ficha para o token). Resolve quando a primeira chega. */
export function voar(de: Retangulo | null, para: Retangulo | null, { quantidade = 10, cor = '#e91d25', duracao = 600, curva = 60 }: { quantidade?: number; cor?: string; duracao?: number; curva?: number } = {}): Promise<void> {
  if (!de || !para || !fxAtivo()) return Promise.resolve();
  const x0 = de.left + de.width / 2, y0 = de.top + de.height / 2, x1 = para.left + para.width / 2, y1 = para.top + para.height / 2;
  return new Promise(resolver => {
    let chegou = false;
    for (let i = 0; i < quantidade; i++) {
      const p = document.createElement('div'), t = aleatorio(6, 12);
      p.className = 'fx-particula'; p.style.cssText = `width:${t}px;height:${t}px;left:0;top:0;background:radial-gradient(circle, ${cor} 0%, transparent 75%)`;
      camadaDeFx().appendChild(p);
      const mx = (x0 + x1) / 2 + aleatorio(-curva * 0.4, curva * 0.4), my = Math.min(y0, y1) - curva * aleatorio(0.6, 1.3), passos = 14;
      const quadros: Keyframe[] = [];
      for (let s = 0; s <= passos; s++) {
        const u = s / passos, v = 1 - u, x = v * v * x0 + 2 * v * u * mx + u * u * x1, y = v * v * y0 + 2 * v * u * my + u * u * y1;
        quadros.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.7 + Math.sin(u * Math.PI) * 0.6})`, opacity: u < 0.1 ? u * 10 : u > 0.85 ? (1 - u) * 6.6 : 1 });
      }
      p.animate(quadros, { duration: duracao, delay: i * 35, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => { p.remove(); if (!chegou) { chegou = true; resolver(); } };
    }
  });
}

/** A cor do número de uma rolagem: destaque só visual, o Atlas não decide sucesso. */
export const COR_DA_ROLAGEM = { alto: '#ffd23f', baixo: '#e0645c', normal: '#ffffff' } as const;

/**
 * O resultado de uma rolagem sobre uma peça: o total grande, o título pequeno embaixo, e faíscas no acento. Aparece mesmo com os efeitos
 * desligados (é informação, não enfeite); nesse caso só some depois de um tempo, sem se mover.
 */
export function flutuarRolagem(onde: Retangulo | null, total: number, titulo: string, tom: keyof typeof COR_DA_ROLAGEM, acento = '#e91d25'): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fx-rolagem'; el.setAttribute('data-testid', 'rolagem-flutuante'); el.dataset.tom = tom; el.style.color = COR_DA_ROLAGEM[tom];
  el.style.left = `${onde ? onde.left + onde.width / 2 : innerWidth / 2}px`; el.style.top = `${onde ? onde.top : innerHeight / 2}px`;
  const n = document.createElement('b'), t = document.createElement('small'); n.textContent = String(total); t.textContent = titulo; el.append(n, t);
  camadaDeFx().appendChild(el);
  if (fxAtivo()) {
    el.animate([
      { transform: 'translate(-50%, -100%) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%, -130%) scale(1.25)', opacity: 1, offset: 0.18 },
      { transform: 'translate(-50%, -150%) scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%, -175%) scale(1)', opacity: 0 },
    ], { duration: 2600, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
    faiscar(onde, { cor: tom === 'normal' ? acento : COR_DA_ROLAGEM[tom], quantidade: tom === 'normal' ? 10 : 18, alcance: 56 });
  } else {
    el.style.transform = 'translate(-50%, -140%)';
    el.animate([
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.78 },
      { opacity: 0 },
    ], { duration: 2600, easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
  }
  return el;
}
