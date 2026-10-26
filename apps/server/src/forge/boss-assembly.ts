import {
  BossAttributesSchema,
  BossSchema,
  type Boss,
  type BossAttributes,
} from "@bossforge/shared";

const bodyNames = ["Granite", "Veil", "Tempest", "Gilded"];
const elementNames = ["Cinder", "Rime", "Thunder", "Void"];

export function assembleBoss(attributes: BossAttributes, cycleId: string): Boss {
  const valid = BossAttributesSchema.parse(attributes);
  const bodyIndex = ["golem", "wraith", "drake", "mimic"].indexOf(valid.body);
  const elementIndex = ["fire", "ice", "storm", "void"].indexOf(valid.element);
  return BossSchema.parse({
    id: cycleId,
    name: `${elementNames[elementIndex]} ${bodyNames[bodyIndex]}`,
    attributes: valid,
    stats: {
      health: 120 + bodyIndex * 45 + elementIndex * 20,
      damage: 12 + bodyIndex * 4 + elementIndex * 2,
      attackIntervalMs: 1800 - bodyIndex * 150 + elementIndex * 50,
    },
  });
}
