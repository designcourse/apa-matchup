import type { Player, PlayerStats, HeadToHead } from '../data/types';
import { getBaseWinProbability, getExpectedPPM } from './skill-level-tables';

export interface WinProbabilityFactors {
  skillLevelAdvantage: number;    // 0-1, based on handicap system
  winPercentageDelta: number;     // 0-1, based on historical win rates
  headToHeadRecord: number;       // 0-1, based on h2h history
  recentFormTrend: number;        // 0-1, based on last 4 weeks
  ppmEfficiency: number;          // 0-1, based on PPM vs expected
}

export interface WinProbabilityResult {
  probability: number;            // 0-1 final probability
  factors: WinProbabilityFactors;
  confidence: number;             // 0-1 how confident in this prediction
  dataPoints: number;             // Number of data points used
}

// Factor weights for the algorithm
const WEIGHTS = {
  skillLevelAdvantage: 0.35,
  winPercentageDelta: 0.25,
  headToHeadRecord: 0.20,
  recentFormTrend: 0.15,
  ppmEfficiency: 0.05,
};

/**
 * Calculate win probability for a player against an opponent
 */
export function calculateWinProbability(
  player: Player,
  playerStats: PlayerStats | undefined,
  opponent: Player,
  opponentStats: PlayerStats | undefined,
  headToHead?: HeadToHead,
  recentPlayerStats?: PlayerStats[], // Last few sessions
  recentOpponentStats?: PlayerStats[]
): WinProbabilityResult {
  let dataPoints = 0;

  // 1. Skill Level Advantage (always available)
  const baseProb = getBaseWinProbability(player.skillLevel, opponent.skillLevel);
  const skillLevelAdvantage = baseProb;
  dataPoints += 1;

  // 2. Win Percentage Delta
  let winPercentageDelta = 0.5; // Neutral if no data
  if (playerStats && opponentStats && playerStats.matchesPlayed > 0 && opponentStats.matchesPlayed > 0) {
    const playerWinRate = playerStats.winPct / 100;
    const opponentWinRate = opponentStats.winPct / 100;
    // Convert to probability space (0.5 = equal)
    winPercentageDelta = 0.5 + (playerWinRate - opponentWinRate) * 0.5;
    winPercentageDelta = Math.max(0.2, Math.min(0.8, winPercentageDelta));
    dataPoints += 2;
  }

  // 3. Head-to-Head Record
  let headToHeadRecord = 0.5; // Neutral if no history
  if (headToHead && headToHead.totalGames > 0) {
    headToHeadRecord = headToHead.wins / headToHead.totalGames;
    // Regress to mean based on sample size
    const regFactor = Math.min(headToHead.totalGames / 10, 1);
    headToHeadRecord = 0.5 + (headToHeadRecord - 0.5) * regFactor;
    dataPoints += headToHead.totalGames;
  }

  // 4. Recent Form Trend
  let recentFormTrend = 0.5;
  if (recentPlayerStats && recentPlayerStats.length > 0) {
    // Calculate trend: are they getting better or worse?
    const recentWinRate = recentPlayerStats.reduce((sum, s) => sum + s.winPct, 0) / recentPlayerStats.length / 100;
    const seasonWinRate = playerStats?.winPct ? playerStats.winPct / 100 : 0.5;
    
    // If recent > season, they're hot
    const playerTrend = 0.5 + (recentWinRate - seasonWinRate) * 2;
    
    let opponentTrend = 0.5;
    if (recentOpponentStats && recentOpponentStats.length > 0) {
      const oppRecentWinRate = recentOpponentStats.reduce((sum, s) => sum + s.winPct, 0) / recentOpponentStats.length / 100;
      const oppSeasonWinRate = opponentStats?.winPct ? opponentStats.winPct / 100 : 0.5;
      opponentTrend = 0.5 + (oppRecentWinRate - oppSeasonWinRate) * 2;
    }
    
    recentFormTrend = 0.5 + (playerTrend - opponentTrend) * 0.5;
    recentFormTrend = Math.max(0.3, Math.min(0.7, recentFormTrend));
    dataPoints += recentPlayerStats.length;
  }

  // 5. PPM Efficiency
  let ppmEfficiency = 0.5;
  if (playerStats && opponentStats) {
    const playerExpectedPPM = getExpectedPPM(player.skillLevel);
    const opponentExpectedPPM = getExpectedPPM(opponent.skillLevel);
    
    const playerEfficiency = playerStats.ppm / playerExpectedPPM;
    const opponentEfficiency = opponentStats.ppm / opponentExpectedPPM;
    
    // Convert to probability space
    ppmEfficiency = 0.5 + (playerEfficiency - opponentEfficiency) * 0.25;
    ppmEfficiency = Math.max(0.3, Math.min(0.7, ppmEfficiency));
    dataPoints += 2;
  }

  // Calculate weighted probability
  const factors: WinProbabilityFactors = {
    skillLevelAdvantage,
    winPercentageDelta,
    headToHeadRecord,
    recentFormTrend,
    ppmEfficiency,
  };

  const probability = 
    WEIGHTS.skillLevelAdvantage * factors.skillLevelAdvantage +
    WEIGHTS.winPercentageDelta * factors.winPercentageDelta +
    WEIGHTS.headToHeadRecord * factors.headToHeadRecord +
    WEIGHTS.recentFormTrend * factors.recentFormTrend +
    WEIGHTS.ppmEfficiency * factors.ppmEfficiency;

  // Confidence is based on amount of data available
  // More data = more confident in the prediction
  const maxDataPoints = 50; // Arbitrary max for normalization
  const confidence = Math.min(dataPoints / maxDataPoints, 1);

  return {
    probability: Math.max(0.15, Math.min(0.85, probability)),
    factors,
    confidence,
    dataPoints,
  };
}

/**
 * Calculate risk level for a matchup given the current match state
 */
export function assessMatchupRisk(
  winProbability: number,
  ourScore: number,
  theirScore: number,
  gameNumber: number
): 'low' | 'medium' | 'high' {
  const gamesRemaining = 5 - gameNumber + 1;
  const scoreDeficit = theirScore - ourScore;
  
  // If we're ahead, we can take more risks with lower probability matchups
  if (ourScore > theirScore) {
    return winProbability > 0.35 ? 'low' : winProbability > 0.25 ? 'medium' : 'high';
  }
  
  // If we're behind and need wins, be more conservative
  if (scoreDeficit >= gamesRemaining) {
    // Must win situation - take the highest probability option
    return winProbability > 0.5 ? 'low' : winProbability > 0.4 ? 'medium' : 'high';
  }
  
  // Close game - balance risk
  return winProbability > 0.45 ? 'low' : winProbability > 0.35 ? 'medium' : 'high';
}

/**
 * Generate human-readable reasoning for a matchup recommendation
 */
export function generateReasoning(
  player: Player,
  opponent: Player,
  factors: WinProbabilityFactors,
  headToHead?: HeadToHead
): string[] {
  const reasons: string[] = [];
  
  // Skill level
  const slDiff = player.skillLevel - opponent.skillLevel;
  if (slDiff > 0) {
    reasons.push(`${player.name} is a higher skill level (SL${player.skillLevel} vs SL${opponent.skillLevel})`);
  } else if (slDiff < 0) {
    reasons.push(`${player.name} gets favorable handicap (SL${player.skillLevel} vs SL${opponent.skillLevel})`);
  } else {
    reasons.push(`Even skill level matchup (both SL${player.skillLevel})`);
  }
  
  // Win percentage
  if (factors.winPercentageDelta > 0.55) {
    reasons.push(`${player.name} has a higher win percentage this season`);
  } else if (factors.winPercentageDelta < 0.45) {
    reasons.push(`${opponent.name} has been winning more consistently`);
  }
  
  // Head to head
  if (headToHead && headToHead.totalGames > 0) {
    const winRate = Math.round((headToHead.wins / headToHead.totalGames) * 100);
    if (winRate > 55) {
      reasons.push(`${player.name} is ${headToHead.wins}-${headToHead.losses} against ${opponent.name}`);
    } else if (winRate < 45) {
      reasons.push(`${opponent.name} has won most of their matchups (${headToHead.losses}-${headToHead.wins})`);
    } else {
      reasons.push(`Even head-to-head history (${headToHead.wins}-${headToHead.losses})`);
    }
  }
  
  // Recent form
  if (factors.recentFormTrend > 0.55) {
    reasons.push(`${player.name} has been performing well recently`);
  } else if (factors.recentFormTrend < 0.45) {
    reasons.push(`${player.name} may be in a slump lately`);
  }
  
  return reasons;
}
