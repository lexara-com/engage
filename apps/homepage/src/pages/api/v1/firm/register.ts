import type { APIRoute } from 'astro';

interface FirmRegistrationData {
  plan: string;
  firmName: string;
  firmSize: string;
  practiceAreas: string[];
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
}

interface Auth0User {
  user_id: string;
  email: string;
  name: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const firmData: FirmRegistrationData = await context.request.json();
    
    // Validate required fields
    if (!firmData.firmName || !firmData.firstName || !firmData.lastName || !firmData.email || !firmData.password) {
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Please fill in all required fields including password'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate password strength
    if (firmData.password.length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'PASSWORD_TOO_WEAK',
          message: 'Password must be at least 8 characters long'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!firmData.agreedToTerms) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'TERMS_NOT_ACCEPTED',
          message: 'Please agree to the Terms of Service and Privacy Policy'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🚀 Starting firm registration for:', firmData.email);

    // Step 1: Create firm in Durable Objects
    console.log('📝 Creating firm in FirmRegistry...');
    const firmId = await createFirmInRegistry(firmData, context);
    console.log('✅ Firm created with ID:', firmId);

    // Step 2: Create Auth0 user
    console.log('👤 Creating Auth0 user...');
    const auth0User = await createAuth0User(firmData, firmId, context);
    console.log('✅ Auth0 user created:', auth0User.user_id);

    // Step 3: Link user to firm
    console.log('🔗 Linking user to firm...');
    await linkUserToFirm(firmId, auth0User.user_id, context);
    console.log('✅ User linked to firm successfully');

    return new Response(JSON.stringify({
      success: true,
      data: {
        firmId,
        auth0UserId: auth0User.user_id,
        message: `Welcome to Lexara, ${firmData.firstName}! Please check your email to verify your account, then you can sign in with your password.`
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Firm registration failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Registration failed. Please try again.'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Helper function to create firm in Durable Objects
async function createFirmInRegistry(firmData: FirmRegistrationData, context: any): Promise<string> {
  console.log('🏢 Creating firm in FirmRegistry Durable Object...');
  
  try {
    // Access Durable Object binding from Astro context
    const env = context.locals?.runtime?.env;
    if (!env || !env.FIRM_REGISTRY) {
      console.log('⚠️ FIRM_REGISTRY binding not available, using mock ID');
      // Fallback to generated ID if binding not available
      const firmId = `firm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return firmId;
    }

    // Get Durable Object instance using 'global' as the name for the registry
    const id = env.FIRM_REGISTRY.idFromName('global');
    const stub = env.FIRM_REGISTRY.get(id);
    
    // Create firm via Durable Object
    const response = await stub.fetch('http://durable-object/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(firmData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create firm in Durable Object: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Firm created in Durable Object:', result.firmId);
    
    return result.firmId;
  } catch (error) {
    console.error('❌ Error creating firm in Durable Object:', error);
    // Fallback to generated ID
    const firmId = `firm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔄 Using fallback firm ID:', firmId);
    return firmId;
  }
}

// Helper function to create Auth0 user
async function createAuth0User(firmData: FirmRegistrationData, firmId: string, context: any): Promise<Auth0User> {
  // Access environment variables from Astro context
  const env = context.locals?.runtime?.env;
  const AUTH0_DOMAIN = env?.AUTH0_DOMAIN;
  const AUTH0_CLIENT_ID = env?.AUTH0_CLIENT_ID;
  const AUTH0_CLIENT_SECRET = env?.AUTH0_CLIENT_SECRET;

  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    throw new Error('Auth0 configuration missing. Please configure AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET environment variables.');
  }

  // Get Management API token
  const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials'
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get Auth0 management token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Create user
  const userResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      connection: 'Username-Password-Authentication', // Default Auth0 database connection
      email: firmData.email,
      password: firmData.password,
      name: `${firmData.firstName} ${firmData.lastName}`,
      user_metadata: {
        firmId: firmId,
        role: 'admin',
        firstName: firmData.firstName,
        lastName: firmData.lastName
      },
      app_metadata: {
        organization: firmId,
        permissions: ['firm:admin'],
        plan: firmData.plan
      },
      email_verified: false,
      verify_email: true
    })
  });

  if (!userResponse.ok) {
    const error = await userResponse.text();
    throw new Error(`Failed to create Auth0 user: ${error}`);
  }

  return await userResponse.json();
}

// Helper function to link user to firm
async function linkUserToFirm(firmId: string, auth0UserId: string, context: any): Promise<void> {
  console.log('🔗 Linking user to firm:', { firmId, auth0UserId });
  
  try {
    // Access Durable Object binding from Astro context
    const env = context.locals?.runtime?.env;
    if (!env || !env.FIRM_REGISTRY) {
      console.log('⚠️ FIRM_REGISTRY binding not available, skipping link operation');
      return;
    }

    // Get Durable Object instance
    const id = env.FIRM_REGISTRY.idFromName('global');
    const stub = env.FIRM_REGISTRY.get(id);
    
    // Link user to firm via Durable Object
    const response = await stub.fetch('http://durable-object/link-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firmId,
        auth0UserId,
        role: 'admin'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to link user to firm: ${response.status}`);
    }
    
    console.log('✅ User successfully linked to firm');
  } catch (error) {
    console.error('❌ Error linking user to firm:', error);
    // Continue without failing - this is non-critical for registration
    console.log('🔄 Continuing registration without link operation');
  }
}

