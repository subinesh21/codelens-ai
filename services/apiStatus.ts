// services/apiStatus.ts
const API_BASE = 'https://codelens-ai-api.vercel.app/api';

export interface APIStatus {
  service: string;
  status: string;
  timestamp: string;
  apiKeys: {
    configured: number;
    sampleFirstChars: string[];
  };
  endpoints: any;
  limits: any;
}

export async function checkAPIStatus(): Promise<APIStatus> {
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API status check failed:', error);
    // Return a fallback status
    return {
      service: 'CodeLens AI API',
      status: 'unavailable',
      timestamp: new Date().toISOString(),
      apiKeys: {
        configured: 0,
        sampleFirstChars: [],
      },
      endpoints: {},
      limits: {},
    };
  }
}

export function getQuotaMessage(status: APIStatus): string {
  if (status.apiKeys.configured === 0) {
    return 'No API keys configured';
  }
  
  return `${status.apiKeys.configured} API keys available (${status.apiKeys.configured * 20} requests/day)`;
}