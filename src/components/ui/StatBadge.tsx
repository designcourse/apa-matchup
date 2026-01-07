interface StatBadgeProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export function StatBadge({
  label,
  value,
  variant = 'default',
  size = 'md',
}: StatBadgeProps) {
  const variants = {
    default: 'bg-slate-700 text-slate-300',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg ${variants[variant]} ${sizes[size]}`}>
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

interface ScoreBadgeProps {
  ourScore: number;
  theirScore: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ ourScore, theirScore, size = 'md' }: ScoreBadgeProps) {
  const isWinning = ourScore > theirScore;
  const isTied = ourScore === theirScore;
  
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={`flex items-center gap-2 font-bold ${sizes[size]}`}>
      <span className={isWinning ? 'text-green-400' : isTied ? 'text-slate-300' : 'text-slate-400'}>
        {ourScore}
      </span>
      <span className="text-slate-500">-</span>
      <span className={!isWinning && !isTied ? 'text-red-400' : 'text-slate-400'}>
        {theirScore}
      </span>
    </div>
  );
}

interface SkillLevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

export function SkillLevelBadge({ level, size = 'md' }: SkillLevelBadgeProps) {
  const getColor = (sl: number) => {
    if (sl <= 3) return 'bg-green-500';
    if (sl <= 5) return 'bg-yellow-500';
    if (sl <= 7) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  return (
    <div className={`${getColor(level)} ${sizes[size]} rounded-full flex items-center justify-center text-white font-bold`}>
      {level}
    </div>
  );
}
