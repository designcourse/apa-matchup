import type { 
  Player, 
  PlayerStats, 
  HeadToHead, 
  CoinTossDecision, 
  MatchupRecommendation,
  LiveMatch 
} from '../data/types';
import { 
  getMatchupRecommendations, 
  getBestOpener, 
  analyzeThrowFirstAdvantage,
  type MatchupInput,
  type OpponentInput
} from './matchup-calculator';

/**
 * Get the coin toss decision recommendation
 */
export function getCoinTossRecommendation(
  ourPlayers: MatchupInput[],
  theirPlayers: OpponentInput[],
  headToHeadData: Map<string, HeadToHead>
): CoinTossDecision {
  const analysis = analyzeThrowFirstAdvantage(ourPlayers, theirPlayers, headToHeadData);
  
  let suggestedFirstPlayer: number | undefined;
  if (analysis.recommendation === 'throw_first') {
    const bestOpener = getBestOpener(ourPlayers, theirPlayers, headToHeadData);
    suggestedFirstPlayer = bestOpener?.playerId;
  }

  // Calculate confidence based on score difference
  const scoreDiff = Math.abs(analysis.throwFirstScore - analysis.deferScore);
  const confidence = Math.min(0.5 + scoreDiff * 2, 0.95);

  return {
    recommendation: analysis.recommendation,
    confidence: Math.round(confidence * 100) / 100,
    reasoning: analysis.reasoning,
    suggestedFirstPlayer,
  };
}

/**
 * Get recommendation for who to throw when it's our turn
 */
export function getThrowRecommendation(
  availablePlayers: MatchupInput[],
  opponentPlayers: OpponentInput[],
  headToHeadData: Map<string, HeadToHead>,
  liveMatch: LiveMatch,
  theirCurrentPlayer?: OpponentInput
): MatchupRecommendation[] {
  // If we know who they threw, recommend counter-pick
  if (theirCurrentPlayer) {
    return getMatchupRecommendations(
      availablePlayers,
      theirCurrentPlayer,
      headToHeadData,
      liveMatch.currentGame,
      liveMatch.ourScore,
      liveMatch.theirScore
    );
  }

  // If we're throwing first (blind), use opener logic
  const recommendations: MatchupRecommendation[] = [];
  
  for (const playerInput of availablePlayers) {
    // Calculate average performance against all possible opponents
    let totalProb = 0;
    const allReasons: string[] = [];
    
    for (const opponent of opponentPlayers) {
      const matchups = getMatchupRecommendations(
        [playerInput],
        opponent,
        headToHeadData,
        liveMatch.currentGame,
        liveMatch.ourScore,
        liveMatch.theirScore
      );
      
      if (matchups.length > 0) {
        totalProb += matchups[0].winProbability;
      }
    }
    
    const avgProb = totalProb / opponentPlayers.length;
    
    allReasons.push(`${playerInput.player.name} averages ${Math.round(avgProb * 100)}% win probability`);
    allReasons.push(`Strong across multiple opponent matchups`);
    
    recommendations.push({
      playerId: playerInput.player.id,
      playerName: playerInput.player.name,
      winProbability: Math.round(avgProb * 100) / 100,
      confidence: 0.65,
      reasoning: allReasons,
      factors: {
        skillLevelAdvantage: 0.5,
        winPercentageDelta: 0.5,
        headToHeadRecord: 0.5,
        recentFormTrend: 0.5,
        ppmEfficiency: 0.5,
      },
    });
  }

  return recommendations.sort((a, b) => b.winProbability - a.winProbability);
}

/**
 * Filter players based on presence at the match
 */
export function filterPresentPlayers(
  allPlayers: Player[],
  presentPlayerIds: number[]
): Player[] {
  return allPlayers.filter(p => presentPlayerIds.includes(p.id));
}

/**
 * Get players who haven't played yet in this match
 */
export function getAvailablePlayers(
  presentPlayers: Player[],
  liveMatch: LiveMatch
): Player[] {
  const playedPlayerIds = new Set(
    liveMatch.games
      .filter(g => g.ourPlayerId !== null)
      .map(g => g.ourPlayerId!)
  );
  
  return presentPlayers.filter(p => !playedPlayerIds.has(p.id));
}

/**
 * Get opponents who haven't played yet in this match
 */
export function getAvailableOpponents(
  presentOpponents: Player[],
  liveMatch: LiveMatch
): Player[] {
  const playedOpponentIds = new Set(
    liveMatch.games
      .filter(g => g.theirPlayerId !== null)
      .map(g => g.theirPlayerId!)
  );
  
  return presentOpponents.filter(p => !playedOpponentIds.has(p.id));
}

/**
 * Prepare player inputs with stats for the recommendation engine
 */
export function preparePlayerInputs(
  players: Player[],
  statsMap: Map<number, PlayerStats>,
  recentStatsMap?: Map<number, PlayerStats[]>
): MatchupInput[] {
  return players.map(player => ({
    player,
    stats: statsMap.get(player.id),
    recentStats: recentStatsMap?.get(player.id),
  }));
}

export function prepareOpponentInputs(
  players: Player[],
  statsMap: Map<number, PlayerStats>,
  recentStatsMap?: Map<number, PlayerStats[]>
): OpponentInput[] {
  return players.map(player => ({
    player,
    stats: statsMap.get(player.id),
    recentStats: recentStatsMap?.get(player.id),
  }));
}

/**
 * Get strategic advice based on match state
 */
export function getMatchStateAdvice(liveMatch: LiveMatch): string[] {
  const advice: string[] = [];
  const { ourScore, theirScore, currentGame } = liveMatch;
  const gamesRemaining = 5 - currentGame + 1;
  
  if (ourScore === 0 && theirScore === 0) {
    advice.push('First game sets the tone - consider a strong opener');
  } else if (ourScore > theirScore) {
    const lead = ourScore - theirScore;
    if (lead >= 2) {
      advice.push('Comfortable lead - can take calculated risks');
      advice.push('Consider saving your strongest player for a must-win');
    } else {
      advice.push('Slight lead - maintain momentum with reliable matchups');
    }
  } else if (theirScore > ourScore) {
    const deficit = theirScore - ourScore;
    if (deficit >= 2 && gamesRemaining <= deficit) {
      advice.push('Must-win situation - go with highest probability matchup');
      advice.push('No room for strategic saves');
    } else {
      advice.push('Need to make up ground - look for advantageous matchups');
    }
  } else {
    advice.push('Tied match - every game is crucial');
    advice.push('Consider opponent tendencies when making your pick');
  }

  if (currentGame === 5) {
    advice.push('Final game - put your best foot forward');
  }

  return advice;
}
