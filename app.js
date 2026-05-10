// =====================================================================
// PROSPECT & CIA. v3 — Base de prospecção persistente (Email + WhatsApp)
// =====================================================================
// Pipeline:
// 1. Aluno cadastra identidade (nome + título profissional)
// 2. Aluno importa CSV da Casa dos Dados (pode importar vários)
// 3. App deduplica por CNPJ+email, classifica qualidade do email,
//    detecta perfil (advocacia/contabilidade/sindicato), detecta se
//    telefone tem WhatsApp (celular 11 dígitos com 8 ou 9), persiste em LS
// 4. Score combinado = max(scoreEmail, scoreWa). Lote esconde RUIM+MORTO.
// 5. Cada contato tem dois canais:
//      - Email (mailto com Gmail/Outlook)
//      - WhatsApp (wa.me com mensagem SPIN do perfil — só se temWhats)
// 6. Aluno marca como contatado / pula — tudo persiste
// 7. Pode exportar Excel a qualquer momento
// =====================================================================

const STORAGE_KEY = 'prospect_cia_v3';
const STATE_VERSION = 3;

// ---------- TEMPLATES PADRÃO ----------
// Emails SPIN longos por perfil: Situação → Problema → Implicação → Necessidade
const DEFAULT_TEMPLATE_EMAIL = {
  advocacia: {
    subject: 'A liquidação como diferencial competitivo da {{razao}}',
    body: `Prezados da {{razao}},

Sou {{eu_nome}}, {{eu_titulo}}. Estou prospectando escritórios trabalhistas em {{cidade}}/{{uf}} para uma conversa específica sobre fase de execução, e gostaria de apresentar meu trabalho.

A maior parte dos escritórios trabalhistas concentra esforço técnico na fase de conhecimento, na construção da inicial, na produção da prova e na sustentação oral. Faz sentido, é o momento em que se constrói o direito. O problema é que, transitada em julgado a sentença favorável, a fase de liquidação chega como se fosse mero trâmite operacional, e o cálculo da parte contrária é aceito sem análise técnica fundamentada.

E é exatamente nessa fase que se perde parcela significativa do que foi conquistado. Erro de base de cálculo, atualização monetária aplicada com índice equivocado, FGTS sem reflexos corretos, juros calculados de forma simples quando deveriam ser compostos, integração de habituais ignorada, períodos prescritos não excluídos. Não são erros que aparecem nos manuais, são erros que só quem trabalha com cálculo todo dia identifica. E a consequência prática é dupla: o cliente recebe menos do que tinha direito, e o escritório recebe honorários proporcionalmente menores sobre um valor reduzido.

Há outra vertente do mesmo problema. Quando a parte adversa apresenta cálculo da liquidação, sem impugnação técnica fundamentada o juiz homologa, e a partir daí a discussão fica restrita a embargos, agravo e ação rescisória, instâncias em que o ônus argumentativo é muito maior. A janela para corrigir o cálculo é exatamente a impugnação à sentença de liquidação, e ela exige domínio técnico específico.

O que ofereço à {{razao}} é precisamente esse braço técnico. Trabalho com cálculos em PJeCalc, pareceres no padrão TRT, impugnações fundamentadas a cálculos da parte contrária, análise crítica de laudos periciais de liquidação e suporte técnico em embargos e agravos. Atendo de forma pontual (por intervenção) ou em parceria recorrente, dependendo do volume e do perfil do escritório.

Caso faça sentido, posso enviar amostras de trabalhos anteriores e marcamos uma conversa rápida para entender o fluxo da {{razao}} na fase de execução.

Atenciosamente,
{{eu_nome}}
{{eu_titulo}}`
  },

  contabilidade: {
    subject: 'Cálculo trabalhista como serviço da {{razao}} — proposta de parceria',
    body: `Prezados da {{razao}},

Sou {{eu_nome}}, {{eu_titulo}}. Estou prospectando escritórios contábeis em {{cidade}}/{{uf}} com uma proposta de parceria específica que pode fazer sentido para a carteira de vocês.

Escritório contábil é o profissional de maior confiança da empresa cliente. Folha, obrigações fiscais, declarações, retenções, eSocial, tudo passa pelas mãos de vocês. A empresa liga primeiro para a contabilidade quando aparece qualquer questão administrativa ou fiscal. E é exatamente isso que cria a oportunidade que estou trazendo.

Quando uma empresa cliente da {{razao}} é citada em uma reclamação trabalhista, ela inevitavelmente vai precisar de cálculos. Cálculo de provisão para o balanço, cálculo de proposta de acordo, cálculo de impugnação ao valor pretendido pelo reclamante, cálculo de liquidação se for vencida, cálculo para acordo na execução. Esses cálculos não são folha de pagamento comum, são técnica jurídica aplicada a cálculo, com regras de prescrição, integração de habituais, base do FGTS específica, atualização monetária por índice próprio da Justiça do Trabalho. A maioria das contabilidades não calcula isso porque foge do escopo, e a empresa fica órfã num momento crítico.

O que acontece na prática é que a empresa busca o calculista por conta própria, normalmente por indicação do advogado da outra ponta, e a contabilidade perde a oportunidade de manter o cliente dentro de casa naquele momento de maior necessidade. Pior, em muitos casos a empresa contesta valores no processo com base em cálculo mal feito e termina pagando mais por causa de uma defesa técnica frágil.

A proposta é simples. Vocês indicam a {{razao}} como ponte técnica para esses cálculos quando aparece a demanda, e mantemos uma estrutura de parceria, com divisão do honorário ou repasse percentual, conforme o que fizer sentido para vocês. Sem custo de estrutura, sem necessidade de contratação, e o cliente não sai do guarda-chuva da contabilidade.

Posso enviar uma proposta detalhada de parceria e amostras de trabalho. Vale uma conversa rápida?

Atenciosamente,
{{eu_nome}}
{{eu_titulo}}`
  },

  sindicato: {
    subject: 'Cumprimento de sentença coletiva: a fase em que o sindicato perde no detalhe',
    body: `Prezados da {{razao}},

Sou {{eu_nome}}, {{eu_titulo}}. Estou prospectando entidades sindicais em {{cidade}}/{{uf}} para uma conversa muito específica sobre uma fase processual em que, na minha experiência, os sindicatos perdem parcela importante do que conquistaram. Espero que faça sentido para a {{razao}}.

A ação coletiva é a grande ferramenta do sindicato. Substituição processual de centenas, às vezes milhares de trabalhadores, tese única, sentença que reconhece o direito e abre o caminho para que cada substituído receba. É no mérito que o sindicato investe, e é no mérito que vence. Mas o que acontece depois disso é, na minha leitura, o calcanhar de Aquiles do trabalho sindical contemporâneo.

O sindicato ganha a tese, transita em julgado, e a partir daí cada substituído precisa promover o cumprimento de sentença individualmente, com cálculo próprio e impugnação aos cálculos apresentados pela ré. Esse é um trabalho técnico massivo. São centenas de cálculos, cada um com particularidades próprias do trabalhador (período em que esteve na empresa, função, salário base, jornada efetiva, prescrição quinquenal específica), e do outro lado a ré apresenta cálculo padronizado tentando aplicar a sentença pelo menor valor possível. Sem impugnação técnica fundamentada, o juiz homologa o cálculo da ré, e o trabalhador substituído recebe uma fração do que tinha direito.

A implicação prática é que a {{razao}} ganha no mérito, recebe o reconhecimento jurídico, mas a categoria não recebe o valor proporcional à vitória. E pior, o trabalhador substituído frequentemente não tem como contratar um advogado particular para a fase de cumprimento, porque o valor individual não comporta o honorário, e acaba assinando o que aparece. O resultado é o paradoxo de uma ação coletiva ganha que se converte, na ponta, em pagamento minimalista.

O que proponho à {{razao}} é precisamente um suporte técnico estruturado para essa fase. Cálculos individualizados de cumprimento de sentença para os substituídos, impugnações fundamentadas aos cálculos apresentados pela ré, análise crítica de laudos periciais de liquidação coletiva, e suporte técnico em embargos à execução e agravos de petição. Trabalho com cálculos em PJeCalc e produzo pareceres no padrão TRT.

Posso atender por intervenção, por lote (por exemplo, todos os substituídos de uma mesma ação) ou em parceria recorrente. Caso faça sentido, envio amostras e propostas e marcamos uma conversa.

Atenciosamente,
{{eu_nome}}
{{eu_titulo}}`
  }
};

// Templates SPIN — 3 perfis × 3 variações (rotação por contato)
const DEFAULT_TEMPLATE_WA = {
  advocacia: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Uma pergunta direta pra {{razao}}: quando chega o cálculo da parte contrária na fase de execução, quem faz a análise técnica antes de aceitar o valor?

Pergunto porque erro de base, atualização equivocada, FGTS sem reflexos corretos e juros mal aplicados são muito mais comuns do que parecem. E sem impugnação fundamentada, o juiz homologa o cálculo da ré e o crédito do cliente cai. O escritório recebe honorário sobre um valor reduzido, e a vitória no mérito vira pagamento parcial.

Trabalho exatamente nessa fase. Se fizer sentido, fico à disposição pra uma conversa rápida.`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Vejo com frequência um padrão entre escritórios trabalhistas: o processo é bem conduzido, a sentença sai favorável, mas quando o cálculo de liquidação chega da outra parte ele é aceito sem impugnação técnica.

E aí está o ponto cego. A janela pra corrigir o cálculo é a impugnação à sentença de liquidação. Depois dela, a discussão fica restrita a embargos e agravo, com ônus argumentativo muito maior. O cliente recebe menos, o honorário sobre o êxito reduz, e o escritório nem sempre identifica que isso aconteceu.

A {{razao}} já passou por essa situação? Posso mostrar como trabalho nessa fase.`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Pergunta pra {{razao}}: quando o cliente chega na fase de execução, quem cuida da parte técnica dos cálculos no escritório?

Esse costuma ser o ponto onde o resultado real do processo se decide. A diferença entre aceitar o cálculo da ré ou impugná-lo com fundamento técnico costuma representar parcela importante do crédito do cliente, e consequentemente do honorário do escritório.

Trabalho com cálculos em PJeCalc, impugnações fundamentadas e pareceres no padrão TRT. Se quiser trocar uma ideia sobre como isso funciona na prática, estou à disposição.`
  ],

  contabilidade: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Tenho uma proposta de parceria que pode fazer sentido pra {{razao}}. Quando uma das empresas atendidas por vocês é citada numa reclamação trabalhista, ela vai precisar de cálculo de provisão, cálculo pra acordo, cálculo de impugnação ao valor pretendido, cálculo de liquidação. Esse cálculo não é folha comum, é técnica jurídica aplicada, com regras de prescrição, integração de habituais, base do FGTS específica e atualização própria da Justiça do Trabalho.

A maioria das contabilidades não calcula isso, e a empresa vai buscar fora, geralmente por indicação do advogado da outra parte. A contabilidade perde a posição de fornecedor único da empresa no momento de maior necessidade.

A proposta é simples: vocês indicam, eu calculo, e o cliente fica dentro do guarda-chuva da {{razao}}. Vale uma conversa?`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Pergunta rápida pra {{razao}}: quando uma empresa cliente de vocês enfrenta uma ação trabalhista, pra onde vai a parte dos cálculos?

Pergunto porque a contabilidade já tem a confiança do cliente pra folha e obrigações fiscais, mas o cálculo trabalhista de processo costuma ficar fora do escopo. O que acontece é que o cliente vai buscar fora num momento delicado, e às vezes contesta o valor pretendido com base em cálculo mal feito, terminando por pagar mais por causa de uma defesa técnica frágil.

Trabalho exatamente com isso, e a parceria pode fazer com que esses cálculos passem a ser oferecidos pela {{razao}} sem custo de estrutura. Vale uma conversa direta?`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Boa parte dos escritórios contábeis que adicionaram cálculo trabalhista como serviço de parceria aumentou o ticket médio por cliente sem precisar contratar ninguém novo. A lógica é direta: a {{razao}} já tem a empresa como cliente, quando ela é citada numa ação trabalhista o serviço pode ser entregue com o nome de vocês por trás e o meu trabalho técnico por baixo.

O ponto que costuma fechar a conversa é entender o volume de empresas-cliente da {{razao}} e o histórico de demandas trabalhistas dessa carteira. Posso explicar como estrutura de parceria funciona em 10 minutos. Vale uma conversa?`
  ],

  sindicato: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Pergunta pra {{razao}}: depois que a ação coletiva transita em julgado, como o sindicato organiza o cumprimento de sentença individual de cada substituído?

Pergunto porque esse costuma ser o calcanhar de Aquiles do trabalho sindical. A {{razao}} ganha a tese, mas cada substituído precisa promover o cumprimento individual com cálculo próprio e impugnação aos valores apresentados pela ré. São centenas de cálculos, cada um com particularidades do trabalhador, e do outro lado a ré apresenta cálculo padronizado tentando aplicar a sentença pelo menor valor possível.

Sem impugnação técnica fundamentada, o juiz homologa, e o trabalhador substituído recebe uma fração do que tinha direito. Trabalho com esse suporte estruturado. Posso mostrar como?`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

O cumprimento de sentença coletiva é uma das fases mais delicadas pro sindicato. A sentença pode ser excelente, mas se o cálculo de liquidação de cada substituído não for acompanhado tecnicamente, o que foi conquistado coletivamente não chega inteiro pra categoria.

A implicação prática é dura: o trabalhador substituído frequentemente não tem como contratar advogado particular pra fase de cumprimento (o valor individual não comporta o honorário) e acaba assinando o cálculo da ré. A {{razao}} ganha no mérito, mas a categoria recebe na ponta uma fração da vitória.

A {{razao}} tem estrutura técnica pra acompanhar essa fase hoje? Posso mostrar como funciona um suporte especializado.`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Em ações coletivas eu vejo um padrão: a inicial é construída com foco no mérito, sem que os cálculos da fase de liquidação sejam pensados desde o ajuizamento. Aí o sindicato ganha, e na hora do cumprimento individual a conta não fecha pra cada substituído.

Trabalho preventivamente. Olho a inicial pensando como vai ficar a liquidação lá na frente, faço cálculos individualizados de cumprimento, impugno os cálculos da ré e dou suporte técnico em embargos à execução. Atendo por intervenção, por lote ou em parceria recorrente.

Seria interessante conversar com a {{razao}} sobre como isso poderia funcionar pra vocês?`
  ]
};

// ---------- ESTADO ----------
let db = {
  version: STATE_VERSION,
  contatos: [],
  identidade: {
    nome: '',
    titulo: 'Estrategista em Liquidação Trabalhista'
  },
  template: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_EMAIL)),
  templateWa: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_WA))
};

let novosImportados = [];
let duplicadosCount = 0;
let semEmailCount = 0;

// ---------- UTILS ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const escapeHtml = s => (s == null ? '' : String(s).replace(/[&<>"']/g, c => (
  { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
)));

(function initData() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const d = new Date();
  $('#hoje').textContent = `${d.getDate()} de ${meses[d.getMonth()]}, ${d.getFullYear()}`;
})();

function formatCnpj(c) {
  c = (c || '').replace(/\D/g, '');
  if (c.length !== 14) return c;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
}
function unformatCnpj(c) { return (c || '').replace(/\D/g, ''); }
function normalizeStr(s) { return (s || '').toString().trim(); }
function normalizeEmail(s) { return (s || '').toString().trim().toLowerCase(); }

// ---------- TELEFONE / WHATSAPP ----------
function extrairTelefones(tel) {
  if (!tel) return [];
  return String(tel).split(/[,;\/|]/).map(t => t.trim()).filter(Boolean);
}

// É celular? 11 dígitos com 8 ou 9 após o DDD
function ehCelular(numStr) {
  const nums = String(numStr || '').replace(/\D/g, '');
  if (nums.length === 11) {
    return nums[2] === '9' || nums[2] === '8';
  }
  if (nums.length === 13 && nums.startsWith('55')) {
    return nums[4] === '9' || nums[4] === '8';
  }
  return false;
}

function analisarTelefone(telField) {
  const lista = extrairTelefones(telField);
  for (const t of lista) {
    if (ehCelular(t)) {
      const nums = t.replace(/\D/g, '');
      const wa = nums.length === 11 ? '55' + nums : nums;
      return { temWhats: true, telWa: wa };
    }
  }
  return { temWhats: false, telWa: '' };
}

// ---------- DETECÇÃO DE PERFIL ----------
function detectarPerfil(razao) {
  const r = (razao || '').toLowerCase();

  if (/(sindic|sind\.|federa[cç][aã]o|confedera[cç][aã]o|associa[cç][aã]o\s+(dos|de)\s+(trabalhadores|profissionais|empregados))/.test(r)) {
    return 'sindicato';
  }
  if (/(contab|contad|escrit[oó]rio.*fiscal|escrit[oó]rio.*cont[aá]bil|assessoria.*fiscal|assessoria.*cont[aá]bil)/.test(r)) {
    return 'contabilidade';
  }
  if (/(advoc|advog|sociedade.*advog|escrit[oó]rio.*advoc|\boab\b|\bsca\b|\badvs\b|adv\.)/.test(r)) {
    return 'advocacia';
  }
  return 'advocacia';
}

const NOMES_PERFIL = {
  advocacia: 'Advocacia',
  contabilidade: 'Contabilidade',
  sindicato: 'Sindicato'
};

// ---------- PERSISTÊNCIA ----------
function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      migrarDeV2();
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === STATE_VERSION) {
      // Detectar template no formato antigo (subject/body planos) e migrar
      let template = parsed.template;
      if (template && typeof template.subject === 'string' && typeof template.body === 'string') {
        // Formato antigo — migrar pra estrutura por perfil aplicando o conteúdo antigo só em advocacia
        const novo = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_EMAIL));
        novo.advocacia = { subject: template.subject, body: template.body };
        template = novo;
      } else if (!template || !template.advocacia) {
        template = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_EMAIL));
      } else {
        // Garante que os 3 perfis existem (caso seja parcial)
        for (const p of ['advocacia', 'contabilidade', 'sindicato']) {
          if (!template[p] || !template[p].subject || !template[p].body) {
            template[p] = { ...DEFAULT_TEMPLATE_EMAIL[p] };
          }
        }
      }
      db = {
        version: STATE_VERSION,
        contatos: parsed.contatos || [],
        identidade: parsed.identidade || { nome: '', titulo: 'Estrategista em Liquidação Trabalhista' },
        template: template,
        templateWa: parsed.templateWa || JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_WA))
      };
    }
  } catch (e) {
    console.error('Erro ao carregar:', e);
  }
}

function migrarDeV2() {
  try {
    const v2raw = localStorage.getItem('prospect_cia_v2');
    if (!v2raw) return;
    const v2db = JSON.parse(v2raw);
    if (!v2db || !v2db.contatos) return;

    db.contatos = v2db.contatos.map(c => {
      const tel = analisarTelefone(c.telefone);
      const perfil = detectarPerfil(c.razao);
      const scoreEmail = c.score || 0;
      const scoreWa = tel.temWhats ? 75 : 0;
      return {
        id: c.id,
        cnpj: c.cnpj,
        razao: c.razao,
        cidade: c.cidade,
        uf: c.uf,
        email: c.email,
        telefone: c.telefone,
        perfil: perfil,
        scoreEmail: scoreEmail,
        temWhats: tel.temWhats,
        telWa: tel.telWa,
        scoreCombinado: Math.max(scoreEmail, scoreWa),
        status: c.status || 'pendente',
        dataContato: c.dataContato || null,
        waVar: Math.floor(Math.random() * 3)
      };
    });
    // Não migra template antigo da v2 — era um único genérico, agora temos 3 SPIN longos por perfil
    // (a estrutura nova é mantida com os defaults DEFAULT_TEMPLATE_EMAIL)
    saveDB();
    console.log(`Migrados ${db.contatos.length} contatos da v2 → v3`);
  } catch (e) {
    console.error('Falha na migração v2→v3:', e);
  }
}

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      alert('Espaço de armazenamento esgotado!\n\nO seu navegador atingiu o limite (~5MB). Exporte um Excel agora pra não perder, e considere remover contatos pulados ou contatados antigos.');
    } else {
      console.error('Erro ao salvar:', e);
    }
  }
}

// ---------- CLASSIFICAÇÃO DE EMAIL ----------
const DOMAIN_MORTOS = new Set([
  'bol.com.br','uai.com.br','ig.com.br','oi.com.br','click21.com.br',
  'pop.com.br','zipmail.com.br','globomail.com','r7.com',
  'aol.com','aol.com.br','globo.com'
]);
const DOMAIN_VELHOS = new Set([
  'terra.com.br','yahoo.com.br','yahoo.com','hotmail.com.br',
  'hotmail.com','outlook.com','live.com','msn.com'
]);
const DOMAIN_ATUAIS = new Set([
  'gmail.com','outlook.com.br','icloud.com','protonmail.com'
]);

function classificarEmail(email) {
  email = normalizeEmail(email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'invalido';
  const dom = email.split('@')[1];
  if (DOMAIN_MORTOS.has(dom)) return 'morto';
  if (DOMAIN_VELHOS.has(dom)) return 'pessoal_velho';
  if (DOMAIN_ATUAIS.has(dom)) return 'pessoal_atual';
  return 'proprio';
}

function calcularScoreEmail(contato) {
  const cat = classificarEmail(contato.email);
  if (cat === 'invalido') return 0;
  let base = { proprio: 80, pessoal_atual: 60, pessoal_velho: 35, morto: 5 }[cat];
  const razao = (contato.razao || '').toLowerCase();
  const user = (contato.email || '').split('@')[0].toLowerCase();
  const palavras = razao.match(/[a-z]{4,}/g) || [];
  if (palavras.slice(0, 6).some(p => user.includes(p))) base += 10;
  return Math.max(0, Math.min(100, base));
}

function calcularScoreWa(temWhats) {
  return temWhats ? 75 : 0;
}

function categoriaPorScore(score) {
  if (score >= 80) return 'OURO';
  if (score >= 60) return 'PRATA';
  if (score >= 40) return 'BRONZE';
  if (score >= 20) return 'RUIM';
  return 'MORTO';
}

// ---------- IMPORT CSV ----------
function lerCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}

function getCol(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== null && row[c] !== '') {
      return row[c];
    }
  }
  const keys = Object.keys(row);
  for (const c of candidates) {
    const cNorm = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (kNorm === cNorm && row[k] !== '') return row[k];
    }
  }
  return '';
}

function processarCsv(rows) {
  novosImportados = [];
  duplicadosCount = 0;
  semEmailCount = 0;

  const existentes = new Set();
  for (const c of db.contatos) {
    existentes.add(c.cnpj + '|' + c.email);
  }

  for (const row of rows) {
    const cnpj = unformatCnpj(getCol(row, 'CNPJ', 'cnpj'));
    const email = normalizeEmail(getCol(row, 'E-mail', 'Email', 'email', 'EMAIL'));
    const razao = normalizeStr(getCol(row, 'Razao Social', 'Razão Social', 'razao_social', 'razao social'));
    const cidade = normalizeStr(getCol(row, 'Municipio', 'Município', 'municipio', 'cidade'));
    const uf = normalizeStr(getCol(row, 'UF', 'uf'));
    const tel = normalizeStr(getCol(row, 'Telefones', 'Telefone', 'telefone', 'TELEFONE'));

    if (!cnpj && !email) continue;
    if (!email) { semEmailCount++; continue; }

    const key = cnpj + '|' + email;
    if (existentes.has(key)) { duplicadosCount++; continue; }
    if (novosImportados.some(n => n.cnpj === cnpj && n.email === email)) {
      duplicadosCount++; continue;
    }

    const telInfo = analisarTelefone(tel);
    const perfil = detectarPerfil(razao);
    const contato = {
      id: 'c_' + Math.random().toString(36).slice(2, 11),
      cnpj, razao, cidade, uf, email,
      telefone: tel,
      perfil: perfil,
      temWhats: telInfo.temWhats,
      telWa: telInfo.telWa,
      scoreEmail: 0,
      scoreCombinado: 0,
      status: 'pendente',
      dataContato: null,
      waVar: Math.floor(Math.random() * 3)
    };
    contato.scoreEmail = calcularScoreEmail(contato);
    contato.scoreCombinado = Math.max(contato.scoreEmail, calcularScoreWa(contato.temWhats));
    novosImportados.push(contato);
  }

  $('#pi-add').textContent = novosImportados.length;
  $('#pi-dup').textContent = duplicadosCount;
  $('#pi-bad').textContent = semEmailCount;
  const comWa = novosImportados.filter(c => c.temWhats).length;
  $('#pi-wa').textContent = comWa;
  $('#import-preview').classList.remove('hidden');
}

function confirmarImport() {
  if (novosImportados.length === 0) {
    alert('Não há contatos novos para adicionar.');
    return;
  }
  db.contatos = db.contatos.concat(novosImportados);
  saveDB();
  novosImportados = [];
  duplicadosCount = 0;
  semEmailCount = 0;
  $('#import-preview').classList.add('hidden');
  $('#file-input').value = '';
  goToPanel('dashboard');
  renderDashboard();
  alert(`✓ ${db.contatos.length} contatos no total agora.`);
}

// ---------- DASHBOARD ----------
function renderDashboard() {
  const total = db.contatos.length;
  const counts = { OURO: 0, PRATA: 0, BRONZE: 0, RUIM: 0, MORTO: 0 };
  let contatados = 0, pulados = 0, pendentes = 0;
  let bons = 0, comWa = 0;

  for (const c of db.contatos) {
    const cat = categoriaPorScore(c.scoreCombinado);
    counts[cat]++;
    if (cat === 'OURO' || cat === 'PRATA') bons++;
    if (c.temWhats) comWa++;
    if (c.status === 'contatado') contatados++;
    else if (c.status === 'pulado') pulados++;
    else pendentes++;
  }

  $('#s-total').textContent = total;
  $('#s-bons').textContent = bons;
  $('#s-contatados').textContent = contatados;
  $('#s-pendentes').textContent = pendentes;
  $('#s-pulados').textContent = pulados;
  $('#s-wa').textContent = comWa;

  const qb = $('#quality-bar').children;
  if (total > 0) {
    qb[0].style.width = (counts.OURO / total * 100) + '%';
    qb[1].style.width = (counts.PRATA / total * 100) + '%';
    qb[2].style.width = (counts.BRONZE / total * 100) + '%';
    qb[3].style.width = (counts.RUIM / total * 100) + '%';
    qb[4].style.width = (counts.MORTO / total * 100) + '%';
  } else {
    for (const el of qb) el.style.width = '0%';
  }

  $('#leg-ouro').textContent = `Ouro ${counts.OURO}`;
  $('#leg-prata').textContent = `Prata ${counts.PRATA}`;
  $('#leg-bronze').textContent = `Bronze ${counts.BRONZE}`;
  $('#leg-ruim').textContent = `Ruim ${counts.RUIM}`;
  $('#leg-morto').textContent = `Morto ${counts.MORTO}`;

  $('#empty-pitch').classList.toggle('hidden', total > 0);
  $('#btn-prospectar').disabled = pendentes === 0;
  $('#btn-export').disabled = total === 0;

  // Aviso identidade
  const semIdentidade = !db.identidade.nome || db.identidade.nome.trim() === '';
  $('#aviso-identidade').classList.toggle('hidden', !semIdentidade);
}

// ---------- NAVEGAÇÃO ----------
function goToPanel(name) {
  ['dashboard', 'import', 'message', 'identidade', 'prospect'].forEach(n => {
    const el = $(`#panel-${n}`);
    if (el) el.classList.toggle('hidden', n !== name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- TEMPLATE ENGINE ----------
function aplicarTemplate(tpl, c) {
  return (tpl || '')
    .replace(/\{\{razao\}\}/g, c.razao || '')
    .replace(/\{\{cidade\}\}/g, c.cidade || '')
    .replace(/\{\{uf\}\}/g, c.uf || '')
    .replace(/\{\{cnpj\}\}/g, formatCnpj(c.cnpj || ''))
    .replace(/\{\{eu_nome\}\}/g, db.identidade.nome || '[Seu nome]')
    .replace(/\{\{eu_titulo\}\}/g, db.identidade.titulo || 'Estrategista em Liquidação Trabalhista');
}

function gerarMsgWa(c) {
  const variacoes = db.templateWa[c.perfil] || db.templateWa.advocacia;
  const idx = (c.waVar || 0) % variacoes.length;
  return aplicarTemplate(variacoes[idx], c);
}

// Retorna { subject, body } do template de email para o perfil do contato
function getEmailTemplate(perfil) {
  return db.template[perfil] || db.template.advocacia;
}

// ---------- MODO PROSPECÇÃO ----------
let lotAtual = [];

function montarLote() {
  const tamanho = parseInt($('#batch-size').value);
  const candidatos = db.contatos
    .filter(c => c.status === 'pendente')
    .filter(c => {
      const cat = categoriaPorScore(c.scoreCombinado);
      return cat === 'OURO' || cat === 'PRATA' || cat === 'BRONZE';
    })
    .sort((a, b) => b.scoreCombinado - a.scoreCombinado);

  lotAtual = candidatos.slice(0, tamanho).map(c => c.id);
  renderLote();
}

function renderLote() {
  const list = $('#contact-list');
  list.innerHTML = '';

  if (lotAtual.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum contato pendente</h3>
        <p>Você esgotou os contatos de qualidade Ouro/Prata/Bronze. Importe novos CSVs ou volte amanhã.</p>
      </div>`;
    $('#prospect-done').textContent = 0;
    $('#prospect-total').textContent = 0;
    return;
  }

  let contatadosNoLote = 0;
  for (const id of lotAtual) {
    const c = db.contatos.find(x => x.id === id);
    if (!c) continue;
    if (c.status === 'contatado') contatadosNoLote++;

    const cat = categoriaPorScore(c.scoreCombinado);
    const catLower = cat.toLowerCase();
    const tpl = getEmailTemplate(c.perfil);
    const msgEmail = aplicarTemplate(tpl.body, c);
    const subjEmail = aplicarTemplate(tpl.subject, c);
    const mailto = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subjEmail)}&body=${encodeURIComponent(msgEmail)}`;

    let waLink = '';
    let msgWa = '';
    if (c.temWhats && c.telWa) {
      msgWa = gerarMsgWa(c);
      waLink = `https://wa.me/${c.telWa}?text=${encodeURIComponent(msgWa)}`;
    }

    let statusTag = '';
    let cardClass = '';
    if (c.status === 'contatado') {
      cardClass = 'contatado';
      statusTag = '<span class="status-tag ok">✓ Contatado</span>';
    } else if (c.status === 'pulado') {
      cardClass = 'pulado';
      statusTag = '<span class="status-tag skip">Pulado</span>';
    }

    const perfilLabel = NOMES_PERFIL[c.perfil] || 'Advocacia';
    const waBadge = c.temWhats
      ? '<span class="ch-badge wa-on">✓ WhatsApp</span>'
      : '<span class="ch-badge wa-off">sem WhatsApp</span>';
    const emailBadge = `<span class="ch-badge email-${categoriaPorScore(c.scoreEmail).toLowerCase()}">Email ${categoriaPorScore(c.scoreEmail)}</span>`;

    const card = document.createElement('div');
    card.className = 'contact-card ' + cardClass;
    card.dataset.id = id;
    card.innerHTML = `
      <div class="card-head">
        <div class="card-head-left">
          <div class="razao">${escapeHtml(c.razao || '(sem nome)')} ${statusTag}</div>
          <div class="meta">${formatCnpj(c.cnpj)} · ${escapeHtml(c.cidade)}${c.uf ? '/' + c.uf : ''}</div>
          <div class="card-channels">
            <span class="perfil-tag perfil-${c.perfil}">${perfilLabel}</span>
            ${emailBadge}
            ${waBadge}
          </div>
        </div>
        <span class="badge-quality ${catLower}">${cat}</span>
      </div>
      <div class="card-body">
        <div class="contact-info">
          <span class="pill"><span class="ic">✉</span>${escapeHtml(c.email)}</span>
          ${c.telefone ? `<span class="pill"><span class="ic">☏</span>${escapeHtml(c.telefone)}</span>` : ''}
        </div>

        <details class="msg-block">
          <summary><span class="msg-label">Email — assunto:</span> ${escapeHtml(subjEmail)}</summary>
          <div class="msg-preview">${escapeHtml(msgEmail)}</div>
        </details>

        ${c.temWhats ? `
        <details class="msg-block wa-msg">
          <summary><span class="msg-label">WhatsApp — perfil ${perfilLabel}:</span> abrir mensagem SPIN</summary>
          <div class="msg-preview">${escapeHtml(msgWa)}</div>
        </details>
        ` : ''}

        <div class="card-actions">
          <a class="btn send" href="${mailto}" target="_blank" data-action="enviar-email" data-id="${id}">📧 Email</a>
          ${c.temWhats ? `<a class="btn send-wa" href="${waLink}" target="_blank" data-action="enviar-wa" data-id="${id}">💬 WhatsApp</a>` : ''}
          <button class="btn copy" data-action="copiar-email" data-id="${id}">📋 Copiar email</button>
          ${c.temWhats ? `<button class="btn copy" data-action="copiar-wa" data-id="${id}">📋 Copiar WA</button>` : ''}
          <button class="btn mark" data-action="contatado" data-id="${id}">✓ Contatado</button>
          <button class="btn skip" data-action="pular" data-id="${id}">🚫 Pular</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  }

  $('#prospect-done').textContent = contatadosNoLote;
  $('#prospect-total').textContent = lotAtual.length;
}

// Listener delegado
$('#contact-list').addEventListener('click', e => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  const c = db.contatos.find(x => x.id === id);
  if (!c) return;

  function marcarContatado() {
    c.status = 'contatado';
    c.dataContato = new Date().toISOString();
    saveDB();
    renderLote();
    renderDashboard();
  }

  if (action === 'enviar-email') {
    setTimeout(() => {
      if (c.status !== 'contatado') {
        if (confirm(`Marcar "${c.razao}" como contatado?`)) marcarContatado();
      }
    }, 1500);
  } else if (action === 'enviar-wa') {
    // Clique no WA = decisão de contato. Marca direto.
    setTimeout(() => {
      if (c.status !== 'contatado') marcarContatado();
    }, 600);
  } else if (action === 'copiar-email') {
    e.preventDefault();
    const tpl = getEmailTemplate(c.perfil);
    const subj = aplicarTemplate(tpl.subject, c);
    const body = aplicarTemplate(tpl.body, c);
    const texto = `Para: ${c.email}\nAssunto: ${subj}\n\n${body}`;
    navigator.clipboard.writeText(texto).then(() => {
      target.textContent = '✓ Copiado!';
      setTimeout(() => target.textContent = '📋 Copiar email', 1800);
    }).catch(() => alert('Erro ao copiar'));
  } else if (action === 'copiar-wa') {
    e.preventDefault();
    const msg = gerarMsgWa(c);
    navigator.clipboard.writeText(msg).then(() => {
      target.textContent = '✓ Copiado!';
      setTimeout(() => target.textContent = '📋 Copiar WA', 1800);
    }).catch(() => alert('Erro ao copiar'));
  } else if (action === 'contatado') {
    e.preventDefault();
    marcarContatado();
  } else if (action === 'pular') {
    e.preventDefault();
    c.status = 'pulado';
    saveDB();
    renderLote();
    renderDashboard();
  }
});

// ---------- EXPORT EXCEL ----------
function exportarExcel() {
  if (db.contatos.length === 0) return;

  const linhas = db.contatos.map(c => ({
    'CNPJ': formatCnpj(c.cnpj),
    'Nome (Razão Social)': c.razao,
    'Cidade': c.cidade,
    'UF': c.uf,
    'Email': c.email,
    'Telefone': c.telefone,
    'Perfil detectado': NOMES_PERFIL[c.perfil] || c.perfil,
    'Tem WhatsApp': c.temWhats ? 'Sim' : 'Não',
    'WhatsApp (link)': c.temWhats ? `https://wa.me/${c.telWa}` : '',
    'Qualidade combinada': categoriaPorScore(c.scoreCombinado),
    'Score email': c.scoreEmail,
    'Score combinado': c.scoreCombinado,
    'Status': c.status === 'contatado' ? 'Contatado' : c.status === 'pulado' ? 'Pulado' : 'Pendente',
    'Data do contato': c.dataContato ? new Date(c.dataContato).toLocaleString('pt-BR') : '',
    'Mensagem email': aplicarTemplate(getEmailTemplate(c.perfil).body, c),
    'Mensagem WhatsApp': c.temWhats ? gerarMsgWa(c) : ''
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [
    { wch: 20 }, { wch: 38 }, { wch: 22 }, { wch: 4 },
    { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    { wch: 30 }, { wch: 18 }, { wch: 11 }, { wch: 14 },
    { wch: 12 }, { wch: 18 }, { wch: 80 }, { wch: 80 }
  ];

  const bonsPendentes = linhas.filter(l => (l['Qualidade combinada'] === 'OURO' || l['Qualidade combinada'] === 'PRATA') && l.Status === 'Pendente');
  const ws2 = XLSX.utils.json_to_sheet(bonsPendentes);
  ws2['!cols'] = ws['!cols'];

  const contatadosLs = linhas.filter(l => l.Status === 'Contatado');
  const ws3 = XLSX.utils.json_to_sheet(contatadosLs);
  ws3['!cols'] = ws['!cols'];

  const apenasWa = linhas.filter(l => l['Tem WhatsApp'] === 'Sim' && l.Status === 'Pendente');
  const ws4 = XLSX.utils.json_to_sheet(apenasWa);
  ws4['!cols'] = ws['!cols'];

  const counts = { OURO: 0, PRATA: 0, BRONZE: 0, RUIM: 0, MORTO: 0 };
  for (const l of linhas) counts[l['Qualidade combinada']]++;
  const resumo = [
    { Indicador: 'Total na base', Valor: db.contatos.length },
    { Indicador: 'Com WhatsApp', Valor: db.contatos.filter(c => c.temWhats).length },
    { Indicador: 'Contatados', Valor: contatadosLs.length },
    { Indicador: 'Pendentes', Valor: linhas.filter(l => l.Status === 'Pendente').length },
    { Indicador: 'Pulados', Valor: linhas.filter(l => l.Status === 'Pulado').length },
    { Indicador: 'Ouro', Valor: counts.OURO },
    { Indicador: 'Prata', Valor: counts.PRATA },
    { Indicador: 'Bronze', Valor: counts.BRONZE },
    { Indicador: 'Ruim', Valor: counts.RUIM },
    { Indicador: 'Morto', Valor: counts.MORTO },
    { Indicador: 'Advocacia', Valor: db.contatos.filter(c => c.perfil === 'advocacia').length },
    { Indicador: 'Contabilidade', Valor: db.contatos.filter(c => c.perfil === 'contabilidade').length },
    { Indicador: 'Sindicato', Valor: db.contatos.filter(c => c.perfil === 'sindicato').length },
    { Indicador: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') }
  ];
  const ws5 = XLSX.utils.json_to_sheet(resumo);
  ws5['!cols'] = [{ wch: 24 }, { wch: 24 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Base completa');
  XLSX.utils.book_append_sheet(wb, ws2, 'Bons pendentes');
  XLSX.utils.book_append_sheet(wb, ws3, 'Já contatados');
  XLSX.utils.book_append_sheet(wb, ws4, 'WhatsApp pendentes');
  XLSX.utils.book_append_sheet(wb, ws5, 'Resumo');

  const dataStr = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `prospect_base_${dataStr}.xlsx`);
}

// ---------- IDENTIDADE ----------
function abrirIdentidade() {
  $('#id-nome').value = db.identidade.nome || '';
  $('#id-titulo').value = db.identidade.titulo || 'Estrategista em Liquidação Trabalhista';
  goToPanel('identidade');
}

function salvarIdentidade() {
  const nome = $('#id-nome').value.trim();
  const titulo = $('#id-titulo').value.trim() || 'Estrategista em Liquidação Trabalhista';
  if (!nome) {
    alert('Por favor informe seu nome.');
    return;
  }
  db.identidade.nome = nome;
  db.identidade.titulo = titulo;
  saveDB();
  goToPanel('dashboard');
  renderDashboard();
}

// ---------- BINDINGS ----------

// Dashboard
$('#btn-add').addEventListener('click', () => {
  $('#import-preview').classList.add('hidden');
  $('#file-input').value = '';
  goToPanel('import');
});
$('#btn-prospectar').addEventListener('click', () => {
  if (!db.identidade.nome || !db.identidade.nome.trim()) {
    if (confirm('Você ainda não cadastrou seu nome. Quer cadastrar agora? (Cancelar continua com placeholder "[Seu nome]" nas mensagens.)')) {
      abrirIdentidade();
      return;
    }
  }
  goToPanel('prospect');
  montarLote();
});
$('#btn-mensagem').addEventListener('click', () => {
  abrirEditorEmail('advocacia');
});
$('#btn-identidade').addEventListener('click', abrirIdentidade);
$('#btn-export').addEventListener('click', exportarExcel);
$('#btn-clear').addEventListener('click', () => {
  if (db.contatos.length === 0) {
    alert('Sua base já está vazia.');
    return;
  }
  if (!confirm(`Tem certeza que quer apagar TODA a base de ${db.contatos.length} contatos? Esta ação não pode ser desfeita.`)) return;
  if (!confirm('Confirma de novo? Vai apagar tudo, incluindo os contatos já contatados.')) return;
  db.contatos = [];
  saveDB();
  renderDashboard();
});

// Import
const fileDrop = $('#file-drop');
const fileInput = $('#file-input');
['dragover','dragenter'].forEach(ev => fileDrop.addEventListener(ev, e => {
  e.preventDefault(); e.stopPropagation();
  fileDrop.classList.add('dragover');
}));
['dragleave','dragend','drop'].forEach(ev => fileDrop.addEventListener(ev, e => {
  e.preventDefault(); e.stopPropagation();
  fileDrop.classList.remove('dragover');
}));
fileDrop.addEventListener('drop', async e => {
  const file = e.dataTransfer.files[0];
  if (file) await handleFile(file);
});
fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (file) await handleFile(file);
});
async function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    alert('Selecione um arquivo CSV (.csv).');
    return;
  }
  try {
    const rows = await lerCsv(file);
    if (!rows.length) {
      alert('CSV vazio ou sem cabeçalho válido.');
      return;
    }
    processarCsv(rows);
  } catch (err) {
    alert('Erro ao ler CSV: ' + err.message);
  }
}
$('#btn-confirm-import').addEventListener('click', confirmarImport);
$('#btn-cancel-import').addEventListener('click', () => {
  novosImportados = []; duplicadosCount = 0; semEmailCount = 0;
  $('#import-preview').classList.add('hidden');
  $('#file-input').value = '';
});
$('#btn-back-from-import').addEventListener('click', () => {
  novosImportados = []; duplicadosCount = 0; semEmailCount = 0;
  $('#import-preview').classList.add('hidden');
  goToPanel('dashboard');
});

// Message — editor de email por perfil
let perfilEditandoEmail = 'advocacia';

function abrirEditorEmail(perfil) {
  perfilEditandoEmail = perfil || 'advocacia';
  // Atualiza estado visual das abas
  $$('.email-perfil-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.perfil === perfilEditandoEmail);
  });
  // Carrega o conteúdo do perfil ativo
  const tpl = db.template[perfilEditandoEmail];
  $('#subject').value = tpl.subject;
  $('#msg-template').value = tpl.body;
  goToPanel('message');
}

// Tabs do editor
$$('.email-perfil-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Antes de trocar, salva o que está editando no perfil atual (sem persistir ainda)
    db.template[perfilEditandoEmail] = {
      subject: $('#subject').value.trim(),
      body: $('#msg-template').value.trim()
    };
    abrirEditorEmail(tab.dataset.perfil);
  });
});

$('#btn-save-msg').addEventListener('click', () => {
  db.template[perfilEditandoEmail] = {
    subject: $('#subject').value.trim(),
    body: $('#msg-template').value.trim()
  };
  saveDB();
  goToPanel('dashboard');
});

$('#btn-restore-msg').addEventListener('click', () => {
  if (!confirm(`Restaurar o template padrão SPIN do perfil "${perfilEditandoEmail}"? Suas edições neste perfil serão perdidas.`)) return;
  db.template[perfilEditandoEmail] = { ...DEFAULT_TEMPLATE_EMAIL[perfilEditandoEmail] };
  $('#subject').value = db.template[perfilEditandoEmail].subject;
  $('#msg-template').value = db.template[perfilEditandoEmail].body;
});

$('#btn-back-from-msg').addEventListener('click', () => goToPanel('dashboard'));

// Identidade
$('#btn-save-id').addEventListener('click', salvarIdentidade);
$('#btn-back-from-id').addEventListener('click', () => goToPanel('dashboard'));

// Prospect
$('#batch-size').addEventListener('input', e => {
  $('#batch-count').textContent = e.target.value;
});
$('#batch-size').addEventListener('change', () => montarLote());
$('#btn-back-from-prospect').addEventListener('click', () => goToPanel('dashboard'));

// ---------- INIT ----------
loadDB();
renderDashboard();
