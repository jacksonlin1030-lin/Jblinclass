import { NextRequest, NextResponse } from "next/server";
import { updateStudent } from "@/lib/store";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const patch: { name?: string; active?: boolean } = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    await updateStudent(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新學生失敗" }, { status: 500 });
  }
}
