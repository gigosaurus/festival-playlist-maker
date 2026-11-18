import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { listPublishedFestivals } from "../../src/festivals.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

test("listPublishedFestivals is empty when no festival is published", (t) => {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  database
    .prepare("INSERT INTO festival (name, year, start_date, end_date, published) VALUES (?, ?, ?, ?, 0)")
    .run("Bloodstock", 2027, "2027-08-05", "2027-08-08");

  assert.deepEqual(listPublishedFestivals(database), []);
});

test("listPublishedFestivals gives only published festivals, in date order", (t) => {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const insert = database.prepare(
    "INSERT INTO festival (name, year, start_date, end_date, published) VALUES (?, ?, ?, ?, ?)",
  );
  insert.run("Download", 2027, "2027-06-11", "2027-06-13", 1);
  insert.run("Bloodstock", 2027, "2027-08-05", "2027-08-08", 0);
  insert.run("Slam Dunk", 2027, "2027-05-22", "2027-05-23", 1);

  assert.deepEqual(
    listPublishedFestivals(database).map((festival) => festival.name),
    ["Slam Dunk", "Download"],
  );
});
