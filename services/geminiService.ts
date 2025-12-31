// services/geminiService.ts
import { AnalysisResult, ExecutionTrace } from "../types";

const API_BASE = 'https://codelens-ai-api.vercel.app/api';

// Cache implementation with TTL
class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private defaultTTL = 10 * 60 * 1000; // 10 minutes

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    // Auto-cleanup after TTL
    setTimeout(() => {
      if (this.cache.get(key)?.timestamp === Date.now()) {
        this.cache.delete(key);
      }
    }, ttl || this.defaultTTL);
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    const ttl = this.defaultTTL;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager();

function getCacheKey(method: string, code: string, language: string, extra?: string): string {
  // Create a stable cache key
  const content = `${method}:${language}:${code}`;
  return Buffer.from(content + (extra || '')).toString('base64');
}

async function fetchWithRetry<T>(
  endpoint: string,
  body: any,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limits with exponential backoff
        if (response.status === 429 && attempt < retries - 1) {
          const waitTime = delay * Math.pow(2, attempt);
          console.warn(`Rate limited, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Check if it's a quota error on all keys
        if (data.status?.failedKeys === data.status?.totalKeys) {
          throw new Error(`All API keys exhausted. Daily quota reached on all ${data.status.totalKeys} keys.`);
        }
        
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error: any) {
      if (attempt === retries - 1) {
        throw error;
      }
      
      // Exponential backoff for network errors
      const waitTime = delay * Math.pow(2, attempt);
      console.warn(`Network error, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error('Max retries exceeded');
}

export async function analyzeCode(code: string, language: string): Promise<AnalysisResult> {
  const cacheKey = getCacheKey('analyze', code, language);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  const data = await fetchWithRetry<{ result: string; meta?: any }>('gemini', {
    code,
    language,
    action: 'analyze',
  });

  const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  cacheManager.set(cacheKey, result);
  
  console.log(`Analysis complete. Used API key: ${data.meta?.usedKey || 'unknown'}`);
  return result;
}

export async function generateTrace(code: string, language: string): Promise<ExecutionTrace> {
  const cacheKey = getCacheKey('trace', code, language);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  const data = await fetchWithRetry<{ result: ExecutionTrace; meta?: any }>('gemini', {
    code,
    language,
    action: 'trace',
  });

  cacheManager.set(cacheKey, data.result);
  
  console.log(`Trace generated. Used API key: ${data.meta?.usedKey || 'unknown'}`);
  return data.result;
}

export async function askQuestion(
  code: string, 
  language: string, 
  question: string, 
  conversationHistory: Array<{role: string, content: string}> = []
): Promise<string> {
  const cacheKey = getCacheKey('chat', code, language, question);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  const data = await fetchWithRetry<{ result: string; meta?: any }>('gemini', {
    code,
    language,
    action: 'chat',
    question,
    conversationHistory,
  });

  const result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  cacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5 minutes for chat
  
  console.log(`Chat response. Used API key: ${data.meta?.usedKey || 'unknown'}`);
  return result;
}

// Export cache manager for debugging
export const clearCache = () => cacheManager.clear();