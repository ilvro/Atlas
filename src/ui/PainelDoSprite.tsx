import { useEffect, useMemo, useRef } from 'preact/hooks';
import { servicos } from '../app/app.ts';
import { avisar } from '../app/toasts.ts';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Peca } from '../domain/mapa.ts';
import { ACESSORIOS, CABELOS, CAMPOS_DE_COR, CORPOS, ROUPAS, corDoSprite, spriteAleatorio, type CampoDeCor } from '../domain/sprite.ts';
import { coresDominantes, sugerirCoresDoSprite } from '../procedural/cores-do-retrato.ts';
import { DIRECOES, QUADRO, folhaDoSprite } from '../procedural/sprite.ts';
import { CampoCaixa, CampoCor, CampoOpcoes, Linha, tentar } from './campos.tsx';
import { useGestoDeCor } from './gesto-de-cor.ts';

const ESCALA = 3, MS_DO_QUADRO = 140;

/** O sprite animado nas quatro direções, ampliado em `nearest`. Redesenha a folha quando o sprite muda. */
function PreviaDoSprite({ sprite }: { sprite: NonNullable<Peca['sprite']> }) {
  const canvas = useRef<HTMLCanvasElement>(null), chave = JSON.stringify(sprite);
  const folha = useMemo(() => folhaDoSprite(sprite), [chave]);
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
    const [w, h] = QUADRO, desenhar = (passo: number) => {
      g.clearRect(0, 0, c.width, c.height);
      DIRECOES.forEach((_, i) => g.drawImage(folha as CanvasImageSource, (2 + (passo % 4)) * w, i * h, w, h, i * (w * ESCALA + 4), 0, w * ESCALA, h * ESCALA));
    };
    let passo = 0; desenhar(0);
    const id = setInterval(() => desenhar(++passo), MS_DO_QUADRO);
    return () => clearInterval(id);
  }, [folha]);
  return <canvas ref={canvas} data-testid="sprite-previa" width={4 * (QUADRO[0] * ESCALA + 4)} height={QUADRO[1] * ESCALA} class="previa-sprite" aria-label="Prévia do sprite andando nas quatro direções" />;
}

/** Criar, sortear e editar o sprite de uma peça: corpo, cabelo, roupa, acessórios e quatro cores. Tudo é um passo "Sprite da peça" no histórico. */
export function PainelDoSprite({ s, t }: { s: SessaoDeEdicao; t: Peca }) {
  const g = useGestoDeCor(s, 'Sprite da peça'), sp = t.sprite;
  const editar = (patch: Record<string, unknown>) => tentar(() => s.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch }, { rotulo: 'Sprite da peça' }));
  const sortear = () => editar({ sprite: spriteAleatorio(Math.floor(Math.random() * 2 ** 30)) });
  if (!sp) return (
    <Linha rotulo="Sprite" dica="Um personagem em pixel art; aparece no estilo Pixel (no Ilustrado, só quando a peça não tem retrato).">
      <button type="button" class="botao-pilula" data-testid="sprite-criar" onClick={sortear}>Criar sprite</button>
    </Linha>
  );
  const cores = (campo: CampoDeCor) => corDoSprite(sp, campo);
  /** Lê o retrato, tira as cores dominantes e sugere pele, cabelo, roupa e detalhe do sprite. */
  const coresDoRetrato = async () => {
    try {
      const asset = t.portrait ? await servicos.value?.repo.obterAsset(t.portrait.id) : undefined; if (!asset) { avisar('Não achei o retrato desta peça.', { tipo: 'erro' }); return; }
      const bmp = await createImageBitmap(asset.blob), lado = 64, c = document.createElement('canvas'); c.width = c.height = lado;
      const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bmp, 0, 0, lado, lado); bmp.close();
      const dominantes = coresDominantes(g.getImageData(0, 0, lado, lado), 5);
      if (!dominantes.length) { avisar('O retrato não tem cores que dê para aproveitar.', { tipo: 'erro' }); return; }
      editar({ sprite: { colors: sugerirCoresDoSprite(dominantes) } });
    } catch (erro) { avisar(`Não consegui ler o retrato: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' }); }
  };
  return (<div class="painel-sprite" data-testid="painel-sprite">
    <PreviaDoSprite sprite={sp} />
    <CampoOpcoes rotulo="Corpo" valor={sp.body} opcoes={CORPOS.map(o => [o.id, o.nome] as const)} aoMudar={v => editar({ sprite: { body: v } })} />
    <CampoOpcoes rotulo="Cabelo" valor={sp.hair} opcoes={CABELOS.map(o => [o.id, o.nome] as const)} aoMudar={v => editar({ sprite: { hair: v } })} />
    <CampoOpcoes rotulo="Roupa" valor={sp.outfit} opcoes={ROUPAS.map(o => [o.id, o.nome] as const)} aoMudar={v => editar({ sprite: { outfit: v } })} />
    {ACESSORIOS.map(a => <CampoCaixa key={a.id} rotulo={a.nome} valor={sp.accessories.includes(a.id)} aoMudar={v => editar({ sprite: { accessories: v ? [...sp.accessories, a.id] : sp.accessories.filter(x => x !== a.id) } })} />)}
    {CAMPOS_DE_COR.map(([campo, nome]) => <CampoCor key={campo} rotulo={nome} valor={cores(campo)} aoPrevia={v => g.previa(x => x.aplicar({ tipo: 'item.atualizar', colecao: 'tokens', id: t.id, patch: { sprite: { colors: { [campo]: v } } } }))} aoConfirmar={g.confirmar} />)}
    {t.portrait && <Linha rotulo="Cores do retrato" dica="Sugere pele, cabelo, roupa e detalhe a partir das cores do retrato."><button type="button" class="botao-pilula" data-testid="sprite-cores-do-retrato" onClick={() => void coresDoRetrato()}>Usar</button></Linha>}
    <Linha rotulo="Sprite"><button type="button" class="botao-pilula" data-testid="sprite-sortear" onClick={sortear}>Sortear</button>
      <button type="button" class="botao-pilula" data-testid="sprite-remover" onClick={() => editar({ sprite: null })}>Tirar</button></Linha>
  </div>);
}
