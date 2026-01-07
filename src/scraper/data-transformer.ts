import type { HeadToHead } from '../data/types';

/**
 * Build head-to-head records from game results
 */
export function buildHeadToHeadRecords(
  gameResults: {
    playerId: number;
    opponentId: number;
    won: boolean;
    pointsScored: number;
    pointsNeeded: number;
    playedAt: Date;
  }[]
): HeadToHead[] {
  const h2hMap = new Map<string, HeadToHead>();

  for (const game of gameResults) {
    const key = `${game.playerId}-${game.opponentId}`;
    
    let h2h = h2hMap.get(key);
    if (!h2h) {
      h2h = {
        playerId: game.playerId,
        opponentId: game.opponentId,
        totalGames: 0,
        wins: 0,
        losses: 0,
        avgPointsScored: 0,
        avgPointsNeeded: 0,
        lastPlayed: game.playedAt,
      };
      h2hMap.set(key, h2h);
    }

    h2h.totalGames++;
    if (game.won) {
      h2h.wins++;
    } else {
      h2h.losses++;
    }
    
    // Update running average
    h2h.avgPointsScored = 
      (h2h.avgPointsScored * (h2h.totalGames - 1) + game.pointsScored) / h2h.totalGames;
    h2h.avgPointsNeeded = 
      (h2h.avgPointsNeeded * (h2h.totalGames - 1) + game.pointsNeeded) / h2h.totalGames;
    
    if (game.playedAt > h2h.lastPlayed) {
      h2h.lastPlayed = game.playedAt;
    }
  }

  return Array.from(h2hMap.values());
}

/**
 * Calculate win percentage
 */
export function calcWinPct(won: number, played: number): number {
  if (played === 0) return 0;
  return Math.round((won / played) * 1000) / 10; // One decimal place
}

/**
 * Format skill level for display
 */
export function formatSkillLevel(sl: number, _format: 'NINE' | 'EIGHT' = 'NINE'): string {
  return `SL${sl}`;
}

/**
 * Get points needed for a skill level in 9-ball
 */
export function getPointsNeeded9Ball(skillLevel: number): number {
  const pointsTable: Record<number, number> = {
    1: 14,
    2: 19,
    3: 25,
    4: 31,
    5: 38,
    6: 46,
    7: 55,
    8: 65,
    9: 75,
  };
  return pointsTable[skillLevel] || 31;
}

/**
 * Get points needed for a skill level in 8-ball
 */
export function getPointsNeeded8Ball(skillLevel: number): number {
  const pointsTable: Record<number, number> = {
    2: 2,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    7: 6,
  };
  return pointsTable[skillLevel] || 3;
}
