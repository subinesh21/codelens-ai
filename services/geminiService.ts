
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ExecutionTrace } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
          variables: { type: Type.OBJECT, description: "JSON object representing the current state of variables" },
          stack: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Call stack snapshot" }
        },
        required: ["line", "explanation", "variables", "stack"]
      }
    }
  },
  required: ["steps"]
};

export async function analyzeCode(code: string, language: string): Promise<AnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following ${language} code and provide architectural insights, Mermaid.js diagrams, and key concepts. Output valid JSON.

CRITICAL MERMAID SYNTAX RULES (FAILURE TO FOLLOW CAUSES ERRORS):
1. MANDATORY NEWLINES: You MUST put a newline after the diagram type declaration. 
2. CLICK-TO-CODE: For flowchart nodes that represent specific lines of code, use IDs in the format L[number], for example: L12["Check if x > 0"].
3. QUOTES: ALWAYS wrap node labels in double quotes.
4. NO SEMICOLONS: Do not use semicolons (;) anywhere in the diagram.
5. CLASS DIAGRAMS: Use "classDiagram" as the first line, then a newline, then your classes.

LINE EXPLANATIONS:
Provide explanations for every significant line ID (L[number]) used in the diagrams.

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

export async function generateTrace(code: string, language: string): Promise<ExecutionTrace> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Simulate the step-by-step execution of this ${language} code. Provide a trace of variable states and line highlights. Focus on the most common execution path. Output valid JSON.

CODE:
${code}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: EXECUTION_TRACE_SCHEMA
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse trace response", e);
    throw new Error("Trace generation failed.");
  }
}
