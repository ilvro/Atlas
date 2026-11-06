import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatarCronometro,
  avancarHorario,
  carregarContador,
  salvarContador,
  chaveContador,
  CONTADOR_PADRAO,
  estadoCronometro,
} from '../../src/domain/relogio.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { ceuNoHorario } from '../../src/domain/clima.ts';

test('formatarCronometro: formata segundos em MM:SS ou HH:MM:SS', () => {
  assert.equal(formatarCronometro(0), '00:00');
  assert.equal(formatarCronometro(5), '00:05');
  assert.equal(formatarCronometro(59), '00:59');
  assert.equal(formatarCronometro(60), '01:00');
  assert.equal(formatarCronometro(65), '01:05');
  assert.equal(formatarCronometro(3599), '59:59');
  assert.equal(formatarCronometro(3600), '01:00:00');
  assert.equal(formatarCronometro(3661), '01:01:01');
  assert.equal(formatarCronometro(7325), '02:02:05');
  // Valores negativos ou decimais
  assert.equal(formatarCronometro(-10), '00:00');
  assert.equal(formatarCronometro(65.8), '01:05');
});

test('avancarHorario: soma minutos com rotação de 24 horas', () => {
  assert.equal(avancarHorario('14:30', 15), '14:45');
  assert.equal(avancarHorario('14:30', 60), '15:30');
  assert.equal(avancarHorario('23:45', 30), '00:15');
  assert.equal(avancarHorario('23:30', 60), '00:30');
  assert.equal(avancarHorario('00:00', 15), '00:15');
  assert.equal(avancarHorario('00:15', -30), '23:45');
  assert.equal(avancarHorario('01:00', -120), '23:00');
  // Tratamento de formato inválido
  assert.equal(avancarHorario('', 15), '12:15');
  assert.equal(avancarHorario('invalido', 30), '12:30');
});

test('carregarContador e salvarContador: persistência em storage', () => {
  const mockStorage: Record<string, string> = {};
  const storage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
  };

  const mapaId = 'mapa-teste-1';
  assert.equal(chaveContador(mapaId), 'atlas:contador:mapa-teste-1');

  // Inicial: retorna padrão
  const inicial = carregarContador(mapaId, storage);
  assert.deepEqual(inicial, CONTADOR_PADRAO);

  // Salvar novo valor
  salvarContador(mapaId, { rotulo: 'Pavor', valor: 4 }, storage);
  const carregado = carregarContador(mapaId, storage);
  assert.deepEqual(carregado, { rotulo: 'Pavor', valor: 4 });

  // Outro mapa mantém isolamento
  const outroMapa = carregarContador('mapa-teste-2', storage);
  assert.deepEqual(outroMapa, CONTADOR_PADRAO);

  // Valor inválido/corrompido no JSON retorna padrão
  storage.setItem(chaveContador('mapa-corrompido'), '{ bad json');
  const corrompido = carregarContador('mapa-corrompido', storage);
  assert.deepEqual(corrompido, CONTADOR_PADRAO);

  // Valores negativos são limitados a 0
  storage.setItem(chaveContador('mapa-negativo'), JSON.stringify({ rotulo: 'Tensão', valor: -5 }));
  const negativo = carregarContador('mapa-negativo', storage);
  assert.equal(negativo.valor, 0);
});

test('integração com Store: avançar horário atualiza o clima do mapa e a posição do sol/lua', () => {
  const mapa = criarMapa({ id: 'mapa-tempo', agora: 1 });
  mapa.climate.time = '14:30';
  const store = criarStore(mapa);

  // Avança 15 minutos via comando do widget
  const novo15 = avancarHorario(store.documento.climate.time, 15);
  store.executar({ tipo: 'clima.aplicar', patch: { time: novo15 } }, { rotulo: 'Avançar 15 min' });
  assert.equal(store.documento.climate.time, '14:45');
  assert.equal(store.documento.climate.sun?.angle, ceuNoHorario('14:45').sun.angle);

  // Avança 1 hora (60 minutos)
  const novo60 = avancarHorario(store.documento.climate.time, 60);
  store.executar({ tipo: 'clima.aplicar', patch: { time: novo60 } }, { rotulo: 'Avançar 1 hora' });
  assert.equal(store.documento.climate.time, '15:45');

  // Avança até a noite (ex: 23:45 + 30m -> 00:15)
  store.executar({ tipo: 'clima.aplicar', patch: { time: '23:45' } }, { rotulo: 'Noite' });
  const meiaNoite = avancarHorario(store.documento.climate.time, 30);
  store.executar({ tipo: 'clima.aplicar', patch: { time: meiaNoite } }, { rotulo: 'Meia noite' });
  assert.equal(store.documento.climate.time, '00:15');
  assert.equal(ceuNoHorario(store.documento.climate.time).noite, true);
});

test('estadoCronometro: inicia, avança segundos e zera sem afetar histórico da store', () => {
  estadoCronometro.value = { segundos: 0, rodando: false };

  // Iniciar cronômetro
  estadoCronometro.value = { segundos: 0, rodando: true };
  assert.equal(estadoCronometro.value.rodando, true);

  // Tique de segundos
  estadoCronometro.value = { segundos: 125, rodando: true };
  assert.equal(formatarCronometro(estadoCronometro.value.segundos), '02:05');

  // Pausar
  estadoCronometro.value = { ...estadoCronometro.value, rodando: false };
  assert.equal(estadoCronometro.value.segundos, 125);
  assert.equal(estadoCronometro.value.rodando, false);

  // Zerar
  estadoCronometro.value = { segundos: 0, rodando: false };
  assert.equal(estadoCronometro.value.segundos, 0);
  assert.equal(formatarCronometro(estadoCronometro.value.segundos), '00:00');
});
