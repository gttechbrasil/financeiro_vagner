import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Baixa o arquivo original de uma importação (extrato/fatura). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const batch = await prisma.importBatch.findUnique({
    where: { id },
    select: { fileName: true, fileMime: true, fileData: true },
  });
  if (!batch) return NextResponse.json({ error: "Lote não encontrado" }, { status: 404 });
  if (!batch.fileData) {
    return NextResponse.json(
      { error: "Arquivo original não disponível (importação feita antes desta funcionalidade)." },
      { status: 404 }
    );
  }
  return new NextResponse(Buffer.from(batch.fileData), {
    headers: {
      "Content-Type": batch.fileMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(batch.fileName)}"`,
    },
  });
}
