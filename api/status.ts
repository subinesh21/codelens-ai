import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get API keys from environment
    const apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
    ].filter(key => key && key.trim() !== '');
    
    const configuredKeys = apiKeys.length;
    
    // Return a properly structured response
    const response = {
      service: 'CodeLens AI API',
      status: configuredKeys > 0 ? 'operational' : 'limited',
      timestamp: new Date().toISOString(),
      apiKeys: {
        configured: configuredKeys,
        sample: apiKeys.map(k => k?.substring(0, 8) + '...'),
      },
      limits: {
        dailyPerKey: 20,
        totalDaily: configuredKeys * 20,
        estimatedUsage: '0%'
      },
      endpoints: {
        analyze: '/api/gemini',
        status: '/api/status'
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Status endpoint error:', error);
    return res.status(500).json({
      service: 'CodeLens AI API',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
}