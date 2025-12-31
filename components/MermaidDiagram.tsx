import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize Mermaid with better settings
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#1e40af',
    lineColor: '#94a3b8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a'
  },
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis'
  }
});

interface Props {
  chart: string;
  id: string;
  onNodeClick?: (line: number) => void;
}

export const MermaidDiagram: React.FC<Props> = ({ chart, id, onNodeClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to clean Mermaid syntax
  const cleanMermaidSyntax = (code: string): string => {
    let cleaned = code.trim();
    
    // Remove any markdown code blocks
    cleaned = cleaned.replace(/```mermaid\s*/g, '');
    cleaned = cleaned.replace(/```\s*$/g, '');
    
    // Ensure proper newline after diagram type
    const diagramTypes = ['graph TD', 'graph LR', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'erDiagram'];
    
    for (const type of diagramTypes) {
      if (cleaned.startsWith(type)) {
        // Ensure there's a newline after the type
        const afterType = cleaned.substring(type.length);
        if (!afterType.startsWith('\n') && !afterType.startsWith(' ')) {
          cleaned = type + '\n' + afterType.trimStart();
        }
        break;
      }
    }
    
    // Remove semicolons
    cleaned = cleaned.replace(/;/g, '');
    
    // Fix quotes for flowcharts
    if (cleaned.startsWith('graph')) {
      // Remove extra quotes to avoid double quotes
      cleaned = cleaned.replace(/""/g, '"');
      // Ensure all node labels have quotes
      const lines = cleaned.split('\n');
      const fixedLines = lines.map((line, index) => {
        if (index === 0) return line; // Skip header
        
        // Add quotes to unquoted node names in flowcharts
        const arrowMatch = line.match(/(\s*)(\w+)(\s*-->|\s*--|\s*->)/);
        if (arrowMatch) {
          const [, spaces, nodeName, arrow] = arrowMatch;
          if (!line.includes('"')) {
            line = spaces + '"' + nodeName + '"' + arrow;
          }
        }
        
        return line;
      });
      cleaned = fixedLines.join('\n');
    }
    
    return cleaned;
  };

  useEffect(() => {
    if (ref.current && chart) {
      setIsLoading(true);
      setRenderError(null);
      
      // Clear previous content
      ref.current.innerHTML = '';
      ref.current.removeAttribute('data-processed');
      
      const renderDiagram = async () => {
        try {
          const cleanedChart = cleanMermaidSyntax(chart);
          
          if (!cleanedChart.trim()) {
            throw new Error('Empty diagram code');
          }
          
          // Create unique ID for this render
          const mermaidId = `mermaid-${id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Try to render with timeout
          const renderPromise = mermaid.render(mermaidId, cleanedChart);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Mermaid render timeout (5s)')), 5000)
          );
          
          const { svg } = await Promise.race([renderPromise, timeoutPromise]) as any;
          
          if (ref.current) {
            ref.current.innerHTML = svg;
            
            // Add click handlers if needed
            if (onNodeClick) {
              const nodes = ref.current.querySelectorAll('.node, .actor, .classGroup, .label');
              nodes.forEach((node) => {
                const elementId = node.id || '';
                const match = elementId.match(/L(\d+)/);
                if (match) {
                  const line = parseInt(match[1], 10);
                  (node as HTMLElement).style.cursor = 'pointer';
                  (node as HTMLElement).onclick = (e) => {
                    e.stopPropagation();
                    onNodeClick(line);
                  };
                  
                  // Add hover effect
                  (node as HTMLElement).onmouseenter = () => {
                    (node as HTMLElement).style.filter = 'brightness(1.2)';
                  };
                  (node as HTMLElement).onmouseleave = () => {
                    (node as HTMLElement).style.filter = 'brightness(1)';
                  };
                }
              });
            }
            
            setIsLoading(false);
          }
        } catch (err: any) {
          console.error("Mermaid render error:", err);
          setRenderError(err.message || 'Failed to render diagram');
          setIsLoading(false);
          
          // Display fallback
          if (ref.current) {
            ref.current.innerHTML = `
              <div class="p-6 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
                <div class="text-slate-500 text-sm mb-2">Diagram preview unavailable</div>
                <div class="text-xs text-slate-600">Syntax validation needed</div>
              </div>
            `;
          }
        }
      };

      renderDiagram();
    } else if (!chart) {
      setIsLoading(false);
      setRenderError('No diagram code provided');
    }
  }, [chart, id, onNodeClick]);

  if (isLoading) {
    return (
      <div className="p-8 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center min-h-[150px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Rendering diagram...</p>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg border border-red-500/30 text-red-400">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-xs font-bold uppercase">Diagram Error</span>
        </div>
        <p className="text-sm mb-3 opacity-80">{renderError}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors">
            View Source Code
          </summary>
          <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-800">
            <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all overflow-auto max-h-40">
              {chart}
            </pre>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div 
      ref={ref} 
      className="mermaid flex justify-center items-center p-4 bg-slate-900 rounded-lg overflow-auto border border-slate-700 shadow-inner min-h-[150px] transition-all" 
    />
  );
};