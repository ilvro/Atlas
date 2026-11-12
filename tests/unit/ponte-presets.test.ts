import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  adicionarAoPreset,
  lerPreset,
  resolverCaminho,
  GENEROS_VALIDOS,
  TAGS_VALIDAS,
} from '../../scripts/ponte/presets.ts';
import { chamarFerramenta, listarFerramentas, CAMINHO_CATALOGO_BASE_PADRAO } from '../../scripts/ponte/mcp.ts';

// Áudio MP3 mínimo com cabeçalho ID3
const MP3_MINIMO = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00,
]);

// Imagem JPEG mínima com cabeçalho FF D8 FF
const JPEG_MINIMO = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

function criarDiretorioTemporario(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-preset-test-'));
}

test('resolverCaminho expande ~ e resolve relativos', () => {
  const home = os.homedir();
  assert.equal(resolverCaminho('~'), home);
  assert.equal(resolverCaminho('~/Musica/Preset'), path.join(home, 'Musica', 'Preset'));
  assert.ok(path.isAbsolute(resolverCaminho('relativo/pasta')));
});

test('o item gravado tem exatamente as chaves da Jukebox', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'musica.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    const r = adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Tema Principal',
      generos: ['horror', 'mystery'],
      tags: ['ambient'],
      criar: true,
    });

    const chavesEsperadas = [
      'currentTitle',
      'genres',
      'tags',
      'folder',
      'markers',
      'hotkey',
      'hotkeyEffects',
    ];
    assert.deepEqual(Object.keys(r.item).sort(), chavesEsperadas.sort());
    assert.equal(r.item.currentTitle, 'Tema%20Principal');
    assert.deepEqual(r.item.genres, ['horror', 'mystery']);
    assert.deepEqual(r.item.tags, ['ambient']);
    assert.equal(r.item.folder, null);
    assert.deepEqual(r.item.markers, []);
    assert.equal(r.item.hotkey, null);
    assert.deepEqual(r.item.hotkeyEffects, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Den of Iniquity?! vira Den%20of%20Iniquity%3F!.mp3/.jpg e o mesmo currentTitle', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'sample.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    const r = adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Den of Iniquity?!',
      criar: true,
    });

    assert.equal(r.item.currentTitle, 'Den%20of%20Iniquity%3F!');
    assert.ok(fs.existsSync(path.join(tmp, 'Den%20of%20Iniquity%3F!.mp3')));
    assert.ok(fs.existsSync(path.join(tmp, 'Den%20of%20Iniquity%3F!.jpg')));
    assert.deepEqual(r.arquivos, ['Den%20of%20Iniquity%3F!.mp3', 'Den%20of%20Iniquity%3F!.jpg']);

    const lido = lerPreset(tmp);
    assert.equal(lido.musicas.length, 1);
    assert.equal(lido.musicas[0]!.currentTitle, 'Den%20of%20Iniquity%3F!');
    assert.equal(lido.musicas[0]!.titulo, 'Den of Iniquity?!');
    assert.equal(lido.musicas[0]!.temAudio, true);
    assert.equal(lido.musicas[0]!.temCapa, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('capa padrão quando falta; capa JPEG personalizada quando informada', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'som.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    // Sem capa -> usa capa padrão
    const r1 = adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Musica Sem Capa',
      criar: true,
    });
    const capaPadraoBytes = fs.readFileSync(path.join(tmp, `${r1.item.currentTitle}.jpg`));
    assert.ok(capaPadraoBytes.length > 0);
    assert.equal(capaPadraoBytes[0], 0xff);
    assert.equal(capaPadraoBytes[1], 0xd8);

    // Com capa personalizada
    const customCoverPath = path.join(tmp, 'custom.jpg');
    fs.writeFileSync(customCoverPath, JPEG_MINIMO);

    const r2 = adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Musica Com Capa',
      capa: customCoverPath,
    });
    const capaGravadaBytes = fs.readFileSync(path.join(tmp, `${r2.item.currentTitle}.jpg`));
    assert.deepEqual(capaGravadaBytes, JPEG_MINIMO);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('duplicado recusado e substituir preserva markers/hotkey e grupo', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'musica.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Toada Antiga',
      generos: ['fun'],
      tags: ['event'],
      criar: true,
    });

    // Simulando que o usuário no Jukebox adicionou marker e hotkey no metadata
    const metaPath = path.join(tmp, 'preset_metadata.json');
    const dados = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    dados[0].markers = [{ time: 10, label: 'Refrão' }];
    dados[0].hotkey = 'Digit1';
    dados[0].hotkeyEffects = ['bassBoost'];
    dados[0].folder = 'Especiais';
    fs.writeFileSync(metaPath, JSON.stringify(dados, null, 2));

    // Tentar adicionar duplicado sem substituir deve falhar
    assert.throws(
      () => adicionarAoPreset({ pasta: tmp, arquivo: audioPath, titulo: 'Toada Antiga' }),
      /música “Toada Antiga” já existe no preset; use substituir: true/,
    );

    // Com substituir: true, deve preservar markers, hotkey, hotkeyEffects e folder (se não informado novo)
    const rSub = adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Toada Antiga',
      generos: ['mystery'],
      substituir: true,
    });

    assert.equal(rSub.substituido, true);
    assert.deepEqual(rSub.item.genres, ['mystery']);
    assert.equal(rSub.item.folder, 'Especiais');
    assert.equal(rSub.item.hotkey, 'Digit1');
    assert.deepEqual(rSub.item.hotkeyEffects, ['bassBoost']);
    assert.deepEqual(rSub.item.markers, [{ time: 10, label: 'Refrão' }]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('gênero e tag inválidos listam as opções válidas', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'musica.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    assert.throws(
      () => adicionarAoPreset({ pasta: tmp, arquivo: audioPath, titulo: 'M1', generos: ['rock'], criar: true }),
      new RegExp(`gênero “rock” inválido; gêneros válidos: ${GENEROS_VALIDOS.join(', ')}`),
    );

    assert.throws(
      () => adicionarAoPreset({ pasta: tmp, arquivo: audioPath, titulo: 'M1', tags: ['dialogue'], criar: true }),
      new RegExp(`tag “dialogue” inválida; tags válidas: ${TAGS_VALIDAS.join(', ')}`),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('arquivo que não é MP3 é recusado', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const txtPath = path.join(tmp, 'falso.mp3');
    fs.writeFileSync(txtPath, 'este é um arquivo de texto comum');

    assert.throws(
      () => adicionarAoPreset({ pasta: tmp, arquivo: txtPath, titulo: 'M1', criar: true }),
      /não é um MP3 válido/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('pasta sem metadata é recusada e criar só numa pasta vazia', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'musica.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    // Pasta com arquivos estranhos mas sem preset_metadata.json
    const estranho = path.join(tmp, 'estranho.txt');
    fs.writeFileSync(estranho, 'ola');
    assert.throws(
      () => lerPreset(tmp),
      /sem preset_metadata.json/,
    );

    // Tentar criar num diretório que já tem arquivos estranhos
    assert.throws(
      () => adicionarAoPreset({ pasta: tmp, arquivo: audioPath, titulo: 'M1', criar: true }),
      /não está vazia para criar um novo preset/,
    );

    // Pasta vazia: lerPreset sugere criar: true
    const vazia = path.join(tmp, 'vazia');
    fs.mkdirSync(vazia);
    assert.throws(
      () => lerPreset(vazia),
      /use criar: true/,
    );

    // E criar em pasta vazia funciona
    const r = adicionarAoPreset({ pasta: vazia, arquivo: audioPath, titulo: 'Primeira', criar: true });
    assert.equal(r.titulo, 'Primeira');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('falha simulada no metadata não deixa órfãos no disco', () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'musica.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    const pasta = path.join(tmp, 'preset');
    fs.mkdirSync(pasta);
    fs.writeFileSync(path.join(pasta, 'preset_metadata.json'), '[]');

    // Cria preset_metadata.json.tmp como diretório para que a escrita falhe com EISDIR
    const metaFake = path.join(pasta, 'preset_metadata.json.tmp');
    fs.mkdirSync(metaFake);

    assert.throws(
      () => adicionarAoPreset({ pasta, arquivo: audioPath, titulo: 'FalhaTeste' }),
      /falha ao adicionar música ao preset/,
    );

    // Arquivos novos .mp3 e .jpg não devem ter ficado na pasta
    assert.equal(fs.existsSync(path.join(pasta, 'FalhaTeste.mp3')), false);
    assert.equal(fs.existsSync(path.join(pasta, 'FalhaTeste.jpg')), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('metadata gravado pela Jukebox passa por lerPreset e continua igual depois de adicionar', () => {
  const tmp = criarDiretorioTemporario();
  try {
    // Copia preset_metadata.json do sample da Jukebox
    const sampleDir = path.resolve('..', 'Jukebox', 'sample');
    if (!fs.existsSync(path.join(sampleDir, 'preset_metadata.json'))) {
      return; // pula se pasta Jukebox não estiver no caminho padrão
    }
    const sampleMeta = fs.readFileSync(path.join(sampleDir, 'preset_metadata.json'), 'utf8');
    fs.writeFileSync(path.join(tmp, 'preset_metadata.json'), sampleMeta);

    const lidoAntes = lerPreset(tmp);
    const totalOriginal = lidoAntes.musicas.length;
    assert.ok(totalOriginal > 0);

    const audioPath = path.join(tmp, 'som.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    adicionarAoPreset({
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Minha Musica Nova',
      generos: ['horror'],
      tags: ['battle'],
    });

    const lidoDepois = lerPreset(tmp);
    assert.equal(lidoDepois.musicas.length, totalOriginal + 1);

    // Todas as músicas originais permanecem idênticas
    for (let i = 0; i < totalOriginal; i++) {
      assert.equal(lidoDepois.musicas[i]!.currentTitle, lidoAntes.musicas[i]!.currentTitle);
      assert.deepEqual(lidoDepois.musicas[i]!.generos, lidoAntes.musicas[i]!.generos);
    }
    // A última é a nova
    assert.equal(lidoDepois.musicas[totalOriginal]!.titulo, 'Minha Musica Nova');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('MCP: jukebox_preset_ler e jukebox_preset_adicionar funcionam como ferramentas locais', async () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'audio.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    // Mock de ponta desligada
    const pontaDesligada = {
      conectada: () => false,
      motivo: () => null as 'sem-servidor' | null,
      ativas: () => [],
      apps: () => ({}),
      avisoArmazenamento: () => null,
      catalogo: () => [],
      origemHttp: () => 'http://127.0.0.1:5100',
      chamar: async () => ({ ok: false, erro: 'sem ponte' } as never),
      fechar: () => {},
    };

    // Com o catálogo base padrão, listarFerramentas deve conter as duas ferramentas mesmo sem ponte
    const base = JSON.parse(fs.readFileSync(CAMINHO_CATALOGO_BASE_PADRAO, 'utf8'));
    const ferramentas = listarFerramentas(base);
    const nomes = ferramentas.map(f => f.name);
    assert.ok(nomes.includes('jukebox_preset_ler'));
    assert.ok(nomes.includes('jukebox_preset_adicionar'));

    // Chamar adicionar via MCP com ponte desconectada deve funcionar localmente
    const rAdd = await chamarFerramenta(pontaDesligada, 'jukebox_preset_adicionar', {
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Tema MCP Local',
      generos: ['fun'],
      criar: true,
    });
    assert.equal('isError' in rAdd && rAdd.isError, false);
    const txtAdd = rAdd.content[0]?.type === 'text' ? rAdd.content[0].text : '';
    assert.ok(txtAdd.includes('adicionada com sucesso'));

    // Chamar ler via MCP
    const rLer = await chamarFerramenta(pontaDesligada, 'jukebox_preset_ler', {
      pasta: tmp,
    });
    assert.equal('isError' in rLer && rLer.isError, false);
    const txtLer = rLer.content[0]?.type === 'text' ? rLer.content[0].text : '';
    assert.ok(txtLer.includes('Tema MCP Local'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('MCP: chamar receber quando Jukebox conectada; sem ponte vira aviso; erro da aba não desfaz o disco', async () => {
  const tmp = criarDiretorioTemporario();
  try {
    const audioPath = path.join(tmp, 'audio.mp3');
    fs.writeFileSync(audioPath, MP3_MINIMO);

    const chamadasReceber: any[] = [];
    const pontaComJukebox = {
      conectada: () => true,
      motivo: () => null as 'sem-servidor' | null,
      ativas: () => [{ nome: 'jukebox_preset_receber', descricao: '', esquema: {}, app: 'jukebox' }],
      apps: () => ({ jukebox: { armazenamento: 'a1', onde: 'Chrome' } }),
      avisoArmazenamento: () => null,
      catalogo: () => [],
      origemHttp: () => 'http://127.0.0.1:5100',
      chamar: async (ferramenta: string, args: Record<string, unknown>) => {
        chamadasReceber.push({ ferramenta, args });
        return {
          tipo: 'resultado' as const,
          id: '1',
          ok: true as const,
          conteudo: [{ tipo: 'texto' as const, texto: JSON.stringify({ recebido: true, titulo: 'Tema Conectado' }) }],
        };
      },
      fechar: () => {},
    };

    // 1. Quando Jukebox está conectada, chama jukebox_preset_receber e não inclui aviso
    const rConectada = await chamarFerramenta(pontaComJukebox, 'jukebox_preset_adicionar', {
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Tema Conectado',
      generos: ['fun'],
      criar: true,
    });
    assert.equal('isError' in rConectada && rConectada.isError, false);
    const txtConectada = rConectada.content[0]?.type === 'text' ? rConectada.content[0].text : '';
    assert.equal(chamadasReceber.length, 1);
    assert.equal(chamadasReceber[0].ferramenta, 'jukebox_preset_receber');
    assert.equal(chamadasReceber[0].args.item.currentTitle, 'Tema%20Conectado');
    assert.ok(typeof chamadasReceber[0].args.audio === 'string' && chamadasReceber[0].args.audio.length > 0);
    assert.ok(!txtConectada.includes('Aviso:'));

    // 2. Com ponte desconectada, grava no disco com sucesso e adiciona aviso para reabrir
    const pontaDesconectada = {
      ...pontaComJukebox,
      conectada: () => false,
    };
    const rSemPonte = await chamarFerramenta(pontaDesconectada, 'jukebox_preset_adicionar', {
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Tema Sem Ponte',
      generos: ['fun'],
    });
    assert.equal('isError' in rSemPonte && rSemPonte.isError, false);
    const txtSemPonte = rSemPonte.content[0]?.type === 'text' ? rSemPonte.content[0].text : '';
    assert.ok(txtSemPonte.includes('reabra o preset na Jukebox para ver a música'));

    // 3. Erro na aba da Jukebox (ex.: preset diferente aberto ou falha) vira aviso e NÃO desfaz o disco
    const pontaComErro = {
      ...pontaComJukebox,
      chamar: async () => ({
        tipo: 'resultado' as const,
        id: '2',
        ok: true as const,
        conteudo: [{ tipo: 'texto' as const, texto: JSON.stringify({ recebido: false, motivo: 'Preset "outro" aberto' }) }],
      }),
    };
    const rErroAba = await chamarFerramenta(pontaComErro, 'jukebox_preset_adicionar', {
      pasta: tmp,
      arquivo: audioPath,
      titulo: 'Tema Com Erro na Aba',
      generos: ['fun'],
    });
    assert.equal('isError' in rErroAba && rErroAba.isError, false);
    const txtErroAba = rErroAba.content[0]?.type === 'text' ? rErroAba.content[0].text : '';
    assert.ok(txtErroAba.includes('Preset "outro" aberto'));
    // Confere que os arquivos foram gravados no disco mesmo com o aviso da aba
    const presetLido = lerPreset(tmp);
    assert.ok(presetLido.musicas.some(m => m.titulo === 'Tema Com Erro na Aba'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
