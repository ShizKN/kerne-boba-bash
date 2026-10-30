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
    const GAMES = {
        sketch:{description:'Draw a word. Let your friends guess.',duration:'3–6 min',steps:['Pick a secret word.','Draw it without letters.','Your friends type their guesses.']},
        bluff:{description:'Make up answers and fool your friends.',duration:'4–7 min',steps:['Read the silly question.','Write a fake answer.','Find the original among everyone’s answers.']},
        blocks:{description:'Tap matching blocks. Beat your friends.',duration:'75 sec',steps:['Find touching blocks of the same color.','Tap a group of 2 or more to pop it.','Keep popping to build your combo.']}
    };
    const TOOL_ART = {
        watch:'<svg viewBox="0 0 180 130" aria-hidden="true"><rect x="17" y="23" width="146" height="88" rx="16" fill="#ff555f"/><path d="m76 47 37 20-37 21z" fill="white"/><path d="m24 13 8 5m110-9-5 10M12 99l-6 4" stroke="#ffc9cc" stroke-width="4" stroke-linecap="round"/></svg>',
        sound:'<svg viewBox="0 0 180 130" aria-hidden="true"><g fill="#95ead4"><rect x="27" y="48" width="17" height="43" rx="7"/><rect x="54" y="27" width="17" height="85" rx="7"/><rect x="81" y="39" width="17" height="60" rx="7"/><rect x="108" y="15" width="17" height="108" rx="7"/><rect x="135" y="48" width="17" height="43" rx="7"/></g></svg>',
        focus:'<svg viewBox="0 0 180 130" aria-hidden="true"><circle cx="90" cy="67" r="47" fill="#252e4d" stroke="#9db1ff" stroke-width="9"/><path d="M90 36v32l22 13" fill="none" stroke="#d7e0ff" stroke-width="7" stroke-linecap="round"/><circle cx="90" cy="67" r="5" fill="#d7e0ff"/></svg>'
    };
    class Activities {
        constructor(manager) {
            this.manager=manager; this.socket=manager.socket; this.game=null; this.signature=''; this.pending=new Map(); this.color='#1a1a1a'; this.width=5; this.sound=false; this.offset=0; this.mode='games'; this.browsing=true; this.filter='all'; this.search=''; this.tool='watch'; this.media={video:{id:'',playing:false,position:0,at:0},radio:{station:'off',at:0}};
            this.button=document.createElement('button'); this.button.className='control-btn'; this.button.id='activitiesBtn'; this.button.title='Activities'; this.button.setAttribute('aria-label','Activities'); this.button.innerHTML=PAD;
            document.querySelector('.controls').insertBefore(this.button,$('roomMore'));
            this.dialog=document.createElement('dialog'); this.dialog.id='activitiesDialog'; this.dialog.setAttribute('aria-labelledby','activityTitle');
            this.dialog.innerHTML=`<div class="a-shell"><header class="a-header"><div class="a-header-title"><button id="activityBrowse" class="a-icon" aria-label="Back to activities" hidden>←</button><button class="a-brand" id="activityBrand" aria-label="KERNE activities"><b>K</b><span id="activitySection">Activities</span></button></div><div class="a-header-actions"><button id="activityEndMobile" class="a-end-mobile" data-confirm-close hidden>End game</button><button id="activitySound" class="a-small" aria-pressed="false" title="Enable activity sounds">Sound off</button><button id="activityClose" class="a-back" aria-label="Back to call"><span class="a-close-label">Back to call</span><span aria-hidden="true">×</span></button></div></header><div class="a-connection" id="activityConnection" hidden>Reconnecting… Your progress is saved.</div><div class="a-call-strip" id="activityCameras" aria-label="Call participants"></div><div class="a-topline"><div><p class="a-eyebrow" id="activityEyebrow"></p><h1 id="activityTitle">Activities</h1></div><div class="a-clock" id="activityClock" hidden><span aria-hidden="true">◷</span><output id="activityTime" aria-live="off">00</output></div></div><div class="a-layout"><main id="activityContent" class="a-content"></main><aside id="activityScores" class="a-scores" aria-label="Live scores"></aside></div><footer class="a-footer"><span class="a-live"><i></i>Your call stays connected</span><div id="activityReactions" class="a-reaction-buttons" aria-label="Reactions"></div><button id="activityMic" class="a-small">Mic</button></footer><div id="activityNotice" class="a-notice" role="status" aria-live="polite"></div><div id="activityConfetti" class="a-confetti" aria-hidden="true"></div></div>`;
            document.body.append(this.dialog);
            this.button.onclick=()=>this.browse(); $('activityClose').onclick=()=>this.dialog.close();$('activityBrowse').onclick=()=>this.browse();
            this.dialog.addEventListener('close',()=>{this.pointer=null;this.pending.clear();this.watchSilenceUntil=Date.now()+2000;this.player?.pauseVideo?.();});
            $('activityMic').onclick=()=>this.manager.toggleMic();
            $('activitySound').onclick=()=>this.setSound(!this.sound);
            $('activityBrand').onclick=()=>{this.eggTaps=(this.eggTaps||0)+1; if(this.eggTaps%5===0&&this.game?.isPlayer)this.send('egg');};
            this.dialog.addEventListener('click',event=>this.click(event));
            this.dialog.addEventListener('submit',event=>this.submit(event));
            this.dialog.addEventListener('input',event=>{if(event.target.id==='activitySearch'){this.search=event.target.value;this.filterCatalog();}});
            this.socket.on('game-state',({game,serverNow})=>this.receive(game,serverNow));
            this.socket.on('focus-state',({focus,serverNow})=>this.receiveFocus(focus,serverNow));
            this.socket.on('focus-error',({message})=>this.notice(message,true));
            this.socket.on('game-stroke',message=>this.receiveStroke(message));
            this.socket.on('game-error',({message})=>{this.notice(message,true);this.pending.clear();this.pointer=null;if(this.launching){this.signature='';this.browsing=true;}this.launching=false;this.render();this.socket.emit('game-get',{});});
            this.socket.on('game-reaction',({emoji,playerId})=>this.reaction(emoji,playerId));
            this.socket.on('game-invite',({from,kind})=>{if(!this.dialog.open){this.button.classList.add('has-notif');UI.showToast(`${from} invited you to ${NAMES[kind]||'play'}. Open Activities.`);}});
            this.socket.on('media-state',data=>{this.media={video:data.video,radio:data.radio};this.mediaOffset=(data.serverNow||Date.now())-Date.now();if(this.dialog.open&&this.mode==='together')this.updateTogether();if(this.sound)this.startRadio();});
            this.socket.on('sound-play',({id,from})=>{if(this.sound)this.playSfx(id);if(this.dialog.open&&this.mode==='together')this.notice(`${from} played ${id}`);});
            this.socket.on('disconnect',()=>{$('activityConnection').hidden=false;this.pointer=null;this.pending.clear();this.stopRadio();this.launching=false;this.signature='';this.render();});
            this.socket.on('room-joined',()=>{this.socket.emit('game-get',{});this.socket.emit('focus-control',{action:'get'});$('activityConnection').hidden=true;});
            this.focusDock=document.createElement('button');this.focusDock.id='focusDock';this.focusDock.hidden=true;this.focusDock.setAttribute('aria-label','Open room focus timer');this.focusDock.onclick=()=>{this.mode='focus';this.open();};$('videoGrid').append(this.focusDock);
            this.timer=setInterval(()=>{this.tickFocus();if(this.dialog.open){this.tick();this.updateMic();}},250);
        }
        get me(){return this.game?.players.find(p=>p.id===this.manager.userId&&p.active);}
        get host(){return this.game?.hostId===this.manager.userId;}
        open(){if(!this.dialog.open)this.dialog.showModal();this.button.classList.remove('has-notif');this.signature='';this.render();this.refreshCameras();this.socket.emit('game-get',{});this.socket.emit('focus-control',{action:'get'});}
        browse(){
            this.mode='games';this.browsing=true;this.selectedKind=null;this.signature='';
            this.watchSilenceUntil=Date.now()+2000;this.player?.destroy?.();this.player=null;this.videoId=null;
            this.open();
        }
        setSound(enabled){
            this.sound=enabled;const button=$('activitySound');button.textContent=enabled?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(enabled));
            if(enabled){this.audioContext().resume();this.tone();this.startRadio();}else this.stopRadio();
        }
        send(action,data={}){
            if(!this.socket.connected){this.notice('The call is reconnecting. Try again in a moment.',true);return;}
            this.socket.emit('game-action',{action,gameId:this.game?.id,round:this.game?.round,...data});
        }
        notice(message,error=false){const n=$('activityNotice');n.textContent=message;n.className=`a-notice show${error?' is-error':''}`;clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>n.classList.remove('show'),4200);}
        receive(game,serverNow){
            const old=this.game;clearTimeout(this.launchTimer);this.launching=false;this.offset=(serverNow||Date.now())-Date.now();this.game=game;
            if(!game||game.id!==old?.id||game.round!==old?.round){this.pending.clear();this.pointer=null;}
            if(game?.id!==old?.id){$('activityEndMobile').dataset.confirmed='';}
            if(game&&game.id!==old?.id&&!this.dialog.open){this.button.classList.add('has-notif');UI.showToast(`${NAMES[game.kind]} is open. Join from Activities.`);}
            if(game?.isPlayer&&(!old?.isPlayer||game.id!==old?.id)){this.browsing=false;this.selectedKind=null;}
            if(!game&&old){this.browsing=true;this.selectedKind=null;}
            this.button.classList.toggle('active',!!game);
            if(this.dialog.open){this.render();if(game&&game.phase!==old?.phase){this.tone();if(game.phase==='finished')this.confetti();}}
        }
        render(){
            if(!this.dialog.open)return;
            const g=this.game,content=$('activityContent'),catalog=this.mode==='games'&&(!g||this.browsing);
            this.dialog.classList.toggle('is-catalog',catalog&&!this.selectedKind);
            this.dialog.classList.toggle('is-playing',!catalog&&this.mode==='games');
            this.dialog.classList.toggle('is-detail',catalog&&!!this.selectedKind);
            this.dialog.classList.toggle('is-media',this.mode==='together');
            this.dialog.classList.toggle('is-blocks',!catalog&&this.mode==='games'&&g?.phase==='blocks');
            $('activityBrowse').hidden=catalog&&!this.selectedKind;
            $('activitySection').textContent=catalog?'Activities':this.mode==='games'?NAMES[g?.kind]||'Activities':this.mode==='focus'?'Focus timer':'Watch & listen';
            $('activityCameras').hidden=catalog;
            if(this.mode==='together'){this.renderTogether();this.refreshCameras();this.updateMic();return;}
            if(this.mode==='focus'){this.renderFocus();this.refreshCameras();this.updateMic();return;}
            const artist=g?.artistId===this.manager.userId;
            const titles={lobby:'Who’s playing?',choose:artist?'Choose a word to draw':'Waiting for the artist',draw:artist?'Draw the word':'Guess the drawing',write:'Write a fake answer',vote:'Find the original answer',blocks:'Tap matching blocks',reveal:'The answer is…',finished:'Final scores',paused:'Waiting for a player'};
            $('activityTitle').textContent=catalog?(this.selectedKind?NAMES[this.selectedKind]:'Choose an activity'):titles[g.phase]||NAMES[g.kind];
            $('activityEyebrow').textContent=catalog?'':`${g.solo?'Solo practice · ':''}${g.phase==='lobby'?'Friends in this call':`Round ${g.round} / ${g.totalRounds}`}`;
            $('activityClock').hidden=catalog||!g?.deadline;
            const end=$('activityEndMobile');end.hidden=catalog||!g||!this.host;
            if(end.dataset.confirmed!=='yes')end.textContent='End game';
            const signature=catalog?`catalog:${this.selectedKind||'all'}`:`${g.id}:${g.phase}:${g.round}:${g.isPlayer}:${artist}`;
            if(signature!==this.signature){
                this.signature=signature;this.pointer=null;
                if(catalog)content.innerHTML=this.home();
                else if(g.phase==='lobby')content.innerHTML=this.lobby();
                else if(g.phase==='choose')content.innerHTML=this.choose();
                else if(g.phase==='draw')content.innerHTML=this.drawing();
                else if(g.phase==='write')content.innerHTML=this.writing();
                else if(g.phase==='vote')content.innerHTML=this.voting();
                else if(g.phase==='blocks')content.innerHTML=this.blocks();
                else if(g.phase==='reveal')content.innerHTML=this.reveal();
                else if(g.phase==='finished')content.innerHTML=this.results();
                else content.innerHTML='<div class="a-wait"><h2>A player disconnected.</h2><p>The game resumes when they return. Scores and drawings are saved.</p></div>';
                content.scrollTop=0;
                if($('sketchCanvas'))this.bindCanvas();
                if($('bluffText'))$('bluffText').addEventListener('input',()=>{$('bluffCount').textContent=`${$('bluffText').value.length}/80`;});
            }
            if(catalog){this.filterCatalog();this.updateActiveGame();$('activityScores').hidden=true;$('activityReactions').replaceChildren();}
            else {this.updatePhase();this.renderScores();this.renderReactions();}
            this.refreshCameras();this.tick();this.updateMic();
        }
        home(){
            if(this.selectedKind){const kind=this.selectedKind,info=GAMES[kind];return `<section class="a-detail"><div class="a-preview ${kind}">${ART[kind]}</div><div class="a-detail-body"><span class="a-meta">${info.duration} · 2–4 friends or solo</span><h2>${NAMES[kind]}</h2><p>${info.description}</p><ol class="a-steps">${info.steps.map(step=>`<li>${step}</li>`).join('')}</ol><div class="a-launch-actions">${this.game?'<p>A game is already open in this call.</p><button class="a-primary" data-return-game>Go to current game</button>':`<button class="a-primary" data-create="${kind}">Play with friends</button><button class="a-secondary" data-create="${kind}" data-solo="true">Practice solo <small>with 2 bots</small></button>`}</div></div></section>`;}
            return `<div id="activityCurrentGame" class="a-current-game" hidden></div><label class="a-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="activitySearch" type="search" placeholder="Find an activity" aria-label="Find an activity" value="${esc(this.search)}" autocomplete="off"></label><div class="a-filters" aria-label="Activity categories">${[['all','All'],['games','Games'],['hangout','Watch & listen'],['focus','Focus']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${this.filter===id}">${label}</button>`).join('')}</div><div class="a-catalog-grid">${Object.entries(GAMES).map(([kind,info])=>`<button class="a-catalog-card" data-details="${kind}" data-category="games" data-searchable="${esc(`${NAMES[kind]} ${info.description}`.toLowerCase())}"><div class="a-preview ${kind}">${ART[kind]}<span>${info.duration}</span></div><div class="a-card-copy"><h2>${NAMES[kind]}</h2><p>${info.description}</p><small>Solo · 2–4 players</small></div></button>`).join('')}${[['watch','Watch Together','Watch a YouTube video in sync.','hangout'],['sound','Music & sounds','Play sounds or put on a shared radio.','hangout'],['focus','Focus timer','Pomodoro or deep work for the whole room.','focus']].map(([id,name,description,category])=>`<button class="a-catalog-card" data-tool="${id}" data-category="${category}" data-searchable="${esc(`${name} ${description}`.toLowerCase())}"><div class="a-preview ${id}">${TOOL_ART[id]}</div><div class="a-card-copy"><h2>${name}</h2><p>${description}</p><small>Everyone in this call</small></div></button>`).join('')}</div><p id="activityEmpty" class="a-empty" hidden>No activities found. Try another name.</p>`;
        }
        updateActiveGame(){
            const banner=$('activityCurrentGame');if(!banner)return;const g=this.game;banner.hidden=!g;
            if(g)banner.innerHTML=`<div><strong>${esc(NAMES[g.kind])}</strong><span>${g.phase==='lobby'?'Your friends are getting ready.':'A game is running in this call.'}</span></div><button class="a-primary" data-return-game>${g.isPlayer?'Return to game':g.phase==='lobby'?'Join game':'Watch game'}</button>`;
        }
        filterCatalog(){
            const query=this.search.trim().toLowerCase();let count=0;
            this.dialog.querySelectorAll('[data-searchable]').forEach(card=>{card.hidden=!(this.filter==='all'||card.dataset.category===this.filter)||!card.dataset.searchable.includes(query);if(!card.hidden)count++;});
            this.dialog.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===this.filter)));
            if($('activityEmpty'))$('activityEmpty').hidden=count>0;
        }
        lobby(){const g=this.game;return `<section class="a-lobby"><div class="a-preview ${g.kind}">${ART[g.kind]}</div><div class="a-lobby-body"><h2>${NAMES[g.kind]}</h2><p>${GAMES[g.kind].description}</p><div id="lobbyPlayers" class="a-lobby-players"></div><div id="lobbyActions" class="a-actions"></div><p class="a-hint">Friends can join from Activities in this call.</p><details class="a-rules"><summary>Game settings</summary><div class="a-pace"><button data-pace="quick">Quick game</button><button data-pace="classic">Longer game</button></div></details></div></section><details class="a-rules"><summary>How to play</summary><ol class="a-steps">${GAMES[g.kind].steps.map(step=>`<li>${step}</li>`).join('')}</ol></details>`;}

        blocks(){return `<div class="a-instruction"><span>Tap 2+ touching blocks of the same color.</span><button class="a-small" data-block-hint>Show a match</button></div><div class="a-block-arena"><div class="a-block-board" id="blockBoard" role="group" aria-label="Your block board"></div><aside class="a-block-rivals" hidden><div id="blockRivals"></div></aside></div><div class="a-block-status"><div class="a-block-combo" id="blockCombo">×1<small>combo</small></div><p id="blockFeed" aria-live="polite">Find a pair to start.</p></div>`;}

        choose(){const g=this.game,artist=g.players.find(p=>p.id===g.artistId);return g.artistId===this.manager.userId?`<div class="a-choose"><p>Which one can you draw?</p><div class="a-word-options">${(g.word.choices||[]).map((word,index)=>`<button data-word="${index}">${esc(word)}<span aria-hidden="true">→</span></button>`).join('')}</div><p class="a-hint">Your word stays secret. Draw shapes, not letters.</p></div>`:`<div class="a-wait"><div class="a-wait-art">${ART.sketch}</div><h2>${esc(artist?.name||'The artist')} is choosing.</h2><p>The drawing will appear here. Type your guess below it.</p></div>`;}

        drawing(){const artist=this.game.artistId===this.manager.userId;return `<div class="a-sketch-head"><span class="a-tag" id="sketchRole"></span><strong id="sketchWord" class="a-secret"></strong></div><div class="a-ink-board" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Shared game drawing">Your browser needs Canvas to show drawings.</canvas></div>${artist?`<div class="a-draw-tools"><div class="a-palette" role="group" aria-label="Pen color">${['#1a1a1a','#e04b45','#e8b629','#3d9c70','#377dda','#9663c4','#ec83ad','#ffffff'].map((c,i)=>`<button data-color="${c}" style="--swatch:${c}" title="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}" aria-label="${['Ink','Red','Yellow','Green','Blue','Purple','Pink','Eraser'][i]}"></button>`).join('')}</div><button class="a-small" data-width="5">Fine</button><button class="a-small" data-width="14">Bold</button><button class="a-small" data-act="undo">↶ Undo</button><button class="a-small" data-act="clear">Clear</button></div>`:`<form class="a-form" data-form="guess"><input id="guessText" name="guess" autocomplete="off" maxlength="60" placeholder="Type your guess…" aria-label="Your guess"><button class="a-primary" type="submit">Guess</button></form><p id="guessStatus" class="a-hint" aria-live="polite"></p>`}<div id="sketchFeed" class="a-feed" aria-live="polite" aria-relevant="additions text"></div>`;}
        writing(){const g=this.game;return `<div class="a-phase-steps"><strong>1. Make it up</strong><span>2. Pick the original</span><span>3. See who you fooled</span></div><div class="a-prompt"><small>Finish this made-up sentence:</small><h2>${esc(g.prompt)}</h2></div>${g.isPlayer?`<form class="a-bluff-form" data-form="bluff"><label for="bluffText">Invent an answer your friends might believe.</label><textarea id="bluffText" maxlength="80" rows="2" placeholder="Your fake answer…" required></textarea><div class="a-form-foot"><span id="bluffCount">0/80</span><button class="a-primary" type="submit" id="lockBluff">Send answer</button></div></form><div id="bluffLocked" class="a-locked" hidden><strong>✓ Answer sent</strong><p id="myBluff"></p><small>Wait for the others. Then you’ll pick an answer.</small></div>`:'<p class="a-spectator">You’re watching. Join the next game to play.</p>'}<div class="a-submission-progress"><span id="submissionLabel"></span><progress id="submissionProgress" max="4" value="0"></progress></div>`;}

        voting(){const g=this.game;return `<div class="a-phase-steps"><span>1. Make it up</span><strong>2. Pick the original</strong><span>3. See who you fooled</span></div><div class="a-prompt compact"><small>One answer came with the question. The others were made up by players.</small><h2>${esc(g.prompt)}</h2></div><div class="a-options" id="bluffOptions"></div><p id="voteStatus" class="a-hint" aria-live="polite"></p>`;}

        reveal(){const g=this.game;return g.kind==='sketch'?`<div class="a-reveal-word"><span class="a-tag">THE SECRET WORD WAS</span><h2>${esc(g.word.answer)}</h2><p>${esc(g.note)}</p><div class="a-round-gains">${g.players.filter(p=>p.active).map(p=>`<div><span>${esc(p.name)}</span><strong>+${p.roundScore}</strong></div>`).join('')}</div></div><div class="a-ink-board recap" id="sketchBoard"><canvas id="sketchCanvas" width="960" height="600" aria-label="Finished drawing"></canvas></div>`:`<div class="a-prompt compact"><span class="a-tag">Which answer was the original?</span><h2>${esc(g.prompt)}</h2></div><div class="a-options revealed" id="bluffOptions"></div>`;}
        results(){const g=this.game;const sorted=[...g.players].sort((a,b)=>b.score-a.score);const top=sorted[0]?.score;const winners=sorted.filter(p=>p.score===top).map(p=>p.name);return `<div class="a-results"><div class="a-trophy" aria-hidden="true">✦</div><span class="a-tag">${winners.length>1?'It’s a tie':'Winner'}</span><h2>${esc(winners.join(' & '))}</h2><p>${esc(g.note)}</p><ol class="a-final-board">${sorted.map((p,i)=>`<li><span class="a-final-rank">${p.score===top?'♛':i+1}</span><div><strong>${esc(p.name)}</strong><div class="a-badges">${p.badges.map(b=>`<span>${esc(b)}</span>`).join('')}</div></div><b>${p.score}<small>points</small></b></li>`).join('')}</ol><div class="a-actions">${this.host?'<button class="a-primary" data-act="rematch">Play again</button><button class="a-secondary" data-act="cancel">Back to activities</button>':'<p class="a-hint">Waiting for the host to set up a rematch.</p>'}</div></div>`;}
        updatePhase(){
            const g=this.game;if(!g)return;
            if(g.phase==='lobby'){
                $('lobbyPlayers').innerHTML=g.players.filter(p=>p.active).map(p=>`<div class="a-lobby-player"><span class="a-avatar">${esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}${p.id===g.hostId?' <small>Host</small>':p.bot?' <small>Bot</small>':''}</strong><span class="a-ready">${p.online?'Joined':'Reconnecting…'}</span></div>`).join('');
                this.dialog.querySelectorAll('[data-pace]').forEach(button=>{button.classList.toggle('selected',button.dataset.pace===g.pace);button.disabled=!this.host;button.setAttribute('aria-pressed',String(button.dataset.pace===g.pace));});
                const players=g.players.filter(p=>p.active&&p.online),canStart=players.length>=2;
                $('lobbyActions').innerHTML=g.isPlayer?`${this.host?`<button class="a-primary" data-act="start" ${canStart?'':'disabled'}>${canStart?`Start game · ${players.length} players`:'Waiting for one more player'}</button>`:'<p class="a-hint">You’re in. The host will start the game.</p>'}${this.host&&players.length===1?'<button class="a-secondary" data-act="solo">Practice with bots instead</button>':''}<button class="a-small" data-act="invite">Invite the call</button><button class="a-link" data-act="leave">Leave game</button>`:'<button class="a-primary" data-act="join">Join game</button>';
            }
            if(g.phase==='draw'){
                const artist=g.artistId===this.manager.userId;
                $('sketchRole').textContent=artist?'Draw this:':`${g.players.find(p=>p.id===g.artistId)?.name||'The artist'} is drawing`;
                $('sketchWord').textContent=artist?g.word.answer:g.word.mask;
                const input=$('guessText');if(input){input.disabled=!g.isPlayer||g.guessed;input.form.querySelector('button').disabled=input.disabled;$('guessStatus').textContent=!g.isPlayer?'Spectating — join the next match.':g.guessed?'✓ Correct. Wait for the others.':'Look at the drawing and type your guess.';}
                this.dialog.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===this.color)));
                this.dialog.querySelectorAll('[data-width]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.width)===this.width));
                const feed=$('sketchFeed');feed.replaceChildren(...g.feed.filter(item=>['guess','correct','hint'].includes(item.kind)).map(item=>{const node=document.createElement('p');node.className=item.kind;node.textContent=item.text;return node;}));feed.scrollTop=feed.scrollHeight;
            }
            if(g.kind==='sketch'&&$('sketchCanvas'))this.paintCanvas();
            if(g.phase==='blocks'){
                const board=g.boards?.[this.manager.userId];
                const boardKey=board?.join('')||'spectator';
                if(this.lastBoardKey!==boardKey||!$('blockBoard').children.length){
                    $('blockBoard').innerHTML=board?board.map((color,i)=>`<button class="a-cube c${color}" data-block="${i}" aria-label="Pop ${['coral','sun','mint','sky','violet'][color]} block at row ${Math.floor(i/6)+1}, column ${i%6+1}"><span></span></button>`).join(''):'<p>Join the next round to play.</p>';
                    this.lastBoardKey=boardKey;if(!this.me?.score)this.hintBlocks();
                }
                const me=this.me, last=g.blockLast;
                $('blockCombo').innerHTML=`×${me?.combo||1}<small>combo</small>`;
                $('blockRivals').innerHTML=g.players.filter(p=>p.active&&p.id!==this.manager.userId).map(p=>`<div><span>${esc(p.name)}</span><b>${p.score}</b></div>`).join('');
                $('blockFeed').textContent=last?`${g.players.find(p=>p.id===last.playerId)?.name||'Someone'} popped ${last.size} cubes · +${last.points} points`:me?'Tap a highlighted group to start.':'Watch the scores climb.';
                if(last?.at&&last.at!==this.lastBlockEffectAt){this.lastBlockEffectAt=last.at;if(last.playerId===this.manager.userId)this.blockEffect(last);}
            }
            if(g.phase==='write'){
                const input=$('bluffText');if(input){input.form.hidden=g.submitted;$('bluffLocked').hidden=!g.submitted;$('myBluff').textContent=g.mySubmission||'';}
                const count=g.players.filter(p=>p.active&&p.online).length;
                $('submissionLabel').textContent=`${g.submissionCount} of ${count} bluffs locked in`;$('submissionProgress').max=Math.max(count,1);$('submissionProgress').value=g.submissionCount;
            }
            if(g.kind==='bluff'&&['vote','reveal'].includes(g.phase)){
                const reveal=g.phase==='reveal';
                $('bluffOptions').innerHTML=g.options.map((o,i)=>`<button class="a-option ${g.myVote===o.id?'voted':''} ${reveal&&o.isAnswer?'truth':''}" data-option="${esc(o.id)}" ${reveal||!g.isPlayer||g.myVote||o.id===g.ownOptionId?'disabled':''}><span class="a-option-letter">${String.fromCharCode(65+i)}</span><div><strong>${esc(o.text)}</strong>${reveal?`<small>${o.isAnswer?'✓ ORIGINAL ANSWER':o.authors.length?`Made up by ${esc(o.authors.join(', '))}`:'Extra answer'}</small><div class="a-voters">${o.voters.length?o.voters.map(v=>`<span>${esc(v)}</span>`).join(''):'No votes'}</div>`:o.id===g.ownOptionId?'<small>Your answer</small>':''}</div><span class="a-option-mark">${g.myVote===o.id?'✓':reveal&&o.isAnswer?'✦':'↗'}</span></button>`).join('');
                if($('voteStatus'))$('voteStatus').textContent=g.myVote?`✓ Vote locked. ${g.votedCount} of ${g.players.filter(p=>p.active&&p.online).length} players have voted.`:g.isPlayer?'Tap the answer you think came with the question.':'You’re watching. Join the next match.';
            }
        }
        renderScores(){
            const g=this.game,aside=$('activityScores');aside.hidden=!g||['lobby','finished'].includes(g.phase);
            if(!g){aside.replaceChildren();return;}
            const players=[...g.players].filter(p=>p.active).sort((a,b)=>b.score-a.score);
            aside.innerHTML=players.map((p,index)=>`<div class="a-score-chip ${p.id===this.manager.userId?'is-me':''}"><span>${index===0&&p.score>0?'♛':esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}${p.bot?' <small>bot</small>':''}</strong><b>${p.score}</b></div>`).join('');
        }
        blockGroup(index){
            const board=this.game?.boards?.[this.manager.userId];if(!board)return [];
            const seen=new Set([index]),queue=[index];
            for(const i of queue)for(const next of [i%6?i-1:-1,i%6<5?i+1:-1,i>=6?i-6:-1,i<30?i+6:-1])if(next>=0&&!seen.has(next)&&board[next]===board[index]){seen.add(next);queue.push(next);}
            return queue;
        }
        hintBlocks(){
            const board=this.game?.boards?.[this.manager.userId];if(!board)return;
            let group=[];for(let index=0;index<board.length;index++){group=this.blockGroup(index);if(group.length>=2)break;}
            this.dialog.querySelectorAll('[data-block]').forEach(tile=>tile.classList.toggle('is-match',group.includes(Number(tile.dataset.block))));
        }
        renderReactions(){const wrap=$('activityReactions');if(!this.game?.isPlayer){wrap.replaceChildren();return;}if(wrap.children.length)return;wrap.innerHTML=['👏','😂','🔥','🦆'].map(e=>`<button data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('');}
        tick(){
            const g=this.game;if(!g?.deadline)return;
            if(g.phase==='blocks'&&$('blockCombo')){const me=this.me,active=me?.lastBlockAt&&Date.now()+this.offset-me.lastBlockAt<3500;$('blockCombo').innerHTML=`×${active?me.combo||1:1}<small>combo</small>`;}
            const seconds=Math.max(0,Math.ceil((g.deadline-Date.now()-this.offset)/1000));$('activityTime').textContent=String(seconds).padStart(2,'0');$('activityClock').classList.toggle('urgent',seconds<=10);
        }
        updateMic(){const b=$('activityMic');b.textContent=this.manager.isMicOn?'Mic on':'Mic off';b.setAttribute('aria-label',this.manager.isMicOn?'Mute microphone':'Unmute microphone');b.classList.toggle('muted',!this.manager.isMicOn);}
        click(event){
            const b=event.target.closest('button');if(!b||b.disabled)return;
            if(b.dataset.filter){this.filter=b.dataset.filter;this.filterCatalog();return;}
            if(b.dataset.details){this.selectedKind=b.dataset.details;this.browsing=true;this.signature='';this.render();return;}
            if(b.hasAttribute('data-return-game')){this.selectedKind=null;this.browsing=false;this.mode='games';if(this.game?.phase==='lobby'&&!this.game.isPlayer)this.send('join');this.signature='';this.render();return;}
            if(b.dataset.tool){this.mode=b.dataset.tool==='focus'?'focus':'together';this.tool=b.dataset.tool==='sound'?'sound':b.dataset.tool;this.signature='';this.render();return;}
            if(b.dataset.mediaTab){this.tool=b.dataset.mediaTab;this.watchSilenceUntil=Date.now()+2000;if(this.tool!=='watch')this.player?.pauseVideo?.();this.renderTogether();return;}
            if(b.hasAttribute('data-block-hint')){this.hintBlocks();return;}
            if(b.dataset.focus){this.focusAction(b.dataset.focus);return;}
            if(b.dataset.preset){const [work,rest,long]=b.dataset.preset.split(',').map(Number);$('focusWork').value=work;$('focusBreak').value=rest;$('focusLong').value=long;this.dialog.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('selected',x===b));return;}
            if(b.dataset.sfx){if(!this.sound)this.setSound(true);this.socket.emit('sound-play',{id:b.dataset.sfx});return;}
            if(b.dataset.station){this.socket.emit('radio-control',{station:b.dataset.station});this.setSound(true);return;}
            if(b.dataset.watch){if(!this.player)return;const position=this.player.getCurrentTime()||0,playing=b.dataset.watch==='play';this.socket.emit('watch-control',{playing,position});return;}
            if(b.dataset.seek){if(!this.player)return;const position=Math.max(0,(this.player.getCurrentTime()||0)+Number(b.dataset.seek));this.socket.emit('watch-control',{playing:this.player.getPlayerState()===1,position});return;}
            if(b.dataset.create){if(!this.socket.connected)return this.notice('Wait for the call to reconnect.',true);if(this.launching)return;this.launching=true;b.disabled=true;b.textContent='Starting…';this.browsing=false;this.socket.emit('game-create',{kind:b.dataset.create,pace:'quick',solo:b.dataset.solo==='true'});this.launchTimer=setTimeout(()=>{if(this.launching){this.launching=false;this.browsing=true;this.signature='';this.render();this.notice('The game did not start. Try again.',true);}},8000);}
            else if(b.dataset.act)this.send(b.dataset.act);
            else if(b.dataset.pace)this.send('settings',{pace:b.dataset.pace});
            else if(b.dataset.word!==undefined)this.send('choose',{index:Number(b.dataset.word)});
            else if(b.dataset.option)this.send('vote',{optionId:b.dataset.option});
            else if(b.dataset.block!==undefined){const index=Number(b.dataset.block);if(this.blockGroup(index).length<2){this.notice('This block needs a matching neighbor. Try a highlighted group.');this.hintBlocks();return;}this.send('pop',{index});}
            else if(b.dataset.color){this.color=b.dataset.color;this.updatePhase();}
            else if(b.dataset.width){this.width=Number(b.dataset.width);this.updatePhase();}
            else if(b.dataset.emoji)this.send('reaction',{emoji:b.dataset.emoji});
            else if(b.hasAttribute('data-confirm-close')){if(b.dataset.confirmed==='yes'){b.dataset.confirmed='';this.send('cancel');}else{b.dataset.confirmed='yes';b.textContent=b.id==='activityEndMobile'?'End for all?':'End for everyone? Click again';setTimeout(()=>{if(b.isConnected){b.dataset.confirmed='';b.textContent=b.id==='activityEndMobile'?'End game':'End this game';}},4000);}}
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
                const form=$('focusForm');if(!form)return;if(!form.checkValidity())form.querySelector('details').open=true;if(!form.reportValidity())return;
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
            const f=this.focus,active=f&&f.phase!=='done',owner=f?.ownerId===this.manager.userId;
            $('activityTitle').textContent=active?(f.paused?'Timer paused':f.phase==='work'?'Time to focus':'Take a break'):'Focus together';
            $('activityEyebrow').textContent=active?`Room timer · block ${f.cycle}`:'One clock for everyone in this call';
            $('activityClock').hidden=true;$('activityEndMobile').hidden=true;$('activityScores').hidden=true;$('activityReactions').replaceChildren();
            const signature=`focus:${f?.revision||0}:${f?.phase||'idle'}`;
            if(this.signature!==signature){
                this.signature=signature;
                $('activityContent').innerHTML=active?`<section class="a-focus-running"><div class="a-focus-stage ${esc(f.phase)}"><span class="a-focus-label">${f.phase==='work'?'Focus':f.phase==='longBreak'?'Long break':'Break'}</span><output id="focusTime" class="a-focus-time">00:00</output><div id="focusProgress" class="a-focus-progress"></div><small>${f.workMinutes} min focus · ${f.breakMinutes} min break · ${f.mode==='repeat'?'Repeating':'One block'}</small></div><div class="a-focus-actions"><button class="a-primary" data-focus="${f.paused?'resume':'pause'}" ${owner?'':'disabled'}>${f.paused?'Resume timer':'Pause timer'}</button><button class="a-secondary" data-focus="skip" ${owner?'':'disabled'}>Skip ${f.phase==='work'?'to break':'to focus'}</button><button class="a-link" data-focus="stop" ${owner?'':'disabled'}>End timer</button></div><p class="a-hint">${owner?'You control this timer for the room.':`${esc(f.ownerName)} controls the timer. Your clock updates automatically.`}</p></section>`:`<form id="focusForm" data-form="focus" novalidate class="a-focus-setup">${f?.phase==='done'?'<p class="a-complete">✓ Focus block complete. Ready for another?</p>':''}<p class="a-help">Choose a rhythm, then start it for the room.</p><div class="a-focus-presets"><button type="button" data-preset="25,5,15" class="selected"><strong>Pomodoro</strong><span>25 min focus</span><small>5 min break</small></button><button type="button" data-preset="50,10,20"><strong>Deep work</strong><span>50 min focus</span><small>10 min break</small></button></div><div class="a-focus-rhythm"><label><input type="radio" name="rhythm" value="repeat" checked> Repeat with breaks</label><label><input type="radio" name="rhythm" value="once"> One focus block</label></div><details class="a-focus-custom"><summary>Customize durations</summary><div class="a-focus-fields"><label>Focus (min)<input id="focusWork" type="number" inputmode="numeric" min="1" max="180" required value="25"></label><label>Break (min)<input id="focusBreak" type="number" inputmode="numeric" min="1" max="60" required value="5"></label><label>Long break (min)<input id="focusLong" type="number" inputmode="numeric" min="1" max="90" required value="15"></label></div><p class="a-hint">A long break follows every fourth focus block.</p></details><button class="a-primary" type="submit">Start room timer</button></form>`;
                $('activityContent').scrollTop=0;
            }
            this.tickFocus();
        }
        renderTogether(){
            $('activityTitle').textContent='Watch & listen';$('activityEyebrow').textContent='Shared with this call';$('activityClock').hidden=true;$('activityEndMobile').hidden=true;$('activityScores').hidden=true;$('activityReactions').replaceChildren();
            if(this.signature!=='together'){
                this.signature='together';$('activityContent').innerHTML=`<div class="a-media-tabs" aria-label="Shared activities"><button data-media-tab="watch">Watch Together</button><button data-media-tab="sound">Soundboard</button><button data-media-tab="radio">Radio</button></div><section class="a-watch" data-media-panel="watch"><p class="a-help">Paste a YouTube link. Play, pause and seek together.</p><form data-form="watch" class="a-watch-form"><input aria-label="YouTube URL or ID" type="text" placeholder="Paste a YouTube link" required><button class="a-primary">Load video</button></form><div class="a-watch-frame" id="watchFrame"><div class="a-watch-empty">▶<small>Your video will appear here</small></div></div><div class="a-watch-controls"><button data-seek="-10">−10s</button><button data-watch="play">▶ Play</button><button data-watch="pause">Ⅱ Pause</button><button data-seek="10">+10s</button><button id="watchSync">Sync</button></div><p class="a-hint">Each viewer may need to press Play once. Some videos cannot be embedded.</p></section><section data-media-panel="sound" hidden><p class="a-help">Tap a sound to play it for the call. Each person controls their sound with the button above.</p><div class="a-sfx-grid">${[['boing','↗','Boing'],['quack','🦆','Quack'],['tada','✦','Ta-da'],['pop','◉','Pop'],['zap','ϟ','Zap'],['drum','🥁','Drumroll']].map(([id,icon,name])=>`<button data-sfx="${id}"><span>${icon}</span>${name}</button>`).join('')}</div></section><section data-media-panel="radio" hidden><p class="a-help">Choose a background loop for the call. Your volume stays on your device.</p><div class="a-radio-grid">${[['focus','◌','Focus','Soft notes for working'],['arcade','◆','Arcade','A little more energy'],['rain','☔','Rain','A gentle rain texture'],['off','■','Stop radio','Silence the shared station']].map(([id,icon,name,description])=>`<button data-station="${id}"><span>${icon}</span><strong>${name}</strong><small>${description}</small></button>`).join('')}</div><label class="a-volume">Your radio volume <input type="range" id="radioVolume" min="0" max="100" value="${this.radioVolume??30}"></label></section>`;
                $('watchSync').onclick=()=>this.syncWatch(true);$('radioVolume').oninput=event=>{this.radioVolume=Number(event.target.value);if(this.radioGain)this.radioGain.gain.value=this.radioVolume/350;};
            }
            this.dialog.querySelectorAll('[data-media-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mediaTab===this.tool)));
            this.dialog.querySelectorAll('[data-media-panel]').forEach(panel=>panel.hidden=panel.dataset.mediaPanel!==this.tool);
            this.updateTogether();
        }
        blockEffect(last){
            const tile=this.dialog.querySelector(`.a-cube[data-block="${last.index}"]`),board=$('blockBoard');if(!tile||!board)return;
            const box=tile.getBoundingClientRect(),outer=board.getBoundingClientRect(),burst=document.createElement('div');burst.className='a-block-burst';burst.style.left=`${box.left-outer.left+box.width/2}px`;burst.style.top=`${box.top-outer.top+box.height/2}px`;burst.textContent=`+${last.points}${last.combo>1?` ×${last.combo}`:''}`;board.append(burst);const half=burst.getBoundingClientRect().width/2+5;burst.style.left=`${Math.max(half,Math.min(outer.width-half,box.left-outer.left+box.width/2))}px`;setTimeout(()=>burst.remove(),900);
            board.classList.remove('pop-shake');void board.offsetWidth;board.classList.add('pop-shake');setTimeout(()=>board.classList.remove('pop-shake'),330);
            if(this.sound)this.playSfx(last.combo>=4?'tada':'pop');if(navigator.vibrate)navigator.vibrate(last.combo>=4?[25,30,35]:15);
        }
        updateTogether(){
            if(!this.dialog.open||this.mode!=='together'||!$('watchFrame'))return;
            this.dialog.querySelectorAll('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.station===this.media.radio.station)));
            this.dialog.querySelectorAll('[data-watch],[data-seek],#watchSync').forEach(b=>b.disabled=!this.media.video.id);
            if(this.media.video.id!==this.videoId){this.videoId=this.media.video.id;this.player?.destroy?.();this.player=null;$('watchFrame').innerHTML=this.videoId?'<div id="watchPlayer"></div>':'<div class="a-watch-empty">▶<small>THE SCREEN IS YOURS</small></div>';if(this.videoId&&this.tool==='watch')this.loadYouTube();}
            else if(this.tool==='watch'){if(this.videoId&&!this.player)this.loadYouTube();else this.syncWatch();}
        }
        async loadYouTube(){
            try{
                if(!window.YT?.Player){await (window.kerneYouTubeApi ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>reject(Error('YouTube unavailable'));const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};document.head.append(script);}));}
                if(!this.dialog.open||this.mode!=='together'||this.tool!=='watch'||!$('watchPlayer'))return;
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
            if(this.radioGain&&this.radioStation===this.media.radio.station&&this.radioAt===this.media.radio.at)return;
            this.stopRadio();if(!this.sound||this.media.radio.station==='off')return;this.radioStation=this.media.radio.station;this.radioAt=this.media.radio.at;
            try{const ctx=this.audioContext();ctx.resume();const output=ctx.createGain();output.gain.value=Number(this.radioVolume??30)/350;output.connect(ctx.destination);this.radioGain=output;const station=this.media.radio.station,at=this.media.radio.at;
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
            if(!this.dialog.open)return;const rail=$('activityCameras');if(rail.hidden)return;const tiles=[...document.querySelectorAll('#cameraStrip .video-element')];
            const ids=new Set(tiles.map(t=>t.id));for(const node of [...rail.children])if(!ids.has(node.dataset.peer))node.remove();
            for(const tile of tiles){let node=[...rail.children].find(n=>n.dataset.peer===tile.id);if(!node){node=document.createElement('div');node.className='a-call-person';node.dataset.peer=tile.id;const v=document.createElement('video');v.autoplay=true;v.playsInline=true;v.muted=true;const avatar=document.createElement('div');avatar.className='a-camera-off';const label=document.createElement('span');node.append(v,avatar,label);rail.append(node);}const source=tile.querySelector('video');const video=node.querySelector('video');const live=tile.dataset.cameraOn==='true'&&!!source.srcObject;const stream=live?source.srcObject:null;if(video.srcObject!==stream)video.srcObject=stream;node.querySelector('.a-camera-off').hidden=live;node.querySelector('.a-camera-off').textContent=tile.querySelector('.avatar-circle').textContent;node.querySelector('span').textContent=tile.querySelector('.video-name').textContent;}
        }
        reaction(emoji,playerId){if(!this.dialog.open)return;const node=document.createElement('span');node.className='a-float-reaction';node.textContent=emoji;node.style.left=`${15+Math.random()*70}%`;$('activityConfetti').append(node);setTimeout(()=>node.remove(),2200);const name=this.game?.players.find(p=>p.id===playerId)?.name;if(name)this.notice(`${name} ${emoji}`);}
        confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<30;i++){const bit=document.createElement('i');bit.style.cssText=`left:${i*3.4}%;--turn:${i%2?'-':'+'}${150+i*11}deg;--delay:${(i%7)*.06}s;background:${['#ffeb3b','#bcb0ea','#82b79d','#f4a376'][i%4]}`;$('activityConfetti').append(bit);setTimeout(()=>bit.remove(),3000);}}
        tone(){if(!this.sound)return;try{this.audio||=new(window.AudioContext||window.webkitAudioContext)();this.audio.resume();const now=this.audio.currentTime;for(const[i,hz]of[523,659,784].entries()){const o=this.audio.createOscillator(),gain=this.audio.createGain();o.type='sine';o.frequency.value=hz;gain.gain.setValueAtTime(.025,now+i*.07);gain.gain.exponentialRampToValueAtTime(.001,now+.13+i*.07);o.connect(gain);gain.connect(this.audio.destination);o.start(now+i*.07);o.stop(now+.15+i*.07);}}catch{}}
    }
    window.Activities=Activities;
})();
