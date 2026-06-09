import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { level, mode, passed, roundResults, totalCorrect, totalQuestions, mmrGained } = await req.json()

  // Save game session
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      user_id: user.id,
      level,
      mode,
      passed,
      total_correct: totalCorrect,
      total_questions: totalQuestions,
      mmr_gained: mmrGained,
    })
    .select()
    .single()

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 })
  }

  // Save each round result
  for (const round of roundResults) {
    const avgTime = round.results.length > 0
      ? Math.round(round.results.reduce((a: number, r: any) => a + r.time, 0) / round.results.length)
      : 0

    const { data: roundRow, error: roundError } = await supabase
      .from('round_results')
      .insert({
        session_id: session.id,
        operation: round.op,
        correct: round.correct,
        total: round.total,
        avg_response_time: avgTime,
        passed: round.pass,
      })
      .select()
      .single()

    if (roundError) continue

    // Save individual question attempts
    const attempts = round.results.map((r: any) => ({
      round_id: roundRow.id,
      question: r.question.display,
      correct_answer: r.question.answer,
      user_answer: r.userAnswer === '—' ? null : r.userAnswer,
      response_time_ms: r.time,
      is_correct: r.correct,
      skipped: r.skipped,
    }))

    await supabase.from('question_attempts').insert(attempts)
  }

  // Update profile if level passed
  if (passed && mode === 'level') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('cleared_levels, current_level, mmr')
      .eq('id', user.id)
      .single()

    if (profile) {
      const clearedLevels = profile.cleared_levels || []
      if (!clearedLevels.includes(level)) clearedLevels.push(level)
      const newCurrentLevel = Math.max(profile.current_level, level + 1)
      const newMmr = profile.mmr + mmrGained

      await supabase
        .from('profiles')
        .update({
          cleared_levels: clearedLevels,
          current_level: newCurrentLevel,
          mmr: newMmr,
        })
        .eq('id', user.id)
    }
  }

  return NextResponse.json({ success: true, sessionId: session.id })
}
