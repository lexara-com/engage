/**
 * Shared conversation data fetching logic
 * Used by both the SSR page and the API endpoint
 */

export interface ConversationFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  practiceArea?: string;
  assignedTo?: string;
}

export async function fetchConversations(firmId: string, filters: ConversationFilters = {}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  
  try {
    // In production, this would call the real API worker
    const apiUrl = import.meta.env.API_URL || 'http://localhost:8787';
    
    try {
      const apiParams = new URLSearchParams();
      if (filters.status) apiParams.append('status', filters.status);
      if (filters.search) apiParams.append('q', filters.search);
      if (filters.practiceArea) apiParams.append('practiceArea', filters.practiceArea);
      if (filters.assignedTo) apiParams.append('assignedTo', filters.assignedTo);
      apiParams.append('page', page.toString());
      apiParams.append('limit', limit.toString());

      const apiResponse = await fetch(`${apiUrl}/api/v1/firm/conversations?${apiParams}`, {
        headers: {
          'Accept': 'application/json',
          // Add authorization header if needed
        }
      });

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        return {
          success: true,
          data: {
            conversations: data.data?.conversations || [],
            pagination: {
              page: page,
              limit: limit,
              total: data.data?.pagination?.total || 0,
              pages: data.data?.pagination?.pages || 1
            }
          }
        };
      }
    } catch (error) {
      console.log('API call failed, returning mock data:', error);
    }
    
    // Return mock data for development
    const mockData = getMockConversations(firmId);
    
    // Apply filters
    let filteredData = [...mockData];
    
    if (filters.status) {
      filteredData = filteredData.filter(conv => conv.status === filters.status);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredData = filteredData.filter(conv => 
        conv.clientName.toLowerCase().includes(searchLower) ||
        conv.clientEmail.toLowerCase().includes(searchLower) ||
        conv.practiceArea.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.practiceArea) {
      filteredData = filteredData.filter(conv => conv.practiceArea === filters.practiceArea);
    }
    
    if (filters.assignedTo) {
      filteredData = filteredData.filter(conv => conv.assignedTo === filters.assignedTo);
    }
    
    // Paginate
    const start = (page - 1) * limit;
    const paginatedData = filteredData.slice(start, start + limit);
    
    return {
      success: true,
      data: {
        conversations: paginatedData,
        pagination: {
          page: page,
          limit: limit,
          total: filteredData.length,
          pages: Math.ceil(filteredData.length / limit)
        }
      }
    };
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return {
      success: false,
      error: 'Failed to fetch conversations',
      data: {
        conversations: [],
        pagination: null
      }
    };
  }
}

function getMockConversations(firmId: string) {
  return [
    {
      sessionId: 'session_001',
      clientName: 'Sarah Johnson',
      clientEmail: 'sarah.johnson@email.com',
      clientPhone: '555-0123',
      practiceArea: 'personal_injury',
      status: 'active',
      assignedTo: 'attorney_123',
      assignedToName: 'James Wilson',
      lastActivity: new Date().toISOString(),
      messagesCount: 5,
      dataQualityScore: 85,
      conflictStatus: 'clear',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      firmId: firmId
    },
    {
      sessionId: 'session_002',
      clientName: 'Michael Chen',
      clientEmail: 'mchen@example.com',
      clientPhone: '555-0124',
      practiceArea: 'family_law',
      status: 'completed',
      assignedTo: 'attorney_456',
      assignedToName: 'Emily Davis',
      lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      messagesCount: 12,
      dataQualityScore: 92,
      conflictStatus: 'clear',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      firmId: firmId
    },
    {
      sessionId: 'session_003',
      clientName: 'Jennifer Martinez',
      clientEmail: 'jmartinez@email.com',
      clientPhone: '555-0125',
      practiceArea: 'employment_law',
      status: 'active',
      assignedTo: null,
      assignedToName: null,
      lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      messagesCount: 3,
      dataQualityScore: 70,
      conflictStatus: 'potential',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      firmId: firmId
    },
    {
      sessionId: 'session_004',
      clientName: 'Robert Thompson',
      clientEmail: 'rthompson@company.com',
      clientPhone: '555-0126',
      practiceArea: 'criminal_defense',
      status: 'terminated',
      assignedTo: 'attorney_789',
      assignedToName: 'David Brown',
      lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      messagesCount: 8,
      dataQualityScore: 45,
      conflictStatus: 'confirmed',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      firmId: firmId
    },
    {
      sessionId: 'session_005',
      clientName: 'Lisa Anderson',
      clientEmail: 'landerson@email.com',
      clientPhone: '555-0127',
      practiceArea: 'personal_injury',
      status: 'active',
      assignedTo: 'attorney_123',
      assignedToName: 'James Wilson',
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      messagesCount: 7,
      dataQualityScore: 88,
      conflictStatus: 'clear',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      firmId: firmId
    }
  ];
}