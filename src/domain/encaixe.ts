/** Objeto ou luz fica livre (sem encaixe)? `naGrade` é a preferência; `snap` é a grade do mapa; `alt` inverte o padrão. */
export function livreParaObjeto(naGrade: boolean, snap: boolean, alt: boolean): boolean {
  return naGrade ? (!snap || alt) : !alt;
}
