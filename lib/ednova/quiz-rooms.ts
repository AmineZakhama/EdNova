import "server-only";

import type { CollaborativeQuiz, QuizRoomSnapshot, RoomParticipant } from "@/lib/ednova/quiz-types";

type Room = QuizRoomSnapshot & { createdAt: number };

const rooms = new Map<string, Room>();

export function createQuizRoom(quiz: CollaborativeQuiz, teamMode: boolean): QuizRoomSnapshot {
  cleanupRooms();
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  const room: Room = { code, quiz, teamMode, participants: [], createdAt: Date.now() };
  rooms.set(code, room);
  return snapshot(room);
}

export function getQuizRoom(code: string): QuizRoomSnapshot | null {
  const room = rooms.get(code.toUpperCase());
  return room ? snapshot(room) : null;
}

export function joinQuizRoom(code: string, nickname: string, team?: string): { room: QuizRoomSnapshot; participant: RoomParticipant } | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  const participant: RoomParticipant = { id: crypto.randomUUID(), nickname: nickname.trim().slice(0, 24) || "Learner", team: team?.trim().slice(0, 24) || undefined, score: 0, answers: 0 };
  room.participants.push(participant);
  return { room: snapshot(room), participant: { ...participant } };
}

export function answerQuizQuestion(code: string, participantId: string, questionId: string, answer: string): { room: QuizRoomSnapshot; correct: boolean; explanation: string } | null {
  const room = rooms.get(code.toUpperCase());
  const participant = room?.participants.find((item) => item.id === participantId);
  const question = room?.quiz.questions.find((item) => item.id === questionId);
  if (!room || !participant || !question) return null;
  const correct = answer === question.correctAnswer;
  participant.answers += 1;
  if (correct) participant.score += 1;
  return { room: snapshot(room), correct, explanation: question.explanation };
}

function snapshot(room: Room): QuizRoomSnapshot {
  return { code: room.code, quiz: structuredClone(room.quiz), teamMode: room.teamMode, participants: room.participants.map((participant) => ({ ...participant })).sort((left, right) => right.score - left.score || right.answers - left.answers) };
}

function randomCode(): string { return Math.random().toString(36).slice(2, 7).toUpperCase(); }
function cleanupRooms(): void { const cutOff = Date.now() - 8 * 60 * 60_000; for (const [code, room] of rooms) if (room.createdAt < cutOff) rooms.delete(code); }
