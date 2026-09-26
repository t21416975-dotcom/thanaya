import { supabase } from '../lib/supabase';
import type { ReportProblem, ReportStatus } from '@thanaya/types';
import { isConfigured, memory } from './_shared';

export const reportsApi = {
  // --- REPORTS ---
  async getReports(): Promise<ReportProblem[]> {
    if (isConfigured) {
      const { data, error } = await supabase
        .from('reports')
        .select('*, resource:resources(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ReportProblem[]) || [];
    }
    return memory.reports.map((rep) => ({
      ...rep,
      resource: memory.resources.find((r) => r.id === rep.resource_id),
    }));
  },

  async updateReportStatus(id: string, status: ReportStatus): Promise<void> {
    if (isConfigured) {
      const { error } = await (supabase.from('reports') as any)
        .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
      return;
    }
    const report = memory.reports.find((r) => r.id === id);
    if (report) {
      report.status = status;
      report.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    }
  },
};
