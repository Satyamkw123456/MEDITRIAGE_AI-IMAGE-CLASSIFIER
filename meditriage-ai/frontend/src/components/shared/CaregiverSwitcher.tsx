"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { Users, User, HeartHandshake, Check } from "lucide-react";

export interface LinkedPatient {
  id: number;
  name: string;
  relationship: string;
  age: number;
  gender: string;
}

interface CaregiverContextType {
  isCaregiver: boolean;
  activePatient: LinkedPatient | null;
  linkedPatients: LinkedPatient[];
  selectPatient: (patient: LinkedPatient | null) => void;
}

const CaregiverContext = createContext<CaregiverContextType>({
  isCaregiver: false,
  activePatient: null,
  linkedPatients: [],
  selectPatient: () => {},
});

export const useCaregiver = () => useContext(CaregiverContext);

interface CaregiverProviderProps {
  children: React.ReactNode;
}

export function CaregiverProvider({ children }: CaregiverProviderProps) {
  const [activePatient, setActivePatient] = useState<LinkedPatient | null>(null);

  // Mock linked patients from CaregiverLink (Cycle 1 substrate)
  const [linkedPatients] = useState<LinkedPatient[]>([
    { id: 101, name: "Ramesh Sharma", relationship: "Father", age: 76, gender: "Male" },
    { id: 102, name: "Kamla Sharma", relationship: "Mother", age: 72, gender: "Female" },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem("meditriage_active_patient");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActivePatient(parsed);
      } catch {
        setActivePatient(null);
      }
    }
  }, []);

  const selectPatient = (patient: LinkedPatient | null) => {
    setActivePatient(patient);
    if (patient) {
      localStorage.setItem("meditriage_active_patient", JSON.stringify(patient));
    } else {
      localStorage.removeItem("meditriage_active_patient");
    }
  };

  return (
    <CaregiverContext.Provider
      value={{
        isCaregiver: activePatient !== null,
        activePatient,
        linkedPatients,
        selectPatient,
      }}
    >
      {children}
    </CaregiverContext.Provider>
  );
}

interface CaregiverSwitcherProps {
  className?: string;
}

export function CaregiverSwitcher({ className = "" }: CaregiverSwitcherProps) {
  const { isCaregiver, activePatient, linkedPatients, selectPatient } = useCaregiver();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-medium text-ink hover:bg-bg transition-colors shadow-xs"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {isCaregiver ? (
          <>
            <HeartHandshake className="w-3.5 h-3.5 text-primary" />
            <span>Caregiver: <strong className="font-semibold text-primary">{activePatient?.name}</strong></span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5 text-muted" />
            <span>Intake: <strong>Self</strong></span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-60 rounded-card border border-line bg-surface p-1.5 shadow-popover z-50 animate-in fade-in duration-100"
        >
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted border-b border-line mb-1">
            Acting on behalf of:
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              selectPatient(null);
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-bg transition-colors text-ink"
          >
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted" />
              <span>Myself (Patient Account)</span>
            </div>
            {!isCaregiver && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>

          {linkedPatients.map((p) => {
            const isSelected = activePatient?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  selectPatient(p);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-bg transition-colors text-ink"
              >
                <div>
                  <div className="font-medium text-ink">{p.name}</div>
                  <div className="text-[10px] text-muted">
                    {p.relationship} • {p.age} yrs • {p.gender}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
