/* Call activities: server-owned rules, touch-friendly presentation. */
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const NAMES = {sketch:'Sketch Rush',bluff:'Bluff Club',blocks:'Block Riot'};
    const ART = {
        sketch:'<svg viewBox="0 0 180 130" aria-hidden="true"><path d="M27 105 42 65 120 7l28 30-80 63z" fill="#ffef6b" stroke="currentColor" stroke-width="4"/><path d="m42 65 26 35-41 5 15-40m67-49 27 30" fill="none" stroke="currentColor" stroke-width="4"/><path d="m29 99 6-17 12 15z" fill="currentColor"/><path d="M94 106c18-28 36 28 66-5M16 27l8 8m131 27 12-3M68 9l-2 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
        bluff:'<svg viewBox="0 0 180 130" aria-hidden="true"><rect x="25" y="17" width="84" height="102" rx="9" transform="rotate(-14 25 17)" fill="#eee4ff" stroke="currentColor" stroke-width="4"/><rect x="66" y="9" width="84" height="107" rx="9" transform="rotate(9 66 9)" fill="#fff9e8" stroke="currentColor" stroke-width="4"/><path d="M92 48c1-15 28-17 28 1 0 11-16 11-16 25m0 11v1" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="m26 4-7 8m138 91 10 8" stroke="currentColor" stroke-width="4"/></svg>',
        blocks:'<svg viewBox="0 0 180 130" aria-hidden="true"><g stroke="#1b2720" stroke-width="3"><path d="m34 38 25-13 25 13-25 13z" fill="#ffd9a7"/><path d="m34 38 25 13v27L34 64z" fill="#ef7b54"/><path d="m59 51 25-13v26L59 78z" fill="#bd4f3e"/><path d="m90 57 25-13 25 13-25 13z" fill="#d0e7f0"/><path d="m90 57 25 13v27L90 83z" fill="#52add2"/><path d="m115 70 25-13v26l-25 14z" fill="#347b9e"/><path d="m61 83 25-13 25 13-25 13z" fill="#e6d5ff"/><path d="m61 83 25 13v27L61 109z" fill="#a47ed6"/><path d="m86 96 25-13v26l-25 14z" fill="#6c57ae"/></g><path d="m152 25 3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#ffef6b"/></svg>'
    };
    const PAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 7h10a4 4 0 0 1 4 3l1 7c.3 2-2 3-3.5 1.5L16 16H8l-2.5 2.5C4 20 1.7 19 2 17l1-7a4 4 0 0 1 4-3Z"/><path d="M7 9v6m-3-3h6"/><circle cx="16" cy="11" r=".8"/><circle cx="19" cy="14" r=".8"/></svg>';
    const RULES = {
        sketch:'Take turns drawing. Pick one of three secret words, then draw without letters or numbers. Guessers earn 100–300 points based on speed, with 50 extra for the first correct guess. The artist gets 75 points per correct guess. Two timed letter hints keep things moving.',
        bluff:'This is a completely fictional universe. Write a believable, ridiculous answer to a strange question. Then find the secret house answer among everyone’s bluffs. A correct vote earns 200 points. Every person fooled by your bluff earns you 150. You cannot vote for your own answer.',
        blocks:'Pop groups of at least two matching blocks on your own board. Everyone begins with the same layout. Bigger groups and fast combos score more; the last 15 seconds are worth double. The server checks every move and keeps the score.'
    };
    class Activities {
        constructor(manager) {
            this.manager=manager; this.socket=manager.socket; this.game=null; this.signature=''; this.pending=new Map(); this.color='#1a1a1a'; this.width=5; this.sound=false; this.offset=0; this.mode='games'; this.media={video:{id:'',playing:false,position:0,at:0},radio:{station:'off',at:0}};
            this.button=document.createElement('button'); this.button.className='control-btn'; this.button.id='activitiesBtn'; this.button.title='Activities'; this.button.setAttribute('aria-label','Activities'); this.button.innerHTML=PAD;
            document.querySelector('.controls').insertBefore(this.button,$('roomMore'));
            this.dialog=document.createElement('dialog'); this.dialog.id='activitiesDialog'; this.dialog.setAttribute('aria-labelledby','activityTitle');
            this.dialog.innerHTML=`<div class="a-shell"><header class="a-header"><button class="a-brand" id="activityBrand" aria-label="KERNE break room">K<span>THE BREAK ROOM</span></button><div class="a-header-actions"><button id="activityEndMobile" class="a-end-mobile" data-confirm-close aria-label="End game for everyone" hidden>End</button><button id="activitySound" class="a-icon" aria-label="Enable shared sounds" title="Shared sounds off">♪<span class="a-sound-slash">/</span></button><button id="activityClose" class="a-back">← <span>Call</span></button></div></header><nav class="a-nav" aria-label="Activities"><button class="a-mode" data-mode="games">Games</button><button class="a-mode" data-mode="together">Together</button><button class="a-mode" data-mode="focus">Focus timer</button></nav><div class="a-connection" id="activityConnection" hidden>Reconnecting… Your game will resume automatically.</div><div class="a-call-strip" id="activityCameras" aria-label="Call participants"></div><div class="a-topline"><div><p class="a-eyebrow" id="activityEyebrow">A WELL-EARNED BREAK</p><h1 id="activityTitle">A little friendly chaos.</h1></div><div class="a-clock" id="activityClock" hidden><span aria-hidden="true">◷</span><output id="activityTime" aria-live="off">00</output></div></div><div class="a-layout"><main id="activityContent" class="a-content"></main><aside id="activityScores" class="a-scores" aria-label="Live scores"></aside></div><footer class="a-footer"><span class="a-live"><i></i>Still in the call</span><div id="activityReactions" class="a-reaction-buttons" aria-label="Reactions"></div><button id="activityMic" class="a-small">Microphone</button></footer><div id="activityNotice" class="a-notice" role="status" aria-live="polite"></div><div id="activityConfetti" class="a-confetti" aria-hidden="true"></div></div>`;
            document.body.append(this.dialog);
            this.button.onclick=()=>this.open(); $('activityClose').onclick=()=>this.dialog.close();
            this.dialog.addEventListener('close',()=>{this.pointer=null;this.pending.clear();this.stopRadio();this.watchSilenceUntil=Date.now()+2000;this.player?.pauseVideo?.();});
            $('activityMic').onclick=()=>this.manager.toggleMic();
            $('activitySound').onclick=()=>{this.sound=!this.sound; $('activitySound').classList.toggle('sound-on',this.sound); $('activitySound').setAttribute('aria-label',this.sound?'Mute shared sounds':'Enable shared sounds'); if(this.sound){this.tone();this.startRadio();}else this.stopRadio();};
            $('activityBrand').onclick=()=>{this.eggTaps=(this.eggTaps||0)+1; if(this.eggTaps%5===0&&this.game?.isPlayer)this.send('egg');};
            this.dialog.addEventListener('click',event=>this.click(event));
            this.dialog.addEventListener('submit',event=>this.submit(event));
            this.socket.on('game-state',({game,serverNow})=>this.receive(game,serverNow));
            this.socket.on('focus-state',({focus,serverNow})=>this.receiveFocus(focus,serverNow));
            this.socket.on('focus-error',({message})=>this.notice(message,true));
            this.socket.on('game-stroke',message=>this.receiveStroke(message));
            this.socket.on('game-error',({message})=>{this.notice(message,true);this.pending.clear();this.pointer=null;this.socket.emit('game-get',{});});
            this.socket.on('game-reaction',({emoji,playerId})=>this.reaction(emoji,playerId));
            this.socket.on('game-invite',({from,kind})=>{if(!this.dialog.open){this.button.classList.add('has-notif');UI.showToast(`${from} invited you to ${NAMES[kind]||'play'}. Open Activities.`);}});
            this.socket.on('media-state',data=>{this.media={video:data.video,radio:data.radio};this.mediaOffset=(data.serverNow||Date.now())-Date.now();if(this.dialog.open&&this.mode==='together')this.updateTogether();if(this.sound)this.startRadio();});
            this.socket.on('sound-play',({id,from})=>{if(this.sound)this.playSfx(id);if(this.dialog.open&&this.mode==='together')this.notice(`${from} played ${id}`);});
            this.socket.on('disconnect',()=>{$('activityConnection').hidden=false;this.pointer=null;this.pending.clear();});
            this.socket.on('room-joined',()=>{this.socket.emit('game-get',{});this.socket.emit('focus-control',{action:'get'});$('activityConnection').hidden=true;});
            this.focusDock=document.createElement('button');this.focusDock.id='focusDock';this.focusDock.hidden=true;this.focusDock.setAttribute('aria-label','Open room focus timer');this.focusDock.onclick=()=>{this.mode='focus';this.open();};$('videoGrid').append(this.focusDock);
            this.timer=setInterval(()=>{this.tickFocus();if(this.dialog.open){this.tick();this.updateMic();}},250);
        }
        get me(){return this.game?.players.find(p=>p.id===this.manager.userId&&p.active);}
        get host(){return this.game?.hostId===this.manager.userId;}
        open(){if(!this.dialog.open)this.dialog.showModal();this.button.classList.remove('has-notif');this.signature='';this.render();this.refreshCameras();this.socket.emit('game-get',{});this.socket.emit('focus-control',{action:'get'});}
        send(action,data={}){
            if(!this.socket.connected){this.notice('The call is reconnecting. Try again in a moment.',true);return;}
            this.socket.emit('game-action',{action,gameId:this.game?.id,round:this.game?.round,...data});
        }
        notice(message,error=false){const n=$('activityNotice');n.textContent=message;n.className=`a-notice show${error?' is-error':''}`;clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>n.classList.remove('show'),4200);}
        receive(game,serverNow){
            const old=this.game;this.offset=(serverNow||Date.now())-Date.now();this.game=game;
            if(!game||game.id!==old?.id||game.round!==old?.round){this.pending.clear();this.pointer=null;}
            if(game&&game.id!==old?.id&&!this.dialog.open){this.button.classList.add('has-notif');UI.showToast(`${NAMES[game.kind]} is open. Join from Activities.`);}
            this.button.classList.toggle('active',!!game);
            if(this.dialog.open){this.render();if(game&&game.phase!==old?.phase){this.tone();if(game.phase==='finished')this.confetti();}}
        }
        render(){
            if(!this.dialog.open)return;
            this.dialog.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===this.mode)));
            if(this.mode==='together') {this.renderTogether();this.refreshCameras();this.updateMic();return;}
            if(this.mode==='focus') {this.renderFocus();this.refreshCameras();this.updateMic();return;}
            const g=this.game, content=$('activityContent');
            const titles={lobby:'Get the gang together.',choose:g?.artistId===this.manager.userId?'Your turn to draw.':'A masterpiece is loading.',draw:'What is it?',write:'Make something up.',vote:'Spot the secret answer.',blocks:'Pop. Combo. Repeat.',reveal:g?.kind==='sketch'?'The big reveal.':'Masks off.',finished:'Bragging rights, earned.',paused:'Hang tight, team.'};
            $('activityTitle').textContent=g?titles[g.phase]||NAMES[g.kind]:'A little friendly chaos.';
            $('activityEyebrow').textContent=g?`${NAMES[g.kind]}${g.phase==='lobby'?' / LOBBY':` / ROUND ${g.round} OF ${g.totalRounds}`}`:'A WELL-EARNED BREAK';
            $('activityClock').hidden=!g?.deadline;
            const mobileEnd=$('activityEndMobile');mobileEnd.hidden=!g||!this.host;
            if(mobileEnd.dataset.confirmed!=='yes')mobileEnd.textContent='End';
            const signature=g?`${g.id}:${g.phase}:${g.round}:${g.isPlayer}:${g.artistId===this.manager.userId}`:'home';
            if(signature!==this.signature){
                this.signature=signature;this.pointer=null;
                if(!g)content.innerHTML=this.home();
                else if(g.phase==='lobby')content.innerHTML=this.lobby();
                else if(g.phase==='choose')content.innerHTML=this.choose();
                else if(g.phase==='draw')content.innerHTML=this.drawing();
                else if(g.phase==='write')content.innerHTML=this.writing();
                else if(g.phase==='vote')content.innerHTML=this.voting();
                else if(g.phase==='blocks')content.innerHTML=this.blocks();
                else if(g.phase==='reveal')content.innerHTML=this.reveal();
                else if(g.phase==='finished')content.innerHTML=this.results();
                else content.innerHTML=`<div class="a-wait"><div class="a-orbit">↻</div><h2>A friend dropped out.</h2><p>We’re keeping the drawing and scores while they reconnect. The match resumes as soon as the team is back.</p><span class="a-tag">30-second reconnect window</span></div>`;
                if($('sketchCanvas'))this.bindCanvas();
                if($('bluffText'))$('bluffText').addEventListener('input',()=>{$('bluffCount').textContent=`${$('bluffText').value.length}/80`;});
            }
            this.updatePhase();this.renderScores();this.renderReactions();this.refreshCameras();this.tick();this.updateMic();
        }
        home(){return `<p class="a-intro">Your study group. A new kind of group project.<br>Pick a game, invite the call, and take five.</p><div class="a-game-grid"><button class="a-game-card sketch" data-create="sketch"><div class="a-game-art">${ART.sketch}</div><span class="a-tag">DRAW · GUESS · PANIC</span><h2>Sketch Rush<span>01</span></h2><p>One secret word. Questionable art.<br>Ridiculously good guesses.</p><div class="a-card-meta"><span>Solo vs bots or 2–4 friends · ~3–6 min</span><strong>Let’s draw ↗</strong></div></button><button class="a-game-card bluff" data-create="bluff"><div class="a-game-art">${ART.bluff}</div><span class="a-tag">LIE · VOTE · LAUGH</span><h2>Bluff Club<span>02</span></h2><p>Invent an answer. Keep a straight face.<br>Fool the entire call.</p><div class="a-card-meta"><span>Solo vs bots or 2–4 friends · ~4–7 min</span><strong>Deal me in ↗</strong></div></button><button class="a-game-card blocks" data-create="blocks"><div class="a-game-art">${ART.blocks}</div><span class="a-tag">POP · CHAIN · CLIMB</span><h2>Block Riot<span>03</span></h2><p>Break color clusters. Build wild combos.<br>Beat the clock and your friends.</p><div class="a-card-meta"><span>Solo vs bots or 2–4 friends · ~75 sec</span><strong>Start popping ↗</strong></div></button></div><div class="a-house-note"><span>✦</span><p>Made for a proper break. Your cameras and call audio keep going. Come back to the call whenever you like.</p></div>`;}
        lobby(){const g=this.game;return `<section class="a-lobby"><div class="a-lobby-art ${g.kind}">${ART[g.kind]}<span class="a-tag">${g.kind==='sketch'?'NO ART DEGREE REQUIRED':g.kind==='bluff'?'TRUST ISSUES INCLUDED':'PREPARE FOR BLOCK CHAOS'}</span></div><div class="a-lobby-body"><h2>${NAMES[g.kind]}</h2><p>${g.kind==='sketch'?'Turn your questionable doodles into a team sport.':g.kind==='bluff'?'Fake facts. Real poker faces. Best with 3–4 friends.':'Same board, same clock. Pop matching clusters faster than your friends.'}</p><div class="a-pace"><button data-pace="quick">Quick break<small>${g.kind==='sketch'?'1 turn each · 45s drawings':g.kind==='bluff'?'3 rounds · 35s to bluff':'75 seconds of chaos'}</small></button><button data-pace="classic">Stay a while<small>${g.kind==='sketch'?'2 turns each · 60s drawings':g.kind==='bluff'?'5 rounds · 50s to bluff':'2-minute block battle'}</small></button></div><div id="lobbyPlayers" class="a-lobby-players"></div><div id="lobbyActions" class="a-actions"></div><p class="a-hint">Everyone in this call has an invitation. No links, no accounts.</p></div></section><details class="a-rules"><summary>How to play & scoring</summary><p>${RULES[g.kind]}</p></details>`;}
        blocks(){return `<div class="a-block-intro"><div><span class="a-tag">SAME BOARD · DIFFERENT DESTINY</span><h2>Make a cluster disappear.</h2><p>Tap two or more matching cubes. Larger groups score big. Keep popping to multiply your combo.</p></div><div class="a-block-combo" id="blockCombo">×1<small>COMBO</small></div></div><div class="a-block-arena"><div class="a-block-board" id="blockBoard" role="group" aria-label="Your block board"></div><aside class="a-block-rivals"><strong>LIVE RIVALS</strong><div id="blockRivals"></div><p>Final 15 seconds: every pop scores double.</p></aside></div><div class="a-block-feed" id="blockFeed" aria-live="polite"></div>`;}
        choose(){const g=this.game;const artist=g.players.find(p=>p.id===g.artistId);return g.artistId===this.manager.userId?`<div class="a-choose"><p class="a-intro">Choose a secret word. Only you can see these.</p><div class="a-word-options">${(g.word.choices||[]).map((w,i)=>`<button data-word="${i}"><span>0${i+1}</span>${esc(w)}<small>${w.length} characters ↗</small></button>`).join('')}</div><p class="a-hint">Draw shapes, not letters. A word is picked automatically if time runs out.</p></div>`:`<div class="a-wait"><div class="a-wait-art">${ART.sketch}</div><h2>${esc(artist?.name||'The artist')} is picking a word.</h2><p>Warm up those wild guesses. The drawing will appear here.</p><span class="a-tag">PENCILS AT THE READY</span></div>`;}
        drawing(){const artist=this.game.artistId===this.manager.userId;return `<div class="a-sketch-head"><span class="a-tag" id="sketchRole"></span><strong id="sketchWord" class="a-secret"></strong></div><div class="a-ink-board" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Shared game drawing">Your browser needs Canvas to show drawings.</canvas></div>${artist?`<div class="a-draw-tools"><div class="a-palette" role="group" aria-label="Pen color">${['#1a1a1a','#e04b45','#e8b629','#3d9c70','#377dda','#9663c4','#ec83ad','#ffffff'].map((c,i)=>`<button data-color="${c}" style="--swatch:${c}" title="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}" aria-label="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}"></button>`).join('')}</div><button class="a-small" data-width="5">Fine</button><button class="a-small" data-width="14">Bold</button><button class="a-small" data-act="undo">↶ Undo</button><button class="a-small" data-act="clear">Clear</button></div>`:`<form class="a-form" data-form="guess"><input id="guessText" name="guess" autocomplete="off" maxlength="60" placeholder="What is it?" aria-label="Your guess"><button class="a-primary" type="submit">Guess ↗</button></form><p id="guessStatus" class="a-hint" aria-live="polite"></p>`}<div id="sketchFeed" class="a-feed" aria-live="polite" aria-relevant="additions text"></div>`;}
        writing(){const g=this.game;return `<div class="a-prompt"><span class="a-tag">FROM A COMPLETELY FICTIONAL UNIVERSE</span><h2>${esc(g.prompt)}</h2><span class="a-prompt-doodle" aria-hidden="true">✳</span></div>${g.isPlayer?`<form class="a-bluff-form" data-form="bluff"><label for="bluffText">Your most convincing nonsense</label><textarea id="bluffText" maxlength="80" rows="2" placeholder="Make them believe it…" required></textarea><div class="a-form-foot"><span id="bluffCount">0/80</span><button class="a-primary" type="submit" id="lockBluff">Lock my bluff ↗</button></div></form><div id="bluffLocked" class="a-locked" hidden><span>✓ LOCKED IN</span><p id="myBluff"></p><small>Now practice your innocent face.</small></div>`:`<p class="a-spectator">You’re watching this match. You can join the next one.</p>`}<div class="a-submission-progress"><div><span id="submissionLabel"></span><span>✍</span></div><progress id="submissionProgress" max="4" value="0"></progress></div>`;}
        voting(){const g=this.game;return `<div class="a-prompt compact"><span class="a-tag">ONE SECRET HOUSE ANSWER. EVERYONE ELSE IS BLUFFING.</span><h2>${esc(g.prompt)}</h2></div><div class="a-options" id="bluffOptions"></div><p id="voteStatus" class="a-hint" aria-live="polite"></p>`;}
        reveal(){const g=this.game;return g.kind==='sketch'?`<div class="a-reveal-word"><span class="a-tag">THE SECRET WORD WAS</span><h2>${esc(g.word.answer)}</h2><p>${esc(g.note)}</p><div class="a-round-gains">${g.players.filter(p=>p.active).map(p=>`<div><span>${esc(p.name)}</span><strong>+${p.roundScore}</strong></div>`).join('')}</div></div><div class="a-ink-board recap" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Finished drawing"></canvas></div>`:`<div class="a-prompt compact"><span class="a-tag">THE ANSWER WAS ON THE CARD ALL ALONG</span><h2>${esc(g.prompt)}</h2></div><div class="a-options revealed" id="bluffOptions"></div>`;}
        results(){const g=this.game;const sorted=[...g.players].sort((a,b)=>b.score-a.score);const top=sorted[0]?.score;const winners=sorted.filter(p=>p.score===top).map(p=>p.name);return `<div class="a-results"><div class="a-trophy" aria-hidden="true">✦</div><span class="a-tag">${winners.length>1?'SHARED BRAGGING RIGHTS':'THE ROOM HAS A CHAMPION'}</span><h2>${esc(winners.join(' & '))}</h2><p>${esc(g.note)}</p><ol class="a-final-board">${sorted.map((p,i)=>`<li><span class="a-final-rank">${p.score===top?'♛':i+1}</span><div><strong>${esc(p.name)}</strong><div class="a-badges">${p.badges.map(b=>`<span>${esc(b)}</span>`).join('')}</div></div><b>${p.score}<small>points</small></b></li>`).join('')}</ol><div class="a-actions">${this.host?'<button class="a-primary" data-act="rematch">One more round ↗</button><button class="a-secondary" data-act="cancel">Choose another game</button>':'<p class="a-hint">Waiting for the host to set up a rematch.</p>'}</div></div>`;}
        updatePhase(){
            const g=this.game;if(!g)return;
            if(g.phase==='lobby'){
                $('lobbyPlayers').innerHTML=g.players.filter(p=>p.active).map(p=>`<div class="a-lobby-player"><span class="a-avatar">${esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}${p.id===g.hostId?' <small>HOST</small>':p.bot?' <small>BOT</small>':''}</strong><span class="a-ready ${p.ready&&p.online?'yes':''}">${!p.online?'Reconnecting':p.ready?'Ready ✓':'Not ready'}</span></div>`).join('');
                this.dialog.querySelectorAll('[data-pace]').forEach(b=>{b.classList.toggle('selected',b.dataset.pace===g.pace);b.disabled=!this.host;b.setAttribute('aria-pressed',String(b.dataset.pace===g.pace));});
                const ready=g.players.filter(p=>p.active&&p.online);const canStart=ready.length>=2&&ready.every(p=>p.ready);
                $('lobbyActions').innerHTML=g.isPlayer?`${this.host?`<button class="a-primary" data-act="start" ${canStart?'':'disabled'}>${canStart?'Start the fun ↗':ready.length<2?'Waiting for a friend…':'Waiting for ready players…'}</button>`:`<button class="a-primary" data-ready="${!this.me?.ready}">${this.me?.ready?'Ready ✓ — unready?':'I’m ready ↗'}</button>`}${this.host&&ready.length===1?'<button class="a-secondary" data-act="solo">Play solo vs 2 bots ↗</button>':''}<button class="a-secondary" data-act="invite">Invite the call</button><button class="a-link" data-act="leave">Leave game</button>`:'<button class="a-primary" data-act="join">Count me in ↗</button>';
            }
            if(g.phase==='draw'){
                const artist=g.artistId===this.manager.userId;
                $('sketchRole').textContent=artist?'YOU ARE DRAWING':`${g.players.find(p=>p.id===g.artistId)?.name||'The artist'} IS DRAWING`;
                $('sketchWord').textContent=artist?g.word.answer:g.word.mask;
                const input=$('guessText');if(input){input.disabled=!g.isPlayer||g.guessed;input.form.querySelector('button').disabled=input.disabled;$('guessStatus').textContent=!g.isPlayer?'Spectating — join the next match.':g.guessed?'✓ You got it! Let the others cook.':'One word, lots of possibilities. Type a guess.';}
                this.dialog.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===this.color)));
                this.dialog.querySelectorAll('[data-width]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.width)===this.width));
                const feed=$('sketchFeed');feed.replaceChildren(...g.feed.map(item=>{const node=document.createElement('p');node.className=item.kind;node.textContent=item.text;return node;}));feed.scrollTop=feed.scrollHeight;
            }
            if(g.kind==='sketch'&&$('sketchCanvas'))this.paintCanvas();
            if(g.phase==='blocks'){
                const board=g.boards?.[this.manager.userId];
                const boardKey=board?.join('')||'spectator';
                if(this.lastBoardKey!==boardKey||!$('blockBoard').children.length){
                    $('blockBoard').innerHTML=board?board.map((color,i)=>`<button class="a-cube c${color}" data-block="${i}" aria-label="Pop ${['coral','sun','mint','sky','violet'][color]} block at row ${Math.floor(i/6)+1}, column ${i%6+1}"><span></span></button>`).join(''):'<p>Join the next round to play.</p>';
                    this.lastBoardKey=boardKey;
                }
                const me=this.me, last=g.blockLast;
                $('blockCombo').innerHTML=`×${last?.playerId===this.manager.userId?last.combo:1}<small>COMBO</small>`;
                $('blockRivals').innerHTML=g.players.filter(p=>p.active&&p.id!==this.manager.userId).map(p=>`<div><span>${esc(p.name)}</span><b>${p.score}</b></div>`).join('');
                $('blockFeed').textContent=last?`${esc(g.players.find(p=>p.id===last.playerId)?.name||'Someone')} popped ${last.size} cubes · +${last.points} points`:me?'Find a pair to start your combo.':'Watch the scores climb.';
                if(last?.at&&last.at!==this.lastBlockEffectAt){this.lastBlockEffectAt=last.at;if(last.playerId===this.manager.userId)this.blockEffect(last);}
            }
            if(g.phase==='write'){
                const input=$('bluffText');if(input){input.form.hidden=g.submitted;$('bluffLocked').hidden=!g.submitted;$('myBluff').textContent=g.mySubmission||'';}
                const count=g.players.filter(p=>p.active&&p.online).length;
                $('submissionLabel').textContent=`${g.submissionCount} of ${count} bluffs locked in`;$('submissionProgress').max=Math.max(count,1);$('submissionProgress').value=g.submissionCount;
            }
            if(g.kind==='bluff'&&['vote','reveal'].includes(g.phase)){
                const reveal=g.phase==='reveal';
                $('bluffOptions').innerHTML=g.options.map((o,i)=>`<button class="a-option ${g.myVote===o.id?'voted':''} ${reveal&&o.isAnswer?'truth':''}" data-option="${esc(o.id)}" ${reveal||!g.isPlayer||g.myVote||o.id===g.ownOptionId?'disabled':''}><span class="a-option-letter">${String.fromCharCode(65+i)}</span><div><strong>${esc(o.text)}</strong>${reveal?`<small>${o.isAnswer?'✦ SECRET HOUSE ANSWER':o.authors.length?`A BLUFF BY ${esc(o.authors.join(', '))}`:'HOUSE DECOY'}</small><div class="a-voters">${o.voters.length?o.voters.map(v=>`<span>${esc(v)}</span>`).join(''):'No votes'}</div>`:o.id===g.ownOptionId?'<small>YOUR BLUFF · NO SELF-VOTES</small>':''}</div><span class="a-option-mark">${g.myVote===o.id?'✓':reveal&&o.isAnswer?'✦':'↗'}</span></button>`).join('');
                if($('voteStatus'))$('voteStatus').textContent=g.myVote?`✓ Vote locked. ${g.votedCount} of ${g.players.filter(p=>p.active&&p.online).length} players have voted.`:g.isPlayer?'Choose carefully. You get one vote.':'You’re watching. Join the next match.';
            }
        }
        renderScores(){
            const g=this.game,aside=$('activityScores');aside.hidden=!g;
            this.dialog.querySelector('.a-layout').classList.toggle('with-game',!!g);
            if(!g){aside.replaceChildren();return;}
            const players=[...g.players].filter(p=>p.active||g.phase==='finished').sort((a,b)=>b.score-a.score);
            aside.innerHTML=`<div class="a-score-heading"><span>THE SCOREBOARD</span><span>${players.length}/4</span></div>${players.map((p,i)=>`<div class="a-score-row ${p.id===this.manager.userId?'is-me':''}"><span class="a-score-rank">${i===0&&p.score>0?'♛':String(i+1).padStart(2,'0')}</span><div><strong>${esc(p.name)}${p.id===this.manager.userId?' <small>you</small>':p.bot?' <small>bot</small>':''}</strong><small class="a-presence ${p.online?'online':''}">${p.online?(g.kind==='sketch'&&p.id===g.artistId&&g.phase!=='lobby'?'✎ Artist':'In the call'):'Reconnecting'}</small></div><b>${p.score}${['reveal','finished'].includes(g.phase)&&p.roundScore?`<small>+${p.roundScore}</small>`:''}</b></div>`).join('')}<details class="a-rules"><summary>Rules & scoring</summary><p>${RULES[g.kind]}</p></details>${this.host?'<button class="a-link a-end-game" data-confirm-close>End this game</button>':''}`;
        }
        renderReactions(){const wrap=$('activityReactions');if(!this.game?.isPlayer){wrap.replaceChildren();return;}if(wrap.children.length)return;wrap.innerHTML=['👏','😂','🔥','🦆'].map(e=>`<button data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('');}
        tick(){
            const g=this.game;if(!g?.deadline)return;
            const seconds=Math.max(0,Math.ceil((g.deadline-Date.now()-this.offset)/1000));$('activityTime').textContent=String(seconds).padStart(2,'0');$('activityClock').classList.toggle('urgent',seconds<=10);
        }
        updateMic(){const b=$('activityMic');b.textContent=this.manager.isMicOn?'Mic on':'Mic off';b.setAttribute('aria-label',this.manager.isMicOn?'Mute microphone':'Unmute microphone');b.classList.toggle('muted',!this.manager.isMicOn);}
        click(event){
            const b=event.target.closest('button');if(!b||b.disabled)return;
            if(b.dataset.mode){if(this.mode!==b.dataset.mode){this.mode=b.dataset.mode;this.signature='';if(this.mode!=='together'){this.watchSilenceUntil=Date.now()+2000;this.player?.destroy?.();this.player=null;this.videoId=null;this.stopRadio();}this.render();if(this.mode==='together')this.startRadio();}return;}
            if(b.dataset.focus){this.focusAction(b.dataset.focus);return;}
            if(b.dataset.preset){const [work,rest,long]=b.dataset.preset.split(',').map(Number);$('focusWork').value=work;$('focusBreak').value=rest;$('focusLong').value=long;this.dialog.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('selected',x===b));return;}
            if(b.dataset.sfx){if(!this.sound){this.sound=true;$('activitySound').classList.add('sound-on');this.audioContext().resume();this.startRadio();}this.socket.emit('sound-play',{id:b.dataset.sfx});return;}
            if(b.dataset.station){this.socket.emit('radio-control',{station:b.dataset.station});this.sound=true;$('activitySound').classList.add('sound-on');this.audioContext().resume();return;}
            if(b.dataset.watch){if(!this.player)return;const position=this.player.getCurrentTime()||0,playing=b.dataset.watch==='play';this.socket.emit('watch-control',{playing,position});return;}
            if(b.dataset.seek){if(!this.player)return;const position=Math.max(0,(this.player.getCurrentTime()||0)+Number(b.dataset.seek));this.socket.emit('watch-control',{playing:this.player.getPlayerState()===1,position});return;}
            if(b.dataset.create){if(!this.socket.connected)return this.notice('Wait for the call to reconnect.',true);this.socket.emit('game-create',{kind:b.dataset.create,pace:'quick'});}
            else if(b.dataset.act)this.send(b.dataset.act);
            else if(b.dataset.ready)this.send('ready',{ready:b.dataset.ready==='true'});
            else if(b.dataset.pace)this.send('settings',{pace:b.dataset.pace});
            else if(b.dataset.word!==undefined)this.send('choose',{index:Number(b.dataset.word)});
            else if(b.dataset.option)this.send('vote',{optionId:b.dataset.option});
            else if(b.dataset.block!==undefined){this.send('pop',{index:Number(b.dataset.block)});if(this.sound)this.tone();}
            else if(b.dataset.color){this.color=b.dataset.color;this.updatePhase();}
            else if(b.dataset.width){this.width=Number(b.dataset.width);this.updatePhase();}
            else if(b.dataset.emoji)this.send('reaction',{emoji:b.dataset.emoji});
            else if(b.hasAttribute('data-confirm-close')){if(b.dataset.confirmed==='yes')this.send('cancel');else{b.dataset.confirmed='yes';b.textContent=b.id==='activityEndMobile'?'Sure?':'End for everyone? Click again';setTimeout(()=>{if(b.isConnected){b.dataset.confirmed='';b.textContent=b.id==='activityEndMobile'?'End':'End this game';}},4000);}}
        }
        submit(event){
            const form=event.target;if(!form.dataset.form)return;event.preventDefault();
            if(form.dataset.form==='focus'){this.focusAction('start');return;}
            if(form.dataset.form==='watch'){const raw=form.querySelector('input').value.trim();let id=raw;if(!/^[\w-]{11}$/.test(id)){try{const url=new URL(raw);if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(url.hostname))throw Error();id=url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).at(-1);}catch(_){id='';}}if(!/^[\w-]{11}$/.test(id))return this.notice('Paste a YouTube link or video ID.',true);this.socket.emit('watch-control',{id});return;}
            const input=form.querySelector('input,textarea'),text=input.value.trim();if(!text)return;
            if(form.dataset.form==='guess'){this.send('guess',{text});input.value='';input.focus();}
            else this.send('submit',{text});
        }
        receiveFocus(focus,serverNow){
            const previous=this.focus;this.focus=focus;this.focusOffset=(serverNow||Date.now())-Date.now();
            if(previous&&focus&&focus.phase!==previous.phase){
                if(this.sound)this.playSfx(focus.phase==='work'?'tada':'boing');
                if(focus.phase==='break'||focus.phase==='longBreak'||focus.phase==='work')UI.showToast(focus.phase==='work'?'Focus time. Let’s go!':'Break time. You earned it.');
            }
            this.tickFocus();if(this.dialog.open&&this.mode==='focus')this.renderFocus();
        }
        focusAction(action){
            if(!this.socket.connected)return this.notice('The call is reconnecting. Try again in a moment.',true);
            let data={action};
            if(action==='start'){
                const form=$('focusForm');if(!form?.reportValidity())return;
                data={...data,workMinutes:Number($('focusWork').value),breakMinutes:Number($('focusBreak').value),longBreakMinutes:Number($('focusLong').value),mode:form.elements.rhythm.value};
            }
            this.socket.emit('focus-control',data);
        }
        tickFocus(){
            const f=this.focus;if(!this.focusDock)return;
            this.focusDock.hidden=!f||f.phase==='done';if(!f||f.phase==='done')return;
            const remaining=f.paused?f.remainingMs:Math.max(0,f.deadline-Date.now()-this.focusOffset);
            const sec=Math.ceil(remaining/1000),time=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
            this.focusDock.textContent=`${f.phase==='work'?'✦ FOCUS':f.phase==='longBreak'?'☕ LONG BREAK':'☕ BREAK'}  ${time}${f.paused?' · PAUSED':''}`;
            const output=$('focusTime');if(output)output.textContent=time;
            const bar=$('focusProgress');if(bar){const total=(f.phase==='work'?f.workMinutes:f.phase==='longBreak'?f.longBreakMinutes:f.breakMinutes)*60000;bar.style.setProperty('--progress',`${Math.max(0,Math.min(100,(1-remaining/total)*100))}%`);}
        }
        renderFocus(){
            const f=this.focus;$('activityTitle').textContent=f?.phase==='done'?'Session complete.':f?.phase==='work'?'Stay with it.':f?'Take a real break.':'Find your rhythm.';
            $('activityEyebrow').textContent='THE ROOM FOCUS TIMER';$('activityClock').hidden=true;$('activityEndMobile').hidden=true;$('activityScores').hidden=true;this.dialog.querySelector('.a-layout').classList.remove('with-game');$('activityReactions').replaceChildren();
            const signature=`focus:${f?.revision||0}:${f?.phase||'idle'}`;
            if(this.signature!==signature){
                this.signature=signature;
                $('activityContent').innerHTML=f&&f.phase!=='done'?`<div class="a-focus"><section class="a-focus-stage ${esc(f.phase)}"><div class="a-focus-orbit" aria-hidden="true"><i></i><i></i><i></i></div><span class="a-focus-label">${f.phase==='work'?'DEEP WORK':f.phase==='longBreak'?'LONG BREAK':'SHORT BREAK'} · CYCLE ${f.cycle}</span><output id="focusTime" class="a-focus-time">00:00</output><div id="focusProgress" class="a-focus-progress"></div><p>${esc(f.ownerName)} set the rhythm for everyone in this call.</p><span class="a-focus-live">● LIVE TOGETHER</span></section><section class="a-focus-side"><span class="a-tag">ROOM SYNCED</span><h2>One timer. One team.</h2><p>Every device follows the same clock, even after a reconnect. Keep the call open and work together.</p><div class="a-focus-stats"><div><strong>${f.workMinutes}m</strong><small>FOCUS</small></div><div><strong>${f.breakMinutes}m</strong><small>BREAK</small></div><div><strong>${f.mode==='repeat'?'∞':'1×'}</strong><small>RHYTHM</small></div></div><p>${f.paused?'Paused for the whole room.':f.mode==='repeat'?'A longer break arrives every four focus blocks.':'This timer ends after one focus block.'}</p><div class="a-focus-actions"><button class="a-primary" data-focus="${f.paused?'resume':'pause'}">${f.paused?'Resume':'Pause'}</button><button class="a-secondary" data-focus="skip">Skip phase</button><button class="a-link" data-focus="stop">End timer</button></div></section></div>`:`<div class="a-focus"><section class="a-focus-stage idle"><div class="a-focus-orbit" aria-hidden="true"><i></i><i></i><i></i></div><span class="a-focus-label">${f?.phase==='done'?'MISSION COMPLETE':'READY WHEN YOU ARE'}</span><strong class="a-focus-time">✦</strong><p>Pick a rhythm that works for your whole room.</p></section><form class="a-focus-side" id="focusForm" data-form="focus"><span class="a-tag">SET THE PACE</span><h2>Make time for the good stuff.</h2><div class="a-focus-presets"><button type="button" data-preset="25,5,15" class="selected">Pomodoro <small>25 / 5</small></button><button type="button" data-preset="50,10,20">Deep work <small>50 / 10</small></button></div><div class="a-focus-fields"><label>Focus <input id="focusWork" type="number" inputmode="numeric" min="1" max="180" required value="25"> min</label><label>Break <input id="focusBreak" type="number" inputmode="numeric" min="1" max="60" required value="5"> min</label><label>Long break <input id="focusLong" type="number" inputmode="numeric" min="1" max="90" required value="15"> min</label></div><div class="a-focus-rhythm"><label><input type="radio" name="rhythm" value="once" checked> One focus block</label><label><input type="radio" name="rhythm" value="repeat"> Repeat with breaks</label></div><button class="a-primary" type="submit">Start for the whole room ↗</button></form></div>`;
                $('activityContent').scrollTop=0;
            }
            this.tickFocus();
        }
        renderTogether(){
            $('activityTitle').textContent='Play something together.';$('activityEyebrow').textContent='THE SHARED LOUNGE';$('activityClock').hidden=true;$('activityEndMobile').hidden=true;$('activityScores').hidden=true;this.dialog.querySelector('.a-layout').classList.remove('with-game');$('activityReactions').replaceChildren();
            if(this.signature!=='together'){
                this.signature='together';$('activityContent').innerHTML=`<div class="a-together"><section class="a-watch"><div class="a-media-heading"><span class="a-tag">WATCH TOGETHER</span><h2>One screen. Same moment.</h2><p>Paste a YouTube link. Everyone in the call gets the same video and shared controls.</p></div><form data-form="watch" class="a-watch-form"><input aria-label="YouTube URL or ID" type="text" placeholder="Paste a YouTube link" required><button class="a-primary">Load video ↗</button></form><div class="a-watch-frame" id="watchFrame"><div class="a-watch-empty">▶<small>THE SCREEN IS YOURS</small></div></div><div class="a-watch-controls"><button data-seek="-10">−10s</button><button data-watch="play">▶ Play</button><button data-watch="pause">Ⅱ Pause</button><button data-seek="10">+10s</button><button id="watchSync">↻ Sync</button></div><p class="a-hint">YouTube may ask each viewer to press Play once. The video’s own ads and availability are controlled by YouTube.</p></section><section class="a-audio-panel"><div><span class="a-tag">SOUNDBOARD</span><h2>Make some noise.</h2><p>Original KERNE sounds. Tap ♪ above to hear your friends’ sounds.</p><div class="a-sfx-grid">${[['boing','↗ Boing'],['quack','🦆 Quack'],['tada','✦ Ta-da'],['pop','◉ Pop'],['zap','ϟ Zap'],['drum','🥁 Drumroll']].map(([id,name])=>`<button data-sfx="${id}">${name}</button>`).join('')}</div></div><div><span class="a-tag">SHARED RADIO</span><h2>Set the mood.</h2><p>Original generated loops. Radio volume stays on your device.</p><div class="a-radio-grid">${[['off','■ Off'],['focus','◌ Focus'],['arcade','◆ Arcade'],['rain','☔ Rain']].map(([id,name])=>`<button data-station="${id}">${name}</button>`).join('')}</div><label class="a-volume">Radio volume <input type="range" id="radioVolume" min="0" max="100" value="30"></label></div></section></div>`;
                $('watchSync').onclick=()=>this.syncWatch(true);$('radioVolume').oninput=e=>{if(this.radioGain)this.radioGain.gain.value=Number(e.target.value)/350;};
            }
            this.updateTogether();
        }
        blockEffect(last){
            const tile=this.dialog.querySelector(`.a-cube[data-block="${last.index}"]`),board=$('blockBoard');if(!tile||!board)return;
            const box=tile.getBoundingClientRect(),outer=board.getBoundingClientRect(),burst=document.createElement('div');burst.className='a-block-burst';burst.style.left=`${box.left-outer.left+box.width/2}px`;burst.style.top=`${box.top-outer.top+box.height/2}px`;burst.textContent=`+${last.points}${last.combo>1?` ×${last.combo}`:''}`;board.append(burst);setTimeout(()=>burst.remove(),900);
            board.classList.remove('pop-shake');void board.offsetWidth;board.classList.add('pop-shake');setTimeout(()=>board.classList.remove('pop-shake'),330);
            if(this.sound)this.playSfx(last.combo>=4?'tada':'pop');if(navigator.vibrate)navigator.vibrate(last.combo>=4?[25,30,35]:15);
        }
        updateTogether(){
            if(!this.dialog.open||this.mode!=='together'||!$('watchFrame'))return;
            this.dialog.querySelectorAll('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.station===this.media.radio.station)));
            this.dialog.querySelectorAll('[data-watch],[data-seek],#watchSync').forEach(b=>b.disabled=!this.media.video.id);
            if(this.media.video.id!==this.videoId){this.videoId=this.media.video.id;this.player?.destroy?.();this.player=null;$('watchFrame').innerHTML=this.videoId?'<div id="watchPlayer"></div>':'<div class="a-watch-empty">▶<small>THE SCREEN IS YOURS</small></div>';if(this.videoId)this.loadYouTube();}
            else this.syncWatch();
        }
        async loadYouTube(){
            try{
                if(!window.YT?.Player){await (window.kerneYouTubeApi ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>reject(Error('YouTube unavailable'));const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};document.head.append(script);}));}
                if(!this.dialog.open||this.mode!=='together'||!$('watchPlayer'))return;
                this.player=new YT.Player('watchPlayer',{videoId:this.videoId,playerVars:{playsinline:1,origin:location.origin,rel:0},events:{onReady:()=>this.syncWatch(true),onStateChange:event=>{if(Date.now()<this.watchSilenceUntil||![1,2].includes(event.data))return;this.socket.emit('watch-control',{playing:event.data===1,position:this.player.getCurrentTime()||0});}}});
            }catch(_){this.notice('YouTube could not load on this device.',true);}
        }
        syncWatch(force=false){
            if(!this.player||typeof this.player.getCurrentTime!=='function'||!this.media.video.id)return;
            const v=this.media.video,position=v.position+(v.playing?Math.max(0,(Date.now()+(this.mediaOffset||0)-v.at)/1000):0);
            try{if(force||Math.abs(this.player.getCurrentTime()-position)>2.5){this.watchSilenceUntil=Date.now()+1600;this.player.seekTo(position,true);}if(v.playing&&this.player.getPlayerState()!==1){this.watchSilenceUntil=Date.now()+1600;this.player.playVideo();}else if(!v.playing&&this.player.getPlayerState()===1){this.watchSilenceUntil=Date.now()+1600;this.player.pauseVideo();}}catch(_){}
        }
        audioContext(){return this.audio||=(new(window.AudioContext||window.webkitAudioContext)());}
        playSfx(id){
            try{const ctx=this.audioContext();ctx.resume();const now=ctx.currentTime;const notes={boing:[[240,520,.28,'sine']],quack:[[480,210,.12,'sawtooth'],[240,150,.13,'sawtooth']],tada:[[523,523,.15,'triangle'],[659,659,.15,'triangle'],[784,784,.36,'triangle']],pop:[[320,100,.12,'sine']],zap:[[850,90,.24,'sawtooth']],drum:[[130,85,.12,'triangle'],[110,70,.12,'triangle'],[160,65,.25,'triangle']]}[id];if(!notes)return;let at=now;for(const [start,end,duration,type]of notes){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(Math.max(50,end),at+duration);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.09,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain).connect(ctx.destination);osc.start(at);osc.stop(at+duration+.01);at+=duration*.8;}}catch(_){}
        }
        stopRadio(){clearInterval(this.radioTimer);this.radioTimer=null;if(this.radioGain){this.radioGain.disconnect();this.radioGain=null;}}
        startRadio(){
            this.stopRadio();if(!this.sound||!this.dialog.open||this.mode!=='together'||this.media.radio.station==='off')return;
            try{const ctx=this.audioContext();ctx.resume();const output=ctx.createGain();output.gain.value=Number($('radioVolume')?.value||30)/350;output.connect(ctx.destination);this.radioGain=output;const station=this.media.radio.station,at=this.media.radio.at;
                const beat=()=>{if(!this.radioGain)return;const tick=Math.floor((Date.now()+(this.mediaOffset||0)-at)/500);if(tick===this.radioBeat)return;this.radioBeat=tick;const now=ctx.currentTime;
                    if(station==='rain'){const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.18),ctx.sampleRate),arr=buffer.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=(Math.random()*2-1)*Math.exp(-i/arr.length*7);const src=ctx.createBufferSource();src.buffer=buffer;const gain=ctx.createGain();gain.gain.value=.12;src.connect(gain).connect(output);src.start(now);return;}
                    const melody=station==='focus'?[261.63,329.63,392,329.63,293.66,349.23,440,349.23]:[261.63,392,523.25,392,293.66,440,587.33,440];const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=station==='focus'?'sine':'triangle';osc.frequency.value=melody[((tick%8)+8)%8];gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.35,now+.03);gain.gain.exponentialRampToValueAtTime(.0001,now+.42);osc.connect(gain).connect(output);osc.start(now);osc.stop(now+.45);
                };beat();this.radioTimer=setInterval(beat,120);
            }catch(_){}
        }
        bindCanvas(){
            const canvas=$('sketchCanvas'),board=$('sketchBoard');this.canvas=canvas;this.ctx=canvas.getContext('2d');canvas.style.touchAction=this.game?.artistId===this.manager.userId?'none':'pan-y';
            const fit=()=>{if(!canvas.isConnected)return;const w=board.clientWidth,h=board.clientHeight;const width=Math.min(w,h*1.6);canvas.style.width=`${width}px`;canvas.style.height=`${width/1.6}px`;};
            this.canvasObserver?.disconnect();this.canvasObserver=new ResizeObserver(fit);this.canvasObserver.observe(board);requestAnimationFrame(fit);
            canvas.addEventListener('pointerdown',event=>{
                if(this.game?.phase!=='draw'||this.game.artistId!==this.manager.userId||!this.socket.connected)return;
                canvas.setPointerCapture(event.pointerId);const point=this.point(event);this.pointer={id:event.pointerId,group:crypto.randomUUID(),points:[point],last:point,color:this.color,width:this.color==='#ffffff'?24:this.width,sentAt:performance.now()};
                this.paintSegment({...this.pointer,points:[point]});event.preventDefault();
            });
            canvas.addEventListener('pointermove',event=>{
                const pen=this.pointer;if(!pen||pen.id!==event.pointerId)return;const point=this.point(event);
                if(Math.hypot(point.x-pen.last.x,point.y-pen.last.y)<.001)return;
                this.paintSegment({...pen,points:[pen.last,point]});pen.points.push(point);pen.last=point;
                if(pen.points.length>=30||performance.now()-pen.sentAt>90)this.flushInk(false);
            });
            const end=event=>{if(this.pointer?.id===event.pointerId)this.flushInk(true);};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
        }
        point(event){const r=this.canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};}
        flushInk(done){
            const pen=this.pointer;if(!pen)return;
            if(pen.points.length){const stroke={id:crypto.randomUUID(),group:pen.group,color:pen.color,width:pen.width,points:pen.points};this.pending.set(stroke.id,stroke);this.send('draw',{stroke});pen.points=[pen.last];pen.sentAt=performance.now();}
            if(done)this.pointer=null;
        }
        paintSegment(stroke){
            if(!this.ctx)return;const ctx=this.ctx,w=960,h=600;ctx.lineWidth=stroke.width;ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=ctx.fillStyle=stroke.color;ctx.beginPath();
            if(stroke.points.length===1){const p=stroke.points[0];ctx.arc(p.x*w,p.y*h,stroke.width/2,0,Math.PI*2);ctx.fill();}
            else{ctx.moveTo(stroke.points[0].x*w,stroke.points[0].y*h);for(const p of stroke.points.slice(1))ctx.lineTo(p.x*w,p.y*h);ctx.stroke();}
        }
        paintCanvas(){
            if(!this.ctx||!$('sketchCanvas'))return;this.ctx.fillStyle='#ffffff';this.ctx.fillRect(0,0,960,600);
            const ids=new Set();for(const stroke of this.game.strokes){ids.add(stroke.id);this.pending.delete(stroke.id);this.paintSegment(stroke);}
            for(const [id,stroke]of this.pending)if(!ids.has(id))this.paintSegment(stroke);
            if(this.pointer)this.paintSegment(this.pointer);
        }
        receiveStroke({gameId,round,stroke}){
            if(this.game?.id!==gameId||this.game.round!==round)return;
            const pending=this.pending.delete(stroke.id);if(this.game.strokes.some(s=>s.id===stroke.id))return;
            this.game.strokes.push(stroke);if(this.dialog.open&&$('sketchCanvas')&&!pending)this.paintSegment(stroke);
        }
        refreshCameras(){
            if(!this.dialog.open)return;const rail=$('activityCameras');const tiles=[...document.querySelectorAll('#cameraStrip .video-element')];
            const ids=new Set(tiles.map(t=>t.id));for(const node of [...rail.children])if(!ids.has(node.dataset.peer))node.remove();
            for(const tile of tiles){let node=[...rail.children].find(n=>n.dataset.peer===tile.id);if(!node){node=document.createElement('div');node.className='a-call-person';node.dataset.peer=tile.id;const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=true;const avatar=document.createElement('div');avatar.className='a-camera-off';const label=document.createElement('span');node.append(v,avatar,label);rail.append(node);}const source=tile.querySelector('video');const video=node.querySelector('video');const live=tile.dataset.cameraOn==='true'&&!!source.srcObject;const stream=live?source.srcObject:null;if(video.srcObject!==stream)video.srcObject=stream;node.querySelector('.a-camera-off').hidden=live;node.querySelector('.a-camera-off').textContent=tile.querySelector('.avatar-circle').textContent;node.querySelector('span').textContent=tile.querySelector('.video-name').textContent;}
        }
        reaction(emoji,playerId){if(!this.dialog.open)return;const node=document.createElement('span');node.className='a-float-reaction';node.textContent=emoji;node.style.left=`${15+Math.random()*70}%`;$('activityConfetti').append(node);setTimeout(()=>node.remove(),2200);const name=this.game?.players.find(p=>p.id===playerId)?.name;if(name)this.notice(`${name} ${emoji}`);}
        confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<30;i++){const bit=document.createElement('i');bit.style.cssText=`left:${i*3.4}%;--turn:${i%2?'-':'+'}${150+i*11}deg;--delay:${(i%7)*.06}s;background:${['#ffeb3b','#bcb0ea','#82b79d','#f4a376'][i%4]}`;$('activityConfetti').append(bit);setTimeout(()=>bit.remove(),3000);}}
        tone(){if(!this.sound)return;try{this.audio||=new(window.AudioContext||window.webkitAudioContext)();this.audio.resume();const now=this.audio.currentTime;for(const[i,hz]of[523,659,784].entries()){const o=this.audio.createOscillator(),gain=this.audio.createGain();o.type='sine';o.frequency.value=hz;gain.gain.setValueAtTime(.025,now+i*.07);gain.gain.exponentialRampToValueAtTime(.001,now+.13+i*.07);o.connect(gain);gain.connect(this.audio.destination);o.start(now+i*.07);o.stop(now+.15+i*.07);}}catch{}}
    }
    window.Activities=Activities;
})();
