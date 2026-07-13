import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ACCOUNTS: { code: string; name: string; group: string }[] = [
  // 1. Receitas Operacionais
  { code: "1.1", name: "Contrato Inicial", group: "RECEITA" },
  { code: "1.2", name: "Aditivo Contratual", group: "RECEITA" },
  { code: "1.3", name: "Mensalidade (Assessoria Jurídica)", group: "RECEITA" },
  { code: "1.4", name: "Diligência", group: "RECEITA" },
  { code: "1.5", name: "Recurso", group: "RECEITA" },
  { code: "1.6", name: "Consultoria", group: "RECEITA" },
  { code: "1.7", name: "Honorários Avulsos", group: "RECEITA" },
  { code: "1.8", name: "Honorários de Êxito", group: "RECEITA" },
  { code: "1.9", name: "Outros Honorários", group: "RECEITA" },
  // 2. Deduções da Receita
  { code: "2.1", name: "Cancelamentos", group: "DEDUCAO" },
  { code: "2.2", name: "Estornos", group: "DEDUCAO" },
  { code: "2.3", name: "Descontos Concedidos", group: "DEDUCAO" },
  { code: "2.4", name: "Perdas por Inadimplência", group: "DEDUCAO" },
  // 3. Custos Diretos
  { code: "3.1", name: "Honorários Advogados Associados", group: "CUSTO" },
  { code: "3.2", name: "Estagiários", group: "CUSTO" },
  { code: "3.3", name: "Correspondentes Jurídicos", group: "CUSTO" },
  { code: "3.4", name: "Diligências Terceirizadas", group: "CUSTO" },
  { code: "3.5", name: "Custas Processuais", group: "CUSTO" },
  { code: "3.6", name: "Emolumentos", group: "CUSTO" },
  { code: "3.7", name: "Correios", group: "CUSTO" },
  { code: "3.8", name: "Reembolso de Despesas", group: "CUSTO" },
  // 3.9 Sistemas Jurídicos foi unificado com 4.5 CRM/Sistemas (ver main())
  { code: "3.10", name: "Registradores", group: "CUSTO" },
  // 4. Despesas Operacionais
  { code: "4.1", name: "Google Ads", group: "DESPESA" },
  { code: "4.2", name: "Meta Ads", group: "DESPESA" },
  { code: "4.3", name: "Agência de Marketing", group: "DESPESA" },
  { code: "4.4", name: "Produção de Conteúdo", group: "DESPESA" },
  { code: "4.5", name: "CRM/Sistemas", group: "DESPESA" },
  { code: "4.6", name: "Honorários Administrativos", group: "DESPESA" },
  { code: "4.7", name: "Contabilidade", group: "DESPESA" },
  { code: "4.8", name: "Financeiro", group: "DESPESA" },
  { code: "4.9", name: "Regus/Aluguéis", group: "DESPESA" },
  { code: "4.10", name: "Tecnologia", group: "DESPESA" },
  { code: "4.11", name: "Telefonia/Internet", group: "DESPESA" },
  { code: "4.12", name: "Material de Escritório", group: "DESPESA" },
  { code: "4.13", name: "Treinamentos/Eventos", group: "DESPESA" },
  { code: "4.14", name: "Outras Despesas Gerais", group: "DESPESA" },
  // 5. Resultado Financeiro
  { code: "5.1", name: "Rendimentos Financeiros", group: "FINANCEIRO" },
  { code: "5.2", name: "Juros Bancários", group: "FINANCEIRO" },
  { code: "5.3", name: "IOF", group: "FINANCEIRO" },
  { code: "5.4", name: "Tarifas Bancárias", group: "FINANCEIRO" },
  { code: "5.5", name: "Tarifas Asaas/Cartão", group: "FINANCEIRO" },
  { code: "5.6", name: "Juros de Empréstimos", group: "FINANCEIRO" },
  { code: "5.7", name: "Crédito Rotativo", group: "FINANCEIRO" },
  // 6. Resultado Não Operacional
  { code: "6.1", name: "Investimentos", group: "NAO_OPERACIONAL" },
  { code: "6.2", name: "Baixa de Ativos", group: "NAO_OPERACIONAL" },
  { code: "6.3", name: "Multas/Perdas Extraordinárias", group: "NAO_OPERACIONAL" },
  // 7 e 8
  { code: "7.1", name: "Pró-Labore", group: "PRO_LABORE" },
  { code: "8.1", name: "Distribuição de Lucros", group: "DISTRIBUICAO" },
  // 9. Transferências — classificadas mas NUNCA entram no DRE
  // (movimentações que não são receita nem despesa do período)
  { code: "9.1", name: "Pagamento de Cartão / Transferências", group: "TRANSFERENCIA" },
  { code: "9.2", name: "Empréstimo", group: "TRANSFERENCIA" },
  { code: "9.3", name: "Aporte Sócio", group: "TRANSFERENCIA" },
  { code: "9.4", name: "Repasse MLE", group: "TRANSFERENCIA" },
  { code: "9.5", name: "Adiantamento Cobranças", group: "TRANSFERENCIA" },
  // 10. Despesas Pessoais — classificadas mas NUNCA entram no DRE
  // (gastos pessoais nos extratos/cartões PF; despesas do escritório nesses
  // extratos continuam nas contas normais: Google, Meta, sistemas jurídicos...)
  { code: "10.1", name: "Despesas Pessoais", group: "PESSOAL" },
];

const SECTORS = ["Diretoria", "Jurídico", "Comercial", "Marketing", "Financeiro", "Administrativo"];
const UNITS = ["São Paulo", "Rio de Janeiro", "Minas Gerais", "Paraná", "Rio Grande do Sul"];

const BANK_ACCOUNTS: { name: string; kind: string }[] = [
  { name: "Asaas", kind: "ASAAS" },
  { name: "Conta Sicredi PJ", kind: "CONTA_CORRENTE" },
  { name: "Cartão Sicredi PJ", kind: "CARTAO_CREDITO" },
  { name: "Cartão Sicredi PF", kind: "CARTAO_CREDITO" },
  { name: "Cartão C6 PJ", kind: "CARTAO_CREDITO" },
  { name: "Cartão Porto Seguro PF", kind: "CARTAO_CREDITO" },
  { name: "Nubank PF", kind: "CONTA_CORRENTE" },
];

// Regras iniciais de classificação automática (descrição contém o padrão)
const RULES: { pattern: string; account: string; sector?: string }[] = [
  { pattern: "Taxa de notificação", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa de mensageria", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa de boleto", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa de antecipação", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa para negativação", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa de transferência", account: "5.5", sector: "Financeiro" },
  { pattern: "Taxa De Anuidade", account: "5.4", sector: "Financeiro" },
  { pattern: "IOF", account: "5.3", sector: "Financeiro" },
  { pattern: "Tarifa", account: "5.4", sector: "Financeiro" },
  { pattern: "Google ADS", account: "4.1", sector: "Marketing" },
  { pattern: "GOOGLE ADS", account: "4.1", sector: "Marketing" },
  { pattern: "FACEBK", account: "4.2", sector: "Marketing" },
  { pattern: "META ADS", account: "4.2", sector: "Marketing" },
  { pattern: "JUSBRASIL", account: "4.5", sector: "Jurídico" },
  { pattern: "LEGALCLOUD", account: "4.5", sector: "Jurídico" },
  { pattern: "ESCAVADOR", account: "4.5", sector: "Jurídico" },
  { pattern: "JUSFY", account: "4.5", sector: "Jurídico" },
  { pattern: "ADVBOX", account: "4.5", sector: "Jurídico" },
  { pattern: "CHATGURU", account: "4.5", sector: "Jurídico" },
  { pattern: "DOC9", account: "4.5", sector: "Jurídico" },
  { pattern: "AWS", account: "4.10", sector: "Administrativo" },
  { pattern: "OPENAI", account: "4.10", sector: "Administrativo" },
  { pattern: "GOOGLE WORKSPACE", account: "4.10", sector: "Administrativo" },
  { pattern: "MICROSOFT", account: "4.10", sector: "Administrativo" },
  { pattern: "REGUS", account: "4.9", sector: "Administrativo" },
  { pattern: "CUSTAS", account: "3.5", sector: "Jurídico" },
  { pattern: "TJSP", account: "3.5", sector: "Jurídico" },
  { pattern: "TRIBUN", account: "3.5", sector: "Jurídico" },
  // pagamentos de fatura de cartão (transferências — fora do DRE)
  { pattern: "Pag Fat Deb Cc", account: "9.1" },
  { pattern: "Pag Fatura Boleto", account: "9.1" },
  { pattern: "Inclusao de Pagamento", account: "9.1" },
  { pattern: "ReembolsoSaldoCredor", account: "9.1" },
  { pattern: "PORTOSEG", account: "9.1" },
  { pattern: "Pagamento de fatura", account: "9.1" },
];

async function main() {
  // Usuário único
  const passwordHash = await bcrypt.hash("Maschio@2026", 10);
  await prisma.user.upsert({
    where: { username: "vagner" },
    update: {},
    create: { username: "vagner", name: "Vagner Maschio Pionorio", passwordHash },
  });

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const a = ACCOUNTS[i];
    await prisma.dreAccount.upsert({
      where: { code: a.code },
      update: { name: a.name, group: a.group, sortOrder: i },
      create: { ...a, sortOrder: i },
    });
  }

  for (const name of SECTORS) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of UNITS) {
    await prisma.unit.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const b of BANK_ACCOUNTS) {
    await prisma.bankAccount.upsert({ where: { name: b.name }, update: {}, create: b });
  }

  // Unificação: 3.9 Sistemas Jurídicos → 4.5 CRM/Sistemas
  // (move transações e regras, desativa a conta antiga)
  const old39 = await prisma.dreAccount.findUnique({ where: { code: "3.9" } });
  const acc45 = await prisma.dreAccount.findUnique({ where: { code: "4.5" } });
  if (old39 && acc45) {
    const moved = await prisma.transaction.updateMany({
      where: { accountId: old39.id },
      data: { accountId: acc45.id },
    });
    await prisma.rule.updateMany({
      where: { accountId: old39.id },
      data: { accountId: acc45.id },
    });
    if (old39.active) {
      await prisma.dreAccount.update({ where: { id: old39.id }, data: { active: false } });
    }
    if (moved.count > 0) {
      console.log(`Unificação 3.9→4.5: ${moved.count} transações movidas.`);
    }
  }

  // Renomear "Imposto" → "Imposto/Tributos" (conta criada pelo usuário, se existir)
  const imposto = await prisma.dreAccount.findFirst({
    where: { name: { in: ["Imposto", "Impostos"] } },
  });
  if (imposto) {
    await prisma.dreAccount.update({
      where: { id: imposto.id },
      data: { name: "Imposto/Tributos" },
    });
  }

  // idempotente: cria apenas as regras cujo padrão ainda não existe,
  // preservando regras criadas/editadas pelo usuário
  for (const r of RULES) {
    const exists = await prisma.rule.findFirst({ where: { pattern: r.pattern } });
    if (exists) continue;
    const account = await prisma.dreAccount.findUnique({ where: { code: r.account } });
    if (!account) continue;
    const sector = r.sector
      ? await prisma.sector.findUnique({ where: { name: r.sector } })
      : null;
    await prisma.rule.create({
      data: { pattern: r.pattern, accountId: account.id, sectorId: sector?.id ?? null },
    });
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
