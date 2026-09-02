import {
  SKILL_VERSION,
  TIMBER_PRESETS,
  createMemberMaterialSpec,
  randomGenerationSeed,
  serializeBuildingTimberState
} from "../core/YunnanTimberSkill.mjs";

/**
 * Renderer independent adapter for the historical building production line.
 * It owns one building seed and derives stable source timber and member seeds.
 */
export class HistoricalBuildingTimberSkill {
  constructor({
    buildingId,
    generationSeed = randomGenerationSeed(),
    defaultPresetId = "dark_aged",
    qualityCap = "inspection"
  }) {
    if (!buildingId) throw new Error("buildingId is required");
    if (!TIMBER_PRESETS[defaultPresetId]) {
      throw new Error(`Unknown defaultPresetId: ${defaultPresetId}`);
    }
    this.buildingId = buildingId;
    this.generationSeed = generationSeed >>> 0;
    this.defaultPresetId = defaultPresetId;
    this.qualityCap = qualityCap;
    this.members = new Map();
  }

  registerMember(member) {
    const spec = createMemberMaterialSpec({
      generationSeed: this.generationSeed,
      buildingId: this.buildingId,
      presetId: this.defaultPresetId,
      qualityCap: this.qualityCap,
      ...member
    });
    this.members.set(spec.memberId, spec);
    return spec;
  }

  registerMembers(members) {
    return members.map((member) => this.registerMember(member));
  }

  getMember(memberId) {
    return this.members.get(memberId) ?? null;
  }

  getShaderUniformPayload(memberId) {
    const member = this.getMember(memberId);
    if (!member) throw new Error(`Unknown member: ${memberId}`);
    const preset = TIMBER_PRESETS[member.presetId];
    return {
      uSourceSeed: member.sourceSeed / 0xffffffff,
      uMemberSeed: member.memberSeed / 0xffffffff,
      uTimberAxis: member.canonicalBasis.x,
      uRadialAxis: member.canonicalBasis.y,
      uBinormalAxis: member.canonicalBasis.z,
      uGrainOffset: member.grainOffset,
      uProfileType: member.profileCode,
      uDarkColor: preset.dark,
      uMidColor: preset.mid,
      uLightColor: preset.light,
      uWeatherColor: preset.weather,
      uFreshCutColor: preset.freshCut,
      uRoughnessRange: preset.roughness,
      uLacquer: preset.lacquer,
      uContrast: preset.contrast,
      uRelief: preset.relief,
      uPoreScale: preset.poreScale,
      uWeathering: member.weathering,
      uToolMarks: member.toolMarks
    };
  }

  exportState() {
    return serializeBuildingTimberState({
      generationSeed: this.generationSeed,
      defaultPresetId: this.defaultPresetId,
      members: [...this.members.values()]
    });
  }

  static get version() {
    return SKILL_VERSION;
  }
}
