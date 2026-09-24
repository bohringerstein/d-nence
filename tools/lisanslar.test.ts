import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lisansSayfasi } from "./make-lisanslar.ts";

test("public/lisanslar.html licenses/ klasörüyle güncel (npm run lisanslar)", () => {
  const dosya = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "lisanslar.html"), "utf8");
  assert.equal(dosya, lisansSayfasi());
});

test("lisans sayfası dağıtılan iki bileşenin tam metnini taşır", () => {
  const s = lisansSayfasi();
  assert.match(s, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(s, /Copyright 2018 Google LLC/);
  assert.match(s, /Permission is hereby granted, free of charge/);
});
