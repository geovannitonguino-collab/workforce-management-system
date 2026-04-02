import { Employee, TimeEntry, LeaveRequest, MedicalProof } from '@/types/workforce';

const KEYS = {
  employees: 'wms_employees',
  timeEntries: 'wms_time_entries',
  leaveRequests: 'wms_leave_requests',
  currentUser: 'wms_current_user',
  medicalProofs: 'wms_medical_proofs',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed data
const seedEmployees: Employee[] = [
  {
    id: 'emp-001',
    name: 'María García',
    email: 'maria@freelancela.com',
    role: 'employee',
    hourlyRate: 35.0,
    vacationAccrualRate: 0.416,
    paidPtoLimitHours: 40,
    hireDate: '2024-03-15',
    department: 'Engineering',
  },
  {
    id: 'emp-002',
    name: 'Carlos Mendez',
    email: 'carlos@freelancela.com',
    role: 'employee',
    hourlyRate: 42.5,
    vacationAccrualRate: 0.416,
    paidPtoLimitHours: 40,
    hireDate: '2023-08-01',
    department: 'Design',
  },
  {
    id: 'admin-001',
    name: 'Ana Torres',
    email: 'ana@freelancela.com',
    role: 'admin',
    hourlyRate: 55.0,
    vacationAccrualRate: 0.416,
    paidPtoLimitHours: 40,
    hireDate: '2022-01-10',
    department: 'Management',
  },
];

export function initializeStore(): void {
  if (!localStorage.getItem(KEYS.employees)) {
    save(KEYS.employees, seedEmployees);
  }
  if (!localStorage.getItem(KEYS.timeEntries)) {
    save(KEYS.timeEntries, []);
  }
  {
    const existing = load<any[]>(KEYS.leaveRequests, []);
    if (existing.length === 0) {
      save(KEYS.leaveRequests, [
        { id: 'seed-1', employeeId: 'emp-001', category: 'sick', startDate: '2026-03-01', endDate: '2026-03-03', hours: 24, isPaid: true, unpaidHours: 0, status: 'approved', reason: 'Flu - 3 days', createdAt: '2026-03-01T10:00:00Z' },
        { id: 'seed-2', employeeId: 'emp-001', category: 'pto', startDate: '2026-03-10', endDate: '2026-03-10', hours: 8, isPaid: true, unpaidHours: 0, status: 'pending', reason: 'Personal errands', createdAt: '2026-03-10T10:00:00Z' },
        { id: 'seed-3', employeeId: 'emp-001', category: 'vacation', startDate: '2026-04-01', endDate: '2026-04-05', hours: 40, isPaid: true, unpaidHours: 0, status: 'approved', reason: 'Family trip', createdAt: '2026-03-15T10:00:00Z' },
        { id: 'seed-4', employeeId: 'emp-001', category: 'personal', startDate: '2026-03-20', endDate: '2026-03-20', hours: 8, isPaid: false, unpaidHours: 8, status: 'rejected', reason: 'Moving day', createdAt: '2026-03-18T10:00:00Z' },
        { id: 'seed-5', employeeId: 'emp-001', category: 'sick', startDate: '2026-02-15', endDate: '2026-02-15', hours: 8, isPaid: true, unpaidHours: 0, status: 'pending', reason: 'Headache', createdAt: '2026-02-15T10:00:00Z' },
      ]);
    }
  }
  if (!localStorage.getItem(KEYS.currentUser)) {
    save(KEYS.currentUser, seedEmployees[0].id);
  }
}

export const store = {
  getEmployees: (): Employee[] => load(KEYS.employees, seedEmployees),
  saveEmployees: (data: Employee[]) => save(KEYS.employees, data),

  getTimeEntries: (): TimeEntry[] => load(KEYS.timeEntries, []),
  saveTimeEntries: (data: TimeEntry[]) => save(KEYS.timeEntries, data),
  addTimeEntry: (entry: TimeEntry) => {
    const entries = store.getTimeEntries();
    entries.push(entry);
    save(KEYS.timeEntries, entries);
  },

  getLeaveRequests: (): LeaveRequest[] => load(KEYS.leaveRequests, []),
  saveLeaveRequests: (data: LeaveRequest[]) => save(KEYS.leaveRequests, data),
  addLeaveRequest: (request: LeaveRequest) => {
    const requests = store.getLeaveRequests();
    requests.push(request);
    save(KEYS.leaveRequests, requests);
  },
  updateLeaveRequest: (id: string, updates: Partial<LeaveRequest>) => {
    const requests = store.getLeaveRequests();
    const idx = requests.findIndex(r => r.id === id);
    if (idx >= 0) {
      requests[idx] = { ...requests[idx], ...updates };
      save(KEYS.leaveRequests, requests);
    }
  },

  getCurrentUserId: (): string => load(KEYS.currentUser, 'emp-001'),
  setCurrentUserId: (id: string) => save(KEYS.currentUser, id),

  addEmployee: (emp: Employee) => {
    const employees = store.getEmployees();
    employees.push(emp);
    save(KEYS.employees, employees);
  },
  updateEmployee: (id: string, updates: Partial<Employee>) => {
    const employees = store.getEmployees();
    const idx = employees.findIndex(e => e.id === id);
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...updates };
      save(KEYS.employees, employees);
    }
  },

  // Medical Proofs
  getMedicalProofs: (): MedicalProof[] => load(KEYS.medicalProofs, []),
  addMedicalProof: (proof: MedicalProof) => {
    const proofs = store.getMedicalProofs();
    proofs.push(proof);
    save(KEYS.medicalProofs, proofs);
  },
  updateMedicalProof: (id: string, updates: Partial<MedicalProof>) => {
    const proofs = store.getMedicalProofs();
    const idx = proofs.findIndex(p => p.id === id);
    if (idx >= 0) {
      proofs[idx] = { ...proofs[idx], ...updates };
      save(KEYS.medicalProofs, proofs);
    }
  },
  deleteMedicalProof: (id: string) => {
    const proofs = store.getMedicalProofs().filter(p => p.id !== id);
    save(KEYS.medicalProofs, proofs);
  },
  getMedicalProofsForRequest: (leaveRequestId: string): MedicalProof[] => {
    return store.getMedicalProofs().filter(p => p.leaveRequestId === leaveRequestId);
  },
};
