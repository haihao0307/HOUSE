import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SKILL_VERSION,
  TIMBER_PRESETS,
  TIMBER_PROFILE_CODES,
  RELIEF_LEVELS,
  hashString32,
  deriveSourceTimberSeed,
  deriveMemberSeed,
  canonicalTimberBasis,
  toCanonicalTimberPoint,
  classifyTimberFace,
  resolveProfileCode,
  chooseReliefMode,
  createMemberMaterialSpec,
  serializeBuildingTimberState
} from "../src/core/YunnanTimberSkill.mjs";

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`ok ${results.length} - ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`not ok ${results.length} - ${name}`);
    console.error(error.stack || error);
  }
}

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const sourceArgs = {
  generationSeed: 0x49ca20ef,
  buildingId: "kunming-yikeyin-001",
  floorId: "1",
  sourceTimberId: "source-log-12",
  materialRevision: "1"
};
const sourceSeed = deriveSourceTimberSeed(sourceArgs);
const yBasis = canonicalTimberBasis([0, 1, 0], [1, 0, 0]);

const roundMember = createMemberMaterialSpec({
  generationSeed: 0x49ca20ef,
  buildingId: "kunming-yikeyin-001",
  floorId: "1",
  memberId: "round-column-west-01",
  sourceTimberId: "source-log-west-01",
  presetId: "dark_aged",
  profile: "round",
  geometryLengthAxis: [0, 1, 0],
  radialAxisHint: [1, 0, 0],
  grainOffset: [0, 0, 0]
});

const rectangularMember = createMemberMaterialSpec({
  generationSeed: 0x49ca20ef,
  buildingId: "kunming-yikeyin-001",
  floorId: "1",
  memberId: "main-beam-01",
  sourceTimberId: "source-log-beam-01",
  presetId: "dark_aged",
  profile: "rectangular",
  geometryLengthAxis: [1, 0, 0],
  radialAxisHint: [0, 1, 0]
});

const html = read("preview-standalone.html");
const indexHtml = read("index.html");
const adapter = read("src/three/YunnanTimberThreeAdapter.mjs");
const workflow = read(".github/workflows/pages.yml");
const publicEntry = read("src/index.mjs");
const publishPowerShell = read("scripts/publish-github.ps1");
const publishShell = read("scripts/publish-github.sh");
const schema = JSON.parse(read("schemas/yunnan-timber-member.schema.json"));
const presetJson = JSON.parse(read("presets/yunnan-timber-presets.json"));

// Core and presets.
test("skill version is 0.4.0", () => assert.equal(SKILL_VERSION, "0.4.0"));
test("four Yunnan colour presets exist", () => assert.equal(Object.keys(TIMBER_PRESETS).length, 4));
test("all colour presets use restrained contrast", () => {
  for (const preset of Object.values(TIMBER_PRESETS)) assert.ok(preset.contrast <= 0.32);
});
test("lacquered preset is smoother than dark aged timber", () => {
  assert.ok(TIMBER_PRESETS.lacquered_chestnut.roughness[0] < TIMBER_PRESETS.dark_aged.roughness[0]);
});
test("all presets define pore scale", () => {
  for (const preset of Object.values(TIMBER_PRESETS)) assert.ok(preset.poreScale > 0);
});
test("preset JSON matches skill version", () => assert.equal(presetJson.skillVersion, SKILL_VERSION));

// Profiles.
test("round profile code is one", () => assert.equal(TIMBER_PROFILE_CODES.round, 1));
test("rectangular profile code is zero", () => assert.equal(TIMBER_PROFILE_CODES.rectangular, 0));
test("profile resolver accepts round", () => assert.equal(resolveProfileCode("round"), 1));
test("profile resolver rejects unknown profile", () => assert.throws(() => resolveProfileCode("triangle")));

// Seeds.
test("hash is deterministic", () => assert.equal(hashString32("beam-A"), hashString32("beam-A")));
test("different member names hash differently", () => assert.notEqual(hashString32("beam-A"), hashString32("beam-B")));
test("source timber seed is deterministic", () => assert.equal(sourceSeed, deriveSourceTimberSeed(sourceArgs)));
test("two pieces from one source timber retain the same source seed", () => {
  const a = deriveSourceTimberSeed(sourceArgs);
  const b = deriveSourceTimberSeed({ ...sourceArgs, sourceTimberId: "source-log-12" });
  assert.equal(a, b);
});
test("member detail seeds vary within one source timber", () => {
  assert.notEqual(deriveMemberSeed(sourceSeed, "segment-A"), deriveMemberSeed(sourceSeed, "segment-B"));
});

// Axis contract and surface classes.
test("Y axis cylinder maps length to canonical X", () => {
  const point = toCanonicalTimberPoint([0, 2.25, 0], yBasis);
  assert.ok(Math.abs(point[0] - 2.25) < 1e-8);
  assert.ok(Math.abs(point[1]) < 1e-8);
  assert.ok(Math.abs(point[2]) < 1e-8);
});
test("Y axis cylinder radial point remains in cross section", () => {
  const point = toCanonicalTimberPoint([0.55, 0, 0], yBasis);
  assert.ok(Math.abs(point[0]) < 1e-8);
  assert.ok(Math.abs(Math.hypot(point[1], point[2]) - 0.55) < 1e-8);
});
test("Y axis cylinder cap is end grain", () => {
  assert.equal(classifyTimberFace([0, 1, 0], [0, 1, 0]), "end_grain");
});
test("Y axis cylinder side is longitudinal", () => {
  assert.equal(classifyTimberFace([1, 0, 0], [0, 1, 0]), "longitudinal");
});
test("Y axis material basis is right handed", () => {
  const { x, y, z } = yBasis;
  const cross = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0]
  ];
  for (let index = 0; index < 3; index += 1) assert.ok(Math.abs(cross[index] - z[index]) < 1e-8);
});

// Relief.
test("building view disables parallax and displacement", () => {
  const mode = chooseReliefMode(40, "inspection");
  assert.equal(mode.id, "building");
  assert.equal(mode.parallaxSteps, 0);
  assert.equal(mode.vertexDisplacement, false);
});
test("close view uses six parallax steps", () => assert.equal(chooseReliefMode(14, "inspection").parallaxSteps, 6));
test("inspection view uses ten parallax steps", () => assert.equal(chooseReliefMode(2, "inspection").parallaxSteps, 10));
test("inspection displacement stays within 4.5 millimetres", () => assert.equal(RELIEF_LEVELS.inspection.displacementMeters, 0.0045));
test("quality cap prevents high cost displacement", () => assert.equal(chooseReliefMode(2, "close").vertexDisplacement, false));

// Member specs and serialization.
test("round member preserves Y axis geometry contract", () => assert.deepEqual(roundMember.geometryLengthAxis, [0, 1, 0]));
test("round member stores round profile code", () => assert.equal(roundMember.profileCode, 1));
test("rectangular member stores rectangular profile code", () => assert.equal(rectangularMember.profileCode, 0));
test("member spec produces separate source and member seeds", () => assert.notEqual(roundMember.sourceSeed, roundMember.memberSeed));
test("member spec rejects unknown preset", () => {
  assert.throws(() => createMemberMaterialSpec({ generationSeed: 1, buildingId: "b", memberId: "m", presetId: "unknown" }));
});

const state = serializeBuildingTimberState({
  generationSeed: 123,
  defaultPresetId: "dark_aged",
  members: [roundMember, rectangularMember]
});
test("building state serializes its generation seed", () => assert.equal(state.generationSeed, 123));
test("building state stores source timber identity", () => assert.equal(state.members[0].sourceTimberId, "source-log-west-01"));
test("building state stores round profile", () => assert.equal(state.members[0].profile, "round"));

// Standalone package.
test("index and standalone preview are identical", () => assert.equal(indexHtml, html));
test("standalone preview contains no external script dependency", () => {
  assert.ok(!/<script[^>]+src=/i.test(html));
  assert.ok(!/https?:\/\//i.test(html));
});
test("standalone preview contains no texture image references", () => {
  assert.ok(!/<img\b/i.test(html));
  assert.ok(!/url\([^)]*\.(?:png|jpe?g|webp|ktx2)\b/i.test(html));
  assert.ok(!/(?:src|href)=["'][^"']+\.(?:png|jpe?g|webp|ktx2)["']/i.test(html));
});
test("package contains no texture image files", () => {
  const forbidden = new Set([".png", ".jpg", ".jpeg", ".webp", ".ktx2", ".basis"]);
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else assert.ok(!forbidden.has(path.extname(entry.name).toLowerCase()), absolute);
    }
  }
});
test("standalone preview uses WebGL2", () => assert.ok(html.includes('getContext("webgl2"')));
test("standalone preview creates a real Y axis cylinder", () => assert.ok(html.includes('createCylinder(3.15,.58,88,34,13,"y")')));
test("standalone preview uses the corrected Y axis basis", () => assert.ok(html.includes('const BASIS_Y={x:[0,1,0],y:[1,0,0],z:[0,0,-1]}')));
test("round column selects round profile", () => assert.ok(html.includes('role:"column",profile:1')));
test("round purlin selects round profile", () => assert.ok(html.includes('role:"purlin",profile:1')));
test("round material branch prioritizes longitudinal fibre", () => assert.ok(html.includes('float roundSide=.74*silk')));
test("rectangular material branch keeps ring contribution", () => assert.ok(html.includes('float rectSide=.37*ringSoft')));
test("shader uses object space timber basis", () => {
  assert.ok(html.includes("vec3 toTimber(vec3 p)"));
  assert.ok(html.includes("dot(p,uAxisX)"));
});
test("shader has unified height driven micro normal", () => assert.ok(html.includes("perturbNormal")));
test("shader has parallax search", () => assert.ok(html.includes("parallaxPoint")));
test("shader has controlled vertex displacement", () => assert.ok(html.includes("uDisplacement")));
test("end and joint surfaces lock vertex displacement", () => assert.ok(html.includes("lockDisplacement=step(aSurfaceClass,0.5)")));
test("standalone page includes independent member seed control", () => assert.ok(html.includes("每根构件独立细节变化")));
test("standalone page includes all four colour categories", () => {
  for (const label of ["深色旧木", "暖褐中木", "浅色风化", "栗褐上漆"]) assert.ok(html.includes(label));
});

// Three adapter, schema and deployment.
test("Three adapter includes round profile uniform", () => assert.ok(adapter.includes("uProfileType")));
test("Three adapter includes round profile mask", () => assert.ok(adapter.includes("roundProfileMask")));
test("Three adapter gives round side a longitudinal fibre majority", () => assert.ok(adapter.includes("float roundSide = .74 * silk")));
test("Three adapter supports preset updates", () => assert.ok(adapter.includes("updatePreset(nextPresetId)")));
test("schema requires a timber profile", () => assert.ok(schema.required.includes("profile")));
test("schema accepts round profile", () => assert.ok(schema.properties.profile.enum.includes("round")));
test("GitHub Pages workflow validates before deployment", () => {
  assert.ok(workflow.includes("needs: validate"));
  assert.ok(workflow.includes("npm run validate"));
});
test("GitHub Pages workflow uploads repository root", () => assert.ok(workflow.includes("path: .")));

test("public module entry exports all skill layers", () => {
  assert.ok(publicEntry.includes('export * from "./core/YunnanTimberSkill.mjs"'));
  assert.ok(publicEntry.includes('export * from "./integration/HistoricalBuildingTimberSkill.mjs"'));
  assert.ok(publicEntry.includes('export * from "./three/YunnanTimberThreeAdapter.mjs"'));
});
test("PowerShell publisher validates before Git push", () => {
  assert.ok(publishPowerShell.indexOf("npm run validate") < publishPowerShell.indexOf("git push"));
});
test("Shell publisher validates before Git push", () => {
  assert.ok(publishShell.indexOf("npm run validate") < publishShell.indexOf("git push"));
});

test("release manifest points to root index", () => {
  const manifest = JSON.parse(read("release-manifest.json"));
  assert.equal(manifest.entry, "index.html");
  assert.deepEqual(manifest.textureImageAssets, []);
});

console.log(`1..${results.length}`);
const failed = results.filter((entry) => !entry.ok);
if (failed.length) process.exit(1);
