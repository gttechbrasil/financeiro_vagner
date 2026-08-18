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
  // Antecipação de recebíveis Asaas: o VALOR antecipado compõe a receita
  // (orientação do escritório); o CUSTO fica em 5.13 Taxa de Antecipação
  { code: "1.10", name: "Antecipação de Recebíveis", group: "RECEITA" },
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
  // Taxas do Asaas separadas por tipo (antes agrupadas em 5.5)
  { code: "5.8", name: "Taxa de Mensageria", group: "FINANCEIRO" },
  { code: "5.9", name: "Taxa de Boleto", group: "FINANCEIRO" },
  { code: "5.10", name: "Taxa Pix", group: "FINANCEIRO" },
  { code: "5.11", name: "Taxa de Cartão", group: "FINANCEIRO" },
  { code: "5.12", name: "Taxa de Transferência Bancária", group: "FINANCEIRO" },
  { code: "5.13", name: "Taxa de Antecipação", group: "FINANCEIRO" },
  { code: "5.14", name: "Taxa de Negativação", group: "FINANCEIRO" },
  { code: "5.15", name: "Taxa de Notificação WhatsApp", group: "FINANCEIRO" },
  { code: "5.16", name: "Taxa de Robô de Voz", group: "FINANCEIRO" },
  // Amortização do capital de giro compõe o DRE (orientação do escritório)
  { code: "5.17", name: "Amortização de Capital de Giro", group: "FINANCEIRO" },
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
  { code: "9.6", name: "PIX/TED entre Contas Próprias", group: "TRANSFERENCIA" },
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

// Regras iniciais de classificação automática (descrição contém o padrão).
// priority: regras mais específicas primeiro (padrão 0).
const RULES: { pattern: string; account: string; sector?: string; priority?: number }[] = [
  // ---- taxas do Asaas, cada uma na sua conta (prioridade alta: são as mais
  // específicas — "Taxa de antecipação" precisa vencer "Antecipação")
  { pattern: "Taxa de notificação", account: "5.15", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de mensageria", account: "5.8", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de boleto", account: "5.9", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de Pix", account: "5.10", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa Pix", account: "5.10", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de cartão", account: "5.11", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de transferência", account: "5.12", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de antecipação", account: "5.13", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa para negativação", account: "5.14", sector: "Financeiro", priority: 10 },
  { pattern: "Taxa de negativação", account: "5.14", sector: "Financeiro", priority: 10 },
  { pattern: "robô de voz", account: "5.16", sector: "Financeiro", priority: 10 },
  { pattern: "robo de voz", account: "5.16", sector: "Financeiro", priority: 10 },
  // ---- antecipação Asaas: valor antecipado é receita (1.10); o custo já caiu
  // nas taxas acima (prioridade maior)
  { pattern: "Antecipação", account: "1.10", sector: "Financeiro", priority: 2 },
  // ---- cobranças recebidas Asaas: reconhece o tipo pela descrição da cobrança
  { pattern: "Contrato Inicial", account: "1.1", priority: 5 },
  { pattern: "Mensalidade", account: "1.3", priority: 5 },
  { pattern: "de Êxito", account: "1.8", priority: 5 },
  // ---- tarifas bancárias genéricas
  { pattern: "Taxa De Anuidade", account: "5.4", sector: "Financeiro" },
  { pattern: "IOF", account: "5.3", sector: "Financeiro" },
  { pattern: "Tarifa", account: "5.4", sector: "Financeiro" },
  // ---- marketing
  { pattern: "Google ADS", account: "4.1", sector: "Marketing" },
  { pattern: "GOOGLE ADS", account: "4.1", sector: "Marketing" },
  { pattern: "GOOGLE", account: "4.1", sector: "Marketing", priority: -5 },
  { pattern: "FACEBK", account: "4.2", sector: "Marketing" },
  { pattern: "META ADS", account: "4.2", sector: "Marketing" },
  { pattern: "META PLATFORMS", account: "4.2", sector: "Marketing" },
  { pattern: "LINKEDIN", account: "4.3", sector: "Marketing" },
  { pattern: "FD MARKETING", account: "4.3", sector: "Marketing" },
  // ---- CRM / sistemas
  { pattern: "JUSBRASIL", account: "4.5", sector: "Jurídico" },
  { pattern: "LEGALCLOUD", account: "4.5", sector: "Jurídico" },
  { pattern: "ESCAVADOR", account: "4.5", sector: "Jurídico" },
  { pattern: "JUSFY", account: "4.5", sector: "Jurídico" },
  { pattern: "ADVBOX", account: "4.5", sector: "Jurídico" },
  { pattern: "CHATGURU", account: "4.5", sector: "Jurídico" },
  { pattern: "DOC9", account: "4.5", sector: "Jurídico" },
  { pattern: "RECLAME", account: "4.5", sector: "Jurídico" },
  // ---- tecnologia (prioridade acima de "GOOGLE" genérico)
  { pattern: "AWS", account: "4.10", sector: "Administrativo" },
  { pattern: "OPENAI", account: "4.10", sector: "Administrativo" },
  { pattern: "GOOGLE WORKSPACE", account: "4.10", sector: "Administrativo", priority: 10 },
  { pattern: "GOOGLE CLOUD", account: "4.10", sector: "Administrativo", priority: 10 },
  { pattern: "MICROSOFT", account: "4.10", sector: "Administrativo" },
  // ---- aluguéis / telefonia
  { pattern: "REGUS", account: "4.9", sector: "Administrativo" },
  { pattern: "HQ ", account: "4.9", sector: "Administrativo" },
  { pattern: "VIVO", account: "4.11", sector: "Administrativo" },
  // ---- custas processuais
  { pattern: "CUSTAS", account: "3.5", sector: "Jurídico" },
  { pattern: "TJSP", account: "3.5", sector: "Jurídico" },
  { pattern: "TRT", account: "3.5", sector: "Jurídico" },
  { pattern: "TRIBUN", account: "3.5", sector: "Jurídico" },
  { pattern: "FUNDO DA JUSTIÇA", account: "3.5", sector: "Jurídico" },
  { pattern: "FUNDO DA JUSTICA", account: "3.5", sector: "Jurídico" },
  // ---- pagamentos de fatura de cartão (transferências — fora do DRE):
  // a despesa é reconhecida na compra, nunca no pagamento da fatura
  { pattern: "Pag Fat Deb Cc", account: "9.1" },
  { pattern: "Pag Fatura Boleto", account: "9.1" },
  { pattern: "Inclusao de Pagamento", account: "9.1" },
  { pattern: "ReembolsoSaldoCredor", account: "9.1" },
  { pattern: "PORTOSEG", account: "9.1" },
  { pattern: "Pagamento de fatura", account: "9.1" },
  // ---- transferências entre contas próprias (fora do DRE)
  { pattern: "Transferência para conta bancária", account: "9.6", priority: 8 },
  { pattern: "ASAAS", account: "9.6", priority: -10 },
];

// Migração: transações classificadas na antiga "5.5 Tarifas Asaas/Cartão"
// (ou sem conta) cuja descrição casa com uma taxa específica são movidas
// para a nova conta da taxa. Regras antigas que apontavam para 5.5 são
// atualizadas para a nova conta.
const TAXA_MIGRATIONS: { pattern: string; to: string }[] = [
  { pattern: "Taxa de notificação", to: "5.15" },
  { pattern: "Taxa de mensageria", to: "5.8" },
  { pattern: "Taxa de boleto", to: "5.9" },
  { pattern: "Taxa de Pix", to: "5.10" },
  { pattern: "Taxa de cartão", to: "5.11" },
  { pattern: "Taxa de transferência", to: "5.12" },
  { pattern: "Taxa de antecipação", to: "5.13" },
  { pattern: "Taxa para negativação", to: "5.14" },
  { pattern: "Taxa de negativação", to: "5.14" },
];

// Fornecedores padrão (correção 11): se a descrição contém `pattern`
// (ou o nome), o lançamento é vinculado ao fornecedor e — sem regra mais
// específica — recebe a conta/setor padrão do fornecedor.
const SUPPLIERS: { name: string; pattern?: string; account?: string; sector?: string }[] = [
  { name: "AWS", account: "4.10", sector: "Administrativo" },
  { name: "OpenAI", pattern: "OPENAI", account: "4.10", sector: "Administrativo" },
  { name: "Microsoft", pattern: "MICROSOFT", account: "4.10", sector: "Administrativo" },
  { name: "Google", pattern: "GOOGLE", account: "4.1", sector: "Marketing" },
  { name: "Meta", pattern: "FACEBK", account: "4.2", sector: "Marketing" },
  { name: "LinkedIn", pattern: "LINKEDIN", account: "4.3", sector: "Marketing" },
  { name: "FD Marketing", pattern: "FD MARKETING", account: "4.3", sector: "Marketing" },
  { name: "Regus", pattern: "REGUS", account: "4.9", sector: "Administrativo" },
  { name: "HQ", pattern: "HQ ", account: "4.9", sector: "Administrativo" },
  { name: "JusBrasil", pattern: "JUSBRASIL", account: "4.5", sector: "Jurídico" },
  { name: "Jusfy", pattern: "JUSFY", account: "4.5", sector: "Jurídico" },
  { name: "Escavador", pattern: "ESCAVADOR", account: "4.5", sector: "Jurídico" },
  { name: "LegalCloud", pattern: "LEGALCLOUD", account: "4.5", sector: "Jurídico" },
  { name: "DOC9", account: "4.5", sector: "Jurídico" },
  { name: "Reclame Aqui", pattern: "RECLAME", account: "4.5", sector: "Jurídico" },
  { name: "AdvBox", pattern: "ADVBOX", account: "4.5", sector: "Jurídico" },
  { name: "ChatGuru", pattern: "CHATGURU", account: "4.5", sector: "Jurídico" },
  { name: "Vivo", account: "4.11", sector: "Administrativo" },
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

  // Migração das taxas Asaas: regras que apontavam para a antiga 5.5 passam a
  // apontar para a conta específica da taxa; transações já classificadas em 5.5
  // (ou ainda sem conta) cuja descrição casa com a taxa são reclassificadas.
  const acc55 = await prisma.dreAccount.findUnique({ where: { code: "5.5" } });
  for (const mig of TAXA_MIGRATIONS) {
    const to = await prisma.dreAccount.findUnique({ where: { code: mig.to } });
    if (!to) continue;
    if (acc55) {
      await prisma.rule.updateMany({
        where: { pattern: mig.pattern, accountId: acc55.id },
        data: { accountId: to.id, priority: 10 },
      });
      const moved = await prisma.transaction.updateMany({
        where: { accountId: acc55.id, description: { contains: mig.pattern } },
        data: { accountId: to.id },
      });
      if (moved.count > 0) {
        console.log(`Taxas: ${moved.count} transações 5.5 → ${mig.to} (${mig.pattern})`);
      }
    }
    const filled = await prisma.transaction.updateMany({
      where: { accountId: null, description: { contains: mig.pattern } },
      data: { accountId: to.id },
    });
    if (filled.count > 0) {
      console.log(`Taxas: ${filled.count} transações sem conta → ${mig.to} (${mig.pattern})`);
    }
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
      data: {
        pattern: r.pattern,
        accountId: account.id,
        sectorId: sector?.id ?? null,
        priority: r.priority ?? 0,
      },
    });
  }

  // Fornecedores padrão: cria os que ainda não existem (preserva edições do
  // usuário) e vincula transações existentes que casam com o padrão.
  for (const s of SUPPLIERS) {
    const exists = await prisma.supplier.findUnique({ where: { name: s.name } });
    if (exists) continue;
    const account = s.account
      ? await prisma.dreAccount.findUnique({ where: { code: s.account } })
      : null;
    const sector = s.sector
      ? await prisma.sector.findUnique({ where: { name: s.sector } })
      : null;
    await prisma.supplier.create({
      data: {
        name: s.name,
        pattern: s.pattern ?? null,
        defaultAccountId: account?.id ?? null,
        defaultSectorId: sector?.id ?? null,
      },
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
