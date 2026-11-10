'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HeartHandshake } from 'lucide-react';
import CounsellorInterventionModal from '@/components/admin/CounsellorInterventionModal';

interface StudentRiskItem {
  id: string;
  studentCode: string;
  fullName: string;
  centre: string;
  compositeScore: number;
  financialScore: number;
  attendanceScore: number;
  academicScore: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
}

export default function DropoutRiskTable() {
  const [selectedStudent, setSelectedStudent] = useState<StudentRiskItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentRiskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRiskQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/refunds/risk-queue');
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          const mapped: StudentRiskItem[] = data.items.map((i: any) => ({
            id: i.studentId || i.id,
            studentCode: i.studentCode || 'STU-0587',
            fullName: i.studentName || 'Student',
            centre: i.centre || i.centreCode || 'Gopalpura Bypass (Main Centre)',
            compositeScore: i.compositeScore ?? i.score ?? 0,
            financialScore: i.financialScore ?? i.components?.financialOverdueScore ?? 0,
            attendanceScore: i.attendanceScore ?? i.components?.attendanceDropScore ?? 0,
            academicScore: i.academicScore ?? i.components?.academicScoreDrop ?? 0,
            severity: i.severity || 'LOW',
            status: i.status || (i.severity === 'HIGH' ? 'NEEDS_INTERVENTION' : 'MONITORING'),
          }));
          setStudents(mapped);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskQueue();
  }, [fetchRiskQueue]);

  const handleOpenIntervention = (st: StudentRiskItem) => {
    setSelectedStudent(st);
    setIsModalOpen(true);
  };

  const handleInterventionSaved = () => {
    fetchRiskQueue();
  };

  const highRiskCount = students.filter((s) => s.compositeScore >= 70).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Jaipur Network Ranked Dropout Risk Queue
          </h3>
          <p className="text-xs text-slate-500">
            Explainable AI factors: Financial ($F$), Attendance ($A$), and Test Trend ($S$)
          </p>
        </div>
        <span className="text-xs font-mono bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md border border-rose-200 font-bold">
          {highRiskCount} High Risk Student{highRiskCount === 1 ? '' : 's'} Flagged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Student ID</th>
              <th className="px-4 py-3 text-left">Student Name</th>
              <th className="px-4 py-3 text-left">Centre</th>
              <th className="px-4 py-3 text-center">Composite Score</th>
              <th className="px-4 py-3 text-center">F (Fin)</th>
              <th className="px-4 py-3 text-center">A (Att)</th>
              <th className="px-4 py-3 text-center">S (Score)</th>
              <th className="px-4 py-3 text-center">Severity</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {students.map((st) => (
              <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-slate-900 text-xs">
                  {st.studentCode}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {st.fullName}
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {st.centre}
                </td>
                <td className="px-4 py-3 text-center font-mono font-black text-sm">
                  <span className={st.severity === 'HIGH' ? 'text-rose-600' : 'text-slate-800'}>
                    {st.compositeScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono text-slate-700">
                  {st.financialScore}/40
                </td>
                <td className="px-4 py-3 text-center font-mono text-slate-700">
                  {st.attendanceScore}/35
                </td>
                <td className="px-4 py-3 text-center font-mono text-slate-700">
                  {st.academicScore}/25
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      st.severity === 'HIGH'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : st.severity === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {st.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleOpenIntervention(st)}
                    className="touch-target inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>Log Call</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <CounsellorInterventionModal
          isOpen={isModalOpen}
          studentId={selectedStudent.studentCode}
          studentName={selectedStudent.fullName}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleInterventionSaved}
        />
      )}
    </div>
  );
}
