
import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/+esm";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";
import {DEFAULT_CARDS} from "./questions.js";
const $=id=>document.getElementById(id),letters=["A","B","C","D","E","F","G"];
const configured=!SUPABASE_URL.includes("PASTE_")&&!SUPABASE_ANON_KEY.includes("PASTE_");
const db=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
const s={session:localStorage.tt_session||crypto.randomUUID(),room:null,me:null,players:[],round:null,answers:[],selection:[],selectionRoundId:null,channel:null,timer:null};
localStorage.tt_session=s.session;
const esc=v=>{const d=document.createElement("div");d.textContent=v;return d.innerHTML};
function err(m){$("errorBox").textContent=m;$("errorBox").classList.toggle("hidden",!m)}
function show(id){["homeView","lobbyView","gameView","waitingView","revealView"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function code(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("")}
function shuffle(a){a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const host=()=>s.me?.id===s.room?.host_player_id,subject=()=>s.players.find(p=>p.id===s.round?.subject_player_id);
function points(g,t){let n=0;g.forEach((v,i)=>n+=v===t[i]?2:t.includes(v)?1:0);return n}
function rankHTML(r,c=null){return r.map((x,i)=>`<span class="rank-chip ${c&&c[i]===x?"correct":""}">#${i+1} ${letters[x]} — ${esc(s.round.card.options[x])}</span>`).join("")}
function configuredOrError(){if(configured)return true;err("Add your Supabase URL and anon key to config.js first.");return false}

async function createRoom(){
 if(!configuredOrError())return;const name=$("createName").value.trim();if(!name)return err("Enter your name.");
 const r=await db.from("rooms").insert({code:code(),status:"lobby",deck:shuffle(DEFAULT_CARDS),custom_cards:[]}).select().single();if(r.error)return err(r.error.message);
 const p=await db.from("players").insert({room_id:r.data.id,session_id:s.session,name,is_host:true}).select().single();if(p.error)return err(p.error.message);
 await db.from("rooms").update({host_player_id:p.data.id}).eq("id",r.data.id);s.room={...r.data,host_player_id:p.data.id};s.me=p.data;subscribe()
}
async function joinRoom(){
 if(!configuredOrError())return;const name=$("joinName").value.trim(),c=$("joinCode").value.trim().toUpperCase();if(!name||c.length!==6)return err("Enter your name and room code.");
 const r=await db.from("rooms").select("*").eq("code",c).maybeSingle();if(!r.data)return err("Room not found.");if(r.data.status!=="lobby")return err("That game has already started.");
 let p=await db.from("players").select("*").eq("room_id",r.data.id).eq("session_id",s.session).maybeSingle();
 if(!p.data)p=await db.from("players").insert({room_id:r.data.id,session_id:s.session,name}).select().single();
 if(p.error)return err(p.error.message);s.room=r.data;s.me=p.data;subscribe()
}
async function subscribe(){
 if(s.channel)await db.removeChannel(s.channel);
 s.channel=db.channel("room-"+s.room.id)
 .on("postgres_changes",{event:"*",schema:"public",table:"rooms",filter:`id=eq.${s.room.id}`},refresh)
 .on("postgres_changes",{event:"*",schema:"public",table:"players",filter:`room_id=eq.${s.room.id}`},refresh)
 .on("postgres_changes",{event:"*",schema:"public",table:"rounds",filter:`room_id=eq.${s.room.id}`},refresh)
 .on("postgres_changes",{event:"*",schema:"public",table:"answers",filter:`room_id=eq.${s.room.id}`},refresh).subscribe();
 clearInterval(s.timer);s.timer=setInterval(refresh,2000);refresh()
}
async function refresh(){
 if(!s.room)return;
 const [r,p,q]=await Promise.all([db.from("rooms").select("*").eq("id",s.room.id).single(),db.from("players").select("*").eq("room_id",s.room.id).eq("active",true).order("joined_at"),db.from("rounds").select("*").eq("room_id",s.room.id).order("round_number",{ascending:false}).limit(1).maybeSingle()]);
 if(r.data)s.room=r.data;s.players=p.data||[];s.me=s.players.find(x=>x.session_id===s.session)||s.me;s.round=q.data||null;
 if(s.round){const a=await db.from("answers").select("*").eq("round_id",s.round.id);s.answers=a.data||[]}else s.answers=[];
 render()
}
function render(){
 $("statusTag").textContent=s.room?`Room ${s.room.code}`:configured?"Ready":"Setup needed";
 if(!s.room)return show("homeView");if(s.room.status==="lobby")return lobby();if(!s.round)return;
 const mine=s.answers.find(a=>a.player_id===s.me.id);if(s.round.status==="revealed")return reveal();if(mine)return waiting();game()
}
function lobby(){
 show("lobbyView");$("roomCode").textContent=s.room.code;
 $("lobbyPlayers").innerHTML=s.players.map(p=>`<div class="player ${p.is_host?"host":""}"><strong>${esc(p.name)}</strong><div class="muted">${p.is_host?"Controls the game":"Ready"}</div></div>`).join("");
 $("startGameBtn").classList.toggle("hidden",!host());$("startGameBtn").disabled=s.players.length<2;$("hostTabs").classList.toggle("hidden",!host());renderCards()
}
function renderCards(){
 const list=s.room.custom_cards||[];$("customCardList").innerHTML=list.length?list.map((c,i)=>`<div class="custom-card"><strong>${esc(c.question)}</strong><p class="muted">${c.options.map(esc).join(" · ")}</p><button class="btn secondary remove" data-i="${i}">Remove</button></div>`).join(""):"<p class='muted'>No custom cards yet.</p>";
 document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removeCard(+b.dataset.i))
}
async function start(){
 if(!host()||s.players.length<2)return;const deck=shuffle([...(s.room.deck||DEFAULT_CARDS),...(s.room.custom_cards||[])]),sub=s.players[0];
 const q=await db.from("rounds").insert({room_id:s.room.id,round_number:1,subject_player_id:sub.id,card:deck[0]}).select().single();if(q.error)return err(q.error.message);
 await db.from("rooms").update({status:"playing",current_round:1,deck}).eq("id",s.room.id);refresh()
}
function game(){
 show("gameView");
 if(s.selectionRoundId!==s.round.id){s.selection=[];s.selectionRoundId=s.round.id}
 const sub=subject(),am=sub.id===s.me.id;
 $("roundLabel").textContent=`Round ${s.round.round_number} · ${sub.name}'s answers`;$("questionText").textContent=s.round.card.question;
 $("instruction").textContent=am?"Choose your real top three, in order.":`Guess ${sub.name}'s top three, in order.`;options();counts()
}
function options(){
 $("optionArea").innerHTML=s.round.card.options.map((t,i)=>{const n=s.selection.indexOf(i);return `<button class="option ${n>=0?"selected":""}" data-i="${i}"><span class="letter">${letters[i]}</span><span>${esc(t)}</span>${n>=0?`<span class="rank">#${n+1}</span>`:""}</button>`}).join("");
 document.querySelectorAll(".option").forEach(b=>b.onclick=()=>{const i=+b.dataset.i,n=s.selection.indexOf(i);if(n>=0)s.selection.splice(n,1);else if(s.selection.length<3)s.selection.push(i);options()});$("submitAnswerBtn").disabled=s.selection.length!==3
}
async function submit(){if(s.selection.length!==3)return;const r=await db.from("answers").insert({room_id:s.room.id,round_id:s.round.id,player_id:s.me.id,ranking:s.selection});if(r.error&&!r.error.message.includes("duplicate"))err(r.error.message);s.selection=[];s.selectionRoundId=null;refresh()}
function counts(){const n=s.answers.length,t=s.players.length,p=Math.round(n/t*100);$("answerCount").textContent=`${n}/${t} answered`;$("answerProgress").style.width=$("waitingProgress").style.width=p+"%";$("waitingText").textContent=n===t?"Everyone has answered. Revealing…":`Waiting for ${t-n} ${t-n===1?"person":"people"}…`;if(n===t&&host()&&s.round.status==="answering")doReveal()}
function waiting(){show("waitingView");counts()}
async function doReveal(){
 const truth=s.answers.find(a=>a.player_id===s.round.subject_player_id);if(!truth)return;
 for(const a of s.answers){if(a.player_id===s.round.subject_player_id)continue;const p=s.players.find(x=>x.id===a.player_id);await db.from("players").update({score:(p.score||0)+points(a.ranking,truth.ranking)}).eq("id",a.player_id)}
 await db.from("rounds").update({status:"revealed",revealed_at:new Date().toISOString()}).eq("id",s.round.id)
}
function reveal(){
 show("revealView");const sub=subject(),truth=s.answers.find(a=>a.player_id===s.round.subject_player_id);if(!truth)return;
 $("subjectAnswerTitle").textContent=`${sub.name}'s real ranking`;$("trueRanking").innerHTML=rankHTML(truth.ranking);
 $("roundScores").innerHTML=s.players.filter(p=>p.id!==sub.id).map(p=>{const a=s.answers.find(x=>x.player_id===p.id),pts=a?points(a.ranking,truth.ranking):0;return `<div class="score-row"><div><strong>${esc(p.name)}</strong><div class="rank-list">${a?rankHTML(a.ranking,truth.ranking):"No answer"}</div></div><strong>${pts} pts<br><span class="muted">${p.score||0} total</span></strong></div>`}).join("");
 $("nextRoundBtn").classList.toggle("hidden",!host());$("hostWaitingText").classList.toggle("hidden",host())
}
async function next(){
 if(!host())return;const n=s.round.round_number+1,sub=s.players[(n-1)%s.players.length],deck=s.room.deck||DEFAULT_CARDS;
 const q=await db.from("rounds").insert({room_id:s.room.id,round_number:n,subject_player_id:sub.id,card:deck[(n-1)%deck.length]}).select().single();if(q.error)return err(q.error.message);await db.from("rooms").update({current_round:n}).eq("id",s.room.id)
}
async function addCard(){
 const question=$("customQuestion").value.trim(),opts=$("customOptions").value.split("\n").map(x=>x.trim()).filter(Boolean);if(!question||opts.length!==7)return err("Use one question and exactly seven options.");
 const custom=[...(s.room.custom_cards||[]),{question,options:opts}];await db.from("rooms").update({custom_cards:custom}).eq("id",s.room.id);$("customQuestion").value="";$("customOptions").value="";refresh()
}
async function removeCard(i){const c=[...(s.room.custom_cards||[])];c.splice(i,1);await db.from("rooms").update({custom_cards:c}).eq("id",s.room.id);refresh()}
function download(){const b=new Blob([JSON.stringify(s.room.custom_cards||[],null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="custom-deck.json";a.click()}
async function importDeck(f){try{const d=JSON.parse(await f.text());if(!Array.isArray(d)||d.some(c=>!c.question||!Array.isArray(c.options)||c.options.length!==7))throw 0;await db.from("rooms").update({custom_cards:d}).eq("id",s.room.id);refresh()}catch{err("Invalid deck file.")}}
async function leave(){if(s.me)await db.from("players").update({active:false}).eq("id",s.me.id);clearInterval(s.timer);s.room=null;s.me=null;render()}

$("showCreateBtn").onclick=()=>{$("createBox").classList.remove("hidden");$("joinBox").classList.add("hidden")};
$("showJoinBtn").onclick=()=>{$("joinBox").classList.remove("hidden");$("createBox").classList.add("hidden")};
$("createRoomBtn").onclick=createRoom;$("joinRoomBtn").onclick=joinRoom;$("startGameBtn").onclick=start;$("submitAnswerBtn").onclick=submit;
$("clearSelectionBtn").onclick=()=>{s.selection=[];options()};$("nextRoundBtn").onclick=next;$("addCardBtn").onclick=addCard;$("downloadDeckBtn").onclick=download;
$("importDeckInput").onchange=e=>e.target.files[0]&&importDeck(e.target.files[0]);$("leaveBtn").onclick=leave;
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===t));$("playersTab").classList.toggle("hidden",t.dataset.tab!=="players");$("customTab").classList.toggle("hidden",t.dataset.tab!=="custom")});
if(!configured)err("Setup required: add Supabase details to config.js and run supabase.sql.");render()
