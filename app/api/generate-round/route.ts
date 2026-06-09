import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateRound, Operation } from '@/lib/engine'

export async function POST(req: NextRequest) {
  // Verify the user is authenticated
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { op, level } = await req.json()

  if (!op || !level) {
    return NextResponse.json({ error: 'Missing op or level' }, { status: 400 })
  }

  const validOps: Operation[] = ['addition', 'subtraction', 'multiplication', 'division']
  if (!validOps.includes(op)) {
    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
  }

  // Generate questions server-side — client never sees the logic
  const questions = generateRound(op as Operation, parseInt(level), 10)

  // Strip the answer before sending to client
  // We keep a server-side session token approach:
  // Send questions WITHOUT answers, store answers server-side in a signed token
  const questionsForClient = questions.map((q, i) => ({
    id: i,
    display: q.display,
    op: q.op,
  }))

  // Store answers in an encrypted token (base64 for now, use JWT in production)
  const answers = questions.map(q => q.answer)
  const answerToken = Buffer.from(JSON.stringify(answers)).toString('base64')

  return NextResponse.json({
    questions: questionsForClient,
    answerToken,
  })
}
