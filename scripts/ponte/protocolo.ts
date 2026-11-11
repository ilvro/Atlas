/** Protocolo da ponte do assistente (só desenvolvimento). Puro: tipos e validação das mensagens trocadas em /__ponte. */

export interface AnotacoesDaFerramenta {
  leitura?: boolean;
  destrutiva?: boolean;
  idempotente?: boolean;
}

export interface Ferramenta {
  nome: string;
  descricao: string;
  esquema: Record<string, unknown>;
  anotacoes?: AnotacoesDaFerramenta;
}
export type FerramentaDoApp = Ferramenta & {
  app: string;
  armazenamento?: string;
  onde?: string;
};
export type Conteudo = { tipo: 'texto'; texto: string } | { tipo: 'imagem'; dados: string; mime: string };

export const PREFIXOS: Record<string, string> = {
  atlas_: 'atlas',
  mesa_: 'mesa',
  campanha_: 'mesa',
  dossie_: 'ficha',
  atelie_: 'atelie',
  jukebox_: 'jukebox',
};

export const appDoPrefixo = (ferramenta: string): string | undefined =>
  Object.entries(PREFIXOS).find(([p]) => ferramenta.startsWith(p))?.[1];

export type Resultado = { tipo: 'resultado'; id: string; ok: true; conteudo: Conteudo[] } | { tipo: 'resultado'; id: string; ok: false; erro: string; fechado?: true };
/* `fechado`: a ponte não conseguiu abrir o app (o erro traz o motivo); o MCP completa a mensagem com o endereço. */

/** Informações da aba ativa de um aplicativo conectado à ponte. */
export interface AppConectado {
  armazenamento?: string;
  onde?: string;
}

/** Aba → ponte. */
export type DaAba =
  | { tipo: 'registrar'; app: string; titulo: string; ferramentas: Ferramenta[]; armazenamento?: string }
  | { tipo: 'foco' }
  | Resultado;
/** Ponte → aba, e MCP → ponte. */
export interface Chamar { tipo: 'chamar'; id: string; ferramenta: string; args: Record<string, unknown> }
/** MCP → ponte. */
export type DoMcp = { tipo: 'ola'; token: string } | Chamar;
/** Ponte → MCP. */
export type ParaMcp = { tipo: 'ferramentas'; lista: FerramentaDoApp[]; apps?: Record<string, AppConectado> } | Resultado;

export type Mensagem = DaAba | DoMcp | ParaMcp;

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): v is string => typeof v === 'string';

function sanitizarAnotacoes(v: unknown): AnotacoesDaFerramenta | undefined {
  if (!objeto(v)) return undefined;
  const res: AnotacoesDaFerramenta = {};
  if (typeof v.leitura === 'boolean') res.leitura = v.leitura;
  if (typeof v.destrutiva === 'boolean') res.destrutiva = v.destrutiva;
  if (typeof v.idempotente === 'boolean') res.idempotente = v.idempotente;
  return Object.keys(res).length > 0 ? res : undefined;
}

function sanitizarFerramenta(raw: Record<string, unknown>): Ferramenta {
  const res: Ferramenta = {
    nome: raw.nome as string,
    descricao: raw.descricao as string,
    esquema: raw.esquema as Record<string, unknown>,
  };
  const anotacoes = sanitizarAnotacoes(raw.anotacoes);
  if (anotacoes) res.anotacoes = anotacoes;
  return res;
}

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
      const arm = texto(m.armazenamento) && m.armazenamento !== '' ? m.armazenamento : undefined;
      return {
        tipo: 'registrar',
        app: m.app,
        titulo: m.titulo,
        ferramentas: (m.ferramentas as unknown as Record<string, unknown>[]).map(sanitizarFerramenta),
        ...(arm ? { armazenamento: arm } : {}),
      };
    case 'foco':
      return { tipo: 'foco' };
    case 'ola':
      return texto(m.token) ? { tipo: 'ola', token: m.token } : null;
    case 'chamar':
      if (!texto(m.id) || !texto(m.ferramenta) || m.ferramenta === '' || !(m.args === undefined || objeto(m.args))) return null;
      return { tipo: 'chamar', id: m.id, ferramenta: m.ferramenta, args: (m.args as Record<string, unknown> | undefined) ?? {} };
    case 'ferramentas':
      if (!Array.isArray(m.lista) || !m.lista.every(f => ferramentaValida(f) && texto((f as unknown as Record<string, unknown>).app))) return null;
      let apps: Record<string, AppConectado> | undefined;
      if (objeto(m.apps)) {
        apps = {};
        for (const [k, v] of Object.entries(m.apps)) {
          if (objeto(v)) {
            apps[k] = {
              ...(texto(v.armazenamento) ? { armazenamento: v.armazenamento } : {}),
              ...(texto(v.onde) ? { onde: v.onde } : {}),
            };
          }
        }
      }
      return {
        tipo: 'ferramentas',
        lista: (m.lista as (Record<string, unknown> & { app: string; armazenamento?: string; onde?: string })[]).map(f => {
          const sf = sanitizarFerramenta(f);
          const res: FerramentaDoApp = {
            ...sf,
            app: f.app,
            ...(texto(f.armazenamento) ? { armazenamento: f.armazenamento } : {}),
            ...(texto(f.onde) ? { onde: f.onde } : {}),
          };
          return res;
        }),
        ...(apps ? { apps } : {}),
      };
    case 'resultado':
      if (!texto(m.id)) return null;
      if (m.ok === true) return Array.isArray(m.conteudo) && m.conteudo.every(conteudoValido) ? { tipo: 'resultado', id: m.id, ok: true, conteudo: m.conteudo as Conteudo[] } : null;
      if (m.ok === false) return texto(m.erro) ? { tipo: 'resultado', id: m.id, ok: false, erro: m.erro, ...(m.fechado === true ? { fechado: true as const } : {}) } : null;
      return null;
    default:
      return null;
  }
}
