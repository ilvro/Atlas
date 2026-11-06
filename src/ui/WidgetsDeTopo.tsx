import { useState, useEffect } from 'preact/hooks';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import {
  formatarCronometro,
  avancarHorario,
  carregarContador,
  salvarContador,
  estadoCronometro,
  type ContadorDramatico,
} from '../domain/relogio.ts';
import { ceuNoHorario } from '../domain/clima.ts';
import { tocar } from '../fx/som.ts';
import { tentar } from './campos.tsx';

let intervaloCronometro: ReturnType<typeof setInterval> | null = null;

function sincronizarIntervalo(rodando: boolean) {
  if (rodando) {
    if (!intervaloCronometro && typeof setInterval !== 'undefined') {
      intervaloCronometro = setInterval(() => {
        estadoCronometro.value = {
          ...estadoCronometro.peek(),
          segundos: estadoCronometro.peek().segundos + 1,
        };
      }, 1000);
    }
  } else if (intervaloCronometro) {
    clearInterval(intervaloCronometro);
    intervaloCronometro = null;
  }
}

/** Pílula do Contador Dramático: contador customizável (Pavor, Tensão, etc.) por mapa. */
function WidgetContador({ mapaId }: { mapaId: string }) {
  const [contador, setContador] = useState<ContadorDramatico>(() => carregarContador(mapaId));
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(contador.rotulo);

  useEffect(() => {
    const dados = carregarContador(mapaId);
    setContador(dados);
    setTextoEdit(dados.rotulo);
    setEditando(false);
  }, [mapaId]);

  const incrementar = (e?: Event) => {
    e?.stopPropagation();
    const proximo = { ...contador, valor: contador.valor + 1 };
    setContador(proximo);
    salvarContador(mapaId, proximo);
    tocar('pop');
  };

  const decrementar = (e?: Event) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (contador.valor <= 0) return;
    const proximo = { ...contador, valor: Math.max(0, contador.valor - 1) };
    setContador(proximo);
    salvarContador(mapaId, proximo);
    tocar('pop');
  };

  const confirmarRotulo = (novo: string) => {
    const limpo = novo.trim() || 'Tensão';
    const proximo = { ...contador, rotulo: limpo };
    setContador(proximo);
    salvarContador(mapaId, proximo);
    setEditando(false);
  };

  return (
    <div
      class="widget-pilula widget-contador"
      data-testid="widget-contador"
      onContextMenu={(e) => decrementar(e)}
      title="Clique esquerdo ou (+) para somar, direito ou (-) para subtrair, rótulo para renomear"
    >
      {editando ? (
        <input
          type="text"
          class="contador-input-rotulo"
          data-testid="contador-input-rotulo"
          value={textoEdit}
          autoFocus
          onInput={(e) => setTextoEdit((e.target as HTMLInputElement).value)}
          onBlur={(e) => confirmarRotulo((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmarRotulo((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') {
              setTextoEdit(contador.rotulo);
              setEditando(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          class="contador-rotulo"
          data-testid="contador-rotulo"
          onClick={(e) => {
            e.stopPropagation();
            setEditando(true);
          }}
          title="Renomear contador (ex: Tensão, Pavor, Alerta)"
        >
          {contador.rotulo}
        </button>
      )}

      <button
        type="button"
        class="contador-btn"
        data-testid="contador-menos"
        onClick={(e) => decrementar(e)}
        title="Subtrair 1 (−)"
      >
        −
      </button>

      <span
        class="contador-valor"
        data-testid="contador-valor"
        onClick={(e) => incrementar(e)}
        title="Clique esquerdo para somar (+1), clique direito para subtrair (-1)"
      >
        {contador.valor}
      </span>

      <button
        type="button"
        class="contador-btn"
        data-testid="contador-mais"
        onClick={(e) => incrementar(e)}
        title="Somar 1 (+)"
      >
        +
      </button>
    </div>
  );
}

/** Pílula do Tempo: alterna entre Cronômetro da cena e Hora do mundo (avanço de sol/lua). */
function WidgetTempo({ s }: { s: SessaoDeEdicao }) {
  const [modoTempo, setModoTempo] = useState<'cronometro' | 'mundo'>('cronometro');
  const crono = estadoCronometro.value;
  const horario = s.doc.value.climate.time;

  let noite = false;
  try {
    noite = ceuNoHorario(horario).noite;
  } catch {
    noite = false;
  }

  useEffect(() => {
    sincronizarIntervalo(crono.rodando);
  }, [crono.rodando]);

  const alternarModo = () => {
    setModoTempo((m) => (m === 'cronometro' ? 'mundo' : 'cronometro'));
    tocar('pop');
  };

  const alternarCronometro = (e: MouseEvent) => {
    e.stopPropagation();
    const proximoRodando = !estadoCronometro.peek().rodando;
    estadoCronometro.value = {
      ...estadoCronometro.peek(),
      rodando: proximoRodando,
    };
    sincronizarIntervalo(proximoRodando);
    tocar('pop');
  };

  const zerarCronometro = (e?: MouseEvent) => {
    e?.stopPropagation();
    estadoCronometro.value = { segundos: 0, rodando: false };
    sincronizarIntervalo(false);
    tocar('pop');
  };

  const avancarMinutos = (mins: number, rotulo: string) => {
    const atual = s.doc.value.climate.time;
    const novo = avancarHorario(atual, mins);
    tentar(() =>
      s.store.executar(
        { tipo: 'clima.aplicar', patch: { time: novo } as never },
        { rotulo },
      ),
    );
    tocar('pop');
  };

  return (
    <div class="widget-pilula widget-tempo" data-testid="widget-tempo">
      <button
        type="button"
        class={`tempo-alternar-modo ${modoTempo === 'cronometro' ? 'cronometro' : 'mundo'}`}
        data-testid="tempo-alternar-modo"
        onClick={alternarModo}
        title={
          modoTempo === 'cronometro'
            ? 'Alternar para Hora do Mundo (sol/lua)'
            : 'Alternar para Cronômetro da Cena'
        }
      >
        {modoTempo === 'cronometro' ? '⏱️' : noite ? '🌙' : '☀️'}
      </button>

      {modoTempo === 'cronometro' ? (
        <div class="tempo-corpo-cronometro">
          <button
            type="button"
            class={`cronometro-display ${crono.rodando ? 'rodando' : ''}`}
            data-testid="cronometro-display"
            onClick={alternarCronometro}
            onDblClick={zerarCronometro}
            title={crono.rodando ? 'Clique para pausar, duplo-clique para zerar' : 'Clique para iniciar, duplo-clique para zerar'}
          >
            <span class="cronometro-ponto" />
            <span>{formatarCronometro(crono.segundos)}</span>
          </button>
          <button
            type="button"
            class="cronometro-zerar"
            data-testid="cronometro-zerar"
            onClick={zerarCronometro}
            title="Zerar cronômetro (↺)"
          >
            ↺
          </button>
        </div>
      ) : (
        <div class="tempo-corpo-mundo">
          <span
            class="hora-mundo-display"
            data-testid="hora-mundo-display"
            title={`Horário do mundo: ${horario} (${noite ? 'Noite' : 'Dia'})`}
          >
            {horario}
          </span>
          <button
            type="button"
            class="tempo-btn-passo"
            data-testid="tempo-mais-15m"
            onClick={() => avancarMinutos(15, 'Avançar 15 min')}
            title="Avançar 15 minutos no horário do mapa"
          >
            +15m
          </button>
          <button
            type="button"
            class="tempo-btn-passo"
            data-testid="tempo-mais-1h"
            onClick={() => avancarMinutos(60, 'Avançar 1 hora')}
            title="Avançar 1 hora no horário do mapa"
          >
            +1h
          </button>
        </div>
      )}
    </div>
  );
}

/** Widgets flutuantes no canto superior direito da área do mapa. */
export function WidgetsDeTopo({ s }: { s: SessaoDeEdicao }) {
  const mapaId = s.doc.value.id;
  return (
    <aside class="widgets-de-topo" aria-label="Widgets de Sessão">
      <WidgetContador mapaId={mapaId} />
      <WidgetTempo s={s} />
    </aside>
  );
}
