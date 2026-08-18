# Maschio Pionorio · Gestão Financeira (DRE Gerencial)

Sistema de controle financeiro com login único para o escritório Maschio Pionorio
Sociedade Individual de Advocacia (Dr. Vagner). Implementa o modelo de DRE Gerencial
acordado (planilha `Modelo_DRE_Gerencial_Escritorio_Advocacia.xlsx`), com importação
de extratos bancários e classificação automática de lançamentos.

**Stack:** Next.js 16 (App Router) · TypeScript · Prisma 6 · SQLite · Tailwind CSS · Recharts

## Como rodar

```bash
npm install
npx prisma migrate dev   # cria o banco (prisma/dev.db) — só na primeira vez
npx prisma db seed       # plano de contas, setores, unidades, regras e usuário
npm run dev              # desenvolvimento (http://localhost:3000)
# ou produção:
npm run build && npm start
```

## Acesso

| Campo   | Valor          |
|---------|----------------|
| Usuário | `vagner`       |
| Senha   | `Maschio@2026` |

> ⚠️ Troque a senha no primeiro acesso em **Configurações → Alterar senha**.

## Funcionalidades

- **Dashboard** — KPIs do ano (Receita, Receita Líquida, EBITDA e margem, Resultado
  Líquido, % Marketing, % Equipe Jurídica, Resultado Financeiro, Deduções/Inadimplência),
  gráfico Receita × Despesas por mês e receita por tipo de serviço.
- **DRE Gerencial** — contas × 12 meses + Total + Média, com os grupos 1–8 do modelo e
  subtotais em cascata (Receita Líquida, Resultado Bruto, EBITDA, Resultado Financeiro
  Líquido, Lucro Operacional, Resultado Líquido do Período).
- **Transações** — filtros por ano/mês/origem/conta/texto, classificação individual ou
  em lote (conta DRE + centro de custo Setor/Unidade), exclusão, destaque das não
  classificadas.
- **Importar Extratos** — upload → análise → prévia com classificação automática →
  confirmação. Duplicados são detectados e pulados (pode reimportar o mesmo arquivo sem
  medo). Importações podem ser desfeitas ("Desfazer" no histórico de lotes).
- **Regras** — "se a descrição contém X → conta Y (+ setor/unidade)". Aplicadas na
  importação. Já vem com ~28 regras (taxas Asaas, IOF, Google Ads, sistemas jurídicos...).
- **Previsão no DRE** — meses futuros mostram projeção (em azul itálico) composta por:
  (a) parcelas restantes de compras parceladas (extraídas automaticamente das faturas:
  "parcela 03/10") e (b) média mensal das despesas marcadas como **fixa mensal**
  (📌 na tela de Transações, individual ou em lote). Toggle "Com previsão / Só realizado"
  no DRE. Se a fatura de um mês futuro já foi importada, a projeção daquele cartão
  naquele mês é suprimida para não duplicar.
- **Cadastros** — plano de contas do DRE, setores, unidades e contas bancárias.
- **Drill-down do DRE** — qualquer valor do DRE é clicável e abre a lista dos lançamentos
  que o compõem (data, descrição, origem, valor, conta, setor, unidade), com
  reclassificação direto na lista e edição completa do lançamento no modal.
- **Fornecedores** — cadastro com classificação padrão (ex.: AWS → Tecnologia). Na
  importação, lançamentos que contêm o padrão são vinculados ao fornecedor e recebem a
  conta/setor/unidade padrão automaticamente. Botão "Aplicar aos lançamentos existentes"
  faz o mesmo retroativamente.
- **Relatórios** — totais por fornecedor, categoria (conta DRE), setor, unidade e origem,
  além da visão hierárquica Conta DRE → Fornecedor → Lançamentos.
- **Auditoria** — tela dedicada de "lançamentos não classificados" (todos os anos), com
  classificação inline; a Sidebar mostra um aviso com a contagem de pendências enquanto
  existir lançamento sem conta do DRE.
- **Classificação por histórico** — na importação, lançamentos com a mesma descrição de
  um lançamento já classificado repetem a classificação anterior automaticamente.
- **Taxas Asaas separadas** — mensageria, boleto, Pix, cartão, transferência,
  antecipação, negativação, notificação WhatsApp e robô de voz, cada uma na sua conta
  (5.8–5.16), preenchidas automaticamente pelo tipo de transação do extrato.
- **Antecipações Asaas** — o valor antecipado entra como receita
  (1.10 Antecipação de Recebíveis) e o custo como despesa financeira
  (5.13 Taxa de Antecipação), separados automaticamente.

## Formatos de importação suportados

| Origem                    | Formato | Observação |
|---------------------------|---------|------------|
| Asaas                     | CSV     | Extrato completo; taxas classificadas automaticamente |
| Sicredi conta corrente PJ | XLS     | Extrato mensal |
| Sicredi cartão PJ         | XLS     | Fatura (despesas viram débito) |
| Sicredi cartão PF         | CSV     | Fatura |
| Nubank                    | OFX     | Extrato (formato bancário padrão) |
| Porto Seguro cartão       | PDF     | Fatura com texto — parser nativo |
| **C6 cartão**             | PDF     | **Fatura escaneada (imagem) — requer IA** (ver abaixo) |
| Word                      | DOCX    | Linhas no padrão `dd/mm/aaaa descrição valor` |

### PDFs escaneados (C6) — extração por IA

A fatura do C6 é um PDF de imagem, sem texto extraível. O sistema envia o PDF para a
API da Anthropic (Claude), que devolve os lançamentos em JSON estruturado. Para
habilitar:

1. Crie uma chave em <https://console.anthropic.com>.
2. No arquivo `.env`, descomente e preencha `ANTHROPIC_API_KEY="sk-ant-..."`.
3. Reinicie o servidor. O status aparece em **Configurações**.

Sem a chave, os demais formatos funcionam normalmente; apenas PDFs de imagem ficam
indisponíveis. Cada fatura extraída consome créditos da API (centavos de dólar por
documento).

## Convenções

- Valores em **centavos** com sinal: crédito positivo, débito negativo.
- Fatura de cartão: despesa vira débito (−) e pagamento/estorno vira crédito (+).
  Se algum arquivo vier com sinais invertidos, use o botão **"Inverter sinais"** na prévia.
- Pagamento de fatura aparece duas vezes (débito na conta corrente e crédito no cartão);
  ambos devem ser classificados na conta **9.1 Pagamento de Cartão / Transferências**
  (grupo "Transferências"), que **não entra no DRE** — já existem regras automáticas
  para os padrões conhecidos ("Pag Fat Deb Cc", "Pag Fatura Boleto", "PORTOSEG"...).
- Gastos pessoais em extratos/cartões PF devem ser classificados na conta
  **10.1 Despesas Pessoais** (grupo "Despesas Pessoais"), que também **não entra no DRE**.
  As despesas do escritório que aparecem nesses extratos (Google Ads, Meta, sistemas
  jurídicos, desenvolvedor...) continuam nas contas normais do DRE — use a
  classificação em massa por filtro na tela de Transações para agilizar.
- As "Cobranças recebidas" do Asaas são classificadas automaticamente quando a descrição
  da cobrança contém "Contrato Inicial" (→ 1.1), "Mensalidade" (→ 1.3) ou "de Êxito"
  (→ 1.8). Outros padrões: classifique na tela de Transações ou crie regras.
- Transferências entre contas próprias (PIX/TED, saque do Asaas para o Sicredi) vão para
  **9.6 PIX/TED entre Contas Próprias** (fora do DRE). Antecipações e amortização de
  capital de giro **entram** no DRE (1.10, 5.13 e 5.17).
- Centros de custo (Setor/Unidade) não duplicam o plano de contas: identificam quem
  gerou a despesa, conforme o modelo.

## Estrutura

```
prisma/schema.prisma      # modelo de dados (SQLite em prisma/dev.db)
prisma/seed.ts            # plano de contas, setores, unidades, regras, usuário
src/lib/parsers/          # asaas, sicredi, ofx, pdf, docx, ai (Anthropic)
src/lib/dre.ts            # cálculo do DRE (grupos, subtotais em cascata)
src/lib/rules.ts          # classificação automática por regras
src/app/api/              # rotas: import, transactions, rules, cadastros, auth...
src/app/(app)/            # telas: dashboard, dre, transacoes, importar, regras...
scripts/test-parsers.ts   # teste manual dos parsers (npx tsx scripts/test-parsers.ts)
```

## Backup

Todo o dado vive em `prisma/dev.db` (um único arquivo SQLite). Copie esse arquivo
periodicamente para fazer backup.
