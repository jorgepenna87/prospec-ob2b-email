# Prospect & Cia. v3 — Pós em Estratégias de Cálculo Trabalhista

App web 100% offline para alunos da Pós em Estratégias de Cálculo Trabalhista (Smart Calc) gerirem prospecção comercial dual-channel (email + WhatsApp), com mensagens SPIN específicas por perfil de contato.

## Estrutura SPIN por perfil

Tanto o **email** quanto o **WhatsApp** têm 3 templates próprios — um para cada perfil detectado automaticamente pela razão social:

### Advocacia
**Dor**: Escritório investe na fase de conhecimento mas aceita o cálculo da liquidação sem impugnação técnica fundamentada. Resultado: cliente recebe menos do que tinha direito, e o honorário sobre o êxito reduz proporcionalmente. A janela de correção (impugnação à sentença de liquidação) se fecha rápido — depois disso, só embargos e agravo, com ônus argumentativo muito maior.

### Contabilidade
**Dor**: Quando uma empresa cliente da contabilidade é citada em ação trabalhista, ela precisa de cálculos jurídicos especializados (provisão, acordo, impugnação, liquidação) que fogem do escopo da contabilidade comum. A empresa busca fora — geralmente por indicação do advogado da outra ponta — e a contabilidade perde a posição de fornecedor único no momento crítico.

### Sindicato
**Dor**: O sindicato vence a ação coletiva no mérito, mas cada um dos centenas de substituídos precisa promover cumprimento de sentença individual com cálculo próprio e impugnação aos valores apresentados pela ré. Sem suporte técnico massivo nessa fase, o juiz homologa o cálculo padronizado da ré, e a categoria recebe na ponta uma fração da vitória coletiva.

## Funcionamento

- **Email**: 1 template SPIN longo por perfil (5-7 parágrafos) com Situação → Problema → **Implicação concreta** → Solução
- **WhatsApp**: 3 variações médias (4-5 parágrafos) por perfil em rotação automática
- **Editor de email**: tabs no topo do painel pra alternar entre os 3 perfis e editar cada um individualmente
- **Restaurar padrão**: botão para voltar ao SPIN padrão do perfil ativo
- **Sem números**: as mensagens usam dor qualitativa ("parcela importante", "valores significativos", "uma fração da vitória") em vez de percentuais checáveis

## Identidade visual

Padronizada com os demais apps do projeto: paleta dark cyan (`#070B0B` + accent `#2DFFD4`), tipografia system + monospace, badges retangulares, botões com cantos 8px. WhatsApp ganha accent verde nativo (`#25D366`).

## Arquitetura

- `index.html` — interface única, navegação por painéis (`.hidden`)
- `app.js` — toda a lógica
- Bibliotecas via CDN: PapaParse 5.4.1, SheetJS 0.18.5

## Painéis

1. **Dashboard** — 6 stats (total / bons / WhatsApp / contatados / pendentes / pulados) + barra de qualidade + 6 botões
2. **Identidade** — cadastro do nome + título profissional do calculista
3. **Importar** — file drop com preview de 4 contadores (novos / com WA / duplicados / sem email)
4. **Editor de email** — tabs por perfil + editor de assunto/corpo + restaurar padrão
5. **Prospecção** — slider + cards com badges duais (Email + WhatsApp) e dois botões de ação por canal

## Card de contato

- Razão social + CNPJ + cidade/UF
- Tag de perfil detectado (cores distintas)
- Badge da qualidade do email (Ouro/Prata/Bronze/Ruim/Morto)
- Badge "✓ WhatsApp" verde ou "sem WhatsApp" cinza
- Badge geral combinado (qualidade do melhor canal)
- Mensagem de email expansível (puxada do template do perfil)
- Mensagem de WhatsApp expansível (só se tem WA)
- 6 botões: Email · WhatsApp · Copiar email · Copiar WA · Contatado · Pular

## Detecção de perfil (regex)

- **Sindicato**: `sindic`, `federação`, `confederação`, `associação dos/de trabalhadores/profissionais/empregados`
- **Contabilidade**: `contab`, `contad`, `escritório fiscal/contábil`, `assessoria fiscal/contábil`
- **Advocacia**: `advoc`, `advog`, `OAB`, `sociedade de advogados`
- **Default**: advocacia

## Detecção de celular (WhatsApp)

- 11 dígitos brasileiros com 8 ou 9 após DDD → tem WhatsApp
- 13 dígitos começando com 55 → tem WhatsApp
- Restante (fixos, 0800, números curtos) → sem WhatsApp

## Score combinado

`max(scoreEmail, scoreWa)` onde `scoreWa = 75` (PRATA) se tem WhatsApp. O melhor canal define a categoria do contato. Filtro do lote mostra contatos com pelo menos um canal Ouro/Prata/Bronze.

## Mailto e Gmail

Para alunos que usam Gmail web, o `mailto:` precisa ser configurado uma vez:

1. Abrir mail.google.com no Chrome
2. Permitir que o site abra os links de email (ícone de protocolo na barra de endereço)
3. A partir daí, todo clique em "📧 Email" abre numa aba nova do Gmail com tudo preenchido

Sem essa configuração, o `mailto:` abre o Outlook desktop ou o app Mail nativo do sistema.

## Deploy

GitHub Pages: jogue `index.html` + `app.js` num repositório público e ative Pages.

## Persistência

- Chave `prospect_cia_v3` no localStorage (~5MB, ~50.000 contatos)
- Migração automática de bases v2 no primeiro carregamento
- Migração automática de templates v3 antigos (formato plano subject/body) → novo formato por perfil
- Export Excel com 5 abas: Base completa, Bons pendentes, Já contatados, WhatsApp pendentes, Resumo
