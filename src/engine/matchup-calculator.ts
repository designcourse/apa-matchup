import type { Player, PlayerStats, HeadToHead, MatchupRecommendation } from '../data/types';
import { calculateWinProbability, generateReasoning } from './win-probability';

export interface MatchupInput {
  player: Player;
  stats?: PlayerStats;
  recentStats?: PlayerStats[];
}

export interface OpponentInput {
  player: Player;
  stats?: PlayerStats;
  recentStats?: PlayerStats[];
}

/**
 * Generate ranked matchup recommendations for available players against an opponent
 */
export function getMatchupRecommendations(
  availablePlayers: MatchupInput[],
  opponent: OpponentInput,
  headToHeadData: Map<string, HeadToHead>,
  _gameNumber: number,
  _ourScore: number,
  _theirScore: number
): MatchupRecommendation[] {
  const recommendations: MatchupRecommendation[] = [];

  for (const playerInput of availablePlayers) {
    const { player, stats, recentStats } = playerInput;
    
    // Get head-to-head record if available
    const h2hKey = `${player.id}-${opponent.player.id}`;
    const headToHead = headToHeadData.get(h2hKey);
    
    // Calculate win probability
    const result = calculateWinProbability(
      player,
      stats,
      opponent.player,
      opponent.stats,
      headToHead,
      recentStats,
      opponent.recentStats
    );
    
    // Generate reasoning
    const reasoning = generateReasoning(
      player,
      opponent.player,
      result.factors,
      headToHead
    );
    
    recommendations.push({
      playerId: player.id,
      playerName: player.name,
      winProbability: Math.round(result.probability * 100) / 100,
      confidence: Math.round(result.confidence * 100) / 100,
      reasoning,
      factors: result.factors,
    });
  }

  // Sort by win probability (highest first)
  return recommendations.sort((a, b) => b.winProbability - a.winProbability);
}

/**
 * Find the best player to throw first when we have the choice
 */
export function getBestOpener(
  availablePlayers: MatchupInput[],
  opponents: OpponentInput[],
  headToHeadData: Map<string, HeadToHead>
): MatchupRecommendation | null {
  if (availablePlayers.length === 0 || opponents.length === 0) {
    return null;
  }

  let bestAvgProbability = 0;
  let bestPlayer: MatchupRecommendation | null = null;

  for (const playerInput of availablePlayers) {
    // Calculate average win probability against all opponents
    let totalProbability = 0;
    const playerReasons: string[] = [];
    let playerFactors = {
      skillLevelAdvantage: 0,
      winPercentageDelta: 0,
      headToHeadRecord: 0,
      recentFormTrend: 0,
      ppmEfficiency: 0,
    };

    for (const opponent of opponents) {
      const h2hKey = `${playerInput.player.id}-${opponent.player.id}`;
      const headToHead = headToHeadData.get(h2hKey);
      
      const result = calculateWinProbability(
        playerInput.player,
        playerInput.stats,
        opponent.player,
        opponent.stats,
        headToHead,
        playerInput.recentStats,
        opponent.recentStats
      );
      
      totalProbability += result.probability;
      
      // Accumulate factors
      playerFactors.skillLevelAdvantage += result.factors.skillLevelAdvantage;
      playerFactors.winPercentageDelta += result.factors.winPercentageDelta;
      playerFactors.headToHeadRecord += result.factors.headToHeadRecord;
      playerFactors.recentFormTrend += result.factors.recentFormTrend;
      playerFactors.ppmEfficiency += result.factors.ppmEfficiency;
    }

    const avgProbability = totalProbability / opponents.length;
    
    // Average the factors
    const numOpponents = opponents.length;
    playerFactors = {
      skillLevelAdvantage: playerFactors.skillLevelAdvantage / numOpponents,
      winPercentageDelta: playerFactors.winPercentageDelta / numOpponents,
      headToHeadRecord: playerFactors.headToHeadRecord / numOpponents,
      recentFormTrend: playerFactors.recentFormTrend / numOpponents,
      ppmEfficiency: playerFactors.ppmEfficiency / numOpponents,
    };

    if (avgProbability > bestAvgProbability) {
      bestAvgProbability = avgProbability;
      playerReasons.push(`${playerInput.player.name} has strong matchups across the board`);
      playerReasons.push(`Average ${Math.round(avgProbability * 100)}% win probability vs all opponents`);
      
      bestPlayer = {
        playerId: playerInput.player.id,
        playerName: playerInput.player.name,
        winProbability: Math.round(avgProbability * 100) / 100,
        confidence: 0.7, // Moderate confidence for opener recommendations
        reasoning: playerReasons,
        factors: playerFactors,
      };
    }
  }

  return bestPlayer;
}

/**
 * Analyze the strategic value of throwing first vs deferring
 */
export function analyzeThrowFirstAdvantage(
  ourPlayers: MatchupInput[],
  theirPlayers: OpponentInput[],
  headToHeadData: Map<string, HeadToHead>
): {
  throwFirstScore: number;
  deferScore: number;
  recommendation: 'throw_first' | 'defer';
  reasoning: string[];
} {
  const reasoning: string[] = [];

  // Calculate our best opener
  const ourBestOpener = getBestOpener(ourPlayers, theirPlayers, headToHeadData);
  const ourBestOpenerProb = ourBestOpener?.winProbability ?? 0.5;

  // Calculate their best opener (from our perspective, this is their threat)
  const theirBestOpener = getBestOpener(
    theirPlayers.map(p => ({ player: p.player, stats: p.stats, recentStats: p.recentStats })),
    ourPlayers.map(p => ({ player: p.player, stats: p.stats, recentStats: p.recentStats })),
    headToHeadData
  );
  const theirBestOpenerThreat = 1 - (theirBestOpener?.winProbability ?? 0.5);

  // Score for throwing first:
  // - We get to set the tone with our best opener
  // - We reveal our hand but control game 1
  const throwFirstScore = ourBestOpenerProb * 0.6 + 0.4 * 0.5; // 60% opener quality, 40% neutral

  // Score for deferring:
  // - We get to react to their choice
  // - We can counter-pick optimally
  // - Risk: if they have a dominant opener, we might struggle
  const deferScore = (1 - theirBestOpenerThreat) * 0.4 + 0.55 * 0.6; // 40% avoiding their best, 60% counter-pick advantage

  if (throwFirstScore > deferScore) {
    reasoning.push(`Our opener (${ourBestOpener?.playerName}) has strong matchups`);
    reasoning.push(`Setting the pace early gives us an advantage`);
    if (ourBestOpenerProb > 0.55) {
      reasoning.push(`${ourBestOpener?.playerName} has ${Math.round(ourBestOpenerProb * 100)}% average win probability`);
    }
  } else {
    reasoning.push(`Deferring lets us counter-pick their choice`);
    reasoning.push(`We can optimize each matchup reactively`);
    if (theirBestOpener && theirBestOpener.winProbability > 0.55) {
      reasoning.push(`This avoids letting them exploit their best matchups`);
    }
  }

  return {
    throwFirstScore: Math.round(throwFirstScore * 100) / 100,
    deferScore: Math.round(deferScore * 100) / 100,
    recommendation: throwFirstScore > deferScore ? 'throw_first' : 'defer',
    reasoning,
  };
}

/**
 * Calculate the match win probability given current state
 */
export function calculateMatchWinProbability(
  ourScore: number,
  theirScore: number,
  ourRemainingPlayers: MatchupInput[],
  theirRemainingPlayers: OpponentInput[],
  headToHeadData: Map<string, HeadToHead>
): number {
  const gamesNeededToWin = 3; // First to 3 wins the match
  const ourGamesNeeded = gamesNeededToWin - ourScore;
  const theirGamesNeeded = gamesNeededToWin - theirScore;

  if (ourGamesNeeded <= 0) return 1; // We already won
  if (theirGamesNeeded <= 0) return 0; // They already won

  // Simple approximation: average win probability across remaining matchups
  let totalProb = 0;
  let matchups = 0;

  for (const ourPlayer of ourRemainingPlayers) {
    for (const theirPlayer of theirRemainingPlayers) {
      const h2hKey = `${ourPlayer.player.id}-${theirPlayer.player.id}`;
      const headToHead = headToHeadData.get(h2hKey);
      
      const result = calculateWinProbability(
        ourPlayer.player,
        ourPlayer.stats,
        theirPlayer.player,
        theirPlayer.stats,
        headToHead
      );
      
      totalProb += result.probability;
      matchups++;
    }
  }

  const avgWinProb = matchups > 0 ? totalProb / matchups : 0.5;

  // Use binomial probability to estimate match win chance
  // This is a simplified calculation
  const gamesRemaining = Math.min(ourRemainingPlayers.length, theirRemainingPlayers.length);
  
  // Need to win ourGamesNeeded out of gamesRemaining with probability avgWinProb
  let matchWinProb = 0;
  for (let wins = ourGamesNeeded; wins <= gamesRemaining; wins++) {
    matchWinProb += binomialProbability(gamesRemaining, wins, avgWinProb);
  }

  return Math.max(0.05, Math.min(0.95, matchWinProb));
}

// Helper: binomial probability
function binomialProbability(n: number, k: number, p: number): number {
  const coefficient = factorial(n) / (factorial(k) * factorial(n - k));
  return coefficient * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
