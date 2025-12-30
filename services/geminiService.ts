// services/geminiService.ts
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ExecutionTrace } from "../types";

// REMOVE this line: const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Executive summary of the code" },
    architecture: { type: Type.STRING, description: "Description of the architectural patterns used" },
    diagrams: {
      type: Type.OBJECT,
      properties: {
        flowchart: { type: Type.STRING, description: "Mermaid.js flowchart syntax. MANDATORY: Start with 'graph TD' followed by a NEWLINE. Use node IDs like 'L10' for code at line 10." },
        sequence: { type: Type.STRING, description: "Mermaid.js sequence diagram syntax. Use IDs like 'L10' where relevant." },
        dependencies: { type: Type.STRING, description: "Mermaid.js class diagram syntax. Use IDs matching line numbers where possible." }
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
          line: { type: Type.INTEGER, description: "The line number" },
          explanation: { type: Type.STRING, description: "Short explanation for this line" }
        },
        required: ["line", "explanation"]
      },
      description: "A list of explanations for specific lines of code used in the diagrams."
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
          line: { type: Type.INTEGER, description: "Line number of the execution (1-indexed)" },
          explanation: { type: Type.STRING, description: "What happens at this step" },
          variables: { 
            type: Type.STRING,
            description: "JSON string representing the current state of variables as an object with variable names as keys and their stringified values"
          },
          stack: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Call stack snapshot" }
        },
        required: ["line", "explanation", "variables", "stack"]
      }
    }
  },
  required: ["steps"]
};

export async function analyzeCode(code: string, language: string, apiKey: string): Promise<AnalysisResult> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Please enter your Gemini API key above');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following ${language} code and provide architectural insights, Mermaid.js diagrams, and key concepts. Keep explanations brief and concise. Output valid JSON.

CRITICAL MERMAID SYNTAX RULES:
1. MANDATORY NEWLINES: You MUST put a newline after the diagram type declaration. 
2. QUOTES: ALWAYS wrap node labels in double quotes.
3. NO SEMICOLONS: Do not use semicolons (;) anywhere in the diagram.
4. CLASS DIAGRAMS: Use "classDiagram" as the first line, then a newline, then your classes.

Keep all explanations short (1-2 sentences max). Be concise.

CODE:
${code}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Analysis failed. Please try again.");
  }
}

export async function generateTrace(code: string, language: string, apiKey: string): Promise<ExecutionTrace> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Please enter your Gemini API key above');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Simulate the step-by-step execution of this ${language} code. Provide a trace of variable states and line highlights. Keep explanations brief (1 sentence per step). Focus on the most common execution path. Output valid JSON.

IMPORTANT: The "variables" field should be a JSON string representing an object with variable names as keys and their stringified values (e.g., "{\\"x\\": \\"5\\", \\"arr\\": \\"[1,2,3]\\", \\"flag\\": \\"true\\"}").

CODE:
${code}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: EXECUTION_TRACE_SCHEMA
    }
  });

  try {
    const trace = JSON.parse(response.text);
    // Parse variables string to object for each step
    trace.steps = trace.steps.map((step: any) => ({
      ...step,
      variables: typeof step.variables === 'string' ? JSON.parse(step.variables) : step.variables
    }));
    return trace;
  } catch (e) {
    console.error("Failed to parse trace response", e);
    throw new Error("Trace generation failed.");
  }
}

export async function askQuestion(code: string, language: string, question: string, conversationHistory: Array<{role: string, content: string}> = [], apiKey: string): Promise<string> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Please enter your Gemini API key above');
  }

  const ai = new GoogleGenAI({ apiKey });

  let prompt = `You are a helpful coding assistant named as Codelens-AI. Answer questions about the provided code concisely and clearly. Keep responses brief and to the point (2-3 sentences max).\n\nHere is the ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``;

  // Add conversation history if provided
  if (conversationHistory.length > 0) {
    const historyText = conversationHistory.slice(-4).map(msg => {
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      return `${prefix}: ${msg.content}`;
    }).join('\n\n');
    prompt = `${historyText}\n\n${prompt}`;
  }

  prompt = `${prompt}\n\nUser question: ${question}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}