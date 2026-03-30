export default async function handler(req: Request) {
  const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')
  const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')
  const INSFORGE_URL = Deno.env.get('INSFORGE_URL')
  const INSFORGE_SERVICE_ROLE_KEY = Deno.env.get('INSFORGE_SERVICE_ROLE_KEY')

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json()
    console.log('Received request body:', JSON.stringify(body))
    const { code, userId } = body

    if (!code || !userId) {
      throw new Error(`Missing code or userId. Received code: ${code ? 'YES' : 'NO'}, userId: ${userId}`)
    }

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !INSFORGE_URL || !INSFORGE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration error: Missing required environment variables.")
    }

    // 1. Exchange code for Strava tokens
    console.log('Exchanging code for Strava tokens...')
    const stravaRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    })

    const stravaData = await stravaRes.json()

    if (stravaData.errors || !stravaData.access_token) {
      console.error('Strava API Error:', JSON.stringify(stravaData))
      throw new Error('Failed to exchange Strava token: ' + (stravaData.message || 'Check logs'))
    }

    // 2. Update user profile in InsForge
    const cleanUserId = String(userId).trim()
    const dbUrl = `${INSFORGE_URL}/rest/v1/profiles?id=eq.${cleanUserId}`
    console.log(`Attempting DB Update at: ${dbUrl}`)

    const updateRes = await fetch(dbUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': INSFORGE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${INSFORGE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        strava_access_token: stravaData.access_token,
        strava_refresh_token: stravaData.refresh_token,
        strava_expires_at: new Date(stravaData.expires_at * 1000).toISOString(),
        strava_athlete_id: String(stravaData.athlete.id)
      })
    })

    if (!updateRes.ok) {
      const errorText = await updateRes.text()
      console.error(`DB Update Failed. Status: ${updateRes.status}. Error: ${errorText}`)
      throw new Error(`Database update failed: ${updateRes.status}`)
    }

    console.log('Database update successful!')

    return new Response(JSON.stringify({ success: true, athlete: stravaData.athlete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error('CRITICAL HANDLER ERROR:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
}
