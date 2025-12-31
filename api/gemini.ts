import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    architecture: { type: Type.STRING },
    diagrams: {
      type: Type.OBJECT,
      properties: {
        flowchart: { type: Type.STRING },
        sequence: { type: Type.STRING },
        dependencies: { type: Type.STRING }
      },
      required: ["flowchart", "sequence", "dependencies"]
    },
    concepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["name", "description"]
      }
    },
    learningPath: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: { type: Type.STRING },
          detail: { type: Type.STRING }
        },
        required: ["step", "detail"]
      }
    },
    lineExplanations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.INTEGER },
          explanation: { type: Type.STRING }
        },
        required: ["line", "explanation"]
      }
    }
  },
  required: ["summary", "architecture", "diagrams", "concepts", "learningPath", "lineExplanations"]
};

const EXECUTION_TRACE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          variables: { type: Type.STRING },
          stack: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["line", "explanation", "variables", "stack"]
      }
    }
  },
  required: ["steps"]
};

// Helper function to validate and fix Mermaid syntax
function validateAndFixMermaid(mermaidCode: string): string {
  if (!mermaidCode || mermaidCode.trim() === '') {
    return 'graph TD\n  A["Empty Diagram"]';
  }

  let cleaned = mermaidCode.trim();
  
  // Remove any markdown code blocks
  cleaned = cleaned.replace(/```mermaid\s*/g, '');
  cleaned = cleaned.replace(/```\s*$/g, '');
  
  // Ensure proper diagram type with newline
  const diagramTypes = [
    { pattern: /^graph\s+TD/i, replacement: 'graph TD\n' },
    { pattern: /^graph\s+LR/i, replacement: 'graph LR\n' },
    { pattern: /^sequenceDiagram/i, replacement: 'sequenceDiagram\n' },
    { pattern: /^classDiagram/i, replacement: 'classDiagram\n' },
    { pattern: /^stateDiagram-v2/i, replacement: 'stateDiagram-v2\n' },
    { pattern: /^erDiagram/i, replacement: 'erDiagram\n' }
  ];
  
  let hasValidHeader = false;
  for (const { pattern, replacement } of diagramTypes) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, replacement);
      hasValidHeader = true;
      break;
    }
  }
  
  // If no valid header found, default to graph TD
  if (!hasValidHeader) {
    cleaned = 'graph TD\n' + cleaned;
  }
  
  // Fix quotes for flowcharts
  if (cleaned.startsWith('graph')) {
    // Remove existing quotes to avoid double quotes
    cleaned = cleaned.replace(/"([^"]+)"/g, '$1');
    // Add quotes to nodes (simple approach)
    const lines = cleaned.split('\n');
    const fixedLines = lines.map(line => {
      if (line.includes('-->') || line.includes('--') || line.includes('->')) {
        // Add quotes to node names
        line = line.replace(/(\w+)(\s*-->|\s*--|\s*->)/g, '"$1"$2');
        line = line.replace(/(-->|--|->)\s*(\w+)/g, '$1"$2"');
      }
      return line;
    });
    cleaned = fixedLines.join('\n');
  }
  
  // Remove all semicolons
  cleaned = cleaned.replace(/;/g, '');
  
  // Remove any trailing whitespace
  cleaned = cleaned.replace(/\s+$/g, '');
  
  return cleaned;
}

// Multiple API key rotation system
class GeminiKeyManager {
  private apiKeys: string[];
  private currentIndex: number = 0;
  private failedKeys: Set<number> = new Set();
  private keyUsage: Map<number, { count: number; lastUsed: number }> = new Map();

  constructor() {
    // Collect all available API keys from environment variables
    this.apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter((key): key is string => !!key && key.trim() !== '');
  }

  getAvailableKeys(): number {
    return this.apiKeys.length;
  }

  getNextKey(): { key: string; index: number } | null {
    if (this.apiKeys.length === 0) {
      return null;
    }

    // Try to find a key that hasn't failed recently
    for (let i = 0; i < this.apiKeys.length; i++) {
      this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
      const index = this.currentIndex;
      
      if (!this.failedKeys.has(index)) {
        // Track usage
        const usage = this.keyUsage.get(index) || { count: 0, lastUsed: 0 };
        usage.count++;
        usage.lastUsed = Date.now();
        this.keyUsage.set(index, usage);
        
        return { key: this.apiKeys[index], index };
      }
    }

    // If all keys have failed, reset failures and try again
    this.failedKeys.clear();
    return this.getNextKey();
  }

  markKeyFailed(index: number): void {
    this.failedKeys.add(index);
    console.warn(`Marked API key ${index} as failed. Failed keys: ${Array.from(this.failedKeys).join(',')}`);
  }

  markKeySuccess(index: number): void {
    // Remove from failed keys if it was there
    this.failedKeys.delete(index);
  }

  getStatus(): {
    totalKeys: number;
    activeKeys: number;
    failedKeys: number;
    usage: Array<{ index: number; count: number }>;
  } {
    const usage = Array.from(this.keyUsage.entries())
      .map(([index, data]) => ({ index, count: data.count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalKeys: this.apiKeys.length,
      activeKeys: this.apiKeys.length - this.failedKeys.size,
      failedKeys: this.failedKeys.size,
      usage,
    };
  }
}

// Create a singleton instance
const keyManager = new GeminiKeyManager();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET' && req.url?.includes('/status')) {
    // Add a status endpoint to check API key health
    return res.status(200).json({
      message: 'Gemini API Key Manager',
      ...keyManager.getStatus(),
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, language, action, question, conversationHistory } = req.body;

    if (!code || !language || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get next available API key
    const keyInfo = keyManager.getNextKey();
    if (!keyInfo) {
      console.error('No Gemini API keys available');
      return res.status(500).json({ 
        error: 'No API keys available. Please check environment variables.',
        details: keyManager.getStatus()
      });
    }

    console.log(`Using API key ${keyInfo.index} (total keys: ${keyManager.getAvailableKeys()})`);

    const ai = new GoogleGenAI({ apiKey: keyInfo.key });

    let prompt = '';
    let responseSchema;

    if (action === 'analyze') {
      prompt = `Analyze the following ${language} code and provide architectural insights, Mermaid.js diagrams, and key concepts. Keep explanations brief and concise. Output valid JSON.

CRITICAL MERMAID SYNTAX RULES - MUST FOLLOW:
1. FLOWCHARTS: Start with EXACTLY "graph TD" or "graph LR" followed by a NEWLINE
2. SEQUENCE DIAGRAMS: Start with EXACTLY "sequenceDiagram" followed by a NEWLINE  
3. CLASS DIAGRAMS: Start with EXACTLY "classDiagram" followed by a NEWLINE
4. QUOTES: In flowcharts, ALL node labels MUST be in double quotes: "Node Label"
5. NO SEMICOLONS: Never use semicolons in diagrams
6. INDENTATION: Use 2 spaces for indentation after the header
7. SIMPLE SYNTAX: Keep diagrams simple with minimal nodes

IMPORTANT: Your output must be valid JSON. The diagrams field must contain:
- flowchart: A flowchart starting with "graph TD"
- sequence: A sequence diagram starting with "sequenceDiagram"  
- dependencies: A class diagram starting with "classDiagram"

Example valid flowchart:
graph TD
  "Start" --> "Process"
  "Process" --> "End"

Example valid class diagram:
classDiagram
  class "Controller"
  class "Service"
  "Controller" --> "Service"

CODE TO ANALYZE:
${code}`;
      responseSchema = ANALYSIS_SCHEMA;
    } else if (action === 'trace') {
      prompt = `Simulate the step-by-step execution of this ${language} code. Provide a trace of variable states and line highlights. Keep explanations brief (1 sentence per step). Focus on the most common execution path. Output valid JSON.

IMPORTANT: The "variables" field should be a JSON string representing an object with variable names as keys and their stringified values (e.g., "{\\"x\\": \\"5\\", \\"arr\\": \\"[1,2,3]\\", \\"flag\\": \\"true\\"}").

CODE:
${code}`;
      responseSchema = EXECUTION_TRACE_SCHEMA;
    } else if (action === 'chat') {
      prompt = `You are a helpful coding assistant named as Codelens-AI. Answer questions about the provided code concisely and clearly. Keep responses brief and to the point (2-3 sentences max).\n\nHere is the ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``;

      if (conversationHistory?.length > 0) {
        const historyText = conversationHistory.slice(-4).map((msg: any) => {
          const prefix = msg.role === 'user' ? 'User' : 'Assistant';
          return `${prefix}: ${msg.content}`;
        }).join('\n\n');
        prompt = `${historyText}\n\n${prompt}`;
      }

      prompt = `${prompt}\n\nUser question: ${question}`;
      responseSchema = null;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: responseSchema ? {
          responseMimeType: "application/json",
          responseSchema
        } : undefined,
        // Add timeout for better error handling
        requestOptions: { timeout: 30000 }
      });

      const responseText = response.text;
      keyManager.markKeySuccess(keyInfo.index);

      if (action === 'analyze') {
        try {
          const result = JSON.parse(responseText);
          
          // Validate and fix all diagrams
          result.diagrams.flowchart = validateAndFixMermaid(result.diagrams.flowchart);
          result.diagrams.sequence = validateAndFixMermaid(result.diagrams.sequence);
          result.diagrams.dependencies = validateAndFixMermaid(result.diagrams.dependencies);
          
          return res.status(200).json({ 
            result: JSON.stringify(result),
            meta: { usedKey: keyInfo.index }
          });
        } catch (e) {
          console.error('Analysis parsing error:', e);
          // Return fallback diagrams if parsing fails
          const fallbackResult = {
            summary: "Code analysis completed with basic insights.",
            architecture: "Simple modular architecture",
            diagrams: {
              flowchart: 'graph TD\n  "Start" --> "Process"\n  "Process" --> "End"',
              sequence: 'sequenceDiagram\n  User->>System: Request\n  System-->>User: Response',
              dependencies: 'classDiagram\n  class "Main"\n  class "Helper"\n  "Main" --> "Helper"'
            },
            concepts: [{ name: "Basic logic", description: "Fundamental programming concepts" }],
            learningPath: [{ step: "1", detail: "Understand basic syntax" }],
            lineExplanations: [{ line: 1, explanation: "Function definition" }]
          };
          return res.status(200).json({ 
            result: JSON.stringify(fallbackResult),
            meta: { usedKey: keyInfo.index, fallback: true }
          });
        }
      } else if (action === 'trace') {
        try {
          const trace = JSON.parse(responseText);
          trace.steps = trace.steps.map((step: any) => ({
            ...step,
            variables: typeof step.variables === 'string' ? JSON.parse(step.variables) : step.variables
          }));
          return res.status(200).json({ 
            result: trace,
            meta: { usedKey: keyInfo.index }
          });
        } catch (e) {
          console.error('Trace parsing error:', e);
          return res.status(500).json({ 
            error: 'Failed to parse trace response',
            meta: { usedKey: keyInfo.index }
          });
        }
      }

      return res.status(200).json({ 
        result: responseText,
        meta: { usedKey: keyInfo.index }
      });

    } catch (apiError: any) {
      console.error(`API Error with key ${keyInfo.index}:`, apiError.message);
      
      // Mark this key as failed if it's a quota or authentication error
      if (apiError.message?.includes('429') || 
          apiError.message?.includes('quota') || 
          apiError.message?.includes('RESOURCE_EXHAUSTED') ||
          apiError.message?.includes('PERMISSION_DENIED') ||
          apiError.message?.includes('API key')) {
        keyManager.markKeyFailed(keyInfo.index);
        console.warn(`Key ${keyInfo.index} marked as failed due to: ${apiError.message}`);
        
        // Try with a different key if available
        if (keyManager.getAvailableKeys() > 1) {
          console.log('Retrying with different API key...');
          // We could implement recursion here, but to avoid infinite loops,
          // we'll just return the error and let the client retry
        }
      }
      
      throw apiError;
    }

  } catch (error: any) {
    console.error('Handler Error:', error);
    
    // Return detailed error information
    const errorResponse: any = { 
      error: error.message || 'Internal server error',
      status: keyManager.getStatus()
    };
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      errorResponse.suggestion = 'Daily quota reached on all available API keys. Add more keys or wait until reset.';
      errorResponse.resetTime = 'Midnight Pacific Time';
    } else if (error.message?.includes('API key')) {
      errorResponse.suggestion = 'Check your Gemini API keys in Vercel environment variables.';
    }
    
    return res.status(500).json(errorResponse);
  }
}
