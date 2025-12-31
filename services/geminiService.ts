// services/geminiService.ts
import { AnalysisResult, ExecutionTrace } from "../types";

// Your Vercel URL (update after deployment)
const API_BASE = 'https://codelens-ai-api.vercel.app/api';

export async function analyzeCode(code: string, language: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, action: 'analyze' }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Analysis failed');
  }

  const data = await response.json();
  return JSON.parse(data.result);
}

export async function generateTrace(code: string, language: string): Promise<ExecutionTrace> {
  const response = await fetch(`${API_BASE}/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, action: 'trace' }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Trace generation failed');
  }

  const data = await response.json();
  return data.result;
}

export async function askQuestion(
  code: string, 
  language: string, 
  question: string, 
  conversationHistory: Array<{role: string, content: string}> = []
): Promise<string> {
  const response = await fetch(`${API_BASE}/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      code, 
      language, 
      action: 'chat',
      question,
      conversationHistory 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get response');
  }

  const data = await response.json();
  return data.result;
}