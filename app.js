const $=id=>document.getElementById(id);
const socket=io({reconnection:true});
let state=null,token=null,selected=null,lastQuestion=null,reveal=null;
const query=new URLSearchParams(location.search);
const saved=()=>{try{return JSON.parse(sessionStorage.getItem('trivia-session')||'null')}catch{return null}};
const save=(code,t,name)=>sessionStorage.setItem('trivia-session',JSON.stringify({code,token:t,name}));
const toast=msg=>{let el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)};
const request=(event,data,cb)=>socket.emit(event,data,result=>{if(!result?.ok)return toast(result?.error||'Error de conexión');cb?.(result)});
function connect(){let s=saved();if(s){$('name').value=s.name;request('join',s,r=>{token=r.token;save(r.code,r.token,s.name);history.replaceState({},'',`/?room=${r.code}`)})}}
socket.on('connect',connect);
socket.on('disconnect',()=>toast('Reconectando…'));
$('create').onclick=()=>{let name=$('name').value.trim();request('create',{name},r=>{token=r.token;save(r.code,r.token,name);history.replaceState({},'',`/?room=${r.code}`)})};
$('join').onclick=()=>{let name=$('name').value.trim(),code=$('code').value.trim().toUpperCase();request('join',{name,code},r=>{token=r.token;save(r.code,r.token,name);history.replaceState({},'',`/?room=${r.code}`)})};
$('code').value=query.get('room')?.toUpperCase()||'';
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);toast('¡Enlace copiado!')}catch{ $('invite').select();toast('Selecciona y copia el enlace')}};
$('share').onclick=async()=>{let url=$('invite').value;if(navigator.share){try{await navigator.share({title:'Trivia Duo ❤️',text:'¡Juega conmigo!',url})}catch{}}else $('copy').click()};
$('start').onclick=()=>request('start',{category:$('category').value,difficulty:$('difficulty').value},()=>{reveal=null;selected=null;lastQuestion=null});
$('again').onclick=()=>request('start',{category:$('category').value,difficulty:$('difficulty').value},()=>{reveal=null;selected=null;lastQuestion=null});
socket.on('state',s=>{state=s;render()});
socket.on('reveal',r=>{reveal=r;render()});
socket.on('closed',()=>{toast('Esta sala ha caducado. Crea una nueva.');sessionStorage.removeItem('trivia-session');location.href='/'});
function render(){if(!state)return;$('entry').classList.add('hidden');$('game').classList.remove('hidden');$('roomCode').textContent=state.code;$('status').textContent={lobby:'Esperando',question:'En juego',reveal:'Respuesta',finished:'Finalizada'}[state.phase];
const players=state.players;for(let i=0;i<2;i++){let p=players[i];$(`player${i+1}`).textContent=p?.name||'Esperando…';$(`score${i+1}`).textContent=p?.score||0;$(`ready${i+1}`).textContent=p?(p.connected?(p.answered?'✓ Respondió':'● Conectado'):'○ Desconectado'):''}
$('lobby').classList.toggle('hidden',state.phase!=='lobby');$('questionPanel').classList.toggle('hidden',!['question','reveal'].includes(state.phase));$('finish').classList.toggle('hidden',state.phase!=='finished');
let host=token===state.host;$('hostSettings').classList.toggle('hidden',!host);$('start').disabled=players.length!==2||players.some(p=>!p.connected);$('invite').value=`${location.origin}/?room=${state.code}`;
if(state.phase==='question'){if(lastQuestion!==state.question.id){lastQuestion=state.question.id;selected=null;reveal=null;}renderQuestion()}else if(state.phase==='reveal'){renderQuestion()}else if(state.phase==='finished'){let a=players[0],b=players[1];$('winner').textContent=a.score===b.score?'¡Empate! ❤️':`¡Gana ${a.score>b.score?a.name:b.name}! 🥳`;$('finalText').textContent=`${a.name}: ${a.score} puntos · ${b.name}: ${b.score} puntos`;$('again').classList.toggle('hidden',!host);$('again').disabled=players.some(p=>!p.connected)}
}
function renderQuestion(){let q=state.question;if(!q)return;$('progress').textContent=`Pregunta ${state.index+1} de ${state.total}`;$('difficultyLabel').textContent=`${q.category} · ${q.difficulty} · +${q.points}`;$('questionText').textContent=q.text;let me=state.players.find(p=>p.id===token),answered=me?.answered||selected!==null;let box=$('answers');box.replaceChildren();q.options.forEach((answer,i)=>{let b=document.createElement('button');b.textContent=`${'ABCD'[i]}. ${answer}`;if(selected===i)b.classList.add('selected');if(state.phase==='reveal'&&reveal){if(i===reveal.correct)b.classList.add('correct');else if(i===selected)b.classList.add('wrong')}b.disabled=answered||state.phase!=='question';b.onclick=()=>request('answer',{choice:i},()=>{selected=i;renderQuestion()});box.append(b)});$('answerNote').textContent=state.phase==='reveal'?'La siguiente pregunta empieza pronto…':answered?'Respuesta enviada. Esperando a tu pareja…':'¡Elige una respuesta antes de que acabe el tiempo!';$('solution').classList.toggle('hidden',state.phase!=='reveal'||!reveal);if(reveal)$('solution').textContent=`✓ Respuesta: ${reveal.answer}`;}
setInterval(()=>{if(!state||!['question','reveal'].includes(state.phase))return;let remaining=Math.max(0,state.deadline-Date.now()),duration=state.phase==='question'?20000:4500;$('timerFill').style.width=`${Math.min(100,remaining/duration*100)}%`},100);
