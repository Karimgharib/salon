"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { useSupabaseMutate } from "@/hooks/useSupabaseMutate";
import {
  Scissors,
  Calendar,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  UserPlus,
  Home,
  Radio,
  Loader2,
  Banknote,
} from "lucide-react";

// مؤقتاً لحد ما نربط Supabase Auth في الخطوة الرابعة
const CURRENT_SHOP_ID = "11111111-1111-1111-1111-111111111111";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedBarberFilter, setSelectedBarberFilter] =
    useState<string>("all");

  // States مودال الـ Walk-in السريع
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInBarberId, setWalkInBarberId] = useState("");
  const [walkInServiceId, setWalkInServiceId] = useState("");
  const [walkInName, setWalkInName] = useState("");

  // 1. جلب بيانات الصالون (الحلاقين والخدمات)
  const { data: shop } = useSupabaseQuery({
    table: "barbershops",
    queryKey: ["shop-details", CURRENT_SHOP_ID],
    select: "*, barbers(*), services(*)",
    filters: { id: CURRENT_SHOP_ID },
    single: true,
  });

  // 2. جلب حجوزات اليوم المختار
  const startOfDay = new Date(`${selectedDate}T00:00:00`).toISOString();
  const endOfDay = new Date(`${selectedDate}T23:59:59`).toISOString();
  const appointmentsKey = [
    "dashboard-appointments",
    CURRENT_SHOP_ID,
    selectedDate,
  ];

  const { data: appointments = [], isLoading } = useSupabaseQuery<any[]>({
    table: "appointments",
    queryKey: appointmentsKey,
    select: "*, barbers(name), services(name, duration_minutes)",
    filters: {
      barbershop_id: CURRENT_SHOP_ID,
      "start_time.gte": startOfDay,
      "start_time.lte": endOfDay,
    },
    orderBy: { column: "start_time", asc: true },
  });

  // 3. تفعيل Supabase Realtime للاستماع لأي حجز جديد لحظياً
  useEffect(() => {
    const channel = supabase
      .channel("realtime-appointments")
      .on(
        "postgres_changes",
        {
          event: "*", // استماع لـ INSERT, UPDATE, DELETE
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${CURRENT_SHOP_ID}`,
        },
        (payload) => {
          console.log("🔔 حدث لحظي جديد في الحجوزات:", payload);
          // تحديث الكاش أوتوماتيك عشان يظهر الحجز فوراً على الشاشة
          queryClient.invalidateQueries({ queryKey: appointmentsKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, queryClient]);

  // 4. Mutation لتحديث حالة الحجز (مكتمل / ملغي)
  const { mutate: updateStatus, isPending: isUpdating } = useSupabaseMutate({
    table: "appointments",
    method: "update",
    queryKeysToInvalidate: [appointmentsKey],
  });

  // 5. Mutation لإضافة زبون مباشر (Walk-in) فوراً
  const { mutate: addWalkIn, isPending: isAddingWalkIn } = useSupabaseMutate({
    table: "appointments",
    method: "insert",
    queryKeysToInvalidate: [appointmentsKey],
    onSuccess: () => {
      setShowWalkInModal(false);
      setWalkInName("");
    },
  });

  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    const barberId = walkInBarberId || shop.barbers[0]?.id;
    const service =
      shop.services.find((s: any) => s.id === walkInServiceId) ||
      shop.services[0];

    const now = new Date();
    const end = new Date(now.getTime() + service.duration_minutes * 60000);

    addWalkIn({
      barbershop_id: CURRENT_SHOP_ID,
      barber_id: barberId,
      service_id: service.id,
      customer_name: walkInName.trim() || "زبون مباشر (Walk-in)",
      customer_phone: "00000000000",
      start_time: now.toISOString(),
      end_time: end.toISOString(),
      is_home_service: false,
      total_price: service.price,
      status: "walk_in",
    });
  };

  // فلترة الحجوزات حسب الحلاق لو المستخدم اختار حلاق معين
  const filteredAppointments = appointments.filter((appt) =>
    selectedBarberFilter === "all"
      ? true
      : appt.barber_id === selectedBarberFilter,
  );

  // حساب الإحصائيات السريعة
  const activeAppointments = filteredAppointments.filter(
    (a) => a.status !== "cancelled",
  );
  const completedRevenue = filteredAppointments
    .filter((a) => a.status === "completed" || a.status === "walk_in")
    .reduce((sum, a) => sum + Number(a.total_price), 0);
  const expectedRevenue = activeAppointments.reduce(
    (sum, a) => sum + Number(a.total_price),
    0,
  );

  return (
    <main className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* شريط الهوية العلوي */}
      <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,#ffffff,#ffffff_12px,#000000_12px,#000000_24px)] border-b border-zinc-800" />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* الهيدر ومؤشر الـ Realtime */}
        <header className="flex flex-wrap justify-between items-center gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black">
                لوحة تحكم {shop?.name || "الصالون"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-[11px] font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                مباشر (Live)
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              إدارة الحجوزات اللحظية والزبائن المباشرين
            </p>
          </div>

          {/* زر تسجيل زبون مباشر Walk-in */}
          <button
            onClick={() => {
              if (shop?.barbers?.[0]) setWalkInBarberId(shop.barbers[0].id);
              if (shop?.services?.[0]) setWalkInServiceId(shop.services[0].id);
              setShowWalkInModal(true);
            }}
            className="px-5 py-3 rounded-xl bg-white text-black font-black text-sm hover:bg-zinc-200 transition flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ زبون مباشر (Walk-in)</span>
          </button>
        </header>

        {/* كروت الإحصائيات */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">إجمالي مواعيد اليوم</span>
            <p className="text-3xl font-black">{activeAppointments.length}</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">إيراد محقق (مكتمل)</span>
            <p className="text-3xl font-black">
              {completedRevenue}{" "}
              <span className="text-xs font-normal text-zinc-400">ج.م</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-xs text-zinc-400">
              إجمالي الإيراد المتوقع
            </span>
            <p className="text-3xl font-black text-zinc-300">
              {expectedRevenue}{" "}
              <span className="text-xs font-normal text-zinc-500">ج.م</span>
            </p>
          </div>
        </section>

        {/* أدوات الفلترة (التاريخ + الحلاق) */}
        <section className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
          {/* فلتر الحلاقين */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedBarberFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                selectedBarberFilter === "all"
                  ? "bg-white text-black border-white"
                  : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600"
              }`}
            >
              كل الحلاقين
            </button>
            {shop?.barbers?.map((barber: any) => (
              <button
                key={barber.id}
                onClick={() => setSelectedBarberFilter(barber.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                  selectedBarberFilter === barber.id
                    ? "bg-white text-black border-white"
                    : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                ✂️ {barber.name}
              </button>
            ))}
          </div>

          {/* اختيار التاريخ */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-xl bg-black border border-zinc-800 text-white text-xs font-bold focus:outline-none focus:border-white [color-scheme:dark]"
          />
        </section>

        {/* قائمة الحجوزات (Timeline) */}
        <section className="space-y-3">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>جاري تحميل جدول المواعيد...</span>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-zinc-950 border border-zinc-800 text-zinc-500 space-y-2">
              <Calendar className="w-8 h-8 mx-auto opacity-40" />
              <p className="font-bold text-sm">
                لا توجد حجوزات مسجلة في هذا اليوم
              </p>
            </div>
          ) : (
            filteredAppointments.map((appt) => {
              const startTime = new Date(appt.start_time).toLocaleTimeString(
                "en-GB",
                { hour: "2-digit", minute: "2-digit" },
              );
              const endTime = new Date(appt.end_time).toLocaleTimeString(
                "en-GB",
                { hour: "2-digit", minute: "2-digit" },
              );

              const isCancelled = appt.status === "cancelled";
              const isCompleted =
                appt.status === "completed" || appt.status === "walk_in";

              return (
                <div
                  key={appt.id}
                  className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCancelled
                      ? "bg-zinc-950/40 border-zinc-900 opacity-50"
                      : isCompleted
                        ? "bg-zinc-950 border-zinc-700"
                        : "bg-zinc-950 border-white"
                  }`}
                >
                  {/* تفاصيل الميعاد والعميل */}
                  <div className="flex items-start gap-4">
                    {/* مربع الوقت */}
                    <div className="bg-white text-black px-3.5 py-2.5 rounded-xl text-center shrink-0 min-w-[80px]">
                      <p className="font-black text-base leading-none">
                        {startTime}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-bold mt-1">
                        إلى {endTime}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-base">
                          {appt.customer_name}
                        </h3>

                        {/* بادج نوع الحجز أو الحالة */}
                        {appt.status === "walk_in" && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-white border border-zinc-600">
                            🚶 زبون مباشر
                          </span>
                        )}
                        {appt.status === "completed" && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-black">
                            ✓ مكتمل
                          </span>
                        )}
                        {appt.status === "cancelled" && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-400 line-through">
                            ملغي
                          </span>
                        )}
                        {appt.is_home_service && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-black">
                            <Home className="w-3 h-3" />
                            زيارة منزلية
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        <span>✂️ الكابتن: {appt.barbers?.name}</span>
                        <span>•</span>
                        <span>{appt.services?.name}</span>
                        <span>•</span>
                        <span className="text-white font-bold">
                          {appt.total_price} ج.م
                        </span>
                      </div>

                      {appt.customer_phone !== "00000000000" && (
                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                          <a
                            href={`tel:${appt.customer_phone}`}
                            className="flex items-center gap-1 hover:text-white underline"
                            dir="ltr"
                          >
                            <Phone className="w-3 h-3" />
                            {appt.customer_phone}
                          </a>

                          {appt.customer_address && (
                            <span className="flex items-center gap-1 text-zinc-300">
                              <MapPin className="w-3.5 h-3.5 text-white" />
                              {appt.customer_address}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أزرار التحكم في حالة الحجز */}
                  {appt.status === "confirmed" && (
                    <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-800">
                      <button
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus({ id: appt.id, status: "completed" })
                        }
                        className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تمت الحلاقة</span>
                      </button>

                      <button
                        disabled={isUpdating}
                        onClick={() =>
                          updateStatus({ id: appt.id, status: "cancelled" })
                        }
                        className="px-3 py-2.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800 font-bold text-xs transition flex items-center justify-center gap-1"
                        title="إلغاء الحجز"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>إلغاء</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* نافذة إضافة زبون مباشر (Walk-in Modal) */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateWalkIn}
            className="w-full max-w-md bg-zinc-950 border-2 border-white rounded-2xl p-6 space-y-5"
          >
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-black text-lg">تسجيل زبون مباشر الآن</h3>
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="text-zinc-400 hover:text-white text-sm font-bold"
              >
                ✕ إغلاق
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                  الحلاق
                </label>
                <select
                  value={walkInBarberId}
                  onChange={(e) => setWalkInBarberId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white text-sm font-bold focus:outline-none focus:border-white"
                >
                  {shop?.barbers?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                  الخدمة
                </label>
                <select
                  value={walkInServiceId}
                  onChange={(e) => setWalkInServiceId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white text-sm font-bold focus:outline-none focus:border-white"
                >
                  {shop?.services
                    ?.filter((s: any) => !s.is_home_service)
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.price} ج.م - {s.duration_minutes} د)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                  اسم الزبون (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="زبون مباشر"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAddingWalkIn}
              className="w-full py-3.5 rounded-xl bg-white text-black font-black text-sm hover:bg-zinc-200 transition"
            >
              {isAddingWalkIn ? "جاري التسجيل..." : "تأكيد وقفل الموعد الآن"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
