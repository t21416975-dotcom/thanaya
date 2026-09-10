import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import type { ReportStatus } from '@thanaya/types';

export function ReportsManager() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.getReports(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) => api.updateReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case 'broken_file':
        return 'الملف لا يعمل / تالف';
      case 'broken_link':
        return 'رابط التحميل لا يعمل';
      case 'incorrect_content':
        return 'المحتوى خاطئ أو به أخطاء علمية';
      case 'outdated':
        return 'المحتوى قديم / غير مطابق لمنهج العام';
      default:
        return 'مشكلة أخرى';
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">بلاغات المشاكل (Reports)</h2>
          <p className="text-sm text-slate-500">متابعة وحل المشاكل المبلغ عنها من الطلاب في ملفات الموارد</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">قيد الانتظار (Pending)</option>
            <option value="resolved">تم الحل (Resolved)</option>
            <option value="ignored">تم التجاهل (Ignored)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">جاري تحميل البلاغات...</div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <Flag className="w-4 h-4" />
                  </span>
                  <span className="font-semibold text-sm text-slate-900">
                    {getIssueLabel(report.issue_type)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      report.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : report.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {report.status === 'pending' ? 'قيد المتابعة' : report.status === 'resolved' ? 'تم الحل' : 'تجاهل'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-2 pt-1">
                  <span>المورد:</span>
                  <strong className="text-slate-700">{report.resource?.title || report.resource_id}</strong>
                </div>

                {report.details && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                    {report.details}
                  </p>
                )}

                <div className="text-[10px] text-slate-400 pt-1">
                  تاريخ البلاغ: {new Date(report.created_at).toLocaleString('ar-EG')}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                {report.status !== 'resolved' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: report.id, status: 'resolved' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>تم الحل</span>
                  </button>
                )}

                {report.status !== 'ignored' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: report.id, status: 'ignored' })}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                  >
                    تجاهل
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredReports.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              لا توجد بلاغات مسجلة في هذا القسم.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
