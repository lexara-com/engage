import type { APIRoute } from 'astro';
import { AuthorizationDatabaseClient } from '@/db/client';
import type { CreateEntity, Firm, User } from '@/db/types';

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

    console.log('🚀 Starting enhanced firm registration for:', firmData.email);

    // Get database client
    const env = context.locals?.runtime?.env;
    if (!env?.DB) {
      throw new Error('Database not configured. Please check D1 binding in wrangler.toml');
    }

    const dbClient = new AuthorizationDatabaseClient(env.DB);

    // Step 1: Create firm in D1 database
    console.log('📝 Creating firm in database...');
    const firm = await dbClient.createFirm({
      name: firmData.firmName,
      plan: firmData.plan || 'starter',
      settings: {
        size: firmData.firmSize,
        practiceAreas: firmData.practiceAreas,
        onboardingCompleted: false
      },
      status: 'active'
    });
    console.log('✅ Firm created with ID:', firm.id);

    // Step 2: Create Auth0 user
    console.log('👤 Creating Auth0 user...');
    let auth0User: Auth0User;
    try {
      auth0User = await createAuth0User(firmData, firm.id, context);
      console.log('✅ Auth0 user created:', auth0User.user_id);
    } catch (error) {
      // Rollback firm creation on Auth0 failure
      console.error('❌ Auth0 user creation failed, rolling back firm creation');
      await dbClient.deleteFirm(firm.id);
      throw error;
    }

    // Step 3: Create user in D1 database
    console.log('🔗 Creating user in database...');
    const user = await dbClient.createUser({
      firm_id: firm.id,
      auth0_id: auth0User.user_id,
      email: firmData.email,
      first_name: firmData.firstName,
      last_name: firmData.lastName,
      role: 'admin', // First user is always admin
      permissions: ['firm:admin', 'firm:manage_users', 'firm:manage_settings'],
      status: 'active'
    });
    console.log('✅ User created and linked to firm');

    // Step 4: Create audit log entry
    await dbClient.logAudit({
      firm_id: firm.id,
      user_id: user.id,
      action: 'firm.created',
      ip_address: context.request.headers.get('CF-Connecting-IP') || 'unknown',
      user_agent: context.request.headers.get('User-Agent') || 'unknown',
      details: {
        firmName: firm.name,
        plan: firm.plan,
        userEmail: user.email
      }
    });

    // Step 5: Create firm in Durable Objects (if available)
    if (env.FIRM_REGISTRY) {
      try {
        const id = env.FIRM_REGISTRY.idFromName('global');
        const stub = env.FIRM_REGISTRY.get(id);
        
        await stub.fetch('http://durable-object/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firmId: firm.id,
            userId: user.id,
            firmData: {
              name: firm.name,
              plan: firm.plan,
              settings: firm.settings
            }
          })
        });
        console.log('✅ Firm registered in Durable Object');
      } catch (error) {
        console.warn('⚠️  Could not register firm in Durable Object:', error);
        // Non-fatal error - continue
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        firmId: firm.id,
        userId: user.id,
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
        message: error instanceof Error ? error.message : 'Registration failed. Please try again.',
        details: error instanceof Error ? error.stack : undefined
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

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
      connection: 'Username-Password-Authentication',
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

  const userData = await userResponse.json();
  return userData;
}