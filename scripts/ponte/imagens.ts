import fs from 'node:fs';
import { resolverCaminho, type PontaParaPreset } from './presets.ts';

export const MAX_IMAGEM_ATELIE = 15 * 1024 * 1024;

export type TipoImagem = 'image/png' | 'image/jpeg' | 'image/webp';

/** Reconhece PNG, JPEG e WebP pelos bytes iniciais (a extensão não conta). */
export function tipoDaImagem(bytes: Uint8Array): TipoImagem | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const ascii = (de: number, ate: number) => String.fromCharCode(...bytes.slice(de, ate));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Lê o arquivo, confere formato e tamanho e manda a imagem (base64) ao Ateliê conectado, que a define no campo do documento. */
export async function definirImagemNoAtelie(
  ponta: PontaParaPreset,
  opcoes: { id: string; campo: string; arquivo: string },
): Promise<unknown> {
  const arquivo = resolverCaminho(opcoes.arquivo);
  if (!fs.existsSync(arquivo)) throw new Error(`arquivo “${arquivo}” não existe`);
  const stat = fs.statSync(arquivo);
  if (!stat.isFile()) throw new Error(`“${arquivo}” não é um arquivo comum`);
  if (stat.size > MAX_IMAGEM_ATELIE) {
    throw new Error(`a imagem “${arquivo}” tem ${(stat.size / (1024 * 1024)).toFixed(1)} MB (limite de 15 MB); use uma versão menor`);
  }
  const bytes = fs.readFileSync(arquivo);
  const tipo = tipoDaImagem(bytes);
  if (!tipo) throw new Error(`“${arquivo}” não é PNG, JPEG nem WebP (os bytes iniciais não batem); se não houver uma imagem válida, deixe o campo vazio e avise o mestre`);

  const atelieConectado = ponta.conectada() && (ponta.apps().atelie !== undefined || ponta.ativas().some(f => f.nome.startsWith('atelie_')));
  if (!atelieConectado) {
    throw new Error('o Ateliê não está conectado à ponte: abra o Ateliê pela Mesa (mesa_abrir_apps com "atelie") e tente de novo');
  }

  const resp = await ponta.chamar('atelie_imagem_receber', { id: opcoes.id, campo: opcoes.campo, imagem: bytes.toString('base64'), tipo });
  if (!resp.ok) throw new Error(resp.erro);
  const texto = resp.conteudo.map(c => (c.tipo === 'texto' ? c.texto ?? '' : '')).join('');
  try {
    return JSON.parse(texto);
  } catch {
    return { definido: true, resposta: texto };
  }
}
