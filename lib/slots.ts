export interface BookedSlot {
  start_time: string; // ISO string from Supabase (timestamptz)
  end_time: string;
}

export interface TimeSlot {
  time: string; // الشكل اللي هيظهر للعميل: "10:00"
  startISO: string; // الشكل اللي هيتسيف في Supabase: "2026-10-29T10:00:00..."
  endISO: string; // وقت الانتهاء شامل الخدمة + الـ Buffer
}

/**
 * تحويل نص الساعة "10:30:00" إلى إجمالي دقائق (630)
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * تحويل الدقائق (630) إلى نص ساعة "10:30"
 */
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * توليد المواعيد المتاحة لحلاق معين في يوم معين
 */
export function generateAvailableSlots({
  date, // "YYYY-MM-DD"
  openTime, // "10:00:00"
  closeTime, // "23:00:00"
  durationMinutes, // مدة الخدمة (مثلاً 30 أو 45)
  bufferMinutes = 0, // وقت الانتقال للزيارات المنزلية (مثلاً 30)
  bookedAppointments, // الحجوزات القادمة من Supabase
  intervalMinutes = 30, // تقسيم المواعيد كل 30 دقيقة
}: {
  date: string;
  openTime: string;
  closeTime: string;
  durationMinutes: number;
  bufferMinutes?: number;
  bookedAppointments: BookedSlot[];
  intervalMinutes?: number;
}): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);

  // إجمالي الوقت اللي الحلاق هيكون مشغول فيه
  const totalServiceTime = durationMinutes + bufferMinutes;

  // لمعرفة هل التاريخ المختار هو النهاردة (عشان نخفي الساعات اللي فاتت بالفعل)
  const now = new Date();

  // اللوب بيمشي من ساعة الفتح لحد قبل ساعة القفل بمدة الخدمة
  for (
    let current = openMinutes;
    current + totalServiceTime <= closeMinutes;
    current += intervalMinutes
  ) {
    const startTimeStr = minutesToTime(current);
    const endTimeStr = minutesToTime(current + totalServiceTime);

    // تكوين كائن التاريخ بالتوقيت المحلي للعميل
    const slotStart = new Date(`${date}T${startTimeStr}:00`);
    const slotEnd = new Date(`${date}T${endTimeStr}:00`);

    // 1. لو الميعاد ده عدى وقته النهاردة، نتخطاه
    if (slotStart <= now) {
      continue;
    }

    // 2. فحص هل الميعاد بيتعارض مع أي حجز موجود في الداتابيز؟
    const hasConflict = bookedAppointments.some((appt) => {
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);

      // معادلة التقاطع الزمني: (StartA < EndB) AND (EndA > StartB)
      return slotStart < apptEnd && slotEnd > apptStart;
    });

    // لو مفيش تعارض، نضيفه لقائمة المواعيد المتاحة
    if (!hasConflict) {
      slots.push({
        time: startTimeStr,
        startISO: slotStart.toISOString(),
        endISO: slotEnd.toISOString(),
      });
    }
  }

  return slots;
}
