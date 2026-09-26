// Entry point للوحة التحكم: يجمع وحدات الكيانات في كائن api واحد.
// كل المنطق انتقل إلى ملفات مجاورة — هذا الملف للتوافق مع الاستيرادات القديمة فقط.
import { subjectsApi } from './subjects';
import { contentTypesApi } from './contentTypes';
import { weeksApi } from './weeks';
import { resourcesApi } from './resources';
import { reportsApi } from './reports';
import { adsApi } from './ads';
import { examsApi } from './exams';
import { settingsApi } from './settings';
import { notificationsApi } from './notifications';
import { pushApi } from './push';
import { staffApi } from './staff';
import { approvalsApi } from './approvals';
import { isConfigured } from './_shared';

export const api = {
  isLive: isConfigured,
  ...subjectsApi,
  ...contentTypesApi,
  ...weeksApi,
  ...resourcesApi,
  ...reportsApi,
  ...adsApi,
  ...examsApi,
  ...settingsApi,
  ...notificationsApi,
  ...pushApi,
  ...staffApi,
  ...approvalsApi,
};

export type Api = typeof api;
