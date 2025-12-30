import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Code2, 
  Layers, 
  PlayCircle, 
  Search, 
  ChevronRight, 
  Cpu, 
  FileCode,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  ChevronDown,
  MessageCircle,
  Eye,
  EyeOff,
  Key
} from 'lucide-react';
import { AnalysisResult, ExecutionTrace, TabType } from './types';
import { analyzeCode, generateTrace } from './services/geminiService';
import { MermaidDiagram } from './components/MermaidDiagram';
import { ExecutionStepper } from './components/ExecutionStepper';
import { ChatInterface } from './components/ChatInterface';

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
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(TabType.DIAGRAMS);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Gemini API key');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCode(code, language, apiKey);
      setAnalysis(result);
      const traceResult = await generateTrace(code, language, apiKey);
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
    return null;
  }, [activeTab, trace, currentStep]);

  // Scroll to line effect
  useEffect(() => {
    if (highlightedLine !== null) {
      const element = document.getElementById(`code-line-${highlightedLine}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedLine]);

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

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Select All: Ctrl+A or Cmd+A
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      textareaRef.current?.select();
      return;
    }
    
    // Copy: Ctrl+C or Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      // Let browser handle default copy behavior
      return;
    }
    
    // Paste: Ctrl+V or Cmd+V
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      // Let browser handle default paste behavior
      return;
    }
    
    // Cut: Ctrl+X or Cmd+X
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      // Let browser handle default cut behavior
      return;
    }
    
    // Undo: Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      // Let browser handle default undo behavior
      return;
    }
    
    // Redo: Ctrl+Shift+Z or Cmd+Shift+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      // Let browser handle default redo behavior
      return;
    }
  }, []);

  // Focus textarea when clicking on the code display area
  const handleCodeAreaClick = useCallback((e: React.MouseEvent) => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Set cursor position based on click location
      const rect = codeContainerRef.current?.getBoundingClientRect();
      if (rect && codeContainerRef.current) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Approximate line and column based on click position
        const lineHeight = 24; // Approximate line height
        const charWidth = 8; // Approximate character width
        const padding = 16;
        const line = Math.max(0, Math.floor((y - padding) / lineHeight));
        const col = Math.max(0, Math.floor((x - padding - 32) / charWidth)); // Account for line numbers
        const lines = code.split('\n');
        if (line < lines.length) {
          const lineStart = lines.slice(0, line).join('\n').length + (line > 0 ? 1 : 0);
          const position = Math.min(lineStart + col, lineStart + lines[line].length);
          textareaRef.current.setSelectionRange(position, position);
        }
      }
    }
  }, [code]);

  // Sync scroll between textarea and code display
  useEffect(() => {
    const textarea = textareaRef.current;
    const container = codeContainerRef.current;
    
    if (textarea && container) {
      const handleScroll = () => {
        container.scrollTop = textarea.scrollTop;
        container.scrollLeft = textarea.scrollLeft;
      };
      
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, []);

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
          {/* API Key Input */}
          <div className="relative group">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-blue-400" />
              <input
                type={showApiKey ? "text" : "password"}
                placeholder="Gemini API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 py-2 px-4 rounded-lg w-48 focus:ring-2 focus:ring-blue-500/50 outline-none placeholder:text-slate-600"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
                title={showApiKey ? "Hide key" : "Show key"}
              >
                {showApiKey ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-slate-400" />}
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </div>

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
            disabled={isAnalyzing || !apiKey.trim()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all ${
              !apiKey.trim() 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : isAnalyzing 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95 hover:-translate-y-0.5'
            }`}
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
            {!apiKey.trim() ? 'Enter API Key' : isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
          </button>
        </div>
      </header>

      {/* API Key Info Banner */}
      {!apiKey.trim() && (
        <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-b border-blue-500/30 p-3 text-center">
          <div className="flex items-center justify-center gap-3 text-sm">
            <Info size={16} className="text-blue-400" />
            <span className="text-blue-300">Get your free </span>
            <a 
              href="https://makersuite.google.com/app/apikey" 
              target="_blank"
              className="text-white font-bold hover:underline bg-blue-600 px-3 py-1 rounded-lg hover:bg-blue-500 transition-colors"
            >
              Gemini API Key
            </a>
            <span className="text-blue-300"> from Google AI Studio</span>
          </div>
        </div>
      )}

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
              ref={textareaRef}
              className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-text resize-none p-4 font-mono text-sm leading-6 outline-none"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{ left: '0px', top: '2px' }}
              autoFocus={false}
            />
            <div 
              ref={codeContainerRef}
              className="absolute inset-0 overflow-auto py-4 bg-slate-950 scroll-smooth cursor-text"
              onClick={(e) => {
                handleCodeAreaClick(e);
                textareaRef.current?.focus();
              }}
              onMouseDown={(e) => {
                // Focus textarea immediately on mousedown for proper text selection
                if (textareaRef.current) {
                  textareaRef.current.focus();
                }
              }}
              style={{ pointerEvents: 'auto' }}
            >
              {renderCodeLines()}
            </div>
          </div>

          {/* Quick Insights Footer */}
          {analysis && (
            <div className="p-5 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-500" style={{ height: '150px' }}>
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
              { id: TabType.CHAT, icon: <MessageCircle size={18} />, label: 'Chat' }
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

          <div className={`flex-1 ${activeTab === TabType.CHAT ? 'overflow-hidden p-0' : 'overflow-y-auto p-6'} scroll-smooth bg-[radial-gradient(circle_at_top_right,#1e293b,transparent)]`}>
            {!apiKey.trim() && !analysis && !isAnalyzing && activeTab !== TabType.CHAT && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-sm mx-auto">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                  <div className="w-24 h-24 rounded-[2rem] bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-700 shadow-2xl relative">
                    <Key size={48} className="text-blue-500" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">AI-Powered Code Analysis</h2>
                  <p className="text-slate-500 mt-3 text-sm leading-relaxed">
                    Enter your Gemini API key above to unlock AI-powered code analysis, interactive diagrams, and step-by-step execution simulation.
                  </p>
                  <div className="mt-8">
                    <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-lg font-bold transition-all hover:-translate-y-0.5"
                    >
                      <Sparkles size={16} />
                      Get Free API Key
                    </a>
                  </div>
                </div>
              </div>
            )}

            {!analysis && !isAnalyzing && apiKey.trim() && activeTab !== TabType.CHAT && (
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
                    {['Interactive Diagrams', 'Step-by-Step Sim', 'AI Chat'].map(tag => (
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

            {activeTab === TabType.CHAT && (
              <div className="h-full p-6 animate-in fade-in duration-500">
                <ChatInterface code={code} language={language} apiKey={apiKey} />
              </div>
            )}

            {analysis && !isAnalyzing && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-16">
                {activeTab === TabType.DIAGRAMS && (
                  <div className="space-y-12">
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Logical Flow Mapping</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.flowchart} id="flow" />
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sequence & Call Order</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.sequence} id="seq" />
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2 px-1">
                        <ChevronRight size={14} className="text-blue-500" />
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Dependency Hierarchy</h3>
                      </div>
                      <MermaidDiagram chart={analysis.diagrams.dependencies} id="dep" />
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

              </div>
            )}
          </div>
        </section>
      </main>
      
    </div>
  );
};

export default App;