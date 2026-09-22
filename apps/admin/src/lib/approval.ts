import type { MyPermissions } from '@thanaya/types';

/**
 * بوابة سير الاعتماد في الواجهة.
 *
 * الفكرة: دوال الكتابة في api/client.ts تسأل shouldQueueForApproval() قبل
 * الكتابة المباشرة. المدير العام يكتب مباشرة، وأي موظف آخر يتحول تعديله
 * تلقائيًا إلى «طلب تغيير» معلّق يراجعه المدير العام.
 *
 * ملاحظة أمنية: هذه البوابة للـ UX فقط — الإنفاذ الحقيقي في قاعدة البيانات
 * (سياسات RLS تمنع الكتابة المباشرة لغير super_admin، ودوال RPC تتحقق
 * من الصلاحيات بنطاقاتها قبل قبول الطلب).
 */

let currentPermissions: MyPermissions | null = null;

/** يستدعيه usePermissions() عند كل جلب ناجح ليبقى أحدث تصوّر للصلاحيات */
export function setCurrentPermissions(perms: MyPermissions | null): void {
  currentPermissions = perms;
}

export function getCurrentPermissions(): MyPermissions | null {
  return currentPermissions;
}

/**
 * هل تُحوَّل الكتابة إلى طلب موافقة؟
 * true فقط عندما نعرف أن المستخدم طاقم وليس مديرًا عامًا.
 * عند عدم تحميل الصلاحيات بعد نعيد false (الكتابة المباشرة سترفضها RLS بأمان).
 */
export function shouldQueueForApproval(): boolean {
  return !!currentPermissions && currentPermissions.is_staff && !currentPermissions.is_super_admin;
}

export const APPROVAL_QUEUED_EVENT = 'thanaya:approval-queued';

/** يبث حدثًا تلتقطه الواجهة لإظهار تنبيه «أُرسل طلبك للمراجعة» */
export function notifyApprovalQueued(entity: string, action: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPROVAL_QUEUED_EVENT, { detail: { entity, action } }));
  }
}
