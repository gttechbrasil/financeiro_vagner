import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    return NextResponse.json(
      { error: "Informe a senha atual e uma nova senha com pelo menos 8 caracteres" },
      { status: 400 }
    );
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(String(newPassword), 10) },
  });
  return NextResponse.json({ ok: true });
}
