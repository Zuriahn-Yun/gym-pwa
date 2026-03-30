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

  try {
    const { code, userId } = await req.json()

    if (!code || !userId) {
      throw new Error("Missing code or userId")
    }

    // 1. Exchange code for Strava tokens
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
      throw new Error('Failed to exchange Strava token: ' + (stravaData.message || 'Unknown error'))
    }

    // 2. Update user profile in InsForge using SERVICE_ROLE_KEY to bypass RLS
    const updateRes = await fetch(`${INSFORGE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': INSFORGE_SERVICE_ROLE_KEY!,
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
      throw new Error(`Database update failed: ${updateRes.status} ${errorText}`)
    }

    return new Response(JSON.stringify({ success: true, athlete: stravaData.athlete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
}
