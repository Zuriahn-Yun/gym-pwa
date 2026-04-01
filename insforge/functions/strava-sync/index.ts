import { createClient } from "https://esm.sh/@insforge/sdk@1.2.2"

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

  const insforge = createClient({
    baseUrl: INSFORGE_URL!,
    anonKey: INSFORGE_SERVICE_ROLE_KEY!, 
    auth: { persistSession: false }
  })

  try {
    const { data: users, error: userError } = await insforge.database
      .from('profiles')
      .select('*')
      .not('strava_refresh_token', 'is', null)

    if (userError) throw userError

    const results = []

    for (const user of users) {
      try {
        let accessToken = user.strava_access_token
        
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
        
        if (refreshData.access_token) {
          accessToken = refreshData.access_token
          await insforge.database.from('profiles').update({
            strava_access_token: accessToken,
            strava_refresh_token: refreshData.refresh_token,
            strava_expires_at: new Date(refreshData.expires_at * 1000).toISOString()
          }).eq('id', user.id)
        } else {
          results.push({ user: user.email, error: 'Token refresh failed' });
          continue;
        }

        const lastSync = user.last_strava_sync_at 
          ? Math.floor(new Date(user.last_strava_sync_at).getTime() / 1000)
          : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        
        const activitiesRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${lastSync}&per_page=100`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        const activities = await activitiesRes.json()

        if (!Array.isArray(activities)) {
          results.push({ user: user.email, error: 'Invalid Strava response' });
          continue;
        }

        let syncedCount = 0
        for (const act of activities) {
          const type = (act.sport_type || act.type || '').toLowerCase();
          const isRun = type.includes('run');
          const isSwim = type.includes('swim');
          const isRide = type.includes('ride') || type.includes('cycle');

          if (!isRun && !isSwim && !isRide) continue;

          const stravaId = `strava_${act.id}`
          
          let { data: session } = await insforge.database
            .from('sessions')
            .select('id')
            .eq('strava_id', stravaId)
            .maybeSingle()

          if (!session) {
            const { data: newSession, error: createErr } = await insforge.database
              .from('sessions')
              .insert({
                user_id: user.id,
                template_name: act.name,
                started_at: act.start_date,
                finished_at: new Date(new Date(act.start_date).getTime() + (act.elapsed_time * 1000)).toISOString(),
                strava_id: stravaId
              })
              .select()
              .single()
            
            if (createErr) continue;
            session = newSession;
          }

          if (!session?.id) continue;

          let exName = 'Running'
          if (isSwim) exName = 'Swimming'
          if (isRide) exName = 'Cycling'

          const { data: exercise } = await insforge.database
            .from('exercises')
            .select('id')
            .eq('name', exName)
            .single()

          if (exercise) {
            let { data: se } = await insforge.database
              .from('session_exercises')
              .select('id')
              .eq('session_id', session.id)
              .eq('exercise_id', exercise.id)
              .maybeSingle()

            if (!se) {
              const { data: newSe } = await insforge.database
                .from('session_exercises')
                .insert({ session_id: session.id, exercise_id: exercise.id, position: 0 })
                .select()
                .single()
              se = newSe;
            }

            if (se?.id) {
              const { data: existingSet } = await insforge.database
                .from('sets')
                .select('id')
                .eq('session_exercise_id', se.id)
                .maybeSingle()

              if (!existingSet) {
                const isMetric = isSwim;
                await insforge.database.from('sets').insert({
                  session_exercise_id: se.id,
                  set_number: 1,
                  completed: true,
                  distance: act.distance / (isMetric ? 1 : 1609.34),
                  duration: act.moving_time
                })
              }
            }
          }
          syncedCount++
        }

        await insforge.database.from('profiles')
          .update({ last_strava_sync_at: new Date().toISOString() })
          .eq('id', user.id)

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
