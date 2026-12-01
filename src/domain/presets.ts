import { decodificar } from './celulas.ts';
import { ambienteDaCor, ceuNoHorario } from './clima.ts';
import type { Acabamento, Clima, Comodo, Luz, MapaAtlas, Ponto, Tempo } from './mapa.ts';

/** Um tipo de cômodo: o piso e o papel de parede que combinam, e a função que a construção inteligente (Fase 5) vai usar. */
export interface TipoDeComodo { id: string; nome: string; funcao: string; piso: string; papel: string; descricao: string }

export const TIPOS_DE_COMODO: readonly TipoDeComodo[] = [
  { id: 'sala', nome: 'Sala', funcao: 'sala', piso: 'tabuas.carvalho', papel: 'papel.damasco-vinho', descricao: 'Tábuas de carvalho e damasco vinho' },
  { id: 'cozinha', nome: 'Cozinha', funcao: 'cozinha', piso: 'ladrilho.cozinha', papel: 'papel.listras-creme', descricao: 'Ladrilho claro e listras creme' },
  { id: 'quarto', nome: 'Quarto', funcao: 'quarto', piso: 'tabuas.claras', papel: 'papel.damasco-azul', descricao: 'Tábuas claras e damasco azul' },
  { id: 'biblioteca', nome: 'Biblioteca', funcao: 'biblioteca', piso: 'ladrilho.xadrez', papel: 'papel.listras-musgo', descricao: 'Xadrez e verde-musgo' },
  { id: 'escritorio', nome: 'Escritório', funcao: 'escritorio', piso: 'tabuas.escuras', papel: 'papel.liso-escuro', descricao: 'Tábuas escuras e parede lisa' },
  { id: 'banheiro', nome: 'Banheiro', funcao: 'banheiro', piso: 'azulejo.branco', papel: 'reboco.branco', descricao: 'Azulejo e reboco branco' },
  { id: 'corredor', nome: 'Corredor', funcao: 'corredor', piso: 'carpete.vinho', papel: 'papel.liso-claro', descricao: 'Carpete vinho' },
  { id: 'enfermaria', nome: 'Enfermaria', funcao: 'hospital', piso: 'ladrilho.azul', papel: 'reboco.branco', descricao: 'Ladrilho azul e reboco' },
  { id: 'taverna', nome: 'Taverna', funcao: 'taverna', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras e tijolo' },
  { id: 'sala-de-jantar', nome: 'Sala de jantar', funcao: 'sala-de-jantar', piso: 'tabuas.escuras', papel: 'papel.damasco-vinho', descricao: 'Tábuas escuras e damasco vinho' },
  { id: 'sala-de-jogos', nome: 'Sala de jogos', funcao: 'sala-de-jogos', piso: 'tabuas.carvalho', papel: 'papel.listras-musgo', descricao: 'Carvalho e listras verde-musgo' },
  { id: 'capela', nome: 'Capela', funcao: 'capela', piso: 'laje.pedra', papel: 'reboco.branco', descricao: 'Lajes de pedra e reboco branco' },
  { id: 'forja', nome: 'Forja', funcao: 'forja', piso: 'laje.pedra', papel: 'tijolo', descricao: 'Lajes de pedra e tijolo' },
  { id: 'varanda', nome: 'Varanda', funcao: 'varanda', piso: 'laje.pedra', papel: 'reboco.branco', descricao: 'Lajes de pedra, balaustrada e vasos' },
  { id: 'porao', nome: 'Porão', funcao: 'porao', piso: 'laje.pedra', papel: 'tijolo', descricao: 'Lajes de pedra e tijolo' },
  { id: 'estabulo', nome: 'Estábulo', funcao: 'estabulo', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras e tijolo para cavalos e feno' },
  { id: 'celeiro', nome: 'Celeiro', funcao: 'celeiro', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras, feno e grãos' },
  { id: 'deposito', nome: 'Depósito', funcao: 'deposito', piso: 'concreto', papel: 'tijolo', descricao: 'Concreto, tijolo e estoque de carga' },
  { id: 'loja', nome: 'Loja', funcao: 'loja', piso: 'tabuas.carvalho', papel: 'papel.liso-claro', descricao: 'Tábuas de carvalho, balcão e prateleiras' },
  { id: 'oficina', nome: 'Oficina', funcao: 'oficina', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras e bancadas de trabalho' },
  { id: 'cela', nome: 'Cela', funcao: 'cela', piso: 'laje.pedra', papel: 'tijolo', descricao: 'Lajes de pedra e tijolo' },
  { id: 'dormitorio', nome: 'Dormitório', funcao: 'dormitorio', piso: 'tabuas.escuras', papel: 'reboco.branco', descricao: 'Tábuas escuras e alojamento coletivo' },
  { id: 'refeitorio', nome: 'Refeitório', funcao: 'refeitorio', piso: 'tabuas.escuras', papel: 'tijolo', descricao: 'Tábuas escuras e mesas compridas' },
  { id: 'salao', nome: 'Salão', funcao: 'salao', piso: 'tabuas.carvalho', papel: 'boiserie.escura', descricao: 'Tábuas de carvalho e boiserie escura' },
  { id: 'patio', nome: 'Pátio', funcao: 'patio', piso: 'laje.pedra', papel: 'reboco.branco', descricao: 'Lajes de pedra ao ar livre' },
  // Antiguidade (Q15c).
  { id: 'atrio', nome: 'Átrio', funcao: 'atrio', piso: 'mosaico.romano', papel: 'estuque.pompeiano', descricao: 'Mosaico romano, estuque pompeiano e impluvio' },
  { id: 'peristilo', nome: 'Peristilo', funcao: 'peristilo', piso: 'lajes.arenito', papel: 'alvenaria.arenito', descricao: 'Jardim com colunas, ao ar livre' },
  { id: 'triclinio', nome: 'Triclínio', funcao: 'triclinio', piso: 'mosaico.medalhao', papel: 'estuque.pompeiano', descricao: 'Sala de banquete: leitos em volta da mesa' },
  { id: 'termas', nome: 'Termas', funcao: 'termas', piso: 'mosaico.romano', papel: 'alvenaria.arenito', descricao: 'Banhos romanos: tanques, bancos e ânforas' },
  { id: 'templo', nome: 'Templo', funcao: 'templo', piso: 'lajes.arenito', papel: 'alvenaria.arenito', descricao: 'Estátua do deus, altar, tripés e colunas' },
  { id: 'forum', nome: 'Fórum', funcao: 'forum', piso: 'lajes.arenito', papel: 'alvenaria.arenito', descricao: 'Praça da cidade antiga, ao ar livre' },
  { id: 'taberna', nome: 'Taberna', funcao: 'taberna', piso: 'terracota.quadrada', papel: 'alvenaria.arenito', descricao: 'Terracota, mesas, ânforas e pithos' },
  // Oriental (Q16c).
  { id: 'sala-de-tatami', nome: 'Sala de tatami', funcao: 'sala-de-tatami', piso: 'tatami', papel: 'shoji', descricao: 'Tatami, shoji, mesa baixa e tokonoma' },
  { id: 'casa-de-cha', nome: 'Casa de chá', funcao: 'casa-de-cha', piso: 'tatami', papel: 'shoji', descricao: 'Tatami, irori ou mesa baixa e o serviço de chá' },
  { id: 'dojo', nome: 'Dojo', funcao: 'dojo', piso: 'tabuas.claras', papel: 'shoji', descricao: 'Assoalho livre, espadas e armadura na parede' },
  { id: 'santuario', nome: 'Santuário', funcao: 'santuario', piso: 'tabuas.laqueadas', papel: 'madeira.laqueada', descricao: 'Estátua sentada, incensário e lanternas' },
  { id: 'jardim', nome: 'Jardim', funcao: 'jardim', piso: 'pedra.rustica', papel: 'pedra.aparelhada', descricao: 'Lanternas de pedra, cascalho rastelado e bonsai, ao ar livre' },
  // Deserto (Q17c). O `deposito` já existe; o gênero só troca o que ele guarda (cântaros, cestos, baús).
  { id: 'tenda', nome: 'Tenda', funcao: 'tenda', piso: 'palha.chao', papel: 'taipa', descricao: 'Por dentro da tenda: tapetes, almofadas, mesa de latão e lanternas' },
  { id: 'patio-com-fonte', nome: 'Pátio com fonte', funcao: 'patio-com-fonte', piso: 'zellige', papel: 'adobe', descricao: 'Zellige, fonte ou poço, palmeiras e toldo, ao ar livre' },
  { id: 'bazar', nome: 'Bazar', funcao: 'bazar', piso: 'terracota.quadrada', papel: 'adobe', descricao: 'Bancas de especiarias, tapetes pendurados, cestos e cântaros' },
  { id: 'salao-de-cha', nome: 'Salão de chá', funcao: 'salao-de-cha', piso: 'zellige', papel: 'reboco.branco', descricao: 'Almofadas, mesas de latão, narguilés e lanternas' },
  // Faroeste (Q18c). O `estabulo` já existe; o gênero só troca o que ele guarda (poste com cocho, bomba de manivela).
  { id: 'saloon', nome: 'Saloon', funcao: 'saloon', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', descricao: 'Balcão com garrafas, mesas de pôquer, piano e escarradeiras' },
  { id: 'xerifado', nome: 'Xerifado', funcao: 'xerifado', piso: 'tabuas.gastas', papel: 'caiado', descricao: 'Mesa do xerife, cela de cadeia, cofre e cartazes de procurado' },
  { id: 'armazem-geral', nome: 'Armazém geral', funcao: 'armazem-geral', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', descricao: 'Balcão, estantes, sacos, barris e caixotes' },
  { id: 'banco', nome: 'Banco', funcao: 'banco', piso: 'ladrilho.hidraulico', papel: 'caiado', descricao: 'Balcão do caixa, cofre e escrivaninha' },
  { id: 'estacao', nome: 'Estação', funcao: 'estacao', piso: 'tijoleira', papel: 'tabuas.descascadas', descricao: 'Bilheteria, bancos de espera, caixotes e relógio' },
  // Colonial e pirata (Q19c). O `porao` já existe; o gênero só troca o que ele guarda (barris de rum, fardos de açúcar, rede de dormir, canhão naval).
  { id: 'conves', nome: 'Convés', funcao: 'conves', piso: 'tabuas.gastas', papel: 'tabuas.descascadas', descricao: 'Timão, mastro, canhões nas bordas, barris e cordame, ao ar livre' },
  { id: 'cabine-do-capitao', nome: 'Cabine do capitão', funcao: 'cabine-do-capitao', piso: 'tabuas.carvalho', papel: 'boiserie.escura', descricao: 'Mesa de cartógrafo, baú de tesouro, mapa e luneta, rede e estante' },
  { id: 'taverna-do-porto', nome: 'Taverna do porto', funcao: 'taverna-do-porto', piso: 'tabuas.gastas', papel: 'caiado', descricao: 'Mesas de taverna, barris de rum e balcão' },
  { id: 'fortim', nome: 'Fortim', funcao: 'fortim', piso: 'laje.pedra', papel: 'pedra.aparelhada', descricao: 'Canhões de forte, balas, sino de cais e bandeira, ao ar livre' },
  { id: 'casa-colonial', nome: 'Casa colonial', funcao: 'casa-colonial', piso: 'tijoleira', papel: 'caiado', descricao: 'Oratório, mesa, rede de dormir e botica' },
  // Vitoriano e steampunk (Q20c). As salas comuns (sala, escritório, quarto…) usam a paleta do gênero em `MATERIAIS_POR_GENERO.vitoriano`.
  { id: 'fabrica', nome: 'Fábrica', funcao: 'fabrica', piso: 'tabuas.gastas', papel: 'tijolo.fuligem', descricao: 'Caldeira, máquina a vapor, teares, prensa e esteira; tubulação de cobre e manômetros na parede' },
  { id: 'oficina-de-inventor', nome: 'Oficina de inventor', funcao: 'oficina-de-inventor', piso: 'tabuas.gastas', papel: 'tijolo.fuligem', descricao: 'Bancada de inventor, autômato, bobina de Tesla, engrenagens e prensa' },
  { id: 'clube', nome: 'Clube de cavalheiros', funcao: 'clube', piso: 'tabuas.escuras', papel: 'papel.damasco-vinho', descricao: 'Poltronas de couro, lareira, mesa de bilhar, gramofone e estante' },
  { id: 'estacao-de-dirigivel', nome: 'Estação de dirigível', funcao: 'estacao-de-dirigivel', piso: 'ladrilho.xadrez', papel: 'tijolo.fuligem', descricao: 'Salão de embarque: bancos, banca de jornal, relógio, malas e esteira de bagagem' },
  // Moderno urbano (Q21c). `enfermaria` já existe (função `hospital`) e ganha cama hospitalar no gênero; o posto é só a loja de conveniência (as bombas ficam fora, no exterior), e por isso tem telhado.
  { id: 'mercado', nome: 'Mercado', funcao: 'mercado', piso: 'vinil.industrial', papel: 'papel.liso-claro', descricao: 'Gôndolas em fileiras, freezers na parede e caixas' },
  { id: 'lanchonete', nome: 'Lanchonete', funcao: 'lanchonete', piso: 'ladrilho.xadrez', papel: 'azulejo.metro', descricao: 'Mesas com assento estofado, balcão e máquina de venda' },
  { id: 'garagem', nome: 'Garagem', funcao: 'garagem', piso: 'concreto.placas', papel: 'reboco.branco', descricao: 'Carros, bancada de ferramentas, tambores e caixotes' },
  { id: 'posto', nome: 'Posto (conveniência)', funcao: 'posto', piso: 'vinil.industrial', papel: 'papel.liso-claro', descricao: 'Loja de conveniência: gôndolas, freezer, caixa e máquina de venda' },
  { id: 'vestiario', nome: 'Vestiário', funcao: 'vestiario', piso: 'azulejo.branco', papel: 'azulejo.metro', descricao: 'Armários de vestiário nas paredes e bancos' },
  // Pós-apocalíptico (Q22c). O acampamento é ao ar livre (sem telhado, ver `FUNCOES_AO_AR_LIVRE`); o posto de guarda é uma guarita, com teto.
  { id: 'acampamento', nome: 'Acampamento', funcao: 'acampamento', piso: 'terra.batida', papel: 'chapa.enferrujada', descricao: 'Barracas, colchões, tonel e fogareiro no centro, gerador, tanque, horta e caixas, ao ar livre' },
  { id: 'abrigo', nome: 'Abrigo (bunker)', funcao: 'abrigo', piso: 'concreto.rachado', papel: 'concreto.pichado', descricao: 'Colchões, caixas de suprimentos, tanque, gerador e prateleiras' },
  { id: 'enfermaria-improvisada', nome: 'Enfermaria improvisada', funcao: 'enfermaria-improvisada', piso: 'linoleo', papel: 'azulejo.metro', descricao: 'Camas hospitalares e colchões, caixa de suprimentos, mesa e armário' },
  { id: 'oficina-de-sucata', nome: 'Oficina de sucata', funcao: 'oficina-de-sucata', piso: 'entulho', papel: 'chapa.enferrujada', descricao: 'Bancada, pneus empilhados, carcaça de carro, gerador, tambores e caixotes' },
  { id: 'posto-de-guarda', nome: 'Posto de guarda', funcao: 'posto-de-guarda', piso: 'concreto.rachado', papel: 'chapa.enferrujada', descricao: 'Guarita com sacos de areia, caixa de suprimentos, tonel com fogo e placa' },
  // Cyberpunk (Q23c). O mercado noturno é ao ar livre (sem telhado, ver `FUNCOES_AO_AR_LIVRE`). O `bar` convive com a `taverna` (as palavras "bar" soltas continuam indo para a taverna; ver `funcao.ts`).
  { id: 'clinica-clandestina', nome: 'Clínica clandestina', funcao: 'clinica-clandestina', piso: 'grade.cyber', papel: 'azulejo.metro', descricao: 'Cadeira de implante, cama hospitalar, estação hacker, armário e bancada' },
  { id: 'bar', nome: 'Bar (néon)', funcao: 'bar', piso: 'piso.neon', papel: 'painel.neon', descricao: 'Balcão luminoso, banquetas, mesas, fliperamas, máquina de venda e letreiro' },
  { id: 'hotel-capsula', nome: 'Hotel cápsula', funcao: 'hotel-capsula', piso: 'grade.cyber', papel: 'painel.metalico', descricao: 'Pilhas de cápsulas nas paredes, armários de vestiário e máquina de venda' },
  { id: 'sala-de-servidores', nome: 'Sala de servidores', funcao: 'sala-de-servidores', piso: 'grade.cyber', papel: 'painel.metalico', descricao: 'Racks em fileira e nas paredes, gaiola de cabos, estação hacker e quadro de cabos' },
  { id: 'mercado-noturno', nome: 'Mercado noturno', funcao: 'mercado-noturno', piso: 'concreto.rachado', papel: 'concreto.pichado', descricao: 'Barracas de lámen, letreiros de rua, máquinas de venda, poste com telas e caixotes, ao ar livre' },
];
export const tipoDeComodo = (id: string): TipoDeComodo | undefined => TIPOS_DE_COMODO.find(t => t.id === id);

/** Uma predefinição de luz: círculo (lamparina, vela, lâmpada…) ou cone (lanterna, holofote, farol). */
export interface PresetDeLuz { id: string; nome: string; descricao: string; radius: number; color: string; intensity: number; flicker: number; power: Luz['power']; /** Abertura do cone, em graus; `null` ilumina em círculo. */ cone: number | null; /** Raios visíveis (num círculo: o feixe que desce do alto). */ rays?: boolean }

export const PRESETS_DE_LUZ: readonly PresetDeLuz[] = [
  { id: 'vela', nome: 'Vela', descricao: 'Luz pequena e trêmula', radius: 3, color: '#ffcf8a', intensity: 0.7, flicker: 0.25, power: 'fire', cone: null },
  { id: 'lamparina', nome: 'Lamparina', descricao: 'Chama quente em círculo', radius: 5, color: '#ffb36b', intensity: 1, flicker: 0.12, power: 'fire', cone: null },
  { id: 'tocha', nome: 'Tocha', descricao: 'Luz forte e inquieta', radius: 7, color: '#ff9a4a', intensity: 1.1, flicker: 0.3, power: 'fire', cone: null },
  { id: 'fogueira', nome: 'Fogueira', descricao: 'Chama grande ao ar livre', radius: 8, color: '#ff8a3a', intensity: 1.2, flicker: 0.35, power: 'fire', cone: null },
  { id: 'lampada', nome: 'Lâmpada', descricao: 'Luz elétrica estável', radius: 6, color: '#fff1d0', intensity: 1, flicker: 0, power: 'grid', cone: null },
  { id: 'neon', nome: 'Néon', descricao: 'Luz azulada de letreiro', radius: 5, color: '#7af0ff', intensity: 1.1, flicker: 0.08, power: 'grid', cone: null },
  { id: 'luar', nome: 'Luz mágica', descricao: 'Brilho frio e suave', radius: 10, color: '#9fb7ff', intensity: 0.6, flicker: 0, power: 'magic', cone: null },
  { id: 'feixe', nome: 'Feixe do alto', descricao: 'Luz que cai de uma abertura no teto, com raios', radius: 7, color: '#dcecff', intensity: 1.5, flicker: 0, power: 'magic', cone: null, rays: true },
  { id: 'lanterna', nome: 'Lanterna', descricao: 'Facho de bateria', radius: 9, color: '#fff0cc', intensity: 1, flicker: 0, power: 'battery', cone: 60 },
  { id: 'holofote', nome: 'Holofote', descricao: 'Facho fechado e longo', radius: 14, color: '#ffffff', intensity: 1.4, flicker: 0, power: 'grid', cone: 30 },
  { id: 'farol', nome: 'Farol', descricao: 'Facho aberto, de longe', radius: 16, color: '#fff7d6', intensity: 1.2, flicker: 0, power: 'grid', cone: 45 },
  { id: 'lucerna', nome: 'Lucerna', descricao: 'Lamparina de óleo romana', radius: 3.5, color: '#ffc27a', intensity: 0.75, flicker: 0.2, power: 'fire', cone: null },
  { id: 'lanterna-de-papel', nome: 'Lanterna de papel', descricao: 'Luz difusa e quente', radius: 4, color: '#ffb870', intensity: 0.8, flicker: 0.1, power: 'fire', cone: null },
  { id: 'lampiao-a-gas', nome: 'Lampião a gás', descricao: 'Chama de gás, clara e firme', radius: 5, color: '#ffe2a8', intensity: 0.95, flicker: 0.05, power: 'fire', cone: null },
  { id: 'tonel', nome: 'Fogo de tonel', descricao: 'Brasas em um barril metálico', radius: 6, color: '#ff7a2a', intensity: 1.1, flicker: 0.4, power: 'fire', cone: null },
  { id: 'neon-rosa', nome: 'Néon rosa', descricao: 'Luz magenta de letreiro', radius: 5, color: '#ff4fd8', intensity: 1.1, flicker: 0.06, power: 'grid', cone: null },
];
export const presetDeLuz = (id: string): PresetDeLuz | undefined => PRESETS_DE_LUZ.find(p => p.id === id);

/** Os campos de uma luz a partir de uma predefinição. `direcao` (rad) só vale para cones. */
export function camposDoPreset(p: PresetDeLuz, direcao = 0): Pick<Luz, 'radius' | 'color' | 'intensity' | 'flicker' | 'power' | 'cone' | 'preset'> & { rays?: boolean } {
  return { radius: p.radius, color: p.color, intensity: p.intensity, flicker: p.flicker, power: p.power, cone: p.cone === null ? null : { angle: (p.cone * Math.PI) / 180, direction: direcao }, preset: p.id, ...(p.rays ? { rays: true } : {}) };
}

export const posicaoDeTitulo = (largura: number, altura: number, onde: 'inferior-direito' | 'inferior-esquerdo' | 'superior-direito' | 'superior-esquerdo' | 'topo', comprimento = 7): Ponto =>
  onde === 'inferior-direito' ? [largura - comprimento - 1.5, altura - 2] : onde === 'inferior-esquerdo' ? [1.5, altura - 2] : onde === 'superior-direito' ? [largura - comprimento - 1.5, 2] : onde === 'superior-esquerdo' ? [1.5, 2] : [(largura - comprimento) / 2, 2];

/** Predefinições do acabamento final da cena. */
export interface PresetDeAcabamento { id: string; nome: string; valores: Omit<Acabamento, 'preset'> }
const grade = (lift = 0, gamma = 1, gain = 1) => ({ lift, gamma, gain });
const SEM_BORDA = { edges: { kind: 'none', amount: 0 }, glow: 0 } as const;
export const PRESETS_DE_ACABAMENTO: readonly PresetDeAcabamento[] = [
  { id: 'nenhum', nome: 'Nenhum', valores: { texture: 0, vignette: 0, saturation: 1, grain: 0, tint: '#ffffff', grade: grade(), ...SEM_BORDA } },
  { id: 'neutro', nome: 'Neutro', valores: { texture: 0.2, vignette: 0.28, saturation: 1, grain: 0.03, tint: '#ffffff', grade: grade(), ...SEM_BORDA } },
  { id: 'sujo', nome: 'Sujo e gasto', valores: { texture: 0.55, vignette: 0.5, saturation: 0.78, grain: 0.1, tint: '#f1e6d4', grade: grade(0, 1.05, 1), ...SEM_BORDA } },
  { id: 'sepia', nome: 'Sépia de investigação', valores: { texture: 0.35, vignette: 0.45, saturation: 0.6, grain: 0.07, tint: '#ffe2b8', grade: grade(), ...SEM_BORDA, split: { shadows: '#4a3a2a', highlights: '#e8d0a0', balance: 0, amount: 0.5 } } },
  { id: 'frio', nome: 'Frio e pálido', valores: { texture: 0.25, vignette: 0.4, saturation: 0.7, grain: 0.05, tint: '#cfe0ff', grade: grade(0, 1, 1), ...SEM_BORDA } },
  { id: 'quente', nome: 'Quente e vivo', valores: { texture: 0.15, vignette: 0.25, saturation: 1.25, grain: 0.02, tint: '#fff0d8', grade: grade(), ...SEM_BORDA } },
  { id: 'inverno-nevado', nome: 'Inverno nevado', valores: { texture: 0.2, vignette: 0.38, saturation: 0.72, grain: 0.03, tint: '#e4efff', grade: grade(0.01, 0.98, 1.03), edges: { kind: 'clouds', amount: 0.35 }, glow: 0.38 } },
  { id: 'sombrio-cinematografico', nome: 'Sombrio cinematográfico', valores: { texture: 0.3, vignette: 0.55, saturation: 0.75, grain: 0.06, tint: '#d4e2ff', grade: grade(-0.01, 1.06, 1.02), edges: { kind: 'dark', amount: 0.35 }, glow: 0.48 } },
  { id: 'masmorra', nome: 'Masmorra', valores: { texture: 0.3, vignette: 0.48, saturation: 0.92, grain: 0.06, tint: '#ffffff', grade: grade(0, 1.04, 1), edges: { kind: 'dark', amount: 0.3 }, glow: 0.6, split: { shadows: '#2a4a5a', highlights: '#ffb060', balance: 0, amount: 0.35 } } },
  { id: 'dia-dourado', nome: 'Dia dourado', valores: { texture: 0.15, vignette: 0.22, saturation: 1.08, grain: 0.02, tint: '#ffffff', grade: grade(), ...SEM_BORDA, split: { shadows: '#3a4a6a', highlights: '#ffe0a0', balance: 0, amount: 0.25 } } },
];
export const presetDeAcabamento = (id: string): PresetDeAcabamento | undefined => PRESETS_DE_ACABAMENTO.find(p => p.id === id);

// ---------- Climas: o mesmo mapa, vários momentos ----------
/** Um clima pronto: o céu, o tempo e o acabamento de um momento. `climate.preset` e `finish.preset` são preenchidos ao aplicar. */
export interface PresetDeClima { id: string; nome: string; descricao: string; climate: Omit<Clima, 'preset'>; finish: Acabamento }

const SEM_TEMPO: Tempo = { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 };
const acab = (preset: string, v: Omit<Acabamento, 'preset'>): Acabamento => ({ preset, ...v });
const acabDe = (id: string): Acabamento => { const p = presetDeAcabamento(id)!; return { preset: p.id, ...p.valores }; };

/** O céu de `time`, com o sol (ou a lua) ajustado e, se quiser, o ambiente trocado por uma cor efetiva. */
function ceu(time: string, o: { sol?: number; angulo?: number; corDoSol?: string; ambiente?: readonly [number, number, number]; semSol?: boolean } = {}): Pick<Clima, 'time' | 'sun' | 'ambient'> {
  const c = ceuNoHorario(time);
  return {
    time, ambient: o.ambiente ? ambienteDaCor(o.ambiente) : c.ambient,
    sun: o.semSol ? null : { ...c.sun, angle: o.angulo ?? c.sun.angle, intensity: Math.round(c.sun.intensity * (o.sol ?? 1) * 1000) / 1000, color: o.corDoSol ?? c.sun.color },
  };
}

export const PRESETS_DE_CLIMA: readonly PresetDeClima[] = [
  { id: 'manha', nome: 'Manhã', descricao: 'Sol baixo e dourado entrando pelas janelas', climate: { ...ceu('08:00'), weather: SEM_TEMPO, gridPower: true }, finish: acabDe('quente') },
  { id: 'tarde', nome: 'Tarde', descricao: 'Luz clara e neutra do meio do dia', climate: { ...ceu('14:30'), weather: SEM_TEMPO, gridPower: true }, finish: acabDe('neutro') },
  { id: 'entardecer', nome: 'Entardecer', descricao: 'Sol laranja, quase no horizonte', climate: { ...ceu('17:30', { sol: 0.9 }), weather: { ...SEM_TEMPO, dust: 0.25 }, gridPower: true, interiorLight: 0.38 },
    finish: acab('personalizado', { texture: 0.2, vignette: 0.4, saturation: 1.15, grain: 0.03, tint: '#ffd9b0', grade: grade(0, 1.05, 1), edges: { kind: 'none', amount: 0 }, glow: 0.3 }) },
  { id: 'noite', nome: 'Noite', descricao: 'Luar azulado; só as luzes do mapa iluminam de verdade', climate: { ...ceu('23:00'), weather: SEM_TEMPO, gridPower: true },
    finish: acab('personalizado', { texture: 0.25, vignette: 0.45, saturation: 0.72, grain: 0.05, tint: '#cfe0ff', grade: grade(), edges: { kind: 'dark', amount: 0.3 }, glow: 0.4 }) },
  { id: 'tempestade', nome: 'Tempestade', descricao: 'Chuva forte, vento e relâmpagos pelas janelas', climate: { ...ceu('16:00', { sol: 0.5, corDoSol: '#8c9fc7', ambiente: [0.22, 0.25, 0.31] }), weather: { ...SEM_TEMPO, rain: 1, wind: 0.5, lightning: 0.7, fog: 0.15 }, gridPower: true, interiorLight: 0.25 },
    finish: acab('personalizado', { texture: 0.3, vignette: 0.52, saturation: 0.6, grain: 0.06, tint: '#e3eeff', grade: grade(0, 1.05, 1), edges: { kind: 'dark', amount: 0.35 }, glow: 0.35 }) },
  { id: 'neblina', nome: 'Neblina', descricao: 'Manhã clara e leitosa, de névoa espessa e sem sombras duras', climate: { ...ceu('07:30', { sol: 0.5, ambiente: [0.72, 0.76, 0.78] }), weather: { ...SEM_TEMPO, fog: 0.85, wind: 0.1 }, gridPower: true, interiorLight: 0.32 },
    finish: acab('personalizado', { texture: 0.25, vignette: 0.45, saturation: 0.55, grain: 0.05, tint: '#dde4e8', grade: grade(), edges: { kind: 'fog', amount: 0.45 }, glow: 0.32 }) },
  { id: 'neve', nome: 'Neve', descricao: 'Dia claro e frio com neve caindo e sol rasante', climate: { ...ceu('09:00', { angulo: 0.75, sol: 0.75, corDoSol: '#e6efff', ambiente: [0.72, 0.77, 0.85] }), weather: { ...SEM_TEMPO, snow: 0.8, wind: 0.2 }, gridPower: true, interiorLight: 0.34 },
    finish: acabDe('inverno-nevado') },
  { id: 'apagao', nome: 'Apagão', descricao: 'A rede elétrica caiu: só fogo, pilha e luar', climate: { ...ceu('23:30', { sol: 0.85, ambiente: [0.022, 0.022, 0.035] }), weather: SEM_TEMPO, gridPower: false },
    finish: acab('personalizado', { texture: 0.35, vignette: 0.65, saturation: 0.7, grain: 0.09, tint: '#ffe6e6', grade: grade(0, 1.1, 1), edges: { kind: 'dark', amount: 0.45 }, glow: 0.45 }) },
  { id: 'neon', nome: 'Neon', descricao: 'Noite molhada e saturada, de letreiros magenta e ciano', climate: { ...ceu('23:00', { sol: 0.8, ambiente: [0.07, 0.05, 0.13] }), weather: { ...SEM_TEMPO, rain: 0.3 }, gridPower: true },
    finish: acab('personalizado', { texture: 0.15, vignette: 0.45, saturation: 1.45, grain: 0.04, tint: '#d6a8ff', grade: grade(0, 1, 1.1), edges: { kind: 'dark', amount: 0.3 }, glow: 0.55 }) },
];

/** Mapas antigos chamam a tarde de "dia". */
const APELIDOS_DE_CLIMA: Readonly<Record<string, string>> = { dia: 'tarde' };
export const presetDeClima = (id: string): PresetDeClima | undefined => PRESETS_DE_CLIMA.find(p => p.id === (APELIDOS_DE_CLIMA[id] ?? id));

// ---------- Presença ----------
export type PacoteDePresenca = 'natural' | 'sobrenatural' | 'ordem';
export type FormaDePresenca = 'mancha' | 'arrastado' | 'sulcos';
/** Um pincel de presença: o que ele pinta e como parece (cor, se brilha acima da luz, ritmo da pulsação e escala do ruído). */
export interface PincelDePresenca {
  id: string;
  nome: string;
  pacote: PacoteDePresenca;
  cor: string;
  brilho: boolean;
  pulso: number;
  escala: number;
  forma?: FormaDePresenca;
  submerso?: boolean;
}
export const PACOTES_DE_PRESENCA: readonly { id: PacoteDePresenca; nome: string }[] = [{ id: 'natural', nome: 'Natural' }, { id: 'sobrenatural', nome: 'Sobrenatural' }, { id: 'ordem', nome: 'Ordem Paranormal' }];
// As cores dos cinco elementos são as da Ficha (ELEMENT_COLORS).
export const PINCEIS_DE_PRESENCA: readonly PincelDePresenca[] = [
  { id: 'musgo', nome: 'Musgo', pacote: 'natural', cor: '#4f7a34', brilho: false, pulso: 0, escala: 1 },
  { id: 'mofo', nome: 'Mofo', pacote: 'natural', cor: '#5b6a4a', brilho: false, pulso: 0, escala: 1.6 },
  { id: 'poca', nome: 'Poça', pacote: 'natural', cor: '#3a5a78', brilho: false, pulso: 0, escala: 0.6 },
  { id: 'sangue-seco', nome: 'Sangue seco', pacote: 'natural', cor: '#4a221a', brilho: false, pulso: 0, escala: 0.9, forma: 'arrastado' },
  { id: 'fuligem', nome: 'Fuligem', pacote: 'natural', cor: '#1f1b18', brilho: false, pulso: 0, escala: 1.1, forma: 'mancha' },
  { id: 'sulcos', nome: 'Sulcos', pacote: 'natural', cor: '#3c3024', brilho: false, pulso: 0, escala: 1, forma: 'sulcos' },
  { id: 'algas', nome: 'Algas', pacote: 'natural', cor: '#234a2e', brilho: false, pulso: 0, escala: 1.2, forma: 'mancha', submerso: true },
  { id: 'corrupcao', nome: 'Corrupção', pacote: 'sobrenatural', cor: '#7a2a8a', brilho: true, pulso: 0.5, escala: 1.2 },
  { id: 'sombra', nome: 'Sombra', pacote: 'sobrenatural', cor: '#0a0710', brilho: false, pulso: 0.25, escala: 0.8 },
  { id: 'ordem.sangue', nome: 'Sangue', pacote: 'ordem', cor: '#e0150d', brilho: true, pulso: 0.7, escala: 1 },
  { id: 'ordem.morte', nome: 'Morte', pacote: 'ordem', cor: '#70707a', brilho: false, pulso: 0.2, escala: 1.4 },
  { id: 'ordem.conhecimento', nome: 'Conhecimento', pacote: 'ordem', cor: '#e5a11c', brilho: true, pulso: 0.4, escala: 0.7 },
  { id: 'ordem.energia', nome: 'Energia', pacote: 'ordem', cor: '#a230ed', brilho: true, pulso: 1.2, escala: 0.9 },
  { id: 'ordem.medo', nome: 'Medo', pacote: 'ordem', cor: '#d5d7e0', brilho: true, pulso: 0.3, escala: 1.5 },
];
export const pincelDePresenca = (id: string): PincelDePresenca | undefined => PINCEIS_DE_PRESENCA.find(p => p.id === id);

// ---------- Gênero ----------
/** O gênero guia o que o assistente sugere (materiais, paleta, luzes). Um id desconhecido vale como `investigacao`. */
export interface Genero { id: string; nome: string; descricao: string; /** Para onde a cor das imagens da coleção é puxada (saturação e luminância médias, 0 a 1, e uma tinta leve). */ alvoDeCor: { saturacao: number; luminancia: number; tinta: string }; /** Gêneros cujas famílias este também aceita (ex.: o vitoriano usa lareira e piano da investigação). */ herda?: readonly string[] }
export const GENEROS: readonly Genero[] = [
  { id: 'investigacao', nome: 'Investigação', descricao: 'Casa antiga, lamparinas, damasco', alvoDeCor: { saturacao: 0.42, luminancia: 0.36, tinta: '#f1e2c8' } },
  { id: 'moderno', nome: 'Moderno', descricao: 'Lâmpadas, cores claras', alvoDeCor: { saturacao: 0.5, luminancia: 0.58, tinta: '#f4f6f8' } },
  { id: 'fantasia', nome: 'Fantasia', descricao: 'Velas, tochas, pedra e madeira', alvoDeCor: { saturacao: 0.5, luminancia: 0.42, tinta: '#f6dcb4' } },
  { id: 'antiguidade', nome: 'Antiguidade', descricao: 'Mármore, bronze, lucernas', alvoDeCor: { saturacao: 0.42, luminancia: 0.5, tinta: '#f3e6cc' }, herda: ['fantasia'] },
  { id: 'oriental', nome: 'Oriental', descricao: 'Papel, laca, lanternas', alvoDeCor: { saturacao: 0.4, luminancia: 0.42, tinta: '#f2e2c4' }, herda: ['fantasia'] },
  { id: 'deserto', nome: 'Deserto', descricao: 'Adobe, tecido, lanternas de latão', alvoDeCor: { saturacao: 0.5, luminancia: 0.52, tinta: '#f7dcb0' }, herda: ['fantasia'] },
  { id: 'faroeste', nome: 'Faroeste', descricao: 'Tábuas, poeira, lampião', alvoDeCor: { saturacao: 0.4, luminancia: 0.46, tinta: '#f0d6ae' }, herda: ['investigacao', 'fantasia'] },
  { id: 'colonial', nome: 'Colonial e pirata', descricao: 'Caiado, convés, velas', alvoDeCor: { saturacao: 0.44, luminancia: 0.46, tinta: '#f1e0c2' }, herda: ['investigacao', 'fantasia'] },
  { id: 'vitoriano', nome: 'Vitoriano e steampunk', descricao: 'Latão, vapor, gás', alvoDeCor: { saturacao: 0.36, luminancia: 0.36, tinta: '#ecd9b8' }, herda: ['investigacao', 'fantasia'] },
  { id: 'pos-apocaliptico', nome: 'Pós-apocalíptico', descricao: 'Ferrugem, lona, fogo de tonel', alvoDeCor: { saturacao: 0.3, luminancia: 0.38, tinta: '#e2d6c0' }, herda: ['moderno'] },
  { id: 'cyberpunk', nome: 'Cyberpunk', descricao: 'Néon, chuva, telas', alvoDeCor: { saturacao: 0.55, luminancia: 0.3, tinta: '#d6e4f4' }, herda: ['moderno', 'ficcao-cientifica'] },
];
export const generoDe = (id: string): Genero => GENEROS.find(g => g.id === id) ?? GENEROS[0]!;
/** O gênero e os que ele herda; `familias.ts` usa isto para decidir que famílias aparecem (fica aqui para não haver import circular). */
export const generosVisiveis = (id: string): string[] => { const g = generoDe(id); return [g.id, ...(g.herda ?? [])]; };

/** Funções de cômodo ao ar livre que nascem sem telhado por padrão. */
export const FUNCOES_AO_AR_LIVRE = new Set(['varanda', 'patio', 'claustro', 'quintal', 'peristilo', 'forum', 'jardim', 'patio-com-fonte', 'conves', 'fortim', 'acampamento', 'mercado-noturno']);

/** Um estilo de telhado: combinação nomeada de cobertura, forma, inclinação e detalhes (só usada na interface e construção; o documento grava os campos resultantes em `room.roof`). */
export interface EstiloDeTelhado { id: string; nome: string; roof: Omit<Comodo['roof'], 'visible'> }

export const ESTILOS_DE_TELHADO: readonly EstiloDeTelhado[] = [
  { id: 'casa-de-telha', nome: 'Casa de telha', roof: { material: 'telha.barro', shape: 'quatro-aguas', steep: false, details: ['chamine'] } },
  { id: 'casa-velha', nome: 'Casa velha', roof: { material: 'telha.barro', shape: 'duas-aguas', steep: false, details: ['chamine'], wear: { moss: 0.45, dirt: 0.4, damage: 0.15, snow: 'auto' } } },
  { id: 'choupana', nome: 'Choupana', roof: { material: 'telha.palha', shape: 'quatro-aguas', steep: false, details: [] } },
  { id: 'casa-de-pedra', nome: 'Casa de pedra', roof: { material: 'telha.pedra', shape: 'duas-aguas', steep: false, details: ['chamine'] } },
  { id: 'celeiro', nome: 'Celeiro', roof: { material: 'telha.tabuinhas', shape: 'duas-aguas', steep: true, details: ['catavento'] } },
  { id: 'igreja', nome: 'Igreja', roof: { material: 'telha.ardosia', shape: 'duas-aguas', steep: true, details: ['cruz'] } },
  { id: 'torre', nome: 'Torre / campanário', roof: { material: 'telha.escamas', shape: 'piramide', steep: true, details: ['sino'] } },
  { id: 'templo-de-cobre', nome: 'Templo de cobre', roof: { material: 'telha.cobre', shape: 'quatro-aguas', steep: true, details: [] } },
  { id: 'galpao-de-zinco', nome: 'Galpão de zinco', roof: { material: 'telha.zinco', shape: 'duas-aguas', steep: false, details: [] } },
  { id: 'laje-moderna', nome: 'Laje moderna', roof: { material: 'telha.concreto', shape: 'plano', details: ['caixa-dagua'] } },
  { id: 'laje-equipada', nome: 'Laje com equipamentos', roof: { material: 'laje.equipada', shape: 'plano', details: ['ar-condicionado', 'antena', 'caixa-dagua'] } },
  { id: 'casa-nordica', nome: 'Casa nórdica', roof: { material: 'telha.grama', shape: 'duas-aguas', steep: false, details: ['chamine'] } },
  { id: 'casa-romana', nome: 'Casa romana', roof: { material: 'telha.imbrex', shape: 'quatro-aguas', steep: false, details: [] } },
  { id: 'terraco-de-barro', nome: 'Terraço de barro', roof: { material: 'terraco.barro', shape: 'plano', details: [] } },
  { id: 'tenda', nome: 'Tenda', roof: { material: 'telha.lona', shape: 'piramide', steep: false, details: [] } },
  { id: 'torre-redonda', nome: 'Torre redonda', roof: { material: 'telha.escamas', shape: 'cone', steep: true, details: ['catavento'] } },
  { id: 'torre-conica-de-palha', nome: 'Torre de palha', roof: { material: 'telha.palha', shape: 'cone', steep: true, details: [] } },
  { id: 'cabana-de-tabuas', nome: 'Cabana de tábuas', roof: { material: 'telha.tabuas', shape: 'duas-aguas', steep: false, details: [] } },
  { id: 'casa-colonial', nome: 'Casa colonial', roof: { material: 'telha.barro', shape: 'quatro-aguas', steep: false, details: ['chamine'] } },
  { id: 'casa-francesa', nome: 'Casa francesa', roof: { material: 'telha.francesa', shape: 'quatro-aguas', steep: false, details: ['chamine'] } },
  { id: 'celeiro-holandes', nome: 'Celeiro holandês', roof: { material: 'telha.tabuinhas', shape: 'holandes', steep: false, details: ['catavento'] } },
  { id: 'sobrado-de-mansarda', nome: 'Sobrado de mansarda', roof: { material: 'telha.ardosia', shape: 'mansarda', steep: false, details: ['chamine'] } },
  { id: 'puxado', nome: 'Puxado', roof: { material: 'telha.zinco', shape: 'uma-agua', steep: false, details: [] } },
  { id: 'galpao-industrial', nome: 'Galpão industrial', roof: { material: 'telha.fibrocimento', shape: 'uma-agua', steep: false, details: [] } },
  { id: 'pagode', nome: 'Pagode', roof: { material: 'telha.esmaltada.verde', shape: 'pagode', steep: false, details: [] } },
  { id: 'templo-oriental', nome: 'Templo oriental', roof: { material: 'telha.esmaltada.amarela', shape: 'quatro-aguas', steep: true, details: [] } },
  { id: 'palacio-de-marmore', nome: 'Palácio de mármore', roof: { material: 'telha.marmore', shape: 'quatro-aguas', steep: false, details: [] } },
  { id: 'cupula-dourada', nome: 'Cúpula dourada', roof: { material: 'telha.ouro', shape: 'cupula', steep: false, details: [] } },
  { id: 'igreja-ortodoxa', nome: 'Igreja ortodoxa', roof: { material: 'telha.ouro', shape: 'bulbo', steep: false, details: ['cruz'] } },
  { id: 'catedral', nome: 'Catedral', roof: { material: 'telha.chumbo', shape: 'duas-aguas', steep: true, details: ['cruz'] } },
  { id: 'observatorio', nome: 'Observatório', roof: { material: 'telha.chapa.cinza', shape: 'cupula', steep: false, details: [] } },
  { id: 'estufa', nome: 'Estufa', roof: { material: 'telha.vidro', shape: 'duas-aguas', steep: false, details: [] } },
  { id: 'casa-japonesa', nome: 'Casa japonesa', roof: { material: 'telha.curva.cinza', shape: 'quatro-aguas', steep: false, details: [] } },
  { id: 'capela-de-vitral', nome: 'Capela de vitral', roof: { material: 'telha.vitral', shape: 'duas-aguas', steep: true, details: [] } },
  { id: 'iurta', nome: 'Iurta', roof: { material: 'telha.couro', shape: 'cone', steep: false, details: [] } },
  { id: 'casa-de-bambu', nome: 'Casa de bambu', roof: { material: 'telha.bambu', shape: 'duas-aguas', steep: false, details: [] } },
  { id: 'galpao-abobadado', nome: 'Galpão abobadado', roof: { material: 'telha.chapa.cinza', shape: 'abobada', steep: false, details: [] } },
];

export const estiloDeTelhado = (id: string): EstiloDeTelhado | undefined => ESTILOS_DE_TELHADO.find(e => e.id === id);

/** Predefinição de estado/conservação de um telhado (só usada na interface e construção; o documento grava apenas `room.roof.wear`). */
export interface EstadoDeTelhado {
  id: string;
  nome: string;
  wear: { moss: number; dirt: number; damage: number };
}

export const ESTADOS_DE_TELHADO: readonly EstadoDeTelhado[] = [
  { id: 'novo', nome: 'Novo', wear: { moss: 0, dirt: 0, damage: 0 } },
  { id: 'gasto', nome: 'Gasto', wear: { moss: 0.15, dirt: 0.3, damage: 0.08 } },
  { id: 'velho', nome: 'Velho', wear: { moss: 0.45, dirt: 0.4, damage: 0.15 } },
  { id: 'abandonado', nome: 'Abandonado', wear: { moss: 0.7, dirt: 0.6, damage: 0.45 } },
  { id: 'em-ruinas', nome: 'Em ruínas', wear: { moss: 0.85, dirt: 0.8, damage: 0.8 } },
];

export const estadoDeTelhado = (id: string): EstadoDeTelhado | undefined => ESTADOS_DE_TELHADO.find(e => e.id === id);

const clonarTelhado = (r: Omit<Comodo['roof'], 'visible'>): Omit<Comodo['roof'], 'visible'> => ({
  material: r.material,
  ...(r.shape !== undefined ? { shape: r.shape } : {}),
  ...(r.ridge !== undefined ? { ridge: r.ridge } : {}),
  ...(r.steep !== undefined ? { steep: r.steep } : {}),
  ...(r.details !== undefined ? { details: [...r.details] } : {}),
  ...(r.wear !== undefined ? { wear: { ...r.wear } } : {}),
  ...(r.seed !== undefined ? { seed: r.seed } : {}),
});

const ESTILO_POR_FUNCAO: Readonly<Record<string, string>> = {
  capela: 'igreja',
  forja: 'casa-de-pedra',
  torre: 'torre',
  campanario: 'torre',
  estabulo: 'celeiro',
  celeiro: 'celeiro',
  tenda: 'tenda',
};

/** Estilo de telhado padrão ao criar um cômodo: ar livre fica sem; contorno circular ganha cone; funções especiais sobrepõem vizinhos; senão herda do vizinho (do mesmo nível) ou usa o gênero do mapa. */
export function telhadoPadrao(
  m: Pick<MapaAtlas, 'rooms' | 'style'>,
  funcao: string | null,
  celulas: readonly [number, number][],
  nivel: string | null = null,
  outline?: readonly Ponto[],
): Omit<Comodo['roof'], 'visible'> | null {
  if (funcao && FUNCOES_AO_AR_LIVRE.has(funcao)) return null;
  if (outline && outline.length >= 8 && (!funcao || !ESTILO_POR_FUNCAO[funcao] || funcao === 'torre' || funcao === 'campanario')) {
    return clonarTelhado(estiloDeTelhado('torre-redonda')!.roof);
  }
  if (funcao && ESTILO_POR_FUNCAO[funcao]) return clonarTelhado(estiloDeTelhado(ESTILO_POR_FUNCAO[funcao]!)!.roof);
  if (m.style.genre === 'moderno' && (funcao === 'deposito' || funcao === 'oficina' || funcao === 'garagem')) {
    return clonarTelhado(estiloDeTelhado('galpao-de-zinco')!.roof);
  }
  if (celulas.length) {
    const vizinhas = new Set<string>();
    for (const [x, y] of celulas) {
      vizinhas.add(`${x + 1},${y}`);
      vizinhas.add(`${x - 1},${y}`);
      vizinhas.add(`${x},${y + 1}`);
      vizinhas.add(`${x},${y - 1}`);
    }
    for (const sala of Object.values(m.rooms)) {
      if (!sala.roof.material || (sala.levelId ?? null) !== nivel) continue;
      for (const [cx, cy] of decodificar(sala.cells)) {
        if (vizinhas.has(`${cx},${cy}`)) return clonarTelhado(sala.roof);
      }
    }
  }
  const genero = m.style.genre;
  if (genero === 'fantasia') return clonarTelhado(estiloDeTelhado('choupana')!.roof);
  if (genero === 'moderno') return clonarTelhado(estiloDeTelhado('laje-moderna')!.roof);
  if (genero === 'antiguidade') return clonarTelhado(estiloDeTelhado('casa-romana')!.roof);
  if (genero === 'oriental') return clonarTelhado(estiloDeTelhado('casa-japonesa')!.roof);
  if (genero === 'deserto') return clonarTelhado(estiloDeTelhado('terraco-de-barro')!.roof);
  if (genero === 'faroeste') return clonarTelhado(estiloDeTelhado('cabana-de-tabuas')!.roof);
  if (genero === 'colonial') return clonarTelhado(estiloDeTelhado('casa-colonial')!.roof);
  // Pós-apocalíptico (Q22c): o abrigo é de laje (com caixas de ar e antena); o resto, de chapa remendada.
  if (genero === 'pos-apocaliptico') {
    return funcao === 'abrigo' ? clonarTelhado(estiloDeTelhado('laje-equipada')!.roof) : { material: 'chapa.remendada', shape: 'uma-agua', steep: false, details: [] };
  }
  // Cyberpunk (Q23c): lajes equipadas (antenas, caixas de ar) sobre tudo.
  if (genero === 'cyberpunk') return clonarTelhado(estiloDeTelhado('laje-equipada')!.roof);
  // Vitoriano (Q20c): a fábrica e a estação têm galpão de chapa; o resto, o sobrado de mansarda de ardósia.
  if (genero === 'vitoriano') return clonarTelhado(estiloDeTelhado(funcao === 'fabrica' || funcao === 'estacao-de-dirigivel' ? 'galpao-abobadado' : 'sobrado-de-mansarda')!.roof);
  return clonarTelhado(estiloDeTelhado('casa-velha')!.roof);
}
