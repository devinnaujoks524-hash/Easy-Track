import test from "node:test";
import assert from "node:assert/strict";
import * as m from "../dist/model.js";
test("Dezimalzahlen, lokale Tage und Sommerzeitgrenzen", () => {
  assert.equal(m.number("1,5"), 1.5);
  for (const s of ["", "-2", "NaN", "1e3", "1.2.3"])
    assert.ok(Number.isNaN(m.number(s)));
  assert.equal(m.shiftDate("2026-03-29", 1), "2026-03-30");
  assert.equal(m.shiftDate("2026-10-25", -1), "2026-10-24");
  assert.ok(!m.validDate("2026-02-30"));
  assert.ok(m.validDate("2028-02-29"));
  assert.deepEqual(m.weekDays("2026-10-25"), [
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
});
test("Gramm, ml und klar definierte Teilportionen", () => {
  assert.equal(m.nutrients(m.EXAMPLES[0], 50, "g").kcal, 186);
  assert.equal(m.nutrients(m.EXAMPLES[3], 200, "ml").kcal, 94);
  assert.throws(() => m.nutrients(m.EXAMPLES[3], 200, "g"));
  assert.equal(m.nutrients(m.EXAMPLES[0], 1.5, "portion").kcal, 279);
  assert.throws(() => m.nutrients(m.EXAMPLES[0], 0, "g"));
});
test("Einträge und Rezeptanteile halten ihre Nährwerte fest", () => {
  const f = m.clone(m.EXAMPLES[0]);
  const e = m.snapshot(f, 50, "g", "2026-10-20", "Frühstück");
  f.kcal = 10;
  assert.equal(e.food.kcal, 372);
  assert.equal(e.nutrients.kcal, 186);
  const r = {
    id: "recipe",
    name: "Porridge",
    description: "",
    servings: 2,
    ingredients: [
      { food: m.EXAMPLES[0], amount: 100, unit: "g" },
      { food: m.EXAMPLES[3], amount: 200, unit: "ml" },
    ],
  };
  const rf = m.recipeFood(r);
  assert.equal(rf.kcal, 233);
  assert.equal(
    m.snapshot(rf, 0.5, "portion", "2026-10-20", "Frühstück").nutrients.kcal,
    116.5,
  );
});
test("Zeitabhängige Ziele, Wochenstatistik ohne leere Tage", () => {
  const goals = [
    { date: "2026-10-01", kcal: 2000 },
    { date: "2026-10-21", kcal: 1800 },
  ];
  assert.equal(m.goalAt(goals, "2026-10-20").kcal, 2000);
  assert.equal(m.goalAt(goals, "2026-10-21").kcal, 1800);
  assert.equal(m.goalAt(goals, "2026-09-30"), null);
  const w = m.weekStats(
    [m.snapshot(m.EXAMPLES[0], 100, "g", "2026-10-20", "Frühstück")],
    "2026-10-20",
  );
  assert.equal(w.average, 372);
  assert.equal(w.count, 1);
  assert.equal(w.days[0].count, 0);
});
test("Export-Rundlauf und strenge Prüfung aller Datenbereiche", () => {
  const d = m.initial();
  d.entries.push(m.snapshot(m.EXAMPLES[0], 33.3, "g", "2026-10-20", "Snacks"));
  assert.deepEqual(m.validateData(JSON.parse(JSON.stringify(d))), d);
  const invalid = [
    null,
    {},
    { ...d, version: 2 },
    { ...d, theme: "bad" },
    { ...d, foods: [{}] },
    {
      ...d,
      recipes: [{ id: "r", name: "leer", servings: 0, ingredients: [] }],
    },
    { ...d, goals: [{ date: "2026-02-30", kcal: 2000 }] },
    { ...d, entries: [{ ...d.entries[0], amount: -1 }] },
    {
      ...d,
      entries: [
        {
          ...d.entries[0],
          nutrients: { kcal: 1, protein: 0, carbs: 0, fat: 0 },
        },
      ],
    },
    { ...d, entries: [d.entries[0], d.entries[0]] },
  ];
  for (const bad of invalid) assert.throws(() => m.validateData(bad));
  assert.equal(d.entries.length, 1);
});
