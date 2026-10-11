import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatImage } from './ChatImage';
import { loadImage } from '../../api/images';
vi.mock('../../api/images',()=>({loadImage:vi.fn()}));
const attachment={attachmentId:1,contentType:'image/png',sizeBytes:200,width:12,height:8};
describe('private chat photo',()=>{
 beforeEach(()=>{
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn().mockReturnValue('blob:private')});
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
 });
 it('loads with JWT, reserves dimensions, shares bytes with viewer and cleans resources',async()=>{
  vi.mocked(loadImage).mockResolvedValue(new Blob(['image'],{type:'image/png'}));
  const view=render(<ChatImage attachment={attachment} token="jwt"/>);
  expect(screen.getByRole('button',{name:'Open photo'}).style.aspectRatio).toBe('12/8');
  await screen.findByAltText('Shared photo');
  expect(loadImage).toHaveBeenCalledWith(1,'jwt',expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button',{name:'Open photo'}));
  expect(screen.getByRole('dialog',{name:'Photo viewer'})).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('button',{name:'Close photo viewer'}),{key:'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'Open photo'}));
  expect(loadImage).toHaveBeenCalledTimes(1);
  view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private');
 });
 it('handles unavailable images with retry and ignores late unmounted downloads',async()=>{
  vi.mocked(loadImage).mockRejectedValueOnce(new Error('gone'));
  const view=render(<ChatImage attachment={attachment} token="jwt"/>);
  await screen.findByText('Photo unavailable');
  let finish:(blob:Blob)=>void=()=>{};
  vi.mocked(loadImage).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Retry photo'}));
  await waitFor(()=>expect(loadImage).toHaveBeenCalledTimes(2));view.unmount();
  finish(new Blob(['image']));await Promise.resolve();expect(URL.createObjectURL).not.toHaveBeenCalled();
 });
});
