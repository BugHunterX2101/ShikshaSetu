'use client';

import React, { useState } from 'react';
import { useToast } from '@/src/context/ToastContext';
import { X, HeartHandshake, CheckCircle2, ShieldAlert, BookOpen, Clock } from 'lucide-react';

interface CounsellorInterventionModalProps {
  isOpen: boolean;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CounsellorInterventionModal({
  isOpen,
  studentId,
  studentName,
  onClose,
  onSaved,
}: CounsellorInterventionModalProps) {
  const { success } = useToast();

  const [interactionType, setInteractionType] = useState<string>('PHONE_CALL');
  const [notes, setNotes] = useState<string>(
    'Contacted parent Sunita Sharma regarding Rahul’s recent Physics test dip and attendance. Arranged 1-on-1 doubt clearing session with Physics faculty on Saturday.'
  );
  const [followUpDate, setFollowUpDate] = useState<string>('2026-11-09');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      success(`Counsellor intervention logged for ${studentName}. Status updated to CONTACTED.`);
      onSaved();
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-indigo-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-indigo-300" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Counsellor Intervention Task Log</h2>
              <p className="text-[11px] text-indigo-200 font-mono">
                {studentName} ({studentId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-md cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs text-slate-800">
          {/* Statutory Script Guide */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
              <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
              <span>Recommended Supportive Dialogue Guide</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              &quot;Namaste Sunita ji, this is from the ShikshaSetu student welfare cell. We noticed Rahul missed a few Physics lectures and wanted to offer free doubt-clearing sessions this weekend.&quot;
            </p>
          </div>

          {/* Interaction Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Interaction Channel
            </label>
            <select
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
            >
              <option value="PHONE_CALL">Parent Phone Consultation (Primary Guardian)</option>
              <option value="PARENT_MEETING">In-Person Centre Meeting (Gopalpura)</option>
              <option value="ACADEMIC_DOUBT_SESSION">1-on-1 Faculty Doubt Clearing Scheduled</option>
            </select>
          </div>

          {/* Counsellor Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Counsellor Notes & Action Plan
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Follow-up Review Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="touch-target px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="touch-target px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Save & Mark Contacted</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
