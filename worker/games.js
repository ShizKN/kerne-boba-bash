// Pure, server-authoritative rules. Never send this internal state to a client.
const WORDS = [
    'rubber duck','sleepwalking','black hole','coffee break','time machine','flying carpet','brain freeze','paper airplane','banana peel','alarm clock',
    'secret handshake','cactus','moonwalk','invisible chair','snowball fight','rainbow','jellyfish','roller coaster','space hamster','disco ball',
    'couch potato','treasure map','dragon','bubble tea','detective','melting ice cream','ninja cat','haunted library','pirate ship','volcano',
    'hot air balloon','pizza planet','robot chef','sleepy astronaut','bookworm','magic trick','penguin','tornado','traffic jam','birthday cake',
    'headphones','sloth','fireworks','wizard','skateboard','lighthouse','astronaut','sandcastle','octopus','snowman','campfire','zip line',
    'tiny umbrella','racing snail','fancy potato','giant pencil','moon cheese','superhero','unicycle','ghost','backpack','bicycle','helicopter',
    'crocodile','honeybee','elephant','mermaid','telescope','chess','noodle soup','teddy bear','ice skates','meteor','popcorn','fountain',
    'origami','carnival','sushi','raincoat','waterfall','sleeping bag','rubik cube','pancakes','saxophone','dinosaur','flamingo','sandwich'
];
// Fictional world-building prompts, clearly labelled as such in the interface.
const BLUFFS = [
    ['At Moon University, the punishment for a late essay is…','Explaining Wi-Fi to a rock','A duel with a calculator','A strongly worded moonwalk'],
    ['The currency on Planet Procrastination is…','Tomorrow coins','Unopened emails','Slightly expired motivation'],
    ['The royal librarian keeps a dragon because…','It toasts overdue notices','It alphabetizes the clouds','It whispers spoilers'],
    ['To enter the Society of Suspicious Ducks, you must…','Quack in cursive','Bring a waterproof CV','Outstare a baguette'],
    ['The world’s least useful superhero can…','Hear a sandwich being judged','Teleport only one sock','Make printers feel guilty'],
    ['The official sport of Cloud Nine is…','Competitive overthinking','Synchronized napping','Extreme spreadsheeting'],
    ['The ghost in the school Wi-Fi wants…','A password with emotional depth','An ergonomic haunting chair','A degree in boo-logy'],
    ['The secret ingredient in midnight motivation soup is…','One achievable deadline','Freshly grated panic','Three tabs of optimism'],
    ['The robot principal banned umbrellas because…','They looked too much like escape plans','They were stealing the spotlight','The clouds complained'],
    ['On Tuesdays, the castle’s drawbridge accepts…','Compliments in exact change','Payment in dramatic sighs','A tiny handwritten apology'],
    ['The first law of the Sofa Kingdom is…','The remote chooses the ruler','No crumbs without representation','All naps are legally binding'],
    ['The astronaut’s pet cactus was fired for…','Being too down to earth','Leaking classified sunlight','Poking holes in the mission'],
    ['The wizard’s worst spell accidentally turns homework into…','More homework, but confident','A mildly disappointed sandwich','A spreadsheet with feelings'],
    ['The Ministry of Tiny Inconveniences invented…','The almost-long-enough charging cable','Automatic lowercase screaming','Reversible elevator music'],
    ['The vampire opened a bakery specializing in…','Pain au neck','Emotional support croutons','Gluten-free jump scares'],
    ['The alien exchange student’s biggest culture shock was…','We apologize to furniture','The moon is not a group project','Coffee is a personality'],
    ['The pirate’s treasure chest was full of…','Premium parking validation','Carefully folded plot twists','Collectible terms and conditions'],
    ['The museum’s most expensive invisible exhibit is…','The last ounce of group-project patience','An unopened Monday','A very shy masterpiece'],
    ['The talking elevator refuses to move unless you…','Admit you forgot why you came here','Rate its emotional journey','Tell it a ground-floor secret'],
    ['The penguin CEO’s business strategy is…','Stay cool and slide into new markets','Put every meeting on ice','Hire only well-dressed fish'],
    ['The dragon’s dating profile lists its love language as…','Acts of arson','Quality treasure','Words of intimidation'],
    ['The intergalactic exam allows one unusual aid…','A tiny coach who believes in you','An emotionally stable calculator','A handwritten permission to panic'],
    ['The sleepy detective solved the case by…','Sleeping on the evidence','Following a trail of yawns','Arresting the snooze button'],
    ['The time-travel agency’s cheapest destination is…','Five minutes before you forgot your keys','Last Tuesday, slightly to the left','The deadline you thought was next week'],
    ['The enchanted vending machine only sells…','Snacks with unfinished business','Diet existential dread','Lightly salted plot armor'],
    ['The giant pencil’s autobiography is titled…','I Have a Point','Graphite Expectations','My Life Was Mostly Drafts'],
    ['The island of Introvertia’s national anthem is…','A respectful moment of silence','Please leave it at the door','The sound of plans being cancelled'],
    ['The snail racing league’s biggest scandal involved…','Performance-enhancing lettuce','A suspiciously aerodynamic shell','An unlicensed motivational carrot'],
    ['The university’s emotional support robot keeps saying…','Have you tried believing and restarting?','Your feelings are in airplane mode','Confidence update available'],
    ['The moon’s complaint about Earth was…','Too many unsolicited tides','The neighbors keep launching things','All the good snacks have gravity']
];
const COLORS = new Set(['#1a1a1a','#e04b45','#e8b629','#3d9c70','#377dda','#9663c4','#ec83ad','#ffffff']);
const PHASES = new Set(['choose','draw','write','vote','blocks']);
const normal = value => String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const shuffled = values => { const out=[...values]; for(let i=out.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; } return out; };
const require = (condition,message) => { if(!condition) throw new Error(message); };
const online = game => game.players.filter(p=>p.online && p.active);
const badge = (player,text) => { if(!player.badges.includes(text)) player.badges.push(text); };
function feed(game,text,kind='note') { game.feed.push({id:crypto.randomUUID(),text,kind}); game.feed=game.feed.slice(-18); }
function award(player,amount) { player.score+=amount; player.roundScore+=amount; }
function player(info,host=false) { return {id:info.id,name:String(info.name).slice(0,20),score:0,roundScore:0,ready:host,online:true,active:true,badges:[],correct:0,fooled:0}; }
const blockColor = () => Math.floor(random()*5);
function blockBoard() {
    const board=Array.from({length:36},blockColor);
    if(!board.some((color,i)=>i%6<5&&board[i+1]===color || i<30&&board[i+6]===color)) board[1]=board[0];
    return board;
}
function blockGroup(board,start) {
    const color=board[start], found=new Set([start]), queue=[start];
    for(const i of queue) for(const j of [i%6?i-1:-1,i%6<5?i+1:-1,i>=6?i-6:-1,i<30?i+6:-1])
        if(j>=0&&!found.has(j)&&board[j]===color){found.add(j);queue.push(j);}
    return queue;
}
function popBlocks(game,p,index,now) {
    require(Number.isInteger(index)&&index>=0&&index<36,'Choose a valid tile.');
    require(!p.lastBlockAt||now-p.lastBlockAt>=120,'Wait a moment before popping again.');
    const board=p.board,group=blockGroup(board,index);
    require(group.length>=2,'Pick a cluster of at least two matching tiles.');
    const combo=p.lastBlockAt&&now-p.lastBlockAt<3500?Math.min(5,(p.combo||1)+1):1;
    const frenzy=game.deadline-now<=15_000?2:1,points=group.length*group.length*10*combo*frenzy;
    for(const i of group)board[i]=null;
    for(let col=0;col<6;col++){
        const kept=[];for(let row=5;row>=0;row--)if(board[row*6+col]!==null)kept.push(board[row*6+col]);
        for(let row=5;row>=0;row--)board[row*6+col]=kept[5-row]??blockColor();
    }
    p.lastBlockAt=now;p.combo=combo;award(p,points);
    if(combo>=4)badge(p,'Combo king');
    if(group.length>=10)badge(p,'Meteor magnet');
    game.blockLast={playerId:p.id,index,size:group.length,points,combo,at:now};
    feed(game,`${p.name} popped ${group.length} blocks${combo>1?` · ×${combo} combo`:''}!`,'correct');
}

export function createGame(kind,host,settings={},now=Date.now()) {
    require(['sketch','bluff','blocks'].includes(kind),'Choose a supported game.');
    return {id:crypto.randomUUID(),kind,hostId:host.id,phase:'lobby',pace:settings.pace==='classic'?'classic':'quick',players:[player(host,true)],round:0,totalRounds:0,deadline:null,cleanupAt:now+30*60_000,strokes:[],feed:[],used:[],secret:{},note:''};
}
function roundStart(game,now) {
    if(online(game).length<2) return finish(game,'Not enough players. Invite your friends for a rematch.',now);
    if(game.round>=game.totalRounds) return finish(game,'What a match. Same time next round?',now);
    game.round++; game.strokes=[]; game.feed=[]; game.note=''; game.lastReveal=null;
    game.players.forEach(p=>p.roundScore=0);
    game.secret={submissions:{},votes:{},guessed:{},hints:0,options:[]};
    if(game.kind==='blocks') {
        const sameBoard=blockBoard();
        for(const p of online(game)){p.board=[...sameBoard];p.combo=0;p.lastBlockAt=0;}
        game.blockLast=null;game.phase='blocks';game.deadline=now+(game.pace==='quick'?75_000:120_000);
        feed(game,'Pop matching clusters. Bigger chains score more. Last 15 seconds are double points.');
    } else if(game.kind==='sketch') {
        const order=game.turnOrder.filter(id=>online(game).some(p=>p.id===id));
        game.artistId=order[(game.round-1)%order.length];
        const available=WORDS.filter(w=>!game.used.includes(w));
        game.secret.choices=shuffled(available.length>=3?available:WORDS).slice(0,3);
        game.phase='choose'; game.deadline=now+12_000;
        feed(game,`${game.players.find(p=>p.id===game.artistId).name} is choosing a word.`);
    } else {
        const available=BLUFFS.map((_,i)=>i).filter(i=>!game.used.includes(i));
        const index=shuffled(available.length?available:BLUFFS.map((_,i)=>i))[0]; game.used.push(index);
        game.secret.card=BLUFFS[index]; game.secret.answer=BLUFFS[index][1]; game.prompt=BLUFFS[index][0];
        game.phase='write'; game.deadline=now+(game.pace==='quick'?35_000:50_000);
        feed(game,'Write a believable lie. Straight faces encouraged.');
    }
    game.startedAt=now;
}
function beginDrawing(game,index,now) {
    game.secret.answer=game.secret.choices[index]; game.used.push(game.secret.answer);
    game.secret.hintOrder=shuffled([...game.secret.answer].map((c,i)=>c===' '?null:i).filter(i=>i!==null));
    game.phase='draw'; game.startedAt=now; game.deadline=now+(game.pace==='quick'?45_000:60_000);
    feed(game,'Pens ready. Guess the drawing!');
}
function beginVoting(game,now) {
    const submissions=game.secret.submissions;
    const options=[{id:crypto.randomUUID(),text:game.secret.answer,isAnswer:true,authorId:null}];
    for(const p of game.players.filter(p=>p.active)) if(submissions[p.id]) options.push({id:crypto.randomUUID(),text:submissions[p.id],isAnswer:false,authorId:p.id});
    for(const text of game.secret.card.slice(2)) if(options.length<3 && !options.some(o=>normal(o.text)===normal(text))) options.push({id:crypto.randomUUID(),text,isAnswer:false,authorId:null});
    game.secret.options=shuffled(options); game.phase='vote'; game.deadline=now+25_000;
    feed(game,'One answer is on the secret card. The rest are bluffs.');
}
function reveal(game,note,now) {
    game.phase='reveal'; game.deadline=now+7_000; game.lastReveal={answer:game.secret.answer,note}; game.note=note;
}
function finishVoting(game,now) {
    for(const [voterId,optionId] of Object.entries(game.secret.votes)) {
        const option=game.secret.options.find(o=>o.id===optionId), voter=game.players.find(p=>p.id===voterId);
        if(!option||!voter) continue;
        if(option.isAnswer) { award(voter,200); voter.correct++; if(voter.correct>=3) badge(voter,'Truth radar'); }
        else if(option.authorId) { const author=game.players.find(p=>p.id===option.authorId); award(author,150); author.fooled++; if(author.fooled>=2) badge(author,'Poker face'); }
    }
    reveal(game,'Masks off. Here is who fooled whom.',now);
}
function finish(game,note,now) { game.phase='finished'; game.deadline=null; game.note=note; game.cleanupAt=now+30*60_000; }

export function nextDeadline(game) {
    const hint=game.phase==='draw' && game.secret.hints<2 ? game.startedAt+(game.secret.hints+1)*15_000 : Infinity;
    return Math.min(game.deadline??Infinity,hint,game.cleanupAt);
}
export function advance(game,now=Date.now()) {
    if(!game.deadline || now<nextDeadline(game)) return false;
    if(game.phase==='choose') beginDrawing(game,0,now);
    else if(game.phase==='draw') {
        if(now>=game.deadline) reveal(game,'Time! The secret word was…',now);
        else { game.secret.hints=Math.min(2,Math.floor((now-game.startedAt)/15_000)); feed(game,'A letter has been revealed.','hint'); }
    } else if(game.phase==='write') beginVoting(game,now);
    else if(game.phase==='vote') finishVoting(game,now);
    else if(game.phase==='reveal') roundStart(game,now);
    else if(game.phase==='blocks') finish(game,'The clock is out. The block champion is crowned!',now);
    else if(game.phase==='paused') finish(game,'A player could not reconnect. Your scores are safe here.',now);
    return true;
}
export function presence(game,members,now=Date.now()) {
    const before=JSON.stringify(game);
    for(const p of game.players) p.online=p.active && members.some(m=>m.id===p.id);
    if(!game.players.some(p=>p.id===game.hostId&&p.online)) {
        const host=online(game)[0]; if(host && host.id!==game.hostId) {game.hostId=host.id; feed(game,`${host.name} is now the host.`);}
    }
    const artistMissing=game.kind==='sketch'&&['choose','draw'].includes(game.phase)&&!online(game).some(p=>p.id===game.artistId);
    if((online(game).length<2||artistMissing)&&PHASES.has(game.phase)) {
        game.paused={phase:game.phase,remaining:Math.max(1,game.deadline-now),elapsed:now-game.startedAt};
        game.phase='paused'; game.deadline=now+30_000; game.note='Waiting for a player to reconnect…';
    } else if(game.phase==='paused'&&online(game).length>=2 && (game.kind!=='sketch'||!['choose','draw'].includes(game.paused.phase)||online(game).some(p=>p.id===game.artistId))) {
        game.phase=game.paused.phase; game.deadline=now+game.paused.remaining; game.startedAt=now-game.paused.elapsed; game.paused=null; game.note='';
    }
    return before!==JSON.stringify(game);
}
export function act(game,info,action,data={},now=Date.now()) {
    require(data.gameId===game.id,'This match has changed. Reopen Activities.');
    advance(game,now);
    let p=game.players.find(p=>p.id===info.id&&p.active);
    if(action==='join') {
        require(game.phase==='lobby','Join the next match. You can watch this one.');
        if(!p) { require(game.players.filter(p=>p.active).length<4,'This game is full.'); game.players.push(player(info)); }
        else p.online=true;
        return {};
    }
    require(p,'Join the game first. Spectators cannot play.');
    const host=()=>require(info.id===game.hostId,'Only the host can do that.');
    if(action==='ready') { require(game.phase==='lobby','The match has already started.'); require(typeof data.ready==='boolean','Choose a ready state.'); p.ready=data.ready; }
    else if(action==='settings') { host(); require(game.phase==='lobby','Settings are locked during a match.'); require(['quick','classic'].includes(data.pace),'Choose a supported pace.'); game.pace=data.pace; }
    else if(action==='start') {
        host(); require(game.phase==='lobby','The match has already started.');
        require(online(game).length>=2,'Invite at least two players to start.'); require(online(game).every(p=>p.ready),'Wait until everyone is ready.');
        game.turnOrder=online(game).map(p=>p.id); game.totalRounds=game.kind==='sketch'?game.turnOrder.length*(game.pace==='quick'?1:2):game.kind==='blocks'?1:(game.pace==='quick'?3:5);
        roundStart(game,now);
    } else if(action==='cancel') { host(); return {close:true}; }
    else if(action==='invite') { require(!game.lastInvite||now-game.lastInvite>=10_000,'The invitation is already on its way.'); game.lastInvite=now; return {invite:true}; }
    else if(action==='rematch') { host(); require(game.phase==='finished','Finish this match first.'); const next=createGame(game.kind,info,{pace:game.pace},now); next.players=online(game).map(v=>player(v,v.id===info.id)); Object.assign(game,next); }
    else if(action==='leave') {
        p.active=false; p.online=false;
        if(game.phase==='lobby') game.players=game.players.filter(v=>v.active);
        presence(game,game.players.filter(v=>v.online),now); if(!online(game).length) return {close:true};
    } else if(action==='egg') { badge(p,'Duck detective'); return {reaction:{playerId:p.id,emoji:'🦆'}}; }
    else if(action==='reaction') { require(['👏','😂','🔥','🦆'].includes(data.emoji),'Choose a supported reaction.'); require(!p.lastReaction||now-p.lastReaction>=1500,'Give the confetti a second.'); p.lastReaction=now; return {reaction:{playerId:p.id,emoji:data.emoji}}; }
    else {
        require(data.round===game.round,'That round is over.');
        if(action==='pop') { require(game.phase==='blocks','The block round is over.'); popBlocks(game,p,data.index,now); }
        else if(action==='choose') { require(game.phase==='choose','Word selection is over.'); require(p.id===game.artistId,'Only the artist can choose a word.'); require(Number.isInteger(data.index)&&data.index>=0&&data.index<3,'Choose one of the three words.'); beginDrawing(game,data.index,now); }
        else if(action==='draw'||action==='clear'||action==='undo') {
            require(game.phase==='draw','Wait for the drawing round.'); require(p.id===game.artistId,'Only the artist can draw.');
            if(action==='clear') game.strokes=[];
            else if(action==='undo') { const last=game.strokes.at(-1); if(last) game.strokes=game.strokes.filter(s=>(s.group||s.id)!==(last.group||last.id)); }
            else {
                const s=data.stroke;
                require(s&&typeof s.id==='string'&&/^[\w-]{1,80}$/.test(s.id)&&COLORS.has(s.color)&&Number.isFinite(s.width)&&s.width>=2&&s.width<=28&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=80&&s.points.every(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1),'Invalid drawing stroke.');
                if(game.strokes.some(v=>v.id===s.id)) return {unchanged:true};
                require(game.strokes.length<900,'Canvas full. Clear it to keep drawing.');
                const stroke={id:s.id,group:typeof s.group==='string'&&/^[\w-]{1,80}$/.test(s.group)?s.group:s.id,color:s.color,width:s.width,points:s.points.map(v=>({x:+v.x.toFixed(4),y:+v.y.toFixed(4)}))};
                require(JSON.stringify(game.strokes).length+JSON.stringify(stroke).length<350_000,'Canvas full. Clear it to keep drawing.');
                game.strokes.push(stroke); return {stroke};
            }
        } else if(action==='guess') {
            require(game.phase==='draw','The guessing round is over.'); require(p.id!==game.artistId,'The artist already knows the word.');
            require(!game.secret.guessed[p.id],'You already got this word.');
            const text=String(data.text||'').trim(); require(text.length>0&&text.length<=60,'Use 1–60 characters.');
            if(normal(text)==='quack') {badge(p,'Duck detective'); return {reaction:{playerId:p.id,emoji:'🦆'}};}
            if(normal(text)===normal(game.secret.answer)) {
                const first=Object.keys(game.secret.guessed).length===0; const seconds=(game.deadline-now)/1000;
                award(p,100+Math.round(200*seconds/(game.pace==='quick'?45:60))+(first?50:0));
                p.correct++; if(now-game.startedAt<10_000) badge(p,'Quick draw');
                const artist=game.players.find(v=>v.id===game.artistId); award(artist,75); game.secret.guessed[p.id]=now;
                feed(game,`${p.name} got it!`,'correct');
                if(online(game).filter(v=>v.id!==game.artistId).every(v=>game.secret.guessed[v.id])) { badge(artist,'Picture perfect'); reveal(game,'Everyone got it. A masterpiece!',now); }
            } else feed(game,`${p.name}: ${text}`,'guess');
        } else if(action==='submit') {
            require(game.phase==='write','Bluff writing is over.'); require(!game.secret.submissions[p.id],'Your bluff is already locked in.');
            const text=String(data.text||'').trim().replace(/\s+/g,' '); require(text.length>=2&&text.length<=80,'Write a bluff using 2–80 characters.');
            require(normal(text)!==normal(game.secret.answer)&&!Object.values(game.secret.submissions).some(v=>normal(v)===normal(text)),'That answer is already on a card. Try a different bluff.');
            game.secret.submissions[p.id]=text;
            if(online(game).every(v=>game.secret.submissions[v.id])) beginVoting(game,now);
        } else if(action==='vote') {
            require(game.phase==='vote','Voting is over.'); require(!game.secret.votes[p.id],'You already voted.');
            const option=game.secret.options.find(o=>o.id===data.optionId); require(option,'Choose an available option.'); require(option.authorId!==p.id,'You cannot vote for your own bluff.');
            game.secret.votes[p.id]=option.id; if(online(game).every(v=>game.secret.votes[v.id])) finishVoting(game,now);
        } else require(false,'Unsupported game action.');
    }
    game.cleanupAt=now+30*60_000;
    return {};
}
export function view(game,playerId,now=Date.now()) {
    const me=game.players.find(p=>p.id===playerId&&p.active), revealing=['reveal','finished'].includes(game.phase);
    const artist=playerId===game.artistId;
    const answer=game.secret.answer||'';
    const mask=[...answer].map((c,i)=>c===' '?'/':game.secret.hintOrder?.slice(0,game.secret.hints).includes(i)?c.toUpperCase():'_').join(' ');
    const visibleOptions=['vote','reveal','finished'].includes(game.phase)?game.secret.options||[]:[];
    return {
        id:game.id,kind:game.kind,phase:game.phase,hostId:game.hostId,pace:game.pace,round:game.round,totalRounds:game.totalRounds,deadline:game.deadline,serverNow:now,
        players:game.players.map(({id,name,score,roundScore,ready,online,active,badges})=>({id,name,score,roundScore,ready,online,active,badges})),
        artistId:game.artistId,word:game.kind==='sketch'?{mask,...((artist||revealing)&&answer?{answer}:{}),...(artist&&game.phase==='choose'?{choices:game.secret.choices}:{})}:{},
        prompt:game.kind==='bluff'?game.prompt:undefined,
        options:visibleOptions.map(o=>({id:o.id,text:o.text,...(revealing?{isAnswer:o.isAnswer,authors:o.authorId?[game.players.find(p=>p.id===o.authorId)?.name||'Player']:[],voters:Object.entries(game.secret.votes||{}).filter(([,id])=>id===o.id).map(([id])=>game.players.find(p=>p.id===id)?.name||'Player')}:{})})),
        ownOptionId:visibleOptions.find(o=>o.authorId===playerId)?.id,
        submitted:!!game.secret.submissions?.[playerId],submissionCount:Object.keys(game.secret.submissions||{}).length,
        mySubmission:game.secret.submissions?.[playerId],myVote:game.secret.votes?.[playerId],votedCount:Object.keys(game.secret.votes||{}).length,
        guessed:!!game.secret.guessed?.[playerId],isPlayer:!!me,strokes:game.kind==='sketch'?game.strokes:[],boards:game.kind==='blocks'?Object.fromEntries(game.players.filter(p=>p.board&&p.active).map(p=>[p.id,p.board])):undefined,blockLast:game.kind==='blocks'?game.blockLast:undefined,feed:game.feed,note:game.note,lastReveal:game.lastReveal||null
    };
}
