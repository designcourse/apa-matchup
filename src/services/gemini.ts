import { GoogleGenAI } from '@google/genai';
import type { Player, LiveMatch, HeadToHead } from '../data/types';

// Initialize client - API key should be set via environment variable
const getClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
};

// Model to use - Gemini 3 Pro for best quality recommendations
const MODEL_ID = 'gemini-3-pro-preview';

export interface AIRecommendation {
  recommendedPlayerId: number;
  recommendedPlayerName: string;
  winProbability: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string[];
  alternativePicks: Array<{
    playerId: number;
    playerName: string;
    briefReason: string;
  }>;
  strategicNotes: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Build context about the match for AI
 */
function buildMatchContext(
  ourPlayers: Player[],
  theirPlayers: Player[],
  liveMatch: LiveMatch,
  headToHead: Map<string, HeadToHead>,
  opponentThrown?: Player
): string {
  // Build detailed stats for each player including lifetime data
  const buildPlayerStats = (p: Player, opponents: Player[]) => {
    const h2hRecords = opponents.map(opp => {
      const key = `${p.id}-${opp.id}`;
      const h2h = headToHead.get(key);
      if (h2h && h2h.totalGames > 0) {
        return `vs ${opp.name}: ${h2h.wins}-${h2h.losses}`;
      }
      return null;
    }).filter(Boolean);

    // Current session stats
    let stats = `- ${p.name} (SL${p.skillLevel}):\n`;
    stats += `    Current Session: ${p.matchesWon}W-${p.matchesPlayed - p.matchesWon}L (${p.winPct.toFixed(0)}% win), PPM: ${p.ppm.toFixed(1)}, PA: ${(p.pa * 100).toFixed(0)}%\n`;
    
    // Lifetime stats (if available)
    if (p.lifetimeMatchesPlayed && p.lifetimeMatchesPlayed > 0) {
      const lifetimeLosses = p.lifetimeMatchesPlayed - (p.lifetimeMatchesWon || 0);
      stats += `    LIFETIME: ${p.lifetimeMatchesWon || 0}W-${lifetimeLosses}L (${(p.lifetimeWinPct || 0).toFixed(0)}% win), PPM: ${(p.lifetimePpm || 0).toFixed(1)}`;
      if (p.lifetimeDefensiveAvg) stats += `, Def Avg: ${p.lifetimeDefensiveAvg.toFixed(2)}`;
      if (p.lifetimeBreakAndRuns) stats += `, B&R: ${p.lifetimeBreakAndRuns}`;
      if (p.lifetimeNineOnSnap) stats += `, 9-snap: ${p.lifetimeNineOnSnap}`;
      if (p.lifetimeShutouts) stats += `, Shutouts: ${p.lifetimeShutouts}`;
      stats += '\n';
    }
    
    if (h2hRecords.length > 0) {
      stats += `    Head-to-Head: ${h2hRecords.join(', ')}\n`;
    }
    
    return stats;
  };

  const ourTeamStats = ourPlayers.map(p => buildPlayerStats(p, theirPlayers)).join('\n');
  const theirTeamStats = theirPlayers.map(p => buildPlayerStats(p, ourPlayers)).join('\n');

  // Games played so far
  const gamesPlayed = liveMatch.games
    .filter(g => g.result !== 'pending')
    .map(g => {
      const ourPlayer = ourPlayers.find(p => p.id === g.ourPlayerId);
      const theirPlayer = theirPlayers.find(p => p.id === g.theirPlayerId);
      return `Game ${g.gameNumber}: ${ourPlayer?.name || 'Unknown'} vs ${theirPlayer?.name || 'Unknown'} - ${g.result === 'win' ? 'WE WON' : 'THEY WON'}`;
    }).join('\n');

  // Players already used
  const ourUsedIds = new Set(liveMatch.games.filter(g => g.ourPlayerId).map(g => g.ourPlayerId));
  const theirUsedIds = new Set(liveMatch.games.filter(g => g.theirPlayerId).map(g => g.theirPlayerId));
  
  const ourAvailable = ourPlayers.filter(p => !ourUsedIds.has(p.id));
  const theirAvailable = theirPlayers.filter(p => !theirUsedIds.has(p.id));

  // Build available player summaries with lifetime stats
  const buildAvailableSummary = (p: Player) => {
    let summary = `- ${p.name} (SL${p.skillLevel}): Session ${p.winPct.toFixed(0)}% win, PPM ${p.ppm.toFixed(1)}`;
    if (p.lifetimeMatchesPlayed && p.lifetimeMatchesPlayed > 0) {
      summary += ` | LIFETIME ${(p.lifetimeWinPct || 0).toFixed(0)}% win (${p.lifetimeMatchesPlayed} matches)`;
    }
    return summary;
  };

  let context = `
## APA 9-Ball Match Analysis

### Current Match State
- Score: US ${liveMatch.ourScore} - THEM ${liveMatch.theirScore}
- Current Game: ${liveMatch.currentGame} of 5
- Games needed to win: First to 3

### Our Team (Available Players)
${ourAvailable.map(buildAvailableSummary).join('\n')}

### Their Team (Available Players)
${theirAvailable.map(buildAvailableSummary).join('\n')}

### Detailed Player Stats (Current Session + Historical)
**Our Team:**
${ourTeamStats}

**Their Team:**
${theirTeamStats}
`;

  if (gamesPlayed) {
    context += `\n### Games Played Tonight\n${gamesPlayed}\n`;
  }

  if (opponentThrown) {
    context += `\n### OPPONENT HAS THROWN: ${opponentThrown.name} (SL${opponentThrown.skillLevel})
- Their record: ${opponentThrown.matchesWon}W-${opponentThrown.matchesPlayed - opponentThrown.matchesWon}L
- Win rate: ${opponentThrown.winPct.toFixed(0)}%
- PPM: ${opponentThrown.ppm.toFixed(1)}
`;
  }

  context += `
### Data Available
- Current Session: Stats from this APA session only
- LIFETIME: Career stats across ALL sessions the player has ever played
- Head-to-Head: Past matchup records between specific players (when available)

### APA 9-Ball Handicap System
In APA 9-ball, lower skill levels need fewer points to win (SL1 needs 14 points, SL9 needs 75 points).
A lower skill level player has a built-in handicap advantage against higher skill levels.
PPM (Points Per Match) indicates offensive efficiency.
PA (Points Allowed) indicates defensive efficiency - lower is better.
`;

  return context;
}

/**
 * Get AI recommendation for which player to throw
 */
export async function getAIRecommendation(
  ourPlayers: Player[],
  theirPlayers: Player[],
  liveMatch: LiveMatch,
  headToHead: Map<string, HeadToHead>,
  opponentThrown?: Player
): Promise<AIRecommendation> {
  const client = getClient();
  const context = buildMatchContext(ourPlayers, theirPlayers, liveMatch, headToHead, opponentThrown);
  
  const ourUsedIds = new Set(liveMatch.games.filter(g => g.ourPlayerId).map(g => g.ourPlayerId));
  const ourAvailable = ourPlayers.filter(p => !ourUsedIds.has(p.id));

  const prompt = `${context}

Based on the above match data, recommend which of our available players should play ${opponentThrown ? `against ${opponentThrown.name} (SL${opponentThrown.skillLevel})` : 'next'}.

Consider:
1. Skill level matchup and handicap advantages
2. Win percentages and recent form
3. PPM efficiency (points per match)
4. Strategic value - saving strong players for later if needed
5. Current match score and must-win situations

Respond in this exact JSON format (no markdown, just JSON):
{
  "recommendedPlayerId": ${ourAvailable[0]?.id || 0},
  "recommendedPlayerName": "Player Name",
  "winProbability": 0.65,
  "confidence": "high",
  "reasoning": [
    "First reason",
    "Second reason",
    "Third reason"
  ],
  "alternativePicks": [
    {"playerId": 123, "playerName": "Name", "briefReason": "Why this is alternative"}
  ],
  "strategicNotes": "Any additional strategic considerations for this game"
}

Available player IDs: ${JSON.stringify(ourAvailable.map(p => ({ id: p.id, name: p.name })))}`;

  try {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Gemini 3 uses tokens for thinking, need more headroom
      },
    });

    // Get text from response
    const text = response.text?.trim() || '';
    
    // Try to parse JSON from response - handle markdown code blocks
    let jsonStr = text;
    
    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    // Try to find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          recommendedPlayerId: parsed.recommendedPlayerId,
          recommendedPlayerName: parsed.recommendedPlayerName,
          winProbability: Math.max(0, Math.min(1, parsed.winProbability || 0.5)),
          confidence: parsed.confidence || 'medium',
          reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || 'AI recommendation'],
          alternativePicks: parsed.alternativePicks || [],
          strategicNotes: parsed.strategicNotes || '',
        };
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr, 'Text:', jsonMatch[0].substring(0, 200));
      }
    }
    
    console.error('Could not find JSON in response:', text.substring(0, 500));
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('AI recommendation error:', error);
    // Return fallback recommendation
    const fallback = ourAvailable[0];
    return {
      recommendedPlayerId: fallback?.id || 0,
      recommendedPlayerName: fallback?.name || 'Unknown',
      winProbability: 0.5,
      confidence: 'low',
      reasoning: ['AI analysis unavailable - using default selection'],
      alternativePicks: [],
      strategicNotes: 'Unable to get AI recommendation. Consider skill level matchups.',
    };
  }
}

/**
 * Chat with AI about the match
 */
export async function chatWithAI(
  message: string,
  chatHistory: ChatMessage[],
  ourPlayers: Player[],
  theirPlayers: Player[],
  liveMatch: LiveMatch,
  headToHead: Map<string, HeadToHead>
): Promise<string> {
  const client = getClient();
  const context = buildMatchContext(ourPlayers, theirPlayers, liveMatch, headToHead);

  // Build conversation history
  const historyText = chatHistory.map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n\n');

  const prompt = `You are an expert APA pool league strategist helping a team captain make decisions during a match.

${context}

${historyText ? `### Previous Conversation\n${historyText}\n\n` : ''}User: ${message}

Provide helpful, concise advice. Be specific about player names and skill levels. If asked about strategy, consider:
- Current score and games needed
- Available players and their strengths
- Opponent tendencies
- Handicap system advantages

Respond conversationally but stay focused on match strategy.`;

  try {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 4096, // Gemini 3 uses tokens for thinking
      },
    });

    return response.text?.trim() || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Chat error:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

/**
 * Get coin toss recommendation from AI
 */
export async function getAICoinTossRecommendation(
  ourPlayers: Player[],
  theirPlayers: Player[],
  _headToHead: Map<string, HeadToHead>
): Promise<{ recommendation: 'throw_first' | 'defer'; reasoning: string[] }> {
  const client = getClient();

  const buildPlayerLine = (p: Player) => {
    let line = `${p.name} (SL${p.skillLevel}): Session ${p.winPct.toFixed(0)}% win, PPM ${p.ppm.toFixed(1)}`;
    if (p.lifetimeMatchesPlayed && p.lifetimeMatchesPlayed > 0) {
      line += ` | LIFETIME ${(p.lifetimeWinPct || 0).toFixed(0)}% win (${p.lifetimeMatchesPlayed} matches)`;
    }
    return line;
  };

  const ourStats = ourPlayers.map(buildPlayerLine).join('\n');
  const theirStats = theirPlayers.map(buildPlayerLine).join('\n');

  const prompt = `APA 9-Ball Coin Toss Strategy

Our Team:
${ourStats}

Their Team:
${theirStats}

We won the coin toss. Should we throw first or defer?

Consider:
- Throwing first means we pick first but reveal our choice
- Deferring means we can counter-pick their selection
- Team composition and matchup flexibility

Respond in JSON format:
{
  "recommendation": "throw_first" or "defer",
  "reasoning": ["reason1", "reason2", "reason3"]
}`;

  try {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 4096, // Gemini 3 uses tokens for thinking
      },
    });

    const text = response.text?.trim() || '';
    
    // Remove markdown code blocks if present
    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          recommendation: parsed.recommendation === 'throw_first' ? 'throw_first' : 'defer',
          reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [parsed.reasoning || 'Strategic decision'],
        };
      } catch (parseErr) {
        console.error('Coin toss JSON parse error:', parseErr);
      }
    }
    console.error('Could not parse coin toss response:', text.substring(0, 300));
    throw new Error('Could not parse response');
  } catch (error) {
    console.error('Coin toss AI error:', error);
    return {
      recommendation: 'defer',
      reasoning: ['AI unavailable - deferring allows counter-picking'],
    };
  }
}
