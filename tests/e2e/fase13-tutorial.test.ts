import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import {
  abrir,
  clientDe,
  documento,
  encerrar,
  iniciarAmbiente,
  novoContexto,
  type Ambiente,
} from './apoio.ts';
import { LICOES } from '../../src/tutorial/licoes.ts';
import type { Acao, Passo } from '../../src/tutorial/tutor.ts';

let amb: Ambiente;
before(async () => {
  amb = await iniciarAmbiente();
});
after(async () => {
  await encerrar(amb);
});

type TutorDoTeste = {
  info(): { id: string; indice: number; total: number } | null;
  passo(): { diga: string } | null;
  fim: { value: { concluida: boolean } | null };
  progresso(): Record<string, { done?: boolean; step?: number }>;
  relatorio(): { passos: Record<string, unknown> };
};

async function fazer(page: Page, a: Acao): Promise<void> {
  switch (a[0]) {
    case 'clicar': {
      const alvo = page.locator(a[1]).first();
      if (a[1].includes('dock-titulo-') && (await alvo.getAttribute('aria-expanded')) === 'true') break;
      await alvo.click({ timeout: 8000 });
      break;
    }
    case 'preencher': {
      const c = page.locator(a[1]).first();
      await c.fill(a[2]);
      await c.press('Enter');
      break;
    }
    case 'escolher': {
      await page.locator(a[1]).first().selectOption(a[2]);
      break;
    }
    case 'cor': {
      await page.locator(a[1]).first().evaluate((el, hex) => {
        const i = el as HTMLInputElement;
        i.value = hex as string;
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      }, a[2]);
      break;
    }
    case 'tecla': {
      await page.keyboard.press(a[1]);
      break;
    }
    case 'mapa': {
      const [x, y] = await clientDe(page, a[1]);
      await page.mouse.click(x, y);
      break;
    }
    case 'retangulo':
    case 'arrastar': {
      const [ax, ay] = await clientDe(page, a[1]),
        [bx, by] = await clientDe(page, a[2]);
      if (a[0] === 'retangulo') await page.keyboard.down('Shift');
      await page.mouse.move(ax, ay);
      await page.mouse.down();
      await page.mouse.move(bx, by, { steps: 8 });
      await page.mouse.up();
      if (a[0] === 'retangulo') await page.keyboard.up('Shift');
      break;
    }
  }
  await page.waitForTimeout(220);
}

const acoesDo = (p: Passo): Acao[] =>
  p.acao ? (Array.isArray(p.acao[0]) ? [...(p.acao as Acao[])] : [p.acao as Acao]) : [];

test('fase 13: lição "momentos" roda do começo ao fim e avança sozinha', async () => {
  const MOMENTOS = LICOES.find(l => l.id === 'momentos')!;
  const ctx = await novoContexto(amb, { viewport: { width: 1400, height: 900 } });
  const { page, erros } = await abrir(ctx, amb.url);

  // Inicia a lição "momentos"
  await page.evaluate(async () => {
    const caminho = '/src/app/tutoriais.ts';
    const m = await import(/* @vite-ignore */ caminho);
    await m.iniciarLicao('momentos');
  });

  await page.locator('[data-testid="tutor"]').waitFor({ timeout: 10_000 });

  const tutor = <T,>(fn: (t: TutorDoTeste) => T): Promise<T> =>
    page.evaluate(`(() => { const t = window.__atlas.tutor; return (${fn.toString()})(t); })()`) as Promise<T>;

  let i = 0;
  while (i < MOMENTOS.passos.length) {
    await page.waitForFunction(
      n => ((window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info()?.indice ?? 99) >= n,
      i,
      { timeout: 10_000 },
    ).catch(async e => {
      await page.screenshot({ path: `test-results/licao-momentos-timeout-${i + 1}.png` }).catch(() => undefined);
      throw new Error(`esperando o passo ${i + 1}: ${JSON.stringify(await tutor(t => t.info()))} ${String(e).slice(0, 80)} erros=${JSON.stringify(erros)}`);
    });

    i = (await tutor(t => t.info()?.indice)) ?? MOMENTOS.passos.length;
    if (i >= MOMENTOS.passos.length) break;

    const passo = MOMENTOS.passos[i]!;
    if (passo.feito[0] === 'ler') {
      await page.click('[data-testid="tutor-continuar"]');
      i++;
      continue;
    }

    await page.waitForTimeout(200);
    const ainda = await tutor(t => t.info()?.indice);
    if (ainda !== i) {
      i = ainda ?? MOMENTOS.passos.length;
      continue;
    }

    for (const a of acoesDo(passo)) {
      await fazer(page, a);
    }

    await page.waitForFunction(
      n => {
        const info = (window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info();
        return !info || info.indice > n;
      },
      i,
      { timeout: 10_000 },
    ).catch(async () => {
      await page.screenshot({ path: `test-results/licao-momentos-falhou-${i + 1}.png` }).catch(() => undefined);
      throw new Error(`o passo ${i + 1} (“${passo.diga}”) não terminou depois das ações`);
    });

    i++;
  }

  await page.locator('[data-testid="tutor-fim"]').waitFor({ timeout: 10_000 });
  const progresso = await page.evaluate(
    () => (window as unknown as { __atlas: { tutor: TutorDoTeste } }).__atlas.tutor.progresso()['momentos'],
  );
  assert.deepEqual(progresso, { done: true });
  assert.match((await page.locator('[data-testid="tutor-fim"]').textContent()) ?? '', /Concluído/);

  assert.deepEqual(erros, []);
  await ctx.close();
});
