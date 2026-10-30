// Server-owned room timer. Absolute deadlines keep every device in step.
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const minute = 60_000;
const valid = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function startFocus(owner, data, now = Date.now()) {
    const { workMinutes, breakMinutes, longBreakMinutes, mode } = data;
    assert(valid(workMinutes, 1, 180), 'Focus time must be 1–180 minutes.');
    assert(valid(breakMinutes, 1, 60), 'Break time must be 1–60 minutes.');
    assert(valid(longBreakMinutes, 1, 90), 'Long break must be 1–90 minutes.');
    assert(mode === 'once' || mode === 'repeat', 'Choose a timer rhythm.');
    return { ownerId: owner.id, ownerName: owner.name, mode, workMinutes, breakMinutes, longBreakMinutes,
        phase: 'work', cycle: 1, completedCycles: 0, deadline: now + workMinutes * minute,
        remainingMs: null, paused: false, revision: 1, transition: 'start', startedAt: now,
        expiresAt: now + 24 * 60 * minute, updatedAt: now };
}

function nextPhase(focus, at) {
    if (focus.phase === 'work') {
        focus.completedCycles++;
        if (focus.mode === 'once') { focus.phase = 'done'; focus.deadline = null; }
        else {
            focus.phase = focus.completedCycles % 4 === 0 ? 'longBreak' : 'break';
            focus.deadline = at + (focus.phase === 'longBreak' ? focus.longBreakMinutes : focus.breakMinutes) * minute;
        }
    } else {
        focus.phase = 'work'; focus.cycle++; focus.deadline = at + focus.workMinutes * minute;
    }
    focus.remainingMs = null; focus.paused = false; focus.revision++; focus.transition = focus.phase; focus.updatedAt = at;
}

export function advanceFocus(focus, now = Date.now()) {
    if (!focus || focus.phase === 'done') return false;
    if (now >= focus.expiresAt) {
        focus.phase = 'done'; focus.deadline = null; focus.remainingMs = null; focus.paused = false;
        focus.revision++; focus.transition = 'expired'; focus.updatedAt = now; return true;
    }
    if (focus.paused || !focus.deadline || focus.deadline > now) return false;
    let changed = false, steps = 0;
    while (focus.deadline && focus.deadline <= now && steps++ < 32) {
        nextPhase(focus, focus.deadline); changed = true;
    }
    if (focus.deadline && focus.deadline <= now) {
        focus.phase = 'done'; focus.deadline = null; focus.revision++; focus.transition = 'expired'; focus.updatedAt = now;
    }
    return changed;
}

export function controlFocus(current, actor, action, data = {}, members = [], now = Date.now()) {
    if (action === 'start') {
        assert(!current || current.phase === 'done', 'Stop the current timer first.');
        return startFocus(actor, data, now);
    }
    assert(current, 'Start a room timer first.');
    if (current.ownerId !== actor.id) {
        assert(!members.some(member => member.id === current.ownerId), 'Only the timer host can change it.');
        current.ownerId = actor.id; current.ownerName = actor.name;
    }
    assert(action === 'stop' || current.phase !== 'done', 'Start a new timer.');
    if (action === 'stop') return null;
    if (action === 'pause') {
        assert(!current.paused, 'Timer is already paused.');
        current.remainingMs = Math.max(1, current.deadline - now); current.deadline = null; current.paused = true;
    } else if (action === 'resume') {
        assert(current.paused, 'Timer is already running.');
        current.deadline = now + current.remainingMs; current.remainingMs = null; current.paused = false;
    } else if (action === 'skip') {
        assert(!current.lastSkipAt || now - current.lastSkipAt >= 2000, 'Wait before skipping again.');
        current.lastSkipAt = now; nextPhase(current, now);
    } else throw new Error('Unsupported timer action.');
    if (action !== 'skip') { current.revision++; current.transition = action; }
    current.updatedAt = now;
    return current;
}

export function focusDue(focus) {
    if (!focus) return null;
    if (focus.phase === 'done') return focus.updatedAt + 24 * 60 * minute;
    return Math.min(focus.deadline ?? Infinity, focus.expiresAt, focus.emptyAt ? focus.emptyAt + 10 * minute : Infinity);
}
