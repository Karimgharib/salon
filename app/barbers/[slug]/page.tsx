import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Scissors, Phone, Clock } from "lucide-react";
import BookingSection from "@/components/BookingSection";

export const instant = false;

export default async function BarberShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: shop, error } = await supabase
    .from("barbershops")
    .select(
      `
      *,
      barbers (*),
      services (*)
    `,
    )
    .eq("slug", slug)
    .single();

  if (error || !shop) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* شريط هوية الحلاقة العلوي */}
      <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,#ffffff,#ffffff_12px,#000000_12px,#000000_24px)] border-b border-zinc-800" />

      <div className="max-w-xl mx-auto px-6 py-10 space-y-10">
        {/* هيدر الصالون */}
        <header className="border-b border-zinc-800 pb-8 flex justify-between items-start">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-black text-xs font-bold tracking-wider uppercase">
              <Scissors className="w-3.5 h-3.5" />
              <span>صالون رجالي</span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white">
              {shop.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-white" />
                <span dir="ltr">{shop.phone}</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-white" />
                <span>
                  {shop.open_time.slice(0, 5)} - {shop.close_time.slice(0, 5)}
                </span>
              </span>
            </div>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center border-2 border-white shrink-0 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
            <Scissors className="w-7 h-7" />
          </div>
        </header>

        {/* مكون الحجز التفاعلي */}
        <BookingSection shop={shop} />
      </div>
    </main>
  );
}
