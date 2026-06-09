'use client'
import { Operation } from './engine'

export interface UserAnalytics {
  totalQuestions: number
  totalCorrect: number
  byOp: Record<Operation, { correct: number; total: number; totalTime: number }>
  streak: number
  mmr: number
  sessions: number
}

export interface AppState {
  user: { username: string; email: string } | null
  isGuest: boolean
  currentLevel: number
  clearedLevels: number[]
  analytics: UserAnalytics
}

const DEFAULT_STATE: AppState = {
  user: null,
  isGuest: false,
  currentLevel: 1,
  clearedLevels: [],
  analytics: {
    totalQuestions: 0,
    totalCorrect: 0,
    byOp: {
      addition: { correct: 0, total: 0, totalTime: 0 },
      subtraction: { correct: 0, total: 0, totalTime: 0 },
      multiplication: { correct: 0, total: 0, totalTime: 0 },
      division: { correct: 0, total: 0, totalTime: 0 },
    },
    streak: 0,
    mmr: 1000,
    sessions: 0,
  },
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem('mathspeed_state')
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch { return DEFAULT_STATE }
}

export function saveState(state: AppState) {
  if (typeof window === 'undefined') return
  localStorage.setItem('mathspeed_state', JSON.stringify(state))
}

export function clearState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('mathspeed_state')
}
