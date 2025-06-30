import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  try {
    // Extract firm ID from query parameters or user token
    const url = new URL(context.request.url);
    const firmId = url.searchParams.get('firmId');
    
    if (!firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Loading firm settings for:', firmId);

    // Get firm data from Durable Object
    const firmData = await getFirmData(firmId, context);
    
    // Get authorized users for this firm
    const users = await getAuthorizedUsers(firmId, context);

    return new Response(JSON.stringify({
      success: true,
      data: {
        firm: firmData,
        users: users,
        debug: {
          firmId: firmId,
          timestamp: new Date().toISOString(),
          durablesObjectsAvailable: !!context.locals?.runtime?.env?.FIRM_REGISTRY
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to load firm settings:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'SETTINGS_LOAD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to load settings'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const settingsData = await context.request.json();
    
    if (!settingsData.firmId) {
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'MISSING_FIRM_ID',
          message: 'Firm ID is required'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('💾 Updating firm settings for:', settingsData.firmId);

    // Update firm data in Durable Object
    const updatedFirm = await updateFirmData(settingsData, context);

    return new Response(JSON.stringify({
      success: true,
      data: {
        firm: updatedFirm,
        message: 'Settings updated successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Failed to update firm settings:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'SETTINGS_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update settings'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Helper function to get firm data from Durable Object
async function getFirmData(firmId: string, context: any): Promise<any> {
  console.log('🏢 Fetching firm data from Durable Object...');
  
  try {
    // Access Durable Object binding from Astro context
    const env = context.locals?.runtime?.env;
    if (!env || !env.FIRM_REGISTRY) {
      console.log('⚠️ FIRM_REGISTRY binding not available, returning mock data');
      // Return mock data when Durable Objects aren't available
      return {
        firmId: firmId,
        firmName: 'Sample Law Firm',
        firmSize: 'small',
        plan: 'professional',
        practiceAreas: ['Personal Injury', 'Criminal Defense'],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'active',
        settings: {
          intakeEnabled: true,
          conflictCheckEnabled: true,
          autoAssignment: false
        }
      };
    }

    // Get Durable Object instance using firmId as the name
    const id = env.FIRM_REGISTRY.idFromName(firmId);
    const stub = env.FIRM_REGISTRY.get(id);
    
    // Fetch firm data from Durable Object
    const response = await stub.fetch('http://durable-object/firm', {
      method: 'GET'
    });
    
    if (!response.ok) {
      console.log('⚠️ Firm not found in Durable Object, returning default data');
      // Return default data if firm doesn't exist yet
      return {
        firmId: firmId,
        firmName: 'New Firm',
        firmSize: '',
        plan: 'professional',
        practiceAreas: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'new',
        settings: {
          intakeEnabled: true,
          conflictCheckEnabled: true,
          autoAssignment: false
        }
      };
    }
    
    const result = await response.json();
    console.log('✅ Firm data loaded from Durable Object');
    
    return result.firm;
  } catch (error) {
    console.error('❌ Error fetching firm data:', error);
    // Return fallback data
    return {
      firmId: firmId,
      firmName: 'Error Loading Firm',
      firmSize: '',
      plan: 'unknown',
      practiceAreas: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to get authorized users for a firm
async function getAuthorizedUsers(firmId: string, context: any): Promise<any[]> {
  console.log('👥 Fetching authorized users for firm...');
  
  try {
    // Access Durable Object binding from Astro context
    const env = context.locals?.runtime?.env;
    if (!env || !env.FIRM_REGISTRY) {
      console.log('⚠️ FIRM_REGISTRY binding not available, returning mock users');
      // Return mock users when Durable Objects aren't available
      return [
        {
          id: 'user_' + Math.random().toString(36).substr(2, 9),
          auth0UserId: 'auth0|mock',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          status: 'active'
        }
      ];
    }

    // Get Durable Object instance
    const id = env.FIRM_REGISTRY.idFromName(firmId);
    const stub = env.FIRM_REGISTRY.get(id);
    
    // Fetch users from Durable Object
    const response = await stub.fetch('http://durable-object/users', {
      method: 'GET'
    });
    
    if (!response.ok) {
      console.log('⚠️ No users found for firm, returning empty array');
      return [];
    }
    
    const result = await response.json();
    console.log('✅ Users loaded from Durable Object:', result.users.length);
    
    return result.users;
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return [];
  }
}

// Helper function to update firm data in Durable Object
async function updateFirmData(settingsData: any, context: any): Promise<any> {
  console.log('💾 Updating firm data in Durable Object...');
  
  try {
    // Access Durable Object binding from Astro context
    const env = context.locals?.runtime?.env;
    if (!env || !env.FIRM_REGISTRY) {
      console.log('⚠️ FIRM_REGISTRY binding not available, returning mock update');
      // Return mock update when Durable Objects aren't available
      return {
        ...settingsData,
        lastUpdated: new Date().toISOString(),
        status: 'updated_mock'
      };
    }

    // Get Durable Object instance
    const id = env.FIRM_REGISTRY.idFromName(settingsData.firmId);
    const stub = env.FIRM_REGISTRY.get(id);
    
    // Update firm data in Durable Object
    const response = await stub.fetch('http://durable-object/firm', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update firm data: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Firm data updated in Durable Object');
    
    return result.firm;
  } catch (error) {
    console.error('❌ Error updating firm data:', error);
    throw error;
  }
}