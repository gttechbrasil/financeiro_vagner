import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// CRUD genérico para cadastros simples: setores, unidades, contas bancárias e
// contas do DRE (plano de contas).
const ENTITIES = {
  setores: "sector",
  unidades: "unit",
  "contas-bancarias": "bankAccount",
  "plano-de-contas": "dreAccount",
} as const;

type EntityKey = keyof typeof ENTITIES;

function model(entity: string) {
  const name = ENTITIES[entity as EntityKey];
  if (!name) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[name];
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const m = model(entity);
  if (!m) return NextResponse.json({ error: "Entidade inválida" }, { status: 404 });
  const orderBy = entity === "plano-de-contas" ? { sortOrder: "asc" } : { name: "asc" };
  return NextResponse.json(await m.findMany({ orderBy }));
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const m = model(entity);
  if (!m) return NextResponse.json({ error: "Entidade inválida" }, { status: 404 });
  const b = await req.json();
  try {
    if (entity === "plano-de-contas") {
      if (!b.code || !b.name || !b.group) {
        return NextResponse.json({ error: "Informe código, nome e grupo" }, { status: 400 });
      }
      const max = await prisma.dreAccount.aggregate({ _max: { sortOrder: true } });
      return NextResponse.json(
        await m.create({
          data: { code: b.code, name: b.name, group: b.group, sortOrder: (max._max.sortOrder ?? 0) + 1 },
        })
      );
    }
    if (!b.name) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });
    const data: Record<string, unknown> = { name: b.name };
    if (entity === "contas-bancarias") data.kind = b.kind ?? "CONTA_CORRENTE";
    return NextResponse.json(await m.create({ data }));
  } catch {
    return NextResponse.json({ error: "Já existe um registro com esse nome/código" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const m = model(entity);
  if (!m) return NextResponse.json({ error: "Entidade inválida" }, { status: 404 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "group", "kind", "active", "sortOrder"]) {
    if (k in b) data[k] = b[k];
  }
  return NextResponse.json(await m.update({ where: { id: b.id }, data }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const m = model(entity);
  if (!m) return NextResponse.json({ error: "Entidade inválida" }, { status: 404 });
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "Informe id" }, { status: 400 });
  try {
    await m.delete({ where: { id: b.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não é possível excluir: há transações vinculadas. Desative em vez de excluir." },
      { status: 409 }
    );
  }
}
