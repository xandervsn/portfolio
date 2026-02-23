// functions/api-proxy.js
export async function onRequest(context) {
    const { searchParams } = new URL(context.request.url);
    const target = searchParams.get('target'); // 'lastfm' or 'deezer'
    const query = searchParams.get('query');   // The encoded URL/endpoint

    if (target === 'lastfm') {
        const lastKey = context.env.LAST_KEY;
        const url = `${query}&api_key=${lastKey}`;
        const response = await fetch(url);
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (target === 'deezer') {
        const deezerKey = context.env.DEEZER_KEY;
        const response = await fetch(query, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': deezerKey,
                'X-RapidAPI-Host': 'deezerdevs-deezer.p.rapidapi.com'
            }
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response('Invalid Target', { status: 400 });
}