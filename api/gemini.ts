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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, language, action, question, conversationHistory } = req.body;

    if (!code || !language || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const ai = new GoogleGenAI({ apiKey });

    let prompt = '';
    let responseSchema;

    if (action === 'analyze') {
      prompt = `Analyze the following ${language} code and provide architectural insights, Mermaid.js diagrams, and key concepts. Keep explanations brief and concise. Output valid JSON.

CRITICAL MERMAID SYNTAX RULES:
1. MANDATORY NEWLINES: You MUST put a newline after the diagram type declaration. 
   Example: "classDiagram\n" NOT "classDiagram"
   Example: "graph TD\n" NOT "graph TD"
2. QUOTES: ALWAYS wrap node labels in double quotes.
3. NO SEMICOLONS: Do not use semicolons (;) anywhere in the diagram.
4. CLASS DIAGRAMS: Use "classDiagram" as the first line, then a newline, then your classes.

IMPORTANT: Every diagram MUST start with exactly one of these headers followed by a newline:
- "graph TD\n" (for top-down flowcharts)
- "graph LR\n" (for left-right flowcharts)
- "sequenceDiagram\n"
- "classDiagram\n"
- "stateDiagram-v2\n"
- "erDiagram\n"

Keep all explanations short (1-2 sentences max). Be concise.

CODE:
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: responseSchema ? {
        responseMimeType: "application/json",
        responseSchema
      } : undefined
    });

    const responseText = response.text;

    if (action === 'trace') {
      try {
        const trace = JSON.parse(responseText);
        trace.steps = trace.steps.map((step: any) => ({
          ...step,
          variables: typeof step.variables === 'string' ? JSON.parse(step.variables) : step.variables
        }));
        return res.status(200).json({ result: trace });
      } catch (e) {
        console.error('Trace parsing error:', e);
        return res.status(500).json({ error: 'Failed to parse trace response' });
      }
    }

    return res.status(200).json({ result: responseText });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error'
    });
  }
}
