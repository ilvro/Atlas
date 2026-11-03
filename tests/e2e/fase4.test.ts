import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Sessao = { store: { executar(c: unknown): void; documento: { lights: Record<string, { id: string }>; openings: Record<string, { id: string }> } }; pincel: { value: Record<string, unknown> } };
const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(120); }
async function retangulo(p: Page, a: [number, number], b: [number, number]) {
  const [ax, ay] = await clientDe(p, a), [bx, by] = await clientDe(p, b);
  await p.keyboard.down('Shift'); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift');
}
/** O brilho médio (0 a 255) de um retângulo do mundo, lido dos pixels da tela. */
async function brilho(p: Page, a: [number, number], b: [number, number]): Promise<number> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({ clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) } });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data; let soma = 0;
    for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    return soma / (d.length / 4);
  }, png.toString('base64'));
}
const escurecer = (p: Page) => sessao(p, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { ambient: { color: "#5a6090", intensity: 0.25 } } })');

test('luz com sombras: a porta fechada segura a luz, aberta a deixa passar, e desligar a atmosfera clareia o mapa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]); await retangulo(page, [15.75, 6.75], [20.25, 12.75]);
  await ferramenta(page, 'abertura'); await clicar(page, [15, 9]);
  await ferramenta(page, 'luz'); await clicar(page, [12.75, 9.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await escurecer(page);
  await sessao(page, '(s) => { const l = Object.values(s.store.documento.lights)[0]; s.store.executar({ tipo: "item.atualizar", colecao: "lights", id: l.id, patch: { radius: 9, intensity: 1, color: "#ffd9a0", flicker: 0 } }); }');
  await page.waitForTimeout(900);
  const vizinho: [[number, number], [number, number]] = [[16.5, 7.5], [19.5, 12]], proprio: [[number, number], [number, number]] = [[7.5, 7.5], [11, 12]];
  const fechada = await brilho(page, ...vizinho), propria = await brilho(page, ...proprio);
  assert.ok(propria > fechada * 2.5, `o cômodo da luz (${propria.toFixed(1)}) é bem mais claro que o vizinho (${fechada.toFixed(1)})`);

  await sessao(page, '(s) => { const o = Object.values(s.store.documento.openings)[0]; s.store.executar({ tipo: "abertura.atualizar", id: o.id, patch: { state: "open" } }); }');
  await page.waitForTimeout(700);
  const aberta = await brilho(page, ...vizinho);
  assert.ok(aberta > fechada * 1.5, `porta aberta: o vizinho clareia (${fechada.toFixed(1)} → ${aberta.toFixed(1)})`);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...vizinho) < aberta * 0.75, 'desfazer fecha a porta e a sombra volta');

  // O botão "Ver atmosfera no editor" só vale para quem edita: desligado, o mapa aparece claro.
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...vizinho) > aberta * 1.5, 'sem atmosfera o mapa não escurece');
  assert.equal((await documento(page)).climate.ambient.intensity, 0.25, 'e o documento não mudou');
  assert.deepEqual(erros, []); await ctx.close();
});

test('janelas: o sol entra por elas de dia e a lua, de leve, à noite; sem sol, nada entra', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 14.25]);
  await page.evaluate(() => { const s = (window as unknown as { __atlas: { sessao(): Sessao } }).__atlas.sessao(); s.pincel.value = { ...s.pincel.value, abertura: { tipo: 'window' } }; });
  await ferramenta(page, 'abertura'); await clicar(page, [10.5, 6.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { ambient: { color: "#5a6090", intensity: 0.2 }, time: "10:00", sun: { angle: 0.8, color: "#fff2d6", intensity: 1 } } })');
  await page.waitForTimeout(900);
  const area: [[number, number], [number, number]] = [[7.5, 7.2], [13.5, 11]];
  const dia = await brilho(page, ...area);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { sun: { angle: 1, color: "#9fb3e8", intensity: 0.3 } } })');
  await page.waitForTimeout(700);
  const noite = await brilho(page, ...area);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { sun: null } })');
  await page.waitForTimeout(700);
  const semSol = await brilho(page, ...area);
  assert.ok(dia > noite * 1.5 && noite > semSol, `dia ${dia.toFixed(1)} > noite ${noite.toFixed(1)} > sem sol ${semSol.toFixed(1)}`);
  assert.equal(Object.keys((await documento(page)).lights).length, 0, 'a luz da janela é derivada: não vai para o documento');
  assert.deepEqual(erros, []); await ctx.close();
});

const historicoDe = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { sessao(): { store: { historico: string[] } } } }).__atlas.sessao().store.historico.slice());
async function soltarFoco(p: Page) { await p.waitForFunction(() => document.activeElement?.id === 'nome-do-mapa'); await p.evaluate(() => (document.activeElement as HTMLElement).blur()); }

test('seletor de clima: chips, paleta, Alt+número, ajustes finos, clima salvo e histórico', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await soltarFoco(page);
  await page.click('[data-testid="aba-mapa"]');

  // Chip: uma entrada de histórico com o nome do clima, e desfazer volta ao anterior.
  const antes = (await documento(page)).climate;
  await page.click('[data-testid="clima-noite"]');
  let m = await documento(page);
  assert.equal(m.climate.preset, 'noite'); assert.equal(m.climate.sun!.color, '#9fb3e8'); assert.equal(m.finish.preset, 'frio');
  assert.equal((await historicoDe(page)).at(-1), 'Clima: Noite');
  assert.equal(await page.locator('[data-testid="clima-noite"]').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Control+z');
  assert.deepEqual((await documento(page)).climate, antes);
  assert.equal(await page.locator('[data-testid="clima-noite"]').getAttribute('aria-pressed'), 'false');

  // Paleta de comandos: "tempest" acha o clima.
  await page.keyboard.press('Control+k');
  const campo = page.locator('[data-testid="paleta"] input'); await campo.waitFor(); await campo.fill('tempest');
  await page.locator('[role="option"]').first().filter({ hasText: /Clima: Tempestade/ }).waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as unknown as { __atlas: { sessao(): { doc: { value: { climate: { preset: string } } } } } }).__atlas.sessao().doc.value.climate.preset === 'tempestade');
  m = await documento(page); assert.equal(m.climate.weather.rain, 1); assert.ok(m.climate.weather.lightning > 0);

  // Alt+4 é o quarto clima (Noite); Alt+1, a Manhã.
  await page.keyboard.press('Alt+4'); assert.equal((await documento(page)).climate.preset, 'noite');
  await page.keyboard.press('Alt+1'); assert.equal((await documento(page)).climate.preset, 'manha');

  // Ajustes finos: o horário move o sol; horário inválido é recusado e o campo volta.
  await page.fill('#horario-do-clima', '23:15'); await page.press('#horario-do-clima', 'Enter');
  await page.waitForFunction(() => (window as unknown as { __atlas: { sessao(): { doc: { value: { climate: { time: string } } } } } }).__atlas.sessao().doc.value.climate.time === '23:15');
  assert.equal((await documento(page)).climate.sun!.color, '#9fb3e8');
  await page.fill('#horario-do-clima', '99:99'); await page.press('#horario-do-clima', 'Enter');
  await page.locator('[data-testid="toasts"] .toast', { hasText: /Horário inválido/ }).waitFor();
  assert.equal((await documento(page)).climate.time, '23:15');
  await page.fill('[data-testid="painel-mapa"] .linha:has-text("Chuva") input', '0.6'); await page.press('[data-testid="painel-mapa"] .linha:has-text("Chuva") input', 'Enter');
  await page.waitForFunction(() => (window as unknown as { __atlas: { sessao(): { doc: { value: { climate: { weather: { rain: number } } } } } } }).__atlas.sessao().doc.value.climate.weather.rain === 0.6);
  await page.getByLabel('Energia da rede').uncheck(); assert.equal((await documento(page)).climate.gridPower, false);

  // Salvar este clima, trocar, voltar pelo chip salvo, esquecer.
  await page.click('[data-testid="salvar-clima"]'); await page.fill('[data-testid="nome-do-clima"]', 'Vigília'); await page.press('[data-testid="nome-do-clima"]', 'Enter');
  const [salvo] = Object.values((await documento(page)).customClimates); assert.equal(salvo!.name, 'Vigília');
  await page.click('[data-testid="clima-tarde"]'); assert.equal((await documento(page)).climate.gridPower, true);
  await page.click(`[data-testid="clima-${salvo!.id}"]`);
  m = await documento(page);
  assert.equal(m.climate.preset, salvo!.id); assert.equal(m.climate.time, '23:15'); assert.equal(m.climate.weather.rain, 0.6); assert.equal(m.climate.gridPower, false);

  // Sobrevive a gravar e recarregar (documento v3).
  await page.click('[data-testid="gravar"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="estado-gravacao"]')?.getAttribute('data-sujo') === 'false');
  await page.reload(); await page.waitForSelector('[data-testid="ferramenta-selecionar"]'); await page.click('[data-testid="aba-mapa"]');
  assert.equal((await documento(page)).version, 3); assert.equal((await documento(page)).climate.preset, salvo!.id);
  await page.click(`[data-testid="esquecer-${salvo!.id}"]`);
  assert.equal(Object.keys((await documento(page)).customClimates).length, 0);
  assert.deepEqual(erros.filter(e => !/Failed to load resource/.test(e)), []); await ctx.close();
});

// ---- 4.3: luzes que reagem ao clima, relâmpago e janelas acesas ----
/** Aplica o clima e espera a transição (1,6 s) terminar, para as medidas partirem do estado final. */
const aplicarClimaPor = async (p: Page, id: string) => { await sessao(p, `(s, id) => s.store.executar({ tipo: "clima.predefinir", id })`, id); await p.waitForTimeout(1800); };
const poluirLuz = (p: Page, itens: { id: string; x: number; y: number; power: string; color: string; radius?: number }[]) => sessao(p, `(s, itens) => { for (const i of itens) s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: { id: i.id, position: [i.x, i.y], radius: i.radius ?? 7, color: i.color, intensity: 1, flicker: 0, cone: null, ownerId: null, power: i.power, on: true, nightOnly: false, preset: null } }); }`, itens);

test('apagão: as lâmpadas de rede piscam e apagam; a vela continua acesa; voltar a energia religa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]); await retangulo(page, [15.75, 6.75], [20.25, 12.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await aplicarClimaPor(page, 'noite');
  await poluirLuz(page, [{ id: 'lampada', x: 10.5, y: 9.75, power: 'grid', color: '#fff3d0', radius: 8 }, { id: 'vela', x: 18, y: 9.75, power: 'fire', color: '#ffb36b', radius: 8 }]);
  await page.waitForTimeout(900);
  const salaDaLampada: [[number, number], [number, number]] = [[7.5, 7.5], [13.5, 12]], salaDaVela: [[number, number], [number, number]] = [[16.5, 7.5], [19.5, 12]];
  const [lampada0, vela0] = [await brilho(page, ...salaDaLampada), await brilho(page, ...salaDaVela)];
  assert.ok(lampada0 > 12 && vela0 > 12, `as duas salas estão acesas (${lampada0.toFixed(1)}, ${vela0.toFixed(1)})`);

  await aplicarClimaPor(page, 'apagao');
  await page.waitForTimeout(1800);                                     // passa o piscar de 1,1 s
  const [lampada1, vela1] = [await brilho(page, ...salaDaLampada), await brilho(page, ...salaDaVela)];
  assert.ok(lampada1 < lampada0 * 0.45, `a lâmpada apagou (${lampada0.toFixed(1)} → ${lampada1.toFixed(1)})`);
  assert.ok(vela1 > vela0 * 0.5, `a vela segue acesa (${vela0.toFixed(1)} → ${vela1.toFixed(1)})`);

  await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  assert.ok(await brilho(page, ...salaDaLampada) > lampada1 * 2, 'desfazer religa a lâmpada');
  assert.deepEqual(erros, []); await ctx.close();
});

test('relâmpago: o clarão entra pela janela e o trovão vem depois; sem atmosfera, nada acontece', async () => {
  const ctx = await novoContexto(amb);
  await ctx.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>; w.__trovoes = 0;
    const no = (extra: Record<string, unknown> = {}) => ({ connect: (x: unknown) => x, start() {}, stop() {}, ...extra });
    class FalsoAudio {
      state = 'running'; sampleRate = 8000; currentTime = 0; destination = {};
      resume() { return Promise.resolve(); }
      createBuffer(_c: number, n: number) { return { getChannelData: () => new Float32Array(n) }; }
      createBufferSource() { return no({ start() { (window as unknown as { __trovoes: number }).__trovoes++; } }); }
      createBiquadFilter() { return no({ frequency: { value: 0 } }); }
      createGain() { return no({ gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }); }
      createOscillator() { return no({ frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }); }
    }
    w.AudioContext = FalsoAudio;
  });
  const { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 14.25]);
  await page.evaluate(() => { const s = (window as unknown as { __atlas: { sessao(): Sessao } }).__atlas.sessao(); s.pincel.value = { ...s.pincel.value, abertura: { tipo: 'window' } }; });
  await ferramenta(page, 'abertura'); await clicar(page, [10.5, 6.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await aplicarClimaPor(page, 'noite');
  await page.waitForTimeout(800);
  const sala: [[number, number], [number, number]] = [[7.5, 7.5], [13.5, 11]];
  const parado = await brilho(page, ...sala);
  assert.equal(await page.evaluate(() => (window as unknown as { __trovoes: number }).__trovoes), 0);

  // A ação da paleta dispara o relâmpago; amostra vários quadros: o mais claro tem de passar bem do parado.
  const disparar = async () => { await page.keyboard.press('Control+k'); const campo = page.locator('[data-testid="paleta"] input'); await campo.waitFor(); await campo.fill('relampago agora'); await page.keyboard.press('Enter'); };
  await disparar();
  let pico = 0; for (let i = 0; i < 8; i++) { pico = Math.max(pico, await brilho(page, ...sala)); await page.waitForTimeout(30); }
  assert.ok(pico > parado * 1.4, `o clarão clareia a sala (${parado.toFixed(1)} → ${pico.toFixed(1)})`);
  await page.waitForFunction(() => (window as unknown as { __trovoes: number }).__trovoes === 1, null, { timeout: 4000 });
  await page.waitForTimeout(700);
  assert.ok(Math.abs(await brilho(page, ...sala) - parado) < parado * 0.25 + 2, 'depois do clarão a sala volta ao normal');

  // Sem atmosfera no editor, o relâmpago não dispara (nem o trovão).
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck();
  await disparar(); await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(() => (window as unknown as { __trovoes: number }).__trovoes), 1);
  assert.deepEqual(erros, []); await ctx.close();
});

test('janelas acesas à noite: a luz de dentro sai pela janela e a luz apagada não conta', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 9.75], [14.25, 17.25]);
  await page.evaluate(() => { const s = (window as unknown as { __atlas: { sessao(): Sessao } }).__atlas.sessao(); s.pincel.value = { ...s.pincel.value, abertura: { tipo: 'window' } }; });
  await ferramenta(page, 'abertura'); await clicar(page, [10.5, 9.75]);                 // janela no topo (y = 9), voltada para o norte
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "terreno.base", material: "grama" })');         // a luz multiplica a cena: precisa de chão do lado de fora
  await aplicarClimaPor(page, 'noite');
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { sun: null } })');      // sem lua: só o que vem de dentro
  const fora: [[number, number], [number, number]] = [[9.5, 6.2], [11.5, 8.6]];
  await page.waitForTimeout(800); const sem = await brilho(page, ...fora);
  await poluirLuz(page, [{ id: 'vela', x: 10.5, y: 13, power: 'fire', color: '#ffb36b', radius: 6 }]);
  await page.waitForTimeout(800); const com = await brilho(page, ...fora);
  assert.ok(com > sem + 3, `a janela acesa ilumina o lado de fora (${sem.toFixed(1)} → ${com.toFixed(1)})`);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.atualizar", colecao: "lights", id: "vela", patch: { on: false } })');
  await page.waitForTimeout(800); assert.ok(await brilho(page, ...fora) < com - 2, 'luz apagada: a janela escurece');
  assert.deepEqual(erros, []); await ctx.close();
});

// ---- 4.4: partículas e neblina ----
const tempoDe = (p: Page, w: Record<string, number>) => sessao(p, `(s, w) => s.store.executar({ tipo: "clima.aplicar", patch: { weather: { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0, ...w } } })`, w);
type Contagem = Record<'chuva' | 'neve' | 'poeira' | 'brasa' | 'folha', number>;
const contagem = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDeParticulas(): Record<string, number> } } }).__atlas.viewport().contagemDeParticulas()) as Promise<Contagem>;
async function casaNoGramado(p: Page) {
  await criarMapaPelaInterface(p);
  await ferramenta(p, 'comodo'); await retangulo(p, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(p, 'selecionar'); await clicar(p, [35, 25]);
  await sessao(p, '(s) => s.store.executar({ tipo: "terreno.base", material: "grama" })');
  await aplicarClimaPor(p, 'tarde');
}
const DENTRO: [[number, number], [number, number]] = [[7.5, 7.5], [13.5, 12]], FORA: [[number, number], [number, number]] = [[16, 6], [24, 14]];

test('chuva: cai no terreno e não dentro da casa; a quantidade acompanha a intensidade; sem atmosfera, some', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await casaNoGramado(page); await page.waitForTimeout(700);
  assert.equal((await contagem(page)).chuva, 0);
  const [fora0, dentro0] = [await brilho(page, ...FORA), await brilho(page, ...DENTRO)];
  await tempoDe(page, { rain: 1, wind: 0.5 }); await page.waitForTimeout(900);
  assert.equal((await contagem(page)).chuva, 2970, 'mapa 45 × 30 m, chuva 1');
  const [fora1, dentro1] = [await brilho(page, ...FORA), await brilho(page, ...DENTRO)];
  assert.ok(fora1 > fora0 + 0.6, `os traços de chuva aparecem no terreno (${fora0.toFixed(1)} → ${fora1.toFixed(1)})`);
  assert.ok(Math.abs(dentro1 - dentro0) < 1, `e não dentro da casa (${dentro0.toFixed(1)} → ${dentro1.toFixed(1)})`);
  await tempoDe(page, { rain: 0.5 }); await page.waitForTimeout(300);
  assert.equal((await contagem(page)).chuva, 1485);
  await tempoDe(page, { rain: 1 }); await page.waitForTimeout(500);
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.waitForTimeout(700);
  // Sem atmosfera o mapa nem escurece pelo ambiente; o que importa é que chover ou não chover dê no mesmo.
  const comChuvaSemAtmosfera = await brilho(page, ...FORA); await tempoDe(page, {}); await page.waitForTimeout(400);
  assert.ok(Math.abs(comChuvaSemAtmosfera - await brilho(page, ...FORA)) < 0.5, 'sem atmosfera no editor não chove');
  await tempoDe(page, { rain: 1 }); await page.waitForTimeout(300);
  await page.getByLabel('Ver atmosfera no editor').check(); await tempoDe(page, {}); await page.waitForTimeout(400);
  assert.equal((await contagem(page)).chuva, 0);
  assert.deepEqual(erros, []); await ctx.close();
});

test('cada controle liga o seu tipo: neve, folhas, poeira só dentro dos cômodos, brasas junto às luzes de fogo', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await casaNoGramado(page);
  await tempoDe(page, { snow: 1 }); await page.waitForTimeout(400);
  let c = await contagem(page); assert.equal(c.neve, 1350); assert.equal(c.chuva + c.folha + c.poeira + c.brasa, 0);
  await tempoDe(page, { leaves: 1 }); await page.waitForTimeout(300);
  c = await contagem(page); assert.equal(c.folha, 135); assert.equal(c.neve, 0);
  await tempoDe(page, { dust: 1 }); await page.waitForTimeout(300);
  const m = await documento(page), areaDaCasa = Object.values(m.rooms).reduce((t, r) => t + r.cells.reduce((u, [, , n]) => u + n * m.grid.size ** 2, 0), 0);
  c = await contagem(page); assert.equal(c.poeira, Math.ceil(0.9 * areaDaCasa - 1e-9), 'poeira proporcional à área dos cômodos');
  assert.ok(c.poeira > 0 && c.poeira < 200, `a poeira conta só a área da casa, não a do mapa (${c.poeira})`);
  await tempoDe(page, { embers: 1 }); await page.waitForTimeout(300);
  assert.equal((await contagem(page)).brasa, Math.ceil(0.04 * 45 * 30), 'sem luz de fogo, brasas soltas pelo mapa');
  await sessao(page, '(s) => s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: { id: "tocha", position: [10, 9], radius: 6, color: "#ffb36b", intensity: 1, flicker: 0.2, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "tocha" } })');
  await page.waitForTimeout(300);
  assert.equal((await contagem(page)).brasa, 24, 'com uma luz de fogo, as brasas nascem dela');
  await tempoDe(page, {}); await page.waitForTimeout(300);
  c = await contagem(page); assert.equal(c.chuva + c.neve + c.poeira + c.brasa + c.folha, 0);
  assert.deepEqual(erros, []); await ctx.close();
});

test('neblina: cobre o terreno e entra menos na casa; some com fog 0 e sem atmosfera', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await casaNoGramado(page); await page.waitForTimeout(700);
  const [fora0, dentro0] = [await brilho(page, ...FORA), await brilho(page, ...DENTRO)];
  await tempoDe(page, { fog: 0.9 }); await page.waitForTimeout(900);
  const [fora1, dentro1] = [await brilho(page, ...FORA), await brilho(page, ...DENTRO)];
  assert.ok(fora1 > fora0 + 25, `a neblina clareia o terreno (${fora0.toFixed(1)} → ${fora1.toFixed(1)})`);
  assert.ok(dentro1 > dentro0 + 2 && (dentro1 - dentro0) < (fora1 - fora0), `e entra menos na casa (+${(dentro1 - dentro0).toFixed(1)} contra +${(fora1 - fora0).toFixed(1)})`);
  await page.waitForTimeout(1500); const depois = await brilho(page, ...FORA);
  assert.ok(Math.abs(depois - fora1) > 0.05, 'a neblina se move (o quadro mudou)');
  await tempoDe(page, { fog: 0 }); await page.waitForTimeout(500);
  assert.ok(Math.abs(await brilho(page, ...FORA) - fora0) < 3, 'fog 0: o terreno volta ao que era');
  await tempoDe(page, { fog: 0.9 }); await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.waitForTimeout(600);
  const comNeblinaSemAtmosfera = await brilho(page, ...FORA); await tempoDe(page, { fog: 0 }); await page.waitForTimeout(400);
  assert.ok(Math.abs(comNeblinaSemAtmosfera - await brilho(page, ...FORA)) < 3, 'sem atmosfera no editor não há neblina');
  assert.deepEqual(erros, []); await ctx.close();
});

test('transição: trocar de clima escurece aos poucos, e desfazer volta animando; ajuste fino não anima', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await casaNoGramado(page);
  const predefinir = (id: string) => sessao(page, '(s, id) => s.store.executar({ tipo: "clima.predefinir", id })', id);
  await predefinir('tarde'); await page.waitForTimeout(2200);
  const dia = await brilho(page, ...FORA);
  await predefinir('noite'); await page.waitForTimeout(100);
  const meio = await brilho(page, ...FORA);
  await page.waitForTimeout(2200);
  const noite = await brilho(page, ...FORA);
  assert.ok(noite < dia - 30, `a noite é bem mais escura (${dia.toFixed(1)} → ${noite.toFixed(1)})`);
  assert.ok(meio < dia - 1 && meio > noite + 3, `no meio da transição ainda está entre os dois (${meio.toFixed(1)})`);
  assert.equal((await documento(page)).climate.preset, 'noite', 'o documento já tinha mudado na hora');

  await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
  const voltando = await brilho(page, ...FORA);
  assert.ok(voltando > noite + 3 && voltando < dia - 3, `desfazer também anima (${voltando.toFixed(1)})`);
  await page.waitForTimeout(2200);
  assert.ok(Math.abs(await brilho(page, ...FORA) - dia) < 4, 'e termina no clima anterior');

  // Ajuste fino (o inspetor): vale já no quadro seguinte.
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { ambient: { color: "#000000", intensity: 0.05 } } })'); await page.waitForTimeout(150);
  assert.ok(await brilho(page, ...FORA) < dia - 30, 'o ajuste fino não espera a transição');
  assert.deepEqual(erros, []); await ctx.close();
});
