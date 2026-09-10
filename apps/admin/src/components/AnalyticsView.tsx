import { useQuery } from '@tanstack/react-query';
import { Eye, Download, FileText, Flag, TrendingUp } from 'lucide-react';
import { api } from '../api/client';

export function AnalyticsView() {
  const { data: resources = [], isLoading: isLoadingResources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.getResources(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.getReports(),
  });

  // Calculate totals
  const totalViews = resources.reduce((acc, curr) => acc + (curr.views_count || 0), 0);
  const totalDownloads = resources.reduce((acc, curr) => acc + (curr.downloads_count || 0), 0);
  const publishedCount = resources.filter((r) => r.is_published).length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  // Top resources by views
  const topViewed = [...resources]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 5);

  // Top resources by downloads
  const topDownloaded = [...resources]
    .sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0))
    .slice(0, 5);

  // Subject statistics
  const subjectStats = subjects.map((sub) => {
    const subResources = resources.filter((r) => r.subject_id === sub.id);
    const subViews = subResources.reduce((acc, curr) => acc + (curr.views_count || 0), 0);
    const subDownloads = subResources.reduce((acc, curr) => acc + (curr.downloads_count || 0), 0);
    return {
      ...sub,
      resourceCount: subResources.length,
      views: subViews,
      downloads: subDownloads,
    };
  }).sort((a, b) => b.views - a.views);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">إحصائيات المنصة وتقارير الأداء</h2>
        <p className="text-sm text-slate-500">
          متابعة دقيقة لمشاهدات الموارد وتحميلات ملفات الـ PDF وتفاعل الطلاب
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي المشاهدات</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Eye className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {totalViews.toLocaleString('ar-EG')}
          </div>
          <p className="text-[11px] text-slate-400">مشاهدة حقيقية لصفحات الموارد</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">إجمالي تحميلات PDF</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {totalDownloads.toLocaleString('ar-EG')}
          </div>
          <p className="text-[11px] text-slate-400">تحميل مباشر للملفات</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">الموارد المنشورة</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {publishedCount.toLocaleString('ar-EG')}
          </div>
          <p className="text-[11px] text-slate-400">من أصل {resources.length} مورد مسجل</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">بلاغات قيد المتابعة</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Flag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {pendingReportsCount.toLocaleString('ar-EG')}
          </div>
          <p className="text-[11px] text-slate-400">من أصل {reports.length} بلاغ</p>
        </div>
      </div>

      {isLoadingResources ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل التقارير...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Viewed Resources */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>أكثر الموارد مشاهدة</span>
              </h3>
              <span className="text-xs text-slate-400">Top 5</span>
            </div>

            <div className="space-y-3">
              {topViewed.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <div>
                      <h4 className="font-semibold text-slate-900">{item.title}</h4>
                      <span className="text-[10px] text-slate-500">{item.subject?.name || 'مادة'}</span>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                    {item.views_count} 👁
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Downloaded Resources */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                <span>أكثر الموارد تحميلاً</span>
              </h3>
              <span className="text-xs text-slate-400">Top 5</span>
            </div>

            <div className="space-y-3">
              {topDownloaded.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <div>
                      <h4 className="font-semibold text-slate-900">{item.title}</h4>
                      <span className="text-[10px] text-slate-500">{item.subject?.name || 'مادة'}</span>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                    {item.downloads_count} ⬇
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subject Distribution */}
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">توزيع التفاعل والمشاهدات حسب المادة الدراسية</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-4">المادة</th>
                    <th className="py-2.5 px-4">عدد الموارد</th>
                    <th className="py-2.5 px-4">المشاهدات</th>
                    <th className="py-2.5 px-4">التحميلات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectStats.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">{sub.name}</td>
                      <td className="py-3 px-4 text-slate-600">{sub.resourceCount}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{sub.views}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{sub.downloads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
