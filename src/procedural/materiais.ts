import { contextoDe, criarTela, type Contexto } from './canvas.ts';
import { campoDeRuido, fbm, hash2D, ladrilhoDeRuido, mulberry32, valueNoise2D } from './ruido.ts';
import { celulasDeVoronoi, type Consulta } from './voronoi.ts';
import { amostrarSemRepeticao, mapaDeGradiente, pesoDaCamada, reduzirTextura, tomDaTextura, type CamadaDeTextura, type Pixels, type ReceitaDeTextura, type Tom } from './textura-de-terreno.ts';
import { texturaPronta } from './texturas-carregadas.ts';
import { ehPadraoDeCobertura, texturaDeCobertura, type PadraoDeCobertura } from './coberturas.ts';

export type Padrao = 'tabuas' | 'xadrez' | 'damasco' | 'listras' | 'veio' | 'trama' | 'couro' | 'metal' | 'vidro' | 'pregas' | 'pintura' | 'persa' | 'laje' | 'liso' | 'grama' | 'terra' | 'areia' | 'pedra' | 'neve' | 'lama' | 'dunas-areia' | 'basalto' | 'cristal' | 'mosaico' | 'medalhao' | 'tatami' | 'zellige' | 'pompeiano' | 'hieroglifos' | 'shoji' | 'taipa' | 'conves' | 'hidraulico' | 'enxaimel' | 'descascado' | 'azulejo' | 'neon' | 'pichado' | 'ferrugem' | 'metro' | 'espinha' | 'marmore' | 'losango' | 'hexagono' | 'floral' | 'lambri' | 'gelo' | 'dunas' | 'rachado' | 'cascalho' | 'paralelepipedo' | 'lajegrama' | 'sulcos' | 'molhada' | 'batido' | 'folhico'
  | 'palha-chao' | 'lajes-rusticas' | 'lajes-grandes' | 'marchetaria' | 'chapa-xadrez' | 'grade-metal' | 'toras' | 'manchado' | 'painel' | 'acolchoado' | 'pisada' | 'placas' | PadraoDeCobertura;
export interface Material {
  id: string; nome: string; /** Para onde o material vai: piso, papel de parede, objeto ou terreno. */ uso: 'piso' | 'papel' | 'objeto' | 'terreno' | 'macico' | 'agua' | 'telhado';
  base: string; escuro: string; claro: string; padrao: Padrao; /** Tapete: qual desenho (1 medalhão, 2 floral, 3 cercaduras, 4 kilim, 5 oval); ausente sorteia pela semente. */ desenho?: number; largura?: number; lado?: number; ouro?: string; borda?: string; meio?: string; /** Maciço: cor do topo (neve), onde a rocha passa de 70% da altura. */ topo?: string; /** Maciço e escarpa: quanto o pé da face escurece e quanto pesa a sombra de contato (0 a 1; ausente vale 1). */ pe?: number;
  /** Água: cor perto da margem e no fundo, cor da espuma e quanto se enxerga o leito (0 a 1) no fundo. */ raso?: string; fundo?: string; espuma?: string; transparencia?: number; /** Água: rede de luz animada sobre o leito (cáusticas). */ causticas?: boolean; /** Água: quanto de espuma na margem e em volta dos objetos (0 a 1, padrão 1); água parada de gruta quase não tem. */ espumaForca?: number; /** Água: rebentação, cristas de onda brancas que correm para a margem (0 a 1; só o mar). */ ondas?: number;
  /** Água, maciço, piso ou papel que brilha: quanto emite acima da luz da cena (0 a 1). No maciço são os veios (`veio`); no piso e no papel, as partes claras do desenho (o néon). */ brilho?: number; /** Água: desenha lava (crosta com fendas acesas, sem ondas nem espuma). */ lava?: boolean; /** Maciço com `brilho`: a cor dos veios. */ veio?: string;
  /** Terreno: quanto a borda da camada se desfaz em manchas (0 a 1; ausente = borda comum). Chão batido e folhiço se misturam com o vizinho. */ franja?: number;
  /** Terreno (Ilustrado): textura CC0 puxada para a paleta; o `padrao` continua como reserva e é o que o Pixel usa. */ textura?: ReceitaDeTextura;
  /** Telhado: o que cresce ou corrói na cobertura (musgo, ferrugem, azinhavre) e quanto dela cobre (0 a 1). */ mancha?: { cor: string; quanto: number };
  /** Telhado: brilho especular da cobertura (0 a 1, usado na iluminação N6/N8b). */ especular?: number;
}

const m = (id: string, nome: string, uso: Material['uso'], base: string, escuro: string, claro: string, padrao: Padrao, extra: Partial<Material> = {}): [string, Material] => [id, { id, nome, uso, base, escuro, claro, padrao, ...extra }];

/** Uma descrição por material. O renderizador Ilustrado pinta; o Pixel (Fase 8) pintará a mesma descrição com a paleta. */
export const MATERIAIS: Readonly<Record<string, Material>> = Object.fromEntries([
  // Pisos
  m('tabuas.carvalho', 'Tábuas de carvalho', 'piso', '#7a4a2a', '#3a2214', '#a8703e', 'tabuas', { largura: 0.2 }),
  m('tabuas.escuras', 'Tábuas escuras', 'piso', '#4a2e1e', '#20120a', '#6d4630', 'tabuas', { largura: 0.18 }),
  m('tabuas.claras', 'Tábuas claras', 'piso', '#b98d5a', '#6e4a28', '#dcb888', 'tabuas', { largura: 0.22 }),
  m('ladrilho.xadrez', 'Xadrez preto e branco', 'piso', '#d4c9b0', '#262226', '#efe6cf', 'xadrez', { lado: 0.5 }),
  m('ladrilho.cozinha', 'Ladrilho de cozinha', 'piso', '#c9c1a8', '#8a8266', '#e9e3cf', 'xadrez', { lado: 0.3 }),
  m('ladrilho.azul', 'Ladrilho azul', 'piso', '#5d7d96', '#2c4358', '#9bb8cc', 'xadrez', { lado: 0.3 }),
  m('azulejo.branco', 'Azulejo branco', 'piso', '#dcdcd6', '#9a9a92', '#f5f5f0', 'xadrez', { lado: 0.25 }),
  m('laje.pedra', 'Lajes de pedra', 'piso', '#6b6e75', '#2e3036', '#9a9da5', 'lajes-grandes'),
  m('concreto', 'Concreto', 'piso', '#6c6a66', '#34322f', '#8d8a85', 'liso'),
  m('carpete.vinho', 'Carpete vinho', 'piso', '#5a1b25', '#2c0c12', '#7d2b36', 'trama'),
  m('carpete.cinza', 'Carpete cinza', 'piso', '#4d4f55', '#272830', '#6c6e76', 'trama'),
  m('parquet.espinha', 'Parquet em espinha de peixe', 'piso', '#8a5a34', '#4a2e18', '#c08a54', 'espinha'),
  m('marmore.branco', 'Mármore branco', 'piso', '#d4d2cb', '#8d8b84', '#efede6', 'marmore', { lado: 0.9 }),
  m('marmore.incrustado', 'Mármore com incrustações', 'piso', '#d6cfbf', '#8a8273', '#f0eadc', 'marmore', { lado: 1.05, meio: '#2a282e' }),
  m('tabuas.marchetadas', 'Assoalho marchetado', 'piso', '#4c3626', '#1f150d', '#7c5c40', 'marchetaria'),
  m('marmore.xadrez-diagonal', 'Mármore preto e branco em diagonal', 'piso', '#dcd8cf', '#25232a', '#f2eee4', 'losango', { lado: 0.5 }),
  m('hexagono.salvia', 'Hexágonos verde-sálvia', 'piso', '#8a9a7b', '#4a5642', '#b5c3a6', 'hexagono', { lado: 0.2 }),
  m('hexagono.terracota', 'Hexágonos de terracota', 'piso', '#b9653a', '#6b3018', '#d68c5e', 'hexagono', { lado: 0.2 }),
  m('tabuas.cinza', 'Tábuas cinza (pintadas)', 'piso', '#7d8186', '#3d4044', '#a9adb2', 'tabuas', { largura: 0.2 }),
  m('terra.batida', 'Terra batida', 'piso', '#5e4632', '#2c1f15', '#806549', 'terra'),
  m('palha.chao', 'Palha no chão', 'piso', '#8a6a3c', '#3a2a18', '#d9bb72', 'palha-chao'),
  m('pedra.rustica', 'Lajes rústicas', 'piso', '#6d6a62', '#2b2925', '#9b978c', 'lajes-rusticas'),
  m('tabuas.rusticas', 'Tábuas rústicas', 'piso', '#6a5642', '#2a1f15', '#93795c', 'tabuas', { largura: 0.3 }),
  m('metal.chapa', 'Chapa xadrez', 'piso', '#6e737a', '#2c3036', '#b7bec6', 'chapa-xadrez'),
  m('metal.grade', 'Grade de piso', 'piso', '#5f656d', '#0d0f12', '#a7aeb7', 'grade-metal'),
  m('vinil.industrial', 'Vinil industrial', 'piso', '#8b9089', '#5f645e', '#a7aca4', 'xadrez', { lado: 0.6 }),
  m('concreto.placas', 'Placas de concreto', 'piso', '#8a8883', '#3e3c39', '#aeaba5', 'placas', { lado: 1.5 }),
  // Papéis e paredes
  m('papel.damasco-vinho', 'Damasco vinho', 'papel', '#4f1820', '#2c0c12', '#7d2b33', 'damasco'),
  m('papel.damasco-azul', 'Damasco azul', 'papel', '#1f3350', '#0e1a2b', '#3a5a86', 'damasco'),
  m('papel.listras-musgo', 'Listras verde-musgo', 'papel', '#22362a', '#15211a', '#3a5a40', 'listras', { ouro: '#9a7a3a' }),
  m('papel.listras-creme', 'Listras creme', 'papel', '#cdbf9c', '#8a7e60', '#e8dcba', 'listras', { ouro: '#a88a4a' }),
  m('papel.liso-claro', 'Liso claro', 'papel', '#b7ab90', '#7f755f', '#d4c9ac', 'liso'),
  m('papel.liso-escuro', 'Liso escuro', 'papel', '#2c2a30', '#16151a', '#46434d', 'liso'),
  m('reboco.branco', 'Reboco branco', 'papel', '#cfcbc0', '#8c8878', '#e8e5db', 'liso'),
  m('tijolo', 'Tijolo aparente', 'papel', '#7a3f30', '#3d1d15', '#a35a46', 'laje'),
  m('papel.floral-azul', 'Floral azul', 'papel', '#d4dce6', '#8b98ad', '#3f5f8e', 'floral', { ouro: '#c9a45a' }),
  m('papel.floral-rosa', 'Floral rosa', 'papel', '#e6d2d2', '#a98a8a', '#a8465f', 'floral', { ouro: '#b08a3a' }),
  m('papel.verde-esmeralda', 'Damasco verde-esmeralda', 'papel', '#1d4a3a', '#0e261e', '#3d7a5e', 'damasco'),
  m('papel.bordo-listras', 'Listras bordô', 'papel', '#4a1820', '#25090e', '#8a2d3a', 'listras', { ouro: '#b08a3a' }),
  m('papel.azul-listras', 'Listras azul-marinho', 'papel', '#1f3350', '#0e1a2b', '#4a6a96', 'listras', { ouro: '#c9a45a' }),
  m('boiserie.escura', 'Boiserie de madeira escura', 'papel', '#4a2e1e', '#20120a', '#7a4e32', 'lambri'),
  m('boiserie.verde', 'Boiserie verde-musgo', 'papel', '#2f4a38', '#15261c', '#4f7a5c', 'lambri'),
  m('toras', 'Toras de madeira', 'papel', '#6b4a2e', '#2a1a0e', '#9a7048', 'toras'),
  m('pedra.aparelhada', 'Pedra aparelhada', 'papel', '#8a8274', '#3d382f', '#b3aa98', 'laje'),
  m('reboco.sujo', 'Reboco sujo', 'papel', '#a59c88', '#5e5546', '#c9c1ad', 'manchado'),
  m('painel.metalico', 'Painel metálico', 'papel', '#5d646c', '#23272c', '#949ca6', 'painel'),
  m('painel.acolchoado', 'Painel acolchoado', 'papel', '#b7b4a8', '#6e6b60', '#dedbd0', 'acolchoado'),
  // Faces de parede (Frente L): reboco claro, tábuas de cabana, alvenaria de masmorra e rocha de gruta.
  m('parede.reboco', 'Reboco liso', 'papel', '#c4bca8', '#857c68', '#ddd6c4', 'liso'),
  m('parede.tabuas', 'Tábuas de parede', 'papel', '#6a4630', '#2e1c10', '#94684a', 'tabuas', { largura: 0.16 }),
  m('parede.alvenaria', 'Alvenaria de pedra', 'papel', '#5d5a58', '#26231f', '#86827c', 'laje'),
  m('parede.rocha', 'Rocha viva', 'papel', '#575d63', '#24282d', '#848c94', 'rachado'),
  // Objetos
  m('madeira.escura', 'Madeira escura', 'objeto', '#3d2416', '#1e110a', '#6b4024', 'veio'),
  m('madeira.media', 'Madeira média', 'objeto', '#74431f', '#3d2312', '#a46a36', 'veio'),
  m('madeira.clara', 'Madeira clara', 'objeto', '#b88a55', '#6e4a28', '#dcb888', 'veio'),
  m('tecido.linho', 'Linho', 'objeto', '#e6dbc3', '#b9ab8c', '#f6efdd', 'trama'),
  m('tecido.veludo-vinho', 'Veludo vinho', 'objeto', '#6e1f2a', '#3a0c14', '#9a3440', 'trama'),
  m('tecido.veludo-azul', 'Veludo azul', 'objeto', '#233e63', '#10203a', '#3c609a', 'trama'),
  m('tecido.verde', 'Tecido verde', 'objeto', '#2f4a32', '#172a1a', '#4f7346', 'trama'),
  m('tecido.cinza', 'Tecido cinza', 'objeto', '#6b6f76', '#34363b', '#9a9ea6', 'trama'),
  m('tecido.mostarda', 'Tecido mostarda', 'objeto', '#b8892a', '#6b4d10', '#dcb04e', 'trama'),
  m('tecido.salvia', 'Tecido verde-sálvia', 'objeto', '#8a9a7b', '#4a5642', '#b5c3a6', 'trama'),
  m('couro.marrom', 'Couro marrom', 'objeto', '#5c2f1a', '#2e160b', '#8a4f2c', 'couro'),
  m('latao', 'Latão', 'objeto', '#c49a4a', '#6e5122', '#f2d68c', 'metal'),
  m('ferro', 'Ferro', 'objeto', '#3b3d44', '#17181c', '#6a6d77', 'metal'),
  m('porcelana', 'Porcelana', 'objeto', '#e7e7e2', '#a6a6a0', '#ffffff', 'liso'),
  m('papel.folha', 'Folha de papel', 'objeto', '#eee4cb', '#bfb294', '#fbf6e8', 'liso'),
  m('vidro', 'Vidro', 'objeto', '#5b7a93', '#22303d', '#a9c4d6', 'vidro'),
  m('cortina.vinho', 'Cortina vinho', 'objeto', '#521820', '#260a0f', '#7c2a33', 'pregas'),
  m('moldura.dourada', 'Moldura dourada', 'objeto', '#a8822e', '#5a4316', '#e0c06a', 'metal'),
  m('pintura.paisagem', 'Pintura de paisagem', 'objeto', '#2a3a3a', '#131a1c', '#7a8a6a', 'pintura'),
  m('tapete.persa', 'Tapete persa', 'objeto', '#7a1f24', '#1a2440', '#e6d3a8', 'persa', { borda: '#1a2440', meio: '#b2312e' }),
  m('tapete.verde', 'Tapete persa verde', 'objeto', '#2f4a32', '#14221a', '#d9c98e', 'persa', { borda: '#14221a', meio: '#4f7346' }),
  m('tapete.creme', 'Tapete persa creme', 'objeto', '#d9cdb2', '#2a2a3a', '#f1e8d2', 'persa', { borda: '#3d4f6e', meio: '#7d2a28' }),
  m('tapete.marinho', 'Tapete marinho desbotado', 'objeto', '#2c3344', '#151922', '#d6c8aa', 'persa', { borda: '#3c4256', meio: '#9a8462' }),
  m('tapete.areia', 'Tapete cor de areia', 'objeto', '#b9a27a', '#4a3a26', '#e4d6b4', 'persa', { borda: '#8c7048', meio: '#6e5a3e' }),
  m('tapete.desbotado', 'Tapete rosado desbotado', 'objeto', '#d4c8ac', '#6a5c48', '#efe6d0', 'persa', { borda: '#b39b6c', meio: '#a87a70' }),
  m('tapete.azul', 'Tapete persa azul', 'objeto', '#24365a', '#141a2a', '#d8c08a', 'persa', { borda: '#6e1c22', meio: '#b98a3a' }),
  // Coberturas de telhado (o desenho de cada padrão está em coberturas.ts; a queda d'água aponta para +y)
  // Antiguidade, Oriente e deserto (Q10)
  m('mosaico.romano', 'Mosaico romano', 'piso', '#e6dcc4', '#1e1a18', '#f4ecd8', 'mosaico', { borda: '#9a3a22', ouro: '#b8843a' }),
  m('mosaico.medalhao', 'Mosaico com medalhão', 'piso', '#e6dcc4', '#1e1a18', '#f4ecd8', 'medalhao', { borda: '#9a3a22', ouro: '#b8843a' }),
  m('terracota.quadrada', 'Terracota quadrada', 'piso', '#ad5e3c', '#a05436', '#bc6c44', 'xadrez', { lado: 0.33, borda: '#5e3422' }),
  m('lajes.arenito', 'Lajes de arenito', 'piso', '#c4a476', '#6e5434', '#dcc49a', 'lajes-rusticas'),
  m('tatami', 'Tatami', 'piso', '#b8b070', '#7a7440', '#d4cc8e', 'tatami', { borda: '#1e2a22' }),
  m('tabuas.laqueadas', 'Tábuas laqueadas', 'piso', '#4a1e14', '#200a06', '#6e3420', 'tabuas'),
  m('zellige', 'Zellige', 'piso', '#1e5a8a', '#3a342c', '#f0ece0', 'zellige', { borda: '#2a7a5a', ouro: '#d0a03a', meio: '#1e2e5a', lado: 0.5 }),
  m('estuque.pompeiano', 'Estuque pompeiano', 'papel', '#9a2a1e', '#1a1412', '#e8dcc0', 'pompeiano', { ouro: '#d8b860' }),
  m('alvenaria.arenito', 'Alvenaria de arenito', 'papel', '#c2a272', '#6a5232', '#dcc294', 'laje'),
  m('parede.hieroglifos', 'Hieróglifos', 'papel', '#d4bc8c', '#2a1e16', '#e8d6aa', 'hieroglifos', { borda: '#2a4a8a', ouro: '#a8501e' }),
  m('shoji', 'Shoji', 'papel', '#6a4a2a', '#2a1a10', '#f0eadc', 'shoji'),
  m('madeira.laqueada', 'Madeira laqueada', 'papel', '#7a1e16', '#2a0806', '#a83a26', 'lambri'),
  m('adobe', 'Adobe', 'papel', '#b08a5e', '#6e5234', '#ccaa7c', 'manchado'),
  m('taipa', 'Taipa de pilão', 'papel', '#a07850', '#5a3e24', '#c8a074', 'taipa'),
  m('telha.imbrex', 'Telha romana', 'telhado', '#b86440', '#4e2414', '#e0946a', 'imbrex'),
  m('telha.curva.cinza', 'Telha curva cinza', 'telhado', '#5a5e66', '#1e2024', '#9aa0aa', 'telha-esmaltada', { especular: 0.25 }),
  m('terraco.barro', 'Terraço de barro', 'telhado', '#a8845a', '#5a4228', '#c8a87a', 'concreto-laje', { mancha: { cor: '#6a5236', quanto: 0.3 } }),
  // Colonial, faroeste e vitoriano (Q11)
  m('conves', 'Convés', 'piso', '#8a7458', '#1a140e', '#b4a084', 'conves', { largura: 0.15, ouro: '#3a2a1a' }),
  m('tijoleira', 'Tijoleira', 'piso', '#9a4a30', '#5a2a1a', '#b8664a', 'espinha'),
  m('tabuas.gastas', 'Tábuas gastas', 'piso', '#7e7464', '#3a342a', '#a69c8a', 'tabuas', { largura: 0.22 }),
  m('ladrilho.hidraulico', 'Ladrilho hidráulico', 'piso', '#3e6a6a', '#2a2a2a', '#e4dccb', 'hidraulico', { borda: '#9a3a2a', lado: 0.25 }),
  m('caiado', 'Caiado', 'papel', '#e8e4da', '#a8a294', '#f6f3ec', 'manchado'),
  m('enxaimel', 'Enxaimel', 'papel', '#3a2418', '#1a0e08', '#e6dcc8', 'enxaimel'),
  m('tabuas.descascadas', 'Tábuas descascadas', 'papel', '#6a8a8a', '#2a2420', '#8aa8a6', 'descascado', { ouro: '#8a7a64' }),
  m('tijolo.fuligem', 'Tijolo com fuligem', 'papel', '#5a3428', '#1e1210', '#7a4a3a', 'laje'),
  m('azulejo.portugues', 'Azulejo português', 'papel', '#1e3e8a', '#b8b4aa', '#f2f0ea', 'azulejo', { lado: 0.15 }),
  m('telha.capa-canal', 'Telha capa-canal colonial', 'telhado', '#a85a38', '#3e1c10', '#d4885e', 'telha-canal', { mancha: { cor: '#2e2a22', quanto: 0.3 } }),
  m('chapa.rebitada', 'Chapa rebitada', 'telhado', '#6a6458', '#262420', '#a49c8a', 'rebitada', { especular: 0.45, mancha: { cor: '#8a4a22', quanto: 0.3 } }),
  // Pós-apocalíptico e cyberpunk (Q12)
  m('concreto.rachado', 'Concreto rachado', 'piso', '#7e7c78', '#3a3836', '#a8a6a0', 'rachado'),
  m('entulho', 'Entulho', 'piso', '#6e665c', '#2e2a26', '#9a9082', 'cascalho'),
  m('linoleo', 'Linóleo', 'piso', '#8a8a74', '#5a6a6a', '#c8c4a8', 'xadrez', { lado: 0.3 }),
  m('piso.neon', 'Piso com néon', 'piso', '#1c1e26', '#0c0d12', '#2ad8ff', 'neon', { ouro: '#ff2ad0', brilho: 0.9 }),
  m('grade.cyber', 'Grade de piso escura', 'piso', '#2a2e36', '#0e1014', '#4a5464', 'grade-metal'),
  m('concreto.pichado', 'Concreto pichado', 'papel', '#8a8780', '#4a4844', '#b0ada6', 'pichado'),
  m('chapa.enferrujada', 'Chapa enferrujada', 'papel', '#4a4a48', '#2a2a28', '#8a8a86', 'ferrugem', { ouro: '#8a4422' }),
  m('painel.neon', 'Painel com néon', 'papel', '#1a1c24', '#0a0b10', '#ff2ad0', 'neon', { ouro: '#2ad8ff', brilho: 0.9 }),
  m('azulejo.metro', 'Azulejo de metrô', 'papel', '#e6e4de', '#8a8a86', '#fafaf6', 'metro'),
  m('chapa.remendada', 'Chapa remendada', 'telhado', '#6a6660', '#2a2826', '#9a948a', 'remendada', { especular: 0.35, mancha: { cor: '#8a4422', quanto: 0.45 } }),
  m('laje.equipada', 'Laje com equipamentos', 'telhado', '#7c7a76', '#3e3c3a', '#a6a4a0', 'concreto-laje', { mancha: { cor: '#3a3836', quanto: 0.3 } }),
  m('telha.barro', 'Telha de barro', 'telhado', '#a5553a', '#4a2014', '#d4845e', 'telha-canal'),
  m('telha.velha', 'Telha velha com musgo', 'telhado', '#8e5a44', '#3c2216', '#b9846a', 'telha-canal', { mancha: { cor: '#5f7a3a', quanto: 0.42 } }),
  m('telha.ardosia', 'Ardósia', 'telhado', '#3d444f', '#191d24', '#66717f', 'ardosia', { mancha: { cor: '#7d8a6a', quanto: 0.08 } }),
  m('telha.escamas', 'Escamas de ardósia', 'telhado', '#47505e', '#1b2029', '#727e90', 'escamas'),
  m('telha.palha', 'Palha', 'telhado', '#b08f4e', '#584322', '#dcbc7a', 'palha', { mancha: { cor: '#6e7044', quanto: 0.12 } }),
  m('telha.tabuinhas', 'Tabuinhas de madeira', 'telhado', '#7a5a3c', '#33230f', '#ad8a60', 'tabuinhas', { mancha: { cor: '#5a6a3a', quanto: 0.1 } }),
  m('telha.pedra', 'Lajes de pedra', 'telhado', '#7c7a72', '#34332e', '#aeaba0', 'lajes-telhado', { mancha: { cor: '#5a6e36', quanto: 0.28 } }),
  m('telha.cobre', 'Cobre com azinhavre', 'telhado', '#8e5a3c', '#3a2012', '#c08660', 'cobre', { especular: 0.3, mancha: { cor: '#5fa88c', quanto: 0.5 } }),
  m('telha.zinco', 'Zinco ondulado', 'telhado', '#8a9096', '#43484e', '#c8cdd1', 'ondulado', { mancha: { cor: '#8a4a24', quanto: 0.3 } }),
  m('telha.concreto', 'Laje de concreto', 'telhado', '#8c8a84', '#4a4844', '#b6b3ac', 'concreto-laje', { mancha: { cor: '#3e3c38', quanto: 0.25 } }),
  m('telha.grama', 'Telhado de grama', 'telhado', '#4f7a36', '#1f3a16', '#84ae58', 'grama-telhado', { mancha: { cor: '#5a4430', quanto: 0.18 } }),
  m('telha.lona', 'Lona', 'telhado', '#c8b48a', '#76664a', '#e8dab6', 'lona', { mancha: { cor: '#8a7a5a', quanto: 0.15 } }),
  m('telha.tabuas', 'Tábuas de madeira', 'telhado', '#8a5d3b', '#352010', '#bc8a5a', 'tabuas-telhado', { mancha: { cor: '#4d5d32', quanto: 0.14 } }),
  m('telha.francesa', 'Telha francesa', 'telhado', '#b35334', '#4f1e12', '#df8862', 'telha-francesa', { mancha: { cor: '#5a6e38', quanto: 0.08 } }),
  m('telha.esmaltada.verde', 'Telha esmaltada verde', 'telhado', '#286e56', '#0c2c22', '#6cc4a0', 'telha-esmaltada', { especular: 0.55, mancha: { cor: '#3c5434', quanto: 0.06 } }),
  m('telha.esmaltada.azul', 'Telha esmaltada azul', 'telhado', '#244d82', '#0c1c36', '#6ea8e6', 'telha-esmaltada', { especular: 0.55, mancha: { cor: '#304458', quanto: 0.05 } }),
  m('telha.esmaltada.amarela', 'Telha esmaltada amarela', 'telhado', '#c99224', '#5a3a08', '#fae078', 'telha-esmaltada', { especular: 0.55, mancha: { cor: '#7d5a1c', quanto: 0.06 } }),
  m('telha.chapa.verde', 'Chapa metálica verde', 'telhado', '#3b6450', '#182b22', '#6f9c84', 'chapa-com-junta', { mancha: { cor: '#7a4424', quanto: 0.16 } }),
  m('telha.chapa.vermelha', 'Chapa metálica vermelha', 'telhado', '#8d362c', '#3d1410', '#c4685a', 'chapa-com-junta', { mancha: { cor: '#6e3418', quanto: 0.16 } }),
  m('telha.chapa.cinza', 'Chapa metálica cinza', 'telhado', '#6f7780', '#2e3338', '#adb6c0', 'chapa-com-junta', { mancha: { cor: '#7a4826', quanto: 0.18 } }),
  m('telha.fibrocimento', 'Fibrocimento', 'telhado', '#95948e', '#474642', '#bcbab2', 'fibrocimento', { mancha: { cor: '#4c5838', quanto: 0.34 } }),
  m('telha.bambu', 'Bambu', 'telhado', '#a89658', '#4a3f1e', '#d4c482', 'bambu', { mancha: { cor: '#6d7a3c', quanto: 0.36 } }),
  m('telha.couro', 'Couro costurado', 'telhado', '#8c5c38', '#3b2110', '#ba885c', 'couro-telhado', { mancha: { cor: '#56341c', quanto: 0.28 } }),
  m('telha.chumbo', 'Placas de chumbo', 'telhado', '#5a606a', '#25282e', '#8b929c', 'chumbo', { mancha: { cor: '#cfd5dc', quanto: 0.32 } }),
  m('telha.marmore', 'Mármore branco', 'telhado', '#dfd9cc', '#8e877a', '#f6f3eb', 'marmore-telhado', { especular: 0.35, mancha: { cor: '#5a6a44', quanto: 0.08 } }),
  m('telha.marmore.rosado', 'Mármore rosado', 'telhado', '#c9978e', '#784e48', '#ecd0c8', 'marmore-telhado', { especular: 0.35 }),
  m('telha.marmore.negro', 'Mármore negro', 'telhado', '#2b2d34', '#121318', '#8e929e', 'marmore-telhado', { especular: 0.38 }),
  m('telha.ouro', 'Folha de ouro', 'telhado', '#cfa134', '#6e4d0c', '#ffe582', 'ouro-telhado', { especular: 0.92 }),
  m('telha.vidro', 'Estufa de vidro', 'telhado', '#7ea8c4', '#212730', '#d8f0ff', 'vidro-telhado', { especular: 0.85 }),
  m('telha.vitral', 'Vitral colorido', 'telhado', '#4a5a78', '#1a1c24', '#dce8ff', 'vitral-telhado', { especular: 0.8 }),
  m('folhagem', 'Folhagem', 'objeto', '#2f5a34', '#14301a', '#5f9a4e', 'grama'),
  m('parede.topo', 'Topo de parede', 'objeto', '#141218', '#08070a', '#2a2630', 'liso'),
  m('pedra.escura', 'Pedra escura', 'objeto', '#1b1d22', '#0c0d10', '#2b2f37', 'liso'),
  // Terreno
  m('grama', 'Grama', 'terreno', '#3f6b34', '#234a1f', '#6a9a4a', 'grama', { textura: { tingir: 0.6, camadas: [{ textura: 'leafy_grass', escala: 1.4 }] } }),
  m('grama.acinzentada', 'Grama acinzentada', 'terreno', '#556353', '#323c31', '#7e8f7c', 'grama', { textura: { tingir: 0.92, camadas: [{ textura: 'sparse_grass', escala: 1.4 }] } }),
  m('grama.seca', 'Grama seca', 'terreno', '#7d7547', '#4e4827', '#a39b68', 'grama', { textura: { tingir: 0.6, camadas: [{ textura: 'withered_grass', escala: 1.4 }] } }),
  m('grama.escura', 'Grama escura', 'terreno', '#284825', '#142912', '#496d44', 'grama', { textura: { tingir: 0.6, camadas: [{ textura: 'grass_ground', escala: 1.4 }] } }),
  m('terra', 'Terra', 'terreno', '#6a4d33', '#3b2a1a', '#8d6c49', 'terra', { textura: { tingir: 0.6, camadas: [{ textura: 'brown_mud_dry', escala: 1.5 }] } }),
  m('areia', 'Areia', 'terreno', '#c8b27c', '#9a8650', '#e6d6a4', 'areia', { textura: { tingir: 0.6, camadas: [{ textura: 'sand_01', escala: 1.4 }] } }),
  m('pedregulho', 'Pedregulho', 'terreno', '#6f6c66', '#3a3834', '#a09c94', 'pedra', { textura: { tingir: 0.6, camadas: [{ textura: 'rocks_ground_02', escala: 1.4 }] } }),
  m('lama', 'Lama', 'terreno', '#4a3a28', '#2a1f14', '#6a5640', 'lama', { textura: { tingir: 0.6, camadas: [{ textura: 'mud_forest', escala: 1.5 }, { textura: 'damp_beach_sand_02', escala: 1.3, mascara: { freq: 0.4, limiar: 0.6, suave: 0.08, semente: 7 }, tons: ['#1e1810', '#3e3222', '#5e4e38'] }] } }),
  m('neve', 'Neve', 'terreno', '#e6ecf2', '#aab8c8', '#ffffff', 'neve', { textura: { tingir: 0.6, camadas: [{ textura: 'snow_01', escala: 1.4 }] } }),
  m('calcada', 'Calçada', 'terreno', '#7d7b78', '#45433f', '#a8a5a0', 'laje'),
  m('gelo', 'Gelo', 'terreno', '#9cc7e0', '#5d93b8', '#e8f6ff', 'gelo'),
  m('neve.funda', 'Neve funda', 'terreno', '#eef3f8', '#b9c8da', '#ffffff', 'dunas', { textura: { tingir: 0.15, camadas: [{ textura: 'snow_01', escala: 2 }, { textura: 'snow010a', escala: 1.6, mascara: { freq: 0.25, limiar: 0.45, suave: 0.15, semente: 8 } }] } }),
  m('rocha.rachada', 'Rocha rachada', 'terreno', '#67717b', '#2e353c', '#9ba6b0', 'rachado'),
  // Maciço: rocha com volume (o assar do terreno dá relevo, estrias e sombra de contato; o padrão serve de amostra)
  m('rocha.cinza', 'Rocha cinza', 'macico', '#6b6f75', '#25282d', '#a4a9ae', 'pedra', { pe: 0.35 }),
  m('rocha.caverna', 'Rocha de caverna', 'macico', '#566069', '#1b2128', '#8fa1ad', 'pedra', { pe: 1 }),
  m('rocha.nevada', 'Rocha nevada', 'macico', '#77808a', '#2d343c', '#b4bec8', 'pedra', { topo: '#f1f6fa', pe: 0.35 }),
  m('rocha.arenito', 'Arenito', 'macico', '#b49a72', '#5e4a30', '#e0c9a0', 'pedra', { pe: 0.25 }),
  m('rocha.basalto', 'Basalto', 'macico', '#2a2a2e', '#0e0e10', '#4e4e56', 'liso'),
  m('rocha.cristal', 'Rocha com cristais', 'macico', '#3a3446', '#141018', '#6a6080', 'liso', { brilho: 0.6, veio: '#8a6aff' }),
  // Água: o assar pinta o leito pela distância à margem (raso → fundo); o padrão serve de amostra
  m('agua.mar', 'Mar', 'agua', '#2f6f86', '#0d2f45', '#8fd0e0', 'liso', { raso: '#58a8b8', fundo: '#0f3a54', espuma: '#f2fbff', transparencia: 0.12, ondas: 1 }),
  m('agua.lago', 'Lago', 'agua', '#2f7a78', '#0f3438', '#8fd8cc', 'liso', { raso: '#5fae9c', fundo: '#12404a', espuma: '#e6f6f0', transparencia: 0.18 }),
  m('agua.rio', 'Rio', 'agua', '#5aa0b0', '#1f5468', '#b4e4ec', 'liso', { raso: '#8cc8c8', fundo: '#2a6a80', espuma: '#f4fdff', transparencia: 0.25 }),
  // Lago de jardim (Q16d): água parada e funda, verde-escura, com pouca espuma; as carpas aparecem por baixo da superfície.
  m('agua.jardim', 'Lago de jardim', 'agua', '#225a64', '#0a2630', '#86c4c0', 'liso', { raso: '#3a7a7a', fundo: '#0a2c36', espuma: '#d8ece0', transparencia: 0.14, espumaForca: 0.18 }),
  m('agua.gruta', 'Água de gruta', 'agua', '#2aa8a0', '#0c4a52', '#9af0e0', 'liso', { raso: '#58d0c0', fundo: '#106068', espuma: '#d8fff4', transparencia: 0.85, causticas: true, espumaForca: 0.12 }),
  m('agua.pantano', 'Pântano', 'agua', '#5a6a38', '#222a14', '#98a468', 'liso', { raso: '#7a8444', fundo: '#2c3418', espuma: '#c4c88c', transparencia: 0.2 }),
  m('agua.arrozal', 'Arrozal alagado', 'agua', '#6a7448', '#2e3420', '#9aa070', 'liso', { raso: '#8a8a58', fundo: '#4a5030', espuma: '#d4d4b0', transparencia: 0.35, espumaForca: 0.2 }),
  m('agua.tropical', 'Água tropical', 'agua', '#3ab8b8', '#14607a', '#9af0e8', 'liso', { raso: '#5ad6c8', fundo: '#1a7894', espuma: '#f4fffc', transparencia: 0.62, causticas: true, ondas: 0.4 }),
  m('agua.acida', 'Água ácida', 'agua', '#6ac83a', '#2a5a14', '#c8ff8a', 'liso', { raso: '#8ae04a', fundo: '#2e6a18', espuma: '#d8ff9a', transparencia: 0.3, espumaForca: 0.2, brilho: 0.35 }),
  m('agua.esgoto', 'Esgoto', 'agua', '#4e4c36', '#24231a', '#7a7656', 'liso', { raso: '#5e5a40', fundo: '#2a281c', espuma: '#8a8468', transparencia: 0.05, espumaForca: 0.12 }),
  m('agua.lava', 'Lava', 'agua', '#c8461a', '#2a1610', '#ffb050', 'liso', { raso: '#ff8a2a', fundo: '#b8300c', espuma: '#ffd27a', transparencia: 0, espumaForca: 0, brilho: 1, lava: true }),
  m('agua.turfa', 'Água de turfa', 'agua', '#25313a', '#0a1116', '#5d727c', 'liso', { raso: '#3b4d55', fundo: '#0b1419', espuma: '#9aaab0', transparencia: 0.08, espumaForca: 0.12 }),
  m('cascalho', 'Cascalho', 'terreno', '#7a756c', '#3f3b36', '#b0aaa0', 'cascalho', { textura: { tingir: 0.6, camadas: [{ textura: 'gravel_floor', escala: 2.2 }, { textura: 'rocks_ground_02', escala: 1.2, mascara: { freq: 0.5, limiar: 0.6, suave: 0.08, semente: 11 } }] } }),
  m('paralelepipedo', 'Paralelepípedo', 'terreno', '#85878a', '#393c40', '#b8babc', 'paralelepipedo'),
  m('lajes.gramadas', 'Lajes com grama', 'terreno', '#8c8475', '#3b342b', '#bcb2a0', 'lajegrama'),
  m('lajes.escuras', 'Lajes escuras de salão', 'terreno', '#4a4f57', '#1e2126', '#737a84', 'lajes-grandes', { lado: 1.5 }),
  m('lajes.antigas', 'Lajes antigas', 'terreno', '#b3a487', '#5c5040', '#dccfb6', 'lajes-rusticas', { lado: 0.95 }),
  m('terra.sulcos', 'Terra arada', 'terreno', '#7a5a3a', '#3b2a1a', '#a1805a', 'sulcos'),
  m('areia.molhada', 'Areia molhada', 'terreno', '#9c855a', '#5a4a2c', '#d8c690', 'molhada', { textura: { tingir: 0.6, camadas: [{ textura: 'damp_beach_sand_02', escala: 1.4 }] } }),
  m('neve.pisada', 'Neve pisada', 'terreno', '#d3dae2', '#8693a3', '#f4f7fa', 'pisada', { textura: { tingir: 0.6, camadas: [{ textura: 'snow_01', escala: 1.4 }, { textura: 'snow_03', escala: 1.4, mascara: { freq: 0.45, limiar: 0.48, suave: 0.1, semente: 9 } }] } }),
  m('terra.congelada', 'Terra congelada', 'terreno', '#5e564c', '#2e2923', '#dfe4ea', 'terra', { textura: { tingir: 0.6, camadas: [{ textura: 'rocky_trail', escala: 1.5 }, { textura: 'snow_03', escala: 1.4, mascara: { freq: 0.4, limiar: 0.58, suave: 0.1, semente: 10 } }] } }),
  m('chao.batido', 'Chão batido', 'terreno', '#4c3e2f', '#2a2219', '#6a5a47', 'batido', { franja: 1, textura: { tingir: 0.6, camadas: [
    { textura: 'dirt_floor', escala: 1.5, tons: ['#2e261c', '#5a4c3a', '#857258'] },
    { textura: 'stony_dirt_path', escala: 1.3, mascara: { freq: 0.45, limiar: 0.52, suave: 0.08, semente: 1 }, tons: ['#2c2620', '#58503f', '#8a7f68'] },
    { textura: 'withered_grass', escala: 1.4, mascara: { freq: 0.35, limiar: 0.56, suave: 0.1, semente: 2 }, tons: ['#28231a', '#4e4632', '#786a4e'] },
  ] } }),
  m('chao.de.mata', 'Chão de mata', 'terreno', '#403a2b', '#1f1b14', '#5a5240', 'folhico', { franja: 1, textura: { tingir: 0.6, camadas: [
    { textura: 'forest_ground_04', escala: 1.5, tons: ['#201c15', '#463f30', '#6e654e'] },
    { textura: 'withered_grass', escala: 1.4, mascara: { freq: 0.3, limiar: 0.5, suave: 0.1, semente: 5 }, tons: ['#1e1e14', '#403e2c', '#665f44'] },
    { textura: 'leaves_forest_ground', escala: 1.6, mascara: { freq: 0.4, limiar: 0.55, suave: 0.08, semente: 3 }, tons: ['#241c14', '#4e3e2c', '#7a6446'] },
    { textura: 'ground068', escala: 1.2, mascara: { freq: 1.1, limiar: 0.63, suave: 0.05, semente: 4 }, tons: ['#1c2212', '#3c4826', '#64703e'] },
  ] } }),
  m('musgo', 'Musgo', 'terreno', '#3c4826', '#1c2212', '#64703e', 'grama', { franja: 1, textura: { tingir: 0.6, camadas: [{ textura: 'ground068', escala: 1.2 }] } }),
  // Selva, outono e cidade (Q8)
  m('chao.de.selva', 'Chão de selva', 'terreno', '#2a3420', '#10160c', '#46562e', 'folhico', { franja: 1, textura: { tingir: 0.7, camadas: [
    { textura: 'brown_mud_leaves_01', escala: 1.5, tons: ['#10160c', '#2a3420', '#4a5a30'] },
    { textura: 'forest_ground_04', escala: 1.4, mascara: { freq: 0.35, limiar: 0.58, suave: 0.1, semente: 21 }, tons: ['#141208', '#2e2818', '#4a4028'] },
  ] } }),
  m('folhas.outono', 'Folhas de outono', 'terreno', '#8a5226', '#3e2210', '#c8823a', 'folhico', { franja: 1, textura: { tingir: 0.35, camadas: [
    { textura: 'forest_floor', escala: 1.4, tons: ['#3a200e', '#8a5226', '#d08a3c'] },
    { textura: 'dry_decay_leaves', escala: 1.4, mascara: { freq: 0.4, limiar: 0.55, suave: 0.1, semente: 22 }, tons: ['#30200f', '#704020', '#a8683a'] },
  ] } }),
  m('grama.outono', 'Grama de outono', 'terreno', '#6e6a34', '#3c3818', '#9c9450', 'grama', { textura: { tingir: 0.6, camadas: [
    { textura: 'withered_grass', escala: 1.4 },
    { textura: 'dry_decay_leaves', escala: 1.4, mascara: { freq: 1.1, limiar: 0.5, suave: 0.12, semente: 23 }, tons: ['#30200f', '#76461f', '#ae6e36'] },
  ] } }),
  m('asfalto', 'Asfalto', 'terreno', '#424448', '#202124', '#686a70', 'liso', { textura: { tingir: 0.97, camadas: [{ textura: 'worn_asphalt', escala: 1.3 }] } }),
  m('asfalto.rachado', 'Asfalto rachado', 'terreno', '#3c3d40', '#18191b', '#56585c', 'rachado', { textura: { tingir: 0.95, camadas: [{ textura: 'road_damaged', escala: 1.3 }] } }),
  m('concreto.calcada', 'Calçada de concreto', 'terreno', '#8e8a84', '#4c4a46', '#b6b2aa', 'laje', { textura: { tingir: 0.8, camadas: [{ textura: 'concrete_pavement', escala: 1 }] } }),
  // Vulcão e subterrâneo (Q9)
  m('basalto', 'Basalto em colunas', 'terreno', '#3c3c40', '#18181b', '#6a6a70', 'basalto'),
  m('cinza.vulcanica', 'Cinza vulcânica', 'terreno', '#4a4846', '#262422', '#6e6a66', 'terra', { textura: { tingir: 0.95, camadas: [{ textura: 'moon_02', escala: 1 }] } }),
  m('chao.de.fungos', 'Chão de fungos', 'terreno', '#3a2c34', '#1a1218', '#5e4a56', 'folhico', { franja: 1, textura: { tingir: 0.75, camadas: [{ textura: 'mud_forest', escala: 1.5 }] } }),
  m('cristal.chao', 'Chão de cristal', 'terreno', '#5a4a8a', '#221a3e', '#c8b8ff', 'cristal'),
  // Deserto e sertão (Q7)
  m('areia.duna', 'Dunas', 'terreno', '#d2ac70', '#74481e', '#f4dca6', 'dunas-areia'),
  m('terra.rachada', 'Terra rachada', 'terreno', '#8a7458', '#4e3e2c', '#b49e7c', 'rachado', { textura: { tingir: 0.75, camadas: [{ textura: 'dry_ground_01', escala: 1.1 }] } }),
  m('laterita', 'Laterita', 'terreno', '#8a4428', '#4c2214', '#b0663e', 'terra', { textura: { tingir: 0.55, camadas: [{ textura: 'red_dirt_mud_01', escala: 1.5 }] } }),
  m('salina', 'Salina', 'terreno', '#d4cfc2', '#7e776a', '#f6f4ee', 'rachado', { textura: { tingir: 0.9, camadas: [{ textura: 'mud_cracked_dry_03', escala: 1.6 }] } }),
  m('piso.hangar', 'Concreto industrial', 'terreno', '#7d7c78', '#3a3936', '#a6a49f', 'placas', { lado: 3, ouro: '#c9a12a' }),
].map(([id, mat]) => [id as string, mat as Material])) as Record<string, Material>;

export const materialDe = (id: string): Material => {
  if (id.startsWith('#')) return { id, nome: id, uso: 'objeto', base: id, escuro: tom(id, -0.45), claro: tom(id, 0.3), padrao: 'liso' };
  if (id.startsWith('grama#') || id.startsWith('grama:')) {
    const raw = id.includes('#') ? id.slice(id.indexOf('#')) : '#' + id.slice(6);
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    return { id, nome: 'Grama personalizada', uso: 'terreno', base: hex, escuro: tom(hex, -0.45), claro: tom(hex, 0.35), padrao: 'grama' };
  }
  // `tapete.persa@3`: o mesmo material com um desenho escolhido.
  const arroba = id.indexOf('@');
  if (arroba > 0) { const base = MATERIAIS[id.slice(0, arroba)]; const d = Number(id.slice(arroba + 1)); if (base) return Number.isFinite(d) && d > 0 ? { ...base, id, desenho: Math.round(d) } : base; }
  return MATERIAIS[id] ?? MATERIAIS['pedra.escura']!;
};
export const materiaisDo = (uso: Material['uso']): Material[] => Object.values(MATERIAIS).filter(x => x.uso === uso);

/** Clareia (`t > 0`) ou escurece (`t < 0`) uma cor #rrggbb. */
export function tom(hex: string, t: number): string {
  const p = parseInt(hex.slice(1), 16), alvo = t < 0 ? 0 : 255, k = Math.abs(t);
  return '#' + [16, 8, 0].map(s => Math.round(((p >> s) & 255) * (1 - k) + alvo * k).toString(16).padStart(2, '0')).join('');
}
const misturar = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

// Poucas variações de ruído bastam: o padrão é deslocado e escalado em cada uso (gerar um ladrilho por parte levou o protótipo a 20 s).
const ruidos = new Map<string, ReturnType<typeof ladrilhoDeRuido>>();
function ruido(seed: number, celulas: number) {
  const s = ((seed % 5) + 5) % 5, k = `${s}:${celulas}`;
  let t = ruidos.get(k); if (!t) { t = ladrilhoDeRuido(256, s, celulas); ruidos.set(k, t); }
  return t;
}

export interface Area { x: number; y: number; w: number; h: number }

const PADROES_DEPENDENTES_DE_AREA = new Set<Padrao>([
  'tabuas', 'xadrez', 'laje', 'damasco', 'listras', 'veio', 'losango',
  'hexagono', 'floral', 'lambri', 'vidro', 'pregas', 'pintura',
  'grama', 'terra', 'lama', 'areia', 'pedra',
  // Giram com a direção do pincel em volta do centro da área: com a caixa de cada ladrilho, emendariam.
  'sulcos', 'dunas-areia',
  // O medalhão fica no centro do cômodo.
  'medalhao',
]);

/** Verdadeiro para padrões cujo layout, gradiente ou sorteios (`r()`) dependem da caixa `area` passada. */
export const padraoDependeDaArea = (padrao: Padrao): boolean => PADROES_DEPENDENTES_DE_AREA.has(padrao);

function camadaDeRuido(ctx: Contexto, area: Area, seed: number, metros: number, alpha: number, modo: GlobalCompositeOperation = 'multiply', celulas = 8): void {
  const padrao = ctx.createPattern(ruido(seed, celulas), 'repeat'); if (!padrao) return;
  padrao.setTransform(new DOMMatrix().translate(((seed * 0.37) % 1) * metros, ((seed * 0.61) % 1) * metros).scale(metros / 256));
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = modo; ctx.fillStyle = padrao; ctx.fillRect(area.x, area.y, area.w, area.h); ctx.restore();
}

/**
 * Renderizador Ilustrado: pinta o material em `area` (o contexto já está em metros e recortado).
 * `dir` gira o padrão (tábuas e veios seguem o comprimento do objeto).
 */
export function pintarMaterial(ctx: Contexto, id: string, area: Area, seed = 1, { dir = 0 }: { dir?: number } = {}): void {
  const mat = materialDe(id), r = mulberry32(seed * 7919 + 13);
  if (mat.textura && pintarComTextura(ctx, mat, area)) return;
  ctx.save();
  ctx.fillStyle = mat.base; ctx.fillRect(area.x, area.y, area.w, area.h);
  // As dunas giram as próprias coordenadas: com o canvas girado, o `porPixel` deixava uma faixa sem pintar.
  const giraCanvas = dir !== 0 && mat.padrao !== 'dunas-areia';
  if (giraCanvas) { const cx = area.x + area.w / 2, cy = area.y + area.h / 2; ctx.translate(cx, cy); ctx.rotate(dir); ctx.translate(-cx, -cy); }
  const diag = Math.hypot(area.w, area.h);
  const quadrado: Area = { x: area.x + area.w / 2 - diag / 2, y: area.y + area.h / 2 - diag / 2, w: diag, h: diag };
  const A: Area = giraCanvas || padraoDependeDaArea(mat.padrao) ? quadrado : area;
  switch (mat.padrao) {
    case 'tabuas': {
      for (const t of layoutDeTabuas(mat, A, r)) {
        ctx.fillStyle = misturar(mat.escuro, mat.claro, t.tom); ctx.fillRect(t.x, t.y, t.comp, t.larg);
        ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.006;
        for (const v of t.veios) { ctx.globalAlpha = v.alfa; ctx.beginPath(); ctx.moveTo(t.x, v.y); for (let k = 0; k < v.dy.length; k++) ctx.lineTo(t.x + (k + 1) * 0.2, v.y + v.dy[k]!); ctx.stroke(); }
        ctx.globalAlpha = 0.85; ctx.fillStyle = mat.escuro; ctx.fillRect(t.x + t.comp - 0.008, t.y, 0.012, t.larg);
        if (t.no) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(t.no.x, t.no.y, t.no.r, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        if (t.fimDaFileira) { ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.9; ctx.fillRect(A.x, t.y - 0.006, A.w, 0.012); ctx.globalAlpha = 1; }
      }
      camadaDeRuido(ctx, A, seed, 3, 0.35); break;
    }
    case 'xadrez': {
      const l = mat.lado ?? 0.5;
      // Com `borda`, as juntas entre as peças ganham essa cor (lajota de terracota com rejunte).
      if (mat.borda) { ctx.fillStyle = mat.borda; ctx.fillRect(A.x, A.y, A.w, A.h); }
      for (let y = Math.floor(A.y / l) * l; y < A.y + A.h; y += l) for (let x = Math.floor(A.x / l) * l; x < A.x + A.w; x += l) {
        const escuro = (Math.round(x / l) + Math.round(y / l)) % 2 === 0;
        ctx.fillStyle = misturar(escuro ? mat.escuro : mat.base, escuro ? mat.base : mat.claro, r() * 0.12); ctx.fillRect(x + (mat.borda ? 0.01 : 0.006), y + (mat.borda ? 0.01 : 0.006), l - (mat.borda ? 0.02 : 0.012), l - (mat.borda ? 0.02 : 0.012));
      }
      camadaDeRuido(ctx, A, seed, 2.2, 0.45); camadaDeRuido(ctx, A, seed + 3, 6, 0.3, 'multiply', 4); break;
    }
    case 'laje': {
      // Lajes irregulares: fileiras de alturas diferentes, juntas escuras.
      for (const l of layoutDeLajes(A, r)) {
        if (l.fileira) { ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.7; ctx.fillRect(A.x, l.y, A.w, 0.02); ctx.globalAlpha = 1; continue; }
        ctx.fillStyle = misturar(mat.base, mat.claro, l.tom); ctx.fillRect(l.x + 0.012, l.y + 0.012, l.comp - 0.024, l.alt - 0.024);
      }
      camadaDeRuido(ctx, A, seed, 1.4, 0.5, 'multiply', 6); break;
    }
    case 'damasco': {
      camadaDeRuido(ctx, A, seed, 2, 0.3); ctx.fillStyle = mat.claro;
      for (let y = A.y; y < A.y + A.h + 0.5; y += 0.52) for (let x = A.x; x < A.x + A.w + 0.5; x += 0.42) {
        const cx = x + (Math.round(y / 0.52) % 2 ? 0.21 : 0), cy = y;
        ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(cx, cy - 0.17); ctx.bezierCurveTo(cx + 0.12, cy - 0.08, cx + 0.12, cy + 0.06, cx, cy + 0.17); ctx.bezierCurveTo(cx - 0.12, cy + 0.06, cx - 0.12, cy - 0.08, cx, cy - 0.17); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(cx, cy, 0.035, 0, 7); ctx.fillStyle = mat.escuro; ctx.fill(); ctx.fillStyle = mat.claro;
      }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed + 1, 4, 0.4, 'multiply', 4); break;
    }
    case 'listras': {
      for (let x = A.x, k = 0; x < A.x + A.w; x += 0.12, k++) { ctx.fillStyle = k % 2 ? mat.claro : mat.base; ctx.globalAlpha = 0.7; ctx.fillRect(x, A.y, 0.12, A.h); }
      ctx.globalAlpha = 0.55; ctx.fillStyle = mat.ouro ?? mat.claro; for (let x = A.x; x < A.x + A.w; x += 0.48) ctx.fillRect(x, A.y, 0.012, A.h);
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed, 3, 0.4, 'multiply', 4); break;
    }
    case 'veio': {
      ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.008;
      for (let y = A.y; y < A.y + A.h; y += 0.025) { ctx.globalAlpha = 0.15 + r() * 0.25; ctx.beginPath(); ctx.moveTo(A.x, y); for (let x = A.x; x < A.x + A.w; x += 0.15) ctx.lineTo(x, y + Math.sin(x * 3 + y * 9) * 0.008); ctx.stroke(); }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed, 1.5, 0.3); break;
    }
    case 'espinha': pintarEspinha(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'marmore': pintarMarmore(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'marchetaria': pintarMarchetaria(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'losango': {
      // Xadrez em diagonal (mármore preto e branco).
      const l = mat.lado ?? 0.5, cx = A.x + A.w / 2, cy = A.y + A.h / 2, n = Math.ceil(diag / l / 2) + 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) { const escuro = (i + j) % 2 === 0; ctx.fillStyle = misturar(escuro ? mat.escuro : mat.base, escuro ? mat.base : mat.claro, r() * 0.14); ctx.fillRect(i * l + 0.005, j * l + 0.005, l - 0.01, l - 0.01); }
      ctx.restore(); camadaDeRuido(ctx, A, seed, 2.2, 0.4); break;
    }
    case 'hexagono': {
      const R = mat.lado ?? 0.2, dx = R * 1.732, dy = R * 1.5;
      for (let j = Math.floor(A.y / dy) - 1; j * dy < A.y + A.h + dy; j++) for (let i = Math.floor(A.x / dx) - 1; i * dx < A.x + A.w + dx; i++) {
        const cx = i * dx + (j % 2 ? dx / 2 : 0), cy = j * dy; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (R - 0.01), cy + Math.sin(a) * (R - 0.01)); }
        ctx.closePath(); ctx.fillStyle = misturar(mat.base, r() < 0.5 ? mat.claro : mat.escuro, r() * 0.35); ctx.fill();
      }
      camadaDeRuido(ctx, A, seed, 1.8, 0.4, 'multiply', 6); break;
    }
    case 'floral': {
      // Papel de parede florido: flores de cinco pétalas em meia-queda, com folhas.
      camadaDeRuido(ctx, A, seed, 2, 0.25);
      for (let y = A.y; y < A.y + A.h + 0.4; y += 0.34) for (let x = A.x; x < A.x + A.w + 0.4; x += 0.34) {
        const cx = x + (Math.round(y / 0.34) % 2 ? 0.17 : 0) + (r() - 0.5) * 0.02, cy = y;
        ctx.globalAlpha = 0.5; ctx.fillStyle = mat.escuro; for (const a of [0.8, 2.4]) { ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 0.08, cy + Math.sin(a) * 0.08, 0.05, 0.022, a, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.75; ctx.fillStyle = mat.claro; for (let k = 0; k < 5; k++) { const a = (k * Math.PI * 2) / 5; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 0.04, cy + Math.sin(a) * 0.04, 0.032, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.9; ctx.fillStyle = mat.ouro ?? mat.escuro; ctx.beginPath(); ctx.arc(cx, cy, 0.016, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed + 1, 4, 0.35, 'multiply', 4); break;
    }
    case 'lambri': {
      // Boiserie: painéis de madeira com moldura, em duas fileiras, e rodapé.
      const w = 0.62, h = 1.1;
      for (let x = A.x; x < A.x + A.w; x += w + 0.06) for (let y = A.y; y < A.y + A.h; y += h + 0.06) {
        ctx.fillStyle = misturar(mat.base, mat.claro, 0.15 + r() * 0.15); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.8; ctx.strokeRect(x + 0.05, y + 0.05, w - 0.1, h - 0.1);
        ctx.strokeStyle = mat.claro; ctx.globalAlpha = 0.4; ctx.strokeRect(x + 0.075, y + 0.075, w - 0.15, h - 0.15); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.6; for (let y = A.y; y < A.y + A.h; y += h + 0.06) ctx.fillRect(A.x, y + h, A.w, 0.06); ctx.globalAlpha = 1;
      camadaDeRuido(ctx, A, seed, 1.8, 0.4); break;
    }
    case 'trama': camadaDeRuido(ctx, A, seed, 0.6, 0.35, 'multiply', 16); camadaDeRuido(ctx, A, seed + 2, 2, 0.25, 'soft-light'); break;
    case 'couro': camadaDeRuido(ctx, A, seed, 0.8, 0.4, 'multiply', 12); break;
    case 'metal': camadaDeRuido(ctx, A, seed, 0.5, 0.3, 'overlay', 6); break;
    case 'vidro': { const g = ctx.createLinearGradient(A.x, A.y, A.x + A.w, A.y + A.h); g.addColorStop(0, mat.escuro); g.addColorStop(0.5, mat.base); g.addColorStop(1, mat.claro); ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); break; }
    case 'pregas': {
      for (let x = A.x; x < A.x + A.w; x += 0.09) { const g = ctx.createLinearGradient(x, 0, x + 0.09, 0); g.addColorStop(0, mat.escuro); g.addColorStop(0.5, mat.claro); g.addColorStop(1, mat.escuro); ctx.fillStyle = g; ctx.globalAlpha = 0.6; ctx.fillRect(x, A.y, 0.09, A.h); }
      ctx.globalAlpha = 1; break;
    }
    case 'pintura': { const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, '#3a4a5a'); g.addColorStop(0.55, '#8a7a5a'); g.addColorStop(0.6, '#2a3a2a'); g.addColorStop(1, '#141c18'); ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 0.4, 0.5, 'overlay', 8); break; }
    case 'persa': pintarPersa(ctx, mat, area, r); break;
    case 'grama': {
      camadaDeRuido(ctx, A, seed, 1.2, 0.5, 'multiply', 8);
      for (let i = 0; i < Math.min(4000, (A.w * A.h) * 18); i++) { ctx.fillStyle = misturar(mat.escuro, mat.claro, r()); ctx.globalAlpha = 0.25 + r() * 0.35; ctx.fillRect(A.x + r() * A.w, A.y + r() * A.h, 0.02, 0.07 + r() * 0.06); }
      ctx.globalAlpha = 1; break;
    }
    case 'terra': case 'lama': case 'areia': {
      camadaDeRuido(ctx, A, seed, mat.padrao === 'areia' ? 0.9 : 1.6, 0.55, 'multiply', 10); camadaDeRuido(ctx, A, seed + 2, 5, 0.3, 'overlay', 5);
      for (let i = 0; i < Math.min(1500, A.w * A.h * 6); i++) { ctx.fillStyle = r() < 0.5 ? mat.escuro : mat.claro; ctx.globalAlpha = 0.2 + r() * 0.3; ctx.beginPath(); ctx.arc(A.x + r() * A.w, A.y + r() * A.h, 0.012 + r() * 0.03, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
    case 'pedra': {
      camadaDeRuido(ctx, A, seed, 0.9, 0.5, 'multiply', 8);
      for (let i = 0; i < Math.min(900, A.w * A.h * 3); i++) { const cx = A.x + r() * A.w, cy = A.y + r() * A.h, rr = 0.04 + r() * 0.12; ctx.fillStyle = misturar(mat.escuro, mat.claro, r()); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
    case 'gelo': pintarGelo(ctx, mat, A, seed, r, pxDe(ctx)); break;
    case 'mosaico': pintarMosaico(ctx, mat, A, seed, false); break;
    case 'medalhao': pintarMosaico(ctx, mat, A, seed, true); break;
    case 'tatami': pintarTatami(ctx, mat, A, seed); break;
    case 'zellige': pintarZellige(ctx, mat, A, seed); break;
    case 'pompeiano': pintarPompeiano(ctx, mat, A, seed); break;
    case 'hieroglifos': pintarHieroglifos(ctx, mat, A, seed); break;
    case 'shoji': pintarShoji(ctx, mat, A, seed); break;
    case 'taipa': pintarTaipa(ctx, mat, A, seed); break;
    case 'conves': pintarConves(ctx, mat, A, seed); break;
    case 'hidraulico': pintarHidraulico(ctx, mat, A, seed); break;
    case 'enxaimel': pintarEnxaimel(ctx, mat, A, seed); break;
    case 'descascado': pintarDescascado(ctx, mat, A, seed); break;
    case 'azulejo': pintarAzulejo(ctx, mat, A, seed); break;
    case 'neon': pintarNeon(ctx, mat, A, seed); break;
    case 'pichado': pintarPichado(ctx, mat, A, seed); break;
    case 'ferrugem': pintarFerrugem(ctx, mat, A, seed); break;
    case 'metro': pintarMetro(ctx, mat, A, seed); break;
    case 'basalto': pintarCelulas(ctx, mat, A, seed, 'basalto'); break;
    case 'cristal': pintarCelulas(ctx, mat, A, seed, 'cristal'); break;
    case 'dunas-areia': camadaDeRuido(ctx, A, seed, 3, 0.1, 'multiply', 6); pintarDunasDeAreia(ctx, mat, area, seed, dir); break;
    case 'dunas': camadaDeRuido(ctx, A, seed, 2.5, 0.16, 'multiply', 6); camadaDeRuido(ctx, A, seed + 1, 0.7, 0.2, 'soft-light', 10); pintarDunas(ctx, mat, A, seed); break;
    case 'rachado': pintarRachado(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'cascalho': pintarCascalho(ctx, mat, A, seed); break;
    case 'paralelepipedo': pintarParalelepipedo(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'lajegrama': pintarLajesGramadas(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'sulcos': pintarSulcos(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'molhada': pintarAreiaMolhada(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'palha-chao': pintarPalhaNoChao(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'lajes-rusticas': pintarLajesRusticas(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'lajes-grandes': pintarLajesGrandes(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'chapa-xadrez': pintarChapaXadrez(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'grade-metal': pintarGradeMetal(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'toras': pintarToras(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'manchado': pintarManchado(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'painel': pintarPainel(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'acolchoado': pintarAcolchoado(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'pisada': pintarNevePisada(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'placas': pintarPlacas(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'batido': pintarChaoBatido(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'folhico': pintarChaoDeMata(ctx, mat, A, seed, pxDe(ctx)); break;
    case 'neve': pintarNeve(ctx, mat, A, seed); break;
    default:
      if (ehPadraoDeCobertura(mat.padrao)) { pintarCobertura(ctx, mat, A, seed); break; }
      camadaDeRuido(ctx, A, seed, 2, 0.15);
  }
  ctx.restore();
}

/** Cobertura de telhado no Ilustrado: o ladrilho periódico de coberturas.ts como padrão, em metros. */
function pintarCobertura(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const { tela, metros } = texturaDeCobertura(mat, 'illustrated', seed), padrao = ctx.createPattern(tela as CanvasImageSource, 'repeat'); if (!padrao) return;
  padrao.setTransform(new DOMMatrix().scale(metros / tela.width));
  ctx.save(); ctx.fillStyle = padrao; ctx.fillRect(A.x, A.y, A.w, A.h); ctx.restore();
}

// ---------- Materiais de natureza: pintados pixel a pixel (sombreamento de verdade), em metros ----------
const rgbHex = (h: string): [number, number, number] => { const q = parseInt(h.slice(1), 16); return [(q >> 16) & 255, (q >> 8) & 255, q & 255]; };
const passo = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Tamanho de um pixel do dispositivo, em metros locais. */
export const pxDe = (ctx: Contexto): number => 1 / (Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1);
type Cor3 = [number, number, number];
/** `o` ← a mistura de `a` e `b` (t = 0 dá `a`). */
const mez = (o: number[], a: Cor3, b: Cor3, t: number): void => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; };
/** `o` ← a cor `c` escurecida (k < 1) ou clareada (k > 1). */
const tomDe = (o: number[], c: Cor3, k: number): void => { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; };

/** Recorta `A` à área visível da tela destino (quando não há rotação) para evitar amostrar grades de ruído fora do ladrilho. */
function areaDeAmostragem(ctx: Contexto, A: Area): Area {
  const telaAlvo = 'canvas' in ctx ? (ctx as { canvas?: { width: number; height: number } }).canvas : undefined;
  if (telaAlvo && typeof ctx.getTransform === 'function') {
    const m = ctx.getTransform();
    if (m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0) {
      const x0 = Math.max(A.x, -m.e / m.a);
      const y0 = Math.max(A.y, -m.f / m.d);
      const x1 = Math.min(A.x + A.w, (telaAlvo.width - m.e) / m.a);
      const y1 = Math.min(A.y + A.h, (telaAlvo.height - m.f) / m.d);
      if (x1 > x0 && y1 > y0) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
  }
  return A;
}

/**
 * Pinta `A` pixel a pixel numa tela do tamanho do dispositivo e a desenha. `fn(x, y, o)` recebe o ponto em metros e escreve
 * `o = [r, g, b, a]` (alfa começa em 255). A resolução segue a matriz do contexto, com um teto de ~9 milhões de pixels.
 */
function porPixel(ctx: Contexto, A: Area, fn: (x: number, y: number, o: number[]) => void): void {
  let s = pxDe(ctx) ** -1;
  if (A.w * A.h * s * s > 9e6) s = Math.sqrt(9e6 / (A.w * A.h));
  const Wfull = Math.max(1, Math.ceil(A.w * s)), Hfull = Math.max(1, Math.ceil(A.h * s));
  let i0 = 0, j0 = 0, i1 = Wfull, j1 = Hfull;
  const telaAlvo = 'canvas' in ctx ? (ctx as { canvas?: { width: number; height: number } }).canvas : undefined;
  if (telaAlvo && typeof ctx.getTransform === 'function') {
    const m = ctx.getTransform();
    if (m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0) {
      i0 = Math.max(0, Math.floor((-m.e / m.a - A.x) * s));
      j0 = Math.max(0, Math.floor((-m.f / m.d - A.y) * s));
      i1 = Math.min(Wfull, Math.ceil(((telaAlvo.width - m.e) / m.a - A.x) * s));
      j1 = Math.min(Hfull, Math.ceil(((telaAlvo.height - m.f) / m.d - A.y) * s));
      if (i1 <= i0 || j1 <= j0) return;
    }
  }
  const W = i1 - i0, H = j1 - j0, tela = criarTela(W, H), c = contextoDe(tela), img = c.createImageData(W, H), d = img.data, o = [0, 0, 0, 255];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    o[3] = 255; fn(A.x + (i0 + i + 0.5) / s, A.y + (j0 + j + 0.5) / s, o);
    const k = (j * W + i) * 4; d[k] = o[0]!; d[k + 1] = o[1]!; d[k + 2] = o[2]!; d[k + 3] = o[3]!;
  }
  c.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(tela as CanvasImageSource, A.x + i0 / s, A.y + j0 / s, W / s, H / s); ctx.restore();
}

// ---------- Terreno com textura (Frente P): foto CC0 em ladrilho, sem repetição visível, puxada para a paleta ----------
interface TexturaReduzida { fonte: Pixels; cor: Pixels; alt?: Pixels; metros: number; tom: Tom; tomAlt?: Tom }
const reduzidas = new Map<string, TexturaReduzida>();

/** A textura `id` reduzida para ler a 1 a 2 texels por pixel de `res` px/m (com a `escala` da camada); `undefined` se não carregou. */
function texturaParaPintar(id: string, escala: number, res: number): TexturaReduzida | undefined {
  const t = texturaPronta(id); if (!t) return undefined;
  const fator = Math.max(1, 2 ** Math.floor(Math.log2(t.cor.largura / (t.metros * escala) / res))), k = `${id}@${fator}`;
  let r = reduzidas.get(k);
  if (!r || r.fonte !== t.cor) {
    const cor = reduzirTextura(t.cor, fator), alt = t.alt ? reduzirTextura(t.alt, fator) : undefined;
    r = { fonte: t.cor, cor, alt, metros: t.metros, tom: tomDaTextura(cor), tomAlt: alt ? tomDaTextura(alt, true) : undefined };
    reduzidas.set(k, r);
  }
  return r;
}

/** Afrouxa a normalização de tom (±2,6 desvios em vez de ±2 cobrem a paleta): a 32 px/m o grão da foto vira chiado se tiver contraste cheio. */
const CONTRASTE_FINO = 1.3;
interface CamadaPronta { c: CamadaDeTextura; t: TexturaReduzida; tom: Tom; ppm: number; E: Cor3; B: Cor3; C: Cor3; dx: number; dy: number }

/** As camadas da receita prontas para pintar, ou `null` se alguma textura ainda não carregou (aí vale o `padrao`). */
function camadasProntas(mat: Material, res: number): CamadaPronta[] | null {
  const rec = mat.textura; if (!rec?.camadas.length) return null;
  const out: CamadaPronta[] = [];
  for (const [i, c] of rec.camadas.entries()) {
    const escala = c.escala ?? 1, t = texturaParaPintar(c.textura, escala, res); if (!t) return null;
    const [e, b, cl] = c.tons ?? [mat.escuro, mat.base, mat.claro];
    // Deslocamento fixo por camada (não pela semente): o mesmo material casa na base e nas camadas pintadas por cima.
    out.push({ c, t, tom: { media: t.tom.media, desvio: t.tom.desvio * CONTRASTE_FINO }, ppm: t.cor.largura / (t.metros * escala), E: rgbHex(e), B: rgbHex(b), C: rgbHex(cl), dx: 17.3 * (i + 1), dy: 5.9 * (i + 1) });
  }
  return out;
}

/** O material tem textura e ela já carregou (neste contexto: página ou worker)? */
export const texturaDisponivel = (mat: Material, res = 32): boolean => camadasProntas(mat, res) !== null;

const lum = (o: ArrayLike<number>): number => 0.2126 * o[0]! + 0.7152 * o[1]! + 0.0722 * o[2]!;
const RUIDO_DE_TEXTURA = valueNoise2D(4243), RUIDO_DE_MASCARA = valueNoise2D(4271);
const mascaraDeTextura = (x: number, y: number): number => fbm(RUIDO_DE_MASCARA, x, y, 4);

/** Chama `f(camada, peso)` para as camadas que cobrem (x, y), da base para cima; a base tem peso 1. */
function cadaCamada(cs: readonly CamadaPronta[], x: number, y: number, f: (L: CamadaPronta, w: number, i: number) => void): void {
  for (let i = 0; i < cs.length; i++) { const L = cs[i]!, w = i === 0 ? 1 : pesoDaCamada(L.c, x, y, mascaraDeTextura); if (w > 0) f(L, w, i); }
}

/**
 * Ilustrado: pinta `area` pela receita de textura (P3): cada camada é lida sem repetição, levada à sua paleta pela luminância
 * normalizada e misturada pela máscara. Devolve `false` (e não pinta) se alguma textura não carregou.
 */
function pintarComTextura(ctx: Contexto, mat: Material, area: Area): boolean {
  const cs = camadasProntas(mat, 1 / pxDe(ctx)); if (!cs) return false;
  const tingir = mat.textura!.tingir, tmp = [0, 0, 0, 255], cru = [0, 0, 0];
  porPixel(ctx, areaDeAmostragem(ctx, area), (x, y, o) => {
    cadaCamada(cs, x, y, (L, w, i) => {
      const alvo = i === 0 ? o : tmp;
      amostrarSemRepeticao(L.t.cor, L.ppm, x + L.dx, y + L.dy, RUIDO_DE_TEXTURA, alvo);
      cru[0] = alvo[0]!; cru[1] = alvo[1]!; cru[2] = alvo[2]!;
      mapaDeGradiente(alvo, L.E, L.B, L.C, 1, L.tom);
      // O que sobra do `tingir` traz o matiz da foto, mas com a luminância da paleta (a foto crua é bem mais clara que o chão do Atlas).
      if (tingir < 1) { const k = (lum(alvo) + 1) / (lum(cru) + 1); cru[0] *= k; cru[1] *= k; cru[2] *= k; rumo(alvo, cru, 1 - tingir); }
      if (i > 0) rumo(o, tmp, w);
    });
    o[3] = 255;
  });
  return true;
}

/**
 * Altura do terreno com textura: plano, com os pontos altos do deslocamento da camada dominante (pedrisco, torrão, folha)
 * erguidos um nível só. Nada de rampa: no mapa de 8 bits ela vira curva de nível, e a luminância vira escama.
 */
export function pintarAlturaComTextura(ctx: Contexto, mat: Material, area: Area): boolean {
  const cs = camadasProntas(mat, 1 / pxDe(ctx)); if (!cs) return false;
  const tmp = [0, 0, 0, 255], piso = Math.round(PISO * 255), alto = piso + 1;
  porPixel(ctx, areaDeAmostragem(ctx, area), (x, y, o) => {
    let dom: CamadaPronta = cs[0]!;
    cadaCamada(cs, x, y, (L, w) => { if (w >= 0.5) dom = L; });
    let h = piso;
    if (dom.t.alt && dom.t.tomAlt) {
      amostrarSemRepeticao(dom.t.alt, dom.ppm, x + dom.dx, y + dom.dy, RUIDO_DE_TEXTURA, tmp);
      if ((tmp[0]! / 255 - dom.t.tomAlt.media) / Math.max(1e-3, dom.t.tomAlt.desvio) > 1.2) h = alto;
    }
    o[0] = h; o[1] = 0; o[2] = 0;
  });
  return true;
}

const novaConsulta = (): Consulta => ({ f1: 0, f2: 0, borda: 0, sitio: { x: 0, y: 0, i: 0, j: 0, azar: 0 } });

/** Rocha rachada: placas de Voronoi (0,45 m) com tom próprio, bisel claro do lado da luz, sombra de oclusão e fendas escuras; fendas maiores por cima. */
function pintarRachado(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 31 + 5), V1 = celulasDeVoronoi(A, 0.9, seed * 13 + 1), V2 = celulasDeVoronoi(A, 1.9, seed * 13 + 2), q1 = novaConsulta(), q2 = novaConsulta();
  const E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), w = Math.max(0.016, px * 1.25), tmp = [0, 0, 0];
  const nLargo = campoDeRuido(rn, areaDeAmostragem(ctx, A), 0.5, 3, undefined, 90, 0);
  porPixel(ctx, A, (x, y, o) => {
    const xx = x + (fbm(rn, x * 2.4, y * 2.4, 2) - 0.5) * 0.17, yy = y + (fbm(rn, x * 2.4 + 37, y * 2.4 + 11, 2) - 0.5) * 0.17;
    V1.consultar(xx, yy, q1);
    const lado = (q1.sitio.x - xx) + (q1.sitio.y - yy);            // > 0: o ponto está acima e à esquerda do centro da placa (de frente para a luz)
    let t = 0.38 + 0.2 * q1.sitio.azar + lado / 0.9 * 0.08 - q1.f1 / 0.9 * 0.1;
    t += (fbm(rn, x * 3.1, y * 3.1, 4) - 0.5) * 0.5 + (nLargo(x, y) - 0.5) * 0.75 + (hash2D(Math.floor(x / px), Math.floor(y / px), 3) - 0.5) * 0.05;
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    const b = q1.borda, frente = passo(-0.04, 0.12, lado);
    const ao = (1 - passo(w, w * 5, b)) * (0.12 + 0.16 * (1 - frente));
    const bisel = passo(w * 0.5, w * 1.2, b) * (1 - passo(w * 1.2, w * 4.5, b)) * frente * 0.4;
    o[0] = o[0]! * (1 - ao) + (C[0] - o[0]!) * bisel; o[1] = o[1]! * (1 - ao) + (C[1] - o[1]!) * bisel; o[2] = o[2]! * (1 - ao) + (C[2] - o[2]!) * bisel;
    tomDe(tmp, E, 0.55); const ck = (1 - passo(w * 0.3, w, b)) * 0.55;
    o[0] = o[0]! + (tmp[0]! - o[0]!) * ck; o[1] = o[1]! + (tmp[1]! - o[1]!) * ck; o[2] = o[2]! + (tmp[2]! - o[2]!) * ck;
    V2.consultar(x + (fbm(rn, x * 1.1 + 5, y * 1.1, 2) - 0.5) * 0.5, y + (fbm(rn, x * 1.1, y * 1.1 + 5, 2) - 0.5) * 0.5, q2);
    const g = (1 - passo(w * 0.3, w * 1.1, q2.borda)) * 0.4, aog = (1 - passo(w * 1.1, w * 6, q2.borda)) * 0.1;
    tomDe(tmp, E, 0.35); o[0] = (o[0]! * (1 - aog)) + (tmp[0]! - o[0]! * (1 - aog)) * g; o[1] = (o[1]! * (1 - aog)) + (tmp[1]! - o[1]! * (1 - aog)) * g; o[2] = (o[2]! * (1 - aog)) + (tmp[2]! - o[2]! * (1 - aog)) * g;
  });
}

/** Gelo: manchas largas de azul fundo e claro com bordas macias, geada difusa em faixas, poucas rachaduras quebradas que ramificam (traço claro com fio escuro ao lado). */
function pintarGelo(ctx: Contexto, mat: Material, A: Area, seed: number, r: () => number, px: number): void {
  const rn = valueNoise2D(seed * 17 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), fundo: Cor3 = [E[0] * 0.78, E[1] * 0.82, E[2] * 0.95], tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    const n1 = fbm(rn, x * 0.3, y * 0.3, 4), n2 = fbm(rn, x * 0.8 + 50, y * 0.8 + 9, 4), n3 = fbm(rn, x * 7, y * 7, 2);
    mez(o, B, E, 0.62 * passo(0.3, 0.68, n1)); mez(tmp, [o[0]!, o[1]!, o[2]!], fundo, 0.45 * passo(0.6, 0.88, n1));
    mez(o, [tmp[0]!, tmp[1]!, tmp[2]!], C, 0.8 * passo(0.4, 0.8, 1 - n1) * passo(0.35, 0.8, n2) + (n3 - 0.5) * 0.08);
    const a = (x - y) * 0.7071, b = (x + y) * 0.7071;
    const geada = passo(0.55, 0.88, fbm(rn, a * 3.2 + 300, b * 1.1, 3)) * 0.26 * (0.5 + 0.5 * passo(0.3, 0.7, n2)) + passo(0.8, 0.97, fbm(rn, a * 14 + 90, b * 0.6, 2)) * 0.12;
    mez(tmp, [o[0]!, o[1]!, o[2]!], C, Math.min(0.8, geada)); o[0] = tmp[0]!; o[1] = tmp[1]!; o[2] = tmp[2]!;
    if (hash2D(Math.floor(x / (px * 1.2)), Math.floor(y / (px * 1.2)), 11) > 0.998) mez(o, [o[0]!, o[1]!, o[2]!], [255, 255, 255], 0.85);
  });
  const trilhas: { pts: [number, number][]; prof: number }[] = [];
  const crescer = (x: number, y: number, ang: number, comp: number, prof: number): void => {
    const pts: [number, number][] = [[x, y]]; let a = ang;
    for (let d = 0; d < comp;) {
      const st = 0.18 + r() * 0.4; a += (r() - 0.5) * 0.18 + (r() < 0.28 ? (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.7) : 0); x += Math.cos(a) * st; y += Math.sin(a) * st; d += st; pts.push([x, y]);
      if (prof < 2 && r() < 0.16) crescer(x, y, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.9), (comp - d) * 0.65, prof + 1);
    }
    trilhas.push({ pts, prof });
  };
  for (let i = 0, n = Math.min(260, Math.round((A.w * A.h) / 7)); i < n; i++) crescer(A.x + r() * A.w, A.y + r() * A.h, r() * 6.283, 1 + r() * 2.8, 0);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // Cada segmento tem espessura própria (afina nas pontas e nos ramos); passada escura deslocada e passada clara por cima.
  const tracar = (cor: string, alfa: number, larg: number, dx: number) => {
    ctx.strokeStyle = cor; ctx.globalAlpha = alfa;
    for (const t of trilhas) for (let k = 1; k < t.pts.length; k++) {
      const f = Math.sin((k / t.pts.length) * Math.PI) ** 0.6, v = 0.6 + 0.9 * hash2D(Math.round(t.pts[k]![0] * 50), Math.round(t.pts[k]![1] * 50), 4);
      ctx.lineWidth = Math.max(px * 0.6, larg * v * f * (t.prof === 0 ? 1 : 0.65)); ctx.beginPath(); ctx.moveTo(t.pts[k - 1]![0] + dx, t.pts[k - 1]![1] + dx); ctx.lineTo(t.pts[k]![0] + dx, t.pts[k]![1] + dx); ctx.stroke();
    }
  };
  tracar(mat.escuro, 0.45, px * 1.3, px * 1.5); tracar(mat.claro, 0.85, px * 2.1, 0);
  ctx.restore();
}

/** Neve padrão: ondas de vento suaves em baixa frequência com brilho frio (#ffffff) e sombra azulada sutil, sem ruído denso de grama. */
function pintarNeve(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const rn = valueNoise2D(seed * 13 + 5), E = rgbHex(mat.escuro), C = rgbHex(mat.claro);
  const S: Cor3 = [Math.round((E[0] + 200) * 0.5), Math.round((E[1] + 214) * 0.5), Math.round((E[2] + 230) * 0.5)];
  const ang = 0.28 + (seed % 7) * 0.08, ux = Math.cos(ang), uy = Math.sin(ang);
  const R = areaDeAmostragem(ctx, A);
  const cAmpl = campoDeRuido(rn, R, 0.14, 2, undefined, 30, 70);
  const cWarp = campoDeRuido(rn, R, 0.16, 3, undefined, 15, 5);
  const cPer = campoDeRuido(rn, R, 0.11, 2);
  const cDet = campoDeRuido(rn, R, 0.85, 2);
  porPixel(ctx, A, (x, y, o) => {
    const ampl = 0.45 + 0.55 * passo(0.3, 0.7, cAmpl(x, y));
    const warp = (cWarp(x, y) - 0.5) * 3.2;
    const per = 3.4 + (cPer(x, y) - 0.5) * 1.1;
    let ph = (x * ux + y * uy + warp) / per; ph -= Math.floor(ph);
    // Perfil suave de ondulação batida pelo vento: subida gradual até 0.72 e queda macia
    let v = ph < 0.72 ? Math.sin((ph / 0.72) * Math.PI - Math.PI * 0.5) * 0.36 : Math.sin(((1 - ph) / 0.28) * Math.PI - Math.PI * 0.5) * 0.42;
    v = v * ampl + (cDet(x, y) - 0.5) * 0.14;
    if (v < 0) {
      o[0] = S[0]; o[1] = S[1]; o[2] = S[2]; o[3] = Math.min(68, Math.round(-v * 110));
    } else {
      o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; o[3] = Math.min(82, Math.round(v * 135));
    }
  });
}

/** Neve funda: por cima da neve de sempre, cristas de vento (subida suave clara, queda curta em sombra azul) em faixas de 2 a 4 m, mais marolas finas. */
/**
 * Dunas de areia vistas de cima: cristas a cada 4 a 6 m, perpendiculares ao vento (a direção do pincel), com o barlavento longo e claro,
 * riscado de ondulações finas de vento, e a face de avalanche curta e em sombra depois da crista. As cristas ondulam e se bifurcam pelo
 * ruído que entorta a coordenada.
 */
function pintarDunasDeAreia(ctx: Contexto, mat: Material, A: Area, seed: number, dir = 0): void {
  const cd = Math.cos(dir), sd = Math.sin(dir);
  const rn = valueNoise2D(seed * 23 + 5), E = rgbHex(mat.escuro), C = rgbHex(mat.claro);
  // Ruído contínuo (não o campo amostrado em grade): a crista é uma transição nítida e mostraria os degraus da interpolação.
  porPixel(ctx, A, (xm, ym, o) => {
    // Coordenadas no referencial do vento: as cristas correm ao longo de x.
    const x = xm * cd + ym * sd, y = -xm * sd + ym * cd;
    const warp = (fbm(rn, x * 0.07 + 40, y * 0.07, 3) - 0.5) * 4.5 + (fbm(rn, x * 0.4 + 3, y * 0.4 + 17, 2) - 0.5) * 0.7, per = 4.4 + (fbm(rn, x * 0.12 + 7, y * 0.12 + 90, 2) - 0.5) * 2.8;
    // Força da duna: em alguns trechos a crista some e a areia fica quase lisa (as dunas se quebram e se fundem).
    const forca = 0.25 + 0.75 * passo(0.3, 0.62, fbm(rn, x * 0.11 + 61, y * 0.16 + 5, 2));
    let sc = (y + warp) / per; sc -= Math.floor(sc);
    // Barlavento (0 a 0,8): clareia subindo até a crista; crista em 0,8; sotavento (0,8 a 1): sombra forte que se abre.
    // Barlavento (0 a 0,72) clareia até a crista; a crista é uma luz estreita e macia; o sotavento (0,72 a 1) é sombra que vai abrindo.
    const crista = 0.72, borda = Math.exp(-(((sc - crista) / 0.018) ** 2));
    // O terreno é assado a 32 px/m: a passagem da luz para a sombra se espalha por ~0,13 m, senão a crista vira escada ao ampliar.
    const sobe = 0.04 + (Math.min(sc, crista) / crista) ** 1.8 * 0.3, desce = -0.62 * (1 - passo(crista, 1, Math.max(sc, crista)) ** 1.4) - 0.04;
    let v = (sobe + (desce - sobe) * passo(crista - 0.008, crista + 0.03, sc) + borda * 0.3) * forca;
    if (sc < crista - 0.04) { let m = (y + warp * 0.92 + (fbm(rn, x * 0.6 + 70, y * 0.6 + 30, 2) - 0.5) * 0.35) / 0.3; m -= Math.floor(m); v -= (m < 0.18 ? (1 - m / 0.18) * 0.16 : 0) * (0.4 + sc); }
    if (v < 0) { o[0] = E[0]; o[1] = E[1]; o[2] = E[2]; o[3] = Math.min(255, -v * 1.3 * 255); } else { o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; o[3] = Math.min(255, v * 1.4 * 255); }
  });
}

/**
 * Pontos de uma rede quase hexagonal (fileiras a `lado`·0,87, alternadas em meio passo) com um tremor: os dois mais próximos de (x, y),
 * a célula do mais próximo e o vetor dele até o ponto. Basalto e cristal partem daqui.
 */
function celulaHex(x: number, y: number, lado: number, tremor: number, seed: number): { borda: number; id: number; dx: number; dy: number } {
  const h = lado * 0.866, fy = Math.floor(y / h);
  let f1 = Infinity, f2 = Infinity, id = 0, dx = 0, dy = 0;
  for (let j = fy - 1; j <= fy + 1; j++) {
    const off = (j & 1) * lado * 0.5, fx = Math.floor((x - off) / lado);
    for (let i = fx - 1; i <= fx + 1; i++) {
      const cx = i * lado + off + (hash2D(i, j, seed) - 0.5) * tremor * lado, cy = j * h + (hash2D(i, j, seed + 1) - 0.5) * tremor * lado, d = Math.hypot(x - cx, y - cy);
      if (d < f1) { f2 = f1; f1 = d; id = Math.imul(i, 73856093) ^ Math.imul(j, 19349663); dx = x - cx; dy = y - cy; } else if (d < f2) f2 = d;
    }
  }
  return { borda: (f2 - f1) / 2, id, dx, dy };
}

/**
 * Basalto: colunas hexagonais de ~0,55 m vistas de cima, cada topo num tom, com junta escura e um chanfro claro do lado da luz.
 * Cristal: facetas de ~0,7 m, cada uma com um degradê na sua própria direção (a luz batendo num plano inclinado) e arestas claras.
 */
function pintarCelulas(ctx: Contexto, mat: Material, A: Area, seed: number, tipo: 'basalto' | 'cristal'): void {
  const E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), rn = valueNoise2D(seed * 29 + 3), tmp = [0, 0, 0], basalto = tipo === 'basalto';
  const lado = basalto ? 0.6 : 0.75, s = Math.floor(seed) * 7 + 11;
  porPixel(ctx, A, (x, y, o) => {
    const c = celulaHex(x, y, lado, basalto ? 0.32 : 0.7, s), tom = hash2D(c.id, 7, s), grao = fbm(rn, x * 6, y * 6, 2);
    if (basalto) {
      // Cada coluna num tom; uma em seis afundada (mais escura, com a borda do lado da luz em sombra), algumas rachadas ao meio.
      const afundada = tom < 0.16, racha = hash2D(c.id, 11, s) < 0.18 ? Math.abs(c.dx * 0.8 - c.dy * 0.6) : 1;
      mez(tmp, E, B, afundada ? 0.15 + tom : 0.35 + tom * 0.65); mez(o, tmp as unknown as Cor3, C, Math.max(0, grao - 0.55) * 0.5);
      rumo(o, E, (1 - passo(0.004, 0.012, racha)) * 0.7);
      const chanfro = 1 - passo(0.02, 0.085, c.borda), lado = -(c.dx + c.dy) * Math.SQRT1_2 / (Math.hypot(c.dx, c.dy) || 1);   // > 0 no lado noroeste (a luz), como em `organico.ts` (que importa este arquivo)
      if (chanfro > 0) { const luz = afundada ? -lado : lado; rumo(o, luz > 0 ? C : E, chanfro * (luz > 0 ? 0.5 : 0.65) * Math.abs(lado)); }
      rumo(o, [10, 10, 12], 1 - passo(0.004, 0.014, c.borda));
    } else {
      const a = hash2D(c.id, 3, s) * Math.PI * 2, plano = (c.dx * Math.cos(a) + c.dy * Math.sin(a)) / lado + 0.5;
      mez(o, E, B, Math.min(1, Math.max(0, plano * 0.9 + tom * 0.3)));
      rumo(o, C, Math.max(0, plano - 0.65) * 1.6 * (0.5 + tom * 0.5));
      rumo(o, C, (1 - passo(0.006, 0.03, c.borda)) * 0.75);
      rumo(o, E, (grao - 0.5) * 0.2);
    }
  });
}

// ---------- Pisos e paredes de época (Frente Q, Q10) ----------

/** Meandro grego numa faixa: `s` corre ao longo da faixa e `t` (0 a 1) a atravessa; módulo de 5 × 5 com a chave em L. */
const MEANDRO = ['11111', '00001', '11101', '10001', '10111'];
const meandro = (s: number, t: number): boolean => { const i = Math.floor(((s % 1) + 1) % 1 * 5), j = Math.min(4, Math.max(0, Math.floor(t * 5))); return MEANDRO[j]![i] === '1'; };

/**
 * Mosaico romano em preto e branco: tesselas de 5 cm (cada uma num tom), uma grade de linhas pretas em quadros de 0,9 m com uma roseta
 * de quatro pétalas no centro de cada quadro. Com `medalhao`, o centro do cômodo ganha um emblema: moldura quadrada em meandro e, dentro,
 * um medalhão em faixas (terracota, preto, ocre) com uma roseta de oito pétalas.
 */
function pintarMosaico(ctx: Contexto, mat: Material, A: Area, seed: number, medalhao: boolean): void {
  const F = rgbHex(mat.base), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), T = rgbHex(mat.borda ?? '#9a3a22'), O = rgbHex(mat.ouro ?? '#c08a3a'), s = Math.floor(seed) * 13 + 5;
  const tess = 0.05, q = 0.9, cx = A.x + A.w / 2, cy = A.y + A.h / 2, R = Math.min(A.w, A.h) * 0.24, lado = Math.min(A.w, A.h) * 0.34;
  porPixel(ctx, A, (x, y, o) => {
    const ti = Math.floor(x / tess), tj = Math.floor(y / tess), tom = hash2D(ti, tj, s), junta = Math.min(x / tess - ti, y / tess - tj) < 0.12;
    let cor: Cor3 = F;
    // Grade e rosetas.
    const gx = x / q - Math.floor(x / q), gy = y / q - Math.floor(y / q), lx = Math.min(gx, 1 - gx) * q, ly = Math.min(gy, 1 - gy) * q;
    if (Math.min(lx, ly) < 0.028) cor = E;
    const px = (gx - 0.5) * q, py = (gy - 0.5) * q, dr = Math.hypot(px, py), ang = Math.atan2(py, px);
    if (dr < 0.16 * Math.abs(Math.cos(ang * 2)) + 0.03) cor = dr < 0.045 ? T : E;
    if (medalhao) {
      const dx = x - cx, dy = y - cy, m = Math.max(Math.abs(dx), Math.abs(dy)), d = Math.hypot(dx, dy);
      if (m < lado) cor = F;
      if (m < lado && m > lado - 0.26) { const along = Math.abs(dx) > Math.abs(dy) ? dy : dx, across = (lado - m) / 0.26; cor = across < 0.12 || across > 0.88 ? E : meandro(along / 0.26, (across - 0.12) / 0.76) ? E : F; }
      if (d < R) {
        const f = d / R;
        cor = f > 0.93 ? E : f > 0.85 ? T : f > 0.8 ? E : f > 0.72 ? O : C;
        const a2 = Math.atan2(dy, dx), petala = Math.abs(Math.cos(a2 * 4));
        if (f < 0.7 && f < 0.15 + 0.5 * petala) cor = f < 0.12 ? E : f < 0.15 + 0.32 * petala ? T : O;
      }
    }
    mez(o, cor, cor === E ? E : C, cor === E ? 0 : (tom - 0.5) * 0.25 + 0.06);
    if (cor !== E) rumo(o, F, (tom - 0.5) * 0.15);
    if (junta) rumo(o, [o[0]! * 0.7, o[1]! * 0.7, o[2]! * 0.7], 0.7);
  });
}

/** Tatami: módulos de 0,9 × 1,8 m, dois por bloco de 1,8 m, deitados e em pé alternados; trama fina ao comprido e debrum escuro nas bordas longas. */
function pintarTatami(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const B = rgbHex(mat.base), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), H = rgbHex(mat.borda ?? '#1e2a22'), s = Math.floor(seed) * 17 + 3, tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    const bi = Math.floor(x / 1.8), bj = Math.floor(y / 1.8), deitado = (bi + bj) % 2 === 0, lx = x - bi * 1.8, ly = y - bj * 1.8;
    // Dentro do bloco: dois módulos lado a lado; `ao` corre ao comprido do módulo, `at` atravessa (0 a 0,9).
    const ao = deitado ? lx : ly, at = (deitado ? ly : lx) % 0.9, k = Math.floor((deitado ? ly : lx) / 0.9), id = hash2D(bi * 2 + k, bj, s);
    const trama = 0.5 + 0.5 * Math.sin(at * Math.PI * 2 / 0.018), fio = hash2D(Math.floor(at / 0.018), Math.floor(ao / 0.3), s + 4);
    mez(tmp, E, B, 0.55 + trama * 0.25 + (fio - 0.5) * 0.15); mez(o, tmp as unknown as Cor3, C, id * 0.25);
    if (at < 0.04 || at > 0.86) { mez(o, H, H, 0); rumo(o, [0, 0, 0], 0.15 + 0.15 * Math.sin(ao * 60) * 0.5); }
    if (at < 0.006 || at > 0.894 || ao < 0.006 || ao > 1.794) rumo(o, [12, 10, 8], 0.8);
  });
}

/** Zellige: estrelas de oito pontas (dois quadrados, um girado 45°) em cores esmaltadas alternadas, cruzes brancas entre elas, rejunte fino. */
function pintarZellige(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const cores = [rgbHex(mat.base), rgbHex(mat.borda ?? '#2a6a4a'), rgbHex(mat.ouro ?? '#c8902a'), rgbHex(mat.meio ?? '#1e3a6a')], Bco = rgbHex(mat.claro), J = rgbHex(mat.escuro), l = mat.lado ?? 0.32, s = Math.floor(seed) * 19 + 1;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / l), j = Math.floor(y / l), u = x / l - i - 0.5, v = y / l - j - 0.5;
    const quad = Math.max(Math.abs(u), Math.abs(v)), losango = (Math.abs(u) + Math.abs(v)) / Math.SQRT2, estrela = Math.max(quad, losango) < 0.3 ? 0 : Math.min(quad, losango) < 0.3 ? 1 : 2;
    const borda = Math.abs(Math.min(quad, losango) - 0.3) < 0.014 || Math.abs(Math.max(quad, losango) - 0.3) < 0.014 && Math.min(quad, losango) < 0.3;
    const cor = estrela < 2 ? cores[(i * 3 + j * 5 + (estrela ? 1 : 0)) % 4]! : Bco;
    mez(o, cor, cor, 0); rumo(o, Bco, (hash2D(i, j, s) - 0.5) * 0.12 + (estrela < 2 ? 0.05 * (0.5 - v) : 0));
    if (borda) mez(o, J, J, 0);
  });
}

/** Parede pompeiana: painéis vermelhos de 1,2 m emoldurados por um filete claro, pilastras pretas estreitas entre eles e um rodapé escuro. */
function pintarPompeiano(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  ctx.fillStyle = mat.base; ctx.fillRect(A.x, A.y, A.w, A.h);
  for (let x = Math.floor(A.x / 1.5) * 1.5; x < A.x + A.w; x += 1.5) {
    ctx.fillStyle = mat.escuro; ctx.fillRect(x, A.y, 0.3, A.h);
    ctx.strokeStyle = mat.ouro ?? '#d8b860'; ctx.lineWidth = 0.025; ctx.strokeRect(x + 0.42, A.y + 0.15, 0.96, A.h - 0.3);
    ctx.strokeStyle = mat.claro; ctx.lineWidth = 0.012; ctx.strokeRect(x + 0.5, A.y + 0.23, 0.8, A.h - 0.46);
    ctx.fillStyle = mat.ouro ?? '#d8b860'; ctx.beginPath(); ctx.arc(x + 0.9, A.y + A.h / 2, 0.06, 0, 7); ctx.fill();
  }
  camadaDeRuido(ctx, A, seed, 2, 0.35); camadaDeRuido(ctx, A, seed + 1, 5, 0.25, 'multiply', 4);
}

/** Hieróglifos: arenito em registros de 0,4 m separados por filetes, com sinais pintados (pássaros, olhos, ondas, juncos) em ocre, azul e preto. */
function pintarHieroglifos(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const r = mulberry32(seed * 31 + 7), tintas = [mat.escuro, mat.borda ?? '#2a4a8a', mat.ouro ?? '#a8501e'];
  ctx.fillStyle = mat.base; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 1.6, 0.35);
  for (let y = Math.floor(A.y / 0.4) * 0.4; y < A.y + A.h; y += 0.4) {
    ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.6; ctx.fillRect(A.x, y, A.w, 0.015); ctx.globalAlpha = 1;
    for (let x = A.x + 0.05; x < A.x + A.w - 0.1; x += 0.11 + r() * 0.05) {
      const cx = x + 0.05, cy = y + 0.2, tipo = Math.floor(r() * 6);
      ctx.fillStyle = ctx.strokeStyle = tintas[Math.floor(r() * tintas.length)]!; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      if (tipo === 0) { ctx.ellipse(cx, cy, 0.04, 0.025, 0, 0, 7); ctx.fill(); ctx.fillStyle = mat.base; ctx.beginPath(); ctx.arc(cx, cy, 0.01, 0, 7); ctx.fill(); }            // olho
      else if (tipo === 1) { ctx.moveTo(cx - 0.04, cy); for (let k = 0; k < 4; k++) ctx.lineTo(cx - 0.03 + k * 0.022, cy + (k % 2 ? -0.015 : 0.015)); ctx.stroke(); }  // água
      else if (tipo === 2) { ctx.moveTo(cx, cy + 0.08); ctx.lineTo(cx, cy - 0.08); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx + 0.015, cy - 0.06, 0.015, 0.03, 0.4, 0, 7); ctx.fill(); } // junco
      else if (tipo === 3) { ctx.ellipse(cx, cy + 0.01, 0.035, 0.05, 0.3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 0.02, cy - 0.05, 0.015, 0, 7); ctx.fill(); }      // pássaro
      else if (tipo === 4) { ctx.arc(cx, cy, 0.035, 0, 7); ctx.stroke(); }                                                                          // sol
      else { ctx.fillRect(cx - 0.03, cy - 0.07, 0.06, 0.012); ctx.fillRect(cx - 0.006, cy - 0.07, 0.012, 0.14); }                                   // ankh simples
      ctx.globalAlpha = 1;
    }
  }
  camadaDeRuido(ctx, A, seed + 2, 4, 0.3, 'multiply', 4);
}

/** Shoji: papel claro em painéis de 0,9 m com a treliça de madeira (montantes a 0,3 m, travessas a 0,45 m) e o marco mais largo. */
function pintarShoji(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  ctx.fillStyle = mat.claro; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 1.2, 0.18);
  ctx.fillStyle = mat.base;
  for (let x = Math.floor(A.x / 0.3) * 0.3; x < A.x + A.w; x += 0.3) { const marco = Math.abs(x / 0.9 - Math.round(x / 0.9)) < 0.01; ctx.fillRect(x - (marco ? 0.025 : 0.012), A.y, marco ? 0.05 : 0.024, A.h); }
  for (let y = Math.floor(A.y / 0.45) * 0.45; y < A.y + A.h; y += 0.45) ctx.fillRect(A.x, y - 0.012, A.w, 0.024);
  ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.5; for (let x = Math.floor(A.x / 0.9) * 0.9; x < A.x + A.w; x += 0.9) ctx.fillRect(x - 0.005, A.y, 0.01, A.h); ctx.globalAlpha = 1;
}

/** Taipa de pilão: camadas horizontais de terra socada de 8 a 20 cm em tons diferentes, com os furos das agulhas da forma em fileiras. */
function pintarTaipa(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const r = mulberry32(seed * 37 + 3);
  for (let y = A.y; y < A.y + A.h;) { const h = 0.08 + r() * 0.12; ctx.fillStyle = misturar(mat.escuro, mat.claro, 0.3 + r() * 0.55); ctx.fillRect(A.x, y, A.w, h + 0.005); ctx.fillStyle = mat.escuro; ctx.globalAlpha = 0.35; ctx.fillRect(A.x, y + h - 0.006, A.w, 0.008); ctx.globalAlpha = 1; y += h; }
  ctx.fillStyle = mat.escuro;
  for (let y = A.y + 0.5; y < A.y + A.h; y += 0.55) for (let x = A.x + r() * 0.3; x < A.x + A.w; x += 0.6 + r() * 0.2) { ctx.globalAlpha = 0.6; ctx.fillRect(x, y, 0.04, 0.03); }
  ctx.globalAlpha = 1; camadaDeRuido(ctx, A, seed, 1.5, 0.35); camadaDeRuido(ctx, A, seed + 1, 4, 0.3, 'multiply', 4);
}

// ---------- Colonial, faroeste e vitoriano (Frente Q, Q11) ----------

/** Convés: pranchas longas (4 a 6 m) de 0,15 m, emendas desencontradas com duas cavilhas, calafeto de breu entre as fiadas e o sal desbotando a madeira. */
function pintarConves(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const r = mulberry32(seed * 41 + 5), larg = mat.largura ?? 0.15;
  ctx.fillStyle = mat.escuro; ctx.fillRect(A.x, A.y, A.w, A.h);
  for (let y = Math.floor(A.y / larg) * larg; y < A.y + A.h; y += larg) {
    let x = A.x - r() * 5;
    while (x < A.x + A.w) {
      const comp = 4 + r() * 2;
      ctx.fillStyle = misturar(mat.base, mat.claro, 0.15 + r() * 0.5); ctx.fillRect(x + 0.006, y + 0.008, comp - 0.012, larg - 0.016);
      ctx.strokeStyle = mat.escuro; ctx.lineWidth = 0.005;
      for (let v = 0; v < 3; v++) { const yy = y + larg * (0.2 + r() * 0.6); ctx.globalAlpha = 0.15 + r() * 0.15; ctx.beginPath(); ctx.moveTo(x, yy); for (let t = 0.3; t <= comp; t += 0.3) ctx.lineTo(x + t, yy + (r() - 0.5) * 0.012); ctx.stroke(); }
      ctx.globalAlpha = 0.85; ctx.fillStyle = mat.ouro ?? '#3a2a1a';
      for (const px of [x + 0.05, x + comp - 0.05]) for (const py of [y + larg * 0.3, y + larg * 0.7]) { ctx.beginPath(); ctx.arc(px, py, 0.012, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; x += comp;
    }
  }
  camadaDeRuido(ctx, A, seed, 2.5, 0.4); camadaDeRuido(ctx, A, seed + 1, 6, 0.35, 'multiply', 4);
}

/**
 * Ladrilho hidráulico de 20 cm: cada peça tem um quarto do desenho (arco no canto, pétala na diagonal, filete na borda) e as quatro em
 * volta de um vértice se espelham, formando rosáceas que se repetem a cada 40 cm, em três cores de cimento.
 */
function pintarHidraulico(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const B = rgbHex(mat.base), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), D = rgbHex(mat.borda ?? '#6a2a22'), l = mat.lado ?? 0.2, s = Math.floor(seed) * 23 + 9;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / l), j = Math.floor(y / l);
    let u = x / l - i, v = y / l - j;
    if (i & 1) u = 1 - u; if (j & 1) v = 1 - v;            // espelha: o canto (0, 0) de cada peça toca o centro da rosácea
    const d = Math.hypot(u, v), diag = Math.abs(u - v), borda = Math.min(u, v, 1 - u, 1 - v);
    let cor: Cor3 = C;
    if (d < 0.6) cor = d < 0.2 ? D : d > 0.52 ? E : B;                                     // rosácea no canto
    else if (diag < 0.16 * (1 - Math.abs(u + v - 1.4)) && u + v < 1.8) cor = D;           // pétala na diagonal
    if (Math.hypot(1 - u, 1 - v) < 0.3) cor = Math.hypot(1 - u, 1 - v) < 0.22 ? B : E;   // quarto de círculo no canto oposto
    if (borda < 0.04 && Math.max(u, v) > 0.5) cor = B;                                    // filete
    mez(o, cor, cor, 0); rumo(o, C, (hash2D(i, j, s) - 0.5) * 0.08);
    if (Math.min(x / l - i, y / l - j) < 0.015) rumo(o, E, 0.5);
  });
}

/** Enxaimel: reboco claro entre peças de madeira escura (esteios a cada 1 m, frechal, peitoril e travessas em X nos vãos alternados). */
function pintarEnxaimel(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const r = mulberry32(seed * 43 + 1), w = 0.14;
  ctx.fillStyle = mat.claro; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 1.5, 0.3);
  ctx.fillStyle = mat.base; ctx.strokeStyle = mat.base; ctx.lineWidth = w * 0.85;
  const x0 = Math.floor(A.x), y0 = Math.floor(A.y / 1.4) * 1.4;
  for (let y = y0; y < A.y + A.h; y += 1.4) ctx.fillRect(A.x, y - w / 2, A.w, w);
  for (let x = x0; x < A.x + A.w; x += 1) {
    ctx.fillRect(x - w / 2, A.y, w, A.h);
    if (Math.round(x) % 2 === 0) for (let y = y0; y < A.y + A.h; y += 1.4) { ctx.beginPath(); if (r() < 0.5) { ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 1.4); } else { ctx.moveTo(x + 1, y); ctx.lineTo(x, y + 1.4); } ctx.stroke(); }
  }
  camadaDeRuido(ctx, A, seed + 1, 4, 0.3, 'multiply', 4);
}

/** Tábuas descascadas: tábuas em pé de 15 cm pintadas, com a tinta saindo em placas (a madeira cinza aparece) e o pé da parede mais gasto. */
function pintarDescascado(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const T = rgbHex(mat.base), M = rgbHex(mat.ouro ?? '#7a6a58'), E = rgbHex(mat.escuro), rn = valueNoise2D(seed * 47 + 2), larg = 0.15, s = Math.floor(seed) * 3 + 1;
  porPixel(ctx, A, (x, y, o) => {
    const k = Math.floor(x / larg), u = x / larg - k, tom = hash2D(k, 0, s);
    const lasca = fbm(rn, x * 3.5 + k * 7, y * 2.2, 3) + (y - A.y) / Math.max(1, A.h) * 0.15;
    mez(o, lasca > 0.6 ? M : T, lasca > 0.6 ? M : T, 0);
    rumo(o, E, (tom - 0.5) * 0.25 + (lasca > 0.57 && lasca < 0.6 ? 0.45 : 0));
    if (u < 0.05 || u > 0.97) rumo(o, E, 0.7);
  });
}

/** Azulejo português de 15 cm: branco com o desenho em azul-cobalto (quarto de círculo nos cantos, flor no centro), o vidrado com reflexo leve. */
function pintarAzulejo(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const Bco = rgbHex(mat.claro), Az = rgbHex(mat.base), J = rgbHex(mat.escuro), l = mat.lado ?? 0.15, s = Math.floor(seed) * 29 + 3;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / l), j = Math.floor(y / l), u = x / l - i - 0.5, v = y / l - j - 0.5, d = Math.hypot(u, v), a = Math.atan2(v, u);
    const canto = Math.min(Math.hypot(Math.abs(u) - 0.5, Math.abs(v) - 0.5), 1);
    const flor = d < 0.12 + 0.12 * Math.abs(Math.cos(a * 4)), anel = Math.abs(d - 0.3) < 0.025, quarto = canto < 0.2 && canto > 0.13;
    const tinta = flor || anel || quarto || canto < 0.07;
    mez(o, tinta ? Az : Bco, tinta ? Az : Bco, 0);
    if (tinta) rumo(o, Bco, (hash2D(Math.floor(x * 60), Math.floor(y * 60), s) - 0.5) * 0.3);
    rumo(o, [255, 255, 255], Math.max(0, 0.25 - Math.hypot(u + 0.2, v + 0.2)) * 0.6);
    if (Math.min(x / l - i, y / l - j) < 0.03) mez(o, J, J, 0);
  });
}

// ---------- Pós-apocalíptico e cyberpunk (Frente Q, Q12) ----------

/**
 * Néon: placas escuras de 0,6 m com junta fina e, a cada 1,2 m, faixas de luz (`claro`) cruzando, com um segundo tom (`ouro`) nas
 * transversais. Com `brilho` no material, as faixas emitem acima da luz (o resto não, por ser escuro).
 */
function pintarNeon(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const B = rgbHex(mat.base), E = rgbHex(mat.escuro), N1 = rgbHex(mat.claro), N2 = rgbHex(mat.ouro ?? mat.claro), s = Math.floor(seed) * 31 + 7;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / 0.6), j = Math.floor(y / 0.6), u = x / 0.6 - i, v = y / 0.6 - j;
    mez(o, E, B, 0.6 + (hash2D(i, j, s) - 0.5) * 0.3);
    if (Math.min(u, v, 1 - u, 1 - v) < 0.02) rumo(o, [0, 0, 0], 0.5);
    const fx = Math.abs(((x / 1.2) % 1 + 1) % 1 - 0.5) * 1.2, fy = Math.abs(((y / 1.2) % 1 + 1) % 1 - 0.5) * 1.2;
    const nucleo = (d: number) => 1 - passo(0.022, 0.04, d), halo = (d: number) => (1 - passo(0.04, 0.18, d)) * 0.5;
    if (fx < 0.18) { mez(o, o as unknown as Cor3, N1, Math.max(nucleo(fx), halo(fx))); if (fx < 0.008) rumo(o, [255, 255, 255], 0.25); }
    if (fy < 0.18) { rumo(o, N2, Math.max(nucleo(fy), halo(fy))); if (fy < 0.008) rumo(o, [255, 255, 255], 0.25); }
  });
}

/** Concreto pichado: concreto manchado com pichações (letras infladas em contorno, tags em traço solto e respingos), sem texto legível. */
function pintarPichado(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const r = mulberry32(seed * 53 + 11), tintas = ['#d8303a', '#2a8ad8', '#e8c030', '#30c070', '#c040c0', '#f0f0f0', '#101010'];
  ctx.fillStyle = mat.base; ctx.fillRect(A.x, A.y, A.w, A.h); camadaDeRuido(ctx, A, seed, 1.4, 0.45); camadaDeRuido(ctx, A, seed + 3, 5, 0.3, 'multiply', 4);
  const n = Math.max(1, Math.round(A.w * A.h * 0.25));
  for (let k = 0; k < n; k++) {
    const cx = A.x + r() * A.w, cy = A.y + r() * A.h, cor = tintas[Math.floor(r() * tintas.length)]!, contorno = tintas[Math.floor(r() * tintas.length)]!;
    if (r() < 0.55) {
      // Letras infladas: uma fileira de bolhas com contorno.
      const nl = 3 + Math.floor(r() * 4), h = 0.22 + r() * 0.25;
      for (let i = 0; i < nl; i++) {
        const x = cx + i * h * 0.62, y = cy + (r() - 0.5) * h * 0.2, w = h * (0.45 + r() * 0.2);
        ctx.globalAlpha = 0.85; ctx.fillStyle = contorno; ctx.beginPath(); ctx.ellipse(x, y, w * 0.62, h * 0.6, (r() - 0.5) * 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = cor; ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, h * 0.48, (r() - 0.5) * 0.4, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.ellipse(x - w * 0.15, y - h * 0.2, w * 0.12, h * 0.08, 0, 0, 7); ctx.fill();
      }
    } else {
      // Tag: traço solto que vai e volta.
      ctx.globalAlpha = 0.8; ctx.strokeStyle = cor; ctx.lineWidth = 0.025 + r() * 0.02; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let i = 0; i < 6; i++) ctx.lineTo(cx + i * 0.09 + (r() - 0.5) * 0.06, cy + (r() - 0.5) * 0.25); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.5; ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx + (r() - 0.5) * 0.8, cy + (r() - 0.5) * 0.5, 0.006 + r() * 0.01, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

/** Chapa enferrujada: chapa ondulada em pé (crista a cada 7,6 cm) com placas desencontradas e ferrugem escorrendo dos rebites e da base. */
function pintarFerrugem(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const B = rgbHex(mat.base), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), F = rgbHex(mat.ouro ?? '#8a4422'), rn = valueNoise2D(seed * 59 + 4), s = Math.floor(seed) * 7 + 2;
  porPixel(ctx, A, (x, y, o) => {
    const onda = Math.sin((x / 0.076) * Math.PI * 2), placa = Math.floor(x / 0.9), tom = hash2D(placa, Math.floor(y / 2.4 + (placa & 1) * 0.5), s);
    mez(o, E, C, 0.45 + onda * 0.25 + (tom - 0.5) * 0.2);
    const ferr = fbm(rn, x * 1.5, y * 0.6, 3) + passo(0, A.h, y - A.y) * 0.15 + Math.max(0, 0.08 - Math.abs(((y / 2.4) % 1 + 1) % 1 - 0.05)) * 3;
    rumo(o, F, passo(0.5, 0.75, ferr) * 0.8);
    if (Math.abs(x / 0.9 - Math.round(x / 0.9)) < 0.012) rumo(o, B, 0.6);
  });
}

/** Azulejo de metrô: tijolinhos brancos de 15 × 7,5 cm em amarração, rejunte cinza e o reflexo do vidrado no alto de cada peça. */
function pintarMetro(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const B = rgbHex(mat.base), J = rgbHex(mat.escuro), C = rgbHex(mat.claro), s = Math.floor(seed) * 3 + 9;
  porPixel(ctx, A, (x, y, o) => {
    const j = Math.floor(y / 0.075), off = (j & 1) * 0.075, i = Math.floor((x + off) / 0.15), u = (x + off) / 0.15 - i, v = y / 0.075 - j;
    mez(o, B, C, 0.3 + (1 - v) * 0.5 + (hash2D(i, j, s) - 0.5) * 0.2);
    if (u < 0.04 || v < 0.08) mez(o, J, J, 0);
  });
}

function pintarDunas(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const rn = valueNoise2D(seed * 19 + 1), E = rgbHex(mat.escuro), C = rgbHex(mat.claro), ang = 0.35 + (seed % 7) * 0.09, ux = Math.cos(ang), uy = Math.sin(ang);
  const R = areaDeAmostragem(ctx, A);
  const cGrande = campoDeRuido(rn, R, 0.15, 3);
  const cAmp = campoDeRuido(rn, R, 0.18, 2, undefined, 90, 20);
  const cAmp2 = campoDeRuido(rn, R, 0.3, 2, undefined, 11, 70);
  const cWarp = campoDeRuido(rn, R, 0.22, 3, undefined, 40, 0);
  const cLv = campoDeRuido(rn, R, 0.28, 3, undefined, 200, 60);
  const cQuebra = campoDeRuido(rn, R, 0.9, 2, undefined, 33, 0);
  porPixel(ctx, A, (x, y, o) => {
    const grande = cGrande(x, y), amp = 0.55 + 0.45 * passo(0.35, 0.58, cAmp(x, y)), amp2 = 0.4 + 0.6 * passo(0.3, 0.6, cAmp2(x, y));
    const warp = (cWarp(x, y) - 0.5) * 4.5, per = 1.9 + (grande - 0.5) * 1.2;
    let sc = (x * ux + y * uy + warp) / per; sc -= Math.floor(sc);
    let v = sc < 0.8 ? (sc / 0.8) ** 2 * 0.32 : sc < 0.88 ? 0.32 - ((sc - 0.8) / 0.08) * 0.72 : -0.4 * (1 - (sc - 0.88) / 0.12) ** 1.5;
    v *= amp;
    let m2 = (x * ux + y * uy + warp * 0.3) / 0.36; m2 -= Math.floor(m2);
    v += (m2 < 0.75 ? m2 / 0.75 * 0.5 - 0.1 : (1 - m2) / 0.25 * -0.5 + 0.4) * 0.1 * amp2;
    v += (fbm(rn, x * 1.7, y * 1.7, 2) - 0.5) * 0.14 * amp2;
    // trilhas finas de vento: linhas de nível de um ruído largo, quebradas e suaves
    const lv = cLv(x, y) * 9, tr = Math.abs(lv - Math.round(lv)), quebra = passo(0.4, 0.6, cQuebra(x, y));
    v -= (1 - passo(0.015, 0.07, tr)) * quebra * 0.3;
    // sombra azul de um lado (escura), luz do outro (clara): alfa proporcional à intensidade
    if (v < 0) { o[0] = E[0]; o[1] = E[1]; o[2] = E[2]; o[3] = Math.min(255, -v * 1.25 * 255); } else { o[0] = C[0]; o[1] = C[1]; o[2] = C[2]; o[3] = Math.min(255, v * 1.5 * 255); }
  });
}

/** Cascalho: pedrinhas elípticas (2 a 6 cm de semieixo) sobre terra escura, cada uma com volume (luz do alto à esquerda), sombra de contato e sombra lançada. */
function pintarCascalho(ctx: Contexto, mat: Material, A: Area, seed: number): void {
  const rn = valueNoise2D(seed * 23 + 7), V = celulasDeVoronoi(A, 0.15, seed * 13 + 3), q = novaConsulta(), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), tmp = [0, 0, 0];
  const L = [-0.5, -0.55, 0.67], ln = Math.hypot(L[0]!, L[1]!, L[2]!);
  porPixel(ctx, A, (x, y, o) => {
    V.consultar(x, y, q); const s = q.sitio, i = s.i, j = s.j, ang = s.azar * 6.283, asp = 0.62 + 0.3 * hash2D(i, j, 77), R = (0.03 + 0.034 * hash2D(i, j, 91)) * passo(0.3, 0.5, fbm(rn, s.x * 1.4 + 20, s.y * 1.4, 3)) + 0.004, co = Math.cos(ang), si = Math.sin(ang);
    const dx = x - s.x, dy = y - s.y, u = (dx * co + dy * si) / R, v = (-dx * si + dy * co) / (R * asp), d = Math.hypot(u, v) * (1 + (rn(x * 40, y * 40) - 0.5) * 0.14);
    // terra
    mez(tmp, E, B, 0.2 + 0.32 * fbm(rn, x * 6, y * 6, 3)); tomDe(o, [tmp[0]!, tmp[1]!, tmp[2]!] as Cor3, 0.62 + (rn(x * 70 + 5, y * 70) - 0.5) * 0.25);
    if (d < 1) {
      const h = Math.sqrt(1 - d * d), nx = (u * co - v * si) * 0.75, ny = (u * si + v * co) * 0.75, nl = Math.hypot(nx, ny, h);
      const lam = Math.max(0, (nx * L[0]! + ny * L[1]! + h * L[2]!) / (nl * ln)), tinta = 0.15 + 0.85 * hash2D(i, j, 5);
      const baseP: Cor3 = [0, 0, 0]; mez(baseP, E, B, 0.55 + 0.3 * tinta); mez(tmp, baseP, hash2D(i, j, 6) < 0.35 ? [190, 160, 120] : C, tinta * 0.6);
      const k = 0.3 + lam * 1.0 - passo(0.78, 1, d) * 0.25, brilho = Math.max(0, lam - 0.85) * 1.6;
      o[0] = Math.min(255, tmp[0]! * k + brilho * 90); o[1] = Math.min(255, tmp[1]! * k + brilho * 90); o[2] = Math.min(255, tmp[2]! * k + brilho * 90);
    } else {
      const sombra = (1 - passo(1, 1.5, d)) * 0.5 + (Math.hypot(u - 0.5 / asp * 0.5, v - 0.55) < 1.05 ? 0.22 : 0);
      const k = 1 - Math.min(0.75, sombra); o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k;
    }
  });
}

/** `o` ← `o` empurrada para `b` (t = 0 não muda). */
const rumo = (o: number[], b: ArrayLike<number>, t: number): void => { o[0] = o[0]! + (b[0]! - o[0]!) * t; o[1] = o[1]! + (b[1]! - o[1]!) * t; o[2] = o[2]! + (b[2]! - o[2]!) * t; };
const VERDE: Cor3 = [58, 96, 40], VERDE_CLARO: Cor3 = [118, 156, 66], MUSGO: Cor3 = [78, 108, 56];

/** Paralelepípedo: pedras arredondadas de ~20 cm (Voronoi), cada uma um domo iluminado de noroeste, com rejunte escuro e sujo entre elas. */
function pintarParalelepipedo(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 29 + 3), V = celulasDeVoronoi(A, 0.25, seed * 13 + 4), q = novaConsulta();
  const E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), w = Math.max(0.012, px * 1.3), rejunte: Cor3 = [E[0] * 0.6, E[1] * 0.55, E[2] * 0.5];
  porPixel(ctx, A, (x, y, o) => {
    const xx = x + (fbm(rn, x * 6, y * 6, 2) - 0.5) * 0.035, yy = y + (fbm(rn, x * 6 + 31, y * 6 + 7, 2) - 0.5) * 0.035;
    V.consultar(xx, yy, q);
    const s = q.sitio, lado = ((s.x - xx) + (s.y - yy)) / 0.25, domo = passo(w, 0.075, q.borda);
    let t = 0.32 + 0.4 * s.azar + lado * 0.2 * domo + (fbm(rn, x * 10, y * 10, 3) - 0.5) * 0.24 + (hash2D(Math.floor(x / px), Math.floor(y / px), 5) - 0.5) * 0.06;
    if (hash2D(s.i, s.j, 33) < 0.3) t -= 0.1;      // algumas pedras mais escuras e úmidas
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    const k = 1 - (1 - domo) * 0.42; o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k;
    rumo(o, rejunte, (1 - passo(w * 0.3, w * 1.7, q.borda)) * 0.96 * (0.85 + 0.15 * fbm(rn, x * 14, y * 14, 2)));
  });
}

/**
 * Mármore em placas (`lado`, padrão 0,8 m): tom próprio por placa, veios finos e contínuos que atravessam as juntas (com
 * deslocamento por placa), veios largos e esfumados, brilho de polimento em diagonal, bisel e junta escura. Com `meio`,
 * um losango incrustado no cruzamento das juntas (o piso de biblioteca e hall de casarão).
 */
function pintarMarmore(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 53 + 11), rv = valueNoise2D(seed * 59 + 7), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), L = mat.lado ?? 0.8, gw = 0.008;
  const I = mat.meio ? rgbHex(mat.meio) : null, ri = L * 0.14;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / L), j = Math.floor(y / L), lx = x - i * L, ly = y - j * L, d = Math.min(lx, ly, L - lx, L - ly);
    // Losango incrustado no cruzamento das juntas.
    if (I) {
      const cx = Math.round(x / L) * L, cy = Math.round(y / L) * L, dl = Math.abs(x - cx) + Math.abs(y - cy);
      if (dl < ri) { const k = dl > ri - 0.012 ? 0.75 : 1 + (fbm(rn, x * 9, y * 9, 2) - 0.5) * 0.25 - (dl / ri) * 0.15; tomDe(o, I, k); return; }
    }
    if (d < gw) { mez(o, E, B, 0.35); return; }
    let t = 0.55 + (hash2D(i, j, seed + 3) - 0.5) * 0.22 + (fbm(rn, x * 1.4, y * 1.4, 4) - 0.5) * 0.25;
    t += (1 - passo(gw, gw + 0.03, d)) * (lx + ly < (L - lx) + (L - ly) ? 0.12 : -0.12);
    t += (fbm(rn, (x + y) * 0.35, (x - y) * 0.9, 2) - 0.5) * 0.12;      // brilho de polimento
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    // Veios: finos e nítidos, mais uns largos e apagados; cada placa desloca um pouco o desenho.
    const ox = hash2D(i, j, seed + 9) * 3, oy = hash2D(i, j, seed + 11) * 3;
    const fino = Math.abs(fbm(rv, x * 0.9 + ox, y * 0.55 + oy, 5) - 0.5), largo = Math.abs(fbm(rv, x * 0.4 + 40 + ox, y * 0.3 + oy, 4) - 0.5);
    if (fino < 0.008) rumo(o, E, 0.5 * (1 - fino / 0.008));
    if (largo < 0.05) rumo(o, E, 0.16 * (1 - largo / 0.05));
    if (hash2D(Math.floor(x / px), Math.floor(y / px), seed) > 0.995) rumo(o, C, 0.5);
  });
}

/**
 * Taco em ponto húngaro (espinha de peixe vista de cima): colunas de tacos inclinados, alternando o sentido a cada coluna,
 * cada taco com tom próprio, veio no comprimento, junta escura e um pouco de desgaste no meio do cômodo.
 */
function pintarEspinha(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 61 + 5), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), W = 0.56, P = 0.14, gw = 0.008;
  const cDesgaste = campoDeRuido(rn, areaDeAmostragem(ctx, A), 0.25, 3, undefined, 8, 0);
  porPixel(ctx, A, (x, y, o) => {
    const c = Math.floor(x / W), xl = x - c * W, par = (c & 1) === 0, t = y + (par ? xl : W - xl), id = Math.floor(t / P), ft = t - id * P;
    const sx = par ? xl - y : xl + y;      // eixo ao longo do taco, para o veio
    if (xl < gw || ft < gw * 1.4) { mez(o, E, B, 0.2); return; }
    let k = 0.35 + hash2D(c, id, seed + 4) * 0.4 + (fbm(rn, sx * 6 + c * 3.1, ft * 40 + id, 2) - 0.5) * 0.25;
    k += (hash2D(Math.floor(sx * 30), id + c * 97, seed) - 0.5) * 0.06;
    if (ft > P - 0.02) k -= 0.12; else if (ft < 0.025) k += 0.08;
    if (k < 0.5) mez(o, E, B, Math.max(0, k) * 2); else mez(o, B, C, Math.min(1, (k - 0.5) * 2));
    rumo(o, C, passo(0.62, 0.85, cDesgaste(x, y)) * 0.18);
    if (hash2D(Math.floor(x / px), Math.floor(y / px), 7) > 0.997) rumo(o, E, 0.4);
  });
}

/**
 * Assoalho largo marchetado: tábuas de 0,24 m com emendas desencontradas, veio e tom por tábua, e de tanto em tanto uma
 * faixa de marchetaria em losangos de madeira clara (o piso de quarto de casarão).
 */
function pintarMarchetaria(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 67 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), T = 0.24, faixa = 2.6, hf = 0.3, gw = 0.008;
  const cTom = campoDeRuido(rn, areaDeAmostragem(ctx, A), 0.6, 2);
  porPixel(ctx, A, (x, y, o) => {
    const fy = ((y % faixa) + faixa) % faixa;
    if (fy < hf) {
      // Faixa de marchetaria: losangos claros com filete escuro, sobre madeira escura.
      const u = ((x / hf) % 1 + 1) % 1, v = fy / hf, dl = Math.abs(u - 0.5) + Math.abs(v - 0.5);
      if (fy < 0.02 || fy > hf - 0.02) { mez(o, E, B, 0.15); return; }
      if (dl < 0.42) { mez(o, B, C, 0.6 + (fbm(rn, x * 20, y * 20, 2) - 0.5) * 0.3); if (dl > 0.38) rumo(o, E, 0.6); return; }
      mez(o, E, B, 0.35 + (fbm(rn, x * 12, y * 12, 2) - 0.5) * 0.3); return;
    }
    const i = Math.floor(x / T), lx = x - i * T, L = 1.6 + hash2D(i, 3, seed) * 1.6, off = hash2D(i, 5, seed) * L, j = Math.floor((y + off) / L), ly = y + off - j * L;
    if (lx < gw || ly < gw * 1.2) { mez(o, E, B, 0.12); return; }
    let k = 0.3 + hash2D(i, j, seed + 2) * 0.38 + (fbm(rn, lx * 30 + i * 7, y * 2.2, 3) - 0.5) * 0.3 + (cTom(x, y) - 0.5) * 0.15;
    if (lx < 0.02) k += 0.06; else if (lx > T - 0.02) k -= 0.08;
    if (k < 0.5) mez(o, E, B, Math.max(0, k) * 2); else mez(o, B, C, Math.min(1, (k - 0.5) * 2));
    if (hash2D(Math.floor(x / px), Math.floor(y / px), 9) > 0.997) rumo(o, E, 0.4);
  });
}

/**
 * Lajes grandes de piso (fiadas de `lado` m, padrão 0,9, comprimentos de 0,9 a 1,8 m desencontrados): cada laje com tom
 * próprio, bisel claro a noroeste e escuro a sudeste, desgaste no meio, rachaduras finas, cantos lascados e junta escura.
 */
function pintarLajesGrandes(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 41 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), RH = mat.lado ?? 0.9, gw = 0.028;
  const largura = (i: number, j: number) => 0.9 * RH / 0.9 + hash2D(i, j, seed + 2) * 0.9 * RH / 0.9;
  porPixel(ctx, A, (x, y, o) => {
    const j = Math.floor(y / RH), off = hash2D(j, 1, seed + 5) * 1.3;
    // Bordas da laje na fileira j: soma de larguras a partir de uma origem que se repete a cada 8 lajes.
    const bloco = 8, ciclo = (() => { let t = 0; for (let k = 0; k < bloco; k++) t += largura(k, j); return t; })();
    const xl = x - off - Math.floor((x - off) / ciclo) * ciclo, base = Math.floor((x - off) / ciclo);
    let e0 = 0, i = 0; while (i < bloco - 1 && e0 + largura(i, j) <= xl) { e0 += largura(i, j); i++; }
    const e1 = e0 + largura(i, j), id = base * bloco + i, yt = j * RH, yb = yt + RH;
    const dx0 = xl - e0, dx1 = e1 - xl, dy0 = y - yt, dy1 = yb - y, d = Math.min(dx0, dx1, dy0, dy1), sobre = d - gw;
    if (sobre < 0) { mez(o, E, B, 0.12 + 0.15 * fbm(rn, x * 9, y * 9, 2)); return; }
    let t = 0.28 + 0.4 * hash2D(id, j, seed + 3) + (fbm(rn, x * 1.8 + id, y * 1.8, 4) - 0.5) * 0.32 + (hash2D(Math.floor(x / px), Math.floor(y / px), 6) - 0.5) * 0.05;
    // Bisel: luz a noroeste, sombra a sudeste; o miolo gasto um pouco mais claro.
    const bisel = 1 - passo(0, 0.07, sobre), noroeste = Math.min(dx0, dy0) < Math.min(dx1, dy1) ? 1 : -1;
    t += bisel * 0.2 * noroeste + passo(0.15, 0.4, d) * 0.04;
    // Canto lascado: perto de uma quina, um triângulo mais escuro.
    const quina = Math.min(Math.hypot(dx0, dy0), Math.hypot(dx1, dy0), Math.hypot(dx0, dy1), Math.hypot(dx1, dy1));
    if (quina < 0.12 && hash2D(id, j, seed + 17) < 0.45) t -= 0.25 * (1 - quina / 0.12);
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    // Rachadura: uma linha fina e torta em algumas lajes.
    if (hash2D(id, j, seed + 40) < 0.22 && Math.abs(fbm(rn, x * 1.3 + id * 7.3, y * 1.3 + j * 3.1, 2) - 0.5) < 0.008) rumo(o, E, 0.7);
    // Manchas de umidade e sujeira.
    rumo(o, E, passo(0.6, 0.82, fbm(rn, x * 0.7 + 50, y * 0.7, 3)) * 0.22);
    if (bisel > 0 && noroeste < 0) { const k = 1 - bisel * 0.18; o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k; }
  });
}

/** Lajes grandes (~1,1 × 0,85 m, juntas desencontradas) com grama e musgo nas juntas, rachaduras de tempo e algumas lajes faltando. */
function pintarLajesGramadas(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 31 + 9), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), RH = 1.25, LW = 1.7, gw = 0.06, terra: Cor3 = [E[0] * 1.05, E[1] * 0.95, E[2] * 0.85];
  porPixel(ctx, A, (x, y, o) => {
    const j = Math.floor(y / RH), off = hash2D(j, 0, seed + 5) * LW, jit = (i: number) => (hash2D(i, j, seed + 9) - 0.5) * 0.4;
    let i = Math.floor((x - off) / LW), e0 = i * LW + off + jit(i), e1 = (i + 1) * LW + off + jit(i + 1);
    if (x < e0) { i--; e1 = e0; e0 = i * LW + off + jit(i); } else if (x >= e1) { i++; e0 = e1; e1 = (i + 1) * LW + off + jit(i + 1); }
    const yt = j * RH, yb = yt + RH, d = Math.min(x - e0, e1 - x, y - yt, yb - y), falta = hash2D(i, j, seed + 21) < 0.1, sobre = d - gw * 0.5;
    const ruido = fbm(rn, x * 7, y * 7, 3), relva = fbm(rn, x * 5 + 40, y * 5, 3);
    let gr = 0;
    if (falta || sobre < 0) {
      tomDe(o, terra, 0.85 + 0.3 * ruido); gr = falta ? 0.35 + 0.6 * passo(0.38, 0.6, relva) : 0.5 + 0.5 * passo(0.3, 0.55, relva);
    } else {
      let t = 0.3 + 0.32 * hash2D(i, j, seed + 3) + (fbm(rn, x * 2.2, y * 2.2, 4) - 0.5) * 0.3 + (hash2D(Math.floor(x / px), Math.floor(y / px), 6) - 0.5) * 0.06;
      const bisel = 1 - passo(gw * 0.5, gw * 0.5 + 0.07, sobre), luz = (x - e0) + (y - yt) < (e1 - x) + (yb - y) ? 1 : -1;
      t += bisel * 0.18 * luz;
      if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
      const rach = Math.abs(fbm(rn, x * 3 + 70 * (i & 3), y * 3 + 11 * (j & 3), 3) - 0.5) < 0.012 && hash2D(i, j, seed + 40) < 0.5;
      if (rach) rumo(o, E, 0.6);
      rumo(o, MUSGO, passo(0.6, 0.8, fbm(rn, x * 2.1 + 9, y * 2.1, 3)) * (0.3 + 0.7 * (1 - passo(0, 0.45, sobre))) * 0.8);
      gr = (1 - passo(0.01, 0.17, sobre)) * passo(0.4, 0.62, relva);
    }
    if (gr > 0.02) {
      const folha = hash2D(Math.floor(x / (px * 1.5)), Math.floor(y / (px * 1.5)), 8);
      rumo(o, folha > 0.72 ? VERDE_CLARO : VERDE, Math.min(0.96, gr * (folha > 0.4 ? 1 : 0.8)));
    }
    if (d < gw + 0.02 && !falta && sobre >= 0) { const k = 1 - (1 - passo(0, 0.05, sobre)) * 0.35; o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k; }
  });
}

/** Estrada de terra: duas trilhas de roda paralelas ao eixo x do contexto (o assar gira o padrão pela orientação dominante da camada), com banco claro, lama escura no fundo e capim na crista entre as trilhas. */
function pintarSulcos(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 37 + 2), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), P = 2.1, hw = 0.13, tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    const grao = fbm(rn, x * 2.2, y * 2.2, 4), fino = hash2D(Math.floor(x / px), Math.floor(y / px), 4);
    mez(tmp, E, B, 0.35 + 0.5 * grao + (fino - 0.5) * 0.1); mez(o, tmp as unknown as Cor3, C, passo(0.62, 0.85, fbm(rn, x * 7 + 20, y * 7, 2)) * 0.3);
    const per = Math.floor(y / P), ph = y - per * P + (fbm(rn, x * 0.35 + per * 9, 0.5, 3) - 0.5) * 0.5;
    const gasto = 0.55 + 0.45 * passo(0.25, 0.55, fbm(rn, x * 0.4 + 60, per * 3.1, 2));
    let sulco = 0;
    for (const c of [0.5, 1.6]) {
      const dy = ph - c, a = Math.abs(dy), prof = (1 - passo(0, hw, a)) * gasto;
      sulco = Math.max(sulco, prof);
      const banco = passo(hw * 0.8, hw * 1.35, a) * (1 - passo(hw * 1.35, hw * 2.4, a));
      if (banco > 0) rumo(o, dy > 0 ? C : E, banco * (dy > 0 ? 0.35 : 0.3) * gasto);
    }
    if (sulco > 0) { rumo(o, E, sulco * 0.62); if (fbm(rn, x * 5, y * 5, 2) > 0.62) rumo(o, [E[0] * 1.5, E[1] * 1.6, E[2] * 1.8], sulco * 0.3); }
    const crista = (1 - passo(0.12, 0.34, Math.abs(ph - 1.05))) * passo(0.5, 0.7, fbm(rn, x * 9 + 5, y * 9, 2));
    if (crista > 0.05) rumo(o, hash2D(Math.floor(x / px), Math.floor(y / px), 9) > 0.7 ? VERDE_CLARO : VERDE, crista * 0.85);
    if (hash2D(Math.floor(x / (px * 1.5)), Math.floor(y / (px * 1.5)), 12) > 0.992) rumo(o, C, 0.7);
  });
}

/** Areia molhada: areia escurecida pelo encharcado, marolas largas com luz de um lado, poças de brilho e algumas conchinhas. */
function pintarAreiaMolhada(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 41 + 6), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), ang = 0.25 + (seed % 5) * 0.12, ux = Math.cos(ang), uy = Math.sin(ang), tmp = [0, 0, 0];
  const R = areaDeAmostragem(ctx, A);
  const cUmido = campoDeRuido(rn, R, 0.5, 3);
  const cWarp = campoDeRuido(rn, R, 0.3, 3, undefined, 70, 0);
  const cForca = campoDeRuido(rn, R, 0.6, 2, undefined, 12, 30);
  porPixel(ctx, A, (x, y, o) => {
    const umido = passo(0.3, 0.7, cUmido(x, y)), grao = fbm(rn, x * 8, y * 8, 2);
    mez(tmp, B, E, 0.25 + 0.35 * umido); tomDe(o, tmp as unknown as Cor3, 0.9 + (grao - 0.5) * 0.25 + (hash2D(Math.floor(x / px), Math.floor(y / px), 3) - 0.5) * 0.06);
    const warp = (cWarp(x, y) - 0.5) * 3.2;
    let sc = (x * ux + y * uy + warp) / 0.62; sc -= Math.floor(sc);
    const onda = sc < 0.7 ? sc / 0.7 * 0.5 : (1 - sc) / 0.3 * 0.5, forca = passo(0.3, 0.6, cForca(x, y));
    rumo(o, onda > 0.38 ? C : E, Math.abs(onda - 0.38) * 1.15 * forca);
    const poca = passo(0.64, 0.76, fbm(rn, x * 1.3 + 90, y * 1.3 + 4, 3));
    if (poca > 0) { rumo(o, C, poca * 0.3 * (0.7 + 0.3 * grao)); if (hash2D(Math.floor(x / px), Math.floor(y / px), 15) > 0.985) rumo(o, [255, 255, 255], 0.55 * poca); }
    if (hash2D(Math.floor(x / (px * 1.5)), Math.floor(y / (px * 1.5)), 17) > 0.9965) rumo(o, E, 0.7);
  });
}

/**
 * Tapete persa pintado pixel a pixel, com simetria espelhada nos dois eixos e cinco desenhos (`mat.desenho`, ou sorteado
 * pela semente): 1 medalhão central com cantoneiras; 2 floral, palmetas e flores espalhadas no campo; 3 cercaduras
 * concêntricas com o campo manchado (abrash); 4 kilim, losangos em degraus; 5 oval, com a cercadura seguindo a elipse.
 * As cores do material são apagadas um pouco e o pelo ganha desgaste e sujeira, como tapete velho de casarão.
 */
function pintarPersa(ctx: Contexto, mat: Material, a: Area, r: () => number): void {
  const seed = Math.floor(r() * 1e6), rn = valueNoise2D(seed * 17 + 3), desenho = mat.desenho ?? 1 + Math.floor(hash2D(seed, 7, 3) * 4);
  const apagar = (c: Cor3): Cor3 => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return [c[0] + (l - c[0]) * 0.22 + 4, c[1] + (l - c[1]) * 0.22 + 2, c[2] + (l - c[2]) * 0.22]; };
  const F = apagar(rgbHex(mat.base)), B = apagar(rgbHex(mat.borda ?? mat.escuro)), M = apagar(rgbHex(mat.meio ?? mat.claro)), C = apagar(rgbHex(mat.claro)), E = apagar(rgbHex(mat.escuro));
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2, hw = a.w / 2, hh = a.h / 2, s = Math.min(a.w, a.h), oval = desenho === 5;
  const g1 = s * 0.02, g2 = s * 0.045, b = s * (desenho === 2 ? 0.1 : desenho === 3 ? 0.06 : 0.14), g3 = b + s * 0.022;
  const fw = hw - g3, fh = hh - g3, horizontal = a.w >= a.h, mx = fw * (horizontal ? 0.42 : 0.7), my = fh * (horizontal ? 0.7 : 0.42);
  const P = s * 0.1, q = s * 0.075;
  const cDesbota = campoDeRuido(rn, areaDeAmostragem(ctx, a), 0.5, 3, undefined, 30, 0);
  porPixel(ctx, a, (x, y, o) => {
    const dx = x - cx, dy = y - cy, u = Math.abs(dx), v = Math.abs(dy);
    let e: number, t: number;
    if (oval) { const k = Math.hypot(dx / hw, dy / hh); if (k > 1) { o[3] = 0; return; } e = (1 - k) * s / 2; t = Math.atan2(dy / hh, dx / hw) * (hw + hh) / 2; }
    else { const eu = hw - u, ev = hh - v; e = Math.min(eu, ev); t = eu < ev ? y - a.y : x - a.x; }
    let cor: Cor3 = F;
    if (e < g1) cor = E;
    else if (e < g2) { const k = ((t / (s * 0.035)) % 1 + 1) % 1; cor = Math.abs(k - 0.5) < 0.18 && Math.abs(e - (g1 + g2) / 2) < s * 0.008 ? M : C; }
    else if (e < b) {
      const meio = (g2 + b) / 2, k = ((t / P) % 1 + 1) % 1, du = (k - 0.5) * P, dv = e - meio, d = Math.hypot(du, dv), rr = (b - g2) * 0.36;
      if (desenho === 4) { const z = Math.abs(((t / (P * 0.5)) % 1 + 1) % 1 - 0.5) * 2; cor = Math.abs(dv) < (b - g2) * 0.32 * z ? M : B; }
      else if (desenho === 3) cor = Math.abs(dv) < (b - g2) * 0.12 ? M : B;
      else {
        const gav = Math.abs(dv - Math.sin((t / P) * Math.PI * 2) * (b - g2) * 0.22) < s * 0.006;
        if (d < rr) { const th = Math.atan2(dv, du), petala = d < rr * (0.7 + 0.3 * Math.cos(th * 6)); cor = d < rr * 0.28 ? C : petala ? M : B; } else cor = gav ? C : B;
      }
      if (Math.abs(e - g2) < s * 0.005 || Math.abs(e - b) < s * 0.005) cor = E;
    } else if (e < g3) cor = Math.abs(e - (b + g3) / 2) < s * 0.006 ? M : C;
    else if (desenho === 2 || desenho === 5) {
      // Floral: palmetas em grade desencontrada, cada uma girada, e gavinhas finas ligando.
      const cel = s * (oval ? 0.16 : 0.2), gi = Math.floor(x / cel), gj = Math.floor(y / cel), ox = (gj & 1) * cel * 0.5;
      const ci = Math.floor((x - ox) / cel), px0 = ci * cel + ox + cel / 2 + (hash2D(ci, gj, seed) - 0.5) * cel * 0.2, py0 = gj * cel + cel / 2;
      const ddx = x - px0, ddy = y - py0, d = Math.hypot(ddx, ddy) / (cel * 0.42), th = Math.atan2(ddy, ddx) + hash2D(ci, gj, seed + 1) * 6.28, tipo = hash2D(ci, gj, seed + 2);
      void gi;
      cor = F;
      if (Math.abs(Math.sin(x / cel * 3.1) + Math.sin(y / cel * 2.3) * 0.8) < 0.05) cor = mixC(F, C, 0.35);
      if (tipo < 0.55) { const rr = 0.55 + 0.45 * Math.abs(Math.cos(th * (tipo < 0.3 ? 2.5 : 3))); if (d < rr) cor = d < 0.22 ? M : d < rr * 0.8 ? C : mixC(C, F, 0.4); }
      else if (tipo < 0.85) { const rr = 0.5 * (0.6 + 0.4 * Math.cos(th * 5)); if (d < rr) cor = d < 0.15 ? B : M; }
      else if (d < 0.18) cor = C;
      if (oval) { const k = Math.hypot(dx / (fw * 0.45), dy / (fh * 0.45)); if (k < 1) cor = k > 0.9 ? B : k > 0.8 ? C : cor === F ? mixC(F, C, 0.25) : cor; }
    } else if (desenho === 3) {
      // Campo manchado e duas cercaduras finas internas; flores tom sobre tom bem apagadas.
      const abrash = (fbm(rn, x * 0.3, y * 1.2, 3) - 0.5) * 0.25;
      cor = mixC(F, abrash > 0 ? C : E, Math.abs(abrash));
      const eIn = Math.min(fw - u, fh - v);
      if (Math.abs(eIn - s * 0.08) < s * 0.006 || Math.abs(eIn - s * 0.16) < s * 0.004) cor = B;
      const fu = ((dx / q) % 1 + 1) % 1, fv = ((dy / q) % 1 + 1) % 1;
      if (Math.hypot(fu - 0.5, fv - 0.5) < 0.12) cor = mixC(cor, M, 0.35);
    } else if (desenho === 4) {
      // Kilim: faixas de losangos em degraus, com miolo de outra cor.
      const faixa = s * 0.22, k = ((dy / faixa) % 1 + 1) % 1, linha = Math.floor(dy / faixa), w = s * 0.11;
      const pxs = Math.floor(dx / (s * 0.02)) * (s * 0.02), xx = ((pxs / (w * 2)) % 1 + 1) % 1, dd = Math.abs(xx - 0.5) * 2 + Math.abs(k - 0.5) * 2;
      const pal = [B, M, C][((linha % 3) + 3) % 3]!;
      cor = F;
      if (dd < 0.95) cor = dd < 0.45 ? (dd < 0.2 ? E : C) : pal;
      if (Math.abs(k - 0.02) < 0.02) cor = E;
    } else {
      // Medalhão: treliça miúda, cantoneiras, medalhão lobado e pingentes.
      const fu = ((dx / q) % 1 + 1) % 1, fv = ((dy / q) % 1 + 1) % 1, los = Math.abs(fu - 0.5) + Math.abs(fv - 0.5);
      if (Math.abs(los - 0.5) < 0.05) cor = mixC(F, E, 0.45); else if (los < 0.14) cor = mixC(F, C, 0.55);
      const dc = Math.hypot((fw - u) / (mx * 0.62), (fh - v) / (my * 0.62));
      if (dc < 1) cor = dc > 0.86 ? E : dc > 0.74 ? C : (Math.cos(Math.atan2(fh - v, fw - u) * 8) > 0.4 && dc > 0.4 ? M : B);
      const du = dx / mx, dv = dy / my, d = Math.hypot(du, dv), th = Math.atan2(dv, du), rr = 1 + 0.09 * Math.cos(th * 8);
      const longo = horizontal ? Math.abs(du) : Math.abs(dv), curto = horizontal ? Math.abs(dv) : Math.abs(du);
      if (Math.abs(longo - 1.3) / 0.22 + curto / 0.16 < 1) cor = Math.abs(longo - 1.3) / 0.22 + curto / 0.16 > 0.75 ? E : C;
      if (d < rr) {
        const n = d / rr;
        if (n > 0.9) cor = E; else if (n > 0.76) cor = Math.cos(th * 24) > 0.6 ? M : C; else if (n > 0.5) cor = Math.cos(th * 8) > 0.2 && n < 0.68 ? C : B;
        else if (n > 0.26) cor = Math.cos(th * 8 + Math.PI / 8) > 0.35 ? C : M; else cor = n < 0.1 ? C : n < 0.14 ? E : M;
      }
    }
    // Pelo do tapete, desgaste no meio (por onde se anda) e sujeira nas bordas.
    const grao = (hash2D(Math.floor(x * 140), Math.floor(y * 140), seed) - 0.5) * 0.09, gasto = (fbm(rn, x * 0.8, y * 0.8, 3) - 0.5) * 0.22;
    const centro = 1 - Math.min(1, Math.hypot(dx / hw, dy / hh)), k = 1 + grao + gasto * 0.7 + centro * 0.05;
    const desbota = passo(0.55, 0.8, cDesbota(x, y)) * 0.18;
    o[0] = Math.max(0, Math.min(255, (cor[0] + (200 - cor[0]) * desbota) * k)); o[1] = Math.max(0, Math.min(255, (cor[1] + (190 - cor[1]) * desbota) * k)); o[2] = Math.max(0, Math.min(255, (cor[2] + (170 - cor[2]) * desbota) * k));
  });
  if (oval) return;
  // Franja nas pontas do eixo longo.
  ctx.strokeStyle = mat.claro; ctx.lineWidth = 0.012; ctx.globalAlpha = 0.85;
  if (horizontal) { for (let y = a.y + 0.03; y < a.y + a.h; y += 0.045) for (const x of [a.x, a.x + a.w]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x === a.x ? -0.1 : 0.1), y + (r() - 0.5) * 0.025); ctx.stroke(); } }
  else { for (let x = a.x + 0.03; x < a.x + a.w; x += 0.045) for (const y of [a.y, a.y + a.h]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 0.025, y + (y === a.y ? -0.1 : 0.1)); ctx.stroke(); } }
  ctx.globalAlpha = 1;
}
const mixC = (a: Cor3, b: Cor3, t: number): Cor3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- Rústicos e industriais (pisos, paredes e terrenos da frente E1) ----------
const escurecer = (o: number[], k: number): void => { o[0] = o[0]! * k; o[1] = o[1]! * k; o[2] = o[2]! * k; };
const LUZ_NO: Cor3 = [-0.7071, -0.7071, 0];

/** Palha espalhada sobre chão de terra: talos finos em todas as direções, amontoados em tufos, com terra aparecendo entre eles. */
function pintarPalhaNoChao(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 43 + 5), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), G = 0.16, tmp = [0, 0, 0];
  porPixel(ctx, A, (x, y, o) => {
    mez(o, E, B, 0.2 + 0.35 * fbm(rn, x * 3, y * 3, 3));
    const tufo = passo(0.3, 0.62, fbm(rn, x * 0.9 + 17, y * 0.9, 3)), ci = Math.floor(x / G), cj = Math.floor(y / G);
    let melhor = 0, tom = 0;
    for (let c = 0; c < 3; c++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, s = seed + c * 101;
      if (hash2D(i, j, s) > 0.3 + 0.65 * tufo) continue;
      const cx = (i + hash2D(i, j, s + 1)) * G, cy = (j + hash2D(i, j, s + 2)) * G, a = hash2D(i, j, s + 3) * Math.PI, L = 0.07 + 0.1 * hash2D(i, j, s + 4);
      const dx = x - cx, dy = y - cy, u = dx * Math.cos(a) + dy * Math.sin(a); if (Math.abs(u) > L) continue;
      const v = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)), w = 0.006 + 0.005 * (1 - Math.abs(u) / L), k = 1 - passo(w * 0.5, w + px, v);
      if (k > melhor) { melhor = k; tom = hash2D(i, j, s + 5) * 0.8 + c * 0.1; }
    }
    if (melhor > 0) { mez(tmp, B, C, 0.25 + 0.65 * tom); rumo(o, tmp, melhor * 0.95); } else escurecer(o, 1 - tufo * 0.3);
  });
}

/** Seixos de chão: em células de `G` m, com chance `chance`, uma pedrinha de raio `r0` a `r0 + dr` com volume (luz a noroeste). Devolve 0 fora e, dentro, a altura relativa (0 a 1). */
function seixo(x: number, y: number, G: number, chance: number, r0: number, dr: number, seed: number): { k: number; luz: number; tom: number } {
  const ci = Math.floor(x / G), cj = Math.floor(y / G);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = ci + di, j = cj + dj; if (hash2D(i, j, seed) > chance) continue;
    const cx = (i + hash2D(i, j, seed + 1)) * G, cy = (j + hash2D(i, j, seed + 2)) * G, rr = r0 + dr * hash2D(i, j, seed + 3), q = Math.hypot((x - cx) / rr, (y - cy) / (rr * 0.8));
    if (q < 1) return { k: Math.sqrt(1 - q * q), luz: -((x - cx) + (y - cy)) / (rr * 1.41), tom: hash2D(i, j, seed + 4) };
  }
  return { k: 0, luz: 0, tom: 0 };
}

/**
 * Chama `f(cx, cy, i, j)` para os pontos sorteados (com chance `chance`) nas células de `G` m em volta de (x, y) e para no primeiro que
 * devolver `true`. Cada traço tem de caber num raio de `G` em volta do próprio ponto.
 */
function sorteados(x: number, y: number, G: number, chance: number, seed: number, f: (cx: number, cy: number, i: number, j: number) => boolean | void): void {
  const ci = Math.floor(x / G), cj = Math.floor(y / G);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = ci + di, j = cj + dj; if (hash2D(i, j, seed) > chance) continue;
    if (f((i + hash2D(i, j, seed + 1)) * G, (j + hash2D(i, j, seed + 2)) * G, i, j)) return;
  }
}

/** Onde (x, y) cai numa lente de meia-largura `W` e meio-comprimento `L` virada para `a`: < 1 dentro (0 no eixo), ≥ 1 fora. */
function naLente(dx: number, dy: number, a: number, L: number, W: number): number {
  const u = dx * Math.cos(a) + dy * Math.sin(a), t = u / L; if (t * t >= 1) return 2;
  return Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) / (W * (1 - t * t));
}

/**
 * Detritos de chão desenhados no tamanho em que se leem no mapa (o terreno sai a ~32 px/m: nada menor que 5 cm): folhas secas de 10 a 18 cm
 * com borda escura e sombra curta, galhos com fio de luz, seixos com volume e sombra e tufos de capim. `dens` (0 a 1) escala cada um.
 */
function detritos(o: number[], x: number, y: number, seed: number, px: number, tmp: number[], dens: { folhas: number; galhos: number; seixos: number; capim: number; samambaia?: number }, folhas: readonly Cor3[], capim: Cor3): void {
  const sombra = (k: number) => escurecer(o, k);
  // Seixos: pedrinhas de 7 a 16 cm, claras no noroeste, com sombra para o sudeste.
  if (dens.seixos > 0) {
    const p = seixo(x, y, 0.5, 0.12 * dens.seixos, 0.035, 0.045, seed + 31);
    if (p.k > 0) { tomDe(tmp, p.tom < 0.5 ? [104, 98, 88] : [86, 80, 72], 0.72 + 0.45 * Math.max(-0.5, Math.min(0.8, p.luz)) + 0.15 * p.k); rumo(o, tmp, Math.min(1, p.k * 3)); return; }
    if (seixo(x - 0.025, y - 0.03, 0.5, 0.12 * dens.seixos, 0.035, 0.045, seed + 31).k > 0) sombra(0.62);
  }
  // Galhos: traços de 30 a 90 cm, um pouco tortos, com o lado da luz mais claro.
  if (dens.galhos > 0) {
    let feito = false;
    sorteados(x, y, 1.2, 0.3 * dens.galhos, seed + 501, (cx, cy, i, j) => {
      const a = hash2D(i, j, seed + 504) * Math.PI, L = 0.15 + 0.3 * hash2D(i, j, seed + 505), W = 0.016 + px * 0.45;
      const dx = x - cx, dy = y - cy, u = dx * Math.cos(a) + dy * Math.sin(a); if (Math.abs(u) > L) return;
      const v = -dx * Math.sin(a) + dy * Math.cos(a) - Math.sin(u * 7 + i) * 0.03, w = W * (1 - 0.5 * Math.abs(u / L));
      if (Math.abs(v) < w) { tomDe(tmp, [74, 56, 40], v < 0 ? 1.15 : 0.7); rumo(o, tmp, 0.95); feito = true; return true; }
      if (v > w && v < w + 0.035) sombra(0.75);
    });
    if (feito) return;
  }
  // Folhas secas: duas camadas, a de cima mais clara; cada folha com borda escura e sombra curta para o sudeste.
  for (let c = 0; c < 2 && dens.folhas > 0; c++) {
    const s = seed + c * 97;
    sorteados(x, y, 0.24 + c * 0.05, (0.35 + c * 0.1) * dens.folhas, s, (cx, cy, i, j) => {
      const a = hash2D(i, j, s + 3) * Math.PI, L = 0.05 + 0.04 * hash2D(i, j, s + 4), W = L * (0.36 + 0.16 * hash2D(i, j, s + 7)) + px * 0.4;
      const e = naLente(x - cx, y - cy, a, L, W);
      if (e < 1) { tomDe(tmp, folhas[Math.floor(hash2D(i, j, s + 5) * folhas.length)]!, (e > 0.72 ? 0.62 : 0.9 + c * 0.12) * (0.92 + 0.16 * hash2D(i, j, s + 8))); rumo(o, tmp, 0.95); return true; }
      if (naLente(x - cx - 0.018, y - cy - 0.022, a, L, W) < 1) sombra(0.78);
    });
  }
  // Samambaias: 6 a 8 frondes de 35 a 65 cm, com folíolos (a borda ondula a cada 10 cm), nervura escura e o lado da luz mais claro.
  const fern = dens.samambaia ?? 0;
  if (fern > 0) {
    let feito = false;
    sorteados(x, y, 1.5, 0.3 * fern, seed + 601, (cx, cy, i, j) => {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), R = 0.35 + 0.3 * hash2D(i, j, seed + 604); if (d > R) return;
      const n = 6 + Math.floor(hash2D(i, j, seed + 603) * 3), giro = hash2D(i, j, seed + 605) * Math.PI * 2, k = Math.round(((Math.atan2(dy, dx) - giro) / (Math.PI * 2)) * n), id = i * 7 + j;
      const af = giro + (k / n) * Math.PI * 2 + (hash2D(k, id, seed + 606) - 0.5) * 0.4, Lf = R * (0.7 + 0.3 * hash2D(k, id, seed + 607));
      const u = dx * Math.cos(af) + dy * Math.sin(af), v = -dx * Math.sin(af) + dy * Math.cos(af); if (u < 0 || u > Lf) return;
      const t = u / Lf, larg = 0.11 * (1 - t) * (0.55 + 0.45 * Math.abs(Math.sin((u * Math.PI) / 0.1))) + px * 0.4;
      if (Math.abs(v) < larg) { tomDe(tmp, [64, 90, 44], Math.abs(v) < 0.01 + px * 0.3 ? 0.6 : 0.8 + 0.4 * t + (v * (Math.sin(af) - Math.cos(af)) > 0 ? 0.12 : -0.06)); rumo(o, tmp, 0.95); feito = true; return true; }
      if (Math.abs(v) < larg + 0.035) sombra(0.72);
    });
    if (feito) return;
  }
  // Capim: tufos de 50 cm a 1 m, lâminas saindo do centro, escuras na base e claras na ponta.
  if (dens.capim > 0) sorteados(x, y, 1.1, 0.2 * dens.capim, seed + 401, (cx, cy, i, j) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), R = 0.25 + 0.25 * hash2D(i, j, seed + 404);
    if (d > R) return;
    if (d < R * 0.35) sombra(0.82);
    const n = 16, giro = hash2D(i, j, seed + 405) * 10, a = Math.atan2(dy, dx), setor = Math.round((a / (Math.PI * 2)) * n + giro), aa = ((setor - giro) / n) * Math.PI * 2;
    const comp = R * (0.6 + 0.4 * hash2D(setor, i * 31 + j, seed + 408)); if (d > comp) return;
    const lateral = Math.abs(Math.sin(a - aa)) * d, w = 0.026 * (1 - d / comp) + px * 0.45;
    if (lateral < w && hash2D(setor, i * 31 + j, seed + 406) < 0.9) { tomDe(tmp, capim, 0.5 + 0.8 * (d / comp) + 0.2 * hash2D(setor, j, seed + 407)); rumo(o, tmp, 0.92); return true; }
  });
}

/** Grão do chão: pintas de 4 a 8 cm (o "pincel" de terra), que aparecem no mapa como textura e não como ruído de pixel. */
const grao = (rn: (x: number, y: number) => number, x: number, y: number): number => 0.6 * rn(x / 0.05, y / 0.05) + 0.4 * rn(x / 0.11 + 70, y / 0.11);

/**
 * Chão batido (clareira, acampamento, pátio de terra): terra pardo-acinzentada (o calor vem da luz, não do chão), com manchas largas de
 * umidade e cinza, grão de 4 a 8 cm, riscos claros de pisoteio, manchas de musgo, seixos e poucas folhas e galhos.
 */
function pintarChaoBatido(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 29 + 3), rg = valueNoise2D(seed * 29 + 8), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), cinza: Cor3 = [C[0] * 0.86, C[1] * 0.86, C[2] * 0.86], tmp = [0, 0, 0];
  const folhas: Cor3[] = [[78, 62, 42], [66, 54, 38], [88, 76, 52], [60, 58, 40]], musgo: Cor3 = [60, 64, 40], capim: Cor3 = [74, 80, 48];
  const R = areaDeAmostragem(ctx, A);
  const cLargo = campoDeRuido(rn, R, 0.28, 3), cCinza = campoDeRuido(rn, R, 0.6, 2, undefined, 7, 3), cMusgo = campoDeRuido(rn, R, 0.42, 3, undefined, 61, 17);
  const cPo = campoDeRuido(rn, R, 0.75, 3, undefined, 140, 90), cPisado = campoDeRuido(rn, R, 0.55, 3, undefined, 210, 33), cFolhico = campoDeRuido(rn, R, 0.38, 3, undefined, 33, 270);
  const po: Cor3 = [C[0] * 1.08, C[1] * 1.06, C[2] * 1.02], ruivo: Cor3 = [86, 60, 42];
  porPixel(ctx, A, (x, y, o) => {
    const largo = cLargo(x, y), medio = fbm(rn, x * 1.4 + 40, y * 1.4, 3), m = passo(0.58, 0.82, cMusgo(x, y)), f = passo(0.55, 0.8, cFolhico(x, y));
    mez(o, E, B, 0.3 + 0.65 * largo);
    rumo(o, C, passo(0.55, 0.85, medio) * 0.3);
    rumo(o, cinza, passo(0.62, 0.9, cCinza(x, y)) * 0.25);
    // Poeira clara e seca, manchas pisadas e escuras e manchas de folhiço avermelhado: a clareira não é uma cor só.
    rumo(o, po, passo(0.6, 0.85, cPo(x, y)) * 0.4);
    escurecer(o, 1 - passo(0.62, 0.88, cPisado(x, y)) * 0.25);
    rumo(o, ruivo, f * 0.3);
    rumo(o, musgo, m * 0.45);
    escurecer(o, 0.84 + grao(rg, x, y) * 0.3);
    // Pintas escuras (torrões, carvão) de 4 a 7 cm.
    sorteados(x, y, 0.22, 0.3, seed + 241, (cx, cy, i, j) => { const rr = 0.02 + 0.015 * hash2D(i, j, seed + 242); if (Math.hypot(x - cx, y - cy) < rr) { escurecer(o, 0.62); return true; } });
    // Riscos de pisoteio: traços claros e curtos em todas as direções.
    sorteados(x, y, 0.32, 0.4, seed + 211, (cx, cy, i, j) => { if (naLente(x - cx, y - cy, hash2D(i, j, seed + 212) * Math.PI, 0.07 + 0.08 * hash2D(i, j, seed + 213), 0.008 + px * 0.5) < 1) { rumo(o, C, 0.4); return true; } });
    detritos(o, x, y, seed, px, tmp, { folhas: 0.12 + m * 0.4 + f * 0.6, galhos: 0.5, seixos: 1, capim: passo(0.6, 1, m) * 0.5 }, folhas, capim);
  });
}

/**
 * Chão de mata: terra escura e fria coberta de folhiço (folhas secas em ocre, castanho e oliva, legíveis no mapa), manchas de musgo,
 * tufos de capim, galhos e seixos. É o chão sob as copas e entre elas.
 */
function pintarChaoDeMata(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 37 + 11), rg = valueNoise2D(seed * 37 + 19), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), tmp = [0, 0, 0];
  const folhas: Cor3[] = [[84, 72, 52], [96, 84, 60], [70, 62, 46], [80, 78, 54], [62, 56, 44], [104, 92, 66]], musgo: Cor3 = [54, 66, 38], capim: Cor3 = [84, 92, 56];
  const R = areaDeAmostragem(ctx, A);
  const cUmido = campoDeRuido(rn, R, 0.35, 3), cVerde = campoDeRuido(rn, R, 0.5, 3, undefined, 50, 0), cRuivo = campoDeRuido(rn, R, 0.3, 3, undefined, 120, 40);
  const folhasRuivas: Cor3[] = [[100, 70, 48], [88, 62, 44], [110, 82, 56], [78, 58, 42]];
  porPixel(ctx, A, (x, y, o) => {
    const verde = passo(0.45, 0.75, cVerde(x, y)), ruivo = passo(0.55, 0.8, cRuivo(x, y)), musgoso = verde * (0.75 + 0.5 * rn(x / 0.16 + 300, y / 0.16));
    mez(o, E, B, 0.25 + 0.6 * cUmido(x, y));
    rumo(o, C, passo(0.6, 0.85, fbm(rn, x * 1.2 + 9, y * 1.2, 3)) * 0.25);
    rumo(o, [88, 60, 40], ruivo * 0.4);
    rumo(o, musgo, Math.min(0.85, musgoso * 0.7));
    escurecer(o, 0.82 + grao(rg, x, y) * 0.34);
    detritos(o, x, y, seed, px, tmp, { folhas: 1 - verde * 0.5 + ruivo * 0.3, galhos: 0.8, seixos: 0.35, capim: 0.5 + verde * 0.8, samambaia: passo(0.25, 0.6, cVerde(x, y)) * 1.3 }, ruivo > 0.3 ? folhasRuivas : folhas, capim);
  });
}

/** Lajes rústicas: pedras grandes e irregulares (Voronoi torcido), com bisel de luz, rachaduras, desgaste e musgo nas juntas. */
function pintarLajesRusticas(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 47 + 1), L = mat.lado ?? 0.75, V = celulasDeVoronoi(A, L, seed * 17 + 2), q = novaConsulta(), externo = mat.uso === 'terreno';
  const E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), junta: Cor3 = [E[0] * 0.7, E[1] * 0.68, E[2] * 0.62], w = externo ? 0.055 : 0.035;
  porPixel(ctx, A, (x, y, o) => {
    const xx = x + (fbm(rn, x * 2.5, y * 2.5, 2) - 0.5) * 0.12, yy = y + (fbm(rn, x * 2.5 + 19, y * 2.5 + 7, 2) - 0.5) * 0.12;
    V.consultar(xx, yy, q);
    const s = q.sitio, b = q.borda;
    let t = 0.3 + 0.38 * s.azar + (fbm(rn, x * 1.6, y * 1.6, 4) - 0.5) * 0.35 + (hash2D(Math.floor(x / px), Math.floor(y / px), 3) - 0.5) * 0.05;
    t += (1 - passo(w, w + 0.08, b)) * 0.14 * ((s.x - xx) + (s.y - yy) > 0 ? 1 : -1);
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    rumo(o, E, passo(0.62, 0.8, fbm(rn, x * 0.8 + 50, y * 0.8, 3)) * 0.25);
    if (Math.abs(fbm(rn, x * 2.8 + 40 * (s.i & 3), y * 2.8 + 13 * (s.j & 3), 3) - 0.5) < 0.01 && hash2D(s.i, s.j, seed + 31) < 0.45) rumo(o, junta, 0.7);
    rumo(o, MUSGO, (1 - passo(0, w * 2.2, b)) * passo(0.55, 0.75, fbm(rn, x * 3 + 7, y * 3, 2)) * 0.5);
    rumo(o, junta, (1 - passo(w * 0.35, w, b)) * 0.95);
    // Ao ar livre, capim nas juntas largas (e às vezes subindo na beira da pedra).
    if (externo) { const capim = (1 - passo(w * 0.5, w * 1.6, b)) * passo(0.38, 0.6, fbm(rn, x * 4 + 3, y * 4 - 5, 3)); if (capim > 0.02) rumo(o, hash2D(Math.floor(x / (px * 1.5)), Math.floor(y / (px * 1.5)), 8) > 0.7 ? VERDE_CLARO : VERDE, Math.min(0.9, capim)); }
  });
}

/** Chapa xadrez: placas de 1,2 m com juntas e parafusos nos cantos, coberta de relevos em losango alternado, escovada e suja. */
function pintarChapaXadrez(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 53 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), P = 1.2, D = 0.1, FER: Cor3 = [112, 66, 38];
  const ea = 0.36, eb = 0.12;
  porPixel(ctx, A, (x, y, o) => {
    const pi = Math.floor(x / P), pj = Math.floor(y / P), lx = x - pi * P, ly = y - pj * P;
    const t = 0.55 + 0.1 * hash2D(pi, pj, seed + 3) + (fbm(rn, x * 1.2, y * 1.2, 3) - 0.5) * 0.1 + (fbm(rn, x * 0.6, y * 40, 2) - 0.5) * 0.08;
    mez(o, E, B, Math.min(1, t * 1.5));
    const ci = Math.floor(x / D), cj = Math.floor(y / D), u = x / D - ci - 0.5, v = y / D - cj - 0.5, a = ((ci + cj) & 1) ? -0.785 : 0.785, ca = Math.cos(a), sa = Math.sin(a);
    const pu = u * ca + v * sa, pv = -u * sa + v * ca, r = (pu / ea) ** 2 + (pv / eb) ** 2;
    if (r < 1.25) {
      const nx = (pu / (ea * ea)) * ca - (pv / (eb * eb)) * sa, ny = (pu / (ea * ea)) * sa + (pv / (eb * eb)) * ca, nn = Math.hypot(nx, ny) || 1, luz = (nx * LUZ_NO[0] + ny * LUZ_NO[1]) / nn;
      if (r < 1) { const borda = passo(0.2, 1, r); rumo(o, C, 0.28); rumo(o, luz > 0 ? C : E, Math.abs(luz) * borda * 0.85); }
      else if (luz < 0) escurecer(o, 1 + luz * 0.4);
    }
    const dj = Math.min(lx, P - lx, ly, P - ly);
    if (dj < 0.012) tomDe(o, E, 0.75); else if (dj < 0.022 && (lx < 0.022 || ly < 0.022)) rumo(o, C, 0.35);
    const bx = lx < P / 2 ? 0.05 : P - 0.05, by = ly < P / 2 ? 0.05 : P - 0.05, db = Math.hypot(lx - bx, ly - by);
    if (db < 0.02) { mez(o, B, C, 0.4 + 0.5 * passo(0.02, 0, db + (lx - bx + ly - by) * 0.4)); if (db > 0.015) tomDe(o, E, 0.8); }
    rumo(o, E, passo(0.62, 0.85, fbm(rn, x * 1.1 + 70, y * 1.1, 3)) * 0.2);
    rumo(o, FER, passo(0.74, 0.86, fbm(rn, x * 2.5 + 9, y * 2.5 + 40, 3)) * 0.35);
  });
}

/** Grade de piso: barras finas e travessas sobre o vão escuro (um vislumbre de tubos lá embaixo), em painéis de 1 m com moldura. */
function pintarGradeMetal(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 59 + 4), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), P = 1, BX = 0.06, BY = 0.2, FER: Cor3 = [96, 58, 34];
  const tubo: Cor3 = [E[0] + 22, E[1] + 24, E[2] + 28];
  const cTubo = campoDeRuido(rn, areaDeAmostragem(ctx, A), 0.3, 2);
  porPixel(ctx, A, (x, y, o) => {
    const lx = x - Math.floor(x / P) * P, ly = y - Math.floor(y / P) * P;
    tomDe(o, E, 0.9); rumo(o, tubo, passo(0.5, 0.56, Math.abs(Math.sin(y * 1.7 + cTubo(x, y) * 4))) * 0.6);
    const dx = x - Math.round(x / BX) * BX, dy = y - Math.round(y / BY) * BY, moldura = Math.min(lx, P - lx, ly, P - ly);
    const barra = Math.abs(dx) < 0.012, trav = Math.abs(dy) < 0.011, borda = moldura < 0.035;
    if (barra || trav || borda) {
      let t = 0.45 + (fbm(rn, x * 3, y * 3, 3) - 0.5) * 0.3;
      if (barra) t += dx < 0 ? 0.2 : -0.1; if (trav) t += dy < 0 ? 0.15 : -0.05; if (borda) t += 0.1;
      mez(o, B, C, Math.min(1, Math.max(0, t)));
      rumo(o, FER, passo(0.66, 0.82, fbm(rn, x * 2 + 30, y * 2, 3)) * 0.55);
    } else if ((dx > 0 && dx < 0.024) || (dy > 0 && dy < 0.022)) escurecer(o, 0.55);
  });
}

/** Toras deitadas (parede de cabana): cada tora é um cilindro com luz de cima, casca estriada e nós, com barro claro entre elas. */
function pintarToras(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 61 + 6), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), H = 0.27, BARRO: Cor3 = [148, 134, 112];
  porPixel(ctx, A, (x, y, o) => {
    const j = Math.floor(y / H), v = (y - j * H) / H, off = hash2D(j, 0, seed) * 3;
    const cil = Math.sin(Math.PI * Math.min(1, Math.max(0, (v - 0.05) / 0.9)));
    let t = 0.12 + 0.55 * cil * (0.8 + 0.4 * (1 - v)) + (fbm(rn, (x + off) * 1.4, y * 16 + j * 5, 3) - 0.5) * 0.4 + (hash2D(j, 1, seed) - 0.5) * 0.14;
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    const ki = Math.floor((x + off) / 1.1), kx = (ki + 0.2 + 0.6 * hash2D(ki, j, seed + 4)) * 1.1 - off, dk = Math.hypot((x - kx) * 0.8, (y - (j + 0.5) * H) * 1.6);
    if (hash2D(ki, j, seed + 5) < 0.4 && dk < 0.04) rumo(o, E, 0.5 + 0.4 * passo(0.04, 0.015, dk));
    const borda = Math.min(v, 1 - v) * H;
    if (borda < 0.024) rumo(o, BARRO, (1 - passo(0.012, 0.024, borda)) * (0.75 + 0.2 * fbm(rn, x * 8, y * 8, 2)));
    if (v > 0.84) escurecer(o, 0.85);
  });
}

/** Reboco sujo: manchas de umidade, escorridos, pontos descascados mostrando o tijolo e rachaduras finas. */
function pintarManchado(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 67 + 2), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), TIJOLO: Cor3 = [122, 104, 88];
  const R = areaDeAmostragem(ctx, A);
  const cUmido = campoDeRuido(rn, R, 0.5, 3, undefined, 30, 0);
  const cEscorrido = campoDeRuido(rn, R, 0.8, 2, undefined, 0, 5, 0.2);
  porPixel(ctx, A, (x, y, o) => {
    mez(o, B, C, 0.2 + 0.55 * fbm(rn, x * 1.1, y * 1.1, 4));
    rumo(o, E, passo(0.55, 0.8, cUmido(x, y)) * 0.45);
    rumo(o, E, passo(0.6, 0.85, fbm(rn, x * 6, y * 0.35 + 11, 3)) * passo(0.4, 0.7, cEscorrido(x, y)) * 0.35);
    const desc = passo(0.7, 0.735, fbm(rn, x * 1.8 + 60, y * 1.8, 4));
    if (desc > 0) rumo(o, TIJOLO, desc * 0.6);
    if (Math.abs(fbm(rn, x * 2.4 + 5, y * 2.4 + 90, 4) - 0.5) < 0.006) rumo(o, E, 0.6);
    escurecer(o, 0.96 + (hash2D(Math.floor(x / px), Math.floor(y / px), 9) - 0.5) * 0.08);
  });
}

/** Painéis metálicos de nave: placas de 0,9 × 1,2 m com bisel, rebites nas juntas, grelhas em algumas e sujeira escorrida. */
function pintarPainel(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 71 + 8), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), PW = 0.9, PH = 1.2, R = 0.012;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / PW), j = Math.floor(y / PH), lx = x - i * PW, ly = y - j * PH, h = hash2D(i, j, seed + 7);
    let t = 0.42 + 0.16 * h + (fbm(rn, x * 0.5, y * 30, 2) - 0.5) * 0.08 + (fbm(rn, x * 1.5, y * 1.5, 3) - 0.5) * 0.16;
    const de = Math.min(lx, ly), dd = Math.min(PW - lx, PH - ly);
    if (de < 0.03) t += 0.2 * (1 - de / 0.03); if (dd < 0.03) t -= 0.22 * (1 - dd / 0.03);
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    if (Math.min(lx, PW - lx, ly, PH - ly) < 0.008) tomDe(o, E, 0.7);
    const rx = lx < PW / 2 ? 0.045 : PW - 0.045, ry = Math.round((ly - 0.075) / 0.15) * 0.15 + 0.075, ry2 = ly < PH / 2 ? 0.045 : PH - 0.045, rx2 = Math.round((lx - 0.075) / 0.15) * 0.15 + 0.075;
    const dr = Math.min(Math.hypot(lx - rx, ly - ry), Math.hypot(lx - rx2, ly - ry2));
    if (dr < R) mez(o, B, C, 0.3 + 0.6 * passo(R, 0, dr * 1.5)); else if (dr < R * 1.6) escurecer(o, 0.8);
    if (h < 0.2 && lx > 0.2 && lx < PW - 0.2 && ly > 0.35 && ly < 0.8) { const f = ((ly - 0.35) / 0.05) % 1; if (f < 0.45) tomDe(o, E, f < 0.12 ? 0.5 : 0.75); else if (f < 0.55) rumo(o, C, 0.3); }
    rumo(o, E, passo(0.6, 0.85, fbm(rn, x * 4, y * 0.4, 3)) * 0.3);
  });
}

/** Acolchoado (parede de enfermaria, cápsula, cela de contenção): almofadas em losango com botões nas pontas. */
function pintarAcolchoado(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 73 + 1), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), D = 0.22, K = Math.SQRT1_2;
  porPixel(ctx, A, (x, y, o) => {
    const u = (x + y) * K / D, v = (y - x) * K / D, fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5, dome = 1 - Math.max(Math.abs(fu), Math.abs(fv)) * 2;
    let t = 0.35 + 0.3 * passo(0, 0.7, dome) - fu * 0.35 * (1 - dome) + (fbm(rn, x * 2, y * 2, 3) - 0.5) * 0.12;
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    if (dome < 0.05) escurecer(o, 0.75);
    const db = Math.hypot(Math.abs(fu) - 0.5, Math.abs(fv) - 0.5);
    if (db < 0.09) { tomDe(o, E, 0.85); if (db < 0.04) rumo(o, C, 0.4); }
    rumo(o, E, passo(0.62, 0.85, fbm(rn, x * 1.3 + 40, y * 1.3, 3)) * 0.25);
  });
}

/** Neve pisada: neve acinzentada nas áreas de passagem, com pegadas em pares (o fundo azulado e a borda com luz). */
function pintarNevePisada(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 79 + 3), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), S = 0.36, FUNDO: Cor3 = [E[0] * 0.95, E[1] * 1.0, E[2] * 1.08];
  const R = areaDeAmostragem(ctx, A);
  const Rviz = { x: R.x - S * 2, y: R.y - S * 2, w: R.w + S * 4, h: R.h + S * 4 };
  const cMancha = campoDeRuido(rn, R, 0.45, 3, undefined, 20, 0);
  const cTrilha = campoDeRuido(rn, Rviz, 0.35, 2, undefined, 3, 0);
  const cDir = campoDeRuido(rn, Rviz, 0.12, 2, undefined, 50, 0);
  porPixel(ctx, A, (x, y, o) => {
    mez(o, B, C, 0.3 + 0.6 * fbm(rn, x * 0.9, y * 0.9, 4));
    rumo(o, E, passo(0.5, 0.78, cMancha(x, y)) * 0.4);
    const ci = Math.floor(x / S), cj = Math.floor(y / S);
    let dentro = 0, aro = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, cx = (i + 0.5) * S, cy = (j + 0.5) * S;
      if (hash2D(i, j, seed + 5) > passo(0.45, 0.7, cTrilha(cx, cy)) * 0.75) continue;      // pegadas só nas faixas de passagem
      const a = cDir(cx, cy) * Math.PI * 4 + (hash2D(i, j, seed + 6) - 0.5) * 0.4, lado = hash2D(i, j, seed + 7) < 0.5 ? -1 : 1;
      const fx = cx + Math.cos(a + Math.PI / 2) * 0.07 * lado, fy = cy + Math.sin(a + Math.PI / 2) * 0.07 * lado;
      const dx = x - fx, dy = y - fy, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a), r = (u / 0.12) ** 2 + (v / 0.045) ** 2;
      if (r < 1) dentro = Math.max(dentro, 1 - r * 0.4); else if (r < 1.5 && dx * LUZ_NO[0] + dy * LUZ_NO[1] < 0) aro = 0.5;
    }
    if (dentro > 0) mez(o, FUNDO, B, 0.45 + 0.3 * (1 - dentro)); else if (aro > 0) rumo(o, C, aro * 0.6);
    if (hash2D(Math.floor(x / px), Math.floor(y / px), 13) > 0.997) rumo(o, [255, 255, 255], 0.8);
  });
}

/** Placas de concreto (piso industrial, hangar, estacionamento): juntas de dilatação, manchas de óleo e, com `ouro`, faixas de segurança gastas. */
function pintarPlacas(ctx: Contexto, mat: Material, A: Area, seed: number, px: number): void {
  const rn = valueNoise2D(seed * 83 + 7), E = rgbHex(mat.escuro), B = rgbHex(mat.base), C = rgbHex(mat.claro), L = mat.lado ?? 2, OLEO: Cor3 = [34, 32, 30], FAIXA = mat.ouro ? rgbHex(mat.ouro) : null;
  porPixel(ctx, A, (x, y, o) => {
    const i = Math.floor(x / L), j = Math.floor(y / L), lx = x - i * L, ly = y - j * L;
    const t = 0.4 + 0.2 * hash2D(i, j, seed + 2) + (fbm(rn, x * 0.8, y * 0.8, 4) - 0.5) * 0.25 + (hash2D(Math.floor(x / px), Math.floor(y / px), 4) - 0.5) * 0.08;
    if (t < 0.5) mez(o, E, B, Math.max(0, t) * 2); else mez(o, B, C, Math.min(1, (t - 0.5) * 2));
    if (FAIXA && (((j % 4) + 4) % 4) === 0 && ly > 0.15 && ly < 0.3) rumo(o, FAIXA, passo(0.3, 0.45, fbm(rn, x * 2.5, y * 2.5 + 15, 3)) * 0.85);
    rumo(o, OLEO, passo(0.68, 0.82, fbm(rn, x * 0.6 + 40, y * 0.6, 3)) * 0.45);
    if (Math.abs(fbm(rn, x * 1.2 + 11, y * 1.2 + 70, 4) - 0.5) < 0.005 && hash2D(i, j, seed + 9) < 0.3) rumo(o, E, 0.55);
    const dj = Math.min(lx, L - lx, ly, L - ly);
    if (dj < 0.012) tomDe(o, E, 0.75); else if (dj < 0.03) escurecer(o, 0.93);
  });
}

// ---------- Layouts compartilhados entre a cor e a altura ----------

interface Tabua { x: number; y: number; comp: number; larg: number; tom: number; veios: { y: number; alfa: number; dy: number[] }[]; no: { x: number; y: number; r: number } | null; fimDaFileira: boolean }
/** As tábuas de `tabuas`, na ordem e com os sorteios do desenho (a cor e a altura leem o mesmo layout). */
function layoutDeTabuas(mat: Material, A: Area, r: () => number): Tabua[] {
  const larg = mat.largura ?? 0.2, saida: Tabua[] = [];
  for (let y = A.y; y < A.y + A.h; y += larg) {
    let x = A.x - r() * 2;
    while (x < A.x + A.w) {
      const comp = 1.4 + r() * 2.2, tom = 0.35 + r() * 0.35, veios: Tabua['veios'] = [];
      for (let v = 0; v < 5; v++) { const yy = y + larg * (0.15 + r() * 0.7), alfa = 0.18 + r() * 0.2, dy: number[] = []; for (let t = 0.2; t <= comp; t += 0.2) dy.push((r() - 0.5) * 0.02); veios.push({ y: yy, alfa, dy }); }
      let no: Tabua['no'] = null;
      if (r() < 0.25) { const nx = x + r() * comp, ny = y + larg * (0.3 + r() * 0.4), nr = 0.025 + r() * 0.02; no = { x: nx, y: ny, r: nr }; }
      saida.push({ x, y, comp, larg, tom, veios, no, fimDaFileira: false });
      x += comp;
    }
    saida[saida.length - 1]!.fimDaFileira = true;
  }
  return saida;
}

type PecaDeLaje = { fileira: false; x: number; y: number; comp: number; alt: number; tom: number } | { fileira: true; y: number };
/** As lajes de `laje` (fileiras de alturas sorteadas), na ordem dos sorteios do desenho. */
function layoutDeLajes(A: Area, r: () => number): PecaDeLaje[] {
  const saida: PecaDeLaje[] = [];
  for (let y = A.y; y < A.y + A.h; y += 0.42 + r() * 0.2) {
    const alt = 0.42 + r() * 0.2; let x = A.x - r();
    while (x < A.x + A.w) { const comp = 0.5 + r() * 0.8, tom = r() * 0.45; saida.push({ fileira: false, x, y, comp, alt, tom }); x += comp; }
    saida.push({ fileira: true, y });
  }
  return saida;
}

// ---------- Alturas por padrão (Frente L, L10) ----------
// O mapa de altura vai de 0 a 1 com o piso em 0,5. Os valores são de leitura, não de medida: o filtro de relevo deriva a
// normal da diferença entre vizinhos, então juntas de 1 a 2 cm viram 0,03 a 0,07 aqui. Cada peça é um platô com bisel e
// um desnível próprio em relação às vizinhas; materiais polidos ficam planos. Nada de rampa suave nem micro-relevo de
// baixa frequência: no mapa de 8 bits isso vira degraus de 1 nível, e o relevo da luz os desenha como curvas de nível.

/** Piso no mapa de altura. */
const PISO = 0.5;

/** Platô de uma peça: `d` é a distância à borda (m), `junta` a meia-largura da junta, `bisel` a largura da quina gasta. */
const plato = (d: number, junta: number, bisel: number, prof: number): number => (d < junta ? PISO - prof : PISO - prof * (1 - passo(0, bisel, d - junta)) * 0.85);

/** Pinta a altura `h(x, y)` (0–1) no canal R, por pixel, na área já rodada como a cor faz. */
function alturaPorPixel(ctx: Contexto, A: Area, h: (x: number, y: number) => number): void {
  porPixel(ctx, A, (x, y, o) => { o[0] = Math.round(Math.min(1, Math.max(0, h(x, y))) * 255); o[1] = 0; o[2] = 0; });
}

/** A área que a cor de fato cobre (o quadrado da diagonal, para a rotação do padrão não deixar canto vazio). */
const areaDaCor = (area: Area): Area => { const diag = Math.hypot(area.w, area.h); return { x: area.x + area.w / 2 - diag / 2, y: area.y + area.h / 2 - diag / 2, w: diag, h: diag }; };
const areaDaAltura = (area: Area, dir = 0): Area => (dir ? areaDaCor(area) : area);


const plano = (ctx: Contexto, A: Area): void => { ctx.save(); ctx.fillStyle = `rgb(${Math.round(PISO * 255)},0,0)`; ctx.fillRect(A.x, A.y, A.w, A.h); ctx.restore(); };

/** Pintores de altura por padrão: a mesma geometria do desenho de cor. Padrões fora daqui usam a reserva por luminância. */
export const ALTURAS_DE_PADRAO: Partial<Record<Padrao, (ctx: Contexto, mat: Material, area: Area, seed: number, px: number, dir?: number) => void>> = {
  // Lisos e polidos: planos. A luminância deles é desenho (veio, estampa, mancha), não relevo.
  liso: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  trama: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  couro: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  metal: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  vidro: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  pintura: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  persa: (ctx, _m, a) => plano(ctx, a),
  damasco: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  listras: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  floral: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  manchado: (ctx, _m, a, _s, _px, dir) => plano(ctx, areaDaAltura(a, dir)),
  // Terra, lama e areia: quase planas. As manchas de cor são umidade e tom, não calombos (pela luminância viravam escamas sob a luz).
  terra: (ctx, _m, a, s) => alturaPorPixel(ctx, a, (x, y) => PISO + seixo(x, y, 0.5, 0.25, 0.02, 0.04, s + 7).k * 0.05),
  lama: (ctx, _m, a) => plano(ctx, a),
  areia: (ctx, _m, a) => plano(ctx, a),
  batido: (ctx, _m, a, s) => alturaPorPixel(ctx, a, (x, y) => PISO + seixo(x, y, 0.5, 0.096, 0.035, 0.045, s + 31).k * 0.04),
  folhico: (ctx, _m, a, s) => alturaPorPixel(ctx, a, (x, y) => PISO + seixo(x, y, 0.5, 0.042, 0.035, 0.045, s + 31).k * 0.04),

  tabuas(ctx, mat, area, seed, px) {
    const A = areaDaCor(area), r = mulberry32(seed * 7919 + 13);
    const larg = mat.largura ?? 0.2, fileiras: Tabua[][] = [];
    for (const b of layoutDeTabuas(mat, A, r)) (fileiras[Math.round((b.y - A.y) / larg)] ??= []).push(b);
    // Cada tábua: platô levemente abaulado no meio da largura, um pouco mais alta ou baixa que a vizinha, juntas finas.
    alturaPorPixel(ctx, A, (x, y) => {
      const fi = Math.floor((y - A.y) / larg), yl = y - A.y - fi * larg;
      let t: Tabua | undefined;
      for (const b of fileiras[fi] ?? []) if (b.x <= x && x < b.x + b.comp) { t = b; break; }
      if (!t) return PISO;
      const d = Math.min(yl, larg - yl, x - t.x, t.x + t.comp - x), i = Math.round(t.x * 10);
      return plato(d, Math.max(0.006, px * 0.8), 0.02, 0.035) + (hash2D(i, fi, seed + 5) - 0.5) * 0.02;
    });
  },

  laje(ctx, _mat, area, seed, px) {
    const A = areaDaCor(area), r = mulberry32(seed * 7919 + 13);
    const pecas = layoutDeLajes(A, r).filter((p): p is Extract<PecaDeLaje, { fileira: false }> => !p.fileira), FAIXA = 0.1, faixas: number[][] = [];
    pecas.forEach((p, k) => { for (let f = Math.floor((p.y - A.y) / FAIXA); f <= Math.floor((p.y + p.alt - A.y) / FAIXA); f++) (faixas[f] ??= []).push(k); });
    alturaPorPixel(ctx, A, (x, y) => {
      let melhor = -1, idx = -1;
      for (const k of faixas[Math.floor((y - A.y) / FAIXA)] ?? []) {
        const p = pecas[k]!;
        if (x < p.x || x >= p.x + p.comp || y < p.y || y >= p.y + p.alt) continue;
        const d = Math.min(x - p.x, p.x + p.comp - x, y - p.y, p.y + p.alt - y);
        if (d > melhor) { melhor = d; idx = k; }
      }
      if (idx < 0) return PISO - 0.06;
      return plato(melhor, Math.max(0.014, px * 0.8), 0.05, 0.06) + (hash2D(idx, 0, seed + 71) - 0.5) * 0.04;
    });
  },

  xadrez(ctx, mat, area, seed, px) {
    const A = areaDaCor(area), l = mat.lado ?? 0.5;
    alturaPorPixel(ctx, A, (x, y) => {
      const i = Math.floor(x / l), j = Math.floor(y / l), lx = x - i * l, ly = y - j * l, d = Math.min(lx, l - lx, ly, l - ly);
      return plato(d, Math.max(0.006, px * 0.8), 0.012, 0.03) + (hash2D(i, j, seed + 71) - 0.5) * 0.008;
    });
  },

  losango(ctx, mat, area, seed, px) {
    const A = areaDaCor(area), l = mat.lado ?? 0.5, cx = A.x + A.w / 2, cy = A.y + A.h / 2, c = Math.SQRT1_2;
    alturaPorPixel(ctx, A, (x, y) => {
      const u = ((x - cx) * c + (y - cy) * c), v = (-(x - cx) * c + (y - cy) * c), i = Math.floor(u / l), j = Math.floor(v / l), lu = u - i * l, lv = v - j * l;
      return plato(Math.min(lu, l - lu, lv, l - lv), Math.max(0.005, px * 0.8), 0.012, 0.03) + (hash2D(i, j, seed + 71) - 0.5) * 0.008;
    });
  },

  hexagono(ctx, mat, area, seed, px) {
    const A = areaDaCor(area), R = mat.lado ?? 0.2, dx = R * 1.732, dy = R * 1.5;
    alturaPorPixel(ctx, A, (x, y) => {
      // O hexágono mais próximo entre os centros vizinhos da grade em meia-queda; a distância à borda vem da norma hexagonal.
      let melhor = Infinity, bi = 0, bj = 0, bx = 0, by = 0;
      const j0 = Math.round(y / dy);
      for (let j = j0 - 1; j <= j0 + 1; j++) { const ox = j % 2 ? dx / 2 : 0, i0 = Math.round((x - ox) / dx); for (let i = i0 - 1; i <= i0 + 1; i++) { const hx = i * dx + ox, hy = j * dy, dd = Math.hypot(x - hx, y - hy); if (dd < melhor) { melhor = dd; bi = i; bj = j; bx = hx; by = hy; } } }
      const ax = Math.abs(x - bx), ay = Math.abs(y - by), apotema = R * 0.866, dist = apotema - Math.max(ax, ax * 0.5 + ay * 0.866);
      return plato(Math.max(-1, dist), Math.max(0.01, px * 0.8), 0.014, 0.03) + (hash2D(bi, bj, seed + 71) - 0.5) * 0.01;
    });
  },

  marmore(ctx, mat, area, _seed, px, dir) {
    // Polido: placas planas, só a junta fina; os veios são desenho, não relevo.
    const A = areaDaAltura(area, dir), L = mat.lado ?? 0.8;
    alturaPorPixel(ctx, A, (x, y) => { const lx = x - Math.floor(x / L) * L, ly = y - Math.floor(y / L) * L; return plato(Math.min(lx, L - lx, ly, L - ly), Math.max(0.004, px * 0.8), 0.006, 0.02); });
  },

  espinha(ctx, _mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), W = 0.56, P = 0.14;
    alturaPorPixel(ctx, A, (x, y) => {
      const c = Math.floor(x / W), xl = x - c * W, par = (c & 1) === 0, t = y + (par ? xl : W - xl), id = Math.floor(t / P), ft = t - id * P;
      return plato(Math.min(xl, W - xl, ft * 0.7, (P - ft) * 0.7), Math.max(0.004, px * 0.8), 0.012, 0.025) + (hash2D(c, id, seed + 4) - 0.5) * 0.012;
    });
  },

  marchetaria(ctx, _mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), T = 0.24, faixa = 2.6, hf = 0.3;
    alturaPorPixel(ctx, A, (x, y) => {
      const fy = ((y % faixa) + faixa) % faixa;
      if (fy < hf) return plato(Math.min(fy, hf - fy), Math.max(0.01, px * 0.8), 0.01, 0.02);
      const i = Math.floor(x / T), lx = x - i * T, L = 1.6 + hash2D(i, 3, seed) * 1.6, off = hash2D(i, 5, seed) * L, j = Math.floor((y + off) / L), ly = y + off - j * L;
      return plato(Math.min(lx, T - lx, ly, L - ly), Math.max(0.004, px * 0.8), 0.014, 0.025) + (hash2D(i, j, seed + 2) - 0.5) * 0.014;
    });
  },

  'lajes-grandes'(ctx, mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), rn = valueNoise2D(seed * 41 + 3), RH = mat.lado ?? 0.9, gw = 0.028;
    const largura = (i: number, j: number) => 0.9 * RH / 0.9 + hash2D(i, j, seed + 2) * 0.9 * RH / 0.9;
    alturaPorPixel(ctx, A, (x, y) => {
      const j = Math.floor(y / RH), off = hash2D(j, 1, seed + 5) * 1.3, bloco = 8;
      let ciclo = 0; for (let k = 0; k < bloco; k++) ciclo += largura(k, j);
      const xl = x - off - Math.floor((x - off) / ciclo) * ciclo, base = Math.floor((x - off) / ciclo);
      let e0 = 0, i = 0; while (i < bloco - 1 && e0 + largura(i, j) <= xl) { e0 += largura(i, j); i++; }
      const e1 = e0 + largura(i, j), id = base * bloco + i, yt = j * RH, dx0 = xl - e0, dx1 = e1 - xl, dy0 = y - yt, dy1 = yt + RH - y, d = Math.min(dx0, dx1, dy0, dy1);
      const quina = Math.min(Math.hypot(dx0, dy0), Math.hypot(dx1, dy0), Math.hypot(dx0, dy1), Math.hypot(dx1, dy1));
      const lasca = quina < 0.12 && hash2D(id, j, seed + 17) < 0.45 ? 0.05 * (1 - quina / 0.12) : 0;
      const rach = hash2D(id, j, seed + 40) < 0.22 && Math.abs(fbm(rn, x * 1.3 + id * 7.3, y * 1.3 + j * 3.1, 2) - 0.5) < 0.008 ? 0.03 : 0;
      return plato(d, Math.max(gw, px * 0.8), 0.07, 0.07) - lasca - rach + (hash2D(id, j, seed + 71) - 0.5) * 0.05;
    });
  },

  'lajes-rusticas'(ctx, mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), rn = valueNoise2D(seed * 47 + 1), L = mat.lado ?? 0.75, V = celulasDeVoronoi(A, L, seed * 17 + 2), q = novaConsulta(), w = mat.uso === 'terreno' ? 0.055 : 0.035;
    alturaPorPixel(ctx, A, (x, y) => {
      const xx = x + (fbm(rn, x * 2.5, y * 2.5, 2) - 0.5) * 0.12, yy = y + (fbm(rn, x * 2.5 + 19, y * 2.5 + 7, 2) - 0.5) * 0.12;
      V.consultar(xx, yy, q);
      const s = q.sitio;
      return plato(q.borda * 0.5, Math.max(w * 0.5, px * 0.8), 0.08, 0.08) + (hash2D(s.i, s.j, seed + 71) - 0.5) * 0.06;
    });
  },

  rachado(ctx, _mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), rn = valueNoise2D(seed * 31 + 5), V1 = celulasDeVoronoi(A, 0.9, seed * 13 + 1), V2 = celulasDeVoronoi(A, 1.9, seed * 13 + 2), q1 = novaConsulta(), q2 = novaConsulta();
    alturaPorPixel(ctx, A, (x, y) => {
      const xx = x + (fbm(rn, x * 2.4, y * 2.4, 2) - 0.5) * 0.17, yy = y + (fbm(rn, x * 2.4 + 37, y * 2.4 + 11, 2) - 0.5) * 0.17;
      V1.consultar(xx, yy, q1);
      V2.consultar(x + (fbm(rn, x * 1.1 + 5, y * 1.1, 2) - 0.5) * 0.5, y + (fbm(rn, x * 1.1, y * 1.1 + 5, 2) - 0.5) * 0.5, q2);
      const s = q1.sitio;
      return plato(q1.borda * 0.5, Math.max(0.012, px * 0.8), 0.09, 0.09) - (1 - passo(0.01, 0.05, q2.borda * 0.5)) * 0.06 + (hash2D(s.i, s.j, seed + 71) - 0.5) * 0.07;
    });
  },

  paralelepipedo(ctx, _mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), rn = valueNoise2D(seed * 29 + 3), V = celulasDeVoronoi(A, 0.25, seed * 13 + 4), q = novaConsulta();
    alturaPorPixel(ctx, A, (x, y) => {
      const xx = x + (fbm(rn, x * 6, y * 6, 2) - 0.5) * 0.035, yy = y + (fbm(rn, x * 6 + 31, y * 6 + 7, 2) - 0.5) * 0.035;
      V.consultar(xx, yy, q);
      // Pedra arredondada: domo a partir da borda, rejunte fundo (mínimo 0,8 px para não sumir a 32 px/m no terreno).
      const b = q.borda * 0.5, j = Math.max(0.008, px * 0.8);
      return b < j ? PISO - 0.08 : PISO - 0.08 + Math.sqrt(passo(j, Math.max(0.07, j + 0.04), b)) * 0.1 + (hash2D(q.sitio.i, q.sitio.j, seed + 3) - 0.5) * 0.02;
    });
  },

  lajegrama(ctx, _mat, area, seed, px, dir) {
    const A = areaDaAltura(area, dir), RH = 1.25, LW = 1.7, gw = 0.06;
    alturaPorPixel(ctx, A, (x, y) => {
      const j = Math.floor(y / RH), off = hash2D(j, 0, seed + 5) * LW, jit = (i: number) => (hash2D(i, j, seed + 9) - 0.5) * 0.4;
      let i = Math.floor((x - off) / LW), e0 = i * LW + off + jit(i), e1 = (i + 1) * LW + off + jit(i + 1);
      if (x < e0) { i--; e1 = e0; e0 = i * LW + off + jit(i); } else if (x >= e1) { i++; e0 = e1; e1 = (i + 1) * LW + off + jit(i + 1); }
      if (hash2D(i, j, seed + 21) < 0.1) return PISO - 0.07;
      const yt = j * RH, d = Math.min(x - e0, e1 - x, y - yt, yt + RH - y);
      return plato(d, Math.max(gw * 0.5, px * 0.8), 0.08, 0.07) + (hash2D(i, j, seed + 71) - 0.5) * 0.05;
    });
  },

  placas(ctx, mat, area, _seed, px, dir) {
    const A = areaDaAltura(area, dir), L = mat.lado ?? 2;
    alturaPorPixel(ctx, A, (x, y) => { const lx = x - Math.floor(x / L) * L, ly = y - Math.floor(y / L) * L; return plato(Math.min(lx, L - lx, ly, L - ly), Math.max(0.012, px * 0.8), 0.02, 0.03); });
  },
};
