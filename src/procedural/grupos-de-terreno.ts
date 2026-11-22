/** Os materiais da gaveta de Terreno, em grupos (como o catálogo de texturas do Inkarnate). O maciço e a água têm um grupo cada. */
export interface GrupoDeTerreno { id: string; nome: string; materiais: readonly string[]; /** Cenários a que serve; ausente = qualquer. */ biomas?: readonly string[] }

export const GRUPOS_DE_TERRENO: readonly GrupoDeTerreno[] = [
  { id: 'grama', nome: 'Grama', materiais: ['grama', 'grama.acinzentada', 'grama.seca', 'grama.escura'], biomas: ['temperado', 'outono'] },
  { id: 'terra', nome: 'Terra e lama', materiais: ['terra', 'terra.congelada', 'chao.batido', 'chao.de.mata', 'musgo', 'lama'], biomas: ['temperado', 'outono', 'frio'] },
  { id: 'deserto', nome: 'Deserto e sertão', materiais: ['areia.duna', 'terra.rachada', 'laterita', 'salina'], biomas: ['deserto'] },
  { id: 'campo', nome: 'Campo e lavoura', materiais: ['terra.sulcos'], biomas: ['temperado', 'tropical'] },
  { id: 'areia', nome: 'Areia', materiais: ['areia', 'areia.molhada'], biomas: ['deserto', 'mar'] },
  { id: 'pedra', nome: 'Pedra e cascalho', materiais: ['pedregulho', 'cascalho', 'rocha.rachada'], biomas: ['temperado', 'frio', 'subterraneo', 'vulcanico'] },
  { id: 'calcamento', nome: 'Calçamento', materiais: ['calcada', 'paralelepipedo', 'lajes.gramadas', 'lajes.escuras', 'lajes.antigas', 'piso.hangar'], biomas: ['urbano', 'temperado'] },
  { id: 'neve', nome: 'Neve e gelo', materiais: ['neve', 'neve.funda', 'neve.pisada', 'gelo'], biomas: ['frio'] },
  { id: 'macico', nome: 'Rocha (maciço)', materiais: ['rocha.cinza', 'rocha.caverna', 'rocha.nevada', 'rocha.arenito'], biomas: ['temperado', 'frio', 'deserto', 'subterraneo', 'vulcanico'] },
  { id: 'agua', nome: 'Água', materiais: ['agua.mar', 'agua.lago', 'agua.rio', 'agua.gruta', 'agua.pantano', 'agua.turfa', 'agua.arrozal', 'agua.lava'], biomas: ['vulcanico', 'temperado', 'frio', 'tropical', 'mar', 'subterraneo'] },
];
