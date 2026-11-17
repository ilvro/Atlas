import { caminho } from '../../src/authoring/caminho.ts';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import type { Exemplo } from './kit.ts';

/** Aldeia ao entardecer (48 × 27 m): choupanas de palha em volta de um terreiro, trilhas de terra que se cruzam, poço e carroça sob sombras longas. */
export const aldeiaAoEntardecer: Exemplo = {
  id: 'aldeia-ao-entardecer',
  nome: 'Aldeia ao entardecer',
  descricao: 'Choupanas de palha em volta de um terreiro de capim, trilhas de terra que se cruzam, poço, carroça, lenha e cercas sob a luz rasante do fim do dia.',
  largura: 48,
  altura: 27,
  semente: 6619,
  construir(k) {
    k.estilo({ genre: 'fantasia', palette: 'fantasia-pedra' });
    k.fundo({ kind: 'solid', color: '#1b1d14' });
    k.base('grama.acinzentada');
    k.pintar('grama', { poligono: [[10, 8], [32, 7], [36, 20], [24, 25], [9, 20]], irregular: 1.2 });
    k.pintar('grama.escura', { poligono: [[36, 0], [48, 0], [48, 12], [38, 14]], irregular: 1.1 });
    k.pintar('terra', { poligono: [[12, 3], [22, 2.5], [22, 7], [12, 8]], irregular: 0.9 });

    // Trilhas: a estrada que corta de oeste a leste e os atalhos que sobem às casas.
    k.aplicar(m => caminho(m, { pontos: [[-1, 15], [8, 14], [17, 12.6], [27, 12.2], [36, 10.8], [44, 8.2], [49, 7.6]], largura: [1.2, 1.9], material: 'terra', sulcos: true, irregular: 0.7 }, 3));
    k.aplicar(m => caminho(m, { pontos: [[26, 12.4], [28, 16], [31, 19.5], [32, 24], [31, 28]], largura: [0.8, 1.3], material: 'terra', irregular: 0.8 }, 5));
    k.aplicar(m => caminho(m, { pontos: [[17, 12.6], [16.5, 9.5], [15.2, 7.4]], largura: [0.8, 1.1], material: 'terra', irregular: 0.8 }, 7));
    k.aplicar(m => caminho(m, { pontos: [[36, 10.8], [38, 14], [40.5, 17.5]], largura: [0.7, 1], material: 'terra', irregular: 0.8 }, 8));
    k.aplicar(m => caminho(m, { pontos: [[8, 14], [6, 18.5], [3, 22]], largura: [0.7, 1], material: 'terra', irregular: 0.8 }, 9));

    // Choupanas: cada uma com porte e programa próprios.
    k.aplicar((m, id) => construirEdificios(m, [
      { nome: 'Casa comprida', origem: [0, 0], lote: [9, 8], frente: 's', forma: 'L', telhado: 'telha.palha', comodos: [{ tipo: 'sala', area: 45, principal: true }, { tipo: 'cozinha', area: 18 }, { tipo: 'dormitorio', area: 27 }, { tipo: 'deposito', area: 14 }] },
      { nome: 'Choupana do lenhador', origem: [13, 0], lote: [4, 6], frente: 'o', forma: 'linear', telhado: 'telha.palha', comodos: [{ tipo: 'sala', area: 22, principal: true }, { tipo: 'deposito', area: 12 }] },
      { nome: 'Celeiro da aldeia', origem: [21, 0], lote: [8, 5], frente: 's', forma: 'compacta', telhado: 'telha.palha', comodos: [{ tipo: 'celeiro', area: 81, principal: true }] },
      { nome: 'Casa da curandeira', origem: [25, 10], lote: [7, 8], frente: 'o', forma: 'L', telhado: 'telha.palha', comodos: [{ tipo: 'sala', area: 32, principal: true }, { tipo: 'quarto', area: 18 }, { tipo: 'enfermaria', area: 14 }] },
      { nome: 'Estábulo', origem: [11, 15], lote: [6, 3], frente: 'n', forma: 'linear', telhado: 'telha.palha', comodos: [{ tipo: 'estabulo', area: 36, principal: true }] },
    ], 13, id));

    k.tirarExternosDosInteriores();

    // Terreiro: poço, carroça, lenha, cercas, galinheiro e as tralhas de quem mora aqui.
    k.objeto('poco', [10.4, 4.8], { rotation: 0, scale: 1.2 });
    k.objeto('carroca', [13.4, 11.2], { params: { carga: 2 }, rotation: 0.35 });
    k.objeto('pilha-de-caixotes', [11.6, 12.0], { rotation: 0.2 });
    k.objeto('pilha-de-lenha', [20.6, 3.2], { rotation: Math.PI / 2 });
    k.objeto('pilha-de-lenha', [19.8, 8.6], { rotation: 0.1 });
    k.objeto('toco', [25.6, 8.4], { rotation: 0 });
    k.objeto('galinheiro', [23.4, 17.6], { rotation: 0.4 });
    k.objeto('espantalho', [22.4, 22.2], { rotation: 0.2 });
    k.objeto('varal', [5.2, 12.4], { rotation: -0.1 });
    k.objeto('fogueira', [24.2, 13.8], { rotation: 0 });
    k.objeto('barril', [29.8, 9.2]);
    k.objeto('barril-de-chuva', [6.6, 9.2]);
    k.objeto('carrinho-de-mao', [36.4, 13.8], { rotation: 2.2 });
    k.objeto('escada.de-mao', [3.4, 2.8], { params: { comprimento: 3.6 }, rotation: Math.PI / 2 + 0.1 });
    k.objeto('fardo-de-feno', [26.2, 6.8], { rotation: 0.3 });
    k.objeto('fardo-de-feno', [27.6, 7.4], { rotation: 1.6 });
    k.objeto('cavalo', [14.4, 20.0], { params: { pelagem: 1 }, rotation: 0.3 });
    k.objeto('bebedouro', [15.2, 23.4], { rotation: 0 });
    for (const [x, y, rot, l] of [[2.6, 16.4, 0.15, 4], [10.4, 25.4, -0.05, 5], [28.6, 25.6, 0.1, 5], [32.6, 7.4, -0.3, 4], [40.2, 6.6, -0.15, 5]] as const) k.objeto('cerca', [x, y], { params: { largura: l }, rotation: rot });
    k.tirarExternosDosInteriores();
    for (const [item, x, y, rot] of [['sacos', 34.6, 1.6, 0.2], ['pilha-de-caixotes', 37.2, 1.4, 0], ['pilha-de-barris', 40.2, 1.6, 0.3], ['carrinho-de-mao', 36.4, 3.4, 1.2], ['sacos', 39.4, 3.6, -0.4], ['caixote', 33.4, 5.8, 0.4], ['pilha-de-barris', 40.4, 6.2, 1.2], ['sacos', 19.4, 23.6, 0.3], ['caixote', 22.8, 23.6, 0.1], ['barril', 23, 25.8, 0], ['tina-de-agua', 19.4, 25.8, 0]] as const) k.objeto(item, [x, y], { rotation: rot });
    k.espalhar('jardim', { poligono: [[25, 19.5], [35, 19], [36, 26.5], [25, 26.5]] }, { densidade: 0.07 });

    // Árvores e mato na borda: o leste mais fechado.
    for (const [item, x, y] of [['casa:arvore-7m', 46.4, 8.0], ['casa:arvore-5m', 46.2, 13.4], ['casa:carvalho-grande-6m', 32.6, 24.6], ['casa:arvore-5m', 1.6, 25.2], ['casa:arvore-3m', 7.8, 20.2], ['casa:arbusto-grande', 25.6, 25.8], ['casa:arbusto-seco-2m', 28.4, 1.4], ['casa:arvore-3m', 39.8, 9.8]] as const) k.objeto(item, [x, y], { rotation: k.rng() * 6 });
    for (const [x, y] of [[18.4, 10.6], [30.6, 21.6], [4.6, 19.4], [36.2, 16.8], [20.4, 19.4]] as const) k.objeto('tufo-de-grama', [x, y], { params: { material: 'grama.seca' }, scale: 1.3 });
    k.presenca('sulcos', { poligono: [[8, 12.5], [30, 11], [30, 13.6], [8, 15.6]], irregular: 0.6 }, 0.35);

    k.luz('fogueira', [24.2, 13.8]);
    k.luz('lanterna', [16.2, 7.6]);
    k.luz('lanterna', [26.6, 15.6]);

    k.clima('entardecer', { time: '17:45', tempo: { dust: 0.2, wind: 0.15 } });
    k.acabamento(null, { vignette: 0.42, edges: { kind: 'dark', amount: 0.18 }, glow: 0.4 });
    k.guardarClima('manha-na-aldeia', 'Manhã na aldeia', 'manha');
    k.guardarClima('noite-de-fogueira', 'Noite de fogueira', 'noite', { time: '21:30' });

    k.regiao([[20, 10], [30, 10], [30, 17], [20, 17]], 'trigger', { nome: 'Terreiro', texto: 'Os aldeões se juntam em volta da fogueira e se calam quando os forasteiros chegam pela estrada.' });
    k.notas('Aldeia ao entardecer — cinco famílias, um poço e um segredo: a curandeira esconde no porão o que o lenhador achou na mata. A estrada leste segue para o castelo do senhor.');
  },
};
