import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Informe usuário e senha" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { username: String(username).toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  }
  await createSession(user.id, user.name);
  return NextResponse.json({ ok: true });
}
