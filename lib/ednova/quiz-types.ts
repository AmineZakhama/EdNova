export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type CollaborativeQuiz = {
  title: string;
  questions: QuizQuestion[];
};

export type RoomParticipant = {
  id: string;
  nickname: string;
  team?: string;
  score: number;
  answers: number;
};

export type QuizRoomSnapshot = {
  code: string;
  quiz: CollaborativeQuiz;
  teamMode: boolean;
  participants: RoomParticipant[];
};
