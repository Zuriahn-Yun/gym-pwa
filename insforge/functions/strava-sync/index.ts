import { createClient } from "https://esm.sh/@insforge/sdk@1.2.2"

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')
const INSFORGE_URL = Deno.env.get('INSFORGE_URL')
const INSFORGE_SERVICE_ROLE_KEY = Deno.env.get('INSFORGE_SERVICE_ROLE_KEY')

export default async function handler(req: Request) {
  // Logic only allows POST from authorized cron or manual trigger
  const authHeader = req.headers.get('Authorization')
  // In production, you'd check a secret here if it's not a public trigger
  
  const insforge = createClient({
    baseUrl: INSFORGE_URL!,
    anonKey: INSFORGE_SERVICE_ROLE_KEY!, 
    auth: { persistSession: false }
  })

  try {
    // 1. Get all users who have Strava connected
    const { data: users, error: userError } = await insforge.database
      .from('profiles')
      .select('*')
      .not('strava_refresh_token', 'is', null)

    if (userError) throw userError

    const results = []

    for (const user of users) {
      try {
        let accessToken = user.strava_access_token
        const expiresAt = new Date(user.strava_expires_at).getTime()
        const now = Date.now()

        // 2. Refresh token if expired (or expiring in < 5 mins)
        if (now > (expiresAt - 300000)) {
          console.log(`Refreshing token for user ${user.id}...`)
          const refreshRes = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: STRAVA_CLIENT_ID,
              client_secret: STRAVA_CLIENT_SECRET,
              refresh_token: user.strava_refresh_token,
              grant_type: 'refresh_token'
            })
          })
          const refreshData = await refreshRes.json()
          if (refreshData.errors) throw new Error('Token refresh failed')
          
          accessToken = refreshData.access_token
          await insforge.database.from('profiles').update({
            strava_access_token: accessToken,
            strava_refresh_token: refreshData.refresh_token,
            strava_expires_at: new Date(refreshData.expires_at * 1000).toISOString()
          }).eq('id', user.id)
        }

        // 3. Fetch activities
        // If first sync, get last 30 days. Otherwise get since last_strava_sync_at.
        const lastSync = user.last_strava_sync_at 
          ? Math.floor(new Date(user.last_strava_sync_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)

        const activitiesRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${lastSync}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        const activities = await activitiesRes.json()

        if (!Array.isArray(activities)) {
          console.error(`Invalid activities response for user ${user.id}:`, activities)
          continue
        }

        let syncedCount = 0
        for (const act of activities) {
          // 4. Map to Gym PWA Workout
          // Support Run and Swim specifically
          if (act.type !== 'Run' && act.type !== 'Swim') continue

          const stravaId = `strava_${act.id}`
          
          // Insert Session
          const { data: session, error: sessionErr } = await insforge.database
            .from('sessions')
            .upsert({
              user_id: user.id,
              template_name: act.name,
              started_at: act.start_date,
              finished_at: new Date(new Date(act.start_date).getTime() + (act.elapsed_time * 1000)).toISOString(),
              strava_id: stravaId
            }, { onConflict: 'strava_id' })
            .select()
            .single()

          if (sessionErr) {
            console.error('Session upsert err:', sessionErr)
            continue
          }

          // Fetch or Find the right exercise ID
          const exName = act.type === 'Run' ? 'Running' : 'Swimming'
          const { data: exercise } = await insforge.database
            .from('exercises')
            .select('id')
            .eq('name', exName)
            .single()

          if (exercise) {
            // Add Exercise to Session
            const { data: se } = await insforge.database
              .from('session_exercises')
              .insert({
                session_id: session.id,
                exercise_id: exercise.id,
                position: 0
              })
              .select()
              .single()

            if (se) {
              // Add the activity data as a "Set"
              await insforge.database.from('sets').insert({
                session_exercise_id: se.id,
                set_number: 1,
                completed: true,
                distance: act.distance / (act.type === 'Run' ? 1609.34 : 1), // Miles for Run, Meters for Swim
                duration: act.moving_time
              })
            }
          }
          syncedCount++
        }

        // 5. Update last sync time
        await insforge.database.from('profiles')
          .update({ last_strava_sync_at: new Date().toISOString() })
          .eq('id', user.id)

        results.push({ user: user.email, activitiesFetched: activities.length, activitiesSynced: syncedCount })

      } catch (userErr) {
        console.error(`Failed to sync user ${user.id}:`, userErr.message)
        results.push({ user: user.email, error: userErr.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
}
