'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastContext';
import { useLanguage } from '../i18n';

export type PersonaKey = 'PARENT' | 'ACCOUNTS_EXEC' | 'DIRECTOR' | 'CASHIER' | 'COUNSELLOR';
export type UserRole = 'PARENT' | 'ACCOUNTS_EXEC' | 'COUNSELLOR' | 'DIRECTOR';

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  assignedCentreIds?: string[];
  preferredLang?: string;
}

interface AuthContextType {
  user: SessionUser | null;
  role: UserRole | null;
  activePersona: PersonaKey;
  activeStudentId: string;
  selectedCentreId: string;
  isLoading: boolean;
  switchPersona: (persona: PersonaKey) => Promise<void>;
  setSelectedCentreId: (centreId: string) => void;
  setActiveStudentId: (studentId: string) => void;
  logout: () => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { success, error } = useToast();
  const { setLang } = useLanguage();

  const [user, setUser] = useState<SessionUser | null>({
    id: 'usr-par-0587',
    name: 'Sunita Sharma',
    role: 'PARENT',
    phone: '9829058700',
    assignedCentreIds: ['ctr-jpr-gpl'],
    preferredLang: 'hi',
  });
  const [activePersona, setActivePersona] = useState<PersonaKey>('PARENT');
  const [activeStudentId, setActiveStudentId] = useState<string>('STU-0587');
  const [selectedCentreId, setSelectedCentreId] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize session from localStorage or default
  useEffect(() => {
    try {
      const savedPersona = localStorage.getItem('shikshasetu_persona') as PersonaKey | null;
      if (savedPersona) {
        setActivePersona(savedPersona);
      }
      const savedStudent = localStorage.getItem('shikshasetu_student_id');
      if (savedStudent) {
        setActiveStudentId(savedStudent);
      }
      const savedCentre = localStorage.getItem('shikshasetu_centre_id');
      if (savedCentre) {
        setSelectedCentreId(savedCentre);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const switchPersona = useCallback(
    async (persona: PersonaKey) => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/demo-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to switch demo persona');
        }

        const newUser: SessionUser = data.data.user;
        setUser(newUser);
        setActivePersona(persona);
        localStorage.setItem('shikshasetu_persona', persona);

        // Update default context values based on persona
        if (persona === 'PARENT') {
          setActiveStudentId('STU-0587');
          setSelectedCentreId('ctr-jpr-gpl');
          setLang('hi');
        } else if (persona === 'CASHIER') {
          setSelectedCentreId('ctr-jpr-vsh');
          setActiveStudentId('STU-0587');
        } else if (persona === 'ACCOUNTS_EXEC') {
          setSelectedCentreId('ctr-jpr-gpl');
        } else if (persona === 'DIRECTOR') {
          setSelectedCentreId('ALL');
        }

        success(`Switched role to ${newUser.name} (${newUser.role})`);
        if (data.data.redirectTo) {
          router.push(data.data.redirectTo);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error switching persona';
        error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [router, success, error, setLang]
  );

  const loginWithOtp = useCallback(
    async (phone: string, otp: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, code: otp }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          error(data.error?.message || 'Invalid or expired OTP');
          return false;
        }

        const loggedInUser: SessionUser = data.data.user;
        setUser(loggedInUser);
        setActivePersona('PARENT');
        success(`Welcome, ${loggedInUser.name}`);
        router.push('/parent/dashboard');
        return true;
      } catch {
        error('Network error during OTP verification');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [router, success, error]
  );

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('shikshasetu_persona');
    success('Logged out successfully');
    router.push('/login');
  }, [router, success]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        activePersona,
        activeStudentId,
        selectedCentreId,
        isLoading,
        switchPersona,
        setSelectedCentreId,
        setActiveStudentId,
        logout,
        loginWithOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
