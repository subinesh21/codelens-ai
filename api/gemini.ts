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
    let model = "gemini-1.5-flash"; // Use a more reliable model

    if (action === 'analyze') {
      prompt = `Analyze this ${language} code and create THREE valid Mermaid.js diagrams:

1. FLOWCHART (use "graph TD"): Show the logical flow and control structures
2. SEQUENCE DIAGRAM (use "sequenceDiagram"): Show function calls and execution order  
3. DEPENDENCY DIAGRAM (use "classDiagram"): Show relationships between components

CRITICAL RULES:
- Each diagram MUST start with exactly: "graph TD", "sequenceDiagram", or "classDiagram"
- Then add a NEWLINE
- Use double quotes for all labels in flowcharts: "Node Label"
- NO semicolons anywhere
- Keep diagrams SIMPLE (5-10 nodes max)

Return JSON with: summary, architecture, diagrams (flowchart, sequence, dependencies), concepts, learningPath, lineExplanations.

CODE:
${code}`;
      responseSchema = ANALYSIS_SCHEMA;
    } else if (action === 'trace') {
      prompt = `Simulate EXACT step-by-step execution of this ${language} code. For EACH line that executes:

1. Line number (starting from 1)
2. Brief explanation
3. Current variable states as JSON string
4. Call stack (array of strings)

Example response format for line 1:
{
  "line": 1,
  "explanation": "Function findMax is defined",
  "variables": "{}",
  "stack": ["global"]
}

Return as valid JSON array of steps.

CODE:
${code}`;
      responseSchema = EXECUTION_TRACE_SCHEMA;
    } else if (action === 'chat') {
      prompt = `You are CodeLens AI, a helpful coding assistant. Answer questions about this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Question: ${question}

Answer briefly and clearly (2-3 sentences max):`;
      responseSchema = null;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: responseSchema ? {
          responseMimeType: "application/json",
          responseSchema
        } : undefined,
      });

      const responseText = response.text;
      console.log(`Gemini response length for ${action}:`, responseText.length);
      keyManager.markKeySuccess(keyInfo.index);
      if (action === 'analyze') {
        try {
          const result = JSON.parse(responseText);
          
          // Validate and fix all diagrams
          result.diagrams.flowchart = validateAndFixMermaid(result.diagrams.flowchart);
          result.diagrams.sequence = validateAndFixMermaid(result.diagrams.sequence);
          result.diagrams.dependencies = validateAndFixMermaid(result.diagrams.dependencies);
          
          // FIX: Return the parsed object directly, NOT stringified
          return res.status(200).json({ 
            result: result, // This is the key fix - send object, not string
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
            result: fallbackResult, // Object, not string
            meta: { usedKey: keyInfo.index, fallback: true }
          });
        }
      }else if (action === 'trace') {
        try {
          const trace = JSON.parse(responseText);
          // Parse variables from string to object
          trace.steps = trace.steps.map((step: any) => ({
            ...step,
            variables: typeof step.variables === 'string' ? 
              (() => {
                try {
                  return JSON.parse(step.variables);
                } catch {
                  return {};
                }
              })() : step.variables
          }));
          return res.status(200).json({ 
            result: trace,
            meta: { usedKey: keyInfo.index }
          });
        } catch (e) {
          console.error('Trace parsing error:', e);
          // Create a simple fallback trace
          const fallbackTrace = {
            steps: [
              {
                line: 1,
                explanation: "Function findMax is defined",
                variables: { function: "findMax", params: "arr" },
                stack: ["global"]
              },
              {
                line: 2,
                explanation: "Variable max initialized to arr[0]",
                variables: { max: "arr[0]", arr: "[3,7,2,9,5]" },
                stack: ["findMax"]
              },
              {
                line: 3,
                explanation: "For loop starts with i = 1",
                variables: { i: 1, max: 3, arr: "[3,7,2,9,5]" },
                stack: ["findMax"]
              },
              {
                line: 8,
                explanation: "Function returns max value",
                variables: { return: 9 },
                stack: ["findMax"]
              },
              {
                line: 11,
                explanation: "Result logged to console",
                variables: { numbers: "[3,7,2,9,5]", result: 9 },
                stack: ["global"]
              }
            ]
          };
          return res.status(200).json({ 
            result: fallbackTrace,
            meta: { usedKey: keyInfo.index, fallback: true }
          });
        }
      }

      // For chat, return as-is
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
      errorResponse.suggestion = 'Daily quota reached. Add more API keys or wait until reset.';
    } else if (error.message?.includes('API key')) {
      errorResponse.suggestion = 'Check your Gemini API keys in Vercel environment variables.';
    }
    
    return res.status(500).json(errorResponse);
  }
}