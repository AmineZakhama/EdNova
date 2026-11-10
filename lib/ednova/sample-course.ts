import type { KnowledgeNote } from "@/lib/ednova/types";

export const sampleCourseNote: KnowledgeNote = {
  id: "sample-cell-energy",
  title: "Sample course: Cell energy",
  sample: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  content: `Cell energy - synthetic demonstration notes

Photosynthesis is the process plants and some other organisms use to convert light energy into chemical energy. In plant cells, it mainly happens in chloroplasts. Chlorophyll absorbs light energy.

The word equation is: carbon dioxide + water -> glucose + oxygen. Light energy is required. Glucose stores chemical energy that the plant can use or build into other molecules.

Respiration releases usable energy from glucose. In many school examples, aerobic respiration uses glucose and oxygen and produces carbon dioxide and water. Photosynthesis and respiration are related but they are not the same process.

Common mistake: plants do respire. Photosynthesis makes glucose using light; respiration releases energy from glucose.`,
};
