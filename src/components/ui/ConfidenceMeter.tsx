interface ConfidenceMeterProps {
  value: number; // 0-1
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
}

export function ConfidenceMeter({
  value,
  label,
  size = 'md',
  showPercentage = true,
}: ConfidenceMeterProps) {
  const percentage = Math.round(value * 100);
  
  const getColor = (val: number) => {
    if (val >= 0.7) return { stroke: 'stroke-green-500', text: 'text-green-400' };
    if (val >= 0.5) return { stroke: 'stroke-yellow-500', text: 'text-yellow-400' };
    return { stroke: 'stroke-red-500', text: 'text-red-400' };
  };
  
  const colors = getColor(value);
  
  const sizes = {
    sm: { width: 60, strokeWidth: 4, fontSize: 'text-sm' },
    md: { width: 80, strokeWidth: 6, fontSize: 'text-lg' },
    lg: { width: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  };
  
  const { width, strokeWidth, fontSize } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value * circumference);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width }}>
        <svg
          className="transform -rotate-90"
          width={width}
          height={width}
        >
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${colors.stroke} transition-all duration-500`}
          />
        </svg>
        
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${fontSize} font-bold ${colors.text}`}>
              {percentage}%
            </span>
          </div>
        )}
      </div>
      
      {label && (
        <span className="mt-2 text-slate-400 text-sm">{label}</span>
      )}
    </div>
  );
}

interface LinearConfidenceProps {
  value: number;
  label: string;
  showValue?: boolean;
}

export function LinearConfidence({
  value,
  label,
  showValue = true,
}: LinearConfidenceProps) {
  const percentage = Math.round(value * 100);
  
  const getColor = (val: number) => {
    if (val >= 0.7) return 'bg-green-500';
    if (val >= 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-slate-400 text-sm">{label}</span>
        {showValue && (
          <span className="text-slate-300 text-sm font-medium">{percentage}%</span>
        )}
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
