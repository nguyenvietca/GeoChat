import { apiRequest, apiImage } from './client';
import { ChatMessage } from '../types';
export function sendImage(conversationId: number, file: File, content: string, requestId: string, replyToMessageId: number | undefined, token: string, signal: AbortSignal) {
 const body = new FormData(); body.append('image',file); body.append('content',content); body.append('requestId',requestId);
 if(replyToMessageId) body.append('replyToMessageId',String(replyToMessageId));
 return apiRequest<ChatMessage>(`/api/v1/chats/${conversationId}/images`,{method:'POST',body,token,signal});
}
export function loadImage(id: number,token: string,signal: AbortSignal) { return apiImage(`/api/v1/chats/images/${id}`,token,signal); }
export function validateImage(file: File): string | null {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP image.';
 if(!file.size) return 'Choose a non-empty image.';
 if(file.size>5*1024*1024) return 'Image must be at most 5 MB.';
 return null;
}
