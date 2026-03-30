const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')
const INSFORGE_URL = Deno.env.get('INSFORGE_URL')
const INSFORGE_SERVICE_ROLE_KEY = Deno.env.get('INSFORGE_SERVICE_ROLE_KEY')

export default async function handler(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': INSFORGE_SERVICE_ROLE_KEY!,
    'Authorization': `Bearer ${INSFORGE_SERVICE_ROLE_KEY}`,
  }

  try {
    const usersRes = await fetch(`${INSFORGE_URL}/rest/v1/profiles?strava_refresh_token=not.is.null&select=*`, {
      headers
    })
    const users = await usersRes.json()

    if (!Array.isArray(users)) throw new Error('Failed to fetch users')

    const results = []

    for (const user of users) {
      try {
        let accessToken = user.strava_access_token
        const expiresAt = new Date(user.strava_expires_at).getTime()
        const now = Date.now()

        if (now > (expiresAt - 300000)) {
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
          await fetch(`${INSFORGE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              strava_access_token: accessToken,
              strava_refresh_token: refreshData.refresh_token,
              strava_expires_at: new Date(refreshData.expires_at * 1000).toISOString()
            })
          })
        }

        const lastSync = user.last_strava_sync_at 
          ? Math.floor(new Date(user.last_strava_sync_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)

        const activitiesRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${lastSync}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        const activities = await activitiesRes.json()

        if (!Array.isArray(activities)) continue

        let syncedCount = 0
        for (const act of activities) {
          if (act.type !== 'Run' && act.type !== 'Swim' && act.type !== 'Ride') continue

          const stravaId = `strava_${act.id}`
          
          const sessionRes = await fetch(`${INSFORGE_URL}/rest/v1/sessions`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
            body: JSON.stringify({
              user_id: user.id,
              template_name: act.name,
              started_at: act.start_date,
              finished_at: new Date(new Date(act.start_date).getTime() + (act.elapsed_time * 1000)).toISOString(),
              strava_id: stravaId
            })
          })
          const sessionsData = await sessionRes.json()
          const session = Array.isArray(sessionsData) ? sessionsData[0] : sessionsData

          if (!session?.id) continue

          let exName = 'Running'
          if (act.type === 'Swim') exName = 'Swimming'
          if (act.type === 'Ride') exName = 'Cycling'

          const exRes = await fetch(`${INSFORGE_URL}/rest/v1/exercises?name=eq.${exName}&select=id`, { headers })
          const exercises = await exRes.json()
          const exercise = exercises[0]

          if (exercise) {
            const seRes = await fetch(`${INSFORGE_URL}/rest/v1/session_exercises`, {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'return=representation' },
              body: JSON.stringify({ session_id: session.id, exercise_id: exercise.id, position: 0 })
            })
            const ses = await seRes.json()
            const se = Array.isArray(ses) ? ses[0] : ses

            if (se?.id) {
              const isMetric = act.type === 'Swim'
              await fetch(`${INSFORGE_URL}/rest/v1/sets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  session_exercise_id: se.id,
                  set_number: 1,
                  completed: true,
                  distance: act.distance / (isMetric ? 1 : 1609.34),
                  duration: act.moving_time
                })
              })
            }
          }
          syncedCount++
        }

        await fetch(`${INSFORGE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ last_strava_sync_at: new Date().toISOString() })
        })

        results.push({ user: user.email, synced: syncedCount })

      } catch (userErr) {
        results.push({ user: user.email, error: userErr.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
}
