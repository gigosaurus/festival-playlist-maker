import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase, schemaVersion } from "../../src/database.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

test("openDatabase creates the schema in a new database file", (t) => {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());

  assert.ok(schemaVersion(database) > 0);
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all();
  assert.ok(tables.some((table) => table.name === "festival"));
});

test("openDatabase keeps the data when it opens the same file again", (t) => {
  const path = temporaryDatabasePath(t);
  const first = openDatabase(path);
  const version = schemaVersion(first);
  first
    .prepare("INSERT INTO festival (name, year, start_date, end_date) VALUES (?, ?, ?, ?)")
    .run("Download", 2027, "2027-06-11", "2027-06-13");
  first.close();

  const second = openDatabase(path);
  t.after(() => second.close());
  assert.equal(schemaVersion(second), version);
  assert.equal(second.prepare("SELECT name FROM festival").get()?.name, "Download");
});

test("openDatabase migrates a database file that has an earlier schema version", (t) => {
  const path = temporaryDatabasePath(t);
  const current = openDatabase(path);
  const latest = schemaVersion(current);
  current.close();

  // A file with schema version 0 is a file from before the first migration.
  // Without foreign keys, the order of the tables is not important.
  const earlier = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  for (const { name } of earlier.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all()) {
    earlier.exec(`DROP TABLE "${String(name)}"`);
  }
  earlier.exec("PRAGMA user_version = 0");
  earlier.close();

  const migrated = openDatabase(path);
  t.after(() => migrated.close());
  assert.equal(schemaVersion(migrated), latest);
});

test("openDatabase refuses a database file from a newer application version", (t) => {
  const path = temporaryDatabasePath(t);
  const newer = new DatabaseSync(path);
  newer.exec("PRAGMA user_version = 9999");
  newer.close();

  assert.throws(() => openDatabase(path), /schema version is 9999/);
});
