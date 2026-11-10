'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, role } = useAuth();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else if (role === 'PARENT') {
      router.replace('/parent/dashboard');
    } else {
      router.replace('/admin/dashboard');
    }
  }, [user, role, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading ShikshaSetu...</p>
      </div>
    </div>
  );
}
