// Mapa fixo do protótipo, já no formato semântico: cômodos por células, aberturas em arestas, objetos por receita.
// Unidade: metro. Célula: 1,5 m. Arestas: 'h:x:y' (horizontal, no topo da célula x,y) e 'v:x:y' (vertical, à esquerda da célula x,y).

export const CELULA = 1.5;

const rect = (x0, y0, x1, y1) => { const cells = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cells.push([x, y]); return cells; };

export const mapa = {
  nome: 'Casa dos Salgueiros',
  largura: 24, altura: 15,                       // metros
  paredes: { altura: 2.6, espessura: 0.24 },
  comodos: [
    {
      id: 'sala', nome: 'Sala', cells: rect(2, 2, 8, 6),
      piso: { material: 'tabuas.carvalho', seed: 11 },
      papel: { material: 'papel.damasco-vinho', seed: 5 },
    },
    {
      id: 'biblioteca', nome: 'Biblioteca', cells: [...rect(8, 2, 13, 4), ...rect(8, 4, 10, 7)],
      piso: { material: 'ladrilho.xadrez', seed: 23 },
      papel: { material: 'papel.listras-musgo', seed: 9 },
    },
  ],
  aberturas: [
    { id: 'porta', tipo: 'porta', aresta: 'v:8:3', estado: 'fechada', abreParaDentroDe: 'biblioteca' },
    { id: 'janela-sala', tipo: 'janela', aresta: 'h:4:2' },
    { id: 'janela-sala-2', tipo: 'janela', aresta: 'h:6:2' },
    { id: 'janela-bib', tipo: 'janela', aresta: 'v:13:2' },
  ],
  // Objetos de parede ficam na face interna (estilo caixa) e têm projeção de cima (estilo sólido).
  objetosParede: [
    { id: 'quadro', receita: 'quadro', comodo: 'sala', aresta: 'v:2:3', em: 0.5, largura: 1.0, seed: 3 },
    { id: 'estante', receita: 'estante', comodo: 'biblioteca', aresta: 'h:10:2', em: 0.5, largura: 2.6, seed: 8, ocupa: 2 },
    { id: 'estante-2', receita: 'estante', comodo: 'biblioteca', aresta: 'v:8:5', em: 0.5, largura: 1.3, seed: 15, ocupa: 1 },
  ],
  objetos: [
    { id: 'tapete', receita: 'tapete.persa', x: 7.5, y: 6.2, rot: 0, seed: 41, tam: [4.6, 3.1] },
    { id: 'mesa', receita: 'mesa.redonda', x: 7.5, y: 6.2, rot: 0, seed: 2 },
    { id: 'cadeira-1', receita: 'cadeira', x: 6.25, y: 6.2, rot: -Math.PI / 2, seed: 4 },
    { id: 'cadeira-2', receita: 'cadeira', x: 8.75, y: 6.2, rot: Math.PI / 2, seed: 6 },
    { id: 'cadeira-3', receita: 'cadeira', x: 7.5, y: 7.45, rot: Math.PI, seed: 7 },
    { id: 'aparador', receita: 'aparador', x: 10.6, y: 8.2, rot: 0, seed: 12 },
    { id: 'tapete-bib', receita: 'tapete.persa', x: 16.2, y: 4.6, rot: 0, seed: 77, tam: [3.2, 1.9] },
    { id: 'poltrona', receita: 'poltrona', x: 15.2, y: 4.7, rot: Math.PI * 0.12, seed: 19 },
    { id: 'mesinha', receita: 'mesinha', x: 16.6, y: 4.3, rot: 0, seed: 21 },
    { id: 'escrivaninha', receita: 'escrivaninha', x: 13.9, y: 9.55, rot: 0, seed: 31 },
    { id: 'cadeira-esc', receita: 'cadeira', x: 13.9, y: 8.75, rot: 0, seed: 33 },
  ],
  luzes: [
    { id: 'lampiao', x: 7.5, y: 6.2, raio: 7, cor: [1, 0.66, 0.36], intensidade: 1, energia: 'fogo', tremula: true, chama: true },
    { id: 'lustre-bib', x: 16.2, y: 4.4, raio: 6.5, cor: [1, 0.86, 0.66], intensidade: 0.95, energia: 'rede' },
    { id: 'abajur-esc', x: 14.6, y: 9.6, raio: 4, cor: [1, 0.8, 0.52], intensidade: 0.9, energia: 'rede' },
  ],
  token: { nome: 'Muirenn', celula: [3, 4], visao: 11,
    sprite: { pele: '#e8c4a0', cabelo: '#eef0f2', estiloCabelo: 'longo', roupa: '#6b3d74', roupa2: '#3b3140', calca: '#46291b', acessorio: 'galhada', olhos: '#3e6aa0' } },
};
