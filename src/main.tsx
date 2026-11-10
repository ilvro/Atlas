import '@fontsource-variable/hanken-grotesk';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/special-elite';
import '@fontsource/pixelify-sans/700.css';
import './ui/estilo.css';
import { render } from 'preact';
import { sessao, servicos, viewport } from './app/app.ts';
import { tutor } from './app/tutoriais.ts';
import { App } from './ui/App.tsx';

render(<App />, document.getElementById('raiz')!);

/** Mede os quadros por segundo durante `ms`: média e o 5º percentil (os piores 5% dos quadros), para os testes de desempenho. */
function fps(ms: number): Promise<{ media: number; p5: number; quadros: number }> {
  return new Promise(resolver => {
    const duracoes: number[] = []; let ultimo = performance.now(); const inicio = ultimo;
    const quadro = (agora: number) => {
      duracoes.push(agora - ultimo); ultimo = agora;
      if (agora - inicio < ms) { requestAnimationFrame(quadro); return; }
      const d = duracoes.slice(1), taxas = d.map(x => 1000 / Math.max(1, x)).sort((a, b) => a - b);
      resolver({ media: d.length ? 1000 / (d.reduce((a, b) => a + b, 0) / d.length) : 0, p5: taxas[Math.floor(taxas.length * 0.05)] ?? 0, quadros: d.length });
    };
    requestAnimationFrame(quadro);
  });
}

// Gancho de diagnóstico para os testes e para a depuração: só em desenvolvimento ou com `?diagnostico` na endereço.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('diagnostico')) {
  Object.defineProperty(window, '__atlas', { value: Object.freeze({ sessao: () => sessao.value, servicos: () => servicos.value, viewport: () => viewport.atual, tutor, fps }), configurable: true });
}

// Ponte do assistente (em desenvolvimento e no app de desktop; não existe no build do Pages).
if (import.meta.env.DEV || import.meta.env.VITE_PONTE === '1') void import('./app/ponte.ts');
