/**
 * Os bancos internos têm escopo de caminho (`atlas-v1:/Atlas/`) para nunca se misturarem com os de outros aplicativos
 * da mesma origem. Só os bancos de troca da mesa (`mesa-campanha-v1`, `mesa-handouts-v1`) são sem escopo.
 */
export function escopoDoCaminho(pathname: string): string {
  const caminho = pathname.split(/[?#]/)[0] ?? '/';
  const i = caminho.lastIndexOf('/');
  const dir = i < 0 ? '/' : caminho.slice(0, i + 1);
  return dir.startsWith('/') ? dir : `/${dir}`;
}

export const nomeDoBanco = (pathname: string): string => `atlas-v1:${escopoDoCaminho(pathname)}`;
