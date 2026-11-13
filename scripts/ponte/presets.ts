import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GENEROS_VALIDOS = ['fun', 'hopeful', 'mystery', 'suspense', 'horror', 'sfx'] as const;
export type GeneroJukebox = (typeof GENEROS_VALIDOS)[number];

export const TAGS_VALIDAS = ['ambient', 'investigation', 'event', 'battle', 'emotional'] as const;
export type TagJukebox = (typeof TAGS_VALIDAS)[number];

export const MAX_AUDIO_SIZE = 200 * 1024 * 1024; // 200 MB

export interface ItemMetadataJukebox {
  currentTitle: string;
  genres: string[];
  tags: string[];
  folder: string | null;
  markers: unknown[];
  hotkey: string | null;
  hotkeyEffects: unknown[];
}

export interface MusicaPresetInfo {
  titulo: string;
  currentTitle: string;
  generos: string[];
  tags: string[];
  grupo: string | null;
  temAudio: boolean;
  temCapa: boolean;
}

export interface PresetInfo {
  pasta: string;
  musicas: MusicaPresetInfo[];
}

export interface OpcoesAdicionarAoPreset {
  pasta: string;
  arquivo: string;
  titulo: string;
  generos?: string[];
  tags?: string[];
  grupo?: string | null;
  capa?: string;
  criar?: boolean;
  substituir?: boolean;
}

export interface ResultadoAdicionarAoPreset {
  pasta: string;
  titulo: string;
  arquivos: string[];
  item: ItemMetadataJukebox;
  substituido: boolean;
}

/** Expande ~ para o diretório de usuário e devolve o caminho absoluto normalizado. */
export function resolverCaminho(texto: string): string {
  const t = String(texto ?? '').trim();
  if (!t) return path.resolve('.');
  if (t === '~') return os.homedir();
  if (t.startsWith('~/') || t.startsWith('~\\')) {
    return path.resolve(os.homedir(), t.slice(2));
  }
  return path.resolve(t);
}

/** Valida se um arquivo no disco é MP3 pelo cabeçalho (ID3 ou sync frame 0xFFE/0xFFF). */
export function validarArquivoMp3(caminho: string): void {
  if (!fs.existsSync(caminho)) {
    throw new Error(`arquivo de áudio “${caminho}” não existe`);
  }
  const stat = fs.statSync(caminho);
  if (!stat.isFile()) {
    throw new Error(`“${caminho}” não é um arquivo comum`);
  }
  if (stat.size === 0) {
    throw new Error(`arquivo de áudio “${caminho}” está vazio`);
  }
  if (stat.size > MAX_AUDIO_SIZE) {
    throw new Error(`arquivo de áudio “${caminho}” excede o limite de 200 MB (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  const fd = fs.openSync(caminho, 'r');
  const buf = Buffer.alloc(4);
  try {
    const lidos = fs.readSync(fd, buf, 0, 4, 0);
    if (lidos < 2) {
      throw new Error(`arquivo “${caminho}” é curto demais para ser um MP3 válido`);
    }
    // ID3 tag
    const isId3 = lidos >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33; // 'ID3'
    // MPEG sync word: 11 bits set (0xFF followed by 0xE0 mask)
    const isMpegSync = buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0;
    if (!isId3 && !isMpegSync) {
      throw new Error(`o arquivo “${caminho}” não é um MP3 válido (cabeçalho não reconhecido)`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Valida se um arquivo no disco é JPEG pelo cabeçalho (FF D8 FF). */
export function validarArquivoJpeg(caminho: string): void {
  if (!fs.existsSync(caminho)) {
    throw new Error(`arquivo de capa “${caminho}” não existe`);
  }
  const stat = fs.statSync(caminho);
  if (!stat.isFile()) {
    throw new Error(`“${caminho}” não é um arquivo comum`);
  }
  if (stat.size < 3) {
    throw new Error(`arquivo de capa “${caminho}” é curto demais para ser JPEG`);
  }

  const fd = fs.openSync(caminho, 'r');
  const buf = Buffer.alloc(3);
  try {
    fs.readSync(fd, buf, 0, 3, 0);
    if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
      throw new Error(`o arquivo de capa “${caminho}” não é um JPEG válido (deve iniciar com bytes FF D8 FF)`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Caminho da capa padrão quando o mestre não fornece uma capa JPEG. */
export function caminhoCapaPadrao(): string {
  const candidata = path.join(import.meta.dirname, 'capa-padrao.jpg');
  if (fs.existsSync(candidata)) return candidata;
  const daJukebox = path.resolve(import.meta.dirname, '..', '..', '..', 'Jukebox', 'images', 'page_icon.jpg');
  if (fs.existsSync(daJukebox)) return daJukebox;
  return candidata;
}

/** Lê e valida uma pasta de preset da Jukebox. */
export function lerPreset(caminhoDaPasta: string): PresetInfo {
  const pasta = resolverCaminho(caminhoDaPasta);
  if (!fs.existsSync(pasta)) {
    throw new Error(`pasta “${pasta}” não existe`);
  }
  const stat = fs.statSync(pasta);
  if (!stat.isDirectory()) {
    throw new Error(`“${pasta}” não é uma pasta`);
  }

  const caminhoMeta = path.join(pasta, 'preset_metadata.json');
  if (!fs.existsSync(caminhoMeta)) {
    const itens = fs.readdirSync(pasta);
    if (itens.length === 0) {
      throw new Error(`sem preset_metadata.json (pasta vazia; use criar: true para inicializar um novo preset em “${pasta}”)`);
    }
    throw new Error(`sem preset_metadata.json na pasta “${pasta}”`);
  }

  let conteudo = '';
  try {
    conteudo = fs.readFileSync(caminhoMeta, 'utf8');
  } catch (err) {
    throw new Error(`não consegui ler preset_metadata.json em “${pasta}”: ${(err as Error).message}`);
  }

  let dados: unknown;
  try {
    dados = JSON.parse(conteudo);
  } catch (err) {
    throw new Error(`preset_metadata.json em “${pasta}” não contém JSON válido: ${(err as Error).message}`);
  }

  if (!Array.isArray(dados)) {
    throw new Error(`preset_metadata.json em “${pasta}” deve conter uma lista`);
  }

  const musicas: MusicaPresetInfo[] = [];
  for (let i = 0; i < dados.length; i++) {
    const item = dados[i];
    if (!item || typeof item !== 'object' || typeof (item as { currentTitle?: unknown }).currentTitle !== 'string') {
      throw new Error(`metadata inválido na posição ${i}: campo "currentTitle" obrigatório`);
    }
    const it = item as ItemMetadataJukebox;
    const currentTitle = it.currentTitle;
    let titulo = currentTitle;
    try {
      titulo = decodeURIComponent(currentTitle);
    } catch {}

    const temAudio = fs.existsSync(path.join(pasta, `${currentTitle}.mp3`));
    const temCapa = fs.existsSync(path.join(pasta, `${currentTitle}.jpg`));

    musicas.push({
      titulo,
      currentTitle,
      generos: Array.isArray(it.genres) ? it.genres : [],
      tags: Array.isArray(it.tags) ? it.tags : [],
      grupo: typeof it.folder === 'string' ? it.folder : null,
      temAudio,
      temCapa,
    });
  }

  return { pasta, musicas };
}

/** Adiciona uma música a um preset no disco. */
export function adicionarAoPreset(opcoes: OpcoesAdicionarAoPreset): ResultadoAdicionarAoPreset {
  const pasta = resolverCaminho(opcoes.pasta);
  const arquivo = resolverCaminho(opcoes.arquivo);

  // 1. Título
  const tituloBruto = String(opcoes.titulo ?? '');
  if (tituloBruto !== tituloBruto.trim()) {
    throw new Error(`título “${tituloBruto}” não pode conter espaços no início ou no fim`);
  }
  const titulo = tituloBruto.trim();
  if (titulo.length < 1 || titulo.length > 120) {
    throw new Error(`título deve ter entre 1 e 120 caracteres (recebido: ${titulo.length})`);
  }
  const currentTitle = encodeURIComponent(titulo);

  // 2. Gêneros
  const generos = (opcoes.generos || []).map(g => String(g).trim().toLowerCase()).filter(Boolean);
  for (const g of generos) {
    if (!GENEROS_VALIDOS.includes(g as GeneroJukebox)) {
      throw new Error(`gênero “${g}” inválido; gêneros válidos: ${GENEROS_VALIDOS.join(', ')}`);
    }
  }

  // 3. Tags
  const tags = (opcoes.tags || []).map(t => String(t).trim().toLowerCase()).filter(Boolean);
  for (const t of tags) {
    if (!TAGS_VALIDAS.includes(t as TagJukebox)) {
      throw new Error(`tag “${t}” inválida; tags válidas: ${TAGS_VALIDAS.join(', ')}`);
    }
  }

  // 4. Áudio MP3
  validarArquivoMp3(arquivo);

  // 5. Capa JPEG
  let capaCaminho = '';
  if (opcoes.capa) {
    capaCaminho = resolverCaminho(opcoes.capa);
    validarArquivoJpeg(capaCaminho);
  } else {
    capaCaminho = caminhoCapaPadrao();
    if (!fs.existsSync(capaCaminho)) {
      throw new Error(`capa padrão não encontrada em “${capaCaminho}” e nenhuma capa foi especificada`);
    }
  }

  // 6. Pasta e preset_metadata.json
  if (!fs.existsSync(pasta)) {
    if (opcoes.criar) {
      fs.mkdirSync(pasta, { recursive: true });
    } else {
      throw new Error(`pasta “${pasta}” não existe (use criar: true se deseja criá-la)`);
    }
  } else {
    const stat = fs.statSync(pasta);
    if (!stat.isDirectory()) {
      throw new Error(`“${pasta}” não é uma pasta`);
    }
  }

  const caminhoMeta = path.join(pasta, 'preset_metadata.json');
  let metadata: ItemMetadataJukebox[] = [];

  if (!fs.existsSync(caminhoMeta)) {
    if (!opcoes.criar) {
      const itens = fs.readdirSync(pasta);
      if (itens.length === 0) {
        throw new Error(`sem preset_metadata.json (pasta vazia; use criar: true para inicializar um novo preset em “${pasta}”)`);
      }
      throw new Error(`sem preset_metadata.json na pasta “${pasta}”`);
    }
    const itens = fs.readdirSync(pasta);
    const itensEstranhos = itens.filter(f => {
      const p = path.join(pasta, f);
      return p !== arquivo && p !== capaCaminho;
    });
    if (itensEstranhos.length > 0) {
      throw new Error(`pasta “${pasta}” não está vazia para criar um novo preset`);
    }
  } else {
    const lido = lerPreset(pasta);
    // Recupera lista crua
    metadata = JSON.parse(fs.readFileSync(caminhoMeta, 'utf8')) as ItemMetadataJukebox[];
  }

  // 7. Checa duplicidade
  const indiceExistente = metadata.findIndex(m => {
    if (m.currentTitle === currentTitle) return true;
    try {
      return decodeURIComponent(m.currentTitle) === titulo;
    } catch {
      return false;
    }
  });

  const audioExisteNoDisco = fs.existsSync(path.join(pasta, `${currentTitle}.mp3`));
  const capaExisteNoDisco = fs.existsSync(path.join(pasta, `${currentTitle}.jpg`));
  const jaExiste = indiceExistente !== -1 || audioExisteNoDisco || capaExisteNoDisco;

  if (jaExiste && !opcoes.substituir) {
    throw new Error(`música “${titulo}” já existe no preset; use substituir: true para atualizar`);
  }

  const itemAntigo = indiceExistente !== -1 ? metadata[indiceExistente] : null;

  const novoItem: ItemMetadataJukebox = {
    currentTitle,
    genres: generos,
    tags,
    folder: opcoes.grupo !== undefined ? opcoes.grupo : (itemAntigo?.folder ?? null),
    markers: itemAntigo?.markers ?? [],
    hotkey: itemAntigo?.hotkey ?? null,
    hotkeyEffects: itemAntigo?.hotkeyEffects ?? [],
  };

  // 8. Gravação atômica: áudio, capa e por último metadata
  const alvoAudio = path.join(pasta, `${currentTitle}.mp3`);
  const alvoCapa = path.join(pasta, `${currentTitle}.jpg`);
  const tmpAudio = path.join(pasta, `${currentTitle}.mp3.tmp`);
  const tmpCapa = path.join(pasta, `${currentTitle}.jpg.tmp`);
  const tmpMeta = path.join(pasta, 'preset_metadata.json.tmp');

  const bakAudio = path.join(pasta, `${currentTitle}.mp3.bak`);
  const bakCapa = path.join(pasta, `${currentTitle}.jpg.bak`);
  const bakMeta = path.join(pasta, 'preset_metadata.json.bak');

  let fezBackupAudio = false;
  let fezBackupCapa = false;
  let fezBackupMeta = false;

  try {
    // Backup se já existiam (rename atômico evita copiar 200 MB e falhas de disco cheio)
    if (fs.existsSync(alvoAudio)) { fs.renameSync(alvoAudio, bakAudio); fezBackupAudio = true; }
    if (fs.existsSync(alvoCapa)) { fs.renameSync(alvoCapa, bakCapa); fezBackupCapa = true; }
    if (fs.existsSync(caminhoMeta)) { fs.renameSync(caminhoMeta, bakMeta); fezBackupMeta = true; }

    // Grava áudio via .tmp e renomeia
    fs.copyFileSync(arquivo, tmpAudio);
    fs.renameSync(tmpAudio, alvoAudio);

    // Grava capa via .tmp e renomeia
    fs.copyFileSync(capaCaminho, tmpCapa);
    fs.renameSync(tmpCapa, alvoCapa);

    // Relê metadata atual logo antes de gravar para incorporar mudanças simultâneas
    let listaAtual: ItemMetadataJukebox[] = [];
    const fonteMeta = fs.existsSync(caminhoMeta) ? caminhoMeta : (fezBackupMeta && fs.existsSync(bakMeta) ? bakMeta : null);
    if (fonteMeta) {
      try {
        listaAtual = JSON.parse(fs.readFileSync(fonteMeta, 'utf8'));
      } catch {
        listaAtual = metadata;
      }
    }

    const idxAtual = listaAtual.findIndex(m => m.currentTitle === currentTitle);
    if (idxAtual !== -1) {
      listaAtual[idxAtual] = novoItem;
    } else {
      listaAtual.push(novoItem);
    }

    fs.writeFileSync(tmpMeta, JSON.stringify(listaAtual, null, 2), 'utf8');
    fs.renameSync(tmpMeta, caminhoMeta);

    // Limpa backups em sucesso
    if (fezBackupAudio && fs.existsSync(bakAudio)) fs.unlinkSync(bakAudio);
    if (fezBackupCapa && fs.existsSync(bakCapa)) fs.unlinkSync(bakCapa);
    if (fezBackupMeta && fs.existsSync(bakMeta)) fs.unlinkSync(bakMeta);

    return {
      pasta,
      titulo,
      arquivos: [`${currentTitle}.mp3`, `${currentTitle}.jpg`],
      item: novoItem,
      substituido: jaExiste,
    };
  } catch (err) {
    // Limpa temporários
    try { if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio); } catch {}
    try { if (fs.existsSync(tmpCapa)) fs.unlinkSync(tmpCapa); } catch {}
    try { if (fs.existsSync(tmpMeta)) fs.unlinkSync(tmpMeta); } catch {}

    // Restaura ou remove arquivos afetados
    if (fezBackupAudio && fs.existsSync(bakAudio)) {
      try { fs.renameSync(bakAudio, alvoAudio); } catch {}
    } else {
      try { if (fs.existsSync(alvoAudio)) fs.unlinkSync(alvoAudio); } catch {}
    }

    if (fezBackupCapa && fs.existsSync(bakCapa)) {
      try { fs.renameSync(bakCapa, alvoCapa); } catch {}
    } else {
      try { if (fs.existsSync(alvoCapa)) fs.unlinkSync(alvoCapa); } catch {}
    }

    if (fezBackupMeta && fs.existsSync(bakMeta)) {
      try { fs.renameSync(bakMeta, caminhoMeta); } catch {}
    }

    throw new Error(`falha ao adicionar música ao preset “${pasta}”: ${(err as Error).message}`);
  }
}

export const MAX_MUSICAS_ABRIR = 60;
export const MAX_TOTAL_ABRIR = 400 * 1024 * 1024;
export const MAX_MUSICA_ABRIR = 50 * 1024 * 1024;

/** O pedaço da ponte que `abrirPresetNaJukebox` usa (`Ponta` de mcp.ts satisfaz). */
export interface PontaParaPreset {
  conectada: () => boolean;
  apps: () => Record<string, unknown>;
  ativas: () => Array<{ nome: string }>;
  chamar: (
    ferramenta: string,
    args: Record<string, unknown>,
    prazoMs?: number,
  ) => Promise<{ ok: true; conteudo: Array<{ tipo: string; texto?: string }> } | { ok: false; erro: string }>;
}

export interface ResultadoAbrirPreset {
  aberto: true;
  pasta: string;
  musicas: number;
  puladas: string[];
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

async function etapaDaAbertura(ponta: PontaParaPreset, args: Record<string, unknown>): Promise<void> {
  const resp = await ponta.chamar('jukebox_preset_abrir_receber', args);
  if (!resp.ok) throw new Error(resp.erro);
  const texto = resp.conteudo.map(c => (c.tipo === 'texto' ? c.texto ?? '' : '')).join('');
  let dados: { recebido?: boolean; motivo?: string } = {};
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error('a Jukebox respondeu algo ilegível; ela precisa estar atualizada para abrir presets pelo conector');
  }
  if (!dados.recebido) throw new Error(dados.motivo ?? 'a Jukebox recusou a abertura do preset');
}

/** Abre na Jukebox conectada um preset do disco: `inicio`, uma chamada por música e `fim` (com `abortado` se algo falhar). */
export async function abrirPresetNaJukebox(
  ponta: PontaParaPreset,
  opcoes: { pasta: string; forcar?: boolean },
): Promise<ResultadoAbrirPreset> {
  const info = lerPreset(opcoes.pasta);
  const jukeboxConectada = ponta.conectada() && (ponta.apps().jukebox !== undefined || ponta.ativas().some(f => f.nome.startsWith('jukebox_')));
  if (!jukeboxConectada) {
    throw new Error('a Jukebox não está conectada à ponte: abra a Jukebox pela Mesa (mesa_abrir_apps com "jukebox") e tente de novo');
  }

  const metadados = JSON.parse(fs.readFileSync(path.join(info.pasta, 'preset_metadata.json'), 'utf8')) as ItemMetadataJukebox[];
  const puladas: string[] = [];
  const enviar: Array<{ item: ItemMetadataJukebox; audio: string; capa: string; titulo: string }> = [];
  let total = 0;
  for (let i = 0; i < metadados.length; i++) {
    const item = metadados[i]!;
    const musica = info.musicas[i]!;
    if (!musica.temAudio || !musica.temCapa) {
      puladas.push(musica.titulo);
      continue;
    }
    const audio = path.join(info.pasta, `${item.currentTitle}.mp3`);
    const capa = path.join(info.pasta, `${item.currentTitle}.jpg`);
    const tamAudio = fs.statSync(audio).size;
    if (tamAudio > MAX_MUSICA_ABRIR) {
      throw new Error(`a música “${musica.titulo}” tem ${mb(tamAudio)} (limite de ${mb(MAX_MUSICA_ABRIR)} por música): o mestre deve abrir a pasta à mão na Jukebox`);
    }
    total += tamAudio + fs.statSync(capa).size;
    enviar.push({ item, audio, capa, titulo: musica.titulo });
  }
  if (enviar.length > MAX_MUSICAS_ABRIR) {
    throw new Error(`o preset tem ${enviar.length} músicas (limite de ${MAX_MUSICAS_ABRIR}): o mestre deve abrir a pasta à mão na Jukebox`);
  }
  if (total > MAX_TOTAL_ABRIR) {
    throw new Error(`o preset tem ${mb(total)} (limite de ${mb(MAX_TOTAL_ABRIR)} no total): o mestre deve abrir a pasta à mão na Jukebox`);
  }
  if (enviar.length === 0) {
    throw new Error(`o preset “${info.pasta}” não tem nenhuma música com áudio e capa`);
  }

  const pasta = path.basename(info.pasta);
  await etapaDaAbertura(ponta, { pasta, etapa: 'inicio', metadados, ...(opcoes.forcar ? { forcar: true } : {}) });
  try {
    for (const m of enviar) {
      try {
        await etapaDaAbertura(ponta, {
          pasta,
          etapa: 'musica',
          item: m.item,
          audio: fs.readFileSync(m.audio).toString('base64'),
          capa: fs.readFileSync(m.capa).toString('base64'),
        });
      } catch (err) {
        throw new Error(`falha ao enviar “${m.titulo}” à Jukebox: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    try {
      await etapaDaAbertura(ponta, { pasta, etapa: 'fim', abortado: true });
    } catch {
      // a Jukebox pode ter caído; nada mais a fazer
    }
    throw err;
  }
  await etapaDaAbertura(ponta, { pasta, etapa: 'fim' });
  return { aberto: true, pasta: info.pasta, musicas: enviar.length, puladas };
}
