import type { CollaborativeQuiz } from "@/lib/ednova/quiz-types";

export const demoQuiz: CollaborativeQuiz = {
  title: "Cell energy sprint",
  questions: [
    { id: "cell-1", question: "Which cell structure is the main site of photosynthesis in plants?", options: ["Nucleus", "Chloroplast", "Cell wall", "Mitochondrion"], correctAnswer: "Chloroplast", explanation: "Chloroplasts contain chlorophyll, which captures light energy for photosynthesis." },
    { id: "cell-2", question: "Which substance is made by photosynthesis and stores chemical energy?", options: ["Oxygen", "Glucose", "Carbon dioxide", "Water"], correctAnswer: "Glucose", explanation: "Photosynthesis makes glucose, a molecule that stores chemical energy." },
    { id: "cell-3", question: "Which statement is accurate?", options: ["Plants only photosynthesise", "Plants only respire", "Plants can photosynthesise and respire", "Respiration needs sunlight"], correctAnswer: "Plants can photosynthesise and respire", explanation: "Plants use photosynthesis to make glucose and respiration to release usable energy from glucose." },
  ],
};
