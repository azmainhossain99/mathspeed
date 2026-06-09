export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division'

export interface Question {
  display: string
  answer: number
  op: Operation
  a: number
  b: number
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getTimerForLevel(level: number): number {
  if (level <= 10) return 120
  if (level <= 25) return 100
  if (level <= 50) return 80
  if (level <= 100) return 70
  if (level <= 200) return 60
  if (level <= 300) return 55
  if (level <= 500) return 50
  if (level <= 700) return 40
  if (level <= 900) return 35
  return 30
}

export function generateQuestion(op: Operation, level: number): Question {
  let a = 0, b = 0, answer = 0, display = ''

  if (op === 'addition') {
    if (level <= 20) { a = rand(1, 9); b = rand(1, 9) }
    else if (level <= 60) { a = rand(10, 99); b = rand(10, 99) }
    else if (level <= 120) { a = rand(15, 99); b = rand(15, 89) }
    else if (level <= 250) { a = rand(100, 999); b = rand(100, 999) }
    else { a = rand(100, 9999); b = rand(100, 9999) }
    answer = a + b
    display = `${a} + ${b}`
  } else if (op === 'subtraction') {
    if (level <= 20) { a = rand(2, 18); b = rand(1, 9) }
    else if (level <= 60) { a = rand(20, 99); b = rand(10, 50) }
    else if (level <= 120) { a = rand(50, 999); b = rand(10, 200) }
    else { a = rand(100, 9999); b = rand(10, 500) }
    if (b > a) b = a - 1
    b = Math.max(1, b)
    answer = a - b
    display = `${a} − ${b}`
  } else if (op === 'multiplication') {
    if (level <= 30) { a = rand(2, 9); b = rand(2, 9) }
    else if (level <= 80) { a = rand(2, 12); b = rand(2, 12) }
    else if (level <= 150) { a = rand(2, 25); b = rand(2, 25) }
    else { a = rand(10, 99); b = rand(2, 15) }
    answer = a * b
    display = `${a} × ${b}`
  } else {
    if (level <= 30) { b = rand(2, 9); answer = rand(1, 9) }
    else if (level <= 80) { b = rand(2, 12); answer = rand(2, 12) }
    else if (level <= 150) { b = rand(2, 20); answer = rand(2, 20) }
    else { b = rand(2, 25); answer = rand(2, 50) }
    a = b * answer
    display = `${a} ÷ ${b}`
  }

  return { display, answer, op, a, b }
}

export function generateRound(op: Operation, level: number, count = 10): Question[] {
  return Array.from({ length: count }, () => generateQuestion(op, level))
}

export const OPERATIONS: Operation[] = ['addition', 'subtraction', 'multiplication', 'division']
export const OP_SYMBOLS: Record<Operation, string> = {
  addition: '+', subtraction: '−', multiplication: '×', division: '÷'
}
export const OP_LABELS: Record<Operation, string> = {
  addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication', division: 'Division'
}
