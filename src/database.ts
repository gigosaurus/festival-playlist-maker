import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

// Each migration runs once, in order. The SQLite user_version pragma records
// how many migrations the database file has. Do not change a migration after
// it is released. Add a new migration to the end of the list.
const migrations: readonly string[] = [
  `CREATE TABLE festival (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    UNIQUE (name, year)
  ) STRICT`,
];

export function openDatabase(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  migrate(database);
  return database;
}

function migrate(database: Database): void {
  const { user_version: version } = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version > migrations.length) {
    throw new Error(
      `The database schema version is ${version}, but this application knows only ${migrations.length} migrations. Use a newer application version.`,
    );
  }
  for (let index = version; index < migrations.length; index++) {
    database.exec("BEGIN");
    try {
      database.exec(migrations[index]!);
      database.exec(`PRAGMA user_version = ${index + 1}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function schemaVersion(database: Database): number {
  const row = database.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}
