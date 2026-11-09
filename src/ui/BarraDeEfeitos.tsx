import { useState, useEffect, useRef } from 'preact/hooks';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import {
  barraDeEfeitos,
  ultimoDisparo,
  definirEspaco,
  trocarEspacos,
  dispararEspaco,
} from '../app/barra-de-efeitos.ts';
import { momentoEmCurso } from '../app/momentos.ts';
import { type EspacoDaBarra, obterIconeDoEspaco } from '../domain/barra-de-efeitos.ts';
import type { PassoDeMomento } from '../domain/momentos.ts';
import { CamposDoPasso } from './Momentos.tsx';
import { Icone } from './Icone.tsx';
import { avisar } from '../app/toasts.ts';
import { criarRef } from '#mesa';

export type TipoDeEspaco = 'efeito' | 'som' | 'clima' | 'tela' | 'letreiro' | 'nota' | 'momento';

const TIPOS_DE_ESPACO: { id: TipoDeEspaco; rotulo: string }[] = [
  { id: 'efeito', rotulo: 'Efeito de cena' },
  { id: 'som', rotulo: 'Som do Jukebox' },
  { id: 'clima', rotulo: 'Clima' },
  { id: 'tela', rotulo: 'Cortina' },
  { id: 'letreiro', rotulo: 'Letreiro' },
  { id: 'nota', rotulo: 'Nota' },
  { id: 'momento', rotulo: 'Momento do mapa' },
];

function criarPassoPadrao(tipo: TipoDeEspaco): PassoDeMomento {
  switch (tipo) {
    case 'efeito':
      return { tipo: 'efeito', efeito: 'relampago' };
    case 'som':
      return { tipo: 'som', ref: criarRef('jukebox', 'efeito', 'grito') };
    case 'clima':
      return { tipo: 'clima', clima: 'noite' };
    case 'tela':
      return { tipo: 'tela', acao: 'escurecer', ms: 800 };
    case 'letreiro':
      return { tipo: 'letreiro', estilo: 'apresentacao', titulo: 'Apresentação', subtitulo: '', peca: null, ms: 3000 };
    case 'nota':
      return { tipo: 'nota', texto: '' };
    default:
      return { tipo: 'efeito', efeito: 'relampago' };
  }
}

function sugerirRotulo(tipo: TipoDeEspaco, passo: PassoDeMomento, momentoId: string, s: SessaoDeEdicao): string {
  if (tipo === 'momento') {
    const m = s.doc.value.moments[momentoId];
    return m ? m.nome.slice(0, 14) : 'Momento';
  }
  switch (passo.tipo) {
    case 'efeito':
      if (passo.efeito === 'relampago') return 'Relâmpago';
      if (passo.efeito === 'tremor') return 'Tremor';
      if (passo.efeito === 'piscar') return 'Luzes piscam';
      if (passo.efeito === 'clarao') return 'Clarão';
      return passo.efeito.slice(0, 14);
    case 'som':
      return passo.ref.id.slice(0, 14);
    case 'clima':
      return passo.clima.slice(0, 14);
    case 'tela':
      return passo.acao === 'escurecer' ? 'Escurecer' : 'Clarear';
    case 'letreiro':
      return passo.titulo ? passo.titulo.slice(0, 14) : 'Letreiro';
    case 'nota':
      return 'Nota';
    default:
      return 'Passo';
  }
}

interface PopoverProps {
  s: SessaoDeEdicao;
  indice: number;
  espaco: EspacoDaBarra | null;
  aoSalvar: (novo: EspacoDaBarra) => void;
  aoLimpar: () => void;
  aoFechar: () => void;
}

export function PopoverConfiguracaoEspaco({
  s,
  indice,
  espaco,
  aoSalvar,
  aoLimpar,
  aoFechar,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const momentos = Object.values(s.doc.value.moments);

  const tipoInicial: TipoDeEspaco = espaco
    ? espaco.acao.tipo === 'momento'
      ? 'momento'
      : (espaco.acao.passo.tipo as TipoDeEspaco)
    : 'efeito';

  const [tipo, setTipo] = useState<TipoDeEspaco>(tipoInicial);
  const [rotulo, setRotulo] = useState(espaco?.rotulo ?? '');
  const [draftPasso, setDraftPasso] = useState<PassoDeMomento>(() => {
    if (espaco && espaco.acao.tipo === 'passo') return espaco.acao.passo;
    return criarPassoPadrao(tipoInicial);
  });
  const [momentoId, setMomentoId] = useState<string>(() => {
    if (espaco && espaco.acao.tipo === 'momento') return espaco.acao.id;
    return momentos[0]?.id ?? '';
  });

  useEffect(() => {
    const aoClicarFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        aoFechar();
      }
    };
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
      }
    };
    window.addEventListener('mousedown', aoClicarFora);
    window.addEventListener('keydown', aoTecla);
    return () => {
      window.removeEventListener('mousedown', aoClicarFora);
      window.removeEventListener('keydown', aoTecla);
    };
  }, [aoFechar]);

  const aoTrocarTipo = (novoTipo: TipoDeEspaco) => {
    setTipo(novoTipo);
    if (novoTipo === 'momento') {
      if (!momentoId && momentos.length > 0) {
        setMomentoId(momentos[0]!.id);
      }
    } else {
      setDraftPasso(criarPassoPadrao(novoTipo));
    }
  };

  const salvar = () => {
    const rotuloFinal = rotulo.trim() || sugerirRotulo(tipo, draftPasso, momentoId, s);
    if (tipo === 'momento') {
      if (!momentoId) {
        avisar('Nenhum momento selecionado.');
        return;
      }
      aoSalvar({ rotulo: rotuloFinal, acao: { tipo: 'momento', id: momentoId } });
    } else {
      aoSalvar({ rotulo: rotuloFinal, acao: { tipo: 'passo', passo: draftPasso } });
    }
  };

  return (
    <div
      class="popover-barra-efeitos"
      ref={containerRef}
      role="dialog"
      aria-label={`Configurar Espaço ${indice + 1}`}
      data-testid="popover-barra-efeitos"
    >
      <div class="popover-espaco-topo">
        <div class="popover-espaco-titulo">
          <span>Espaço {indice + 1}</span>
          <span class="popover-espaco-sub">Tecla {indice + 1}</span>
        </div>
        <button
          type="button"
          class="popover-espaco-fechar"
          data-testid="popover-espaco-fechar"
          aria-label="Fechar"
          onClick={aoFechar}
        >
          <Icone nome="fechar" tamanho={14} />
        </button>
      </div>

      <label class="dock-rotulo">
        Rótulo curto (até 14 letras):
        <input
          type="text"
          class="campo-texto"
          maxLength={14}
          value={rotulo}
          placeholder={sugerirRotulo(tipo, draftPasso, momentoId, s)}
          data-testid="popover-espaco-rotulo"
          onInput={e => setRotulo((e.target as HTMLInputElement).value)}
        />
      </label>

      <label class="dock-rotulo">
        Tipo de ação:
        <select
          class="campo-select"
          value={tipo}
          data-testid="popover-espaco-tipo"
          onChange={e => aoTrocarTipo((e.target as HTMLSelectElement).value as TipoDeEspaco)}
        >
          {TIPOS_DE_ESPACO.map(t => (
            <option key={t.id} value={t.id}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>

      {tipo === 'momento' ? (
        <label class="dock-rotulo">
          Momento do mapa:
          <select
            class="campo-select"
            value={momentoId}
            data-testid="popover-espaco-momento"
            onChange={e => setMomentoId((e.target as HTMLSelectElement).value)}
          >
            {momentos.length === 0 ? (
              <option value="">(Nenhum momento no mapa)</option>
            ) : (
              momentos.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))
            )}
          </select>
        </label>
      ) : (
        <CamposDoPasso s={s} passo={draftPasso} aoAtualizar={setDraftPasso} />
      )}

      <div class="popover-espaco-rodape">
        <button
          type="button"
          class="botao-limpar-espaco"
          data-testid="popover-espaco-limpar"
          onClick={aoLimpar}
        >
          Limpar espaço
        </button>
        <div class="popover-espaco-acoes-dir">
          <button
            type="button"
            class="dock-pilula"
            data-testid="popover-espaco-cancelar"
            onClick={aoFechar}
          >
            Cancelar
          </button>
          <button
            type="button"
            class="dock-pilula destaque"
            data-testid="popover-espaco-salvar"
            onClick={salvar}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

interface BotaoEspacoProps {
  indice: number;
  espaco: EspacoDaBarra | null;
  s: SessaoDeEdicao;
  arrastandoSobre: boolean;
  aoConfigurar: () => void;
  aoDisparar: () => void;
  aoIniciarArrasto: (e: DragEvent) => void;
  aoArrastarSobre: (e: DragEvent) => void;
  aoSairArrasto: () => void;
  aoSoltar: (e: DragEvent) => void;
}

function BotaoEspaco({
  indice,
  espaco,
  arrastandoSobre,
  aoConfigurar,
  aoDisparar,
  aoIniciarArrasto,
  aoArrastarSobre,
  aoSairArrasto,
  aoSoltar,
}: BotaoEspacoProps) {
  const disparo = ultimoDisparo.value;
  const disparou = disparo?.i === indice && Date.now() - disparo.quando < 450;
  const emCurso = momentoEmCurso.value;
  const momentoAtivo = espaco?.acao.tipo === 'momento' && emCurso?.id === espaco.acao.id;

  const numeroTecla = indice + 1;

  if (!espaco) {
    return (
      <div
        role="button"
        tabIndex={0}
        class={`barra-efeitos-botao vazio ${arrastandoSobre ? 'arrastando-sobre' : ''}`}
        data-testid={`barra-espaco-${numeroTecla}`}
        title={`Espaço ${numeroTecla} (Vazio) — clique para configurar`}
        draggable={true}
        onDragStart={aoIniciarArrasto}
        onDragOver={aoArrastarSobre}
        onDragLeave={aoSairArrasto}
        onDrop={aoSoltar}
        onClick={aoConfigurar}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            aoConfigurar();
          }
        }}
        onContextMenu={e => {
          e.preventDefault();
          aoConfigurar();
        }}
      >
        <span class="barra-efeitos-num">{numeroTecla}</span>
        <span class="barra-efeitos-mais">+</span>
      </div>
    );
  }

  const icone = obterIconeDoEspaco(espaco);
  const progresso = momentoAtivo && emCurso && emCurso.total > 0
    ? (emCurso.passo / emCurso.total) * 100
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      class={`barra-efeitos-botao cheio ${disparou ? 'disparado' : ''} ${momentoAtivo ? 'em-curso' : ''} ${arrastandoSobre ? 'arrastando-sobre' : ''}`}
      data-testid={`barra-espaco-${numeroTecla}`}
      title={`${numeroTecla}: ${espaco.rotulo} (clique para disparar, clique direito para editar)`}
      draggable={true}
      onDragStart={aoIniciarArrasto}
      onDragOver={aoArrastarSobre}
      onDragLeave={aoSairArrasto}
      onDrop={aoSoltar}
      onClick={aoDisparar}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          aoDisparar();
        }
      }}
      onContextMenu={e => {
        e.preventDefault();
        aoConfigurar();
      }}
    >
      <span class="barra-efeitos-num">{numeroTecla}</span>
      <Icone nome={icone} tamanho={16} />
      <span class="barra-efeitos-rotulo">{espaco.rotulo}</span>
      <button
        type="button"
        class="barra-efeitos-lapis"
        data-testid={`barra-espaco-editar-${numeroTecla}`}
        title="Editar espaço"
        aria-label={`Editar espaço ${numeroTecla}`}
        onClick={e => {
          e.stopPropagation();
          aoConfigurar();
        }}
      >
        <Icone nome="lapis" tamanho={9} />
      </button>
      {momentoAtivo && (
        <div class="barra-efeitos-progresso" style={{ width: `${progresso}%` }} />
      )}
    </div>
  );
}

export function BarraDeEfeitos({ s }: { s: SessaoDeEdicao }) {
  const [recolhida, setRecolhida] = useState(() => {
    try {
      return localStorage.getItem('atlas:barra-efeitos-recolhida') === 'true';
    } catch {
      return false;
    }
  });

  const [espacoConfigurando, setEspacoConfigurando] = useState<number | null>(null);
  const [arrastandoSobre, setArrastandoSobre] = useState<number | null>(null);

  const barra = barraDeEfeitos.value;

  const alternarRecolhida = () => {
    const nova = !recolhida;
    setRecolhida(nova);
    try {
      localStorage.setItem('atlas:barra-efeitos-recolhida', String(nova));
    } catch {
      // Ignora erro de storage
    }
  };

  const aoIniciarArrasto = (e: DragEvent, i: number) => {
    e.dataTransfer?.setData('text/plain', String(i));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const aoArrastarSobre = (e: DragEvent, i: number) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (arrastandoSobre !== i) setArrastandoSobre(i);
  };

  const aoSoltar = (e: DragEvent, destino: number) => {
    e.preventDefault();
    setArrastandoSobre(null);
    const texto = e.dataTransfer?.getData('text/plain');
    if (!texto) return;
    const origem = Number(texto);
    if (!isNaN(origem) && origem >= 0 && origem < 9 && origem !== destino) {
      trocarEspacos(origem, destino);
    }
  };

  if (recolhida) {
    return (
      <div class="barra-efeitos-container recolhida" data-testid="barra-de-efeitos">
        <button
          type="button"
          class="barra-efeitos-handle-recolhida"
          data-testid="barra-efeitos-toggle"
          onClick={alternarRecolhida}
          title="Expandir barra de efeitos (1–9)"
        >
          <Icone nome="anim" tamanho={12} />
          <span>Efeitos (1–9)</span>
          <Icone nome="chevron-cima" tamanho={12} />
        </button>
      </div>
    );
  }

  return (
    <div class="barra-efeitos-container" data-testid="barra-de-efeitos">
      <div class="barra-efeitos-grade">
        {barra.map((espaco, i) => (
          <BotaoEspaco
            key={i}
            indice={i}
            espaco={espaco}
            s={s}
            arrastandoSobre={arrastandoSobre === i}
            aoConfigurar={() => setEspacoConfigurando(i)}
            aoDisparar={() => dispararEspaco(i)}
            aoIniciarArrasto={e => aoIniciarArrasto(e, i)}
            aoArrastarSobre={e => aoArrastarSobre(e, i)}
            aoSairArrasto={() => {
              if (arrastandoSobre === i) setArrastandoSobre(null);
            }}
            aoSoltar={e => aoSoltar(e, i)}
          />
        ))}
        <button
          type="button"
          class="barra-efeitos-toggle"
          data-testid="barra-efeitos-toggle"
          onClick={alternarRecolhida}
          title="Recolher barra de efeitos"
        >
          <Icone nome="chevron-baixo" tamanho={12} />
        </button>
      </div>

      {espacoConfigurando !== null && (
        <PopoverConfiguracaoEspaco
          s={s}
          indice={espacoConfigurando}
          espaco={barra[espacoConfigurando] ?? null}
          aoSalvar={novo => {
            definirEspaco(espacoConfigurando, novo);
            setEspacoConfigurando(null);
          }}
          aoLimpar={() => {
            definirEspaco(espacoConfigurando, null);
            setEspacoConfigurando(null);
          }}
          aoFechar={() => setEspacoConfigurando(null)}
        />
      )}
    </div>
  );
}
