import { MARGEM_SOMBRA, assarComodo, assarDescricao, assarObjeto, assarTerreno, type Assado, type EntradaDeTerreno, type EntradaDoComodo } from './assar.ts';
import { contextoDe, criarTela } from './canvas.ts';
import type { SpriteDaPeca } from '../domain/sprite.ts';
import { estiloDe, type IdDoEstilo, type OpcoesDoPixel } from './estilos/index.ts';
import { SOMBRA_DE_CONTATO, caixaDoConteudo, contorno, puxarCor, sobrepor, sombraDeContato, type AlvoDeCor } from './harmonizar.ts';

export type PedidoDeBake =
  | { tipo: 'objeto'; receita: string; params: Record<string, unknown>; seed: number; res: number; estilo: IdDoEstilo; pixel?: OpcoesDoPixel }
  /** Um item gerado da coleção, assado da descrição do gerador (sem a imagem): só no Pixel; o Ilustrado usa a imagem já assada. */
  | { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number; res: number; estilo: IdDoEstilo; pixel?: OpcoesDoPixel }
  /** Uma imagem da coleção, já assada com a sombra: `resImagem` px/m, desenhada a `res` px/m, centrada no objeto. */
  | { tipo: 'imagem'; url: string; pegada: [number, number]; res: number; resImagem: number; /** Recorta o vazio, encaixa na pegada e põe contorno e sombra de contato (imagens achadas). */ harmonizar: boolean; /** Para onde puxar a cor (o gênero do mapa); `null` não mexe na cor. */ alvo: AlvoDeCor | null; /** No Pixel a imagem é derivada (moda por bloco, alfa binário, paleta, contorno); sem estilo vale o Ilustrado. */ estilo?: IdDoEstilo; pixel?: OpcoesDoPixel; /** Arte feita à mão (PNG a 16 px por célula): desenhada em `nearest`, ampliada `escala` vezes, sem harmonizar nem derivar. */ pixelManual?: { escala: number } }
  /** A folha de quadros de um personagem (96 × 96 px, `res` 1). */
  | { tipo: 'sprite'; spec: SpriteDaPeca }
  | { tipo: 'comodo'; entrada: EntradaDoComodo; res: number; estilo: IdDoEstilo }
  | { tipo: 'terreno'; entrada: EntradaDeTerreno; res: number; estilo: IdDoEstilo };

export interface ResultadoDeBake { bitmap: ImageBitmap; origem: [number, number]; res: number }

/** O trabalho pesado: pinta numa tela e devolve um `ImageBitmap`. Roda no worker, ou na página se o navegador não tiver worker. */
export async function executarBake(p: PedidoDeBake): Promise<ResultadoDeBake> {
  if (p.tipo === 'imagem') return assarImagem(p);
  if (p.tipo === 'sprite') { const { folhaDoSprite } = await import('./sprite.ts'); return paraBitmap({ tela: folhaDoSprite(p.spec), origem: [0, 0], res: 1 }); }
  const estilo = estiloDe(p.estilo);
  if (p.tipo === 'gerado') return paraBitmap(await assarGerado(p, estilo));
  const a: Assado = p.tipo === 'objeto' ? assarObjeto(p.receita, p.params, p.seed, p.res, estilo, p.pixel) : p.tipo === 'comodo' ? assarComodo(p.entrada, p.res, estilo) : assarTerreno(p.entrada, p.res, estilo);
  return paraBitmap(a);
}

async function paraBitmap(a: Assado): Promise<ResultadoDeBake> {
  const bitmap = 'transferToImageBitmap' in a.tela ? a.tela.transferToImageBitmap() : await createImageBitmap(a.tela);
  return { bitmap, origem: a.origem, res: a.res };
}

/** A descrição do gerador pesado, assada no estilo pedido. O import é dinâmico: os geradores só carregam quando um item gerado é pedido no Pixel. */
async function assarGerado(p: Extract<PedidoDeBake, { tipo: 'gerado' }>, estilo: ReturnType<typeof estiloDe>): Promise<Assado> {
  const { PESADOS } = await import('./pesados/index.ts'), g = PESADOS.find(x => x.id === p.gerador);
  if (!g) throw new Error(`Não existe o gerador ${p.gerador}.`);
  return assarDescricao(g.gerar({ seed: p.seed, params: p.params }), p.seed, p.res, estilo, p.pixel);
}

/** Busca a imagem e a devolve numa tela do tamanho dela na escala pedida, centrada no objeto (origem do canto no espaço local). Com `harmonizar`: recorta o vazio, encaixa na pegada, contorno e sombra de contato. Falha de rede rejeita. */
async function assarImagem(p: Extract<PedidoDeBake, { tipo: 'imagem' }>): Promise<ResultadoDeBake> {
  const resposta = await fetch(p.url); if (!resposta.ok) throw new Error(`Não consegui buscar ${p.url} (${resposta.status}).`);
  // No Pixel a imagem é desenhada com 4× a resolução e depois derivada (reduzida por blocos) para o tamanho da pegada em pixels do Pixel.
  const pixel = p.estilo === 'pixel' && !!p.pixel, resD = pixel ? p.res * 4 : p.res;
  const imagem = await createImageBitmap(await resposta.blob());
  if (p.pixelManual) return assarImagemManual(p, imagem);
  const k = resD / p.resImagem;
  const w = Math.max(p.pegada[0] + 2 * MARGEM_SOMBRA, imagem.width / p.resImagem), h = Math.max(p.pegada[1] + 2 * MARGEM_SOMBRA, imagem.height / p.resImagem);
  let tela = criarTela(w * resD, h * resD), ctx = contextoDe(tela);
  ctx.imageSmoothingQuality = 'high';
  const original = p.harmonizar ? lerPixels(imagem) : null, caixa = original ? caixaDoConteudo(original) : null;
  if (!caixa) ctx.drawImage(imagem, (tela.width - imagem.width * k) / 2, (tela.height - imagem.height * k) / 2, imagem.width * k, imagem.height * k);
  else {
    // Recorta o vazio e encaixa o conteúdo na pegada, mantendo a proporção.
    const cw = caixa.x1 - caixa.x0, ch = caixa.y1 - caixa.y0, e = Math.min((p.pegada[0] * resD) / cw, (p.pegada[1] * resD) / ch), dw = cw * e, dh = ch * e;
    ctx.drawImage(imagem, caixa.x0, caixa.y0, cw, ch, (tela.width - dw) / 2, (tela.height - dh) / 2, dw, dh);
    const bruto = ctx.getImageData(0, 0, tela.width, tela.height), sprite = p.alvo ? puxarCor(bruto, p.alvo) : bruto;
    if (pixel) ctx.putImageData(new ImageData(sprite.data as unknown as Uint8ClampedArray<ArrayBuffer>, sprite.width, sprite.height), 0, 0);      // no Pixel o contorno e a sombra são os da derivação
    else { const comContorno = contorno(sprite, Math.max(1, Math.round(SOMBRA_DE_CONTATO.contorno * p.res)));
    const sombra = sombraDeContato(comContorno, SOMBRA_DE_CONTATO.raio * p.res, [SOMBRA_DE_CONTATO.deslocamento[0] * p.res, SOMBRA_DE_CONTATO.deslocamento[1] * p.res], SOMBRA_DE_CONTATO.opacidade);
    const final = sobrepor(sombra, comContorno);
    ctx.putImageData(new ImageData(final.data as unknown as Uint8ClampedArray<ArrayBuffer>, final.width, final.height), 0, 0); }
  }
  imagem.close();
  if (pixel) {
    const { derivarPixel } = await import('./derivar-pixel.ts'), { paletaDe } = await import('../domain/paletas.ts');
    const bruta = ctx.getImageData(0, 0, tela.width, tela.height), alvo = { largura: Math.ceil(w * p.res), altura: Math.ceil(h * p.res) };
    const d = derivarPixel(bruta, alvo, paletaDe(p.pixel!.paleta).cores, { dither: p.pixel!.dither === 'bayer4', contorno: p.pixel!.contorno, sombra: true });
    tela = criarTela(d.width, d.height); ctx = contextoDe(tela); ctx.putImageData(new ImageData(d.data as unknown as Uint8ClampedArray<ArrayBuffer>, d.width, d.height), 0, 0);
  }
  const bitmap = 'transferToImageBitmap' in tela ? tela.transferToImageBitmap() : await createImageBitmap(tela);
  return { bitmap, origem: [-tela.width / p.res / 2, -tela.height / p.res / 2], res: p.res };
}

/** A arte manual do Pixel: o PNG ampliado em `nearest` por um inteiro, centrado no objeto, sem mexer em nenhuma cor. */
async function assarImagemManual(p: Extract<PedidoDeBake, { tipo: 'imagem' }>, imagem: ImageBitmap): Promise<ResultadoDeBake> {
  const e = p.pixelManual!.escala, tela = criarTela(imagem.width * e, imagem.height * e), ctx = contextoDe(tela);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(imagem, 0, 0, imagem.width * e, imagem.height * e); imagem.close();
  const bitmap = 'transferToImageBitmap' in tela ? tela.transferToImageBitmap() : await createImageBitmap(tela);
  return { bitmap, origem: [-tela.width / p.res / 2, -tela.height / p.res / 2], res: p.res };
}

function lerPixels(imagem: ImageBitmap): { width: number; height: number; data: Uint8ClampedArray } {
  const t = criarTela(imagem.width, imagem.height), c = contextoDe(t, { willReadFrequently: true }); c.drawImage(imagem, 0, 0);
  const d = c.getImageData(0, 0, imagem.width, imagem.height); return { width: d.width, height: d.height, data: d.data };
}
