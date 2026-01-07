import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, updateSyncStatus, getSyncStatus } from '../data/db';
import { apaClient, type GQLTeam, type GQLPlayer, type GQLMatch, type GQLMatchHistoryItem } from '../scraper/apa-client';
import { MY_TEAM_ID, MY_DIVISION_ID, FORMAT, seedInitialData } from '../data/seed';
import type { SyncStatus, Team, Player, Match, PlayerMatchRecord, HeadToHead } from '../data/types';

interface SyncState {
  // Status
  syncStatus: SyncStatus;
  authToken: string | null;
  isValidToken: boolean;
  
  // Progress
  syncProgress: number;
  syncMessage: string;
  syncError: string | null;
  
  // Last sync timestamps
  lastScheduleSync: Date | null;
  lastRosterSync: Date | null;
  
  // Actions
  loadSyncStatus: () => Promise<void>;
  setAuthToken: (token: string) => Promise<boolean>;
  clearAuthToken: () => void;
  syncAll: (forceRefresh?: boolean) => Promise<void>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
}

// Transform GQL team to our Team type
function transformTeam(gqlTeam: GQLTeam, isOurTeam: boolean): Team {
  return {
    id: gqlTeam.id,
    number: gqlTeam.number,
    name: gqlTeam.name,
    divisionId: gqlTeam.division?.id || MY_DIVISION_ID,
    leagueId: gqlTeam.league?.id,
    leagueSlug: gqlTeam.league?.slug,
    format: gqlTeam.division?.type || FORMAT,
    isOurTeam,
    sessionPoints: gqlTeam.sessionPoints,
    lastSynced: new Date(),
  };
}

// Transform GQL player to our Player type
function transformPlayer(gqlPlayer: GQLPlayer, teamId: number): Player {
  const winPct = gqlPlayer.matchesPlayed > 0 
    ? (gqlPlayer.matchesWon / gqlPlayer.matchesPlayed) * 100 
    : 0;
  
  return {
    id: gqlPlayer.id,
    memberId: gqlPlayer.member.id,
    memberNumber: gqlPlayer.memberNumber,
    name: gqlPlayer.displayName,
    skillLevel: gqlPlayer.skillLevel,
    teamId,
    matchesPlayed: gqlPlayer.matchesPlayed,
    matchesWon: gqlPlayer.matchesWon,
    ppm: gqlPlayer.ppm,
    pa: gqlPlayer.pa,
    winPct,
  };
}

// Transform GQL match history item to our PlayerMatchRecord type
function transformMatchHistory(item: GQLMatchHistoryItem, playerId: number): PlayerMatchRecord {
  return {
    id: item.id,
    playerId,
    datePlayed: new Date(item.datePlayed),
    won: item.won,
    skillLevel: item.skillLevel,
    pointsAwarded: item.pointsAwarded,
    pointsNeeded: item.pointsNeeded,
    opponentId: item.opponent.id,
    opponentName: item.opponent.displayName,
    opponentSkillLevel: item.opponent.skillLevel,
    matchWeek: item.match?.week,
  };
}

// Transform GQL match to our Match type
function transformMatch(gqlMatch: GQLMatch, divisionId: number): Match | null {
  // Skip bye weeks and no-play weeks
  if (!gqlMatch.id || !gqlMatch.home || !gqlMatch.away) {
    return null;
  }
  
  const homePoints = gqlMatch.results?.find(r => r.homeAway === 'HOME')?.points.total;
  const awayPoints = gqlMatch.results?.find(r => r.homeAway === 'AWAY')?.points.total;
  
  return {
    id: gqlMatch.id,
    divisionId,
    week: gqlMatch.week,
    homeTeamId: gqlMatch.home.id,
    homeTeamName: gqlMatch.home.name,
    homeTeamNumber: gqlMatch.home.number,
    awayTeamId: gqlMatch.away.id,
    awayTeamName: gqlMatch.away.name,
    awayTeamNumber: gqlMatch.away.number,
    scheduledDate: new Date(gqlMatch.startTime),
    hostLocationName: gqlMatch.location?.name || '',
    hostLocationId: gqlMatch.location?.id || null,
    isScored: gqlMatch.isScored,
    status: gqlMatch.status,
    homePoints,
    awayPoints,
    description: gqlMatch.description,
  };
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      syncStatus: {
        id: 'main',
        lastSyncTime: null,
        syncInProgress: false,
        lastError: null,
        teamsCount: 0,
        playersCount: 0,
        matchesCount: 0,
      },
      authToken: null,
      isValidToken: false,
      syncProgress: 0,
      syncMessage: '',
      syncError: null,
      lastScheduleSync: null,
      lastRosterSync: null,

      loadSyncStatus: async () => {
        await seedInitialData();
        const status = await getSyncStatus();
        set({ syncStatus: status });
        
        // Restore token to apaClient from persisted state
        const { authToken } = get();
        if (authToken) {
          apaClient.setAuthToken(authToken);
          // Validate the restored token
          const isValid = apaClient.validateAuth();
          if (!isValid) {
            // Token is expired
            set({ isValidToken: false });
          }
        }
      },

      setAuthToken: async (token: string) => {
        apaClient.setAuthToken(token);
        
        const isValid = apaClient.validateAuth();
        const expiryInfo = apaClient.getTokenExpiryInfo();
        
        if (isValid && expiryInfo) {
          set({ 
            authToken: token, 
            isValidToken: true, 
            syncError: null,
            syncMessage: `Token valid for ${expiryInfo.minutesRemaining} minutes`,
          });
          return true;
        } else {
          apaClient.clearAuthToken();
          const errorMsg = expiryInfo && expiryInfo.minutesRemaining <= 0 
            ? `Token expired. Get a fresh one from APA.`
            : 'Invalid token format.';
          set({ 
            authToken: null, 
            isValidToken: false, 
            syncError: errorMsg,
          });
          return false;
        }
      },

      clearAuthToken: () => {
        apaClient.clearAuthToken();
        set({ authToken: null, isValidToken: false });
      },

      testConnection: async () => {
        const { authToken, isValidToken } = get();
        
        if (!authToken || !isValidToken) {
          return { success: false, message: 'No valid token set' };
        }
        
        try {
          const viewer = await apaClient.getViewer();
          return { 
            success: true, 
            message: `Connected as ${viewer.viewer.firstName} ${viewer.viewer.lastName}` 
          };
        } catch (error) {
          return { 
            success: false, 
            message: error instanceof Error ? error.message : 'Connection failed' 
          };
        }
      },

      syncAll: async (forceRefresh = false) => {
        const { authToken, isValidToken, lastRosterSync } = get();
        
        if (!authToken || !isValidToken) {
          set({ syncError: 'No valid token. Please set your APA token first.' });
          return;
        }

        if (apaClient.isTokenExpired(authToken)) {
          set({ 
            syncError: 'Token expired. Please get a fresh token from APA.',
            isValidToken: false,
          });
          return;
        }

        // Check if sync needed (rosters don't change often)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        if (!forceRefresh && lastRosterSync && lastRosterSync > sixHoursAgo) {
          set({ syncMessage: 'Data is up to date', syncProgress: 100 });
          return;
        }
        
        set({ 
          syncProgress: 0, 
          syncMessage: 'Starting sync...', 
          syncError: null 
        });
        
        await updateSyncStatus({ syncInProgress: true });
        
        try {
          // Step 1: Test connection
          set({ syncProgress: 5, syncMessage: 'Testing connection...' });
          const viewer = await apaClient.getViewer();
          console.log('Connected as:', viewer.viewer.firstName, viewer.viewer.lastName);
          
          // Step 2: Get our team's full data (roster + schedule)
          set({ syncProgress: 10, syncMessage: 'Fetching your team data...' });
          const ourTeamData = await apaClient.getTeamFull(MY_TEAM_ID);
          
          if (!ourTeamData.roster) {
            throw new Error('Failed to fetch team roster. Check if team ID is correct.');
          }
          
          // Save our team
          const ourTeam = transformTeam(ourTeamData.roster, true);
          await db.teams.put(ourTeam);
          
          // Save our roster
          const ourPlayers = ourTeamData.roster.roster?.map(p => 
            transformPlayer(p, MY_TEAM_ID)
          ) || [];
          
          if (ourPlayers.length === 0) {
            console.warn('No players found in team roster');
          }
          
          await db.players.bulkPut(ourPlayers);
          
          set({ 
            syncProgress: 20, 
            syncMessage: `Saved ${ourPlayers.length} players from ${ourTeam.name}` 
          });
          
          // Step 3: Extract opponent team IDs from schedule
          const opponentTeamIds = new Set<number>();
          const matches: Match[] = [];
          
          for (const gqlMatch of ourTeamData.schedule.matches || []) {
            const match = transformMatch(gqlMatch, MY_DIVISION_ID);
            if (match) {
              matches.push(match);
              
              // Track opponent teams
              if (gqlMatch.home && gqlMatch.home.id !== MY_TEAM_ID) {
                opponentTeamIds.add(gqlMatch.home.id);
              }
              if (gqlMatch.away && gqlMatch.away.id !== MY_TEAM_ID) {
                opponentTeamIds.add(gqlMatch.away.id);
              }
            }
          }
          
          // Save matches
          await db.matches.bulkPut(matches);
          set({ 
            syncProgress: 30, 
            syncMessage: `Saved ${matches.length} matches. Fetching opponent rosters...` 
          });
          
          // Step 4: Fetch all opponent team rosters in parallel
          const opponentIds = Array.from(opponentTeamIds);
          console.log('Fetching rosters for teams:', opponentIds);
          
          let processed = 0;
          const totalOpponents = opponentIds.length;
          
          // Fetch in batches of 4 to avoid rate limiting
          for (let i = 0; i < opponentIds.length; i += 4) {
            const batch = opponentIds.slice(i, i + 4);
            const teamRosters = await apaClient.getMultipleTeamRosters(batch);
            
            for (const gqlTeam of teamRosters) {
              if (!gqlTeam) continue;
              
              // Save team
              const team = transformTeam(gqlTeam, false);
              await db.teams.put(team);
              
              // Save players
              const players = gqlTeam.roster?.map(p => 
                transformPlayer(p, gqlTeam.id)
              ) || [];
              await db.players.bulkPut(players);
              
              processed++;
              const progress = 30 + Math.round((processed / totalOpponents) * 60);
              set({ 
                syncProgress: progress, 
                syncMessage: `${team.name}: ${players.length} players (${processed}/${totalOpponents})` 
              });
            }
          }
          
          // Step 5: Fetch player match history for all players
          set({ syncProgress: 92, syncMessage: 'Fetching player match histories...' });
          
          const allPlayers = await db.players.toArray();
          const allPlayerIds = allPlayers.map(p => p.id);
          
          // Fetch in batches of 5 to avoid rate limiting
          const allMatchRecords: PlayerMatchRecord[] = [];
          const headToHeadMap = new Map<string, HeadToHead>();
          
          for (let i = 0; i < allPlayerIds.length; i += 5) {
            const batch = allPlayerIds.slice(i, i + 5);
            try {
              const histories = await apaClient.getMultiplePlayerHistories(batch);
              
              for (const history of histories) {
                if (!history?.player?.matchHistory) continue;
                
                const playerId = history.player.id;
                
                // Transform and store match records
                for (const item of history.player.matchHistory) {
                  const record = transformMatchHistory(item, playerId);
                  allMatchRecords.push(record);
                  
                  // Build head-to-head records
                  const h2hKey = `${playerId}-${item.opponent.id}`;
                  const existing = headToHeadMap.get(h2hKey);
                  if (existing) {
                    existing.totalGames++;
                    if (item.won) existing.wins++;
                    else existing.losses++;
                    existing.avgPointsScored = (existing.avgPointsScored * (existing.totalGames - 1) + item.pointsAwarded) / existing.totalGames;
                    existing.avgPointsNeeded = (existing.avgPointsNeeded * (existing.totalGames - 1) + item.pointsNeeded) / existing.totalGames;
                    if (new Date(item.datePlayed) > existing.lastPlayed) {
                      existing.lastPlayed = new Date(item.datePlayed);
                    }
                  } else {
                    headToHeadMap.set(h2hKey, {
                      playerId,
                      opponentId: item.opponent.id,
                      totalGames: 1,
                      wins: item.won ? 1 : 0,
                      losses: item.won ? 0 : 1,
                      avgPointsScored: item.pointsAwarded,
                      avgPointsNeeded: item.pointsNeeded,
                      lastPlayed: new Date(item.datePlayed),
                    });
                  }
                }
                
                // Update player with aggregated history stats
                const playerRecords = history.player.matchHistory;
                if (playerRecords.length > 0) {
                  const historyWins = playerRecords.filter(r => r.won).length;
                  const historyPlayed = playerRecords.length;
                  const historyPpm = playerRecords.reduce((sum, r) => sum + r.pointsAwarded, 0) / historyPlayed;
                  
                  const player = await db.players.get(playerId);
                  if (player) {
                    await db.players.update(playerId, {
                      historyMatchesPlayed: historyPlayed,
                      historyMatchesWon: historyWins,
                      historyWinPct: (historyWins / historyPlayed) * 100,
                      historyPpm: historyPpm,
                    });
                  }
                }
              }
              
              const histProgress = 92 + Math.round(((i + batch.length) / allPlayerIds.length) * 5);
              set({ 
                syncProgress: histProgress, 
                syncMessage: `Player history: ${i + batch.length}/${allPlayerIds.length}` 
              });
            } catch (err) {
              console.warn('Failed to fetch history for batch:', batch, err);
              // Continue with other batches even if one fails
            }
          }
          
          // Save match records and head-to-head data
          if (allMatchRecords.length > 0) {
            await db.playerMatchRecords.bulkPut(allMatchRecords);
          }
          
          const h2hRecords = Array.from(headToHeadMap.values());
          if (h2hRecords.length > 0) {
            await db.headToHead.bulkPut(h2hRecords);
          }
          
          // Step 6: Update sync status
          set({ syncProgress: 98, syncMessage: 'Finalizing...' });
          
          const teamsCount = await db.teams.count();
          const playersCount = await db.players.count();
          const matchesCount = await db.matches.count();
          const matchRecordsCount = await db.playerMatchRecords.count();
          
          await updateSyncStatus({
            syncInProgress: false,
            lastSyncTime: new Date(),
            lastError: null,
            teamsCount,
            playersCount,
            matchesCount,
          });
          
          set({ 
            syncStatus: await getSyncStatus(),
            syncProgress: 100,
            syncMessage: `Sync complete! ${teamsCount} teams, ${playersCount} players, ${matchRecordsCount} match records`,
            lastRosterSync: new Date(),
            lastScheduleSync: new Date(),
          });
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Sync failed';
          console.error('Sync error:', error);
          
          await updateSyncStatus({ 
            syncInProgress: false,
            lastError: errorMsg,
          });
          
          set({ 
            syncError: errorMsg, 
            syncMessage: '',
            syncStatus: await getSyncStatus(),
          });
        }
      },
    }),
    {
      name: 'sync-store',
      partialize: (state) => ({
        authToken: state.authToken,
        isValidToken: state.isValidToken,
        lastScheduleSync: state.lastScheduleSync,
        lastRosterSync: state.lastRosterSync,
      }),
      onRehydrateStorage: () => (state) => {
        // Restore token to apaClient when store is rehydrated from localStorage
        if (state?.authToken) {
          apaClient.setAuthToken(state.authToken);
          // Validate token on rehydration
          const isValid = apaClient.validateAuth();
          if (!isValid) {
            // Token expired - update state
            state.isValidToken = false;
          }
        }
      },
    }
  )
);
