
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

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

  useEffect(() => {
    if (ref.current && chart) {
      setRenderError(null);
      ref.current.removeAttribute('data-processed');
      
      const renderDiagram = async () => {
        try {
          let cleanChart = chart.trim();
          const headers = ['graph TD', 'graph LR', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'erDiagram'];
          for (const header of headers) {
            if (cleanChart.startsWith(header) && !cleanChart.includes('\n')) {
               cleanChart = cleanChart.replace(header, header + '\n');
            } else if (cleanChart.startsWith(header) && cleanChart.charAt(header.length) !== '\n' && cleanChart.charAt(header.length) !== ' ') {
               cleanChart = header + '\n' + cleanChart.substring(header.length);
            }
          }
          cleanChart = cleanChart.replace(/;/g, '');

          const { svg } = await mermaid.render(`mermaid-${id.replace(/[^a-zA-Z0-9]/g, '-')}`, cleanChart);
          if (ref.current) {
            ref.current.innerHTML = svg;
            
            // Attach click listeners to nodes
            const nodes = ref.current.querySelectorAll('.node, .actor, .classGroup');
            nodes.forEach((node) => {
              const elementId = node.id || '';
              // Match L[number] pattern (e.g., L12, mermaid-L12-42)
              const match = elementId.match(/L(\d+)/);
              if (match && onNodeClick) {
                const line = parseInt(match[1], 10);
                (node as HTMLElement).style.cursor = 'pointer';
                (node as HTMLElement).addEventListener('click', (e) => {
                  e.stopPropagation();
                  onNodeClick(line);
                });
                
                // Add a hover effect
                (node as HTMLElement).addEventListener('mouseenter', () => {
                  (node as HTMLElement).classList.add('brightness-125');
                });
                (node as HTMLElement).addEventListener('mouseleave', () => {
                  (node as HTMLElement).classList.remove('brightness-125');
                });
              }
            });
          }
        } catch (err) {
          console.error("Mermaid render error:", err);
          setRenderError("Rendering engine failed to parse this diagram.");
        }
      };

      renderDiagram();
    }
  }, [chart, id, onNodeClick]);

  if (renderError) {
    return (
      <div className="p-4 bg-slate-900 rounded-lg border border-red-500/30 text-red-400 text-xs font-mono">
        <p className="font-bold mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Diagram Rendering Error
        </p>
        <p className="opacity-80">The generated Mermaid syntax has structural issues.</p>
        <details className="mt-2">
          <summary className="cursor-pointer hover:underline">View Source</summary>
          <pre className="mt-2 p-2 bg-slate-950 rounded text-[10px] opacity-60 overflow-x-auto whitespace-pre-wrap">{chart}</pre>
        </details>
      </div>
    );
  }

  return (
    <div 
      ref={ref} 
      className="mermaid flex justify-center p-4 bg-slate-900 rounded-lg overflow-auto border border-slate-700 shadow-inner min-h-[100px] transition-all" 
    />
  );
};
