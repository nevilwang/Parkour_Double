import React from 'react';

interface StickFigureProps {
  x: number;
  y: number;
  size: number;
  isRunning?: boolean;
  direction?: 'right' | 'forward';
  state?: 'running' | 'jumping' | 'crawling';
}

const StickFigure: React.FC<StickFigureProps> = ({ 
  x, 
  y, 
  size, 
  isRunning = false, 
  direction = 'right',
  state = 'running'
}) => {
  const headRadius = size * 0.15;
  const bodyHeight = size * 0.4;
  const limbLength = size * 0.25;
  
  // Animation offset for running
  const animOffset = isRunning ? Math.sin(Date.now() * 0.015) * 4 : 0;
  
  if (direction === 'forward') {
    // Top screen - running into screen (smaller perspective)
    const scale = 0.8;
    return (
      <g transform={`translate(${x}, ${y})`}>
        {/* Head */}
        <circle 
          cx={0} 
          cy={-bodyHeight - headRadius} 
          r={headRadius * scale} 
          fill="none" 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Body */}
        <line 
          x1={0} 
          y1={-bodyHeight} 
          x2={0} 
          y2={0} 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Arms - perspective view */}
        <line 
          x1={0} 
          y1={-bodyHeight * 0.7} 
          x2={-limbLength * 0.6 * scale + animOffset} 
          y2={-bodyHeight * 0.5} 
          stroke="black" 
          strokeWidth="2"
        />
        <line 
          x1={0} 
          y1={-bodyHeight * 0.7} 
          x2={limbLength * 0.6 * scale - animOffset} 
          y2={-bodyHeight * 0.5} 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Legs - perspective view */}
        <line 
          x1={0} 
          y1={0} 
          x2={-limbLength * 0.4 * scale - animOffset} 
          y2={limbLength * scale} 
          stroke="black" 
          strokeWidth="2"
        />
        <line 
          x1={0} 
          y1={0} 
          x2={limbLength * 0.4 * scale + animOffset} 
          y2={limbLength * scale} 
          stroke="black" 
          strokeWidth="2"
        />
      </g>
    );
  }
  
  // Bottom screen - running to the right
  if (state === 'crawling') {
    // Crawling pose
    return (
      <g transform={`translate(${x}, ${y})`}>
        {/* Head - lower position */}
        <circle 
          cx={headRadius} 
          cy={-headRadius * 2} 
          r={headRadius} 
          fill="none" 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Body - horizontal */}
        <line 
          x1={0} 
          y1={-headRadius} 
          x2={bodyHeight} 
          y2={-headRadius} 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Arms - supporting body */}
        <line 
          x1={bodyHeight * 0.3} 
          y1={-headRadius} 
          x2={bodyHeight * 0.3} 
          y2={limbLength * 0.5} 
          stroke="black" 
          strokeWidth="2"
        />
        <line 
          x1={bodyHeight * 0.7} 
          y1={-headRadius} 
          x2={bodyHeight * 0.7} 
          y2={limbLength * 0.5} 
          stroke="black" 
          strokeWidth="2"
        />
        
        {/* Legs - bent */}
        <line 
          x1={bodyHeight * 0.2} 
          y1={-headRadius} 
          x2={bodyHeight * 0.1} 
          y2={limbLength * 0.3} 
          stroke="black" 
          strokeWidth="2"
        />
        <line 
          x1={bodyHeight * 0.8} 
          y1={-headRadius} 
          x2={bodyHeight * 0.9} 
          y2={limbLength * 0.3} 
          stroke="black" 
          strokeWidth="2"
        />
      </g>
    );
  }
  
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Head */}
      <circle 
        cx={0} 
        cy={-bodyHeight - headRadius} 
        r={headRadius} 
        fill="none" 
        stroke="black" 
        strokeWidth="2"
      />
      
      {/* Body */}
      <line 
        x1={0} 
        y1={-bodyHeight} 
        x2={0} 
        y2={0} 
        stroke="black" 
        strokeWidth="2"
      />
      
      {/* Arms - running motion */}
      <line 
        x1={0} 
        y1={-bodyHeight * 0.7} 
        x2={limbLength + animOffset} 
        y2={-bodyHeight * 0.5} 
        stroke="black" 
        strokeWidth="2"
      />
      <line 
        x1={0} 
        y1={-bodyHeight * 0.7} 
        x2={-limbLength - animOffset} 
        y2={-bodyHeight * 0.5} 
        stroke="black" 
        strokeWidth="2"
      />
      
      {/* Legs - running motion */}
      <line 
        x1={0} 
        y1={0} 
        x2={limbLength * 0.8 + animOffset} 
        y2={limbLength} 
        stroke="black" 
        strokeWidth="2"
      />
      <line 
        x1={0} 
        y1={0} 
        x2={-limbLength * 0.8 - animOffset} 
        y2={limbLength} 
        stroke="black" 
        strokeWidth="2"
      />
    </g>
  );
};

export default StickFigure;