/**
 * `?embutido=1` no endereço: o Atlas dentro de outro aplicativo da mesa (o modo sessão da Mesa, num `iframe` da mesma origem).
 * Esconde a galeria e o cabeçalho grande, abre cada mapa direto em Sessão e não deixa voltar a Construir; o projetor continua
 * a um botão. O mapa vem do endereço (`#/mapa/<id>`) ou de um pedido `atlas.focar`. Lido uma vez, ao carregar a página.
 */
export const embutido: boolean = (() => { try { return new URLSearchParams(location.search).get('embutido') === '1'; } catch { return false; } })();
