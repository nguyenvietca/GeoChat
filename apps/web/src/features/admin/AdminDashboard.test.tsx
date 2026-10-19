import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AdminDashboard } from './AdminDashboard';
import { AdminLayout } from './AdminLayout';
import { getAdminOverview } from '../../api/admin';
const auth = vi.hoisted(() => ({ role: 'SUPER_ADMIN', token: 'root-token', logout: vi.fn() }));
vi.mock('../../api/admin', () => ({ getAdminOverview: vi.fn() }));
vi.mock('../../app/providers/AuthContext', () => ({ useAuth: () => ({ token: auth.token, user: { displayName: 'Root', status: 'ACTIVE', role: auth.role }, isAuthenticated: true, isLoading: false, logout: auth.logout }) }));
beforeEach(() => { vi.resetAllMocks(); auth.role = 'SUPER_ADMIN'; });
it('shows active/online account counts and refreshes the dashboard', async () => {
  vi.mocked(getAdminOverview).mockResolvedValue({ total: 20, active: 15, online: 7, inactive: 3, blocked: 2, measuredAt: '2026-10-18T12:00:00Z' });
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  expect(await screen.findByText('20')).toBeTruthy(); expect(screen.getByText('7')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(getAdminOverview).toHaveBeenCalledTimes(2);
});
it('keeps the administration shell inaccessible to ordinary users', () => {
  auth.role = 'USER'; render(<MemoryRouter><AdminLayout /></MemoryRouter>);
  expect(screen.queryByRole('navigation')).toBeNull(); expect(getAdminOverview).not.toHaveBeenCalled();
});
