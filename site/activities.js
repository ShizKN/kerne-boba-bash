/* Call activities: server-owned rules, touch-friendly presentation. */
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const NAMES = {sketch:'Sketch Rush',bluff:'Bluff Club'};
    const ART = {
        sketch:'<svg viewBox="0 0 180 130" aria-hidden="true"><path d="M27 105 42 65 120 7l28 30-80 63z" fill="#ffef6b" stroke="currentColor" stroke-width="4"/><path d="m42 65 26 35-41 5 15-40m67-49 27 30" fill="none" stroke="currentColor" stroke-width="4"/><path d="m29 99 6-17 12 15z" fill="currentColor"/><path d="M94 106c18-28 36 28 66-5M16 27l8 8m131 27 12-3M68 9l-2 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
        bluff:'<svg viewBox="0 0 180 130" aria-hidden="true"><rect x="25" y="17" width="84" height="102" rx="9" transform="rotate(-14 25 17)" fill="#eee4ff" stroke="currentColor" stroke-width="4"/><rect x="66" y="9" width="84" height="107" rx="9" transform="rotate(9 66 9)" fill="#fff9e8" stroke="currentColor" stroke-width="4"/><path d="M92 48c1-15 28-17 28 1 0 11-16 11-16 25m0 11v1" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="m26 4-7 8m138 91 10 8" stroke="currentColor" stroke-width="4"/></svg>'
    };
    const PAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 7h10a4 4 0 0 1 4 3l1 7c.3 2-2 3-3.5 1.5L16 16H8l-2.5 2.5C4 20 1.7 19 2 17l1-7a4 4 0 0 1 4-3Z"/><path d="M7 9v6m-3-3h6"/><circle cx="16" cy="11" r=".8"/><circle cx="19" cy="14" r=".8"/></svg>';
    const RULES = {
        sketch:'Take turns drawing. Pick one of three secret words, then draw without letters or numbers. Guessers earn 100–300 points based on speed, with 50 extra for the first correct guess. The artist gets 75 points per correct guess. Two timed letter hints keep things moving.',
        bluff:'This is a completely fictional universe. Write a believable, ridiculous answer to a strange question. Then find the secret house answer among everyone’s bluffs. A correct vote earns 200 points. Every person fooled by your bluff earns you 150. You cannot vote for your own answer.'
    };
    class Activities {
        constructor(manager) {
            this.manager=manager; this.socket=manager.socket; this.game=null; this.signature=''; this.pending=new Map(); this.color='#1a1a1a'; this.width=5; this.sound=false; this.offset=0;
            this.button=document.createElement('button'); this.button.className='control-btn'; this.button.id='activitiesBtn'; this.button.title='Activities'; this.button.setAttribute('aria-label','Activities'); this.button.innerHTML=PAD;
            document.querySelector('.controls').insertBefore(this.button,$('roomMore'));
            this.dialog=document.createElement('dialog'); this.dialog.id='activitiesDialog'; this.dialog.setAttribute('aria-labelledby','activityTitle');
            this.dialog.innerHTML=`<div class="a-shell"><header class="a-header"><button class="a-brand" id="activityBrand" aria-label="KERNE break room">K<span>THE BREAK ROOM</span></button><div class="a-header-actions"><button id="activityEndMobile" class="a-end-mobile" data-confirm-close aria-label="End game for everyone" hidden>End</button><button id="activitySound" class="a-icon" aria-label="Enable game sound" title="Game sound off">♪<span class="a-sound-slash">/</span></button><button id="activityClose" class="a-back">← <span>Back to call</span></button></div></header><div class="a-connection" id="activityConnection" hidden>Reconnecting… Your game will resume automatically.</div><div class="a-call-strip" id="activityCameras" aria-label="Call participants"></div><div class="a-topline"><div><p class="a-eyebrow" id="activityEyebrow">A WELL-EARNED BREAK</p><h1 id="activityTitle">A little friendly chaos.</h1></div><div class="a-clock" id="activityClock" hidden><span aria-hidden="true">◷</span><output id="activityTime" aria-live="off">00</output></div></div><div class="a-layout"><main id="activityContent" class="a-content"></main><aside id="activityScores" class="a-scores" aria-label="Live scores"></aside></div><footer class="a-footer"><span class="a-live"><i></i>Still in the call</span><div id="activityReactions" class="a-reaction-buttons" aria-label="Reactions"></div><button id="activityMic" class="a-small">Microphone</button></footer><div id="activityNotice" class="a-notice" role="status" aria-live="polite"></div><div id="activityConfetti" class="a-confetti" aria-hidden="true"></div></div>`;
            document.body.append(this.dialog);
            this.button.onclick=()=>this.open(); $('activityClose').onclick=()=>this.dialog.close();
            this.dialog.addEventListener('close',()=>{this.pointer=null;this.pending.clear();});
            $('activityMic').onclick=()=>this.manager.toggleMic();
            $('activitySound').onclick=()=>{this.sound=!this.sound; $('activitySound').classList.toggle('sound-on',this.sound); $('activitySound').setAttribute('aria-label',this.sound?'Mute game sound':'Enable game sound'); this.tone();};
            $('activityBrand').onclick=()=>{this.eggTaps=(this.eggTaps||0)+1; if(this.eggTaps%5===0&&this.game?.isPlayer)this.send('egg');};
            this.dialog.addEventListener('click',event=>this.click(event));
            this.dialog.addEventListener('submit',event=>this.submit(event));
            this.socket.on('game-state',({game,serverNow})=>this.receive(game,serverNow));
            this.socket.on('game-stroke',message=>this.receiveStroke(message));
            this.socket.on('game-error',({message})=>{this.notice(message,true);this.pending.clear();this.pointer=null;this.socket.emit('game-get',{});});
            this.socket.on('game-reaction',({emoji,playerId})=>this.reaction(emoji,playerId));
            this.socket.on('game-invite',({from,kind})=>{if(!this.dialog.open){this.button.classList.add('has-notif');UI.showToast(`${from} invited you to ${NAMES[kind]||'play'}. Open Activities.`);}});
            this.socket.on('disconnect',()=>{$('activityConnection').hidden=false;this.pointer=null;this.pending.clear();});
            this.socket.on('room-joined',()=>{this.socket.emit('game-get',{});$('activityConnection').hidden=true;});
            this.timer=setInterval(()=>{if(this.dialog.open){this.tick();this.updateMic();}},250);
        }
        get me(){return this.game?.players.find(p=>p.id===this.manager.userId&&p.active);}
        get host(){return this.game?.hostId===this.manager.userId;}
        open(){if(!this.dialog.open)this.dialog.showModal();this.button.classList.remove('has-notif');this.signature='';this.render();this.refreshCameras();this.socket.emit('game-get',{});}
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
            const g=this.game, content=$('activityContent');
            const titles={lobby:'Get the gang together.',choose:g?.artistId===this.manager.userId?'Your turn to draw.':'A masterpiece is loading.',draw:'What is it?',write:'Make something up.',vote:'Spot the secret answer.',reveal:g?.kind==='sketch'?'The big reveal.':'Masks off.',finished:'Bragging rights, earned.',paused:'Hang tight, team.'};
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
                else if(g.phase==='reveal')content.innerHTML=this.reveal();
                else if(g.phase==='finished')content.innerHTML=this.results();
                else content.innerHTML=`<div class="a-wait"><div class="a-orbit">↻</div><h2>A friend dropped out.</h2><p>We’re keeping the drawing and scores while they reconnect. The match resumes as soon as the team is back.</p><span class="a-tag">30-second reconnect window</span></div>`;
                if($('sketchCanvas'))this.bindCanvas();
                if($('bluffText'))$('bluffText').addEventListener('input',()=>{$('bluffCount').textContent=`${$('bluffText').value.length}/80`;});
            }
            this.updatePhase();this.renderScores();this.renderReactions();this.refreshCameras();this.tick();this.updateMic();
        }
        home(){return `<p class="a-intro">Your study group. A new kind of group project.<br>Pick a game, invite the call, and take five.</p><div class="a-game-grid"><button class="a-game-card sketch" data-create="sketch"><div class="a-game-art">${ART.sketch}</div><span class="a-tag">DRAW · GUESS · PANIC</span><h2>Sketch Rush<span>01</span></h2><p>One secret word. Questionable art.<br>Ridiculously good guesses.</p><div class="a-card-meta"><span>2–4 players · ~3–6 min</span><strong>Let’s draw ↗</strong></div></button><button class="a-game-card bluff" data-create="bluff"><div class="a-game-art">${ART.bluff}</div><span class="a-tag">LIE · VOTE · LAUGH</span><h2>Bluff Club<span>02</span></h2><p>Invent an answer. Keep a straight face.<br>Fool the entire call.</p><div class="a-card-meta"><span>2–4 players · ~4–7 min</span><strong>Deal me in ↗</strong></div></button></div><div class="a-house-note"><span>✦</span><p>Made for a proper break. Your cameras and call audio keep going. Come back to the call whenever you like.</p></div>`;}
        lobby(){const g=this.game;return `<section class="a-lobby"><div class="a-lobby-art ${g.kind}">${ART[g.kind]}<span class="a-tag">${g.kind==='sketch'?'NO ART DEGREE REQUIRED':'TRUST ISSUES INCLUDED'}</span></div><div class="a-lobby-body"><h2>${NAMES[g.kind]}</h2><p>${g.kind==='sketch'?'Turn your questionable doodles into a team sport.':'Fake facts. Real poker faces. Best with 3–4 friends.'}</p><div class="a-pace"><button data-pace="quick">Quick break<small>${g.kind==='sketch'?'1 turn each · 45s drawings':'3 rounds · 35s to bluff'}</small></button><button data-pace="classic">Stay a while<small>${g.kind==='sketch'?'2 turns each · 60s drawings':'5 rounds · 50s to bluff'}</small></button></div><div id="lobbyPlayers" class="a-lobby-players"></div><div id="lobbyActions" class="a-actions"></div><p class="a-hint">Everyone in this call has an invitation. No links, no accounts.</p></div></section><details class="a-rules"><summary>How to play & scoring</summary><p>${RULES[g.kind]}</p></details>`;}
        choose(){const g=this.game;const artist=g.players.find(p=>p.id===g.artistId);return g.artistId===this.manager.userId?`<div class="a-choose"><p class="a-intro">Choose a secret word. Only you can see these.</p><div class="a-word-options">${(g.word.choices||[]).map((w,i)=>`<button data-word="${i}"><span>0${i+1}</span>${esc(w)}<small>${w.length} characters ↗</small></button>`).join('')}</div><p class="a-hint">Draw shapes, not letters. A word is picked automatically if time runs out.</p></div>`:`<div class="a-wait"><div class="a-wait-art">${ART.sketch}</div><h2>${esc(artist?.name||'The artist')} is picking a word.</h2><p>Warm up those wild guesses. The drawing will appear here.</p><span class="a-tag">PENCILS AT THE READY</span></div>`;}
        drawing(){const artist=this.game.artistId===this.manager.userId;return `<div class="a-sketch-head"><span class="a-tag" id="sketchRole"></span><strong id="sketchWord" class="a-secret"></strong></div><div class="a-ink-board" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Shared game drawing">Your browser needs Canvas to show drawings.</canvas></div>${artist?`<div class="a-draw-tools"><div class="a-palette" role="group" aria-label="Pen color">${['#1a1a1a','#e04b45','#e8b629','#3d9c70','#377dda','#9663c4','#ec83ad','#ffffff'].map((c,i)=>`<button data-color="${c}" style="--swatch:${c}" title="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}" aria-label="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}"></button>`).join('')}</div><button class="a-small" data-width="5">Fine</button><button class="a-small" data-width="14">Bold</button><button class="a-small" data-act="undo">↶ Undo</button><button class="a-small" data-act="clear">Clear</button></div>`:`<form class="a-form" data-form="guess"><input id="guessText" name="guess" autocomplete="off" maxlength="60" placeholder="What is it?" aria-label="Your guess"><button class="a-primary" type="submit">Guess ↗</button></form><p id="guessStatus" class="a-hint" aria-live="polite"></p>`}<div id="sketchFeed" class="a-feed" aria-live="polite" aria-relevant="additions text"></div>`;}
        writing(){const g=this.game;return `<div class="a-prompt"><span class="a-tag">FROM A COMPLETELY FICTIONAL UNIVERSE</span><h2>${esc(g.prompt)}</h2><span class="a-prompt-doodle" aria-hidden="true">✳</span></div>${g.isPlayer?`<form class="a-bluff-form" data-form="bluff"><label for="bluffText">Your most convincing nonsense</label><textarea id="bluffText" maxlength="80" rows="2" placeholder="Make them believe it…" required></textarea><div class="a-form-foot"><span id="bluffCount">0/80</span><button class="a-primary" type="submit" id="lockBluff">Lock my bluff ↗</button></div></form><div id="bluffLocked" class="a-locked" hidden><span>✓ LOCKED IN</span><p id="myBluff"></p><small>Now practice your innocent face.</small></div>`:`<p class="a-spectator">You’re watching this match. You can join the next one.</p>`}<div class="a-submission-progress"><div><span id="submissionLabel"></span><span>✍</span></div><progress id="submissionProgress" max="4" value="0"></progress></div>`;}
        voting(){const g=this.game;return `<div class="a-prompt compact"><span class="a-tag">ONE SECRET HOUSE ANSWER. EVERYONE ELSE IS BLUFFING.</span><h2>${esc(g.prompt)}</h2></div><div class="a-options" id="bluffOptions"></div><p id="voteStatus" class="a-hint" aria-live="polite"></p>`;}
        reveal(){const g=this.game;return g.kind==='sketch'?`<div class="a-reveal-word"><span class="a-tag">THE SECRET WORD WAS</span><h2>${esc(g.word.answer)}</h2><p>${esc(g.note)}</p><div class="a-round-gains">${g.players.filter(p=>p.active).map(p=>`<div><span>${esc(p.name)}</span><strong>+${p.roundScore}</strong></div>`).join('')}</div></div><div class="a-ink-board recap" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Finished drawing"></canvas></div>`:`<div class="a-prompt compact"><span class="a-tag">THE ANSWER WAS ON THE CARD ALL ALONG</span><h2>${esc(g.prompt)}</h2></div><div class="a-options revealed" id="bluffOptions"></div>`;}
        results(){const g=this.game;const sorted=[...g.players].sort((a,b)=>b.score-a.score);const top=sorted[0]?.score;const winners=sorted.filter(p=>p.score===top).map(p=>p.name);return `<div class="a-results"><div class="a-trophy" aria-hidden="true">✦</div><span class="a-tag">${winners.length>1?'SHARED BRAGGING RIGHTS':'THE ROOM HAS A CHAMPION'}</span><h2>${esc(winners.join(' & '))}</h2><p>${esc(g.note)}</p><ol class="a-final-board">${sorted.map((p,i)=>`<li><span class="a-final-rank">${p.score===top?'♛':i+1}</span><div><strong>${esc(p.name)}</strong><div class="a-badges">${p.badges.map(b=>`<span>${esc(b)}</span>`).join('')}</div></div><b>${p.score}<small>points</small></b></li>`).join('')}</ol><div class="a-actions">${this.host?'<button class="a-primary" data-act="rematch">One more round ↗</button><button class="a-secondary" data-act="cancel">Choose another game</button>':'<p class="a-hint">Waiting for the host to set up a rematch.</p>'}</div></div>`;}
        updatePhase(){
            const g=this.game;if(!g)return;
            if(g.phase==='lobby'){
                $('lobbyPlayers').innerHTML=g.players.filter(p=>p.active).map(p=>`<div class="a-lobby-player"><span class="a-avatar">${esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}${p.id===g.hostId?' <small>HOST</small>':''}</strong><span class="a-ready ${p.ready&&p.online?'yes':''}">${!p.online?'Reconnecting':p.ready?'Ready ✓':'Not ready'}</span></div>`).join('');
                this.dialog.querySelectorAll('[data-pace]').forEach(b=>{b.classList.toggle('selected',b.dataset.pace===g.pace);b.disabled=!this.host;b.setAttribute('aria-pressed',String(b.dataset.pace===g.pace));});
                const ready=g.players.filter(p=>p.active&&p.online);const canStart=ready.length>=2&&ready.every(p=>p.ready);
                $('lobbyActions').innerHTML=g.isPlayer?`${this.host?`<button class="a-primary" data-act="start" ${canStart?'':'disabled'}>${canStart?'Start the fun ↗':ready.length<2?'Waiting for a friend…':'Waiting for ready players…'}</button>`:`<button class="a-primary" data-ready="${!this.me?.ready}">${this.me?.ready?'Ready ✓ — unready?':'I’m ready ↗'}</button>`}<button class="a-secondary" data-act="invite">Invite the call</button><button class="a-link" data-act="leave">Leave game</button>`:'<button class="a-primary" data-act="join">Count me in ↗</button>';
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
            aside.innerHTML=`<div class="a-score-heading"><span>THE SCOREBOARD</span><span>${players.length}/4</span></div>${players.map((p,i)=>`<div class="a-score-row ${p.id===this.manager.userId?'is-me':''}"><span class="a-score-rank">${i===0&&p.score>0?'♛':String(i+1).padStart(2,'0')}</span><div><strong>${esc(p.name)}${p.id===this.manager.userId?' <small>you</small>':''}</strong><small class="a-presence ${p.online?'online':''}">${p.online?(g.kind==='sketch'&&p.id===g.artistId&&g.phase!=='lobby'?'✎ Artist':'In the call'):'Reconnecting'}</small></div><b>${p.score}${['reveal','finished'].includes(g.phase)&&p.roundScore?`<small>+${p.roundScore}</small>`:''}</b></div>`).join('')}<details class="a-rules"><summary>Rules & scoring</summary><p>${RULES[g.kind]}</p></details>${this.host?'<button class="a-link a-end-game" data-confirm-close>End this game</button>':''}`;
        }
        renderReactions(){const wrap=$('activityReactions');if(!this.game?.isPlayer){wrap.replaceChildren();return;}if(wrap.children.length)return;wrap.innerHTML=['👏','😂','🔥','🦆'].map(e=>`<button data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('');}
        tick(){
            const g=this.game;if(!g?.deadline)return;
            const seconds=Math.max(0,Math.ceil((g.deadline-Date.now()-this.offset)/1000));$('activityTime').textContent=String(seconds).padStart(2,'0');$('activityClock').classList.toggle('urgent',seconds<=10);
        }
        updateMic(){const b=$('activityMic');b.textContent=this.manager.isMicOn?'Mic on':'Mic off';b.setAttribute('aria-label',this.manager.isMicOn?'Mute microphone':'Unmute microphone');b.classList.toggle('muted',!this.manager.isMicOn);}
        click(event){
            const b=event.target.closest('button');if(!b||b.disabled)return;
            if(b.dataset.create){if(!this.socket.connected)return this.notice('Wait for the call to reconnect.',true);this.socket.emit('game-create',{kind:b.dataset.create,pace:'quick'});}
            else if(b.dataset.act)this.send(b.dataset.act);
            else if(b.dataset.ready)this.send('ready',{ready:b.dataset.ready==='true'});
            else if(b.dataset.pace)this.send('settings',{pace:b.dataset.pace});
            else if(b.dataset.word!==undefined)this.send('choose',{index:Number(b.dataset.word)});
            else if(b.dataset.option)this.send('vote',{optionId:b.dataset.option});
            else if(b.dataset.color){this.color=b.dataset.color;this.updatePhase();}
            else if(b.dataset.width){this.width=Number(b.dataset.width);this.updatePhase();}
            else if(b.dataset.emoji)this.send('reaction',{emoji:b.dataset.emoji});
            else if(b.hasAttribute('data-confirm-close')){if(b.dataset.confirmed==='yes')this.send('cancel');else{b.dataset.confirmed='yes';b.textContent=b.id==='activityEndMobile'?'Sure?':'End for everyone? Click again';setTimeout(()=>{if(b.isConnected){b.dataset.confirmed='';b.textContent=b.id==='activityEndMobile'?'End':'End this game';}},4000);}}
        }
        submit(event){
            const form=event.target;if(!form.dataset.form)return;event.preventDefault();
            const input=form.querySelector('input,textarea'),text=input.value.trim();if(!text)return;
            if(form.dataset.form==='guess'){this.send('guess',{text});input.value='';input.focus();}
            else this.send('submit',{text});
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
