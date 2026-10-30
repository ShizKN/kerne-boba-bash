import { DurableObject } from 'cloudflare:workers';
import { createGame, act, advance, presence, view, nextDeadline } from './games.js';
import { advanceFocus, controlFocus, focusDue } from './focus.js';

const MAX_ROOM_SIZE = 4;
const LEVELS = new Set(['Middle school', 'High school', 'Preparatory class', 'Undergraduate', "Master's", 'Doctorate']);
const LEGACY_LEVELS = { 'Collège': 'Middle school', 'Lycée': 'High school', 'Prépa': 'Preparatory class', 'Licence': 'Undergraduate', 'Master': "Master's", 'Doctorat': 'Doctorate' };
const STUN = [{ urls: 'stun:stun.cloudflare.com:3478' }];
const SOUNDS = new Set(['boing','quack','tada','pop','zap','drum']);
const STATIONS = new Set(['off','focus','arcade','rain']);
function send(ws, event, data, id) {
    if (ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify({ event, data, ...(id ? { id } : {}) })); } catch (_) {}
}

function isAllowedOrigin(origin) {
    if (!origin) return false;
    try {
        const url = new URL(origin);
        return url.protocol === 'https:' && (url.hostname === 'kerne.apospace.com' ||
            url.hostname === 'kernee.pages.dev' ||
            url.hostname.endsWith('.kernee.pages.dev')) ||
            (url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.protocol === 'http:';
    } catch (_) { return false; }
}

export class KerneRooms extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_games (room TEXT PRIMARY KEY, state TEXT NOT NULL, due INTEGER NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS feedback_limits (visitor TEXT PRIMARY KEY, at INTEGER NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS feedback_buckets (network TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_media (room TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS room_focus (room TEXT PRIMARY KEY, state TEXT NOT NULL, due INTEGER)');
        if (!ctx.storage.sql.exec('PRAGMA table_info(room_media)').toArray().some(column => column.name === 'updated'))
            ctx.storage.sql.exec('ALTER TABLE room_media ADD COLUMN updated INTEGER NOT NULL DEFAULT 0');
    }

    async feedback(request) {
        const headers = { 'Access-Control-Allow-Origin': request.headers.get('Origin'), 'Vary': 'Origin', 'Cache-Control': 'no-store' };
        if (Number(request.headers.get('Content-Length') || 0) > 512) return new Response('Too large', { status: 413, headers });
        let body;
        try { const raw = await request.text(); if (raw.length > 512) throw new Error('Too large'); body = JSON.parse(raw); }
        catch (_) { return new Response('Invalid feedback', { status: 400, headers }); }
        if (!body || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.session !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.session)) return new Response('Choose 1–5 stars', { status: 400, headers });
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2,'0')).join('');
        const member = await hash(body.session);
        if (!this.ctx.getWebSockets().some(ws => ws.readyState === WebSocket.OPEN && ws.deserializeAttachment()?.userId === member && ws.deserializeAttachment()?.roomId))
            return new Response('Join a call before rating', { status: 403, headers });
        const target = this.env.DISCORD_FEEDBACK_WEBHOOK;
        if (!target) return new Response('Feedback unavailable', { status: 503, headers });
        let endpoint;
        try { endpoint = new URL(target); if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'discord.com' || !/^\/api\/webhooks\/\d+\/[^/]+$/.test(endpoint.pathname)) throw new Error(); }
        catch (_) { return new Response('Feedback unavailable', { status: 503, headers }); }
        const network = await hash(ip), visitor = await hash(`${ip}|${body.session}`);
        const now = Date.now();
        const recent = this.ctx.storage.sql.exec('SELECT at FROM feedback_limits WHERE visitor = ?', visitor).toArray()[0];
        const bucket = this.ctx.storage.sql.exec('SELECT started, count FROM feedback_buckets WHERE network = ?', network).toArray()[0];
        if (recent && now - recent.at < 5 * 60_000 || bucket && now - bucket.started < 60 * 60_000 && bucket.count >= 6) return new Response('Please wait before rating again', { status: 429, headers });
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO feedback_limits (visitor, at) VALUES (?, ?)', visitor, now);
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO feedback_buckets (network, started, count) VALUES (?, ?, ?)', network, bucket && now - bucket.started < 60 * 60_000 ? bucket.started : now, bucket && now - bucket.started < 60 * 60_000 ? bucket.count + 1 : 1);
        this.ctx.storage.sql.exec('DELETE FROM feedback_limits WHERE at < ?', now - 24 * 60 * 60_000);
        this.ctx.storage.sql.exec('DELETE FROM feedback_buckets WHERE started < ?', now - 24 * 60 * 60_000);
        try {
            const response = await fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `KERNE call rating: ${'⭐'.repeat(body.rating)} (${body.rating}/5)`, allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(6000) });
            if (!response.ok) throw new Error('Webhook failed');
            return new Response(null, { status: 204, headers });
        } catch (_) {
            this.ctx.storage.sql.exec('DELETE FROM feedback_limits WHERE visitor = ? AND at = ?', visitor, now);
            this.ctx.storage.sql.exec('UPDATE feedback_buckets SET count = MAX(0, count - 1) WHERE network = ?', network);
            return new Response('Feedback unavailable', { status: 502, headers });
        }
    }

    game(room) {
        const row = this.ctx.storage.sql.exec('SELECT state FROM room_games WHERE room = ?', room).toArray()[0];
        return row ? JSON.parse(row.state) : null;
    }
    media(room) {
        const row = this.ctx.storage.sql.exec('SELECT state, updated FROM room_media WHERE room = ?', room).toArray()[0];
        if (row && Date.now() - row.updated < 24 * 60 * 60_000) return JSON.parse(row.state);
        if (row) this.ctx.storage.sql.exec('DELETE FROM room_media WHERE room = ?', room);
        return { video: { id: '', playing: false, position: 0, at: 0 }, radio: { station: 'off', at: 0 } };
    }
    focus(room) {
        const row = this.ctx.storage.sql.exec('SELECT state FROM room_focus WHERE room = ?', room).toArray()[0];
        return row ? JSON.parse(row.state) : null;
    }
    saveFocus(room, focus) {
        if (!focus) this.ctx.storage.sql.exec('DELETE FROM room_focus WHERE room = ?', room);
        else this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room_focus (room, state, due) VALUES (?, ?, ?)', room, JSON.stringify(focus), focusDue(focus));
    }
    publishFocus(room, focus, target) {
        const payload = { focus, serverNow: Date.now() };
        if (target) send(target, 'focus-state', payload);
        else this.broadcast(room, 'focus-state', payload);
    }
    async focusMessage(ws, state, data) {
        const room = state.roomId, now = Date.now(), action = data.action;
        let focus = this.focus(room);
        try {
            if (focus && advanceFocus(focus, now)) { this.saveFocus(room, focus); this.publishFocus(room, focus); }
            if (action === 'get') { this.publishFocus(room, focus, ws); return; }
            if (typeof action !== 'string') throw new Error('Choose a timer action.');
            const rate = state.focusRate && now - state.focusRate.at < 1000 ? state.focusRate : { at: now, count: 0 };
            rate.count++; ws.serializeAttachment({ ...ws.deserializeAttachment(), focusRate: rate });
            if (rate.count > 8) throw new Error('Slow down for a second.');
            focus = controlFocus(focus, { id: state.userId, name: state.name }, action, data, this.members(room), now);
            this.saveFocus(room, focus); this.publishFocus(room, focus);
            await this.scheduleState();
        } catch (error) { send(ws, 'focus-error', { message: error.message }); }
    }
    async mediaMessage(ws, state, event, data) {
        const now = Date.now(), rate = state.mediaRate && now - state.mediaRate.at < 1000 ? state.mediaRate : { at: now, count: 0 };
        rate.count++; ws.serializeAttachment({ ...ws.deserializeAttachment(), mediaRate: rate });
        if (rate.count > 8) return;
        if (event === 'sound-play') {
            if (!SOUNDS.has(data.id) || state.lastSound && now - state.lastSound < 650) return;
            ws.serializeAttachment({ ...ws.deserializeAttachment(), lastSound: now });
            this.broadcast(state.roomId, 'sound-play', { id: data.id, from: state.name, at: now });
            return;
        }
        const media = this.media(state.roomId);
        if (event === 'watch-control') {
            if (data.id !== undefined) {
                if (typeof data.id !== 'string' || data.id && !/^[a-zA-Z0-9_-]{11}$/.test(data.id)) return;
                media.video = { id: data.id, playing: false, position: 0, at: now };
            } else {
                if (!media.video.id || typeof data.playing !== 'boolean' || !Number.isFinite(data.position) || data.position < 0 || data.position > 86400) return;
                media.video = { ...media.video, playing: data.playing, position: data.position, at: now };
            }
        } else if (event === 'radio-control') {
            if (!STATIONS.has(data.station)) return;
            media.radio = { station: data.station, at: now };
        } else return;
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room_media (room, state, updated) VALUES (?, ?, ?)', state.roomId, JSON.stringify(media), now);
        this.ctx.storage.sql.exec('DELETE FROM room_media WHERE updated < ?', now - 24 * 60 * 60_000);
        this.broadcast(state.roomId, 'media-state', { ...media, by: state.name, serverNow: now });
    }
    saveGame(room, game) {
        if (!game) this.ctx.storage.sql.exec('DELETE FROM room_games WHERE room = ?', room);
        else this.ctx.storage.sql.exec('INSERT OR REPLACE INTO room_games (room, state, due) VALUES (?, ?, ?)', room, JSON.stringify(game), Math.min(nextDeadline(game), game.emptyAt ? game.emptyAt + 120_000 : Infinity));
    }
    members(room, except) {
        return this.sockets(room).filter(ws => ws !== except).map(ws => {
            const p = ws.deserializeAttachment(); return { id: p.userId, name: p.name };
        });
    }
    publishGame(room, game, target) {
        for (const ws of target ? [target] : this.sockets(room)) {
            send(ws, 'game-state', { game: game ? view(game, ws.deserializeAttachment().userId) : null, serverNow: Date.now() });
        }
    }
    async scheduleState() {
        const gameDue = this.ctx.storage.sql.exec('SELECT MIN(due) AS due FROM room_games').toArray()[0]?.due;
        const focusDueAt = this.ctx.storage.sql.exec('SELECT MIN(due) AS due FROM room_focus').toArray()[0]?.due;
        const due = Math.min(gameDue ?? Infinity, focusDueAt ?? Infinity);
        if (Number.isFinite(due)) await this.ctx.storage.setAlarm(Math.max(Date.now() + 25, due));
        else await this.ctx.storage.deleteAlarm();
    }
    async alarm() {
        const now = Date.now();
        const rows = this.ctx.storage.sql.exec('SELECT room, state FROM room_games WHERE due <= ?', now).toArray();
        for (const row of rows) {
            let game = JSON.parse(row.state);
            if (game.cleanupAt <= now || game.emptyAt && game.emptyAt + 120_000 <= now) game = null;
            else advance(game, now);
            this.saveGame(row.room, game); this.publishGame(row.room, game);
        }
        const focusRows = this.ctx.storage.sql.exec('SELECT room, state FROM room_focus WHERE due <= ?', now).toArray();
        for (const row of focusRows) {
            let focus = JSON.parse(row.state);
            if (focus.phase === 'done' && focus.updatedAt + 24 * 60 * 60_000 <= now || focus.emptyAt && focus.emptyAt + 10 * 60_000 <= now) focus = null;
            else advanceFocus(focus, now);
            this.saveFocus(row.room, focus); this.publishFocus(row.room, focus);
        }
        await this.scheduleState();
    }
    async gameMessage(ws, state, event, data) {
        const room = state.roomId, now = Date.now();
        let game = this.game(room);
        if (game && (game.cleanupAt <= now || game.phase === 'finished' && !game.players.some(p => p.online && p.active))) { this.saveGame(room, null); game = null; }
        const info = { id: state.userId, name: state.name };
        try {
            if (event === 'game-get') { this.publishGame(room, game, ws); return; }
            const rate = state.gameRate && now - state.gameRate.at < 1000 ? state.gameRate : { at: now, count: 0 };
            rate.count++; ws.serializeAttachment({ ...ws.deserializeAttachment(), gameRate: rate });
            if (rate.count > 24) return;
            let result = {};
            if (event === 'game-create') {
                if (game) { this.publishGame(room, game, ws); throw new Error('A game is already open. Join it from Activities.'); }
                game = createGame(data.kind, info, { pace: data.pace }, now);
            } else {
                if (!game) throw new Error('This game has ended. Open a new one.');
                result = act(game, info, data.action, data, now);
                if (result.close) game = null;
            }
            if (result.unchanged) return;
            this.saveGame(room, game);
            if (result.stroke) this.broadcast(room, 'game-stroke', { gameId: game.id, round: game.round, stroke: result.stroke });
            else this.publishGame(room, game);
            if (result.reaction) this.broadcast(room, 'game-reaction', result.reaction);
            if (result.invite) this.broadcast(room, 'game-invite', { from: state.name, kind: game.kind });
            await this.scheduleState();
        } catch (error) { send(ws, 'game-error', { message: error.message }); }
    }

    async fetch(request) {
        if (new URL(request.url).pathname === '/feedback' && request.method === 'POST') return this.feedback(request);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
            return new Response('WebSocket required', { status: 426 });
        }
        const [client, server] = Object.values(new WebSocketPair());
        const socketId = crypto.randomUUID();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ socketId, roomId: null, ip: request.headers.get('CF-Connecting-IP') || 'unknown' });
        send(server, 'connected', { socketId });
        return new Response(null, { status: 101, webSocket: client });
    }

    sockets(roomId) {
        return this.ctx.getWebSockets().filter(ws =>
            ws.readyState === WebSocket.OPEN && ws.deserializeAttachment()?.roomId === roomId
        );
    }

    broadcast(roomId, event, data, except) {
        for (const ws of this.sockets(roomId)) if (ws !== except) send(ws, event, data);
    }

    async webSocketMessage(ws, raw) {
        if (typeof raw !== 'string' || raw.length > 600_000) return;
        let message;
        try { message = JSON.parse(raw); } catch (_) { return; }
        const { event, data = {}, id } = message || {};
        const state = ws.deserializeAttachment();
        if (!state || typeof event !== 'string' || !data || typeof data !== 'object' || Array.isArray(data)) return;

        if (event === 'join-room') {
            if (state.roomId || state.joining) return;
            const { name, level, privateRoomCode } = data || {};
            const normalizedLevel = LEGACY_LEVELS[level] || level;
            if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20 ||
                !/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/.test(name) || !LEVELS.has(normalizedLevel)) {
                send(ws, 'error', { message: 'Invalid name or study level' });
                return;
            }
            if (privateRoomCode && !/^\d{6}$/.test(privateRoomCode)) {
                send(ws, 'error', { message: 'Invalid room code' });
                return;
            }
            ws.serializeAttachment({ ...state, joining: true });
            const token = typeof data.memberToken === 'string' && /^[a-f0-9-]{32,80}$/i.test(data.memberToken) ? data.memberToken : state.socketId;
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
            const userId = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,'0')).join('');
            if (ws.readyState !== WebSocket.OPEN) return;
            let roomId;
            const resume = typeof data.resumeRoom === 'string' && /^public-[a-f0-9-]{36}$/.test(data.resumeRoom) ? data.resumeRoom : null;
            const priorGame = resume ? this.game(resume) : null;
            if (!privateRoomCode && priorGame?.players.some(p => p.id === userId && p.active)) roomId = resume;
            else if (privateRoomCode) roomId = `private-${privateRoomCode}`;
            else {
                const counts = new Map();
                for (const peer of this.ctx.getWebSockets()) {
                    const peerRoom = peer.deserializeAttachment()?.roomId;
                    if (peer.readyState === WebSocket.OPEN && peerRoom?.startsWith('public-')) counts.set(peerRoom, (counts.get(peerRoom) || 0) + 1);
                }
                roomId = [...counts].find(([, count]) => count < MAX_ROOM_SIZE)?.[0] || `public-${crypto.randomUUID()}`;
            }
            const existing = this.sockets(roomId);
            if (existing.length >= MAX_ROOM_SIZE) {
                ws.serializeAttachment({ ...state, joining: false });
                send(ws, 'error', { message: 'The room is full' });
                return;
            }
            const user = {
                socketId: state.socketId, peerId: state.socketId,
                userId,
                name: name.trim(), level: normalizedLevel, joinedAt: Date.now()
            };
            ws.serializeAttachment({ ...state, ...user, roomId, mediaState: { cam: true } });
            const users = [...existing, ws].map(peer => {
                const p = peer.deserializeAttachment();
                return { socketId: p.socketId, peerId: p.socketId, userId: p.userId, name: p.name, level: p.level, joinedAt: p.joinedAt };
            });
            const userStates = [...existing, ws].map(peer => {
                const p = peer.deserializeAttachment();
                return { peerId: p.socketId, state: p.mediaState || {} };
            });
            const screenShares = existing.map(peer => peer.deserializeAttachment()).filter(p => p.screenStreamId)
                .map(p => ({ peerId: p.socketId, streamId: p.screenStreamId }));
            send(ws, 'room-joined', { roomId, users, yourPeerId: state.socketId, userStates, screenShares });
            send(ws, 'media-state', { ...this.media(roomId), serverNow: Date.now() });
            let focus = this.focus(roomId);
            if (focus) {
                delete focus.emptyAt;
                advanceFocus(focus);
                this.saveFocus(roomId, focus);
            }
            this.publishFocus(roomId, focus);
            this.broadcast(roomId, 'user-joined', user, ws);
            let game = this.game(roomId);
            if (game?.emptyAt && !game.players.some(p => p.id === userId)) game = null;
            if (game) { delete game.emptyAt; presence(game, this.members(roomId)); }
            this.saveGame(roomId, game); this.publishGame(roomId, game);
            await this.scheduleState();
            return;
        }

        if (!state.roomId) return;
        if (event === 'focus-control') { await this.focusMessage(ws, state, data); return; }
        if (['sound-play','watch-control','radio-control'].includes(event)) { await this.mediaMessage(ws, state, event, data); return; }
        if (['game-get','game-create','game-action'].includes(event)) { await this.gameMessage(ws, state, event, data); return; }
        if (event === 'request-ice-servers') {
            const ice = await this.iceServers(ws, state);
            send(ws, 'ack', ice, id);
            return;
        }
        if (event === 'signal') {
            const target = this.sockets(state.roomId).find(peer => peer.deserializeAttachment()?.socketId === data?.to);
            if (target && data?.signal) send(target, 'signal', { from: state.socketId, signal: data.signal });
            return;
        }
        if (event === 'chat-message') {
            if (data.roomId !== state.roomId || typeof data.message !== 'string') return;
            const text = data.message.trim().slice(0, 1000);
            if (text) this.broadcast(state.roomId, 'chat-message', {
                from: state.name, userId: state.userId, message: text, timestamp: Date.now()
            });
            return;
        }
        if (event === 'state-change') {
            if (data.roomId !== state.roomId || !data.state || typeof data.state !== 'object') return;
            const mediaState = { ...state.mediaState };
            for (const key of ['cam', 'mic', 'sound']) if (typeof data.state[key] === 'boolean') mediaState[key] = data.state[key];
            ws.serializeAttachment({ ...state, mediaState });
            this.broadcast(state.roomId, 'state-change', { peerId: state.socketId, state: mediaState });
            return;
        }
        if (event === 'screen-share-started' && typeof data?.streamId === 'string' && data.streamId.length <= 120) {
            if (this.sockets(state.roomId).some(peer => peer !== ws && peer.deserializeAttachment()?.screenStreamId)) {
                send(ws, 'screen-share-denied', { message: 'Someone is already sharing their screen in this room' });
                return;
            }
            ws.serializeAttachment({ ...state, screenStreamId: data.streamId });
            this.broadcast(state.roomId, 'screen-share-started', { peerId: state.socketId, streamId: data.streamId }, ws);
            return;
        }
        if (event === 'screen-share-stopped') {
            ws.serializeAttachment({ ...state, screenStreamId: null });
            this.broadcast(state.roomId, 'screen-share-stopped', { peerId: state.socketId }, ws);
            return;
        }
    }

    async iceServers(ws, state) {
        const now = Date.now();
        if (state.cachedIce && state.iceExpiresAt > now) return state.cachedIce;
        let result = { iceServers: STUN, turnEnabled: false };
        if (this.env.TURN_KEY_ID && this.env.TURN_KEY_API_TOKEN) {
            try {
                const response = await fetch(
                    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(this.env.TURN_KEY_ID)}/credentials/generate-ice-servers`,
                    { method: 'POST', headers: {
                        Authorization: `Bearer ${this.env.TURN_KEY_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    }, body: JSON.stringify({ ttl: 7200 }), signal: AbortSignal.timeout(7000) }
                );
                if (!response.ok) throw new Error(`TURN HTTP ${response.status}`);
                const body = await response.json();
                if (!Array.isArray(body.iceServers)) throw new Error('Invalid TURN response');
                result = { iceServers: body.iceServers, turnEnabled: true };
            } catch (error) { console.error('Cloudflare TURN unavailable', error.message); }
        }
        ws.serializeAttachment({ ...ws.deserializeAttachment(), cachedIce: result, iceExpiresAt: now + 60 * 60 * 1000 });
        return result;
    }

    async webSocketClose(ws, code, reason) {
        const state = ws.deserializeAttachment();
        if (state?.roomId) {
            this.broadcast(state.roomId, 'user-left', {
                socketId: state.socketId, peerId: state.socketId, userId: state.userId
            }, ws);
            const game = this.game(state.roomId);
            const members = this.members(state.roomId, ws);
            if (game) {
                presence(game, members);
                if (!members.length) game.emptyAt = Date.now();
                this.saveGame(state.roomId, game); this.publishGame(state.roomId, game);
            }
            const focus = this.focus(state.roomId);
            if (focus) {
                if (!members.length) focus.emptyAt = Date.now();
                else if (focus.ownerId === state.userId && !members.some(member => member.id === state.userId)) {
                    focus.ownerId = members[0].id; focus.ownerName = members[0].name;
                    focus.revision++; focus.transition = 'host'; focus.updatedAt = Date.now();
                }
                this.saveFocus(state.roomId, focus); this.publishFocus(state.roomId, focus);
            }
            if (game || focus) await this.scheduleState();
        }
        try { ws.close(code, reason); } catch (_) {}
    }

    async webSocketError(ws) {
        await this.webSocketClose(ws, 1011, 'Connection interrupted');
    }
}

export default {
    async fetch(request, env) {
        const path = new URL(request.url).pathname;
        if (path === '/health') return Response.json({ status: 'ok', service: 'kerne-rooms' });
        if (path === '/feedback') {
            const origin = request.headers.get('Origin');
            if (!isAllowedOrigin(origin)) return new Response('Forbidden origin', { status: 403 });
            if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '3600', 'Vary': 'Origin' } });
            if (request.method !== 'POST' || request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return new Response('Invalid request', { status: 405 });
            return env.ROOMS.get(env.ROOMS.idFromName('kerne-global')).fetch(request);
        }
        if (path !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Not found', { status: 404 });
        if (!isAllowedOrigin(request.headers.get('Origin'))) return new Response('Forbidden origin', { status: 403 });
        return env.ROOMS.get(env.ROOMS.idFromName('kerne-global')).fetch(request);
    }
};
