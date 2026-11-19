/**
 * Mede o tempo de carregamento de mapas de exemplo (editor aberto, viewport pronto e custo de cada tipo de assado).
 *   npm run medir:carga -- porto-noturno gruta-dos-contrabandistas
 */
import { abrir, encerrar, esperarEditor, iniciarAmbiente, novoContexto } from '../../tests/e2e/apoio.ts';

interface AssadoMedido {
  tipo: string;
  ms: number;
  px: number;
}

interface ResumoPorTipo {
  tipo: string;
  n: number;
  somaMs: number;
  maiorMs: number;
  maiorPx: number;
}

interface ResultadoExemplo {
  id: string;
  editorMs: number;
  prontoMs: number;
  longtasksMs: number;
  longtasksN: number;
  assados: AssadoMedido[];
  erros: string[];
}

function resumirPorTipo(assados: readonly AssadoMedido[]): ResumoPorTipo[] {
  const porTipo = new Map<string, ResumoPorTipo>();
  for (const a of assados) {
    let item = porTipo.get(a.tipo);
    if (!item) {
      item = { tipo: a.tipo, n: 0, somaMs: 0, maiorMs: 0, maiorPx: 0 };
      porTipo.set(a.tipo, item);
    }
    item.n++;
    item.somaMs += a.ms;
    if (a.ms > item.maiorMs) item.maiorMs = a.ms;
    if (a.px > item.maiorPx) item.maiorPx = a.px;
  }
  return [...porTipo.values()].sort((a, b) => b.somaMs - a.somaMs);
}

async function medirExemplo(amb: Awaited<ReturnType<typeof iniciarAmbiente>>, id: string): Promise<ResultadoExemplo> {
  const ctx = await novoContexto(amb);
  try {
    await ctx.addInitScript(() => {
      const g = globalThis as unknown as {
        __atlasMedirAssados?: boolean;
        __atlasAssados?: AssadoMedido[];
        __atlasLongTasks?: number[];
        __atlasLongTaskObs?: PerformanceObserver;
      };
      g.__atlasMedirAssados = true;
      g.__atlasAssados = [];
      g.__atlasLongTasks = [];
      try {
        const obs = new PerformanceObserver(lista => {
          for (const entrada of lista.getEntries()) g.__atlasLongTasks!.push(entrada.duration);
        });
        obs.observe({ type: 'longtask', buffered: true });
        g.__atlasLongTaskObs = obs;
      } catch { /* navegador sem longtask */ }
    });

    const { page, erros } = await abrir(ctx, amb.url);
    const seletor = `[data-testid="usar-${id}"]`;
    await page.waitForSelector(seletor, { timeout: 20_000 });
    await page.evaluate(() => {
      const g = globalThis as unknown as {
        __atlasAssados?: AssadoMedido[];
        __atlasLongTasks?: number[];
        __atlasLongTaskObs?: PerformanceObserver;
      };
      g.__atlasAssados = [];
      g.__atlasLongTaskObs?.takeRecords();
      g.__atlasLongTasks = [];
    });

    const t0 = performance.now();
    await page.click(seletor);
    await esperarEditor(page);
    const editorMs = performance.now() - t0;

    await page.waitForFunction(
      () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
      null,
      { polling: 50, timeout: 120_000 },
    );
    const prontoMs = performance.now() - t0;

    const { assados, longtasks } = await page.evaluate(() => {
      const g = globalThis as unknown as {
        __atlasAssados?: AssadoMedido[];
        __atlasLongTasks?: number[];
        __atlasLongTaskObs?: PerformanceObserver;
      };
      for (const entrada of g.__atlasLongTaskObs?.takeRecords() ?? []) {
        (g.__atlasLongTasks ??= []).push(entrada.duration);
      }
      return { assados: g.__atlasAssados ?? [], longtasks: g.__atlasLongTasks ?? [] };
    });

    return {
      id,
      editorMs,
      prontoMs,
      longtasksMs: longtasks.reduce((acc, v) => acc + v, 0),
      longtasksN: longtasks.length,
      assados,
      erros,
    };
  } finally {
    await ctx.close();
  }
}

function imprimirResultado(r: ResultadoExemplo): void {
  console.log(
    `${r.id}: editor ${(r.editorMs / 1000).toFixed(2)} s | pronto ${(r.prontoMs / 1000).toFixed(2)} s | longtasks ${Math.round(r.longtasksMs)} ms (${r.longtasksN}) | assados ${r.assados.length}`,
  );
  const linhas = resumirPorTipo(r.assados);
  if (linhas.length > 0) {
    console.log('  tipo                  n    soma (ms)   maior (ms)  maior (Mpx)');
    for (const l of linhas) {
      console.log(
        `  ${l.tipo.padEnd(18)} ${String(l.n).padStart(4)} ${l.somaMs.toFixed(1).padStart(12)} ${l.maiorMs.toFixed(1).padStart(12)} ${(l.maiorPx / 1_000_000).toFixed(2).padStart(12)}`,
      );
    }
  }
  if (r.erros.length > 0) {
    console.error(`  erros (${r.erros.length}): ${r.erros.join('; ')}`);
  }
}

const args = process.argv.slice(2);
const exemplos = args.length > 0 ? args : ['porto-noturno', 'gruta-dos-contrabandistas'];

const amb = await iniciarAmbiente();
try {
  for (const id of exemplos) {
    const r = await medirExemplo(amb, id);
    imprimirResultado(r);
  }
} finally {
  await encerrar(amb);
}
