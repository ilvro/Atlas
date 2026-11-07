import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definirSom, silenciarNestaJanela, somPreferido, tocar, trovao } from '../../src/fx/som.ts';

test('som: preferências, silenciar na janela e chamadas seguras de tocar e trovao', () => {
  // Inicialmente ligado
  definirSom(true);
  assert.equal(somPreferido(), true);

  // Silenciar na janela
  silenciarNestaJanela();
  assert.equal(somPreferido(), false);

  // Reativar
  definirSom(true);
  assert.equal(somPreferido(), true);

  // Execuções em ambiente Node.js (sem Web Audio nativo) não devem lançar erro
  assert.doesNotThrow(() => {
    tocar('pop');
    tocar('porta-abrir');
    tocar('porta-fechar');
    tocar('interruptor');
    trovao();
  });

  // Com som desligado também não lança erro
  definirSom(false);
  assert.equal(somPreferido(), false);
  assert.doesNotThrow(() => {
    trovao();
    tocar('pop');
  });

  // Restaura ligado
  definirSom(true);
});
