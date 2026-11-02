import '@fontsource-variable/hanken-grotesk';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/special-elite';
import './ui/estilo.css';
import { render } from 'preact';
import { sessao, servicos, viewport } from './app/app.ts';
import { App } from './ui/App.tsx';

render(<App />, document.getElementById('raiz')!);

// Gancho de diagnóstico para os testes e para a depuração: só em desenvolvimento ou com `?diagnostico` na endereço.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('diagnostico')) {
  Object.defineProperty(window, '__atlas', { value: Object.freeze({ sessao: () => sessao.value, servicos: () => servicos.value, viewport: () => viewport.atual }), configurable: true });
}
