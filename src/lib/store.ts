import { Employee, TimeEntry, LeaveRequest } from '@/types/workforce';

const KEYS = {
  employees: 'wms_employees',
  timeEntries: 'wms_time_entries',
  leaveRequests: 'wms_leave_requests',
  currentUser: 'wms_current_user',
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
    vacationAccrualRate: 1.25,
    paidPtoLimitHours: 80,
    hireDate: '2024-03-15',
    department: 'Engineering',
  },
  {
    id: 'emp-002',
    name: 'Carlos Mendez',
    email: 'carlos@freelancela.com',
    role: 'employee',
    hourlyRate: 42.5,
    vacationAccrualRate: 1.5,
    paidPtoLimitHours: 96,
    hireDate: '2023-08-01',
    department: 'Design',
  },
  {
    id: 'admin-001',
    name: 'Ana Torres',
    email: 'ana@freelancela.com',
    role: 'admin',
    hourlyRate: 55.0,
    vacationAccrualRate: 1.5,
    paidPtoLimitHours: 120,
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
  if (!localStorage.getItem(KEYS.leaveRequests)) {
    save(KEYS.leaveRequests, []);
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
};
