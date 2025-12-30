
export interface AnalysisResult {
  summary: string;
  architecture: string;
  diagrams: {
    flowchart: string;
    sequence: string;
    dependencies: string;
  };
  concepts: Array<{
    name: string;
    description: string;
  }>;
  learningPath: Array<{
    step: string;
    detail: string;
  }>;
  lineExplanations?: Array<{
    line: number;
    explanation: string;
  }>;
}

export interface ExecutionStep {
  line: number;
  explanation: string;
  variables: Record<string, any>;
  stack: string[];
}

export interface ExecutionTrace {
  steps: ExecutionStep[];
}

export enum TabType {
  DIAGRAMS = 'DIAGRAMS',
  VISUALIZER = 'VISUALIZER',
  LEARNING_PATH = 'LEARNING_PATH'
}
