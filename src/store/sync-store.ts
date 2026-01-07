import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, updateSyncStatus, getSyncStatus } from '../data/db';
import { apaClient, type GQLTeam, type GQLPlayer, type GQLMatch } from '../scraper/apa-client';
import { MY_TEAM_ID, MY_DIVISION_ID, FORMAT, seedInitialData } from '../data/seed';
import type { SyncStatus, Team, Player, Match } from '../data/types';

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
    aliasId: gqlPlayer.alias?.id || 0, // Alias ID for lifetime stats
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
          
          // Step 5: Get member aliases to find alias IDs for lifetime stats
          set({ syncProgress: 90, syncMessage: 'Fetching member aliases...' });
          
          const allPlayers = await db.players.toArray();
          const uniqueMemberIds = [...new Set(allPlayers.map(p => p.memberId))];
          
          console.log(`Fetching aliases for ${uniqueMemberIds.length} members`);
          
          // Map to store member ID -> alias ID
          const memberToAliasMap = new Map<number, number>();
          
          // Get our team's league ID (reuse ourTeam from earlier)
          const ourTeamForLeague = await db.teams.filter(t => t.isOurTeam).first();
          const leagueId = ourTeamForLeague?.leagueId;
          
          // Fetch member aliases in batches
          for (let i = 0; i < uniqueMemberIds.length; i += 5) {
            const batch = uniqueMemberIds.slice(i, i + 5);
            try {
              const memberAliasesArray = await apaClient.getMultipleMemberAliases(batch);
              
              for (const result of memberAliasesArray) {
                if (!result?.member?.aliases) continue;
                
                const memberId = result.member.id;
                // Find alias for our league
                const alias = result.member.aliases.find(a => a.league?.id === leagueId);
                if (alias) {
                  memberToAliasMap.set(memberId, alias.id);
                }
              }
              
              const progress = 90 + Math.round(((i + batch.length) / uniqueMemberIds.length) * 3);
              set({ 
                syncProgress: progress, 
                syncMessage: `Member aliases: ${i + batch.length}/${uniqueMemberIds.length}` 
              });
            } catch (err) {
              console.warn('Failed to fetch member aliases for batch:', batch, err);
            }
          }
          
          console.log(`Found ${memberToAliasMap.size} aliases for lifetime stats`);
          
          // Update players with alias IDs
          for (const player of allPlayers) {
            const aliasId = memberToAliasMap.get(player.memberId);
            if (aliasId) {
              await db.players.update(player.id, { aliasId });
            }
          }
          
          // Step 6: Fetch lifetime stats via backend proxy (bypasses CORS)
          set({ syncProgress: 94, syncMessage: 'Fetching lifetime stats via proxy...' });
          
          const aliasIds = [...new Set(memberToAliasMap.values())];
          
          console.log(`Fetching lifetime stats for ${aliasIds.length} aliases via backend proxy`);
          
          // Fetch in batches of 10 (proxy handles the batching)
          for (let i = 0; i < aliasIds.length; i += 10) {
            const batch = aliasIds.slice(i, i + 10);
            try {
              const aliasStatsArray = await apaClient.getMultipleAliasLifetimeStats(batch);
              
              for (const response of aliasStatsArray) {
                // Proxy returns { data: { alias: ... } } format
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const alias = (response as any)?.data?.alias || (response as any)?.alias;
                if (!alias) {
                  console.log('No alias data in response');
                  continue;
                }
                
                const aliasId = alias.id;
                // Get NineBall or EightBall stats based on format
                const lifetimeStats = FORMAT === 'NINE' 
                  ? alias.NineBallStats?.[0]
                  : alias.EightBallStats?.[0];
                
                if (!lifetimeStats) {
                  console.log(`No ${FORMAT} lifetime stats for alias ${aliasId}`);
                  continue;
                }
                
                console.log(`✅ Got lifetime stats for alias ${aliasId} (${alias.displayName}): ${lifetimeStats.matchesWon}W/${lifetimeStats.matchesPlayed}P`);
                
                // Calculate win percentage
                const lifetimeWinPct = lifetimeStats.matchesPlayed > 0
                  ? (lifetimeStats.matchesWon / lifetimeStats.matchesPlayed) * 100
                  : 0;
                
                // Find all players with this alias ID and update them
                for (const [memberId, aId] of memberToAliasMap.entries()) {
                  if (aId === aliasId) {
                    const playersToUpdate = allPlayers.filter(p => p.memberId === memberId);
                    for (const player of playersToUpdate) {
                      await db.players.update(player.id, {
                        lifetimeMatchesPlayed: lifetimeStats.matchesPlayed,
                        lifetimeMatchesWon: lifetimeStats.matchesWon,
                        lifetimeWinPct: lifetimeWinPct,
                        lifetimeDefensiveAvg: lifetimeStats.defensiveShotAvg,
                      });
                      console.log(`Updated player ${player.name} with lifetime stats`);
                    }
                  }
                }
              }
              
              const progress = 94 + Math.round(((i + batch.length) / aliasIds.length) * 4);
              set({ 
                syncProgress: progress, 
                syncMessage: `Lifetime stats: ${i + batch.length}/${aliasIds.length} aliases` 
              });
            } catch (err) {
              console.warn('Failed to fetch lifetime stats for alias batch:', batch, err);
              // Continue with sync even if lifetime stats fail
            }
          }
          
          console.log(`Finished fetching lifetime stats for ${aliasIds.length} aliases`);
          
          // Step 6: Update sync status
          set({ syncProgress: 98, syncMessage: 'Finalizing...' });
          
          const teamsCount = await db.teams.count();
          const playersCount = await db.players.count();
          const matchesCount = await db.matches.count();
          
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
            syncMessage: `Sync complete! ${teamsCount} teams, ${playersCount} players, ${matchesCount} matches`,
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
