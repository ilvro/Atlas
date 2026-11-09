import { useEffect, useState } from 'preact/hooks';

export interface DadosDoLetreiro {
  titulo: string;
  subtitulo: string;
  estilo: 'apresentacao' | 'capitulo';
  retrato: string | null;
  ms: number;
}

export function LetreiroDoProjetor({
  dados,
  lerRetrato,
  aoTerminar,
}: {
  dados: DadosDoLetreiro;
  lerRetrato: (id: string) => Promise<Blob | null>;
  aoTerminar?: () => void;
}) {
  const [urlRetrato, definirUrlRetrato] = useState<string | null>(null);
  const [saindo, definirSaindo] = useState(false);

  // Carrega o retrato caso fornecido (estilo apresentação)
  useEffect(() => {
    let vivo = true;
    let urlCriada: string | null = null;
    if (dados.retrato && dados.estilo === 'apresentacao') {
      void lerRetrato(dados.retrato).then(blob => {
        if (!vivo) return;
        if (blob) {
          urlCriada = URL.createObjectURL(blob);
          definirUrlRetrato(urlCriada);
        } else {
          definirUrlRetrato(null);
        }
      }).catch(() => {
        if (vivo) definirUrlRetrato(null);
      });
    } else {
      definirUrlRetrato(null);
    }
    return () => {
      vivo = false;
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [dados.retrato, dados.estilo, lerRetrato]);

  // Tempo de exibição: some sozinho após ms com fade
  useEffect(() => {
    definirSaindo(false);
    if (dados.ms <= 0) return;
    const duracaoFade = 300;
    const tFade = setTimeout(() => {
      definirSaindo(true);
    }, dados.ms);
    const tTerminar = setTimeout(() => {
      aoTerminar?.();
    }, dados.ms + duracaoFade);

    return () => {
      clearTimeout(tFade);
      clearTimeout(tTerminar);
    };
  }, [dados, aoTerminar]);

  if (dados.estilo === 'capitulo') {
    return (
      <div
        class={`projetor-letreiro letreiro-capitulo ${saindo ? 'letreiro-saindo' : ''}`}
        data-testid="projetor-letreiro"
        data-estilo="capitulo"
        aria-live="polite"
      >
        <div class="letreiro-capitulo-conteudo">
          <h2 class="letreiro-capitulo-titulo">{dados.titulo}</h2>
          {dados.subtitulo && (
            <p class="letreiro-capitulo-subtitulo">{dados.subtitulo}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      class={`projetor-letreiro letreiro-apresentacao ${saindo ? 'letreiro-saindo' : ''}`}
      data-testid="projetor-letreiro"
      data-estilo="apresentacao"
      aria-live="polite"
    >
      <div class="letreiro-apresentacao-conteudo">
        {urlRetrato && (
          <div class="letreiro-apresentacao-retrato-moldura">
            <img class="letreiro-apresentacao-retrato" src={urlRetrato} alt="" />
            <div class="letreiro-apresentacao-vinheta" aria-hidden="true" />
          </div>
        )}
        <div class="letreiro-apresentacao-textos">
          <div class="letreiro-apresentacao-traco" aria-hidden="true" />
          <h2 class="letreiro-apresentacao-titulo">{dados.titulo}</h2>
          {dados.subtitulo && (
            <p class="letreiro-apresentacao-subtitulo">{dados.subtitulo}</p>
          )}
        </div>
      </div>
    </div>
  );
}
