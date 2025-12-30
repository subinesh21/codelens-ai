
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Code2, 
  Layers, 
  PlayCircle, 
  Map, 
  Search, 
  ChevronRight, 
  Cpu, 
  Lightbulb, 
  FileCode,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';
import { AnalysisResult, ExecutionTrace, TabType } from './types';
import { analyzeCode, generateTrace } from './services/geminiService';
import { MermaidDiagram } from './components/MermaidDiagram';
import { ExecutionStepper } from './components/ExecutionStepper';

const DEFAULT_CODE = `function findMax(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}

const numbers = [3, 7, 2, 9, 5];
console.log(findMax(numbers));`;

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
];

const App: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('javascript');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(TabType.DIAGRAMS);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setSelectedLine(null);
    try {
      const result = await analyzeCode(code, language);
      setAnalysis(result);
      const traceResult = await generateTrace(code, language);
      setTrace(traceResult);
      setCurrentStep(0);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const highlightedLine = useMemo(() => {
    if (activeTab === TabType.VISUALIZER && trace && trace.steps[currentStep]) {
      return trace.steps[currentStep].line;
    }
    if (activeTab === TabType.DIAGRAMS && selectedLine !== null) {
      return selectedLine;
    }
    return null;
  }, [activeTab, trace, currentStep, selectedLine]);

  // Scroll to line effect
  useEffect(() => {
    if (highlightedLine !== null) {
      const element = document.getElementById(`code-line-${highlightedLine}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedLine]);

  const handleNodeClick = useCallback((line: number) => {
    setSelectedLine(line);
  }, []);

  const renderCodeLines = () => {
    return code.split('\n').map((line, i) => (
      <div 
        key={i} 
        id={`code-line-${i+1}`}
        className={`flex px-4 font-mono text-sm leading-6 transition-all duration-300 relative ${
          highlightedLine === i + 1 
            ? 'bg-blue-500/30 border-l-4 border-blue-500 z-10 scale-[1.01] shadow-sm' 
            : 'border-l-4 border-transparent'
        }`}
      >
        <span className={`w-8 mr-4 select-none text-right transition-colors ${highlightedLine === i + 1 ? 'text-blue-300 font-bold' : 'text-slate-600'}`}>
          {i + 1}
        </span>
        <pre className={`transition-colors whitespace-pre ${highlightedLine === i + 1 ? 'text-white' : 'text-slate-400'}`}>
          {line || ' '}
        </pre>
      </div>
    ));
  };

  const selectedLineExplanation = useMemo(() => {
    if (selectedLine === null || !analysis?.lineExplanations) return null;
    return analysis.lineExplanations.find(item => item.line === selectedLine)?.explanation || null;
  }, [selectedLine, analysis]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:rotate-12 transition-all duration-300">
            <Cpu className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">CodeLens AI</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">Visual Intelligence</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="relative group">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="appearance-none bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold py-2 px-4 pr-10 rounded-lg cursor-pointer transition-all outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${
              isAnalyzing 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95 hover:-translate-y-0.5'
            }`}
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
            {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Code Editor Area */}
        <section className="w-1/2 flex flex-col border-r border-slate-800 bg-slate-900 shadow-2xl z-10">
          <div className="h-10 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <FileCode size={14} className="text-blue-500" />
              Editor
            </div>
            <div className="text-[10px] text-slate-600 font-mono">
              {code.length} characters
            </div>
          </div>
          
          <div className="flex-1 relative overflow-hidden">
            <textarea
              className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-text resize-none p-4 font-mono text-sm leading-6 outline-none"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
            />
            <div 
              ref={codeContainerRef}
              className="absolute inset-0 overflow-auto py-4 bg-slate-950 scroll-smooth"
            >
              {renderCodeLines()}
            </div>
          </div>

          {/* Quick Insights Footer */}
          {analysis && (
            <div className="p-5 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-500">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Search size={14} className="text-blue-400" /> Executive Summary
              </h3>
              <p className="text-sm text-slate-300 italic leading-relaxed font-medium">
                "{analysis.summary}"
              </p>
            </div>
          )}
        </section>

        {/* Right: Analysis & Visualizations */}
        <section className="w-1/2 flex flex-col bg-slate-950 overflow-hidden relative">
          {/* Analysis Tabs */}
          <div className="h-12 flex border-b border-slate-800 bg-slate-900 sticky top-0 z-30">
            {[
              { id: TabType.DIAGRAMS, icon: <Layers size={18} />, label: 'Architecture' },
              { id: TabType.VISUALIZER, icon: <PlayCircle size={18} />, label: 'Execution' },
              { id: TabType.LEARNING_PATH, icon: <Map size={18} />, label: 'Blueprint' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all relative ${
                  activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.icon} {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)] rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)]">
            {!analysis && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-sm mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                  <div className="w-24 h-24 rounded-[2rem] bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-700 shadow-2xl relative group-hover:scale-110 transition-transform duration-500">
                    <Code2 size={48} className="text-slate-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Code Intelligence Engine</h2>
                  <p className="text-slate-500 mt-3 text-sm leading-relaxed">
                    Paste your logic and unleash AI to generate interactive architectural maps and execution simulations.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {['Interactive Diagrams', 'Step-by-Step Sim', 'Learning Paths'].map(tag => (
                      <span key={tag} className="px-3 py-1 bg-slate-800/50 border border-slate-700 text-[10px] text-slate-400 rounded-full font-bold uppercase tracking-tighter">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
                <div className="relative">
                  <div className="absolute inset-0 blur-[40px] bg-blue-500/30 animate-pulse rounded-full" />
                  <div className="relative p-6 bg-slate-900 rounded-full border border-blue-500/20">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest">Processing Logic</h3>
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  </div>
                  <p className="text-slate-500 mt-4 text-xs font-medium max-w-xs mx-auto">
                    Building flowcharts, dependency graphs and verifying execution traces...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-950/40 border border-red-500/30 p-5 rounded-2xl flex gap-4 text-red-200 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                  <AlertCircle className="text-red-500" size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-red-400 mb-1">Analysis Failed</h4>
                  <p className="text-sm opacity-90">{error}</p>
                </div>
              </div>
            )}

            {analysis && !isAnalyzing && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-16">
                {activeTab === TabType.DIAGRAMS && (
                  <div className="space-y-12">
                    {/* Interactive Context Header */}
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-inner">
                      <div className="p-2 bg-blue-600/20 rounded-xl">
                        <Info className="text-blue-400" size={18} />
                      </div>
                      <p className="text-xs text-blue-100/80 leading-relaxed font-medium">
                        <b>Click-to-Code:</b> Select any node in the flowchart below to highlight its source and reveal specific logic insights.
                      </p>
                    </div>

                    {/* Selected Line Breakdown Card */}
                    {selectedLine !== null && (
                      <div className="bg-slate-900 border-l-4 border-blue-500 p-5 rounded-r-2xl shadow-2xl animate-in slide-in-from-left-6 duration-500 ring-1 ring-slate-800">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                             <div className="px-2 py-0.5 bg-blue-600/20 rounded text-[10px] font-black text-blue-400">LINE {selectedLine}</div>
                             <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Logic Breakdown</h4>
                          </div>
                          <button 
                            onClick={() => setSelectedLine(null)}
                            className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-500"
                          >
                            <span className="text-xs font-bold px-1">✕</span>
                          </button>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed font-medium">
                          {selectedLineExplanation || "This node represents the core logic execution at this line. Hover for more details in the diagram."}
                        </p>
                      </div>
                    )}

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Logical Flow Mapping</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.flowchart} id="flow" onNodeClick={handleNodeClick} />
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sequence & Call Order</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.sequence} id="seq" onNodeClick={handleNodeClick} />
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Dependency Hierarchy</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.dependencies} id="dep" onNodeClick={handleNodeClick} />
                    </section>
                  </div>
                )}

                {activeTab === TabType.VISUALIZER && trace && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
                       <ExecutionStepper 
                        trace={trace} 
                        currentStep={currentStep} 
                        onStepChange={setCurrentStep} 
                      />
                    </div>
                  </div>
                )}

                {activeTab === TabType.LEARNING_PATH && (
                  <div className="space-y-12 animate-in fade-in duration-500">
                    <div className="bg-slate-900 rounded-[2rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all duration-500 -rotate-12 translate-x-12 -translate-y-4">
                        <Lightbulb size={200} />
                      </div>
                      <div className="flex items-center gap-4 mb-8 relative">
                        <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                          <Lightbulb className="text-yellow-400" size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white tracking-tight uppercase">Technical Glossary</h3>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Concepts used in this code</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
                        {analysis.concepts.map((c, i) => (
                          <div key={i} className="p-5 bg-slate-800/20 rounded-2xl border border-slate-700/30 hover:border-blue-500/40 hover:bg-slate-800/40 transition-all duration-300 group/card">
                            <h4 className="font-black text-blue-400 mb-2 text-xs uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1 h-1 bg-blue-500 rounded-full group-hover/card:scale-150 transition-transform"></span>
                              {c.name}
                            </h4>
                            <p className="text-xs text-slate-400 leading-relaxed font-medium italic">{c.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="relative pl-12 space-y-12 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-800">
                      {analysis.learningPath.map((step, i) => (
                        <div key={i} className="relative group">
                          <div className="absolute -left-[45px] top-1 w-10 h-10 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center text-xs font-black text-slate-500 group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-xl group-hover:shadow-blue-500/20">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60 group-hover:border-blue-500/30 transition-all duration-300 group-hover:translate-x-1">
                            <h4 className="text-base font-black text-slate-100 uppercase tracking-tight">{step.step}</h4>
                            <p className="text-sm text-slate-500 mt-3 leading-relaxed font-medium">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      
      {/* Footer Info */}
      <footer className="h-10 bg-slate-900/90 border-t border-slate-800 flex items-center px-6 justify-between text-[10px] text-slate-600 font-bold uppercase tracking-[0.15em] backdrop-blur-xl">
        <div className="flex gap-8">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500/20 border border-blue-500"></div> Native Analysis</span>
          <span className="flex items-center gap-2 hover:text-slate-400 cursor-default transition-colors">
            <Cpu size={12} className="opacity-50" /> Gemini-3-Flash-Preview
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> 
            Core Operational
          </span>
          <span className="opacity-30">Build v1.2.4</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
