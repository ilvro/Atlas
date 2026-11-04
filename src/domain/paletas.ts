/** Paletas do estilo Pixel (`style.palette`). Todas têm o mesmo número de cores, muitos escuros, para o filtro de paleta. */
export interface PaletaPixel { id: string; nome: string; cores: string[] }

export const CORES_DA_PALETA = 32;

export const PALETAS_PIXEL: PaletaPixel[] = [
  {
    id: 'investigacao-sepia', nome: 'Investigação (sépia)', cores: [
      '#0b0a10', '#16131c', '#221c27', '#2e2633', '#3b3140', '#4a4a5c', '#67708a', '#93a0b5',
      '#eef0f2', '#2b1b14', '#46291b', '#6b3e22', '#93592c', '#b97d3d', '#d9a75e', '#f6e7c1',
      '#4a1418', '#7a1f24', '#b2312e', '#e0573f', '#1d2a1f', '#2f4a32', '#4f7346', '#86a35a',
      '#1a2440', '#2a3f6b', '#3e6aa0', '#7fb0d8', '#3a2244', '#6b3d74', '#e8c4a0', '#c9bb98',
    ],
  },
  {
    id: 'moderno-claro', nome: 'Moderno (claro)', cores: [
      '#0d0f14', '#171a21', '#232832', '#323946', '#444d5e', '#5c667a', '#7d889c', '#a3adbf',
      '#d0d7e3', '#f4f6fa', '#2a1d16', '#4a3223', '#6f4a31', '#946a47', '#bb9068', '#dfc29c',
      '#1b2a44', '#2d4b7a', '#4f7fb8', '#95bfe6', '#1c3328', '#2f5a43', '#55906a', '#9fcb9c',
      '#5a1f22', '#a23a35', '#e0704f', '#f0b24a', '#3a2a4a', '#7a5a96', '#d9c9a8', '#b8a98a',
    ],
  },
  {
    id: 'fantasia-quente', nome: 'Fantasia (quente)', cores: [
      '#0c0a0f', '#181119', '#261a22', '#36252b', '#4b3436', '#634a44', '#806656', '#a68c70',
      '#2b1810', '#4a2a17', '#70431f', '#986230', '#c28a45', '#e6b869', '#f3d98f', '#fbefc4',
      '#fff8e6', '#3d0f17', '#6b1824', '#a52a2d', '#de5a3c', '#17261a', '#28422a', '#44703a',
      '#7fa24e', '#1a2036', '#2c3d6b', '#4a6aa5', '#3a2150', '#70448a', '#5b6578', '#9aa5b5',
    ],
  },
];

/** A paleta de um id; um id desconhecido vale como a primeira. */
export const paletaDe = (id: string): PaletaPixel => PALETAS_PIXEL.find(p => p.id === id) ?? PALETAS_PIXEL[0]!;
