import { generosVisiveis } from '../domain/presets.ts';

/**
 * A taxonomia do acervo: grupo → família → variante. Uma família reúne coisas intercambiáveis no mapa (a mesma coisa em tamanho, cor, estação ou desenho diferente);
 * `itens` está na ordem das variantes, do menor para o maior e, no mesmo tamanho, na ordem de cor da coleção.
 * `Categoria` (por cômodo) continua existindo e é outra forma de olhar o mesmo item. Quem acrescenta um asset precisa classificá-lo aqui (há um teste).
 */
export interface GrupoDeObjetos { id: string; nome: string }

/** `generos` e `biomas` dizem a que épocas e cenários a família serve; ausente = atemporal, aparece em qualquer um. */
export interface Familia { id: string; nome: string; grupo: string; itens: readonly string[]; generos?: readonly string[]; biomas?: readonly string[] }

export const BIOMAS = [
  { id: 'temperado', nome: 'Temperado' }, { id: 'frio', nome: 'Frio e neve' }, { id: 'deserto', nome: 'Deserto' }, { id: 'tropical', nome: 'Tropical' }, { id: 'outono', nome: 'Outono' },
  { id: 'vulcanico', nome: 'Vulcânico' }, { id: 'subterraneo', nome: 'Subterrâneo' }, { id: 'urbano', nome: 'Urbano' }, { id: 'mar', nome: 'Mar e praia' },
] as const;

export const GRUPOS_DE_OBJETOS: readonly GrupoDeObjetos[] = [
  { id: 'natureza', nome: 'Natureza' },
  { id: 'agua', nome: 'Água e fundo' },
  { id: 'moveis', nome: 'Móveis' },
  { id: 'luz-e-fogo', nome: 'Luz e fogo' },
  { id: 'sobre-a-mesa', nome: 'Sobre a mesa' },
  { id: 'parede', nome: 'De parede' },
  { id: 'carga', nome: 'Carga e armazenamento' },
  { id: 'construcao', nome: 'Construção' },
  { id: 'religiao', nome: 'Templo e cemitério' },
  { id: 'oficio', nome: 'Ofício e guerra' },
  { id: 'campo', nome: 'Campo e estrada' },
  { id: 'porto', nome: 'Porto' },
  { id: 'moderno', nome: 'Moderno' },
  { id: 'ficcao', nome: 'Ficção científica' },
  { id: 'ossos', nome: 'Ossos e restos' },
];

interface Marcas { generos?: readonly string[]; biomas?: readonly string[] }
const f = (grupo: string, id: string, nome: string, itens: readonly string[], marcas: Marcas = {}): Familia => ({ id, nome, grupo, itens, ...marcas });

export const FAMILIAS: readonly Familia[] = [
  // Natureza
  f('natureza', 'arvore', 'Árvore', ['casa:arvore-3m', 'casa:arvore-5m', 'casa:arvore-7m'], { biomas: ['temperado'] }),
  f('natureza', 'arvore-da-mata', 'Árvore da mata', ['casa:arvore-da-mata-4m', 'casa:arvore-da-mata-5m-amarelada', 'casa:arvore-da-mata-6m', 'casa:arvore-da-mata-6m-rala', 'casa:arvore-da-mata-8m'], { biomas: ['temperado'] }),
  f('natureza', 'carvalho', 'Carvalho', ['casa:carvalho-grande-6m', 'casa:carvalho-grande-7m', 'casa:carvalho-grande-8m'], { biomas: ['temperado'] }),
  f('natureza', 'pinheiro', 'Pinheiro', ['casa:pinheiro-3m', 'casa:pinheiro-4m'], { biomas: ['temperado', 'frio'] }),
  f('natureza', 'arvore-nevada', 'Árvore nevada', ['casa:arvore-nevada-3m', 'casa:pinheiro-nevado-3m', 'casa:arvore-nevada-5m', 'casa:pinheiro-nevado-4m'], { biomas: ['frio'] }),
  f('natureza', 'arvore-morta', 'Árvore morta', ['arvore-morta', 'arvore-morta-caida'], { biomas: ['temperado', 'frio', 'deserto'] }),
  f('natureza', 'arbusto', 'Arbusto', ['casa:arbusto-verde', 'casa:arbusto-florido', 'casa:arbusto-grande']),
  f('natureza', 'arbusto-seco', 'Arbusto seco', ['casa:arbusto-seco-1m', 'casa:arbusto-seco-2m', 'casa:arbusto-seco-2m-neve'], { biomas: ['temperado', 'frio', 'deserto'] }),
  f('natureza', 'folhagem-tropical', 'Folhagem tropical', ['casa:folhagem-tropical-1m', 'casa:folhagem-tropical-2m'], { biomas: ['tropical'] }),
  f('natureza', 'costela-de-adao', 'Costela-de-adão', ['casa:costela-de-adao-madeira', 'casa:costela-de-adao-pedra'], { biomas: ['tropical'] }),
  f('natureza', 'palmeira', 'Palmeira', ['casa:palmeira-madeira', 'casa:palmeira-pedra'], { biomas: ['tropical'] }),
  f('natureza', 'samambaia', 'Samambaia', ['moita-de-samambaia', 'casa:samambaia-a', 'casa:samambaia-b'], { biomas: ['temperado'] }),
  f('natureza', 'vaso-de-planta', 'Vaso de planta', ['canteiro', 'vaso.planta', 'vaso.flores']),
  f('natureza', 'pedra', 'Pedra', ['seixos', 'pedra.pequena', 'pedra.media', 'pedra.grande', 'rochedo']),
  f('natureza', 'toco', 'Toco e tronco', ['toco', 'tora-assento', 'tronco.caido']),
  f('natureza', 'galho-seco', 'Galho seco', ['galho-seco', 'raiz-exposta']),
  f('natureza', 'capim', 'Capim', ['tufo-de-grama', 'tufo-de-capim', 'junco']),
  f('natureza', 'folhico', 'Folhiço e galhos', ['folhico', 'galhada', 'gravetos', 'raizes'], { biomas: ['temperado'] }),
  f('natureza', 'brotos', 'Brotos', ['brotos'], { biomas: ['temperado'] }),
  f('natureza', 'flores', 'Flores do campo', ['flores-do-campo'], { biomas: ['temperado'] }),
  f('natureza', 'folhas-largas', 'Folhas largas', ['folhas-largas'], { biomas: ['tropical'] }),
  f('natureza', 'monte-de-neve', 'Monte de neve', ['monte-de-neve'], { biomas: ['frio'] }),
  f('natureza', 'estalagmite', 'Estalagmite', ['estalagmite'], { biomas: ['subterraneo'] }),
  f('natureza', 'buraco', 'Buraco', ['buraco']),
  // Água e fundo
  f('agua', 'planta-aquatica', 'Planta aquática', ['vitoria-regia', 'alga'], { biomas: ['mar', 'tropical'] }),
  f('agua', 'coral', 'Coral e fundo', ['coral', 'anemona', 'ourico', 'rocha-submersa'], { biomas: ['mar', 'tropical'] }),
  f('agua', 'cachoeira', 'Cachoeira', ['cachoeira']),
  // Móveis
  f('moveis', 'mesa-redonda', 'Mesa redonda', ['mesa.redonda', 'mesa.redonda-rustica']),
  f('moveis', 'mesa-retangular', 'Mesa retangular', ['mesa.retangular', 'mesa.cavalete', 'mesa.taverna', 'mesa.refeitorio']),
  f('moveis', 'mesa-de-jantar', 'Mesa de jantar', ['mesa.oval', 'mesa.vidro'], { generos: ['investigacao', 'moderno'] }),
  f('moveis', 'mesa-posta', 'Mesa posta', ['jantar.posto', 'mesa.banquete'], { generos: ['fantasia', 'investigacao'] }),
  f('moveis', 'mesa-de-centro', 'Mesa de centro', ['mesinha', 'mesa.centro']),
  f('moveis', 'mesa-de-jogo', 'Mesa de jogo', ['mesa.carteado', 'mesa.bilhar'], { generos: ['fantasia', 'investigacao'] }),
  f('moveis', 'bancada', 'Bancada', ['bancada.trabalho', 'bancada.ferramentas'], { generos: ['fantasia', 'ficcao-cientifica', 'moderno'] }),
  f('moveis', 'cadeira', 'Cadeira', ['banqueta', 'cadeira', 'cadeira.espaldar', 'cadeira.piloto', 'trono']),
  f('moveis', 'banco', 'Banco', ['banco', 'banco.longo', 'banco.jardim']),
  f('moveis', 'sofa', 'Sofá', ['sofa', 'sofa.canto', 'sofa.capitone']),
  f('moveis', 'sofa-chesterfield', 'Sofá chesterfield', ['casa:chesterfield-couro', 'casa:chesterfield-verde', 'casa:chesterfield-vinho']),
  f('moveis', 'diva', 'Divã', ['casa:diva-couro', 'casa:diva-verde', 'casa:diva-vinho']),
  f('moveis', 'poltrona', 'Poltrona', ['poltrona', 'poltrona.capitone']),
  f('moveis', 'poltrona-capitone', 'Poltrona capitonê', ['casa:poltrona-capitone-couro', 'casa:poltrona-capitone-verde', 'casa:poltrona-capitone-vinho']),
  f('moveis', 'cama', 'Cama', ['cama.solteiro', 'cama.casal', 'cama.box', 'cama.dossel', 'beliche', 'beliche.capsula']),
  f('moveis', 'cama-rustica', 'Cama rústica', ['saco-de-dormir', 'enxergao', 'catre', 'catre-de-peles']),
  f('moveis', 'guarda-roupa', 'Guarda-roupa', ['armario', 'guarda-roupa.liso', 'armario.metal']),
  f('moveis', 'comoda', 'Cômoda', ['comoda', 'aparador', 'balcao']),
  f('moveis', 'estante', 'Estante', ['estante.piso', 'cristaleira', 'prateleira.pocoes']),
  f('moveis', 'escrivaninha', 'Escrivaninha', ['escrivaninha', 'escrivaninha.verde', 'escrivaninha.computador'], { generos: ['moderno', 'investigacao'] }),
  f('moveis', 'tapete', 'Tapete', ['tapete.liso', 'tapete.redondo']),
  f('moveis', 'tapete-oval', 'Tapete oval', ['tapete.oval', 'casa:tapete-oval-creme', 'casa:tapete-oval-verde', 'casa:tapete-oval-vinho']),
  f('moveis', 'tapete-persa', 'Tapete persa', ['tapete.persa', 'casa:tapete-persa-p-creme', 'casa:tapete-persa-p-verde', 'casa:tapete-persa-p-vinho', 'casa:tapete-persa-g-creme', 'casa:tapete-persa-g-verde', 'casa:tapete-persa-g-vinho']),
  f('moveis', 'passadeira', 'Passadeira', ['passadeira', 'casa:passadeira-creme', 'casa:passadeira-verde', 'casa:passadeira-vinho'], { generos: ['fantasia', 'investigacao'] }),
  f('moveis', 'banheira', 'Banheira e box', ['banheira.pes', 'box.banheiro'], { generos: ['investigacao', 'moderno'] }),
  f('moveis', 'vaso-sanitario', 'Vaso sanitário', ['vaso.sanitario', 'vaso.moderno'], { generos: ['moderno', 'investigacao'] }),
  f('moveis', 'pia', 'Pia', ['pia.pedestal'], { generos: ['investigacao'] }),
  f('moveis', 'piano', 'Piano', ['piano.cauda'], { generos: ['investigacao'] }),
  f('moveis', 'relogio-de-pe', 'Peça decorativa', ['relogio.pe', 'cabideiro', 'globo.terrestre'], { generos: ['investigacao'] }),
  // Luz e fogo
  f('luz-e-fogo', 'lareira', 'Lareira', ['lareira.pedra', 'lareira.marmore', 'lareira.nobre'], { generos: ['fantasia', 'investigacao'] }),
  f('luz-e-fogo', 'fogueira', 'Fogueira', ['fogueira', 'braseiro', 'caldeirao', 'espeto-de-assar'], { generos: ['fantasia'] }),
  f('luz-e-fogo', 'castical', 'Castiçal', ['castical.mesa', 'candelabro', 'candelabro.pe', 'tocheiro', 'velas-votivas'], { generos: ['fantasia', 'investigacao'] }),
  f('luz-e-fogo', 'luminaria', 'Luminária', ['abajur.mesa', 'luminaria.chao', 'luminaria.franja', 'lustre']),
  f('luz-e-fogo', 'poste-de-luz', 'Poste de luz', ['lanterna-de-poste', 'poste.luz', 'lanterna.farol']),
  f('luz-e-fogo', 'tocha', 'Tocha de parede', ['tocha.parede', 'arandela']),
  // Sobre a mesa
  f('sobre-a-mesa', 'livro', 'Livro', ['livro.aberto', 'livros.pilha']),
  f('sobre-a-mesa', 'papel', 'Papel', ['papeis', 'jornais', 'tinteiro.pena']),
  f('sobre-a-mesa', 'louca', 'Louça e comida', ['bule.xicaras', 'garrafa.tacas', 'pratos.servico', 'fruteira']),
  f('sobre-a-mesa', 'pequenos-objetos', 'Pequenos objetos', ['relogio.mesa', 'telefone.antigo', 'tabuleiro.xadrez', 'sapatos', 'cesto.roupa']),
  // De parede
  f('parede', 'quadro', 'Quadro', ['quadro', 'quadro.abstrato', 'retrato.oval', 'paisagem.grande', 'quadros.grupo']),
  f('parede', 'espelho', 'Espelho', ['espelho', 'espelho.grande']),
  f('parede', 'prateleira', 'Prateleira', ['prateleira.flutuante', 'prateleira.parede', 'estante']),
  f('parede', 'armas-de-parede', 'Armas e troféus', ['escudo.parede', 'arco.parede', 'lancas.parede', 'machados.cruzados', 'espadas.cruzadas', 'trofeu.cervo', 'brasao'], { generos: ['fantasia', 'investigacao'] }),
  f('parede', 'tapecaria', 'Tapeçaria e cortina', ['tapecaria', 'painel.azulejo', 'cortina.janela', 'mapa.mundi', 'relogio.parede']),
  f('parede', 'grilhoes', 'Grilhões', ['grilhoes.parede'], { generos: ['fantasia'] }),
  // Carga e armazenamento
  f('carga', 'caixote', 'Caixote', ['caixa', 'caixote', 'caixa.carga', 'pilha-de-caixotes']),
  f('carga', 'barril', 'Barril', ['barril.em-pe', 'barril', 'barril.deitado', 'barril-de-chuva', 'pilha-de-barris']),
  f('carga', 'saco', 'Saco', ['sacos']),
  f('carga', 'bau', 'Baú', ['bau'], { generos: ['fantasia'] }),
  // Construção
  f('construcao', 'escada', 'Escada', ['escada.madeira', 'escada.pedra', 'escada.externa', 'estrutura.escadaria', 'escadaria.nobre', 'escada.caracol', 'escada.de-mao']),
  f('construcao', 'alcapao', 'Alçapão', ['alcapao', 'escotilha'], { generos: ['fantasia', 'ficcao-cientifica'] }),
  f('construcao', 'pilar', 'Pilar', ['pilar', 'coluna-arruinada', 'coluna-caida']),
  f('construcao', 'cerca', 'Cerca', ['cerca', 'palicada']),
  f('construcao', 'muralha', 'Muro e muralha', ['mureta-de-pedra', 'balaustrada', 'muralha-em-degraus', 'estrutura.muralha']),
  f('construcao', 'grade', 'Grade e portão', ['grade.ferro', 'portao.ferro', 'arco-de-pedra']),
  f('construcao', 'plataforma', 'Plataforma', ['tablado', 'estrutura.estrado', 'estrutura.plataforma', 'andaime', 'arquibancada']),
  f('construcao', 'escombros', 'Escombros', ['escombros', 'viga-partida', 'tabua-solta']),
  f('construcao', 'laje', 'Piso especial', ['laje-de-pedra', 'roseta-de-calcamento', 'circulo-runico', 'fosso-de-luz']),
  f('construcao', 'casulo', 'Casulo', ['casulo']),
  f('construcao', 'fonte', 'Fonte', ['fonte']),
  // Templo e cemitério
  f('religiao', 'altar', 'Altar e púlpito', ['altar', 'relicario', 'pulpito', 'atril'], { generos: ['fantasia', 'investigacao'] }),
  f('religiao', 'banco-de-igreja', 'Banco de igreja', ['banco.igreja', 'genuflexorio', 'confessionario', 'pia-batismal'], { generos: ['fantasia', 'investigacao', 'colonial', 'vitoriano'] }),
  f('religiao', 'lapide', 'Lápide', ['lapide', 'cruz.madeira', 'cruz.pedra']),
  f('religiao', 'tumulo', 'Túmulo', ['cova', 'cova.aberta', 'tumulo']),
  f('religiao', 'sarcofago', 'Sarcófago e jazigo', ['caixao', 'sarcofago', 'jazigo']),
  f('religiao', 'estatua', 'Estátua', ['estatua', 'estatua-heroica', 'anjo', 'imagem-de-santo', 'urna.pedestal', 'sombra-de-colosso']),
  f('religiao', 'sino', 'Sino', ['sino'], { generos: ['fantasia', 'investigacao'] }),
  f('religiao', 'orgao-de-tubos', 'Órgão de tubos', ['orgao-de-tubos'], { generos: ['fantasia', 'investigacao', 'colonial', 'vitoriano'] }),
  f('religiao', 'crucifixo', 'Adorno de igreja', ['crucifixo', 'icone.parede', 'vitral', 'pia-de-agua-benta'], { generos: ['fantasia', 'investigacao', 'colonial', 'vitoriano'] }),
  // Ofício e guerra
  f('oficio', 'forja', 'Forja', ['bigorna', 'fornalha', 'pedra-de-amolar', 'tina-de-agua'], { generos: ['fantasia'] }),
  f('oficio', 'tear', 'Fiação e moagem', ['roca-de-fiar', 'tear', 'mo'], { generos: ['fantasia'] }),
  f('oficio', 'pelourinho', 'Prisão e tortura', ['pelourinho', 'mesa-de-tortura', 'gaiola-de-ferro'], { generos: ['fantasia'] }),
  f('oficio', 'suporte-de-armas', 'Armas e armaduras', ['suporte-de-armas', 'suporte-de-lancas', 'armas-caidas', 'escudos-empilhados', 'mesa-de-armas', 'manequim-de-armadura'], { generos: ['fantasia'] }),
  f('oficio', 'municao', 'Munição', ['barril-de-flechas', 'pilha-de-balas'], { generos: ['fantasia'] }),
  f('oficio', 'treino', 'Alvo de treino', ['alvo-de-arqueiro', 'boneco-de-treino'], { generos: ['fantasia'] }),
  f('oficio', 'maquina-de-cerco', 'Máquina de cerco', ['balista', 'catapulta', 'canhao'], { generos: ['fantasia'] }),
  // Campo e estrada
  f('campo', 'carroca', 'Carroça', ['carroca', 'carroca-de-feno', 'carroca-tombada', 'carrinho-de-mao', 'carrinho-de-carga', 'treno']),
  f('campo', 'cavalo', 'Animal', ['cavalo', 'galinheiro']),
  f('campo', 'feno', 'Feno', ['fardo-de-feno', 'monte-de-palha', 'pilha-de-lenha']),
  f('campo', 'poco', 'Poço', ['poco', 'bebedouro']),
  f('campo', 'varal', 'Varal', ['varal']),
  f('campo', 'plantacao', 'Plantação', ['plantacao.arroz', 'plantacao.trigo', 'plantacao.milho']),
  f('campo', 'espantalho', 'Espantalho', ['espantalho']),
  f('campo', 'moinho', 'Pás de moinho', ['pas.moinho']),
  f('campo', 'barraca', 'Barraca', ['tenda', 'barraca-de-feira', 'estandarte']),
  // Porto
  f('porto', 'barco', 'Barco', ['barco-a-remo', 'barco-de-vela', 'bote-com-carga', 'barcaca', 'navio']),
  f('porto', 'cais', 'Cais', ['cais-segmento', 'guindaste-de-cais']),
  f('porto', 'estaca', 'Estaca de amarração', ['estaca', 'poste-de-amarracao']),
  f('porto', 'rede-de-pesca', 'Corda e âncora', ['rede-de-pesca', 'rolo-de-corda', 'ancora']),
  // Moderno
  f('moderno', 'geladeira', 'Eletrodoméstico', ['geladeira', 'fogao'], { generos: ['moderno'] }),
  f('moderno', 'notebook', 'Eletrônico', ['notebook', 'rack.tv'], { generos: ['moderno'] }),
  f('moderno', 'tv-de-parede', 'Aparelho de parede', ['tv.parede', 'interruptor'], { generos: ['moderno', 'investigacao'] }),
  f('moderno', 'extintor', 'Extintor', ['extintor'], { generos: ['moderno'] }),
  f('moderno', 'sinalizacao', 'Sinalização da rua', ['faixa-tracejada', 'faixa-continua', 'vaga-pintada', 'faixa-de-pedestre'], { generos: ['moderno', 'pos-apocaliptico', 'cyberpunk'], biomas: ['urbano'] }),
  f('moderno', 'bueiro', 'Bueiro, guia e mancha', ['mancha-de-oleo', 'bueiro', 'meio-fio'], { generos: ['moderno', 'pos-apocaliptico', 'cyberpunk'], biomas: ['urbano'] }),
  // Ficção científica
  f('ficcao', 'console', 'Console', ['console', 'mesa.navegacao', 'terminal.crt', 'painel.eletrico'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'gerador', 'Gerador', ['gerador'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'conteiner', 'Contêiner', ['conteiner'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'maca', 'Equipamento médico', ['maca.medica', 'scanner.corpo'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'bancada-de-laboratorio', 'Laboratório', ['mesa.laboratorio', 'armario.amostras'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'criotubo', 'Criotubo', ['criotubo'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  f('ficcao', 'tubulacao', 'Tubulação', ['tubulacao', 'cabos', 'grade.ventilacao'], { generos: ['ficcao-cientifica', 'cyberpunk'] }),
  // Ossos e restos
  f('ossos', 'ossada', 'Ossada', ['ossada', 'pilha-de-ossos', 'cranio-animal']),
  f('ossos', 'peles', 'Peles', ['pilha-de-peles']),
];

/** Escolhe a próxima variante da família, sempre diferente de `atual` quando há mais de uma. `rand` em [0, 1). */
export function sortearVariante(f: Familia, atual: string, rand: () => number): string {
  const outros = f.itens.filter(i => i !== atual);
  if (outros.length === 0) return f.itens[0] ?? atual;
  return outros[Math.min(outros.length - 1, Math.floor(rand() * outros.length))] ?? atual;
}

/** As famílias que combinam com o gênero (ou um dos que ele herda) e o bioma. `null` não filtra; uma família sem a marca correspondente (atemporal) aparece sempre. */
export function familiasVisiveis(genero: string | null, bioma: string | null): Familia[] {
  const aceitos = genero === null ? null : generosVisiveis(genero);
  return FAMILIAS.filter(f => (aceitos === null || !f.generos?.length || f.generos.some(g => aceitos.includes(g))) && (bioma === null || !f.biomas?.length || f.biomas.includes(bioma)));
}
