import { createClient } from "https://esm.sh/@insforge/sdk@1.2.2"

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID')
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET')
const INSFORGE_URL = Deno.env.get('INSFORGE_URL')
const INSFORGE_ANON_KEY = Deno.env.get('INSFORGE_ANON_KEY')
const INSFORGE_SERVICE_ROLE_KEY = Deno.env.get('INSFORGE_SERVICE_ROLE_KEY')

export default async function handler(req: Request) {
  // CORS headers
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
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
      console.error('Strava token exchange error:', stravaData)
      throw new Error('Failed to exchange Strava token: ' + (stravaData.message || 'Unknown error'))
    }

    // 2. Update user profile in InsForge
    const insforge = createClient({
      baseUrl: INSFORGE_URL!,
      anonKey: INSFORGE_SERVICE_ROLE_KEY || INSFORGE_ANON_KEY!,
    })

    const { error } = await insforge.database
      .from('profiles')
      .update({
        strava_access_token: stravaData.access_token,
        strava_refresh_token: stravaData.refresh_token,
        strava_expires_at: new Date(stravaData.expires_at * 1000).toISOString(),
        strava_athlete_id: String(stravaData.athlete.id)
      })
      .eq('id', userId)

    if (error) throw error

    return new Response(JSON.stringify({ success: true, athlete: stravaData.athlete }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (err) {
    console.error('Exchange error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...headers, "Content-Type": "application/json" },
      status: 400,
    })
  }
}
