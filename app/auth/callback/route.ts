import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existing) {
          const emailUsername = user.email?.split('@')[0] || 'user'
          const username = emailUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_')
          await supabase.from('profiles').insert({
            id: user.id,
            username: username + '_' + Math.floor(Math.random() * 1000),
            mmr: 1000,
            current_level: 1,
            cleared_levels: [],
          })
        }
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
