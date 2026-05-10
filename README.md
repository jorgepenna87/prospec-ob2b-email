# Prospect & Cia. v3 — Pós em Estratégias de Cálculo Trabalhista

App web 100% offline para alunos da Pós em Estratégias de Cálculo Trabalhista (Smart Calc) gerirem prospecção comercial dual-channel (email + WhatsApp).

## Novidades da v3

- **WhatsApp**: detecção automática de celular (11 dígitos com 8 ou 9 após DDD), botão `wa.me` com mensagem SPIN pré-preenchida
- **Detecção automática de perfil**: cada contato é classificado como Advocacia, Contabilidade ou Sindicato pela razão social, e recebe template SPIN específico (3 variações por perfil em rotação)
- **Identidade do calculista**: campo dedicado para nome + título profissional, persistido no localStorage e usado como assinatura nas mensagens
- **Score combinado**: `max(scoreEmail, scoreWa)` — o melhor canal define a categoria do contato. Um contato com email morto mas celular válido entra em PRATA pelo WhatsApp
- **Filtro de lote**: mostra contatos com pelo menos um canal Ouro/Prata/Bronze
- **Migração automática v2→v3**: bases existentes são migradas no primeiro carregamento

## Identidade visual

Padronizada com os demais apps do projeto da Pós: paleta dark cyan (`#070B0B` + accent `#2DFFD4`), tipografia system + monospace, badges retangulares, botões com cantos 8px. WhatsApp recebe accent verde nativo (`#25D366`).

## Arquitetura

- `index.html` — interface única, navegação por painéis (`.hidden`)
- `app.js` — toda a lógica
- Bibliotecas via CDN: PapaParse 5.4.1, SheetJS 0.18.5

## Painéis

1. **Dashboard** — 6 stats (total / bons / WhatsApp / contatados / pendentes / pulados) + barra de qualidade + 6 botões de ação
2. **Identidade** — cadastro do nome + título do calculista
3. **Importar** — file drop com preview de 4 contadores (novos / com WA / duplicados / sem email)
4. **Mensagem (email)** — assunto + corpo com 6 variáveis (`{{razao}}`, `{{cidade}}`, `{{uf}}`, `{{cnpj}}`, `{{eu_nome}}`, `{{eu_titulo}}`)
5. **Prospecção** — slider + cards com badges duais (Email + WhatsApp) e dois botões de ação por canal

## Card de contato

Cada card mostra:

- Razão social, CNPJ, cidade/UF
- Tag de perfil detectado (cores distintas por categoria)
- Badge da qualidade do email (Ouro/Prata/Bronze/Ruim/Morto)
- Badge "✓ WhatsApp" verde ou "sem WhatsApp" cinza
- Badge geral combinado (qualidade do melhor canal)
- Mensagem de email expansível
- Mensagem de WhatsApp expansível (só se tem WA)
- 6 botões: Email · WhatsApp · Copiar email · Copiar WA · Contatado · Pular

## Detecção de perfil (regex)

- **Sindicato**: `sindic`, `federação`, `confederação`, `associação dos/de trabalhadores/profissionais/empregados`
- **Contabilidade**: `contab`, `contad`, `escritório fiscal/contábil`, `assessoria fiscal/contábil`
- **Advocacia**: `advoc`, `advog`, `OAB`, `sociedade de advogados`
- **Default**: advocacia (perfil mais comum)

## Detecção de celular

- 11 dígitos brasileiros (DDD + 8 ou 9 + 8 dígitos) → tem WhatsApp
- 13 dígitos começando com 55 → tem WhatsApp
- Restante (fixos, 0800, números curtos) → sem WhatsApp
- O CSV pode trazer múltiplos números — o app pega o primeiro celular válido

## Ações automáticas

- Clicar em **Email** → abre `mailto:`, pergunta após 1.5s se quer marcar como contatado
- Clicar em **WhatsApp** → abre `wa.me`, marca como contatado direto após 0.6s (sem pergunta — clique no WA é decisão clara de contato)
- Clicar em **Copiar** → copia para clipboard
- Clicar em **Contatado** / **Pular** → marca direto

## Deploy

GitHub Pages: jogue `index.html` + `app.js` num repositório público e ative Pages nas configurações.

## Persistência

- Chave `prospect_cia_v3` no localStorage (~5MB, cabe ~50.000 contatos)
- Migração automática do `prospect_cia_v2` no primeiro carregamento da v3
- Export Excel com 5 abas: Base completa, Bons pendentes, Já contatados, **WhatsApp pendentes** (nova), Resumo
