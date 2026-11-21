import { caminho } from '../../src/authoring/caminho.ts';
import { comodos } from '../../src/authoring/construcao.ts';
import type { Exemplo } from './kit.ts';

/** Vila dos telhados (42 × 28 m) — vitrine da Frente N com as três casas das referências. */
export const vilaDosTelhados: Exemplo = {
  id: 'vila-dos-telhados',
  nome: 'Vila dos telhados',
  descricao: 'Pequena vila rural com cabana de tábuas gasta, casa de tabuinhas com chaminé e delegacia em L de telha musgosa com puxado mais baixo, ao longo de uma estrada de terra arborizada.',
  largura: 42,
  altura: 28,
  semente: 1090,
  miniatura: 'telhados',
  construir(k) {
    k.estilo({ genre: 'investigacao', palette: 'investigacao', facades: true });
    k.fundo({ kind: 'solid', color: '#1b2318' });
    k.base('grama');

    // Estrada de terra principal serpenteando pela vila, com ramal até a casa sul
    k.aplicar(m =>
      caminho(
        m,
        {
          pontos: [
            [-2, 14.5],
            [8.5, 13.8],
            [17.5, 14.8],
            [27.5, 15.2],
            [35.5, 13.8],
            [44, 14.4],
          ],
          largura: [3.2, 4.0],
          material: 'terra',
          borda: { material: 'chao.batido', largura: 0.7 },
          sulcos: true,
          irregular: 0.45,
        },
        101,
      ),
    );
    k.aplicar(m =>
      caminho(
        m,
        {
          pontos: [
            [17.5, 15.0],
            [16.8, 19.2],
            [14.2, 23.8],
            [12.5, 29.5],
          ],
          largura: [1.8, 2.4],
          material: 'terra',
          borda: { material: 'chao.batido', largura: 0.45 },
          irregular: 0.35,
        },
        102,
      ),
    );

    // Pátios e terreiros em frente às casas
    k.pintar('chao.batido', { disco: [8.2, 12.2], raio: 3.1, irregular: 0.65 });
    k.pintar('cascalho', { retangulo: [22.2, 11.4, 31.8, 14.6], irregular: 0.35 });
    k.pintar('chao.batido', { disco: [25.2, 24.4], raio: 2.9, irregular: 0.6 });

    // Manchas sutis de vegetação e musgo nas bordas dos quintais
    k.pintar('chao.de.mata', { poligono: [[0, 0], [13, 0], [11, 4.2], [4, 5.2], [0, 9.5]], irregular: 0.8 });
    k.pintar('chao.de.mata', { poligono: [[33, 0], [42, 0], [42, 11], [36, 9.5], [34.5, 4.5]], irregular: 0.8 });
    k.pintar('chao.de.mata', { poligono: [[0, 18.5], [9.5, 20.5], [10.5, 28], [0, 28]], irregular: 0.8 });
    k.pintar('chao.de.mata', { poligono: [[34.5, 18.5], [42, 17.5], [42, 28], [32.5, 28]], irregular: 0.8 });
    k.presenca('musgo', { disco: [22.0, 6.2], raio: 1.5, irregular: 0.5 }, 0.45);
    k.presenca('musgo', { disco: [5.0, 5.2], raio: 1.4, irregular: 0.5 }, 0.4);

    // =========================================================================
    // 1. CABANA DE TÁBUAS GASTA (noroeste: células [3, 3, 8, 7] → 4,5..12 × 4,5..10,5 m)
    // =========================================================================
    const [cabanaSalaId, cabanaQuartoId] = k.aplicar((m, gerarId) =>
      comodos(
        m,
        [
          {
            rets: [[3, 5, 8, 7]],
            tipo: 'sala',
            nome: 'Sala da cabana',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'cabana-de-tabuas',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDesgaste: { moss: 0.25, dirt: 0.72, damage: 0.68, snow: 'auto' },
          },
          {
            rets: [[3, 3, 8, 5]],
            tipo: 'quarto',
            nome: 'Quarto da cabana',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'cabana-de-tabuas',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDesgaste: { moss: 0.25, dirt: 0.72, damage: 0.68, snow: 'auto' },
          },
        ],
        201,
        gerarId,
      ),
    );
    // Fachada frontal (+y = 10,5 m): porta à esquerda e janela à direita, mais passagem interna
    k.porta([6.0, 10.5], 'door', { state: 'closed' });
    k.porta([9.75, 10.5], 'window', { width: 1.05 });
    k.porta([7.5, 7.5], 'door', { state: 'open' });
    k.porta([9.75, 4.5], 'window', { width: 0.9 });

    // Mobília interna da cabana
    k.objeto('cama.solteiro', [10.4, 5.8], { rotation: Math.PI / 2 });
    k.objeto('armario', [6.2, 5.1], { rotation: 0 });
    k.objeto('mesa.retangular', [5.6, 8.8], { params: { largura: 1.5, profundidade: 0.85 }, rotation: 0 });
    k.objeto('sofa', [9.6, 9.2], { rotation: Math.PI });
    k.luz('lamparina', [8.0, 8.4], { radius: 4.5, intensity: 0.95 });

    // =========================================================================
    // 2. DELEGACIA EM L COM PUXADO MAIS BAIXO (centro-leste: corpo [17, 2, 21, 8] + puxado [15, 4, 17, 8])
    //    Corpo principal: 25,5..31,5 × 3,0..12,0 m (telha.barro, duas-aguas, musgo em fios)
    //    Puxado lateral mais baixo: 22,5..25,5 × 6,0..12,0 m (telha.barro, uma-agua)
    // =========================================================================
    const [delegaciaSalaoId, delegaciaCelasId, delegaciaPuxadoId] = k.aplicar((m, gerarId) =>
      comodos(
        m,
        [
          {
            rets: [[17, 4, 21, 8]],
            tipo: 'escritorio',
            nome: 'Atendimento da delegacia',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'casa-velha',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDetalhes: [],
            telhadoDesgaste: { moss: 0.78, dirt: 0.48, damage: 0.14, snow: 'auto' },
          },
          {
            rets: [[17, 2, 21, 4]],
            tipo: 'cela',
            nome: 'Celas dos fundos',
            piso: 'laje.pedra',
            papel: 'parede.alvenaria',
            wallFace: 'parede.tabuas',
            telhado: 'casa-velha',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDetalhes: [],
            telhadoDesgaste: { moss: 0.78, dirt: 0.48, damage: 0.14, snow: 'auto' },
          },
          {
            rets: [[15, 4, 17, 8]],
            tipo: 'deposito',
            nome: 'Puxado da delegacia',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'telha.barro',
            telhadoForma: 'uma-agua',
            telhadoCumeeira: 'v',
            telhadoDesgaste: { moss: 0.65, dirt: 0.52, damage: 0.22, snow: 'auto' },
          },
        ],
        202,
        gerarId,
      ),
    );
    // Fachada frontal (+y = 12,0 m): porta principal no puxado/entrada esquerda + duas janelas no corpo principal
    k.porta([24.0, 12.0], 'door', { state: 'closed', width: 1.05 });
    k.porta([27.0, 12.0], 'window', { width: 1.05 });
    k.porta([30.0, 12.0], 'window', { width: 1.05 });
    // Passagens internas e janelas dos fundos
    k.porta([25.5, 9.0], 'door', { state: 'open' });
    k.porta([28.5, 6.0], 'door', { state: 'closed' });
    k.porta([27.0, 3.0], 'window', { width: 0.8 });
    k.porta([30.0, 3.0], 'window', { width: 0.8 });

    // Mobília interna da delegacia
    k.objeto('escrivaninha', [28.6, 9.2], { rotation: 0 });
    k.objeto('cadeira', [28.6, 8.2], { rotation: 0 });
    k.objeto('cadeira', [27.4, 10.2], { rotation: Math.PI });
    k.objeto('estante', [26.3, 6.7], { rotation: 0 });
    k.objeto('armario', [30.6, 7.6], { rotation: -Math.PI / 2 });
    k.objeto('pilha-de-caixotes', [23.6, 7.2], { rotation: 0.12 });
    k.objeto('barril', [24.2, 9.6], { rotation: 0.3 });
    k.objeto('cama.solteiro', [26.8, 4.2], { rotation: 0 });
    k.objeto('cama.solteiro', [30.2, 4.2], { rotation: 0 });
    k.luz('lamparina', [28.2, 9.0], { radius: 5.0, intensity: 1.0 });

    // =========================================================================
    // 3. CASA DE TABUINHAS (sul-leste: células [14, 12, 19, 16] → 21,0..28,5 × 18,0..24,0 m)
    // =========================================================================
    const [tabuinhasSalaId, tabuinhasQuartoId] = k.aplicar((m, gerarId) =>
      comodos(
        m,
        [
          {
            rets: [[14, 14, 19, 16]],
            tipo: 'sala-de-jantar',
            nome: 'Sala da casa de tabuinhas',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'telha.tabuinhas',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDetalhes: ['chamine'],
            telhadoDesgaste: { moss: 0.22, dirt: 0.55, damage: 0.42, snow: 'auto' },
          },
          {
            rets: [[14, 12, 19, 14]],
            tipo: 'quarto',
            nome: 'Quarto da casa de tabuinhas',
            piso: 'tabuas.escuras',
            papel: 'parede.tabuas',
            wallFace: 'parede.tabuas',
            telhado: 'telha.tabuinhas',
            telhadoForma: 'duas-aguas',
            telhadoCumeeira: 'v',
            telhadoDetalhes: ['chamine'],
            telhadoDesgaste: { moss: 0.22, dirt: 0.55, damage: 0.42, snow: 'auto' },
          },
        ],
        203,
        gerarId,
      ),
    );
    // Fachada frontal (+y = 24,0 m): porta + janela, mais passagem interna
    k.porta([22.5, 24.0], 'door', { state: 'closed' });
    k.porta([26.25, 24.0], 'window', { width: 1.05 });
    k.porta([24.75, 21.0], 'door', { state: 'open' });
    k.porta([26.25, 18.0], 'window', { width: 0.9 });

    // Mobília interna da casa de tabuinhas
    k.objeto('mesa.retangular', [24.6, 22.3], { params: { largura: 1.8, profundidade: 0.95 }, rotation: 0 });
    k.objeto('cadeira', [24.2, 21.4], { rotation: 0 });
    k.objeto('poltrona', [27.1, 22.8], { rotation: -Math.PI / 4 });
    k.objeto('cama.solteiro', [27.0, 19.4], { rotation: Math.PI / 2 });
    k.objeto('armario', [22.8, 18.7], { rotation: 0 });
    k.luz('lamparina', [24.6, 22.3], { radius: 4.8, intensity: 0.95 });

    // =========================================================================
    // Vida da vila: cercas, poço, lenha, carroça, barris e lampiões de rua
    // =========================================================================
    k.parede([[2.5, 10.8], [2.5, 3.2], [13.2, 3.2]], { kind: 'fence' });
    k.parede([[30.2, 17.6], [30.2, 24.8], [28.9, 24.8]], { kind: 'fence' });

    k.objeto('poco', [16.4, 9.6], { scale: 1.0 });
    k.objeto('pilha-de-lenha', [12.9, 7.8], { rotation: 0.15 });
    k.objeto('barril-de-chuva', [12.7, 9.8], { rotation: 0.2 });
    k.objeto('barril-de-chuva', [21.9, 10.6], { rotation: -0.3 });
    k.objeto('carroca', [11.2, 18.8], { rotation: 0.42 });
    k.objeto('pilha-de-lenha', [29.3, 21.2], { rotation: 1.5 });
    k.objeto('poste-de-amarracao', [21.2, 12.9], { rotation: 0 });
    k.objeto('poste-de-amarracao', [31.2, 13.1], { rotation: 0.1 });

    // Lampiões ao longo da estrada (iluminam os telhados e fachadas no clima noturno)
    for (const pos of [
      [8.6, 12.6],
      [19.6, 13.4],
      [27.8, 13.5],
      [34.8, 12.6],
      [20.2, 24.2],
    ] as const) {
      k.objeto('lanterna-de-poste', [pos[0], pos[1]]);
      k.luz('tocha', [pos[0], pos[1]], {
        radius: 8.5,
        color: '#ffc05c',
        intensity: 1.2,
        flicker: 0.18,
      });
    }

    // Vegetação orgânica nos quatro quadrantes externos
    k.espalhar('mata', { poligono: [[0.5, 0.5], [14, 0.5], [13.5, 3.0], [2.5, 4.0], [2.5, 11.5], [0.5, 11.5]] }, { densidade: 0.1 });
    k.espalhar('mata', { poligono: [[33.0, 0.5], [41.5, 0.5], [41.5, 11.5], [33.5, 11.5]] }, { densidade: 0.1 });
    k.espalhar('mata', { poligono: [[0.5, 17.5], [10.0, 18.5], [11.0, 27.5], [0.5, 27.5]] }, { densidade: 0.1 });
    k.espalhar('mata', { poligono: [[31.5, 17.5], [41.5, 17.0], [41.5, 27.5], [31.5, 27.5]] }, { densidade: 0.1 });

    // Algumas árvores de destaque enquadrando a vila
    k.objeto('casa:arvore-5m', [1.8, 11.2], { scale: 1.05 });
    k.objeto('casa:arvore-5m', [14.2, 2.0], { scale: 0.95 });
    k.objeto('casa:arvore-5m', [37.2, 8.2], { scale: 1.1 });
    k.objeto('casa:arvore-5m', [38.5, 3.2], { scale: 1.15 });
    k.objeto('casa:arvore-5m', [5.6, 22.8], { scale: 1.15 });
    k.objeto('casa:arvore-5m', [3.2, 18.8], { scale: 0.95 });
    k.objeto('casa:arvore-5m', [35.4, 23.4], { scale: 1.05 });
    k.objeto('casa:arvore-5m', [39.0, 19.6], { scale: 1.0 });

    // Remove qualquer objeto externo que tenha caído dentro de cômodos ou na frente de portas
    k.tirarExternosDosInteriores();

    // Clima padrão: tarde clara (relevo, sombras e cores fiéis dos telhados e fachadas)
    k.clima('tarde', {
      time: '14:30',
      tempo: { wind: 0.15 },
    });
    k.acabamento('dia-dourado', {
      vignette: 0.24,
      edges: { kind: 'none', amount: 0 },
    });

    // Climas salvos: noite com lampiões na rua e inverno nevado
    k.guardarClima('tarde-na-vila', 'Tarde de sol na vila');
    k.guardarClima('noite-na-vila', 'Noite sob os lampiões', 'noite', {
      time: '23:00',
      ambient: { color: '#6b83a8', intensity: 0.62 },
      sun: { angle: 0.8, color: '#9ebce8', intensity: 0.42 },
      tempo: { fog: 0.22, wind: 0.12 },
      finish: { tint: '#eef2fb', saturation: 0.92, vignette: 0.32, edges: { kind: 'none', amount: 0 }, glow: 0.72 },
    });
    k.guardarClima('inverno-na-vila', 'Manhã de neve', 'neve', {
      time: '09:30',
      tempo: { snow: 0.85, wind: 0.2 },
    });

    // Notas de cômodo
    k.notaDeComodo(cabanaSalaId!, {
      leitura: 'Tábuas gastas, cheiro de madeira úmida e frestas no forro por onde entra poeira iluminada.',
      notasMestre: 'O telhado de tábuas tem remendos improvisados e partes faltando perto da cumeeira.',
    });
    k.notaDeComodo(cabanaQuartoId!, {
      leitura: 'Um quarto simples com cama estreita e guarda-roupa empenado.',
    });
    k.notaDeComodo(delegaciaSalaoId!, {
      leitura: 'Escrivaninha de madeira escura, arquivos empoeirados e duas janelas voltadas para a estrada.',
      notasMestre: 'Do lado de fora, o telhado de barro está tomado por fios de musgo escorrendo até o beiral.',
    });
    k.notaDeComodo(delegaciaCelasId!, {
      leitura: 'Duas celas frias de pedra nos fundos da delegacia.',
    });
    k.notaDeComodo(delegaciaPuxadoId!, {
      leitura: 'Depósito lateral sob o puxado mais baixo, cheio de caixotes e apreensões antigas.',
    });
    k.notaDeComodo(tabuinhasSalaId!, {
      leitura: 'Mesa posta no centro da sala e cheiro fraco de fuligem vindo da chaminé.',
    });
    k.notaDeComodo(tabuinhasQuartoId!, {
      leitura: 'Quarto silencioso nos fundos, sob o telhado de tabuinhas remendado.',
    });

    k.notas(
      'Vila dos telhados — Três construções de referência ao longo de uma estrada de terra: cabana de tábuas gasta, delegacia em L de telha musgosa com puxado mais baixo e casa de tabuinhas com chaminé.',
    );
  },
};
