import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBarramento, criarRef, type Barramento, type Evento } from '#mesa';
import { pedirSomDoClima } from '../../src/app/audio-do-clima.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { PRESETS_DE_CLIMA, presetDeClima } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeComando, aplicarComando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';

const brilho = (a: { color: string; intensity: number }) => [1, 3, 5].reduce((s, i) => s + parseInt(a.color.slice(i, i + 2), 16) / 255 * a.intensity, 0);
const novo = () => criarMapa({ id: 'm', agora: 1 });

test('são nove climas, todos válidos, com identificadores únicos e o apelido "dia"', () => {
  assert.deepEqual(PRESETS_DE_CLIMA.map(p => p.id), ['manha', 'tarde', 'entardecer', 'noite', 'tempestade', 'neblina', 'neve', 'apagao', 'neon']);
  assert.equal(new Set(PRESETS_DE_CLIMA.map(p => p.id)).size, 9);
  assert.equal(presetDeClima('dia')!.id, 'tarde'); assert.equal(presetDeClima('inexistente'), undefined);
  for (const p of PRESETS_DE_CLIMA) {
    const m = aplicarComando(novo(), { tipo: 'clima.predefinir', id: p.id });
    validarMapa(m);
    assert.equal(m.climate.preset, p.id, p.id); assert.equal(m.finish.preset, p.finish.preset, p.id);
    assert.deepEqual(m.climate.weather, p.climate.weather);
  }
});

test('cada clima parece outro momento: luz, tempo e energia', () => {
  const por = (id: string) => presetDeClima(id)!.climate;
  assert.ok(brilho(por('tarde').ambient) > brilho(por('noite').ambient) * 3, 'a tarde é bem mais clara que a noite');
  assert.ok(brilho(por('noite').ambient) > brilho(por('apagao').ambient), 'o apagão é o mais escuro');
  assert.equal(por('apagao').gridPower, false); assert.ok(PRESETS_DE_CLIMA.filter(p => p.id !== 'apagao').every(p => p.climate.gridPower));
  assert.equal(por('tempestade').weather.rain, 1); assert.ok(por('tempestade').weather.lightning > 0 && por('tempestade').weather.wind !== 0);
  assert.ok(por('neve').weather.snow > 0.5 && por('neblina').weather.fog > 0.5);
  assert.equal(por('manha').weather.rain, 0);
  assert.equal(por('noite').sun!.color, '#9fb3e8', 'à noite a luz do céu é a da lua');
  assert.ok(presetDeClima('neon')!.finish.saturation > 1.3 && presetDeClima('tempestade')!.finish.saturation < 0.7);
});

test('aplicar um clima é UMA entrada de histórico e desfazer volta ao clima anterior', () => {
  const st = criarStore(novo()), antes = JSON.stringify([st.documento.climate, st.documento.finish]);
  st.executar({ tipo: 'clima.predefinir', id: 'tempestade' }, { rotulo: 'Clima: Tempestade' });
  assert.equal(st.documento.climate.preset, 'tempestade'); assert.equal(st.historico.length, 1); assert.equal(st.historico[0], 'Clima: Tempestade');
  st.desfazer(); assert.equal(JSON.stringify([st.documento.climate, st.documento.finish]), antes);
  st.refazer(); assert.equal(st.documento.climate.weather.rain, 1);
});

test('clima desconhecido lança ErroDeComando e não muda nada', () => {
  const m = novo();
  assert.throws(() => aplicarComando(m, { tipo: 'clima.predefinir', id: 'chuva-de-sapos' }), (e: unknown) => e instanceof ErroDeComando && /desconhecido/.test(e.message));
  assert.throws(() => aplicarComando(m, { tipo: 'clima.esquecer', id: 'nao-existe' }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'clima.salvar', nome: '   ' }), ErroDeComando);
});

test('salvar o clima atual e depois aplicá-lo restaura exatamente os valores', () => {
  let m = aplicarComando(novo(), { tipo: 'clima.predefinir', id: 'neblina' });
  m = aplicarComando(m, { tipo: 'clima.aplicar', patch: { weather: { fog: 0.4, rain: 0.2 }, time: '06:45' } });
  m = aplicarComando(m, { tipo: 'acabamento.atualizar', patch: { grain: 0.2 } });
  const alvo = { clima: structuredClone(m.climate), acabamento: structuredClone(m.finish) };
  m = aplicarComando(m, { tipo: 'clima.salvar', nome: 'Madrugada molhada', id: 'usuario-madrugada' });
  assert.equal(m.customClimates['usuario-madrugada']!.name, 'Madrugada molhada'); validarMapa(m);
  m = aplicarComando(m, { tipo: 'clima.predefinir', id: 'apagao' }); assert.equal(m.climate.gridPower, false);
  m = aplicarComando(m, { tipo: 'clima.predefinir', id: 'usuario-madrugada' });
  assert.equal(m.climate.preset, 'usuario-madrugada');
  const { preset: _a, ...climaSemPreset } = alvo.clima, { preset: _b, ...climaAtual } = m.climate;
  assert.deepEqual(climaAtual, climaSemPreset);
  const { preset: _c, ...acabSemPreset } = alvo.acabamento, { preset: _d, ...acabAtual } = m.finish;
  assert.deepEqual(acabAtual, acabSemPreset); assert.equal(m.finish.grain, 0.2);
  // O id é gerado quando não vem no comando.
  const outro = aplicarComando(m, { tipo: 'clima.salvar', nome: 'Outro' });
  assert.equal(Object.keys(outro.customClimates).length, 2); assert.ok(Object.keys(outro.customClimates).every(k => /^(usuario-.+)$/.test(k)));
  assert.throws(() => aplicarComando(m, { tipo: 'clima.salvar', nome: 'Repetido', id: 'usuario-madrugada' }), ErroDeComando);
});

test('esquecer um clima salvo também solta o áudio dele', () => {
  let m = aplicarComando(novo(), { tipo: 'clima.salvar', nome: 'X', id: 'usuario-x' });
  m = aplicarComando(m, { tipo: 'clima.salvar', nome: 'Y', id: 'usuario-y' });
  m = structuredClone(m); m.climateAudio['usuario-x'] = criarRef('jukebox', 'cena-sonora', 'a'); m.climateAudio.tempestade = criarRef('jukebox', 'cena-sonora', 'b');
  const depois = aplicarComando(m, { tipo: 'clima.esquecer', id: 'usuario-x' });
  assert.deepEqual(Object.keys(depois.customClimates), ['usuario-y']); assert.deepEqual(Object.keys(depois.climateAudio), ['tempestade']);
});

test('mexer no horário move o sol e o ambiente, a menos que o comando diga como ficam', () => {
  const noite = aplicarComando(novo(), { tipo: 'clima.aplicar', patch: { time: '23:00' } });
  assert.equal(noite.climate.sun!.color, '#9fb3e8'); assert.ok(brilho(noite.climate.ambient) < 0.5);
  const meioDia = aplicarComando(noite, { tipo: 'clima.aplicar', patch: { time: '12:00' } });
  assert.ok(meioDia.climate.sun!.intensity > 0.95 && brilho(meioDia.climate.ambient) > brilho(noite.climate.ambient) * 3);
  const escolhido = aplicarComando(novo(), { tipo: 'clima.aplicar', patch: { time: '23:00', sun: null, ambient: { color: '#102030', intensity: 0.5 } } });
  assert.equal(escolhido.climate.sun, null); assert.equal(escolhido.climate.ambient.color, '#102030');
  const semHorario = aplicarComando(novo(), { tipo: 'clima.aplicar', patch: { weather: { rain: 1 } } });
  assert.deepEqual(semHorario.climate.sun, novo().climate.sun, 'sem mexer no horário, o céu fica como está');
  assert.throws(() => aplicarComando(novo(), { tipo: 'clima.aplicar', patch: { time: '25:99' } }), (e: unknown) => e instanceof ErroDeComando && /Horário inválido/.test(e.message));
});

// ---------- Áudio do clima (4.7a) ----------
const chuva = criarRef('jukebox', 'cena-sonora', 'chuva');

test('clima.audio grava e remove a cena do clima (predefinido ou salvo), valida o alvo e desfaz', () => {
  const store = criarStore(novo());
  store.executar({ tipo: 'clima.audio', id: 'tempestade', ref: chuva });
  assert.deepEqual(store.documento.climateAudio.tempestade, chuva); validarMapa(store.documento);
  store.executar({ tipo: 'clima.audio', id: 'dia', ref: chuva });               // apelido de "tarde"
  assert.deepEqual(store.documento.climateAudio.tarde, chuva);
  store.executar({ tipo: 'clima.audio', id: 'tempestade', ref: null });
  assert.equal(store.documento.climateAudio.tempestade, undefined);
  store.desfazer(); assert.deepEqual(store.documento.climateAudio.tempestade, chuva);
  assert.throws(() => store.executar({ tipo: 'clima.audio', id: 'nao-existe', ref: chuva }), ErroDeComando);
  store.executar({ tipo: 'clima.salvar', nome: 'Meu' });
  const salvo = Object.keys(store.documento.customClimates)[0]!;
  store.executar({ tipo: 'clima.audio', id: salvo, ref: chuva });
  store.executar({ tipo: 'clima.esquecer', id: salvo });
  assert.equal(store.documento.climateAudio[salvo], undefined);
});

test('trocar de clima pede ao Jukebox a cena daquele clima; sem cena, outro mapa ou mesmo clima, nada', async () => {
  const atlas = criarBarramento({ app: 'atlas', aviso: () => {} }), jukebox = criarBarramento({ app: 'jukebox', aviso: () => {} });
  const pedidos: Evento[] = []; jukebox.atender('jukebox.tocar', (_d, e) => { pedidos.push(e); return { ok: true }; });
  try {
    const store = criarStore(novo()); store.executar({ tipo: 'clima.audio', id: 'tempestade', ref: chuva });
    const antes = store.documento; store.executar({ tipo: 'clima.predefinir', id: 'tempestade' });
    assert.equal(pedirSomDoClima(antes, store.documento, atlas as Barramento), true);
    for (let i = 0; i < 20 && pedidos.length === 0; i++) await new Promise(r => setTimeout(r, 20));
    assert.equal(pedidos.length, 1); assert.deepEqual((pedidos[0]!.dados as { ref: unknown }).ref, chuva);
    const noite = store.documento; store.executar({ tipo: 'clima.predefinir', id: 'noite' });
    assert.equal(pedirSomDoClima(noite, store.documento, atlas), false, 'noite não tem cena');
    assert.equal(pedirSomDoClima(store.documento, store.documento, atlas), false, 'mesmo clima');
    assert.equal(pedirSomDoClima({ ...antes, id: 'outro' }, store.documento, atlas), false, 'outro mapa');
    assert.equal(pedirSomDoClima(antes, store.documento, null), false, 'sem barramento');
    await new Promise(r => setTimeout(r, 40)); assert.equal(pedidos.length, 1);
  } finally { atlas.fechar(); jukebox.fechar(); }
});
