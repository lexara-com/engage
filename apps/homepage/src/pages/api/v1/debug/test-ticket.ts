/**
 * Debug endpoint to test password change ticket creation directly
 */

import type { APIRoute } from 'astro';
import { createAuth0ManagementClient } from '../../../../utils/auth0-management.js';

export const POST: APIRoute = async (context) => {
  try {
    console.log('🎫 Testing password change ticket creation...');
    
    const requestData = await context.request.json();
    const { userId } = requestData;
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'userId is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const env = context.locals?.runtime?.env;
    const auth0Client = createAuth0ManagementClient(env);
    
    // Force refresh the access token to get new scopes
    console.log('🔄 Force refreshing Auth0 Management API token...');
    const tokenTest = await auth0Client.refreshAccessToken();
    console.log('✅ Fresh access token obtained successfully');
    
    // Try to create a password change ticket
    const ticketData = {
      user_id: userId,
      result_url: 'https://dev-www.lexara.app/firm/login?invited=true',
      ttl_sec: 7 * 24 * 60 * 60, // 7 days
      mark_email_as_verified: true
    };
    
    console.log('🎫 Creating password change ticket with data:', ticketData);
    
    const response = await fetch(`https://${env.AUTH0_DOMAIN}/api/v2/tickets/password-change`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenTest}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketData)
    });
    
    console.log('📊 Ticket creation response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ticket creation failed:', errorText);
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          status: response.status,
          message: errorText,
          ticketData: ticketData
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const ticket = await response.json();
    console.log('✅ Password change ticket created successfully');
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        ticket: ticket.ticket,
        ticketData: ticketData
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};