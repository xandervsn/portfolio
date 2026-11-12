import { handleRanksum } from './ranksum/ranksum-api.js';

const NOW_PLAYING_CACHE_SEC = 180;
const LASTFM_USER = 'p4pillio';
const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/?format=json&';

const BLOCKED_ARTISTS = new Set(['Kanye West', 'Ghais Guevara', 'JPEGMAFIA']);

const BAD_WORDS = [
    'l4r5e', '5h1t', '5hit', 'a55', 'anal', 'anus', 'ar5e', 'arrse', 'arse', 'ass',
    'ass-fucker', 'asses', 'assfucker', 'assfukka', 'asshole', 'assholes', 'asswhole',
    'a_s_s', 'b!tch', 'b00bs', 'b17ch', 'b1tch', 'ballbag', 'balls', 'ballsack',
    'bastard', 'beastial', 'beastiality', 'bellend', 'bestial', 'bestiality', 'bi+ch',
    'biatch', 'bitch', 'bitcher', 'bitchers', 'bitches', 'bitchin', 'bitching', 'bloody',
    'blow job', 'blowjob', 'blowjobs', 'boiolas', 'bollock', 'bollok', 'boner', 'boob',
    'boobs', 'booobs', 'boooobs', 'booooobs', 'booooooobs', 'breasts', 'buceta', 'bugger',
    'bum', 'bunny fucker', 'butt', 'butthole', 'buttmuch', 'buttplug', 'c0ck', 'c0cksucker',
    'carpet muncher', 'cawk', 'chink', 'cipa', 'cl1t', 'clit', 'clitoris', 'clits', 'cnut',
    'cock', 'cock-sucker', 'cockface', 'cockhead', 'cockmunch', 'cockmuncher', 'cocks',
    'cocksuck', 'cocksucked', 'cocksucker', 'cocksucking', 'cocksucks', 'cocksuka', 'cocksukka',
    'cok', 'cokmuncher', 'coksucka', 'coon', 'cox', 'crap', 'cum', 'cummer', 'cumming', 'cums',
    'cumshot', 'cunilingus', 'cunillingus', 'cunnilingus', 'cunt', 'cuntlick', 'cuntlicker',
    'cuntlicking', 'cunts', 'cyalis', 'cyberfuc', 'cyberfuck', 'cyberfucked', 'cyberfucker',
    'cyberfuckers', 'cyberfucking', 'd1ck', 'damn', 'dick', 'dickhead', 'dildo', 'dildos',
    'dink', 'dinks', 'dirsa', 'dlck', 'dog-fucker', 'doggin', 'dogging', 'donkeyribber',
    'doosh', 'duche', 'dyke', 'ejaculate', 'ejaculated', 'ejaculates', 'ejaculating',
    'ejaculatings', 'ejaculation', 'ejakulate', 'f u c k', 'f u c k e r', 'f4nny', 'fag',
    'fagging', 'faggitt', 'faggot', 'faggs', 'fagot', 'fagots', 'fags', 'fanny', 'fannyflaps',
    'fannyfucker', 'fanyy', 'fatass', 'fcuk', 'fcuker', 'fcuking', 'feck', 'fecker',
    'felching', 'fellate', 'fellatio', 'fingerfuck', 'fingerfucked', 'fingerfucker',
    'fingerfuckers', 'fingerfucking', 'fingerfucks', 'fistfuck', 'fistfucked', 'fistfucker',
    'fistfuckers', 'fistfucking', 'fistfuckings', 'fistfucks', 'flange', 'fook', 'fooker',
    'fuck', 'fucka', 'fucked', 'fucker', 'fuckers', 'fuckhead', 'fuckheads', 'fuckin',
    'fucking', 'fuckings', 'fuckingshitmotherfucker', 'fuckme', 'fucks', 'fuckwhit',
    'fuckwit', 'fudge packer', 'fudgepacker', 'fuk', 'fuker', 'fukker', 'fukkin', 'fuks',
    'fukwhit', 'fukwit', 'fux', 'fux0r', 'f_u_c_k', 'gangbang', 'gangbanged', 'gangbangs',
    'gaylord', 'gaysex', 'goatse', 'god-dam', 'god-damned', 'goddamn', 'goddamned',
    'hardcoresex', 'hell', 'heshe', 'hoar', 'hoare', 'hoer', 'homo', 'hore', 'horniest',
    'horny', 'hotsex', 'jack-off', 'jackoff', 'jap', 'jerk-off', 'jism', 'jiz', 'jizm',
    'jizz', 'kawk', 'knob', 'knobead', 'knobed', 'knobend', 'knobhead', 'knobjocky',
    'knobjokey', 'kock', 'kondum', 'kondums', 'kum', 'kummer', 'kumming', 'kums',
    'kunilingus', 'l3i+ch', 'l3itch', 'labia', 'lmfao', 'lust', 'lusting', 'm0f0', 'm0fo',
    'm45terbate', 'ma5terb8', 'ma5terbate', 'masochist', 'master-bate', 'masterb8',
    'masterbat*', 'masterbat3', 'masterbate', 'masterbation', 'masterbations',
    'masturbate', 'mo-fo', 'mof0', 'mofo', 'mothafuck', 'mothafucka', 'mothafuckas',
    'mothafuckaz', 'mothafucked', 'mothafucker', 'mothafuckers', 'mothafuckin',
    'mothafucking', 'mothafuckings', 'mothafucks', 'mother fucker', 'motherfuck',
    'motherfucked', 'motherfucker', 'motherfuckers', 'motherfuckin', 'motherfucking',
    'motherfuckings', 'motherfuckka', 'motherfucks', 'muff', 'mutha', 'muthafecker',
    'muthafuckker', 'muther', 'mutherfucker', 'n1gga', 'n1gger', 'nazi', 'nigg3r', 'nigg4h',
    'nigga', 'niggah', 'niggas', 'niggaz', 'nigger', 'niggers', 'nob', 'nob jokey', 'nobhead',
    'nobjocky', 'nobjokey', 'numbnuts', 'nutsack', 'orgasim', 'orgasims', 'orgasm', 'orgasms',
    'p0rn', 'pawn', 'pecker', 'penis', 'penisfucker', 'phonesex', 'phuck', 'phuk', 'phuked',
    'phuking', 'phukked', 'phukking', 'phuks', 'phuq', 'pigfucker', 'pimpis', 'piss',
    'pissed', 'pisser', 'pissers', 'pisses', 'pissflaps', 'pissin', 'pissing', 'pissoff',
    'poop', 'porn', 'porno', 'pornography', 'pornos', 'prick', 'pricks', 'pron', 'pube',
    'pusse', 'pussi', 'pussies', 'pussy', 'pussys', 'rectum', 'retard', 'rimjaw', 'rimming',
    's hit', 's.o.b.', 'sadist', 'schlong', 'screwing', 'scroat', 'scrote', 'scrotum', 'semen',
    'sex', 'sh!+', 'sh!t', 'sh1t', 'shag', 'shagger', 'shaggin', 'shagging', 'shemale', 'shi+',
    'shit', 'shitdick', 'shite', 'shited', 'shitey', 'shitfuck', 'shitfull', 'shithead',
    'shiting', 'shitings', 'shits', 'shitted', 'shitter', 'shitters', 'shitting', 'shittings',
    'shitty', 'skank', 'slut', 'sluts', 'smegma', 'smut', 'snatch', 'son-of-a-bitch', 'spac',
    'spunk', 's_h_i_t', 't1tt1e5', 't1tties', 'teets', 'teez', 'testical', 'testicle', 'tit',
    'titfuck', 'tits', 'titt', 'tittie5', 'tittiefucker', 'titties', 'tittyfuck', 'tittywank',
    'titwank', 'tosser', 'turd', 'tw4t', 'twat', 'twathead', 'twatty', 'twunt', 'twunter',
    'v14gra', 'v1gra', 'vagina', 'viagra', 'vulva', 'w00se', 'wang', 'wank', 'wanker', 'wanky',
    'whoar', 'whore', 'willies', 'willy', 'xrated', '*',
];

const PRIVATE_EXACT = new Set([
    '/wrangler.toml',
    '/google-fit-progress.txt',
    '/_worker.js',
    '/_worker.bundle',
    '/.env',
    '/.dev.vars',
    '/ranksum/ranksum-api.js',
    '/ranksum/server.js',
    '/ranksum/currently-reading.json',
    '/ranksum/currently-reading-cover.png',
    '/ranksum/albums.json',
    '/ranksum/movies.json',
    '/musi/server.js',
    '/musi/albums.json',
    '/musi/movies.json',
]);

function isPrivatePath(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (PRIVATE_EXACT.has(path)) {
        return true;
    }
    const base = path.slice(path.lastIndexOf('/') + 1);
    if (base === 'package.json' || base === 'package-lock.json' || base === 'server.js') {
        return true;
    }
    if (path.startsWith('/ranksum/public/')) {
        return true;
    }
    return false;
}

function notFound() {
    return new Response('Not Found', { status: 404 });
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (isPrivatePath(url.pathname)) {
            return notFound();
        }

        if (url.pathname === '/api/now-playing') {
            return handleNowPlaying(request, env, ctx);
        }

        if (url.pathname === '/api/lastfm') {
            const query = url.searchParams.get('query');
            const apiUrl = `${query}&api_key=${env.LAST_KEY}`;
            const response = await fetch(apiUrl);
            return json(await response.json());
        }

        if (url.pathname === '/api/deezer') {
            const query = url.searchParams.get('query');
            const response = await fetch(query, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': env.DEEZER_KEY,
                    'X-RapidAPI-Host': 'deezerdevs-deezer.p.rapidapi.com',
                },
            });
            return json(await response.json());
        }

        if (url.pathname.startsWith('/api/ranksum')) {
            const ranksumResponse = await handleRanksum(request, env);
            if (ranksumResponse) {
                return ranksumResponse;
            }
        }

        return env.ASSETS.fetch(request);
    },
};

async function handleNowPlaying(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request(new URL('/api/now-playing', request.url), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const payload = await fetchNowPlayingFromLastFM(env.LAST_KEY);
        const response = json(payload, {
            'Cache-Control': `public, max-age=${NOW_PLAYING_CACHE_SEC}`,
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
    } catch {
        return json({ artist: '', title: '', imageUrl: null }, {}, 502);
    }
}

async function fetchNowPlayingFromLastFM(apiKey) {
    const apiUrl =
        `${LASTFM_API}method=user.getrecenttracks&user=${LASTFM_USER}&limit=10&api_key=${apiKey}`;
    const upstream = await fetch(apiUrl);
    if (!upstream.ok) {
        throw new Error(`Last.fm request failed (${upstream.status})`);
    }

    const data = await upstream.json();
    const tracks = data?.recenttracks?.track;
    if (!Array.isArray(tracks) || tracks.length === 0) {
        return { artist: '', title: '', imageUrl: null };
    }

    const track = pickRecentTrack(tracks);
    if (!track) {
        return { artist: '', title: '', imageUrl: null };
    }

    return {
        artist: track.artist?.['#text'] || track.artist?.name || '',
        title: track.name || '',
        imageUrl: getTrackImage(track),
    };
}

function isTrackAllowed(track) {
    const artist = track.artist?.['#text'] || track.artist?.name || '';
    const title = (track.name || '').toLowerCase();

    if (BLOCKED_ARTISTS.has(artist)) {
        return false;
    }

    return !BAD_WORDS.some((word) => title.includes(word));
}

function pickRecentTrack(tracks) {
    for (const track of tracks) {
        if (isTrackAllowed(track)) {
            return track;
        }
    }
    return null;
}

function getTrackImage(track) {
    const images = track.image || [];
    for (let i = images.length - 1; i >= 0; i--) {
        const url = images[i]['#text'];
        if (url) {
            return url;
        }
    }
    return null;
}

function json(data, extraHeaders = {}, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
    });
}
