
import React, { useState } from 'react';
import { ExecutionTrace } from '../types';
import { Play, Pause, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';

interface Props {
  trace: ExecutionTrace;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export const ExecutionStepper: React.FC<Props> = ({ trace, currentStep, onStepChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const stepCount = trace.steps.length;
  const current = trace.steps[currentStep];

  React.useEffect(() => {
    let timer: any;
    if (isPlaying && currentStep < stepCount - 1) {
      timer = setTimeout(() => {
        onStepChange(currentStep + 1);
      }, 1500);
    } else if (currentStep >= stepCount - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, stepCount, onStepChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            className="p-2 hover:bg-slate-700 rounded-md transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-lg"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={() => onStepChange(Math.min(stepCount - 1, currentStep + 1))}
            className="p-2 hover:bg-slate-700 rounded-md transition-colors"
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              onStepChange(0);
            }}
            className="p-2 hover:bg-slate-700 rounded-md transition-colors ml-2"
          >
            <RotateCcw size={18} />
          </button>
        </div>
        
        <div className="text-xs text-slate-400 font-mono">
          Step {currentStep + 1} / {stepCount}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-blue-500 h-full transition-all duration-300" 
          style={{ width: `${((currentStep + 1) / stepCount) * 100}%` }}
        />
      </div>

      {/* Step Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wider">Current Action</h4>
          <p className="text-sm text-slate-300">{current.explanation}</p>
        </div>
        
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Variables</h4>
          <div className="space-y-1">
            {Object.entries(current.variables).length > 0 ? (
              Object.entries(current.variables).map(([key, val]) => (
                <div key={key} className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">{key}:</span>
                  <span className="text-emerald-300">{JSON.stringify(val)}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-500">No variables set</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Stack Trace */}
      <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
        <h4 className="text-sm font-semibold text-purple-400 mb-2 uppercase tracking-wider">Call Stack</h4>
        <div className="flex flex-col-reverse gap-1">
          {current.stack.map((frame, i) => (
            <div key={i} className="px-3 py-1 bg-slate-700/50 border-l-2 border-purple-500 text-xs font-mono rounded">
              {frame}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
