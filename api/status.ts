// api/status.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    const apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter(Boolean);
    
    return res.status(200).json({
      service: 'CodeLens AI API',
      status: 'operational',
      timestamp: new Date().toISOString(),
      apiKeys: {
        configured: apiKeys.length,
        sampleFirstChars: apiKeys.map(key => key?.substring(0, 8) + '...'),
      },
      endpoints: {
        analyze: 'POST /api/gemini',
        trace: 'POST /api/gemini',
        chat: 'POST /api/gemini',
        keyStatus: 'GET /api/gemini/status',
      },
      limits: {
        freeTier: '20 requests/day per key',
        suggestion: 'Use multiple keys to increase daily limit',
      },
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}