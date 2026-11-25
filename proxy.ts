import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// غيرنا اسم الدالة هنا من middleware لـ proxy
export function proxy(req: NextRequest) {
  const url = req.nextUrl;

  // 1. قراءة الـ Host اللي العميل كاتبه (مثلاً: vip-fade.localhost:3000)
  const hostname = req.headers.get("host") || "";

  // 2. إزالة رقم البورت (:3000)
  const cleanHost = hostname.split(":")[0];

  // 3. تحديد الدومين الأساسي
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

  // 4. فحص هل الرابط فيه Subdomain فعلاً؟
  const isSubdomain =
    cleanHost.endsWith(`.${rootDomain}`) && cleanHost !== `www.${rootDomain}`;

  if (isSubdomain) {
    const subdomain = cleanHost.replace(`.${rootDomain}`, "");

    // إعادة توجيه مخفية (Rewrite) لصفحة الصالون
    return NextResponse.rewrite(
      new URL(`/barbers/${subdomain}${url.pathname}`, req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
