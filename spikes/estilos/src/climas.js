// "O mesmo mapa, vários momentos": cada clima é só luz, paleta, acabamento e partículas. O mapa não muda.
export const CLIMAS = {
  dia: {
    nome: 'Dia', ambiente: [0.82, 0.8, 0.75], ceu: [1, 0.95, 0.84], ceuIntensidade: 1, rede: 0, chuva: 0, relampago: false, lanterna: false,
    acabamento: { saturacao: 1.04, contraste: 1.04, tom: [1.03, 1, 0.95], vinheta: 0.28, grao: 0.03 },
  },
  tempestade: {
    nome: 'Tempestade', ambiente: [0.22, 0.25, 0.31], ceu: [0.55, 0.62, 0.78], ceuIntensidade: 0.5, rede: 1, chuva: 1, relampago: true, lanterna: false,
    acabamento: { saturacao: 0.6, contraste: 1.08, tom: [0.9, 0.97, 1.08], vinheta: 0.5, grao: 0.06 },
  },
  noite: {
    nome: 'Noite', ambiente: [0.06, 0.07, 0.13], ceu: [0.42, 0.5, 0.88], ceuIntensidade: 0.5, rede: 1, chuva: 0, relampago: false, lanterna: false,
    acabamento: { saturacao: 0.88, contraste: 1.05, tom: [0.96, 0.97, 1.08], vinheta: 0.5, grao: 0.05 },
  },
  apagao: {
    nome: 'Apagão', ambiente: [0.022, 0.022, 0.035], ceu: [0.35, 0.42, 0.72], ceuIntensidade: 0.3, rede: 0, chuva: 0, relampago: false, lanterna: true,
    acabamento: { saturacao: 0.7, contraste: 1.12, tom: [1, 0.94, 0.94], vinheta: 0.65, grao: 0.09 },
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const lerpV = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

/** Estado numérico do clima, interpolável. `rede` (luzes elétricas) e `chuva` também fazem transição. */
export function misturarClimas(a, b, t) {
  return {
    ambiente: lerpV(a.ambiente, b.ambiente, t), ceu: lerpV(a.ceu, b.ceu, t), ceuIntensidade: lerp(a.ceuIntensidade, b.ceuIntensidade, t),
    rede: lerp(a.rede, b.rede, t), chuva: lerp(a.chuva, b.chuva, t),
    acabamento: {
      saturacao: lerp(a.acabamento.saturacao, b.acabamento.saturacao, t), contraste: lerp(a.acabamento.contraste, b.acabamento.contraste, t),
      tom: lerpV(a.acabamento.tom, b.acabamento.tom, t), vinheta: lerp(a.acabamento.vinheta, b.acabamento.vinheta, t), grao: lerp(a.acabamento.grao, b.acabamento.grao, t),
    },
  };
}
