"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Scissors,
  Clock,
  Home,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { useSupabaseMutate } from "@/hooks/useSupabaseMutate";
import { generateAvailableSlots, TimeSlot, BookedSlot } from "@/lib/slots";

interface Barber {
  id: string;
  name: string;
  is_active: boolean;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_home_service: boolean;
  buffer_time_minutes: number;
}

interface Shop {
  id: string;
  name: string;
  open_time: string;
  close_time: string;
  barbers: Barber[];
  services: Service[];
}

export default function BookingSection({ shop }: { shop: Shop }) {
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. States الاختيارات
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(
    shop.barbers[0] || null,
  );
  const [selectedService, setSelectedService] = useState<Service | null>(
    shop.services[0] || null,
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // 2. States بيانات العميل
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // 3. سحب حجوزات الحلاق في التاريخ المختار باستخدام الهوك
  const startOfDay = new Date(`${selectedDate}T00:00:00`).toISOString();
  const endOfDay = new Date(`${selectedDate}T23:59:59`).toISOString();

  const appointmentQueryKey = [
    "appointments",
    shop.id,
    selectedBarber?.id,
    selectedDate,
  ];

  const { data: bookedAppointments = [], isLoading: loadingSlots } =
    useSupabaseQuery<BookedSlot[]>({
      table: "appointments",
      queryKey: appointmentQueryKey,
      select: "start_time, end_time",
      filters: {
        barbershop_id: shop.id,
        barber_id: selectedBarber?.id,
        "start_time.gte": startOfDay,
        "start_time.lte": endOfDay,
        "status.neq": "cancelled",
      },
      enabled: !!selectedBarber && !!selectedDate,
    });

  // 4. استماع لحظي (Realtime) لأي تغيير يحصل في الحجوزات من الداشبورد (إلغاء، تعديل، حجز جديد)
  useEffect(() => {
    const channel = supabase
      .channel(`customer-slots-${shop.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${shop.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: appointmentQueryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    shop.id,
    selectedBarber?.id,
    selectedDate,
    queryClient,
    appointmentQueryKey,
  ]);

  // 5. حساب المواعيد المتاحة لحظياً
  const availableSlots = useMemo(() => {
    if (!selectedBarber || !selectedService || !selectedDate) return [];

    return generateAvailableSlots({
      date: selectedDate,
      openTime: shop.open_time,
      closeTime: shop.close_time,
      durationMinutes: selectedService.duration_minutes,
      bufferMinutes: selectedService.buffer_time_minutes,
      bookedAppointments,
    });
  }, [
    selectedBarber,
    selectedService,
    selectedDate,
    shop.open_time,
    shop.close_time,
    bookedAppointments,
  ]);

  // 6. إرسال الحجز لـ Supabase
  const { mutate: createBooking, isPending: isSubmitting } = useSupabaseMutate({
    table: "appointments",
    method: "insert",
    queryKeysToInvalidate: [appointmentQueryKey],
    onSuccess: () => {
      setBookingSuccess(true);
      setSelectedSlot(null);
    },
  });

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarber || !selectedService || !selectedSlot) return;

    createBooking({
      barbershop_id: shop.id,
      barber_id: selectedBarber.id,
      service_id: selectedService.id,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      start_time: selectedSlot.startISO,
      end_time: selectedSlot.endISO,
      is_home_service: selectedService.is_home_service,
      customer_address: selectedService.is_home_service
        ? customerAddress.trim()
        : null,
      total_price: selectedService.price,
      status: "confirmed",
    });
  };

  // شاشة نجاح الحجز
  if (bookingSuccess) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950 border-2 border-white text-center space-y-6">
        <div className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black">تم تأكيد حجزك بنجاح!</h2>
          <p className="text-zinc-400 text-sm">
            مستنيينك يا{" "}
            <span className="text-white font-bold">{customerName}</span> مع
            الكابتن{" "}
            <span className="text-white font-bold">{selectedBarber?.name}</span>
          </p>
        </div>
        <button
          onClick={() => {
            setBookingSuccess(false);
            setCustomerName("");
            setCustomerPhone("");
            setCustomerAddress("");
          }}
          className="w-full py-3.5 rounded-xl bg-white text-black font-black text-sm hover:bg-zinc-200 transition"
        >
          حجز موعد جديد
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 1. اختيار الحلاق */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" />
            1. اختر الحلاق
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {shop.barbers.map((barber) => {
            const isSelected = selectedBarber?.id === barber.id;
            return (
              <button
                type="button"
                key={barber.id}
                onClick={() => {
                  setSelectedBarber(barber);
                  setSelectedSlot(null);
                }}
                className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between text-right ${
                  isSelected
                    ? "bg-white text-black border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.25)]"
                    : "bg-zinc-950 text-white border-zinc-800 hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${
                      isSelected
                        ? "bg-black text-white border-black"
                        : "bg-zinc-900 text-white border-zinc-700"
                    }`}
                  >
                    {barber.name.charAt(0)}
                  </div>
                  <span className="font-bold text-base">{barber.name}</span>
                </div>
                <Scissors
                  className={`w-4 h-4 ${
                    isSelected ? "opacity-100" : "opacity-30"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. اختيار الخدمة */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full" />
          2. اختر الخدمة
        </h2>

        <div className="space-y-3">
          {shop.services.map((service) => {
            const isSelected = selectedService?.id === service.id;
            return (
              <button
                type="button"
                key={service.id}
                onClick={() => {
                  setSelectedService(service);
                  setSelectedSlot(null);
                }}
                className={`w-full p-5 rounded-xl border transition-all duration-200 flex justify-between items-center text-right ${
                  isSelected
                    ? "bg-white text-black border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.25)]"
                    : "bg-zinc-950 text-white border-zinc-800 hover:border-zinc-500"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-bold text-base">{service.name}</p>
                    {service.is_home_service && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-black text-white"
                            : "bg-white text-black"
                        }`}
                      >
                        <Home className="w-3 h-3" />
                        زيارة منزلية
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs flex items-center gap-1.5 ${
                      isSelected ? "text-zinc-700" : "text-zinc-400"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>المدة: {service.duration_minutes} دقيقة</span>
                    {service.buffer_time_minutes > 0 && (
                      <span>(+{service.buffer_time_minutes} د انتقال)</span>
                    )}
                  </p>
                </div>

                <div
                  className={`px-3.5 py-2 rounded-lg font-black text-base shrink-0 ${
                    isSelected ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  {service.price}{" "}
                  <span className="text-xs font-normal">ج.م</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. اختيار التاريخ والوقت */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full" />
            3. اختر التاريخ والموعد
          </h2>
        </div>

        {/* اختيار اليوم */}
        <div className="relative">
          <input
            type="date"
            min={todayStr}
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedSlot(null);
            }}
            className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-bold focus:outline-none focus:border-white transition [color-scheme:dark]"
          />
        </div>

        {/* شبكة الساعات المتاحة */}
        {loadingSlots ? (
          <div className="py-10 flex items-center justify-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
            <span>جاري فحص المواعيد المتاحة...</span>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-zinc-400 text-sm">
            لا توجد مواعيد متاحة في هذا اليوم، جرب اختيار يوم آخر.
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 pt-2">
            {availableSlots.map((slot) => {
              const isSelected = selectedSlot?.time === slot.time;
              return (
                <button
                  type="button"
                  key={slot.time}
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-3 px-2 rounded-xl font-bold text-sm border transition-all ${
                    isSelected
                      ? "bg-white text-black border-white scale-105"
                      : "bg-zinc-950 text-white border-zinc-800 hover:border-white"
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. فورم بيانات العميل وتأكيد الحجز */}
      {selectedSlot && (
        <form
          onSubmit={handleBookingSubmit}
          className="p-6 rounded-2xl bg-zinc-950 border-2 border-white space-y-5 animate-in fade-in duration-200"
        >
          <div className="border-b border-zinc-800 pb-4 flex justify-between items-center">
            <div>
              <h3 className="font-black text-lg">تأكيد بيانات الحجز</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                الموعد المختار: الساعة{" "}
                <span className="text-white font-bold">
                  {selectedSlot.time}
                </span>{" "}
                بتاريخ{" "}
                <span className="text-white font-bold">{selectedDate}</span>
              </p>
            </div>
            <div className="bg-white text-black px-3 py-1.5 rounded-lg font-black text-sm">
              {selectedService?.price} ج.م
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                الاسم بالكامل
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-black border border-zinc-800 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                رقم الموبايل (واتساب / اتصال)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  placeholder="01012345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-xl bg-black border border-zinc-800 text-white text-sm text-right focus:outline-none focus:border-white"
                />
              </div>
            </div>

            {selectedService?.is_home_service && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-bold">
                  العنوان بالتفصيل (للزيارة المنزلية)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="المنطقة، الشارع، رقم العمارة والشقة..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-black border border-zinc-800 text-white text-sm focus:outline-none focus:border-white"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-xl bg-white text-black font-black text-base hover:bg-zinc-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري تسجيل الحجز...</span>
              </>
            ) : (
              <span>تأكيد الحجز الآن</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
