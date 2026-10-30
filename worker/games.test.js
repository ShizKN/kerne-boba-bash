import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, advance, presence, view, nextDeadline } from './games.js';
import { startFocus, advanceFocus, controlFocus, focusDue } from './focus.js';

const alice = { id: 'alice', name: 'Alice' }, bob = { id: 'bob', name: 'Bob' }, cara = { id: 'cara', name: 'Cara' };
const command = (g, p, action, data = {}, now = 1000) => act(g,p,action,{ gameId:g.id,round:g.round,...data },now);
function started(kind, players = [alice,bob]) {
    const g = createGame(kind,alice,{pace:'quick'},1000);
    for (const p of players.slice(1)) command(g,p,'join');
    command(g,alice,'start'); return g;
}
function choose(g, now = 1100) { const artist = g.players.find(p=>p.id===g.artistId); command(g,artist,'choose',{index:0},now); return artist; }

test('joining is enough to play, and only the host can start a friends match', () => {
    const g = createGame('sketch',alice,{},1000);
    assert.throws(()=>command(g,alice,'start'),/more player/i);
    command(g,bob,'join'); assert.throws(()=>command(g,bob,'start'),/host/i);
    command(g,alice,'start'); assert.equal(g.phase,'choose');
});
test('secret words and word choices never reach a guesser or a spectator', () => {
    const g=started('sketch'); const artist=g.players.find(p=>p.id===g.artistId);
    const other=g.players.find(p=>p.id!==g.artistId);
    assert.equal(view(g,artist.id,1000).word.choices.length,3);
    assert.equal(view(g,other.id,1000).word.choices,undefined);
    choose(g); const serialized=JSON.stringify(view(g,other.id,1200));
    assert.ok(!serialized.includes(g.secret.answer));
    assert.equal(view(g,'spectator',1200).word.answer,undefined);
    assert.equal(view(g,artist.id,1200).word.answer,g.secret.answer);
});
test('a correct guess scores once, rewards artist and reveals only at round end', () => {
    const g=started('sketch',[alice,bob,cara]); const artist=choose(g);
    const other=g.players.find(p=>p.id!==artist.id);
    command(g,other,'guess',{text:g.secret.answer.toUpperCase()},1200);
    assert.ok(other.score>=100); assert.equal(artist.score,75);
    const score=other.score; assert.throws(()=>command(g,other,'guess',{text:g.secret.answer},1300),/already/i);
    assert.equal(other.score,score); assert.equal(g.phase,'draw');
    advance(g,g.deadline); assert.equal(g.phase,'reveal'); assert.equal(view(g,other.id,g.deadline).word.answer,g.secret.answer);
});
test('only the artist can draw, and stale-round strokes cannot affect the next canvas', () => {
    const g=started('sketch'); const artist=choose(g); const other=g.players.find(p=>p.id!==artist.id);
    const stroke={id:'stroke-one',points:[{x:.1,y:.2},{x:.3,y:.4}],color:'#1a1a1a',width:4};
    assert.throws(()=>command(g,other,'draw',{stroke},1200),/artist/i);
    command(g,artist,'draw',{stroke},1200); command(g,artist,'draw',{stroke},1210);
    assert.equal(g.strokes.length,1);
    assert.throws(()=>command(g,artist,'draw',{stroke:{...stroke,id:'bad',points:[{x:Infinity,y:0}]}},1300),/stroke/i);
    assert.throws(()=>command(g,artist,'draw',{round:99,stroke},1300),/round/i);
    assert.equal(view(g,other.id,1400).strokes.length,1);
});
test('server deadlines choose a word, reveal hints, finish rounds and finish a full match', () => {
    const g=started('sketch'); advance(g,nextDeadline(g)); assert.equal(g.phase,'draw');
    const initial=view(g,bob.id,g.startedAt).word.mask;
    advance(g,nextDeadline(g)); assert.notEqual(view(g,bob.id,g.startedAt+20000).word.mask,initial);
    let guard=0; while(g.phase!=='finished' && guard++<30) advance(g,nextDeadline(g));
    assert.equal(g.phase,'finished'); assert.equal(g.round,g.totalRounds);
});
test('bluffs stay private, voting hides authors, and players cannot vote for themselves', () => {
    const g=started('bluff',[alice,bob,cara]);
    command(g,alice,'submit',{text:'A suspicious pineapple'}); command(g,bob,'submit',{text:'Seven invisible hats'});
    assert.equal(view(g,cara.id,1000).options.length,0);
    assert.ok(!JSON.stringify(view(g,cara.id,1000)).includes('suspicious pineapple'));
    command(g,cara,'submit',{text:'A very tired duck'}); assert.equal(g.phase,'vote');
    const own=view(g,alice.id,1100).ownOptionId;
    assert.throws(()=>command(g,alice,'vote',{optionId:own},1200),/own/i);
    const options=view(g,alice.id,1100).options;
    assert.ok(options.every(o=>!('authors' in o)&&!('isAnswer' in o)));
    assert.throws(()=>command(g,alice,'vote',{optionId:'forged'},1200),/option/i);
});
test('bluff votes award server scores once and reveal the real authors', () => {
    const g=started('bluff',[alice,bob,cara]);
    command(g,alice,'submit',{text:'An academic potato'}); command(g,bob,'submit',{text:'Ten little robots'}); command(g,cara,'submit',{text:'A flying sandwich'});
    const aliceOption=view(g,alice.id,1100).ownOptionId;
    const truth=g.secret.options.find(o=>o.isAnswer).id;
    command(g,bob,'vote',{optionId:aliceOption},1200);
    assert.throws(()=>command(g,bob,'vote',{optionId:truth},1300),/already/i);
    command(g,cara,'vote',{optionId:truth},1400); command(g,alice,'vote',{optionId:truth},1500);
    assert.equal(g.phase,'reveal'); assert.equal(g.players.find(p=>p.id===alice.id).score,350);
    assert.equal(g.players.find(p=>p.id===cara.id).score,200);
    assert.equal(view(g,bob.id,1500).options.find(o=>o.id===aliceOption).authors[0],'Alice');
    advance(g,1600); assert.equal(g.players.find(p=>p.id===alice.id).score,350);
});
test('missing bluffs and votes time out without stalling the room', () => {
    const g=started('bluff'); command(g,alice,'submit',{text:'A polite volcano'});
    advance(g,g.deadline); assert.equal(g.phase,'vote'); assert.ok(g.secret.options.length>=3);
    advance(g,g.deadline); assert.equal(g.phase,'reveal');
    advance(g,g.deadline); assert.equal(g.phase,'write');
});
test('disconnect pauses and preserves identity, host migrates, reconnect resumes', () => {
    const g=started('sketch'); choose(g); const remaining=g.deadline-2000;
    presence(g,[bob],2000); assert.equal(g.phase,'paused'); assert.equal(g.hostId,bob.id);
    presence(g,[alice,bob],4000); assert.equal(g.phase,'draw'); assert.equal(g.deadline,4000+remaining);
    presence(g,[],5000); advance(g,g.deadline); assert.equal(g.phase,'finished');
});
test('outsiders, duplicate bluffs and forged scores are rejected without changing scores', () => {
    const g=started('bluff');
    assert.throws(()=>command(g,cara,'submit',{text:'Nope',score:100000}),/join|player|spectator/i);
    command(g,alice,'submit',{text:'A glittery stapler'});
    assert.throws(()=>command(g,bob,'submit',{text:'A glittery stapler'}),/different|already/i);
    assert.throws(()=>command(g,bob,'submit',{text:'x'.repeat(1000)}),/80|long/i);
    assert.equal(g.players[0].score,0);
    assert.throws(()=>command(g,bob,'start',{gameId:'other'}),/match/i);
});
test('rematch resets scores and readiness, reactions and duck egg never grant points', () => {
    const g=started('bluff'); command(g,alice,'egg'); command(g,alice,'egg');
    assert.equal(g.players[0].score,0); assert.equal(g.players[0].badges.filter(b=>b==='Duck detective').length,1);
    g.phase='finished'; g.players[0].score=999; command(g,alice,'rematch');
    assert.equal(g.phase,'lobby'); assert.equal(g.players[0].score,0); assert.equal(g.players[1].ready,true);
});
test('Block Riot gives each player a playable board and scores only validated clusters', () => {
    const g=started('blocks');
    assert.equal(g.phase,'blocks');
    const own=[...view(g,alice.id,1000).boards[alice.id]];
    assert.equal(own.length,36);
    assert.deepEqual(own,view(g,bob.id,1000).boards[bob.id]);
    const neighbor=i=>[i%6?i-1:-1,i%6<5?i+1:-1,i>=6?i-6:-1,i<30?i+6:-1].filter(v=>v>=0);
    const index=own.findIndex((color,i)=>neighbor(i).some(j=>own[j]===color));
    assert.ok(index>=0);
    assert.throws(()=>command(g,alice,'pop',{index:99}),/tile|cluster/i);
    assert.throws(()=>command(g,cara,'pop',{index}),/join|player|spectator/i);
    command(g,alice,'pop',{index},1200);
    assert.ok(g.players[0].score>=40);
    assert.equal(g.players[1].score,0);
    assert.notDeepEqual(view(g,alice.id,1200).boards[alice.id],own);
    assert.throws(()=>command(g,alice,'pop',{index},1250),/wait|fast/i);
    advance(g,g.deadline); assert.equal(g.phase,'finished');
    assert.equal(view(g,bob.id,g.deadline).boards[alice.id].length,36);
});
test('room focus timer runs one block or repeats with every fourth long break', () => {
    const once=startFocus(alice,{workMinutes:25,breakMinutes:5,longBreakMinutes:15,mode:'once'},1000);
    assert.equal(focusDue(once),1000+25*60_000);
    assert.equal(advanceFocus(once,once.deadline-1),false);
    assert.equal(advanceFocus(once,once.deadline),true);
    assert.equal(once.phase,'done'); assert.equal(once.completedCycles,1);
    const repeat=startFocus(alice,{workMinutes:1,breakMinutes:1,longBreakMinutes:3,mode:'repeat'},1000);
    for(let i=1;i<=4;i++){
        advanceFocus(repeat,repeat.deadline);assert.equal(repeat.phase,i===4?'longBreak':'break');
        if(i<4){advanceFocus(repeat,repeat.deadline);assert.equal(repeat.phase,'work');}
    }
    assert.equal(repeat.completedCycles,4);assert.equal(repeat.cycle,4);
});
test('room focus timer validates settings, owner controls, pause, takeover and expiry', () => {
    assert.throws(()=>startFocus(alice,{workMinutes:0,breakMinutes:5,longBreakMinutes:15,mode:'once'},1000),/1–180/);
    const f=startFocus(alice,{workMinutes:25,breakMinutes:5,longBreakMinutes:15,mode:'repeat'},1000);
    assert.throws(()=>controlFocus(f,bob,'pause',{},[alice,bob],2000),/host/);
    controlFocus(f,alice,'pause',{},[alice,bob],2000);assert.equal(f.remainingMs,25*60_000-1000);assert.equal(focusDue(f),f.expiresAt);
    assert.equal(advanceFocus(f,1000+25*60_000),false);
    controlFocus(f,bob,'resume',{},[bob],3000);assert.equal(f.ownerId,bob.id);assert.equal(f.deadline,3000+25*60_000-1000);
    controlFocus(f,bob,'skip',{},[bob],6000);assert.equal(f.phase,'break');
    assert.throws(()=>controlFocus(f,bob,'skip',{},[bob],6500),/Wait/);
    assert.equal(advanceFocus(f,f.expiresAt),true);assert.equal(f.phase,'done');
});
test('solo bots stay server-owned and play all three games', () => {
    for(const kind of ['sketch','bluff','blocks']) {
        const g=createGame(kind,alice,{pace:'quick',solo:true},1000);
        assert.equal(g.players.filter(p=>p.bot).length,2);
        assert.equal(view(g,alice.id).solo,true);
        assert.throws(()=>command(g,bob,'solo'),/Join|player|Spectator/i);
        if(kind==='sketch') {
            assert.equal(g.artistId,alice.id);choose(g,1100);
            for(let i=0;i<2;i++)command(g,alice,'draw',{stroke:{id:`solo-${i}`,color:'#1a1a1a',width:5,points:[{x:.1+i*.1,y:.2},{x:.3+i*.1,y:.4}]}},1200+i);
            advance(g,g.botNextAt);assert.ok(g.feed.some(item=>item.text.includes('Mochi')));
            while(g.phase==='draw'&&g.botNextAt&&g.botNextAt<g.deadline)advance(g,g.botNextAt);
            assert.ok(g.players.some(p=>p.bot&&p.score>0));
        } else if(kind==='bluff') {
            assert.equal(Object.keys(g.secret.submissions).length,2);
            command(g,alice,'submit',{text:'A spectacular pineapple'},1100);
            assert.equal(g.phase,'vote');assert.equal(Object.keys(g.secret.votes).length,2);
            const choice=g.secret.options.find(o=>o.isAnswer);command(g,alice,'vote',{optionId:choice.id},1200);
            assert.equal(g.phase,'reveal');
        } else {
            assert.equal(g.phase,'blocks');advance(g,g.botNextAt);
            assert.ok(g.players.filter(p=>p.bot).every(p=>p.score>0));
        }
        presence(g,[],3000);assert.equal(g.hostId,alice.id);
        assert.ok(g.players.filter(p=>p.bot).every(p=>p.online));
    }
});
test('solo rematch starts directly and discards previous round state', () => {
    const g=createGame('blocks',alice,{solo:true},1000),oldId=g.id;
    advance(g,g.deadline);assert.equal(g.phase,'finished');
    g.staleMarker='old';command(g,alice,'rematch',{},90000);
    assert.equal(g.phase,'blocks');assert.equal(g.players.filter(p=>p.bot).length,2);
    assert.notEqual(g.id,oldId);assert.equal(g.staleMarker,undefined);
    assert.ok(g.players.every(p=>p.score===0));
});
