import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@iron40/core/supabase/server";

// QR codes on flyers point here: count the scan, then send the visitor to the install page.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const dest = request.nextUrl.clone();
  dest.pathname = "/install";
  dest.search = "";
  if (/^[a-z0-9]{6,16}$/.test(code)) {
    const supabase = await createClient("customer");
    await supabase.rpc("record_qr_scan", { p_code: code });
  }
  return NextResponse.redirect(dest, 302);
}
