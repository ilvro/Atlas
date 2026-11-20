/** Os materiais da gaveta de Terreno, em grupos (como o catálogo de texturas do Inkarnate). O maciço e a água têm um grupo cada. */
export interface GrupoDeTerreno { id: string; nome: string; materiais: readonly string[] }

export const GRUPOS_DE_TERRENO: readonly GrupoDeTerreno[] = [
  { id: 'grama', nome: 'Grama', materiais: ['grama', 'grama.acinzentada', 'grama.seca', 'grama.escura'] },
  { id: 'terra', nome: 'Terra e lama', materiais: ['terra', 'terra.sulcos', 'terra.congelada', 'chao.batido', 'chao.de.mata', 'lama'] },
  { id: 'areia', nome: 'Areia', materiais: ['areia', 'areia.molhada'] },
  { id: 'pedra', nome: 'Pedra e cascalho', materiais: ['pedregulho', 'cascalho', 'rocha.rachada'] },
  { id: 'calcamento', nome: 'Calçamento', materiais: ['calcada', 'paralelepipedo', 'lajes.gramadas', 'lajes.escuras', 'lajes.antigas', 'piso.hangar'] },
  { id: 'neve', nome: 'Neve e gelo', materiais: ['neve', 'neve.funda', 'neve.pisada', 'gelo'] },
  { id: 'macico', nome: 'Rocha (maciço)', materiais: ['rocha.cinza', 'rocha.caverna', 'rocha.nevada', 'rocha.arenito'] },
  { id: 'agua', nome: 'Água', materiais: ['agua.mar', 'agua.lago', 'agua.rio', 'agua.gruta', 'agua.pantano', 'agua.turfa'] },
];
