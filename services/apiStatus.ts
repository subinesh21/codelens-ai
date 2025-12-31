// services/apiStatus.ts
const API_BASE = 'https://codelens-ai-api.vercel.app/api';

export interface APIStatus {
  message: string;
  totalKeys: number;
  activeKeys: number;
  failedKeys: number;
  usage: Array<{ index: number; count: number }>;
  timestamp: string;
}

export async function checkAPIStatus(): Promise<APIStatus> {
  try {
    const response = await fetch(`${API_BASE}/gemini/status`);
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API status check failed:', error);
    return {
      message: 'API unavailable',
      totalKeys: 0,
      activeKeys: 0,
      failedKeys: 0,
      usage: [],
      timestamp: new Date().toISOString(),
    };
  }
}

export function getQuotaMessage(status: APIStatus): string {
  if (status.totalKeys === 0) {
    return 'No API keys configured';
  }
  
  if (status.failedKeys === status.totalKeys) {
    return `All ${status.totalKeys} API keys exhausted. Daily quota reached.`;
  }
  
  if (status.failedKeys > 0) {
    return `${status.failedKeys} of ${status.totalKeys} API keys exhausted. ${status.activeKeys} keys remaining.`;
  }
  
  return `${status.totalKeys} API keys available`;
}