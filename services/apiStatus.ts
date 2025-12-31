// services/apiStatus.ts
const API_BASE = 'https://codelens-ai-api.vercel.app/api';

export interface APIStatus {
  service: string;
  status: 'operational' | 'limited' | 'unavailable' | 'error';
  timestamp: string;
  keys?: {
    configured: number;
    sample: string[];
  };
  // For backward compatibility
  apiKeys?: {
    configured: number;
    sample: string[];
  };
  activeKeys?: number;
}

export async function checkAPIStatus(): Promise<APIStatus> {
  try {
    console.log('Fetching API status from:', API_BASE);
    const response = await fetch(`${API_BASE}/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response:', data);
    
    // The API returns { keys: { configured: X, sample: [...] } }
    const configuredKeys = data.keys?.configured || 0;
    
    return {
      service: data.service || 'CodeLens AI API',
      status: configuredKeys > 0 ? 'operational' : 'limited',
      timestamp: data.timestamp || new Date().toISOString(),
      keys: data.keys,
      apiKeys: data.keys, // Map keys to apiKeys for compatibility
      activeKeys: configuredKeys
    };
  } catch (error: any) {
    console.error('API status check failed:', error);
    
    return {
      service: 'CodeLens AI API',
      status: 'unavailable',
      timestamp: new Date().toISOString(),
      activeKeys: 0
    };
  }
}

export function getQuotaMessage(status: APIStatus): string {
  const configuredKeys = status.activeKeys || status.keys?.configured || 0;
  
  if (configuredKeys === 0) {
    return 'No API keys configured. Please add API keys in Vercel environment variables.';
  }
  
  const dailyLimit = configuredKeys * 20;
  return `${configuredKeys} active API key${configuredKeys > 1 ? 's' : ''} (${dailyLimit} requests/day available)`;
}