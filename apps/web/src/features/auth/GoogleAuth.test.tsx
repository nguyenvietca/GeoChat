import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GoogleButton } from './GoogleButton';
import { ConnectedAccounts } from '../settings/ConnectedAccounts';
import { GoogleReturnPage } from './GoogleReturnPage';
import { completeGoogle, googleConfig, googleConnections, startGoogle, unlinkGoogle } from '../../api/google';
import { ApiError } from '../../api/client';

const mocks=vi.hoisted(()=>({ accept:vi.fn(), navigate:vi.fn(), token:'session' as string|null }));
vi.mock('../../api/google',()=>({googleConfig:vi.fn(),googleConnections:vi.fn(),startGoogle:vi.fn(),unlinkGoogle:vi.fn(),completeGoogle:vi.fn()}));
vi.mock('../../app/providers/AuthContext',()=>({useAuth:()=>({token:mocks.token,isLoading:false,acceptGoogleSession:mocks.accept})}));
vi.mock('react-router-dom',async importOriginal=>({...await importOriginal<typeof import('react-router-dom')>(), useNavigate:()=>mocks.navigate}));
beforeEach(()=>{ vi.resetAllMocks(); mocks.token='session'; window.history.replaceState({},'','/oauth/complete'); });
describe('Google sign-in and connected accounts',()=>{
  it('hides Google when optional credentials are disabled',async()=>{
    vi.mocked(googleConfig).mockResolvedValue({enabled:false}); render(<GoogleButton/>);
    await waitFor(()=>expect(googleConfig).toHaveBeenCalled()); expect(screen.queryByRole('button')).toBeNull();
  });
  it('shows a keyboard accessible action and safe provider error',async()=>{
    vi.mocked(googleConfig).mockResolvedValue({enabled:true}); vi.mocked(startGoogle).mockRejectedValue(new Error('provider failed'));
    render(<GoogleButton/>); fireEvent.click(await screen.findByRole('button',{name:'Continue with Google'}));
    expect((await screen.findByRole('alert')).textContent).toContain('temporarily unavailable');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
  it('requires password confirmation to link and unlink, shows only own provider email',async()=>{
    vi.mocked(googleConfig).mockResolvedValue({enabled:true});
    vi.mocked(googleConnections).mockResolvedValue({passwordAvailable:true,googleConnected:false,email:null});
    render(<ConnectedAccounts/>); const connect=await screen.findByRole('button',{name:'Connect Google'}); expect((connect as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Confirm your current password'),{target:{value:'Password123!'}}); fireEvent.click(connect);
    await waitFor(()=>expect(startGoogle).toHaveBeenCalledWith('session','Password123!'));
  });
  it('cannot disconnect a Google-only account',async()=>{
    vi.mocked(googleConfig).mockResolvedValue({enabled:true});
    vi.mocked(googleConnections).mockResolvedValue({passwordAvailable:false,googleConnected:true,email:'own@example.com'});
    render(<ConnectedAccounts/>); expect(await screen.findByText(/only sign-in method/)).not.toBeNull();
    expect(screen.getByText('own@example.com')).not.toBeNull(); expect(screen.queryByRole('button',{name:'Disconnect Google'})).toBeNull();
  });
  it('disconnects only after confirmation and refreshes status',async()=>{
    vi.mocked(googleConfig).mockResolvedValue({enabled:true});
    vi.mocked(googleConnections).mockResolvedValueOnce({passwordAvailable:true,googleConnected:true,email:'own@example.com'})
      .mockResolvedValueOnce({passwordAvailable:true,googleConnected:false,email:null});
    vi.mocked(unlinkGoogle).mockResolvedValue(null);
    render(<ConnectedAccounts/>); const disconnect=await screen.findByRole('button',{name:'Disconnect Google'});
    fireEvent.change(screen.getByLabelText('Confirm your current password'),{target:{value:'Password123!'}}); fireEvent.click(disconnect);
    expect(await screen.findByText(/Your password still works/)).not.toBeNull(); expect(unlinkGoogle).toHaveBeenCalledWith('session','Password123!');
  });
  it('returns a session error without linking another account',async()=>{
    vi.mocked(completeGoogle).mockRejectedValue(new ApiError('Your session changed.',401));
    render(<MemoryRouter><GoogleReturnPage/></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('session changed'); expect(mocks.accept).not.toHaveBeenCalled();
  });
  it('redeems once and installs only the application session',async()=>{
    vi.mocked(completeGoogle).mockResolvedValue({token:'geochat-jwt',linked:false});
    render(<MemoryRouter><GoogleReturnPage/></MemoryRouter>);
    await waitFor(()=>expect(mocks.accept).toHaveBeenCalledWith('geochat-jwt')); expect(completeGoogle).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/app/home',{replace:true});
  });
  it('cleans cancellation parameters and does not redeem',async()=>{
    window.history.replaceState({},'','/oauth/complete?error=cancelled'); render(<MemoryRouter><GoogleReturnPage/></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toContain('cancelled'); expect(window.location.search).toBe(''); expect(completeGoogle).not.toHaveBeenCalled();
  });
});
