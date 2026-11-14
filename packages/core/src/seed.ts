import type { Entry } from "./schemas";

/**
 * SYNTHETIC DATA. Every person below is fictional; "Harbour Courier" is a fictional
 * newsroom and its union chapel is invented for the Bandsheet demo. Salaries are
 * gross annual EUR, generated to look plausible, with a visible gender gap in the
 * Reporter, Senior and Editor grades.
 *
 * Hero case: the nine Seniors average exactly EUR 62,400 (sum 561,600). The joiner
 * (Senior, EUR 70,000) makes ten Seniors averaging EUR 63,160 (sum 631,600), so
 * 10 x 63,160 - 9 x 62,400 = 70,000, with no rounding error in either mean.
 */
export const SEED_CHAPEL = "Harbour Courier newsroom chapel (synthetic)";

export type SeedMember = Pick<Entry, "grade" | "gender" | "site" | "gross_annual_eur"> & {
  name: string;
};

export const SEED_MEMBERS: readonly SeedMember[] = [
  { name: "Aoife Brennan", grade: "Junior", gender: "F", site: "City", gross_annual_eur: 29800 },
  { name: "Tomasz Kowalczyk", grade: "Junior", gender: "M", site: "Port", gross_annual_eur: 31200 },
  { name: "Priya Raghunathan", grade: "Junior", gender: "F", site: "City", gross_annual_eur: 30100 },
  { name: "Mateus Oliveira", grade: "Junior", gender: "M", site: "City", gross_annual_eur: 31800 },
  { name: "Saoirse Lynch", grade: "Junior", gender: "F", site: "Port", gross_annual_eur: 29500 },
  { name: "Callum Hendry", grade: "Junior", gender: "M", site: "Port", gross_annual_eur: 32000 },
  { name: "Yasmin Haddad", grade: "Junior", gender: "F", site: "City", gross_annual_eur: 30400 },
  { name: "Eero Virtanen", grade: "Junior", gender: "X", site: "City", gross_annual_eur: 30900 },
  { name: "Leila Benali", grade: "Reporter", gender: "F", site: "City", gross_annual_eur: 41200 },
  { name: "Sven Lindqvist", grade: "Reporter", gender: "M", site: "City", gross_annual_eur: 44800 },
  { name: "Niamh Gallagher", grade: "Reporter", gender: "F", site: "Port", gross_annual_eur: 40600 },
  { name: "Dimitri Papadakis", grade: "Reporter", gender: "M", site: "Port", gross_annual_eur: 45200 },
  { name: "Chiara Moretti", grade: "Reporter", gender: "F", site: "City", gross_annual_eur: 42100 },
  { name: "Oluwaseun Adeyemi", grade: "Reporter", gender: "M", site: "City", gross_annual_eur: 44300 },
  { name: "Katarzyna Zielinska", grade: "Reporter", gender: "F", site: "City", gross_annual_eur: 41800 },
  { name: "Rafael Ortega", grade: "Reporter", gender: "M", site: "Port", gross_annual_eur: 43900 },
  { name: "Hannah Weiss", grade: "Reporter", gender: "F", site: "Port", gross_annual_eur: 40900 },
  { name: "Idris Mahmoud", grade: "Reporter", gender: "M", site: "City", gross_annual_eur: 45600 },
  { name: "Margit Soo", grade: "Reporter", gender: "X", site: "City", gross_annual_eur: 42600 },
  { name: "Ingrid Halvorsen", grade: "Senior", gender: "F", site: "City", gross_annual_eur: 58900 },
  { name: "Declan Murphy", grade: "Senior", gender: "M", site: "City", gross_annual_eur: 66200 },
  { name: "Amara Nwosu", grade: "Senior", gender: "F", site: "City", gross_annual_eur: 59700 },
  { name: "Pavel Novak", grade: "Senior", gender: "M", site: "Port", gross_annual_eur: 65100 },
  { name: "Beatriz Carvalho", grade: "Senior", gender: "F", site: "Port", gross_annual_eur: 58400 },
  { name: "Stefan Brandt", grade: "Senior", gender: "M", site: "City", gross_annual_eur: 67300 },
  { name: "Nadia Rahman", grade: "Senior", gender: "F", site: "City", gross_annual_eur: 60500 },
  { name: "Joaquim Faria", grade: "Senior", gender: "M", site: "City", gross_annual_eur: 64800 },
  { name: "Ottilie Hart", grade: "Senior", gender: "F", site: "Port", gross_annual_eur: 60700 },
  { name: "Gareth Pryce", grade: "Editor", gender: "M", site: "City", gross_annual_eur: 84500 },
  { name: "Fatima Al-Sayed", grade: "Editor", gender: "F", site: "City", gross_annual_eur: 77200 },
  { name: "Lukas Meier", grade: "Editor", gender: "M", site: "City", gross_annual_eur: 86800 },
  { name: "Roisin Delaney", grade: "Editor", gender: "F", site: "Port", gross_annual_eur: 76500 },
  { name: "Kofi Mensah", grade: "Editor", gender: "M", site: "Port", gross_annual_eur: 83900 },
  { name: "Adriana Petrescu", grade: "Chief", gender: "F", site: "City", gross_annual_eur: 104000 },
  { name: "Magnus Eriksen", grade: "Chief", gender: "M", site: "City", gross_annual_eur: 117500 },
  { name: "Helena Dufour", grade: "Chief", gender: "F", site: "City", gross_annual_eur: 106500 },
];

/** The member who joins between release #1 and release #2: Senior, EUR 70,000. */
export const SEED_JOINER: SeedMember = {
  name: "Noor Haddad",
  grade: "Senior",
  gender: "F",
  site: "City",
  gross_annual_eur: 70000,
};

/** Build an entry plaintext for a seed member once its slot id is known. */
export function seedEntry(m: SeedMember, slot: string, submittedAt: number): Entry {
  return {
    slot,
    gross_annual_eur: m.gross_annual_eur,
    grade: m.grade,
    gender: m.gender,
    site: m.site,
    submitted_at: submittedAt,
  };
}
