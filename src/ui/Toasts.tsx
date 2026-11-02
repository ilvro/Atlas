import { fecharToast, pausarToast, retomarToast, toasts } from '../app/toasts.ts';

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite" data-testid="toasts">
      {toasts.value.map(t => (
        <div key={t.id} class={`toast ${t.tipo}`} onMouseEnter={() => pausarToast(t.id)} onMouseLeave={() => retomarToast(t.id)}>
          <span class="toast-texto">{t.texto}</span>
          {t.acao && <button type="button" class="toast-acao" onClick={() => { t.acao!.fazer(); fecharToast(t.id); }}>{t.acao.rotulo}</button>}
          <button type="button" class="toast-fechar" aria-label="Fechar aviso" onClick={() => fecharToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
