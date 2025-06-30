import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  try {
    // Clear session cookies
    cookies.delete('lexara_session');
    cookies.delete('lexara_auth_status');
    
    console.log('✅ User session cleared, cookies deleted');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error during logout:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Logout failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Also support GET for simple logout redirect
export const GET: APIRoute = async ({ cookies, redirect }) => {
  try {
    // Clear session cookies
    cookies.delete('lexara_session');
    cookies.delete('lexara_auth_status');
    
    console.log('✅ User session cleared, redirecting to login');
    
    // Redirect to login page
    return redirect('/firm/login');
    
  } catch (error) {
    console.error('Error during logout redirect:', error);
    return redirect('/firm/login');
  }
};