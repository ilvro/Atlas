import { abrirRepositorioCampanha, criarBarramento, type Barramento, type RepositorioCampanha } from '#mesa';
import { nomeDoBanco } from '../data/escopo.ts';
import { abrirRepositorioMapas, type RepositorioMapas } from '../data/repositorio.ts';

/**
 * O que o aplicativo usa de fora do documento. `campanhas` e `barramento` são da plataforma: se o navegador
 * não os oferece (modo privado, sem IndexedDB compartilhado), o Atlas continua funcionando sozinho.
 */
export interface Servicos {
  repo: RepositorioMapas;
  campanhas: RepositorioCampanha | null;
  barramento: Barramento | null;
}

export async function iniciarServicos(): Promise<Servicos> {
  const repo = await abrirRepositorioMapas({ nome: nomeDoBanco(location.pathname) });
  const campanhas = await abrirRepositorioCampanha({ app: 'atlas' }).catch(erro => { console.warn('Atlas: sem banco da campanha', erro); return null; });
  let barramento: Barramento | null = null;
  try { barramento = criarBarramento({ app: 'atlas' }); } catch (erro) { console.warn('Atlas: sem barramento de eventos', erro); }
  return { repo, campanhas, barramento };
}
