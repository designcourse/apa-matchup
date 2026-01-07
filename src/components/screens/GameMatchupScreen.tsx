import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../../store/team-store';
import { useMatchStore, type ChatMessage } from '../../store/match-store';
import { getAIRecommendation, chatWithAI, type AIRecommendation } from '../../services/gemini';
import { PlayerCard } from '../ui/PlayerCard';
import { ScoreBadge } from '../ui/StatBadge';
import type { Player } from '../../data/types';

// Updated phases to handle both scenarios
type GamePhase = 
  | 'select_their_player'      // When they throw first - select who they threw
  | 'select_their_counter'     // When we throw first - select who they counter-picked after our throw
  | 'ai_thinking' 
  | 'ai_recommendation' 
  | 'select_our_player' 
  | 'record_result';

export function GameMatchupScreen() {
  const navigate = useNavigate();
  const { ourTeamId, getPlayersByTeam, headToHead } = useTeamStore();
  const { 
    liveMatch, 
    chatHistory,
    recordTheirPlayer,
    recordOurPlayer,
    recordGameResult,
    nextGame,
    getMatchProgress,
    addChatMessage,
  } = useMatchStore();

  const [phase, setPhase] = useState<GamePhase>('select_their_player');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset phase when game changes
  const initializePhase = () => {
    // Determine who throws first THIS game
    const weThrowFirst = liveMatch?.weThrowFirst 
      ? (liveMatch.currentGame % 2 === 1)
      : (liveMatch?.currentGame ?? 1) % 2 === 0;

    if (weThrowFirst) {
      // We throw first - show AI recommendations without knowing opponent
      setPhase('ai_thinking');
      generateBlindRecommendation();
    } else {
      // They throw first - wait for their pick
      setPhase('select_their_player');
    }
  };

  useEffect(() => {
    if (!liveMatch) {
      navigate('/match/opponent');
      return;
    }
    initializePhase();
  }, [liveMatch?.currentGame]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  if (!liveMatch) return null;

  const { ourWins, theirWins } = getMatchProgress();

  // Determine who throws first THIS game
  // If we threw first in game 1 (weThrowFirst=true), then:
  //   - Odd games (1, 3, 5): We throw first
  //   - Even games (2, 4): They throw first
  // If they threw first in game 1 (weThrowFirst=false), it's reversed
  const weThrowFirstThisGame = liveMatch.weThrowFirst 
    ? (liveMatch.currentGame % 2 === 1)  // Odd games: we throw first
    : (liveMatch.currentGame % 2 === 0); // Even games: we throw first

  // Get available players
  const ourPlayers = getPlayersByTeam(ourTeamId)
    .filter(p => liveMatch.ourPlayersPresent.includes(p.id));
  const theirPlayers = getPlayersByTeam(liveMatch.opponentTeamId)
    .filter(p => liveMatch.theirPlayersPresent.includes(p.id));

  const ourUsedIds = new Set(liveMatch.games.filter(g => g.ourPlayerId).map(g => g.ourPlayerId));
  const theirUsedIds = new Set(liveMatch.games.filter(g => g.theirPlayerId).map(g => g.theirPlayerId));
  
  const availableOurPlayers = ourPlayers.filter(p => !ourUsedIds.has(p.id));
  const availableTheirPlayers = theirPlayers.filter(p => !theirUsedIds.has(p.id));

  const generateBlindRecommendation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const recommendation = await getAIRecommendation(
        availableOurPlayers,
        availableTheirPlayers,
        liveMatch,
        headToHead
      );
      setAiRecommendation(recommendation);
      setPhase('ai_recommendation');
    } catch (err) {
      console.error('AI recommendation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI recommendation');
      // Fallback to manual selection
      setPhase('select_our_player');
    } finally {
      setIsLoading(false);
    }
  };

  const generateCounterRecommendation = async (opponent: Player) => {
    setIsLoading(true);
    setError(null);
    try {
      const recommendation = await getAIRecommendation(
        availableOurPlayers,
        availableTheirPlayers,
        liveMatch,
        headToHead,
        opponent
      );
      setAiRecommendation(recommendation);
      setPhase('ai_recommendation');
    } catch (err) {
      console.error('AI recommendation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI recommendation');
      // Fallback to manual selection
      setPhase('select_our_player');
    } finally {
      setIsLoading(false);
    }
  };

  // When they throw first - select who they threw
  const handleSelectOpponent = (player: Player) => {
    setSelectedOpponent(player);
    recordTheirPlayer(liveMatch.currentGame, player.id);
    setPhase('ai_thinking');
    generateCounterRecommendation(player);
  };

  // When we throw first - select who they counter-picked AFTER we threw
  const handleSelectOpponentCounter = (player: Player) => {
    setSelectedOpponent(player);
    recordTheirPlayer(liveMatch.currentGame, player.id);
    setPhase('record_result');
  };

  const handleSelectOurPlayer = (playerId: number) => {
    setSelectedPlayer(playerId);
    recordOurPlayer(liveMatch.currentGame, playerId);
    
    // If we threw first this game, now we need to know who they counter-picked
    if (weThrowFirstThisGame) {
      setPhase('select_their_counter');
    } else {
      // They threw first, we counter-picked, now record result
      setPhase('record_result');
    }
  };

  const handleAcceptRecommendation = () => {
    if (aiRecommendation) {
      handleSelectOurPlayer(aiRecommendation.recommendedPlayerId);
    }
  };

  const handleShowAllPlayers = () => {
    setPhase('select_our_player');
  };

  const handleRecordResult = (won: boolean) => {
    recordGameResult(liveMatch.currentGame, won);
    
    const newOurWins = won ? ourWins + 1 : ourWins;
    const newTheirWins = won ? theirWins : theirWins + 1;
    
    if (newOurWins >= 3 || newTheirWins >= 3) {
      navigate('/match/summary');
      return;
    }

    // Reset state for next game
    setSelectedOpponent(null);
    setSelectedPlayer(null);
    setAiRecommendation(null);
    
    // Move to next game - useEffect will handle setting the correct phase
    nextGame();
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    addChatMessage(userMessage);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await chatWithAI(
        userMessage.content,
        chatHistory,
        ourPlayers,
        theirPlayers,
        liveMatch,
        headToHead
      );
      
      addChatMessage({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-32">
      {/* Header with Score */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white"
          >
            ← Exit
          </button>
          <ScoreBadge ourScore={liveMatch.ourScore} theirScore={liveMatch.theirScore} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">Game {liveMatch.currentGame}</h1>
          <p className="text-slate-400 text-sm">vs {liveMatch.opponentTeamName}</p>
          <p className={`text-xs mt-1 ${weThrowFirstThisGame ? 'text-blue-400' : 'text-orange-400'}`}>
            {weThrowFirstThisGame ? '🎯 Our throw' : '🛡️ Their throw'}
          </p>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Phase: Select Their Player (when they throw first) */}
      {phase === 'select_their_player' && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-semibold text-white mb-4">Who did they throw?</h2>
          <p className="text-slate-400 text-sm mb-4">They're picking first this game</p>
          <div className="space-y-2">
            {availableTheirPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={() => handleSelectOpponent(player)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Phase: Select Their Counter (when we threw first, now they counter-pick) */}
      {phase === 'select_their_counter' && (
        <div className="animate-fade-in">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-4">
            <p className="text-blue-400 text-sm">
              We threw: <span className="font-semibold text-white">{ourPlayers.find(p => p.id === selectedPlayer)?.name}</span>
            </p>
          </div>
          <h2 className="text-lg font-semibold text-white mb-4">Who did they counter with?</h2>
          <p className="text-slate-400 text-sm mb-4">Select the opponent they chose to play against your player</p>
          <div className="space-y-2">
            {availableTheirPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={() => handleSelectOpponentCounter(player)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Phase: AI Thinking */}
      {phase === 'ai_thinking' && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl">🤖</span>
            </div>
          </div>
          <p className="text-white font-medium mt-6">AI is analyzing matchups...</p>
          <p className="text-slate-400 text-sm mt-2">Powered by Gemini</p>
        </div>
      )}

      {/* Phase: AI Recommendation */}
      {phase === 'ai_recommendation' && aiRecommendation && (
        <div className="animate-fade-in space-y-4">
          {selectedOpponent && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-sm mb-1">They threw:</p>
              <p className="text-white font-semibold">{selectedOpponent.name} (SL{selectedOpponent.skillLevel})</p>
            </div>
          )}

          {!selectedOpponent && liveMatch.weThrowFirst && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-400 text-sm">💡 We're throwing first - pick strategically!</p>
            </div>
          )}

          {/* AI Recommendation Card */}
          <div className="rounded-xl bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 border border-purple-500/30 overflow-hidden">
            <div className="p-4 border-b border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🤖</span>
                <span className="text-purple-400 font-medium">AI Recommendation</span>
                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                  aiRecommendation.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                  aiRecommendation.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {aiRecommendation.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>
            </div>

            <div className="p-4">
              {/* Recommended Player Card */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${
                  getSkillLevelColor(availableOurPlayers.find(p => p.id === aiRecommendation.recommendedPlayerId)?.skillLevel || 5)
                }`}>
                  {availableOurPlayers.find(p => p.id === aiRecommendation.recommendedPlayerId)?.skillLevel || '?'}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white">{aiRecommendation.recommendedPlayerName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-2xl font-bold ${
                      aiRecommendation.winProbability >= 0.6 ? 'text-green-400' :
                      aiRecommendation.winProbability >= 0.45 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(aiRecommendation.winProbability * 100)}%
                    </span>
                    <span className="text-slate-400 text-sm">win probability</span>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="space-y-2 mb-4">
                {aiRecommendation.reasoning.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <p className="text-slate-300 text-sm">{reason}</p>
                  </div>
                ))}
              </div>

              {/* Strategic Notes */}
              {aiRecommendation.strategicNotes && (
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-600">
                  <p className="text-slate-400 text-xs mb-1">💡 Strategic Note</p>
                  <p className="text-slate-300 text-sm">{aiRecommendation.strategicNotes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-purple-500/20 space-y-2">
              <button
                onClick={handleAcceptRecommendation}
                className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold hover:from-purple-400 hover:to-blue-400 transition-all"
              >
                Play {aiRecommendation.recommendedPlayerName}
              </button>
              <button
                onClick={handleShowAllPlayers}
                className="w-full py-2 px-4 rounded-lg bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors text-sm"
              >
                Choose Different Player
              </button>
            </div>
          </div>

          {/* Alternative Picks */}
          {aiRecommendation.alternativePicks.length > 0 && (
            <div className="mt-4">
              <p className="text-slate-400 text-sm mb-2">Other options:</p>
              <div className="space-y-2">
                {aiRecommendation.alternativePicks.map((alt) => (
                  <button
                    key={alt.playerId}
                    onClick={() => handleSelectOurPlayer(alt.playerId)}
                    className="w-full p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-left hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{alt.playerName}</span>
                      <span className="text-slate-400 text-sm">→</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{alt.briefReason}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase: Select Our Player (Manual) */}
      {phase === 'select_our_player' && (
        <div className="animate-fade-in">
          {selectedOpponent && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
              <p className="text-slate-400 text-sm mb-1">Playing against:</p>
              <p className="text-white font-semibold">{selectedOpponent.name} (SL{selectedOpponent.skillLevel})</p>
            </div>
          )}
          <h2 className="text-lg font-semibold text-white mb-4">Select your player</h2>
          <div className="space-y-2">
            {availableOurPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={() => handleSelectOurPlayer(player.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Phase: Record Result */}
      {phase === 'record_result' && (
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Game {liveMatch.currentGame} Result</h2>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Us</p>
                <p className="text-white font-medium">
                  {ourPlayers.find(p => p.id === selectedPlayer)?.name}
                </p>
              </div>
              <span className="text-slate-500 text-2xl">vs</span>
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Them</p>
                <p className="text-white font-medium">{selectedOpponent?.name || 'Unknown'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleRecordResult(true)}
              className="p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 hover:border-green-400 transition-all"
            >
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-white font-semibold text-lg">We Won</div>
            </button>

            <button
              onClick={() => handleRecordResult(false)}
              className="p-6 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border-2 border-red-500/50 hover:border-red-400 transition-all"
            >
              <div className="text-4xl mb-2">😔</div>
              <div className="text-white font-semibold text-lg">They Won</div>
            </button>
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50"
      >
        <span className="text-2xl">{showChat ? '✕' : '💬'}</span>
      </button>

      {/* Chat Panel */}
      {showChat && (
        <div className="fixed inset-x-0 bottom-0 h-[60vh] bg-slate-800 border-t border-slate-700 rounded-t-2xl shadow-2xl z-40 flex flex-col animate-slide-up">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">AI Match Strategist</h3>
              <p className="text-slate-400 text-xs">Ask questions about matchups, strategy, etc.</p>
            </div>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-500">Ask me anything about the match!</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['Who should I save for later?', 'What are our best matchups?', 'Should I be aggressive or defensive?'].map(q => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      className="px-3 py-1.5 rounded-full bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-slate-700 text-slate-200 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about strategy..."
                className="flex-1 px-4 py-2 rounded-full bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 py-2 rounded-full bg-purple-500 text-white font-medium hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Progress Indicator */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map(game => {
            const gameData = liveMatch.games.find(g => g.gameNumber === game);
            let bgColor = 'bg-slate-700';
            if (gameData?.result === 'win') bgColor = 'bg-green-500';
            if (gameData?.result === 'loss') bgColor = 'bg-red-500';
            if (game === liveMatch.currentGame) bgColor += ' ring-2 ring-white';
            
            return (
              <div 
                key={game}
                className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white font-medium`}
              >
                {game}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getSkillLevelColor(sl: number): string {
  if (sl <= 3) return 'bg-green-500';
  if (sl <= 5) return 'bg-yellow-500';
  if (sl <= 7) return 'bg-orange-500';
  return 'bg-red-500';
}
