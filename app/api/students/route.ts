import { NextRequest, NextResponse } from "next/server";
import { getStudents, addStudent } from "@/lib/store";

export async function GET() {
  try {
    const students = await getStudents();
    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取學生資料失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "請輸入學生姓名" }, { status: 400 });
    }
    const student = await addStudent(body.name);
    return NextResponse.json({ student });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "新增學生失敗" }, { status: 500 });
  }
}
