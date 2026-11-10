/** Protocolo da ponte do assistente (só desenvolvimento). Puro: tipos e validação das mensagens trocadas em /__ponte. */

export interface Ferramenta { nome: string; descricao: string; esquema: Record<string, unknown> }
export type FerramentaDoApp = Ferramenta & { app: string };
export type Conteudo = { tipo: 'texto'; texto: string } | { tipo: 'imagem'; dados: string; mime: string };

export type Resultado = { tipo: 'resultado'; id: string; ok: true; conteudo: Conteudo[] } | { tipo: 'resultado'; id: string; ok: false; erro: string };

/** Aba → ponte. */
export type DaAba =
  | { tipo: 'registrar'; app: string; titulo: string; ferramentas: Ferramenta[] }
  | { tipo: 'foco' }
  | Resultado;
/** Ponte → aba, e MCP → ponte. */
export interface Chamar { tipo: 'chamar'; id: string; ferramenta: string; args: Record<string, unknown> }
/** MCP → ponte. */
export type DoMcp = { tipo: 'ola'; token: string } | Chamar;
/** Ponte → MCP. */
export type ParaMcp = { tipo: 'ferramentas'; lista: FerramentaDoApp[] } | Resultado;

export type Mensagem = DaAba | DoMcp | ParaMcp;

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): v is string => typeof v === 'string';

function ferramentaValida(v: unknown): v is Ferramenta {
  return objeto(v) && texto(v.nome) && v.nome !== '' && texto(v.descricao) && objeto(v.esquema);
}
function conteudoValido(v: unknown): v is Conteudo {
  if (!objeto(v)) return false;
  return (v.tipo === 'texto' && texto(v.texto)) || (v.tipo === 'imagem' && texto(v.dados) && texto(v.mime));
}

/** Lê uma mensagem; devolve `null` para JSON inválido ou forma desconhecida. */
export function lerMensagem(entrada: string): Mensagem | null {
  let m: unknown;
  try { m = JSON.parse(entrada); } catch { return null; }
  if (!objeto(m)) return null;
  switch (m.tipo) {
    case 'registrar':
      if (!texto(m.app) || m.app === '' || !texto(m.titulo) || !Array.isArray(m.ferramentas) || !m.ferramentas.every(ferramentaValida)) return null;
      return { tipo: 'registrar', app: m.app, titulo: m.titulo, ferramentas: m.ferramentas as Ferramenta[] };
    case 'foco':
      return { tipo: 'foco' };
    case 'ola':
      return texto(m.token) ? { tipo: 'ola', token: m.token } : null;
    case 'chamar':
      if (!texto(m.id) || !texto(m.ferramenta) || m.ferramenta === '' || !(m.args === undefined || objeto(m.args))) return null;
      return { tipo: 'chamar', id: m.id, ferramenta: m.ferramenta, args: (m.args as Record<string, unknown> | undefined) ?? {} };
    case 'ferramentas':
      if (!Array.isArray(m.lista) || !m.lista.every(f => ferramentaValida(f) && texto((f as unknown as Record<string, unknown>).app))) return null;
      return { tipo: 'ferramentas', lista: m.lista as FerramentaDoApp[] };
    case 'resultado':
      if (!texto(m.id)) return null;
      if (m.ok === true) return Array.isArray(m.conteudo) && m.conteudo.every(conteudoValido) ? { tipo: 'resultado', id: m.id, ok: true, conteudo: m.conteudo as Conteudo[] } : null;
      if (m.ok === false) return texto(m.erro) ? { tipo: 'resultado', id: m.id, ok: false, erro: m.erro } : null;
      return null;
    default:
      return null;
  }
}
