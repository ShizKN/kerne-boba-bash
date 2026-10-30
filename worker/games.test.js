import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, advance, presence, view, nextDeadline } from './games.js';

const alice = { id: 'alice', name: 'Alice' }, bob = { id: 'bob', name: 'Bob' }, cara = { id: 'cara', name: 'Cara' };
const command = (g, p, action, data = {}, now = 1000) => act(g,p,action,{ gameId:g.id,round:g.round,...data },now);
function started(kind, players = [alice,bob]) {
    const g = createGame(kind,alice,{pace:'quick'},1000);
    for (const p of players.slice(1)) { command(g,p,'join'); command(g,p,'ready',{ready:true}); }
    command(g,alice,'start'); return g;
}
function choose(g, now = 1100) { const artist = g.players.find(p=>p.id===g.artistId); command(g,artist,'choose',{index:0},now); return artist; }

test('lobby requires two ready players and only the host can start', () => {
    const g = createGame('sketch',alice,{},1000);
    assert.throws(()=>command(g,alice,'start'),/two|2/i);
    command(g,bob,'join'); assert.throws(()=>command(g,bob,'start'),/host/i);
    assert.throws(()=>command(g,alice,'start'),/ready/i);
    command(g,bob,'ready',{ready:true}); command(g,alice,'start'); assert.equal(g.phase,'choose');
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
    assert.equal(g.phase,'lobby'); assert.equal(g.players[0].score,0); assert.equal(g.players[1].ready,false);
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
