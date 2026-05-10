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
const DEFAULT_TEMPLATE_EMAIL = {
  subject: 'Apresentação — Cálculos trabalhistas para {{razao}}',
  body: `Prezados,

Sou {{eu_titulo}} e atendo escritórios e sindicatos em todo o Brasil com cálculos de liquidação de sentença, impugnações, embargos e laudos periciais. Identifiquei a {{razao}} ({{cidade}}/{{uf}}) e gostaria de me apresentar como possível parceiro técnico.

Preparo cálculos em PJeCalc, planilhas auditáveis e pareceres técnicos no padrão TRT, com retorno rápido e custo competitivo. Posso enviar amostras de trabalhos anteriores caso haja interesse.

Atenciosamente,
{{eu_nome}}
{{eu_titulo}}`
};

// Templates SPIN — 3 perfis × 3 variações (rotação por contato)
const DEFAULT_TEMPLATE_WA = {
  advocacia: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Entrei em contato com a {{razao}} porque tenho uma pergunta direta: quando chega o cálculo da parte contrária em uma execução, o escritório tem alguém que faz a análise técnica antes de aceitar o valor?

Pergunto porque erros em correção monetária, base de FGTS e horas extras são muito mais comuns do que parecem. E advogados que não impugnam com fundamento técnico acabam deixando dinheiro na mesa, seja do cliente ou dos próprios honorários.

Se fizer sentido conversar, fico à disposição.`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Uma coisa que vejo com frequência: o processo foi bem conduzido, a sentença foi favorável, mas na hora do cumprimento o cálculo apresentado pela outra parte está cheio de problemas. E sem uma impugnação bem fundamentada, o que foi conquistado vai embora.

A {{razao}} já passou por uma situação assim? Posso mostrar como trabalho nessa fase.`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Queria fazer uma pergunta para a {{razao}}: quando o cliente chega na fase de execução, quem cuida da parte técnica dos cálculos no escritório?

Esse costuma ser um ponto crítico. A diferença entre aceitar o cálculo ou impugnar com técnica pode representar valores significativos para o cliente, e consequentemente para o escritório.

Se quiser trocar uma ideia sobre como isso funciona na prática, estou à disposição.`
  ],

  contabilidade: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Tenho uma proposta de parceria que pode fazer sentido para a {{razao}}. Vocês já atendem empresas, já têm a confiança delas para folha e obrigações fiscais. Quando uma dessas empresas enfrenta uma ação trabalhista e chega na fase de cálculo, ela precisa de alguém de confiança.

A ideia é simples: eu ofereço o serviço de cálculo e liquidação, vocês indicam para a carteira, e dividimos o resultado. Sem custo para vocês, sem necessidade de estrutura adicional.

Teriam interesse em conversar sobre isso?`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Uma pergunta rápida para a {{razao}}: quando um dos clientes empresa de vocês enfrenta uma ação trabalhista, para onde vai a parte dos cálculos?

Pergunto porque muitos escritórios contábeis que conheço já têm toda a confiança do cliente, mas ainda indicam para fora quando aparece esse tipo de demanda. Isso representa uma receita que poderia ficar dentro da estrutura de vocês.

Posso explicar como funciona essa parceria de forma bem direta. Vale uma conversa?`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Vocês sabiam que boa parte dos escritórios contábeis que adicionaram cálculo trabalhista como serviço de parceria conseguiram aumentar o ticket médio por cliente sem contratar ninguém novo?

A lógica é direta: a {{razao}} já tem a empresa como cliente. Quando ela tem uma ação trabalhista e precisa de cálculo de liquidação, rescisória ou impugnação, esse serviço pode ser entregue com o nome de vocês por trás, com o meu trabalho técnico por baixo.

Posso mostrar como funciona?`
  ],

  sindicato: [
`Olá! Tudo bem?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Uma pergunta para a {{razao}}: quando o sindicato entra com ação coletiva, os cálculos são elaborados levando em conta como vai funcionar a liquidação lá na frente?

Pergunto porque é muito comum o sindicato ganhar no mérito mas perder na execução. O cálculo apresentado pela parte contrária chega com problemas, e sem alguém para fazer a impugnação técnica, o trabalhador recebe menos do que conquistou.

Já passaram por isso? Posso mostrar como trabalho nessa fase.`,

`Olá!

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

O cumprimento de sentença coletiva é uma das fases mais delicadas. A sentença pode ser excelente, mas se o cálculo de liquidação não for acompanhado de perto, o que foi conquistado na negociação não chega inteiro para o trabalhador.

A {{razao}} tem estrutura para fazer esse acompanhamento técnico hoje? Posso mostrar como funciona um suporte especializado nessa fase.`,

`Olá! Tudo certo?

Meu nome é {{eu_nome}}, sou {{eu_titulo}}.

Uma coisa que vejo com frequência em ações coletivas: a inicial não foi pensada nos cálculos. Aí o sindicato ganha, mas na hora da liquidação a conta não fecha e o trabalhador fica prejudicado.

Trabalho preventivamente com os cálculos desde a fase inicial, e acompanho até o cumprimento de sentença. Seria interessante conversar com a {{razao}} sobre como isso poderia funcionar para vocês?`
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
  template: { ...DEFAULT_TEMPLATE_EMAIL },
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
      db = {
        version: STATE_VERSION,
        contatos: parsed.contatos || [],
        identidade: parsed.identidade || { nome: '', titulo: 'Estrategista em Liquidação Trabalhista' },
        template: parsed.template || { ...DEFAULT_TEMPLATE_EMAIL },
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
    if (v2db.template) {
      db.template = {
        subject: v2db.template.subject || DEFAULT_TEMPLATE_EMAIL.subject,
        body: v2db.template.body || DEFAULT_TEMPLATE_EMAIL.body
      };
    }
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
    const msgEmail = aplicarTemplate(db.template.body, c);
    const subjEmail = aplicarTemplate(db.template.subject, c);
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
    const subj = aplicarTemplate(db.template.subject, c);
    const body = aplicarTemplate(db.template.body, c);
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
    'Mensagem email': aplicarTemplate(db.template.body, c),
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
  $('#subject').value = db.template.subject;
  $('#msg-template').value = db.template.body;
  goToPanel('message');
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

// Message
$('#btn-save-msg').addEventListener('click', () => {
  db.template.subject = $('#subject').value.trim();
  db.template.body = $('#msg-template').value.trim();
  saveDB();
  goToPanel('dashboard');
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
