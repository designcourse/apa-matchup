// Seed data and configuration for APA Match-Up App

import { db } from './db';
import type { AppConfig } from './types';

// Your team's configuration
export const MY_TEAM_ID = 12851377; // Internal APA ID
export const MY_TEAM_NUMBER = '84301';
export const MY_TEAM_NAME = 'Pocket Pounders';
export const MY_DIVISION_ID = 416441;
export const MY_LEAGUE_ID = 1301;
export const MY_LEAGUE_SLUG = 'eoh';
export const FORMAT = 'NINE' as const;

// All teams in your division (discovered from schedule)
export const DIVISION_TEAMS = [
  { id: 12851377, number: '84301', name: 'Pocket Pounders', isOurTeam: true },
  { id: 12851462, number: '84302', name: '9 Ball Nightmares', isOurTeam: false },
  { id: 12851501, number: '84303', name: 'Kick Safe', isOurTeam: false },
  { id: 12851460, number: '84304', name: 'Kill Shots', isOurTeam: false },
  { id: 12851461, number: '84305', name: 'Extreme 9', isOurTeam: false },
  { id: 12851459, number: '84306', name: 'Aggressively Average', isOurTeam: false },
  { id: 12851502, number: '84307', name: 'Pickled Bunch', isOurTeam: false },
  { id: 12851378, number: '84308', name: 'Underground Wolves', isOurTeam: false },
];

export async function seedInitialData(): Promise<void> {
  // Check if config already exists
  const existingConfig = await db.config.get('main');
  if (existingConfig) {
    return; // Already seeded
  }

  // Create app config
  const config: AppConfig = {
    id: 'main',
    ourTeamId: MY_TEAM_ID,
    ourTeamNumber: MY_TEAM_NUMBER,
    ourTeamName: MY_TEAM_NAME,
    divisionId: MY_DIVISION_ID,
    leagueId: MY_LEAGUE_ID,
    format: FORMAT,
  };

  await db.config.put(config);

  // Seed teams
  for (const team of DIVISION_TEAMS) {
    await db.teams.put({
      id: team.id,
      number: team.number,
      name: team.name,
      divisionId: MY_DIVISION_ID,
      leagueId: MY_LEAGUE_ID,
      leagueSlug: MY_LEAGUE_SLUG,
      format: FORMAT,
      isOurTeam: team.isOurTeam,
    });
  }

  console.log('Initial data seeded!');
}

export async function getAppConfig(): Promise<AppConfig | undefined> {
  return db.config.get('main');
}

export async function getOurTeam() {
  return db.teams.get(MY_TEAM_ID);
}

export async function getOpponentTeams() {
  return db.teams.where('isOurTeam').equals(0).toArray();
}
