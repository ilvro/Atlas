import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  validarCaminho, raizesPermitidas, filtrarImagensDePdf, recorteEmPx, tamanhoDaPagina, lerReferencia,
  reescreverImagensDoQuadro, listarImagens, lerImagem, type Externos,
} from '../../scripts/ponte/arquivos.ts';

// Saída gravada do `pdfimages -list` do PDF do Pântano (trecho): fundo de página 1193x1616 repetido (ids 43, 101, 151, 205).
const SAIDA = `page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio
--------------------------------------------------------------------------------------------
   1     0 image    1163  1558  icc     3   8  jpeg   no         7  0   144   144  406K 7.6%
   2     1 image    1193  1616  icc     3   8  jpeg   no        43  0   144   144  498K 8.8%
   2     2 image    1163   789  gray    1   8  jpeg   no        57  0   144   144 5389B 0.6%
   2     3 image    1163   789  icc     3   8  jpeg   no        61  0   144   144  279K  10%
   2     4 smask    1163   789  gray    1   8  jpeg   no        61  0   144   144 5389B 0.6%
   2     5 image     891   267  icc     3   8  jpeg   no        63  0   144   144  138K  20%
   3     7 image    1193  1616  icc     3   8  jpeg   no       101  0   144   144  499K 8.8%
   3     8 image     700  1026  icc     3   8  jpeg   no       106  0   144   144  120K 5.7%
   4    10 image    1193  1616  icc     3   8  jpeg   no        43  0   144   144  498K 8.8%
   5    11 image    1193  1616  icc     3   8  jpeg   no       151  0   144   144  137K 2.4%
   6    12 image    1193  1616  icc     3   8  jpeg   no       205  0   144   144  144K 2.6%
   7    17 image       5  1564  gray    1   8  jpeg   no       247  0   167   144 1734B  22%
   7    16 image    1193  1616  icc     3   8  jpeg   no       151  0   144   144  137K 2.4%
   8    20 image    1193  1616  icc     3   8  jpeg   no       205  0   144   144  144K 2.6%
   9    23 image    1193  1616  icc     3   8  jpeg   no       151  0   144   144  137K 2.4%
   9    24 image    1193  1616  icc     3   8  jpeg   no       101  0   144   144  499K 8.8%
   9    26 image    1167   983  icc     3   8  jpeg   no       324  0   144   144  345K  10%
  10    27 image    1193  1616  icc     3   8  jpeg   no        43  0   144   144  498K 8.8%
  12    30 image    1193  1616  icc     3   8  jpeg   no       101  0   144   144  499K 8.8%
  14    35 image    1193  1616  icc     3   8  jpeg   no       205  0   144   144  144K 2.6%
`;

function tmp(): string { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'arq-test-'))); }

test('raízes: padrão ~/Documents e MESA_RAIZES separada por :', () => {
  assert.deepEqual(raizesPermitidas({ home: '/h', raizes: '' }), ['/h/Documents']);
  assert.deepEqual(raizesPermitidas({ home: '/h', raizes: '/a:~/b' }), ['/a', '/h/b']);
});

test('raízes: caminho dentro e atalho do mestre passam; fora e saída por .. são recusados com mensagem legível', () => {
  const base = tmp();
  const raiz = path.join(base, 'raiz');
  const fora = path.join(base, 'fora');
  fs.mkdirSync(raiz); fs.mkdirSync(fora);
  fs.writeFileSync(path.join(raiz, 'a.png'), 'x');
  fs.writeFileSync(path.join(fora, 'b.png'), 'x');
  fs.symlinkSync(fora, path.join(raiz, 'atalho'));
  const amb = { raizes: raiz };
  assert.equal(validarCaminho(path.join(raiz, 'a.png'), amb), path.join(raiz, 'a.png'));
  assert.throws(() => validarCaminho(path.join(fora, 'b.png'), amb), /fora das pastas permitidas \(.*raiz\)/);
  // Um atalho criado dentro da raiz vale (é do próprio mestre); o caminho real é o devolvido.
  fs.writeFileSync(path.join(fora, 'c.png'), '');
  assert.equal(validarCaminho(path.join(raiz, 'atalho', 'c.png'), amb), path.join(fora, 'c.png'));
  assert.throws(() => validarCaminho(path.join(raiz, '..', 'fora', 'b.png'), amb), /fora das pastas permitidas/);
  assert.throws(() => validarCaminho(path.join(raiz, 'nao-existe.png'), amb), /não existe/);
  fs.rmSync(base, { recursive: true, force: true });
});

test('pdfimages -list: ordem e campos', () => {
  const r = filtrarImagensDePdf(SAIDA, '/x/p.pdf');
  const ids = r.map(i => i.id);
  for (const fundo of ['i=1', 'i=7', 'i=10', 'i=11', 'i=12', 'i=16', 'i=20', 'i=23', 'i=24', 'i=27']) {
    assert.ok(!ids.some(id => id.endsWith(`&${fundo}`)), `fundo ${fundo} deveria cair`);
  }
  assert.ok(!ids.some(id => id.endsWith('&i=4')), 'smask cai');
  assert.ok(!ids.some(id => id.endsWith('&i=17')), 'lado menor que 300 cai');
  const mapa = r.find(i => i.id.endsWith('p=9&i=26'))!;
  assert.deepEqual([mapa.pagina, mapa.largura, mapa.altura], [9, 1167, 983]);
});

test('recorte: frações viram px da página a 150 dpi', () => {
  assert.deepEqual(tamanhoDaPagina('Page   19 size: 581.102 x 779.528 pts\n', 19), { largura: 581.102, altura: 779.528 });
  assert.deepEqual(tamanhoDaPagina('Page size:       581.102 x 779.528 pts\n', 3), { largura: 581.102, altura: 779.528 });
  const c = recorteEmPx([0.1, 0.33, 0.85, 0.55], { largura: 581.102, altura: 779.528 });
  assert.deepEqual(c, { x: 121, y: 536, l: 1029, a: 893, paginaL: 1211, paginaA: 1624 });
  const todo = recorteEmPx([0, 0, 1, 1], { largura: 72, altura: 144 });
  assert.deepEqual([todo.x, todo.y, todo.l, todo.a], [0, 0, 150, 300]);
  assert.equal(recorteEmPx([0.9, 0.9, 0.5, 0.5], { largura: 72, altura: 72 }).l, 15);
});

test('referências: parse e erros', () => {
  assert.deepEqual(lerReferencia('arquivo:/a/b.png'), { tipo: 'arquivo', caminho: '/a/b.png' });
  assert.deepEqual(lerReferencia('pdf:/a/b c.pdf#p=9&i=26'), { tipo: 'pdf-imagem', caminho: '/a/b c.pdf', pagina: 9, indice: 26 });
  assert.deepEqual(lerReferencia('pdf:/a/b.pdf#p=19&recorte=0.1,0.33,0.85,0.55'), { tipo: 'pdf-recorte', caminho: '/a/b.pdf', pagina: 19, recorte: [0.1, 0.33, 0.85, 0.55] });
  assert.throws(() => lerReferencia('pdf:/a/b.pdf'), /sem "#"/);
  assert.throws(() => lerReferencia('pdf:/a/b.pdf#p=0&i=1'), /página inválida/);
  assert.throws(() => lerReferencia('pdf:/a/b.pdf#p=1&recorte=0.5,0.5,0.9,0.9'), /fora da página/);
});

function falsos(respostas: Record<string, (args: string[]) => string | Buffer>): Externos & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    existe: async cmd => cmd === 'magick' || cmd in respostas,
    executar: async (cmd, args) => {
      chamadas.push(`${cmd} ${args.join(' ')}`);
      const f = respostas[cmd];
      if (!f) throw new Error(`${cmd} não existe`);
      return Buffer.from(f(args));
    },
  };
}

test('listarImagens: pasta (recursiva até 3 níveis) e PDF, com externos falsos', async () => {
  const base = tmp();
  fs.mkdirSync(path.join(base, 'a', 'b', 'c', 'd'), { recursive: true });
  fs.writeFileSync(path.join(base, 'um.PNG'), 'x');
  fs.writeFileSync(path.join(base, 'a', 'dois.jpg'), 'x');
  fs.writeFileSync(path.join(base, 'a', 'b', 'c', 'tres.webp'), 'x');
  fs.writeFileSync(path.join(base, 'a', 'b', 'c', 'd', 'fundo.png'), 'x');
  fs.writeFileSync(path.join(base, 'nota.txt'), 'x');
  fs.writeFileSync(path.join(base, 'livro.pdf'), 'x');
  const ext = falsos({
    identify: () => '640 480',
    pdfimages: () => SAIDA,
    pdfinfo: () => 'Title: x\nPages:           21\n',
  });
  const pasta: any = await listarImagens(base, { raizes: base, externos: ext });
  assert.deepEqual(pasta.imagens.map((i: any) => i.nome), ['a/b/c/tres.webp', 'a/dois.jpg', 'um.PNG']);
  assert.deepEqual([pasta.imagens[0].largura, pasta.imagens[0].altura], [640, 480]);
  const pdf: any = await listarImagens(path.join(base, 'livro.pdf'), { raizes: base, externos: ext });
  assert.equal(pdf.paginas, 21);
  assert.equal(pdf.imagens.length, 5);
  await assert.rejects(listarImagens(path.join(base, 'nota.txt'), { raizes: base, externos: ext }), /nem um PDF/);
  fs.rmSync(base, { recursive: true, force: true });
});

test('lerImagem: recorte chama pdftoppm com px calculados e apaga a pasta temporária', async () => {
  const base = tmp();
  const tmpDir = tmp();
  fs.writeFileSync(path.join(base, 'l.pdf'), 'x');
  const ext = falsos({
    pdfinfo: () => 'Page   19 size: 581.102 x 779.528 pts\n',
    pdftoppm: args => { fs.writeFileSync(path.join(args[args.length - 1]! + '.jpg'), 'jpg'); return ''; },
    identify: () => '1030 893 True',
    magick: args => { fs.writeFileSync(args[args.length - 1]!, 'saida'); return ''; },
  });
  const img = await lerImagem(`pdf:${path.join(base, 'l.pdf')}#p=19&recorte=0.1,0.33,0.85,0.55`, {}, { raizes: base, externos: ext, tmp: tmpDir });
  assert.equal(img.mime, 'image/jpeg');
  assert.equal(img.bytes.toString(), 'saida');
  const toppm = ext.chamadas.find(c => c.startsWith('pdftoppm'))!;
  assert.match(toppm, /-r 150 -f 19 -l 19 -x 121 -y 536 -W 1029 -H 893 /);
  assert.deepEqual(fs.readdirSync(tmpDir), []);
  await assert.rejects(lerImagem('arquivo:/etc/passwd', {}, { raizes: base, externos: ext, tmp: tmpDir }), /fora das pastas permitidas/);
  fs.rmSync(base, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('reescrita de quadro_inserir: só `de` com arquivo:/pdf:, aninhado, sem tocar no resto', async () => {
  const base = tmp();
  fs.writeFileSync(path.join(base, 'a.png'), 'x');
  const ext = falsos({
    identify: () => '10 10 True',
    magick: args => { fs.writeFileSync(args[args.length - 1]!, 'JPG'); return ''; },
  });
  const entrada = {
    quadro: 'q1',
    itens: [
      { formato: 'imagem', de: `arquivo:${path.join(base, 'a.png')}`, largura: 300 },
      { formato: 'linha', itens: [
        { formato: 'imagem', de: 'dados:data:image/png;base64,AAA' },
        { formato: 'grade', celulas: [[{ formato: 'imagem', de: `arquivo:${path.join(base, 'a.png')}`, legenda: 'x' }], [{ formato: 'texto', texto: 'oi' }]] },
      ] },
      { formato: 'texto', texto: 'arquivo:isto não é de' },
    ],
  };
  const copia = JSON.parse(JSON.stringify(entrada));
  const r: any = await reescreverImagensDoQuadro(entrada, { raizes: base, externos: ext });
  assert.deepEqual(entrada, copia, 'não muda o original');
  const url = `dados:data:image/jpeg;base64,${Buffer.from('JPG').toString('base64')}`;
  assert.equal(r.quadro, 'q1');
  assert.equal(r.itens[0].de, url);
  assert.equal(r.itens[0].largura, 300);
  assert.equal(r.itens[1].itens[0].de, 'dados:data:image/png;base64,AAA');
  assert.equal(r.itens[1].itens[1].celulas[0][0].de, url);
  assert.equal(r.itens[1].itens[1].celulas[0][0].legenda, 'x');
  assert.equal(r.itens[2].texto, 'arquivo:isto não é de');
  assert.equal(ext.chamadas.filter(c => c.startsWith('magick') && c.includes('-resize')).length, 1, 'mesma imagem lida uma vez');
  await assert.rejects(
    reescreverImagensDoQuadro({ itens: [{ de: 'arquivo:/etc/passwd' }] }, { raizes: base, externos: ext }),
    /Não consegui ler a imagem "arquivo:\/etc\/passwd": O caminho está fora/,
  );
  fs.rmSync(base, { recursive: true, force: true });
});
