// Platform Session Durable Object - Secure session management for platform admins
// Security: Enterprise-grade session handling with automatic cleanup

import { PlatformSession as PlatformSessionData } from '../auth/platform-auth-manager';
import { Env } from '@/types/shared';

export class PlatformSession {
  private state: DurableObjectState;
  private env: Env;
  private session: PlatformSessionData | null = null;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      switch (url.pathname) {
        case '/create':
          return this.handleCreateSession(request);
        case '/get':
          return this.handleGetSession();
        case '/update-activity':
          return this.handleUpdateActivity(request);
        case '/delete':
          return this.handleDeleteSession();
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: (error as Error).message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleCreateSession(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    const sessionData: PlatformSessionData = await request.json();
    
    // Validate session data
    if (!sessionData.sessionId || !sessionData.auth0UserId || !sessionData.userEmail) {
      return new Response('Invalid session data', { status: 400 });
    }
    
    // Store session in durable object state
    this.session = {
      ...sessionData,
      createdAt: new Date(sessionData.createdAt),
      lastActivity: new Date(sessionData.lastActivity),
      expiresAt: new Date(sessionData.expiresAt)
    };
    
    // Persist to storage
    await this.state.storage.put('session', this.session);
    
    // Set automatic cleanup alarm
    await this.scheduleCleanup();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleGetSession(): Promise<Response> {
    // Load session from storage if not in memory
    if (!this.session) {
      this.session = await this.state.storage.get('session');
    }
    
    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }
    
    // Check if session is expired
    if (this.session.expiresAt < new Date()) {
      await this.cleanupExpiredSession();
      return new Response('Session expired', { status: 404 });
    }
    
    return new Response(JSON.stringify({
      sessionId: this.session.sessionId,
      auth0UserId: this.session.auth0UserId,
      userEmail: this.session.userEmail,
      userName: this.session.userName,
      userType: this.session.userType,
      createdAt: this.session.createdAt.toISOString(),
      lastActivity: this.session.lastActivity.toISOString(),
      expiresAt: this.session.expiresAt.toISOString(),
      ipAddress: this.session.ipAddress,
      userAgent: this.session.userAgent
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleUpdateActivity(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    
    // Load session from storage if not in memory
    if (!this.session) {
      this.session = await this.state.storage.get('session');
    }
    
    if (!this.session) {
      return new Response('Session not found', { status: 404 });
    }
    
    const updateData = await request.json();
    
    // Update activity timestamp and IP if provided
    this.session.lastActivity = new Date(updateData.lastActivity);
    if (updateData.ipAddress) {
      this.session.ipAddress = updateData.ipAddress;
    }
    
    // Persist updated session
    await this.state.storage.put('session', this.session);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleDeleteSession(): Promise<Response> {
    // Remove session from storage
    await this.state.storage.delete('session');
    this.session = null;
    
    // Cancel cleanup alarm
    await this.state.storage.deleteAlarm();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async scheduleCleanup(): Promise<void> {
    if (!this.session) return;
    
    // Schedule cleanup alarm for session expiration
    const cleanupTime = this.session.expiresAt.getTime();
    await this.state.storage.setAlarm(cleanupTime);
  }
  
  private async cleanupExpiredSession(): Promise<void> {
    await this.state.storage.delete('session');
    this.session = null;
    await this.state.storage.deleteAlarm();
  }
  
  // Durable Object alarm handler for automatic cleanup
  async alarm(): Promise<void> {
    // Check if session is expired and clean up
    if (this.session && this.session.expiresAt < new Date()) {
      await this.cleanupExpiredSession();
    }
  }
}