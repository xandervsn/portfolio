export async function onRequest(context) {
    const { request, env } = context;
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        // Return the API keys from environment variables
        const apiKeys = {
            lastKey: env.LAST_KEY,
            deezerKey: env.DEEZER_KEY
        };

        return new Response(JSON.stringify(apiKeys), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        return new Response('Internal server error', { status: 500 });
    }
}
