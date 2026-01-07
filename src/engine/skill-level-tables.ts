// 9-Ball Skill Level Requirements
// Points needed to win at each skill level

export interface SkillLevelInfo {
  level: number;
  pointsNeeded: number;
  expectedPPM: number; // Expected points per match for average player at this level
  description: string;
}

// Official APA 9-Ball point requirements
export const NINE_BALL_SKILL_LEVELS: SkillLevelInfo[] = [
  { level: 1, pointsNeeded: 14, expectedPPM: 10, description: 'Beginner' },
  { level: 2, pointsNeeded: 19, expectedPPM: 14, description: 'Novice' },
  { level: 3, pointsNeeded: 25, expectedPPM: 19, description: 'Intermediate' },
  { level: 4, pointsNeeded: 31, expectedPPM: 24, description: 'Advanced Intermediate' },
  { level: 5, pointsNeeded: 38, expectedPPM: 30, description: 'Skilled' },
  { level: 6, pointsNeeded: 46, expectedPPM: 37, description: 'Advanced' },
  { level: 7, pointsNeeded: 55, expectedPPM: 45, description: 'Expert' },
  { level: 8, pointsNeeded: 65, expectedPPM: 54, description: 'Semi-Pro' },
  { level: 9, pointsNeeded: 75, expectedPPM: 63, description: 'Professional' },
];

// Get points needed for a skill level
export function getPointsNeeded(skillLevel: number): number {
  const info = NINE_BALL_SKILL_LEVELS.find(sl => sl.level === skillLevel);
  return info?.pointsNeeded ?? 38; // Default to SL5
}

// Get expected PPM for a skill level
export function getExpectedPPM(skillLevel: number): number {
  const info = NINE_BALL_SKILL_LEVELS.find(sl => sl.level === skillLevel);
  return info?.expectedPPM ?? 30;
}

// Calculate handicap between two players
// Returns the "advantage" for player1 (positive = advantage, negative = disadvantage)
export function calculateHandicap(
  player1SkillLevel: number,
  player2SkillLevel: number
): { player1Needs: number; player2Needs: number; handicapAdvantage: number } {
  const player1Needs = getPointsNeeded(player1SkillLevel);
  const player2Needs = getPointsNeeded(player2SkillLevel);
  
  // Handicap advantage is based on the ratio of points needed
  // A SL3 (needs 25) vs SL7 (needs 55) has a significant advantage
  const handicapAdvantage = (player2Needs - player1Needs) / player2Needs;
  
  return {
    player1Needs,
    player2Needs,
    handicapAdvantage,
  };
}

// Generate the race format string (e.g., "Race to 38-25")
export function getRaceFormat(
  player1SkillLevel: number,
  player2SkillLevel: number
): string {
  const p1Needs = getPointsNeeded(player1SkillLevel);
  const p2Needs = getPointsNeeded(player2SkillLevel);
  return `Race to ${Math.max(p1Needs, p2Needs)}-${Math.min(p1Needs, p2Needs)}`;
}

// Calculate base win probability based on skill level matchup
// This uses the APA handicap system - theoretically equal skill players
// at different levels should have ~50% win rate against each other
export function getBaseWinProbability(
  playerSkillLevel: number,
  opponentSkillLevel: number
): number {
  const playerNeeds = getPointsNeeded(playerSkillLevel);
  const opponentNeeds = getPointsNeeded(opponentSkillLevel);
  
  // In theory, with perfect handicapping, probability should be ~50%
  // But in practice, higher skill players tend to have a slight edge
  // due to consistency and ability to close out games
  
  // Base probability is 50%
  let baseProbability = 0.5;
  
  // Adjustment for skill level difference (small boost for higher SL)
  // Higher SL players tend to be more consistent under pressure
  const skillDiff = playerSkillLevel - opponentSkillLevel;
  const skillAdjustment = skillDiff * 0.015; // ~1.5% per skill level difference
  
  // Adjustment for point differential (relative race length)
  // When your opponent needs more points, you have more "room for error"
  const pointRatio = opponentNeeds / playerNeeds;
  const pointAdjustment = (pointRatio - 1) * 0.05; // 5% adjustment per 100% point difference
  
  baseProbability += skillAdjustment + pointAdjustment;
  
  // Clamp between 0.2 and 0.8 (no matchup is truly hopeless or guaranteed)
  return Math.max(0.2, Math.min(0.8, baseProbability));
}

// 8-Ball tables (for future use)
export const EIGHT_BALL_SKILL_LEVELS: SkillLevelInfo[] = [
  { level: 2, pointsNeeded: 2, expectedPPM: 1.5, description: 'Beginner' },
  { level: 3, pointsNeeded: 2, expectedPPM: 1.5, description: 'Novice' },
  { level: 4, pointsNeeded: 3, expectedPPM: 2.2, description: 'Intermediate' },
  { level: 5, pointsNeeded: 4, expectedPPM: 3.0, description: 'Advanced Intermediate' },
  { level: 6, pointsNeeded: 5, expectedPPM: 3.8, description: 'Skilled' },
  { level: 7, pointsNeeded: 5, expectedPPM: 3.8, description: 'Advanced' },
];
