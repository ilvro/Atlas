/**
 * Atalhos escritos como texto (`Ctrl+K`, `Shift+Delete`, `1`), comparados com o evento do teclado.
 * `Ctrl` vale também como `Cmd` no macOS.
 */
export interface EventoDeTecla { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }

interface Combinacao { tecla: string; ctrl: boolean; shift: boolean; alt: boolean }

const NOMES: Record<string, string> = { esc: 'escape', del: 'delete', espaco: ' ', 'espaço': ' ', space: ' ', mais: '+', plus: '+', menos: '-' };

export function lerAtalho(texto: string): Combinacao {
  if (texto === '+') return { tecla: '+', ctrl: false, shift: false, alt: false };
  const partes = texto.split('+').map(p => p.trim()).filter(Boolean);
  // "Ctrl++" termina em "+": a tecla é o próprio sinal de mais.
  const tecla = texto.endsWith('++') ? '+' : (partes.at(-1) ?? '');
  const mods = new Set((texto.endsWith('++') ? partes : partes.slice(0, -1)).map(p => p.toLowerCase()));
  return { tecla: (NOMES[tecla.toLowerCase()] ?? tecla).toLowerCase(), ctrl: mods.has('ctrl') || mods.has('cmd'), shift: mods.has('shift'), alt: mods.has('alt') };
}

export function combina(atalho: string, e: EventoDeTecla): boolean {
  const c = lerAtalho(atalho), tecla = e.key.toLowerCase();
  // Teclados ABNT2 (AltGr + W gera '?' com ctrlKey/altKey):
  if (c.tecla === '?' && (tecla === '?' || e.key === '?')) {
    if (!c.ctrl && !c.alt) return true;
  }
  if (tecla !== c.tecla || (e.ctrlKey || e.metaKey) !== c.ctrl || e.altKey !== c.alt) return false;
  // Shift só conta para letras e dígitos; em símbolos (`?`, `+`) ele já está embutido na própria tecla.
  const simbolo = tecla.length === 1 && !/[a-z0-9]/.test(tecla);
  return c.shift ? e.shiftKey : simbolo || !e.shiftKey;
}

const SIMBOLOS: Record<string, string> = { escape: 'Esc', delete: 'Del', ' ': 'Espaço', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };

/** Como mostrar o atalho ao usuário. */
export function mostrarAtalho(atalho: string): string {
  const c = lerAtalho(atalho);
  if (!c.tecla) return atalho;
  const nome = SIMBOLOS[c.tecla] ?? (c.tecla.length === 1 ? c.tecla.toUpperCase() : c.tecla[0]!.toUpperCase() + c.tecla.slice(1));
  return [c.ctrl ? 'Ctrl' : '', c.alt ? 'Alt' : '', c.shift ? 'Shift' : '', nome].filter(Boolean).join('+');
}
