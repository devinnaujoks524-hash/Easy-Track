export const VERSION = 1;
export const MEALS = ["Frühstück", "Mittagessen", "Abendessen", "Snacks"];
export const KEYS = ["kcal", "protein", "carbs", "fat"];
export const uid = () => globalThis.crypto.randomUUID();
export const clone = (x) => structuredClone(x);
export const today = () => localDate(new Date());
export function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftDate(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n, 12));
}
export function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return y >= 1900 && y <= 2200 && localDate(new Date(y, m - 1, d, 12)) === s;
}
export function number(s) {
  if (typeof s === "number") return s;
  const v = String(s ?? "").trim();
  return /^\d+(?:[,.]\d+)?$/.test(v) ? Number(v.replace(",", ".")) : NaN;
}
export const zero = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
export const sum = (items) =>
  items.reduce((a, item) => {
    const n = item.nutrients ?? item;
    KEYS.forEach((k) => (a[k] += n[k]));
    return a;
  }, zero());
export function nutrients(food, amount, unit = food.basis) {
  const q = unit === "portion" ? amount * food.portionSize : amount;
  if (unit !== "portion" && unit !== food.basis)
    throw Error("Die Einheit passt nicht zur Nährwertbasis.");
  if (!Number.isFinite(q) || q <= 0)
    throw Error("Bitte gib eine Menge größer als 0 ein.");
  return Object.fromEntries(KEYS.map((k) => [k, (food[k] * q) / 100]));
}
export function snapshot(food, amount, unit, date, meal) {
  return {
    id: uid(),
    foodId: food.id,
    food: clone(food),
    name: food.name,
    amount,
    unit,
    date,
    meal,
    nutrients: nutrients(food, amount, unit),
    createdAt: Date.now(),
  };
}
export function recipeFood(recipe) {
  const n = sum(
    recipe.ingredients.map((i) => nutrients(i.food, i.amount, i.unit)),
  );
  return {
    id: recipe.id,
    name: recipe.name,
    brand: "Eigenes Rezept",
    recipeServings: recipe.servings,
    basis: "g",
    portionSize: 100,
    portionName: "Portion",
    ...Object.fromEntries(KEYS.map((k) => [k, n[k] / recipe.servings])),
    source: "recipe",
  };
}
export function goalAt(goals, date) {
  return (
    [...goals]
      .filter((g) => g.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  );
}
export function weekDays(date) {
  const d = new Date(date + "T12:00:00");
  const monday = shiftDate(date, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}
export function weekStats(entries, date) {
  const days = weekDays(date).map((date) => {
    const list = entries.filter((e) => e.date === date);
    return { date, count: list.length, ...sum(list) };
  });
  const total = days.reduce((a, d) => a + d.kcal, 0),
    count = days.filter((d) => d.count).length;
  return { days, total, count, average: count ? total / count : 0 };
}
const example = (
  id,
  name,
  kcal,
  protein,
  carbs,
  fat,
  basis = "g",
  portionSize = 100,
) => ({
  id,
  name,
  brand: "",
  kcal,
  protein,
  carbs,
  fat,
  basis,
  portionSize,
  portionName: "Portion",
  source: "example",
});
export const EXAMPLES = [
  example("oats", "Haferflocken", 372, 13.5, 58.7, 7, "g", 50),
  example("banana", "Banane", 89, 1.1, 20.2, 0.3, "g", 120),
  example("yogurt", "Naturjoghurt 3,5 %", 64, 3.5, 4.7, 3.5, "g", 150),
  example("milk", "Milch 1,5 %", 47, 3.4, 4.9, 1.5, "ml", 200),
  example("oatmilk", "Haferdrink", 46, 1, 6.7, 1.5, "ml", 200),
  example("rice", "Reis, gekocht", 130, 2.7, 28, 0.3, "g", 150),
  example("chicken", "Hähnchenbrust, gegart", 165, 31, 0, 3.6, "g", 150),
  example("tofu", "Naturtofu", 144, 15.7, 2.8, 8.7, "g", 150),
  example("apple", "Apfel", 52, 0.3, 11.4, 0.2, "g", 150),
  example("bread", "Vollkornbrot", 214, 8.5, 38, 2, "g", 50),
  example("egg", "Ei, gekocht", 155, 13, 1.1, 11, "g", 60),
  example("oil", "Olivenöl", 884, 0, 0, 100, "g", 10),
  example("broccoli", "Brokkoli, gegart", 35, 2.4, 4, 0.4, "g", 150),
  example("salmon", "Lachs, gegart", 208, 20, 0, 13, "g", 150),
  example("lentils", "Linsen, gekocht", 116, 9, 20, 0.4, "g", 150),
  example("almonds", "Mandeln", 579, 21, 7, 50, "g", 30),
];
export const initial = () => ({
  version: VERSION,
  foods: [],
  entries: [],
  recipes: [],
  favorites: [],
  goals: [],
  theme: "light",
});
const finite = (v, min = 0, max = 1e9) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const str = (s, max = 200) =>
  typeof s === "string" && s.length > 0 && s.length <= max;
const idOK = (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(s);
function foodOK(f) {
  return (
    f &&
    idOK(f.id) &&
    str(f.name) &&
    typeof f.brand === "string" &&
    f.brand.length <= 200 &&
    ["g", "ml"].includes(f.basis) &&
    KEYS.every((k) => finite(f[k], 0, f.source === "recipe" ? 1e20 : 1e6)) &&
    ["example", "custom", "recipe"].includes(f.source) &&
    (f.portionSize === null || finite(f.portionSize, 0.000001, 1e6)) &&
    typeof f.portionName === "string" &&
    f.portionName.length <= 100
  );
}
function ingredientOK(i) {
  return (
    i &&
    foodOK(i.food) &&
    finite(i.amount, 0.000001, 1e6) &&
    [i.food.basis, ...(i.food.portionSize ? ["portion"] : [])].includes(i.unit)
  );
}
export function validateData(d) {
  const fail = () => {
    throw Error(
      "Die Datei ist kein gültiger Easy-Track-Export (Version 1). Deine bisherigen Daten bleiben erhalten.",
    );
  };
  if (!d || d.version !== VERSION || !["light", "dark"].includes(d.theme))
    fail();
  for (const k of ["foods", "entries", "recipes", "favorites", "goals"])
    if (!Array.isArray(d[k]) || d[k].length > 100000) fail();
  if (
    !d.foods.every((f) => foodOK(f) && f.source === "custom") ||
    !d.favorites.every(idOK) ||
    !d.goals.every(
      (g) =>
        g &&
        validDate(g.date) &&
        finite(g.kcal, 0.000001, 1e6) &&
        ["protein", "carbs", "fat"].every(
          (k) => g[k] === null || finite(g[k], 0, 1e6),
        ),
    )
  )
    fail();
  if (
    !d.entries.every(
      (e) =>
        ingredientOK(e) &&
        idOK(e.id) &&
        str(e.name) &&
        idOK(e.foodId) &&
        validDate(e.date) &&
        MEALS.includes(e.meal) &&
        finite(e.createdAt, 0, 8640000000000000) &&
        e.nutrients &&
        KEYS.every(
          (k) =>
            finite(e.nutrients[k], 0, 1e30) &&
            Math.abs(e.nutrients[k] - nutrients(e.food, e.amount, e.unit)[k]) <
              0.00001,
        ),
    )
  )
    fail();
  if (
    !d.recipes.every(
      (r) =>
        r &&
        idOK(r.id) &&
        str(r.name) &&
        typeof r.description === "string" &&
        r.description.length <= 3000 &&
        finite(r.servings, 0.000001, 1e6) &&
        Array.isArray(r.ingredients) &&
        r.ingredients.length > 0 &&
        r.ingredients.length <= 1000 &&
        r.ingredients.every(ingredientOK),
    )
  )
    fail();
  for (const k of ["foods", "entries", "recipes"])
    if (new Set(d[k].map((x) => x.id)).size !== d[k].length) fail();
  if (new Set(d.goals.map((x) => x.date)).size !== d.goals.length) fail();
  return clone({
    version: VERSION,
    foods: d.foods,
    entries: d.entries,
    recipes: d.recipes,
    favorites: [...new Set(d.favorites)],
    goals: d.goals,
    theme: d.theme,
  });
}
