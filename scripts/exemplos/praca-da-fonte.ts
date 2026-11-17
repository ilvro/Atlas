import { caminho } from '../../src/authoring/caminho.ts';
import { terreno } from '../../src/authoring/construcao.ts';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import type { Exemplo } from './kit.ts';

/** Praça da fonte (48 × 27 m): largo de vila calçado em roseta com fonte octogonal, casas de enxaimel, jardim murado no alto e quintal enlameado. */
export const pracaDaFonte: Exemplo = {
  id: 'praca-da-fonte',
  nome: 'Praça da fonte',
  descricao: 'Largo de vila calçado em roseta com fonte octogonal, casas com sacada, jardim murado no alto, passarela de tábuas e quintal enlameado ao sol da manhã.',
  largura: 48,
  altura: 27,
  semente: 5303,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#20231b' });
    k.base('grama');

    // Largo de paralelepípedo, a roseta e o quintal de lama a leste.
    k.pintar('grama.seca', { poligono: [[0, 18], [14, 20], [16, 27], [0, 27]], irregular: 1.2 });
    k.pintar('grama.escura', { poligono: [[34, 20], [48, 19], [48, 27], [33, 27]], irregular: 1.1 });
    k.pintar('paralelepipedo', { poligono: [[9, 2], [26, 1.5], [26.5, 17], [22, 23], [13, 24], [8.5, 18]], irregular: 0.35 });
    k.pintar('lama', { poligono: [[27, 4.5], [40, 4], [41, 18], [36, 22], [27.5, 21]], irregular: 0.9 });
    k.pintar('terra.sulcos', { poligono: [[29, 7], [37, 6.5], [38.5, 16], [30, 18]], irregular: 1 });
    k.aplicar(m => caminho(m, { pontos: [[17, 23.5], [18.5, 21], [20.5, 19.5], [23, 20.5], [26, 26], [27, 28]], largura: [1, 1.6], material: 'lajes.antigas', irregular: 0.5 }, 3));

    // Jardim murado 1,5 m acima do largo, ao norte.
    k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 1.5, forma: { poligono: [[15, -1], [33, -1], [33, 3.2], [15, 3.6]], irregular: 0.1 } }], 9));
    k.pintar('grama.seca', { poligono: [[15, -1], [33, -1], [33, 3.2], [15, 3.6]], irregular: 0.1 });
    k.parede([[15.2, 3.9], [24, 3.6], [32.8, 3.4], [33.2, 3.2]], { kind: 'low', height: 1.4, thickness: 0.55, material: 'pedra.escura' });
    k.parede([[33.4, -0.5], [33.4, 3.2]], { kind: 'low', height: 1.4, thickness: 0.55, material: 'pedra.escura' });
    k.espalhar('jardim', { poligono: [[16, 0], [32, 0], [32, 2.6], [16, 2.8]] }, { densidade: 0.2 });

    // Fonte octogonal sobre a roseta, canteiro redondo ao sul.
    k.objeto('roseta-de-calcamento', [16.5, 9.5], { params: { raio: 5.2 }, rotation: 0 });
    k.objeto('fonte', [16.5, 9.5], { params: { diametro: 4.4, forma: 1 }, rotation: 0.39 });
    k.objeto('roseta-de-calcamento', [18.5, 19.2], { params: { raio: 2.1 }, rotation: 0 });
    k.objeto('canteiro', [18.5, 19.2], { params: { flor: 2 }, rotation: 0.4, scale: 1.2 });
    for (const [x, y] of [[17.2, 18.4], [19.6, 19.8]] as const) k.objeto('casa:arbusto-florido', [x, y], { scale: 0.7 });

    // Casas: a grande de enxaimel a oeste, a do sul com loja, e o sobrado do leste.
    k.aplicar((m, id) => construirEdificios(m, [
      { nome: 'Casa do burgomestre', origem: [0, 2], lote: [6, 12], frente: 'l', forma: 'L', alpendre: true, telhado: 'telha.tabuinhas', comodos: [
        { tipo: 'sala', area: 30, principal: true }, { tipo: 'cozinha', area: 14 }, { tipo: 'quarto', area: 14 }, { tipo: 'escritorio', area: 9 }] },
      { nome: 'Loja do ferreiro', origem: [21, 14], lote: [6, 4], frente: 'n', forma: 'linear', telhado: 'telha.tabuinhas', comodos: [
        { tipo: 'loja', area: 22, principal: true }, { tipo: 'oficina', area: 16 }] },
      { nome: 'Sobrado da viúva', origem: [27, 2], lote: [5, 7], frente: 'o', forma: 'compacta', telhado: 'telha.barro', comodos: [
        { tipo: 'sala', area: 18, principal: true }, { tipo: 'quarto', area: 12 }, { tipo: 'cozinha', area: 10 }] },
    ], 21, id));

    // Passarela de tábuas sobre a lama, cerca do quintal, carroça e caixotes.
    k.objeto('cais-segmento', [27.2, 16], { params: { comprimento: 9, largura: 1.2 }, rotation: Math.PI / 2, blocks: { move: false, sight: false } });
    for (const [x, y, rot, l] of [[33.2, 4.4, 0, 6], [37.4, 7.6, Math.PI / 2 - 0.1, 6], [37.8, 13.8, Math.PI / 2 + 0.05, 6]] as const) k.objeto('cerca', [x, y], { params: { largura: l }, rotation: rot });
    k.objeto('carroca', [33, 10.8], { params: { carga: 1 }, rotation: 1.2 });
    k.objeto('pilha-de-caixotes', [35.6, 17.2], { rotation: 0.3 });
    k.objeto('barril', [30.2, 19.8], { rotation: 0 });
    k.objeto('barril-de-chuva', [26.2, 4.6], { rotation: 0 });
    k.objeto('escada.de-mao', [36.4, 5.4], { params: { comprimento: 3 }, rotation: 1.9 });
    k.objeto('tina-de-agua', [31.2, 20.6], { rotation: 0 });

    // Moradias além do quintal e árvores na borda.
    k.aplicar((m, id) => construirEdificios(m, [
      { nome: 'Celeiro', origem: [27, 14], lote: [4, 4], frente: 'n', forma: 'compacta', telhado: 'telha.palha', comodos: [{ tipo: 'celeiro', area: 28, principal: true }] },
      { nome: 'Casa do curtidor', origem: [28, 0], lote: [4, 2], frente: 's', forma: 'linear', telhado: 'telha.velha', comodos: [{ tipo: 'oficina', area: 14, principal: true }] },
    ], 33, id));
    k.tirarExternosDosInteriores();
    k.objeto('casa:arvore-5m', [44.2, 17.4], { rotation: 1 });
    k.objeto('casa:arvore-3m', [2.4, 24.6], { rotation: 0.4 });
    k.objeto('casa:arbusto-grande', [11.8, 25.2], { rotation: 2 });
    k.objeto('casa:carvalho-grande-6m', [3.6, 0.6], { rotation: 2.4 });
    k.objeto('casa:arvore-3m', [12.6, 0.8], { rotation: 0.9 });
    k.objeto('casa:arbusto-grande', [38.2, 1.4], { rotation: 0.2 });
    k.espalhar('jardim', { poligono: [[0, 20], [10, 21], [13, 27], [0, 27]] }, { densidade: 0.12 });
    for (const [x, y] of [[8.6, 3.2], [9.6, 14.4], [25.4, 12.2]] as const) k.objeto('lanterna-de-poste', [x, y]);
    k.objeto('banco.jardim', [11.2, 9.4], { rotation: Math.PI / 2 });
    k.objeto('banco.jardim', [22.2, 9.2], { rotation: -Math.PI / 2 });
    k.objeto('barraca-de-feira', [12.4, 20.4], { params: { paleta: 1 }, rotation: 0.3, scale: 0.85 });

    k.presenca('poca', { poligono: [[29, 8], [36, 8], [36, 15], [29, 15]], irregular: 1.2 }, 0.45);
    k.presenca('musgo', { poligono: [[15, 3.4], [33, 3], [33, 4.4], [15, 4.6]], irregular: 0.6 }, 0.35);

    k.clima('manha', { time: '08:40', tempo: { leaves: 0.15, wind: 0.15 } });
    k.acabamento('quente', { vignette: 0.32, saturation: 1.12, edges: { kind: 'none', amount: 0 } });
    k.guardarClima('dia-de-feira', 'Dia de feira', 'tarde');
    k.guardarClima('noite-na-vila', 'Noite na vila', 'noite');

    k.regiao([[10, 3], [24, 3], [24, 16], [10, 16]], 'note', { nome: 'Fonte dos desejos', texto: 'Moedas antigas no fundo da fonte; uma delas tem o brasão de uma casa extinta.' });
    k.notas('Praça da fonte — coração de uma vila de vale. O burgomestre vigia o largo da sacada; o ferreiro conhece todos que passam; o quintal enlameado esconde a entrada de um porão de contrabando.');
  },
};
