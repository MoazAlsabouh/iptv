/**
 * أدوات موحّدة لحساب وتنسيق الأيام وتواريخ الاشتراكات عبر المنصة
 */

/**
 * حساب الأيام المتبقية بدقة بين تاريخ الانتهاء والوقت الحالي (بالـ UTC/timestamp)
 * ترجع 0 كحد أدنى، وتضمن عدم إرجاع أرقام سالبة أو NaN.
 */
export function getRemainingDays(expiresAt: string | number | Date | null | undefined): number {
  if (!expiresAt) return 0;
  try {
    const expireTime = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
    if (isNaN(expireTime)) return 0;

    const diffMs = expireTime - Date.now();
    if (diffMs <= 0) return 0;

    // حساب عدد الأيام المتبقية مع التقريب للأعلى لاحتساب أي جزء من اليوم
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

/**
 * تنسيق عدد الأيام المتبقية بالعربية بشكل نحوي سليم:
 * - 0 ← "منتهي" (أو "ينتهي اليوم" إذا كان أقل من 24 ساعة ولم ينتهِ بعد).
 * - 1 ← "متبقي يوم واحد"
 * - 2 ← "متبقي يومان"
 * - 3 إلى 10 ← "متبقي ${days} أيام"
 * - 11 فأكثر ← "متبقي ${days} يوماً"
 */
export function formatRemainingDaysArabic(
  days: number,
  expiresAt?: string | number | Date | null | undefined
): string {
  // فحص تاريخ الانتهاء مباشرة إن توفر للتحقق مما إذا كان متبقياً أقل من 24 ساعة
  if (expiresAt) {
    try {
      const expireTime = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
      if (!isNaN(expireTime)) {
        const diffMs = expireTime - Date.now();
        if (diffMs <= 0) {
          return 'منتهي';
        }
        if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
          return 'ينتهي اليوم';
        }
      }
    } catch {}
  }

  const d = Math.max(0, Math.round(isNaN(days) ? 0 : days));

  if (d === 0) {
    return 'منتهي';
  }
  if (d === 1) {
    return 'متبقي يوم واحد';
  }
  if (d === 2) {
    return 'متبقي يومان';
  }
  if (d >= 3 && d <= 10) {
    return `متبقي ${d} أيام`;
  }
  return `متبقي ${d} يوماً`;
}

/**
 * تنسيق التاريخ بأرقام إنجليزية موحّدة (YYYY/MM/DD) لتتطابق مع أرقام المدة والأجهزة
 * بدلاً من الأرقام الهندية (٢٠٢٧/١١/١٩).
 */
export function formatDateStandard(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
  } catch {
    return '—';
  }
}
