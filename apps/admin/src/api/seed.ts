// Mock/seed data + offline memory store + shared approval helpers.
// Re-exported from './_shared' so other modules have a stable seed entry point.
export {
  initialSubjects,
  initialContentTypes,
  initialWeeks,
  initialExams,
  initialExamQuestions,
  initialSystemSettings,
  initialResources,
  initialAdSlots,
  initialDirectAds,
  initialNotifications,
  memory,
  isConfigured,
} from './_shared';
