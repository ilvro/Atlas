import { TIPOS_DE_COMODO } from '../domain/presets.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { InsightDoComodo } from './insight.ts';

export interface Palpite { funcao: string; confianca: number; motivo: 'nome' | 'objetos' | 'tamanho' }

/** Sem acento e em minúsculas (a mesma regra da busca da paleta; `authoring` não importa `app`). */
const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const FUNCOES = new Set(TIPOS_DE_COMODO.map(t => t.funcao));

// Das mais específicas para as mais genéricas: a primeira palavra que bate decide.
const POR_NOME: readonly { palavras: string[]; funcao: string; confianca: number }[] = [
  // Pós-apocalíptico (Q22c): "acampamento", "abrigo", "bunker" e "sucata" valem soltos; "posto avançado/de guarda", "guarita", "ferro-velho" e "enfermaria improvisada" têm frase própria (ver `FRASES`).
  { palavras: ['acampamento', 'acampamentos'], funcao: 'acampamento', confianca: 0.9 },
  { palavras: ['abrigo', 'bunker', 'refugio'], funcao: 'abrigo', confianca: 0.9 },
  { palavras: ['sucata', 'sucatas'], funcao: 'oficina-de-sucata', confianca: 0.9 },
  // Cyberpunk (Q23c): "servidor(es)", "ripperdoc", "capsula(s)" e "boteco" valem soltos; "clínica clandestina/de implantes", "covil/toca hacker", "data center", "hotel cápsula", "bar de néon" e "mercado/feira noturna" têm frase própria (ver `FRASES`). "Bar" solto continua indo para a taverna (que no cyberpunk ganha balcão luminoso); "beco" não tem função: é conjunto exterior.
  { palavras: ['servidor', 'servidores', 'datacenter'], funcao: 'sala-de-servidores', confianca: 0.9 },
  { palavras: ['capsula', 'capsulas'], funcao: 'hotel-capsula', confianca: 0.9 },
  { palavras: ['ripperdoc', 'ripperdocs'], funcao: 'clinica-clandestina', confianca: 0.9 },
  { palavras: ['boteco'], funcao: 'bar', confianca: 0.9 },
  // Moderno urbano (Q21c): "lanchonete", "mercado" e "garagem" valem soltos. "Posto" sozinho é ambíguo (posto de guarda, posto avançado), então só vale em nome inteiro ou com "gasolina/combustível" (ver `FRASES`); "enfermaria" continua indo para `hospital`.
  { palavras: ['lanchonete', 'diner', 'lancheria', 'hamburgueria', 'cafeteria'], funcao: 'lanchonete', confianca: 0.9 },
  { palavras: ['supermercado', 'minimercado', 'hipermercado', 'mercado'], funcao: 'mercado', confianca: 0.9 },
  { palavras: ['garagem', 'garagens'], funcao: 'garagem', confianca: 0.9 },
  { palavras: ['vestiario'], funcao: 'vestiario', confianca: 0.9 },
  // Vitoriano (Q20c): "clube" e "dirigível" valem soltos; "fábrica", "tecelagem" e "usina" também. "Caldeira" é palavra solta de outra coisa (panela grande), então só "sala/casa da(s) caldeira(s)" vale (ver `FRASES`). "Oficina" sozinha continua a oficina comum; a de inventor tem frase própria.
  { palavras: ['fabrica', 'tecelagem', 'usina'], funcao: 'fabrica', confianca: 0.9 },
  { palavras: ['dirigivel', 'zeppelin'], funcao: 'estacao-de-dirigivel', confianca: 0.9 },
  { palavras: ['clube'], funcao: 'clube', confianca: 0.9 },
  // Colonial e pirata (Q19c): "convés" e "cabine" só valem em nome inteiro (a cabine do capitão tem frase própria); "forte" sozinho é adjetivo, então só "fortim" e "fortaleza" valem solto. "Enseada" é exterior (conjunto de espalhar), não cômodo.
  { palavras: ['conves'], funcao: 'conves', confianca: 0.9 },
  { palavras: ['fortim', 'fortaleza', 'baluarte'], funcao: 'fortim', confianca: 0.9 },
  // Faroeste (Q18c): "banco" e "armazém" sozinhos já têm outro sentido (banco de sentar, depósito), então esses vão em `FRASES`. "Rancho" é o estábulo.
  { palavras: ['saloon', 'saloons'], funcao: 'saloon', confianca: 0.9 },
  { palavras: ['xerife', 'xerifado', 'delegacia'], funcao: 'xerifado', confianca: 0.9 },
  { palavras: ['emporio'], funcao: 'armazem-geral', confianca: 0.9 },
  { palavras: ['estacao', 'ferroviaria'], funcao: 'estacao', confianca: 0.9 },
  { palavras: ['rancho', 'curral'], funcao: 'estabulo', confianca: 0.9 },
  // Deserto (Q17c): "caravançará" (pátio de pouso das caravanas) e "oásis" dão o pátio com fonte; "salão de chá" é uma frase (ver `FRASES`), porque `cha` é da casa de chá.
  { palavras: ['tenda', 'beduina', 'beduino'], funcao: 'tenda', confianca: 0.9 },
  { palavras: ['bazar', 'souk', 'souq', 'suq'], funcao: 'bazar', confianca: 0.9 },
  { palavras: ['majlis', 'hortela'], funcao: 'salao-de-cha', confianca: 0.9 },
  { palavras: ['oasis', 'caravancara', 'caravanserai', 'caravanserail'], funcao: 'patio-com-fonte', confianca: 0.9 },
  // Oriental (Q16c): antes do templo, para "templo xintoísta" ser santuário.
  { palavras: ['santuario', 'jinja', 'xintoista'], funcao: 'santuario', confianca: 0.9 },
  { palavras: ['tatami', 'washitsu'], funcao: 'sala-de-tatami', confianca: 0.9 },
  { palavras: ['cha', 'chashitsu'], funcao: 'casa-de-cha', confianca: 0.9 },
  { palavras: ['dojo'], funcao: 'dojo', confianca: 0.9 },
  { palavras: ['jardim', 'jardins'], funcao: 'jardim', confianca: 0.9 },
  { palavras: ['atrio'], funcao: 'atrio', confianca: 0.9 },
  { palavras: ['peristilo'], funcao: 'peristilo', confianca: 0.9 },
  { palavras: ['triclinio'], funcao: 'triclinio', confianca: 0.9 },
  { palavras: ['termas', 'terma', 'balneario'], funcao: 'termas', confianca: 0.9 },
  { palavras: ['templo', 'delubro'], funcao: 'templo', confianca: 0.9 },
  { palavras: ['forum', 'agora'], funcao: 'forum', confianca: 0.9 },
  { palavras: ['taberna', 'termopolio'], funcao: 'taberna', confianca: 0.9 },
  { palavras: ['cozinha', 'copa'], funcao: 'cozinha', confianca: 0.9 },
  { palavras: ['quarto', 'suite', 'alcova'], funcao: 'quarto', confianca: 0.9 },
  { palavras: ['dormitorio', 'alojamento', 'quartel'], funcao: 'dormitorio', confianca: 0.9 },
  { palavras: ['biblioteca'], funcao: 'biblioteca', confianca: 0.9 },
  { palavras: ['escritorio', 'gabinete', 'estudo'], funcao: 'escritorio', confianca: 0.9 },
  { palavras: ['banheiro', 'lavabo', 'banho', 'wc'], funcao: 'banheiro', confianca: 0.9 },
  { palavras: ['corredor', 'hall', 'passagem', 'vestibulo'], funcao: 'corredor', confianca: 0.9 },
  { palavras: ['enfermaria', 'consultorio', 'hospital'], funcao: 'hospital', confianca: 0.9 },
  { palavras: ['taverna', 'bar', 'estalagem', 'pub'], funcao: 'taverna', confianca: 0.9 },
  { palavras: ['varanda', 'terraco', 'sacada', 'alpendre'], funcao: 'varanda', confianca: 0.9 },
  { palavras: ['patio', 'quintal'], funcao: 'patio', confianca: 0.9 },
  { palavras: ['capela', 'igreja'], funcao: 'capela', confianca: 0.9 },
  { palavras: ['forja', 'ferraria'], funcao: 'forja', confianca: 0.9 },
  { palavras: ['oficina', 'carpintaria'], funcao: 'oficina', confianca: 0.9 },
  { palavras: ['estabulo', 'cocheira'], funcao: 'estabulo', confianca: 0.9 },
  { palavras: ['celeiro', 'paiol'], funcao: 'celeiro', confianca: 0.9 },
  { palavras: ['deposito', 'armazem', 'almoxarifado'], funcao: 'deposito', confianca: 0.9 },
  { palavras: ['loja', 'mercearia', 'botica', 'venda'], funcao: 'loja', confianca: 0.9 },
  { palavras: ['cela', 'prisao', 'calabouco'], funcao: 'cela', confianca: 0.9 },
  { palavras: ['porao', 'adega', 'cripta'], funcao: 'porao', confianca: 0.9 },
  { palavras: ['jantar'], funcao: 'sala-de-jantar', confianca: 0.9 },
  { palavras: ['refeitorio', 'cantina'], funcao: 'refeitorio', confianca: 0.9 },
  { palavras: ['jogos', 'bilhar', 'sinuca', 'fumar'], funcao: 'sala-de-jogos', confianca: 0.9 },
  { palavras: ['salao', 'comunal'], funcao: 'salao', confianca: 0.9 },
  { palavras: ['estar'], funcao: 'sala', confianca: 0.9 },
];
/** Frases que valem mais que as palavras soltas ("salão de chá" não é "casa de chá"); vêm antes de `POR_NOME`. */
const FRASES: readonly { frase: RegExp; funcao: string; confianca: number }[] = [
  { frase: /\bclinica (clandestina|de implantes?|de cromo|do submundo|ilegal)\b|\b(consultorio|cirurgia) clandestin[oa]\b/, funcao: 'clinica-clandestina', confianca: 0.9 },
  { frase: /\b(covil|toca|esconderijo|quarto|sala) (do |de |dos |da )?hackers?\b|\bdata center\b|\bsala (de |dos? )?(servidores|racks)\b|\bcentro de dados\b/, funcao: 'sala-de-servidores', confianca: 0.9 },
  { frase: /\bhotel (de )?capsulas?\b|\bmotel (de )?capsulas?\b/, funcao: 'hotel-capsula', confianca: 0.9 },
  { frase: /\bbar (de |do |da )?(neon|hacker|hackers|cyber|cyberpunk|implantes?|baixo mundo|submundo)\b|\bneon bar\b/, funcao: 'bar', confianca: 0.9 },
  { frase: /\b(mercado|feira|bazar|camelodromo) noturn[oa]\b|\bmercado (de rua|negro|clandestino)\b/, funcao: 'mercado-noturno', confianca: 0.9 },
  { frase: /\b(enfermaria|clinica|hospital) (improvisad[oa]|de campanha)\b/, funcao: 'enfermaria-improvisada', confianca: 0.9 },
  { frase: /\bposto (avancado|de guarda|de vigia|de sentinela|de controle)\b|\bguarita\b|\bcheckpoint\b/, funcao: 'posto-de-guarda', confianca: 0.9 },
  { frase: /\bferro velho\b|\boficina de sucata\b/, funcao: 'oficina-de-sucata', confianca: 0.9 },
  { frase: /^posto( \d+)?$|\bposto (de |da )?(gasolina|combustivel|combustiveis|abastecimento|servico|servicos)\b|\bloja de conveniencia\b|\bconveniencia\b/, funcao: 'posto', confianca: 0.9 },
  { frase: /\b(oficina|laboratorio|atelie) (do|de) inventor\b|\boficina (de )?invencoes\b|\boficina steampunk\b/, funcao: 'oficina-de-inventor', confianca: 0.9 },
  { frase: /\b(sala|casa) (da|das|de) caldeiras?\b/, funcao: 'fabrica', confianca: 0.9 },
  { frase: /\bcabine (do|de) (capitao|comandante)\b|\bcamarote (do|de) (capitao|comandante)\b|^cabine( \d+)?$/, funcao: 'cabine-do-capitao', confianca: 0.9 },
  { frase: /\btaverna (do|de) porto\b|\btaverna do (cais|porto)\b|\btaverna (pirata|dos piratas)\b/, funcao: 'taverna-do-porto', confianca: 0.9 },
  { frase: /^forte( \d+)?$|\bforte (de|do|da|dos|das|real|velho|sao|santo|santa)\b/, funcao: 'fortim', confianca: 0.9 },
  { frase: /\bcasa (colonial|grande|de engenho)\b|\bsobrado colonial\b/, funcao: 'casa-colonial', confianca: 0.9 },
  { frase: /\barmazem(ns)? (geral|gerais)\b/, funcao: 'armazem-geral', confianca: 0.9 },
  { frase: /^banco( \d+)?$|\bbanco (da|do|de|nacional|federal|comercial|rural) (fronteira|cidade|oeste|povoado|vila|comercio|agricultura|[a-z]+ city)\b|\bbanco (nacional|federal|comercial|rural)\b/, funcao: 'banco', confianca: 0.9 },
  { frase: /\bsalao(es)? de cha\b/, funcao: 'salao-de-cha', confianca: 0.9 },
  { frase: /\bpatio com fonte\b/, funcao: 'patio-com-fonte', confianca: 0.9 },
];
const CONHECIDAS = new Set(POR_NOME.flatMap(r => r.palavras));
const LIGACOES = new Set(['de', 'do', 'da', 'dos', 'das']);
const bate = (palavra: string, chave: string) => palavra === chave || palavra === `${chave}s`;

/** Pelo nome: "Cozinha", "Quarto do Hugo", "Sala de jantar". "Sala" sozinha vale menos, e "sala de <coisa desconhecida>" não é sala. */
function pelaNome(nome: string): Palpite | null {
  const palavras = normalizar(nome).split(/[^a-z0-9]+/).filter(Boolean);
  const normal = palavras.join(' ');
  for (const f of FRASES) if (f.frase.test(normal)) return { funcao: f.funcao, confianca: f.confianca, motivo: 'nome' };
  for (const regra of POR_NOME) if (palavras.some(p => regra.palavras.some(k => bate(p, k)))) return { funcao: regra.funcao, confianca: regra.confianca, motivo: 'nome' };
  const i = palavras.findIndex(p => bate(p, 'sala'));
  if (i < 0) return null;
  if (LIGACOES.has(palavras[i + 1] ?? '') && palavras[i + 2] && !CONHECIDAS.has(palavras[i + 2]!)) return null;
  return { funcao: 'sala', confianca: 0.6, motivo: 'nome' };
}

// Sinais fortes: ter isto basta para a função (vale 3 votos).
const FORTES: readonly [(receita: string) => boolean, string][] = [
  [r => r.startsWith('cama.'), 'quarto'], [r => r === 'balcao', 'cozinha'], [r => r === 'estante' || r === 'estante.piso', 'biblioteca'], [r => r === 'escrivaninha' || r === 'escrivaninha.verde', 'escritorio'], [r => r === 'piano.cauda', 'sala'], [r => r === 'mesa.bilhar', 'sala-de-jogos'], [r => r === 'banheira.pes', 'banheiro'], [r => r === 'mesa.oval', 'sala-de-jantar'], [r => r === 'altar', 'capela'], [r => r === 'balaustrada' || r === 'escada.externa' || r === 'fonte', 'varanda'], [r => r === 'bigorna', 'forja'],
];
const FUNCOES_DA_RECEITA = new Map(ACERVO.lista().map(r => [r.id, r.funcoes]));

/** Pelos objetos: cada um vota nas funções da sua receita. */
function pelosObjetos(ins: InsightDoComodo): Palpite | null {
  const votos = new Map<string, number>(); let total = 0, contados = 0;
  for (const o of ins.objetos) {
    if (!o.receita) continue;
    const forte = FORTES.find(([ehForte]) => ehForte(o.receita!));
    const funcoes = FUNCOES_DA_RECEITA.get(o.receita) ?? [];
    if (!forte && !funcoes.length) continue;
    contados++;
    if (forte) { votos.set(forte[1], (votos.get(forte[1]) ?? 0) + 3); total += 3; continue; }
    for (const f of funcoes) { if (FUNCOES.has(f)) votos.set(f, (votos.get(f) ?? 0) + 1 / funcoes.length); }
    total += funcoes.filter(f => FUNCOES.has(f)).length / funcoes.length;
  }
  if (!total) return null;
  const [funcao, v] = [...votos].sort((a, b) => b[1] - a[1])[0]!;
  return { funcao, confianca: (v / total) * Math.min(1, contados / 3), motivo: 'objetos' };
}

function peloTamanho(ins: InsightDoComodo): Palpite | null {
  const w = ins.caixa.x1 - ins.caixa.x0, h = ins.caixa.y1 - ins.caixa.y0, menor = Math.min(w, h), maior = Math.max(w, h);
  if (menor > 0 && maior / menor >= 3 && menor <= 2) return { funcao: 'corredor', confianca: 0.5, motivo: 'tamanho' };
  if (ins.area <= 5) return { funcao: 'banheiro', confianca: 0.35, motivo: 'tamanho' };
  return null;
}

/** Para que serve o cômodo, com um grau de confiança: nome (≥ 0,6), depois objetos (≥ 0,5), depois tamanho. Só devolve funções de `TIPOS_DE_COMODO`. */
export function funcaoProvavel(ins: InsightDoComodo): Palpite | null {
  const nome = pelaNome(ins.nome); if (nome && nome.confianca >= 0.6) return nome;
  const objetos = pelosObjetos(ins); if (objetos && objetos.confianca >= 0.5) return objetos;
  return peloTamanho(ins);
}
