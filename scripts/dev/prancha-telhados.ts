/**
 * Gera a prancha de validação visual da Frente N em `docs/referencias/telhados/atlas-N10.png`:
 * - Destaque das 3 casas de referência do exemplo `vila-dos-telhados` (fechadas, com fachadas, desgaste, musgo, puxado e sombras) + vista geral da vila;
 * - Todos os 33 estilos de `ESTILOS_DE_TELHADO` em grade 11 × 3 nos estados (novo, abandonado, nevado) × (meio-dia, noite com lampião na rua).
 *
 * Uso: node scripts/dev/prancha-telhados.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { comodos, type PedidoDeComodo } from '../../src/authoring/construcao.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { ESTADOS_DE_TELHADO, ESTILOS_DE_TELHADO } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { encerrar, esperarEditor, iniciarAmbiente, novoContexto } from '../../tests/e2e/apoio.ts';
import { Kit, montarExemplo } from '../exemplos/kit.ts';
import { vilaDosTelhados } from '../exemplos/vila-dos-telhados.ts';

const SAIDA = join(import.meta.dirname, '../../docs/referencias/telhados/atlas-N10.png');

const COLUNAS = 11;
const LINHAS = Math.ceil(ESTILOS_DE_TELHADO.length / COLUNAS);
const CEL_LARG = 3; // 4,5 m
const CEL_ALT = 2; // 3,0 m
const PASSO_X = 4; // 6,0 m
const PASSO_Y = 4; // 6,0 m (espaço para fachada + lampião + sombra)
const MARGEM_CEL = 1;
const LARGURA_GRADE = (COLUNAS * PASSO_X + MARGEM_CEL) * 1.5;
const ALTURA_GRADE = (LINHAS * PASSO_Y + MARGEM_CEL) * 1.5;

type EstadoPrancha = 'novo' | 'abandonado' | 'nevado';
type LuzPrancha = 'meio-dia' | 'noite';

function montarMapaGrade(estado: EstadoPrancha, luz: LuzPrancha): MapaAtlas {
  const k = new Kit({
    id: `prancha-telhados-${estado}-${luz}`,
    nome: `Prancha ${estado} ${luz}`,
    largura: LARGURA_GRADE,
    altura: ALTURA_GRADE,
    semente: 707,
  });

  k.estilo({ genre: 'investigacao', palette: 'investigacao', facades: true });
  k.fundo({ kind: 'solid', color: estado === 'nevado' ? '#cfd8e3' : '#1b2219' });
  k.base(estado === 'nevado' ? 'neve' : 'grama');

  // Rua de terra/neve pisada sob cada fileira de casas
  for (let row = 0; row < LINHAS; row++) {
    const yRua = (MARGEM_CEL + row * PASSO_Y + CEL_ALT) * 1.5 + 1.2;
    k.pintar(estado === 'nevado' ? 'neve.pisada' : 'terra', {
      retangulo: [0, yRua - 0.75, LARGURA_GRADE, yRua + 0.75],
      irregular: 0.15,
    });
  }

  const wearBase =
    estado === 'novo'
      ? ESTADOS_DE_TELHADO.find(e => e.id === 'novo')!.wear
      : estado === 'abandonado'
        ? ESTADOS_DE_TELHADO.find(e => e.id === 'abandonado')!.wear
        : { moss: 0.1, dirt: 0.25, damage: 0.05 };
  const snow = estado === 'nevado' ? 0.92 : 0;

  const pedidos: PedidoDeComodo[] = [];
  const portas: [number, number][] = [];
  const lampioes: [number, number][] = [];

  ESTILOS_DE_TELHADO.forEach((est, idx) => {
    const col = idx % COLUNAS;
    const row = Math.floor(idx / COLUNAS);
    const gx = MARGEM_CEL + col * PASSO_X;
    const gy = MARGEM_CEL + row * PASSO_Y;
    const x0 = gx * 1.5;
    const y0 = gy * 1.5;
    const w = CEL_LARG * 1.5;
    const h = CEL_ALT * 1.5;

    const usaCirculo = est.roof.shape === 'cone';
    const pedido: PedidoDeComodo = {
      ...(usaCirculo
        ? { circulo: { centro: [x0 + w / 2, y0 + h / 2], raio: 1.5, lados: 18 } }
        : { rets: [[gx, gy, gx + CEL_LARG, gy + CEL_ALT]] }),
      tipo: 'sala',
      nome: est.nome,
      piso: 'tabuas.carvalho',
      papel: 'parede.reboco',
      wallFace: est.roof.material?.includes('tabua') || est.roof.material?.includes('palha') ? 'parede.tabuas' : 'parede.reboco',
      telhado: est.id,
      telhadoDesgaste: { ...wearBase, snow },
    };
    pedidos.push(pedido);

    if (!usaCirculo) {
      portas.push([x0 + w * 0.5, y0 + h]);
    }
    if (luz === 'noite') {
      lampioes.push([x0 + w * 0.85, y0 + h + 1.15]);
    }
  });

  k.aplicar((m, gerarId) => comodos(m, pedidos, 711, gerarId));
  for (const p of portas) k.porta(p, 'door', { state: 'closed' });
  for (const pos of lampioes) {
    k.objeto('lanterna-de-poste', pos);
    k.luz('tocha', pos, { radius: 6.2, color: '#ffbe55', intensity: 1.25, flicker: 0 });
  }

  if (luz === 'meio-dia') {
    k.clima(estado === 'nevado' ? 'neve' : 'tarde', {
      time: '13:30',
      tempo: { snow: estado === 'nevado' ? 0.85 : 0, rain: 0, fog: 0, wind: 0 },
    });
    k.acabamento('neutro', { vignette: 0.08, edges: { kind: 'none', amount: 0 } });
  } else {
    k.clima('noite', {
      time: '23:00',
      ambient: { color: '#6b84ab', intensity: 0.52 },
      sun: { angle: 0.8, color: '#9ab8e8', intensity: 0.36 },
      tempo: { snow: estado === 'nevado' ? 0.5 : 0, fog: 0.08, wind: 0 },
    });
    k.acabamento('neutro', {
      tint: '#eef2fb',
      saturation: 0.95,
      vignette: 0.12,
      edges: { kind: 'none', amount: 0 },
      glow: 0.65,
    });
  }

  const mapa = k.construir();
  validarMapa(mapa);
  return mapa;
}

interface CapturaBloco {
  titulo: string;
  dataUrl: string;
  rotulos?: readonly string[];
}

async function abrirECapturar(
  page: import('playwright').Page,
  mapa: MapaAtlas,
  caixas: readonly { titulo: string; caixa: { x0: number; y0: number; x1: number; y1: number }; ladoMaximo: number; rotulos?: readonly string[] }[],
): Promise<CapturaBloco[]> {
  await page.evaluate(async m => {
    await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } })
      .__atlas.servicos().repo.salvar(m, { forcar: true });
  }, mapa);
  await page.evaluate(id => {
    location.hash = `#/mapa/${encodeURIComponent(id)}`;
  }, mapa.id);
  await esperarEditor(page);

  await page.evaluate(({ w, h }) => {
    const vp = (window as unknown as {
      __atlas: { viewport(): { definirModoProjetor(b: boolean): void; enquadrarCaixa(c: unknown, s: boolean): void } };
    }).__atlas.viewport();
    vp.definirModoProjetor(true);
    vp.enquadrarCaixa({ x0: 0, y0: 0, x1: w, y1: h }, false);
  }, { w: mapa.bounds.width, h: mapa.bounds.height });

  await page.waitForTimeout(300);
  await page.waitForFunction(
    () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(700);

  const resultados: CapturaBloco[] = [];
  for (const item of caixas) {
    const dataUrl = await page.evaluate(
      async ({ caixa, ladoMaximo }) =>
        (
          await (window as unknown as {
            __atlas: { viewport(): { capturar(o: unknown): Promise<{ dataUrl: string }> } };
          }).__atlas.viewport().capturar({ caixa, ladoMaximo, vista: 'telhados' })
        ).dataUrl,
      { caixa: item.caixa, ladoMaximo: item.ladoMaximo },
    );
    resultados.push({ titulo: item.titulo, dataUrl, rotulos: item.rotulos });
  }

  await page.evaluate(() => {
    location.hash = '#/';
  });
  await page.waitForTimeout(150);
  return resultados;
}

const ambiente = await iniciarAmbiente();
try {
  const ctx = await novoContexto(ambiente, { viewport: { width: 1600, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(ambiente.url);
  await page.waitForFunction(
    () => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null,
    null,
    { timeout: 30_000 },
  );

  // 1. Destaque das três casas de referência + vista geral da vila-dos-telhados
  console.log('Capturando vila-dos-telhados (3 casas de referência + vista geral)...');
  const mapaVila = montarExemplo(vilaDosTelhados);
  const capturasVila = await abrirECapturar(page, mapaVila, [
    { titulo: 'Cabana de tábuas gasta (telha.tabuas · duas-águas)', caixa: { x0: 3.4, y0: 3.4, x1: 13.1, y1: 12.1 }, ladoMaximo: 760 },
    { titulo: 'Delegacia em L com puxado (telha.barro · musgo + uma-água)', caixa: { x0: 21.4, y0: 2.0, x1: 32.6, y1: 13.6 }, ladoMaximo: 760 },
    { titulo: 'Casa de tabuinhas com chaminé (telha.tabuinhas · duas-águas)', caixa: { x0: 19.9, y0: 16.9, x1: 29.6, y1: 25.6 }, ladoMaximo: 760 },
    { titulo: 'Vila dos telhados — vista geral fechada (42 × 28 m)', caixa: { x0: 0, y0: 0, x1: 42, y1: 28 }, ladoMaximo: 1140 },
  ]);

  // 2. Todos os 33 estilos × (novo, abandonado, nevado) × (meio-dia, noite com lampião)
  const cenarios: readonly { estado: EstadoPrancha; luz: LuzPrancha; titulo: string }[] = [
    { estado: 'novo', luz: 'meio-dia', titulo: '33 estilos · Novo · Meio-dia' },
    { estado: 'novo', luz: 'noite', titulo: '33 estilos · Novo · Noite com lampião' },
    { estado: 'abandonado', luz: 'meio-dia', titulo: '33 estilos · Abandonado · Meio-dia' },
    { estado: 'abandonado', luz: 'noite', titulo: '33 estilos · Abandonado · Noite com lampião' },
    { estado: 'nevado', luz: 'meio-dia', titulo: '33 estilos · Nevado · Meio-dia' },
    { estado: 'nevado', luz: 'noite', titulo: '33 estilos · Nevado · Noite com lampião' },
  ];

  const nomesEstilos = ESTILOS_DE_TELHADO.map(e => e.nome);
  const capturasGrade: CapturaBloco[] = [];
  for (const c of cenarios) {
    console.log(`Capturando ${c.titulo}...`);
    const mapa = montarMapaGrade(c.estado, c.luz);
    const [cap] = await abrirECapturar(page, mapa, [
      {
        titulo: c.titulo,
        caixa: { x0: 0, y0: 0, x1: LARGURA_GRADE, y1: ALTURA_GRADE },
        ladoMaximo: 2100,
        rotulos: nomesEstilos,
      },
    ]);
    capturasGrade.push(cap!);
  }

  // 3. Compor a prancha final em PNG no navegador
  console.log('Compondo prancha final...');
  const pngDataUrl = await page.evaluate(
    async ({ vila, grade, colunas, linhas }) => {
      const carregar = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return img;
      };
      const imgsVila = await Promise.all(vila.map(v => carregar(v.dataUrl)));
      const imgsGrade = await Promise.all(grade.map(g => carregar(g.dataUrl)));

      const W = 2240;
      const PAD = 32;
      const GAP = 20;
      const INNER = W - PAD * 2;

      // Alturas do bloco de destaque (3 casas lado a lado + vista geral)
      const casaW = Math.floor((INNER - GAP * 2) / 3);
      const casaH = 520;
      const geralW = INNER;
      const geralH = Math.round((imgsVila[3]!.height / imgsVila[3]!.width) * geralW * 0.56);

      // Alturas das 6 faixas da grade 33 estilos (2 colunas? Não: largura inteira para ler bem os 33!)
      const faixaH = Math.round((imgsGrade[0]!.height / imgsGrade[0]!.width) * INNER);
      const TITULO_H = 34;

      const totalH =
        PAD +
        64 + // cabeçalho principal
        TITULO_H + casaH + GAP +
        TITULO_H + geralH + GAP * 1.5 +
        grade.length * (TITULO_H + faixaH + GAP) +
        PAD;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = Math.ceil(totalH);
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#0d1015';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let y = PAD;

      // Cabeçalho
      ctx.fillStyle = '#f3ece0';
      ctx.font = '700 28px sans-serif';
      ctx.fillText('Atlas N10 — Prancha de Telhados Detalhados', PAD, y + 28);
      ctx.fillStyle = '#9aa6b8';
      ctx.font = '400 16px sans-serif';
      ctx.fillText('3 casas de referência (vila-dos-telhados) + 33 estilos × (novo, abandonado, nevado) × (meio-dia, noite com lampião)', PAD, y + 52);
      y += 64;

      // 3 casas de referência lado a lado
      for (let i = 0; i < 3; i++) {
        const x = PAD + i * (casaW + GAP);
        ctx.fillStyle = '#dce4f0';
        ctx.font = '600 15px sans-serif';
        ctx.fillText(vila[i]!.titulo, x, y + 22);

        const img = imgsVila[i]!;
        const escala = Math.min(casaW / img.width, casaH / img.height);
        const dw = Math.round(img.width * escala);
        const dh = Math.round(img.height * escala);
        ctx.fillStyle = '#151a22';
        ctx.fillRect(x, y + TITULO_H, casaW, casaH);
        ctx.drawImage(img, x + Math.round((casaW - dw) / 2), y + TITULO_H + Math.round((casaH - dh) / 2), dw, dh);
        ctx.strokeStyle = '#2a3342';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y + TITULO_H, casaW, casaH);
      }
      y += TITULO_H + casaH + GAP;

      // Vista geral da vila
      ctx.fillStyle = '#dce4f0';
      ctx.font = '600 16px sans-serif';
      ctx.fillText(vila[3]!.titulo, PAD, y + 22);
      const imgGeral = imgsVila[3]!;
      const escalaGeral = Math.min(geralW / imgGeral.width, geralH / imgGeral.height);
      const gdw = Math.round(imgGeral.width * escalaGeral);
      const gdh = Math.round(imgGeral.height * escalaGeral);
      ctx.fillStyle = '#151a22';
      ctx.fillRect(PAD, y + TITULO_H, geralW, geralH);
      ctx.drawImage(imgGeral, PAD + Math.round((geralW - gdw) / 2), y + TITULO_H + Math.round((geralH - gdh) / 2), gdw, gdh);
      ctx.strokeStyle = '#2a3342';
      ctx.lineWidth = 2;
      ctx.strokeRect(PAD, y + TITULO_H, geralW, geralH);
      y += TITULO_H + geralH + GAP * 1.5;

      // 6 faixas dos 33 estilos
      for (let idx = 0; idx < grade.length; idx++) {
        const g = grade[idx]!;
        const img = imgsGrade[idx]!;
        ctx.fillStyle = '#e7eef8';
        ctx.font = '600 17px sans-serif';
        ctx.fillText(g.titulo, PAD, y + 23);

        ctx.drawImage(img, PAD, y + TITULO_H, INNER, faixaH);
        ctx.strokeStyle = '#2a3342';
        ctx.lineWidth = 2;
        ctx.strokeRect(PAD, y + TITULO_H, INNER, faixaH);

        // Rótulos discretos dos 33 estilos na primeira faixa (e na terceira/quinta) para referência rápida
        if (idx === 0 && g.rotulos) {
          const passoPxX = INNER / (colunas * 4 + 1);
          const passoPxY = faixaH / (linhas * 4 + 1);
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          g.rotulos.forEach((nome, n) => {
            const col = n % colunas;
            const row = Math.floor(n / colunas);
            const cx = PAD + (1 + col * 4 + 1.5) * passoPxX;
            const cy = y + TITULO_H + (1 + row * 4 + 3.55) * passoPxY;
            const tw = ctx.measureText(nome).width + 8;
            ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
            ctx.fillRect(cx - tw / 2, cy - 11, tw, 15);
            ctx.fillStyle = '#f2ede4';
            ctx.fillText(nome, cx, cy);
          });
          ctx.textAlign = 'left';
        }

        y += TITULO_H + faixaH + GAP;
      }

      return canvas.toDataURL('image/png');
    },
    { vila: capturasVila, grade: capturasGrade, colunas: COLUNAS, linhas: LINHAS },
  );

  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, Buffer.from(pngDataUrl.split(',')[1]!, 'base64'));
  console.log(`Prancha gravada em ${SAIDA}`);
} finally {
  await encerrar(ambiente);
}
