import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,collection,doc,getDoc,setDoc,deleteDoc,onSnapshot} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig,ownerEmail} from "./firebase-config.js";
(function(){
var ST=[["todo","To Do","var(--s1)"],["prog","In Progress","var(--s2)"],["review","In Review","var(--s3)"],["done","Done","var(--s4)"]];
var PR={high:"High",med:"Medium",low:"Low"},tasks=[],clients=[],team=[],settings={bossPhone:""},meEmail="",meName="",isOwner=false,fa="",unsubs=[],view="dash",proj="",q="",col=null,denied="";
var $=function(i){return document.getElementById(i)};
function esc(s){var d=document.createElement("div");d.textContent=s==null?"":s;return d.innerHTML}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function norm(x){x.status=x.status||(x.done?"done":"todo");x.done=x.status==="done";x.subs=x.subs||[];x.pri=x.pri||"med";return x}
function put(c,o){if(!col)return;col.put(c,o).catch(function(e){alert("Could not save: "+(e&&e.message))})}
function rm(c,id){if(!col)return;col.rm(c,id).catch(function(e){alert("Could not delete: "+(e&&e.message))})}
function save(t){norm(t);if(t.status==="done"&&!t.doneAt)t.doneAt=Date.now();if(t.status!=="done")t.doneAt=0;put("tasks",t)}
function del(id){rm("tasks",id)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
function projects(){var s={};clients.forEach(function(c){s[c.name]=1});tasks.forEach(function(t){if(t.client)s[t.client]=1});return Object.keys(s).sort()}
function saveP(p){if(!clients.some(function(c){return c.name===p}))put("clients",{id:"c"+uid(),kind:"client",name:p,status:"active",created:Date.now()})}
function members(){var m=team.slice();if(meEmail&&!m.some(function(x){return x.email===meEmail}))m.push({id:meEmail,email:meEmail,name:meName});return m}
function who(e){var m=members().find(function(x){return x.email===e});return m?(m.name||m.email):(e||"")}
function vis(){var s=q.toLowerCase();return tasks.filter(function(t){return(!proj||t.client===proj)&&(!fa||t.assignee===fa)&&(!s||(t.title+" "+(t.client||"")+" "+(t.desc||"")+" "+who(t.assignee)+" "+PR[t.pri]+" "+t.status).toLowerCase().indexOf(s)>-1)})}
function dueTxt(t){if(!t.due)return"–";var late=t.status!=="done"&&t.due<today();return'<span class="'+(late?"late":"")+'">'+esc(t.due)+(late?" ⚠":"")+"</span>"}
function render(){
  var tt=today(),all=tasks.length;$("nAll").textContent=all;
  document.querySelectorAll(".nv[data-v]").forEach(function(b){b.classList.toggle("on",b.dataset.v===view&&!proj)});
  $("projs").innerHTML=projects().map(function(p){var n=tasks.filter(function(t){return t.client===p}).length;return'<button class="nv'+(proj===p?" on":"")+'" data-p="'+esc(p)+'">◆ '+esc(p)+'<span class="n">'+n+"</span></button>"}).join("");
  $("ttl").textContent=proj||({dash:"Dashboard",list:"All Tasks",board:"Board",clients:"Clients",team:"Team",reports:"Reports",followups:"Follow-ups"})[view];
  var v=$("view");fillFa();
  if(view==="dash")v.innerHTML=dash(tt);else if(view==="list")v.innerHTML=list(tt);else if(view==="board")v.innerHTML=board();else if(view==="clients")v.innerHTML=clientsV();else if(view==="team")v.innerHTML=teamV();else if(view==="reports")v.innerHTML=reportV();else v.innerHTML=followV();
}
function dash(tt){
  var T=vis(),n=T.length,dn=T.filter(function(t){return t.status==="done"}).length;
  var od=T.filter(function(t){return t.status!=="done"&&t.due&&t.due<tt}).length,dt=T.filter(function(t){return t.status!=="done"&&t.due===tt}).length;
  var h='<div class="grid">'+[["Total tasks",n],["In progress",T.filter(function(t){return t.status==="prog"}).length],["Due today",dt],["Overdue",od]].map(function(k){return'<div class="card kp"><b>'+k[1]+"</b><span>"+k[0]+"</span></div>"}).join("")+"</div>";
  h+='<div class="two"><div class="card"><h3>Tasks by status</h3>'+ST.map(function(s){var c=T.filter(function(t){return t.status===s[0]}).length;return'<div class="row"><span class="l">'+s[1]+'</span><div class="t"><i style="width:'+(n?c/n*100:0)+"%;background:"+s[2]+'"></i></div><span class="c">'+c+"</span></div>"}).join("")+"</div>";
  h+='<div class="card"><h3>Project progress</h3>'+(projects().map(function(p){var a=tasks.filter(function(t){return t.client===p}),d=a.filter(function(t){return t.status==="done"}).length,pc=a.length?Math.round(d/a.length*100):0;return'<div class="row"><span class="l" title="'+esc(p)+'">'+esc(p)+'</span><div class="t"><i style="width:'+pc+'%;background:var(--or)"></i></div><span class="c">'+pc+"%</span></div>"}).join("")||'<div class="empty">Add a project to track progress</div>')+"</div></div>";
  var up=T.filter(function(t){return t.status!=="done"}).sort(function(a,b){return(a.due||"9")>(b.due||"9")?1:-1}).slice(0,6);
  h+='<div class="card" style="margin-top:12px"><h3>Up next</h3>'+(up.map(function(t){return'<div class="row" style="cursor:pointer" data-id="'+t.id+'"><span style="flex:1">'+esc(t.title)+(t.client?' <span class="tag">'+esc(t.client)+"</span>":"")+"</span><span>"+dueTxt(t)+"</span></div>"}).join("")||'<div class="empty">Nothing pending 🎉</div>')+"</div>";
  return h}
function list(tt){
  var T=vis().sort(function(a,b){return((a.status==="done")-(b.status==="done"))||((a.due||"9")>(b.due||"9")?1:-1)});
  if(!T.length)return'<div class="card empty">No tasks yet. Click “+ New Task” to start.</div>';
  return'<div class="tbl"><div class="th"><span>Task</span><span>Project</span><span>Status</span><span>Priority</span><span>Due</span><span></span></div>'+T.map(function(t){
    var sd=t.subs.filter(function(s){return s.d}).length;
    return'<div class="tr'+(t.status==="done"?" dn":"")+'" data-id="'+t.id+'"><div><div class="ti">'+esc(t.title)+"</div>"+'<div class="sub">'+(t.assignee?"👤 "+esc(who(t.assignee)):"Unassigned")+(t.subs.length?" · ☑ "+sd+"/"+t.subs.length:"")+(t.bossNote?" · 📝 "+esc(t.bossNote):"")+"</div>"+"</div><span>"+(t.client?'<span class="tag">'+esc(t.client)+"</span>":"–")+'</span><select data-s="'+t.id+'">'+ST.map(function(s){return'<option value="'+s[0]+'"'+(s[0]===t.status?" selected":"")+">"+s[1]+"</option>"}).join("")+'</select><span><span class="pill p-'+t.pri+'">'+PR[t.pri]+"</span></span><span>"+dueTxt(t)+'</span><button class="x" data-del="'+t.id+'" title="Delete">🗑</button></div>'}).join("")+"</div>"}
function board(){var T=vis();return'<div class="board">'+ST.map(function(s){var c=T.filter(function(t){return t.status===s[0]});
  return'<div class="col" data-col="'+s[0]+'"><h4><i style="background:'+s[2]+'"></i>'+s[1]+"<span>"+c.length+"</span></h4>"+c.map(function(t){return'<div class="tc" draggable="true" data-id="'+t.id+'"><div>'+esc(t.title)+'</div><div class="m"><span class="pill p-'+t.pri+'">'+PR[t.pri]+"</span>"+(t.client?'<span class="tag">'+esc(t.client)+"</span>":"")+"<span>"+(t.due?dueTxt(t):"")+"</span>"+(t.assignee?"<span>👤 "+esc(who(t.assignee))+"</span>":"")+"</div></div>"}).join("")+"</div>"}).join("")+"</div>"}
function edit(id,status){
  var t=id?tasks.find(function(x){return x.id===id}):null;
  t=t?JSON.parse(JSON.stringify(t)):{id:"t"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),kind:"task",title:"",client:proj,due:"",pri:"med",status:status||"todo",desc:"",subs:[],assignee:"",created:Date.now(),by:meEmail};
  var m=$("md");
  function paint(){m.innerHTML="<h2>"+(id?"Edit task":"New task")+'</h2><label>Task name<input id="e1" maxlength="200" value="'+esc(t.title).replace(/"/g,"&quot;")+'"></label><label>Description<textarea id="e2" rows="3">'+esc(t.desc)+'</textarea></label><div class="f2"><label>Project / client<input id="e3" list="pl" maxlength="60" value="'+esc(t.client).replace(/"/g,"&quot;")+'"><datalist id="pl">'+projects().map(function(p){return"<option>"+esc(p)}).join("")+'</datalist></label><label>Due date<input id="e4" type="date" value="'+esc(t.due)+'"></label><label>Status<select id="e5">'+ST.map(function(s){return'<option value="'+s[0]+'"'+(s[0]===t.status?" selected":"")+">"+s[1]+"</option>"}).join("")+'</select></label><label>Priority<select id="e6">'+Object.keys(PR).map(function(k){return'<option value="'+k+'"'+(k===t.pri?" selected":"")+">"+PR[k]+"</option>"}).join("")+"</select></label><label>Assigned to<select id=\"e7\"><option value=\"\">Unassigned</option>"+members().map(function(m){return'<option value="'+esc(m.email)+'"'+(m.email===t.assignee?" selected":"")+">"+esc(m.name||m.email)+"</option>"}).join("")+"</select></label></div><label>Subtasks</label><div id='sbs'>"+t.subs.map(function(s,i){return'<div class="sb"><input type="checkbox" data-c="'+i+'"'+(s.d?" checked":"")+'><input type="text" data-t="'+i+'" value="'+esc(s.t).replace(/"/g,"&quot;")+'"><button class="x" data-r="'+i+'">✕</button></div>'}).join("")+'</div><div class="sb"><input type="text" id="ns" placeholder="Add subtask and press Enter"></div><div class="acts"><button class="btn g" id="cx">Cancel</button><button class="btn" id="ok">Save</button></div>'}
  function grab(){t.title=$("e1").value.trim();t.desc=$("e2").value;t.client=$("e3").value.trim();t.due=$("e4").value;t.status=$("e5").value;t.pri=$("e6").value;t.assignee=$("e7").value}
  paint();$("mo").hidden=false;$("e1").focus();
  m.onclick=function(e){var r=e.target.dataset.r;if(r!=null){grab();t.subs.splice(+r,1);paint()}
    if(e.target.id==="cx")$("mo").hidden=true;
    if(e.target.id==="ok"){grab();if(!t.title){$("e1").focus();return}if(t.client)saveP(t.client);save(t);$("mo").hidden=true}};
  m.onchange=function(e){var c=e.target.dataset.c,s=e.target.dataset.t;if(c!=null)t.subs[+c].d=e.target.checked;if(s!=null)t.subs[+s].t=e.target.value};
  m.onkeydown=function(e){if(e.key==="Enter"&&e.target.id==="ns"){e.preventDefault();var v=e.target.value.trim();if(v){grab();t.subs.push({t:v,d:false});paint();$("ns").focus()}}}}
$("view").addEventListener("click",function(e){
  var d=e.target.closest("[data-del]");if(d){if(confirm("Delete this task?"))del(d.dataset.del);return}
  if(e.target.tagName==="SELECT")return;var r=e.target.closest("[data-id]");if(r)edit(r.dataset.id)});
$("view").addEventListener("change",function(e){var id=e.target.dataset.s;if(!id)return;var t=tasks.find(function(x){return x.id===id});if(t){t.status=e.target.value;save(t)}});
var dragId=null;
$("view").addEventListener("dragstart",function(e){var c=e.target.closest(".tc");if(c){dragId=c.dataset.id;e.dataTransfer.setData("text/plain",dragId)}});
$("view").addEventListener("dragover",function(e){var c=e.target.closest(".col");if(c){e.preventDefault();c.classList.add("ov")}});
$("view").addEventListener("dragleave",function(e){var c=e.target.closest(".col");if(c)c.classList.remove("ov")});
$("view").addEventListener("drop",function(e){var c=e.target.closest(".col");if(!c)return;e.preventDefault();c.classList.remove("ov");var t=tasks.find(function(x){return x.id===dragId});if(t&&t.status!==c.dataset.col){t.status=c.dataset.col;save(t)}});
document.querySelector("aside").addEventListener("click",function(e){var b=e.target.closest(".nv");if(!b)return;if(b.dataset.v){view=b.dataset.v;proj=""}else if(b.dataset.p!=null){proj=proj===b.dataset.p?"":b.dataset.p;if(view==="dash")view="list"}render()});
$("addP").onclick=function(){var p=prompt("New project / client name");if(p&&p.trim()){saveP(p.trim());proj=p.trim();if(view==="dash")view="list";render()}};
$("add").onclick=function(){edit(null)};$("q").oninput=function(){q=this.value.trim();render()};
$("mo").addEventListener("mousedown",function(e){if(e.target.id==="mo")$("mo").hidden=true});
document.addEventListener("keydown",function(e){if(e.key==="Escape")$("mo").hidden=true});
function setUser(n,e,img){$("nm").textContent=n||"";$("em").textContent=e||"";var a=$("av");if(img){a.innerHTML='<img alt="" src="'+esc(img)+'">'}else a.textContent=(n||"?").charAt(0).toUpperCase()}

function fillFa(){var s=$("fa");if(!s)return;var v=s.value;s.innerHTML='<option value="">All members</option>'+members().map(function(m){return'<option value="'+esc(m.email)+'">'+esc(m.name||m.email)+"</option>"}).join("");s.value=v;fa=s.value}
function digits(p){return(p||"").replace(/\D/g,"")}
function clientsV(){var s=q.toLowerCase(),tt=today();
  var C=clients.filter(function(c){return!s||[c.name,c.contact,c.phone,c.email,c.address,c.gst,c.notes,c.status].join(" ").toLowerCase().indexOf(s)>-1}).sort(function(a,b){return a.name>b.name?1:-1});
  var h='<div class="top" style="margin-bottom:12px"><button class="btn" data-act="newc">+ New Client</button></div>',g='style="grid-template-columns:2fr 1.5fr 1.4fr 1fr 1fr"';
  if(!C.length)return h+'<div class="card empty">No clients found. Add a client to keep all their details in one place.</div>';
  return h+'<div class="tbl"><div class="th" '+g+'><span>Client</span><span>Contact</span><span>Phone</span><span>Status</span><span>Open / overdue</span></div>'+C.map(function(c){var o=tasks.filter(function(t){return t.client===c.name&&t.status!=="done"}),od=o.filter(function(t){return t.due&&t.due<tt});
    return'<div class="tr" '+g+' data-cid="'+c.id+'"><div><div class="ti">'+esc(c.name)+'</div><div class="sub">'+esc(c.email||"")+'</div></div><span>'+esc(c.contact||"–")+"</span><span>"+esc(c.phone||"–")+'</span><span class="pill p-low" style="width:fit-content">'+esc(c.status||"active")+"</span><span>"+o.length+' / <span class="'+(od.length?"late":"")+'">'+od.length+"</span></span></div>"}).join("")+"</div>"}
function editClient(id){
  var c=id?clients.find(function(x){return x.id===id}):null,oldName=c?c.name:"";
  c=c?JSON.parse(JSON.stringify(c)):{id:"c"+uid(),kind:"client",name:"",contact:"",phone:"",email:"",address:"",gst:"",status:"active",notes:"",created:Date.now()};
  var m=$("md"),f=function(k){return esc(c[k]||"").replace(/"/g,"&quot;")},lt=c.name?tasks.filter(function(t){return t.client===c.name}):[];
  m.innerHTML="<h2>"+(id?"Client details":"New client")+'</h2><label>Client / company name<input id="c1" value="'+f("name")+'"></label><div class="f2"><label>Contact person<input id="c2" value="'+f("contact")+'"></label><label>Phone / WhatsApp (with country code)<input id="c3" placeholder="919876543210" value="'+f("phone")+'"></label><label>Email<input id="c4" type="email" value="'+f("email")+'"></label><label>GST / Tax no.<input id="c5" value="'+f("gst")+'"></label><label>Status<select id="c6">'+[["lead","Lead"],["active","Active"],["hold","On hold"],["done","Completed"]].map(function(s){return'<option value="'+s[0]+'"'+(s[0]===c.status?" selected":"")+">"+s[1]+"</option>"}).join("")+'</select></label></div><label>Address<input id="c7" value="'+f("address")+'"></label><label>Notes / requirements<textarea id="c8" rows="3">'+esc(c.notes)+"</textarea></label>"+
   (id?"<label>Tasks for this client ("+lt.length+")</label>"+(lt.map(function(t){return'<div class="sb" data-tid="'+t.id+'" style="cursor:pointer"><span style="flex:1">'+esc(t.title)+'</span><span class="sub">'+esc(who(t.assignee)||"Unassigned")+" · "+esc(t.status)+"</span></div>"}).join("")||'<div class="sub">No tasks yet</div>'):"")+
   '<div class="acts">'+(id?'<button class="btn d" id="cdel">Delete</button><button class="btn g" id="ctask">+ Task</button>':"")+(digits(c.phone)?'<a class="btn g" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/'+digits(c.phone)+'">WhatsApp</a>':"")+'<button class="btn g" id="cx">Cancel</button><button class="btn" id="cok">Save</button></div>';
  $("mo").hidden=false;$("c1").focus();m.onchange=null;m.onkeydown=null;
  m.onclick=function(e){var r=e.target.closest("[data-tid]");if(r){edit(r.dataset.tid);return}
    if(e.target.id==="cx")$("mo").hidden=true;
    if(e.target.id==="ctask"){edit(null);$("e3").value=c.name}
    if(e.target.id==="cdel"&&confirm("Delete this client? Their tasks stay.")){rm("clients",c.id);$("mo").hidden=true}
    if(e.target.id==="cok"){c.name=$("c1").value.trim();if(!c.name){$("c1").focus();return}
      c.contact=$("c2").value.trim();c.phone=$("c3").value.trim();c.email=$("c4").value.trim();c.gst=$("c5").value.trim();c.status=$("c6").value;c.address=$("c7").value.trim();c.notes=$("c8").value;
      if(oldName&&oldName!==c.name)tasks.filter(function(t){return t.client===oldName}).forEach(function(t){t.client=c.name;save(t)});
      put("clients",c);$("mo").hidden=true}}}
function teamV(){var tt=today(),g='style="grid-template-columns:2fr 2fr 1.4fr 1fr 1fr 38px;cursor:default"';
  return'<div class="top" style="margin-bottom:12px">'+(isOwner?'<button class="btn" data-act="newm">+ Add member</button>':"")+'</div><div class="tbl"><div class="th" '+g+'><span>Name</span><span>Email</span><span>Phone</span><span>Open</span><span>Overdue</span><span></span></div>'+members().map(function(m){var o=tasks.filter(function(t){return t.assignee===m.email&&t.status!=="done"}),od=o.filter(function(t){return t.due&&t.due<tt});
    return'<div class="tr" '+g+"><span>"+esc(m.name||"–")+"</span><span>"+esc(m.email)+"</span><span>"+esc(m.phone||"–")+"</span><span>"+o.length+'</span><span class="'+(od.length?"late":"")+'">'+od.length+"</span>"+(isOwner&&m.id!==meEmail?'<button class="x" data-act="rmm" data-mid="'+esc(m.id)+'">🗑</button>':"<span></span>")+"</div>"}).join("")+'</div><p class="sub" style="margin-top:10px">Only the owner can give or remove permission. A person you add here signs in with the Google account that uses this same email. Anyone not listed is blocked.</p>'}
function addMember(){var n=prompt("Member name");if(!n)return;var e=(prompt("Member email ID")||"").trim().toLowerCase();if(!e)return;var p=prompt("WhatsApp number with country code (optional)")||"";put("team",{id:e,kind:"member",email:e,name:n.trim(),phone:digits(p)})}
function setBoss(){if(!isOwner){alert("Only the owner can change this.");return}var p=prompt("Boss WhatsApp number with country code, e.g. 919876543210",settings.bossPhone||"");if(p!==null)put("settings",{id:"main",kind:"settings",bossPhone:digits(p)})}
function rep(){var T=vis(),tt=today(),wk=Date.now()-7*864e5,open=T.filter(function(t){return t.status!=="done"});
  return{T:T,open:open,od:open.filter(function(t){return t.due&&t.due<tt}),d7:T.filter(function(t){return t.status==="done"&&t.doneAt>wk}),dn:T.filter(function(t){return t.status==="done"}).length,pg:T.filter(function(t){return t.status==="prog"}).length,rv:T.filter(function(t){return t.status==="review"}).length}}
function reportText(){var r=rep(),L=["*Foster Creative Agency – Task Report*",new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})+(proj?" | Client: "+proj:"")+(fa?" | "+who(fa):""),"",
  "Total: "+r.T.length+" | Done: "+r.dn+" | In progress: "+r.pg+" | In review: "+r.rv+" | Overdue: "+r.od.length,"Completed in last 7 days: "+r.d7.length];
  if(r.od.length){L.push("","*Overdue*");r.od.slice(0,12).forEach(function(t){L.push("• "+t.title+" ("+(t.client||"-")+") – "+(who(t.assignee)||"Unassigned")+" – due "+t.due)})}
  L.push("","*By team member*");members().forEach(function(m){var a=r.T.filter(function(t){return t.assignee===m.email});if(a.length)L.push("• "+(m.name||m.email)+": "+a.filter(function(t){return t.status==="done"}).length+" done, "+a.filter(function(t){return t.status!=="done"}).length+" open")});
  var un=r.open.filter(function(t){return!t.assignee}).length;if(un)L.push("• Unassigned: "+un+" open");
  L.push("","*By client*");projects().forEach(function(p){var a=r.T.filter(function(t){return t.client===p});if(a.length)L.push("• "+p+": "+a.filter(function(t){return t.status==="done"}).length+"/"+a.length+" done")});
  return L.join("\n")}
function reportV(){var r=rep();
  return'<div class="grid">'+[["Total",r.T.length],["Completed (7 days)",r.d7.length],["Open",r.open.length],["Overdue",r.od.length]].map(function(k){return'<div class="card kp"><b>'+k[1]+"</b><span>"+k[0]+"</span></div>"}).join("")+'</div><div class="top"><button class="btn" data-act="wa">📲 Send to boss on WhatsApp</button><button class="btn g" data-act="bn">Boss number: '+(settings.bossPhone?"+"+esc(settings.bossPhone):"not set")+'</button><button class="btn g" data-act="cp">Copy</button><button class="btn g" data-act="csv">Tasks CSV</button><button class="btn g" data-act="ccsv">Clients CSV</button><button class="btn g" data-act="pr">Print / PDF</button></div><pre class="card" style="white-space:pre-wrap;font:inherit">'+esc(reportText())+"</pre>"}
function sendWA(){if(!settings.bossPhone){setBoss();if(!settings.bossPhone)return}var t=reportText();if(t.length>1700)t=t.slice(0,1700)+"\n…(open the app for the full report)";window.open("https://wa.me/"+settings.bossPhone+"?text="+encodeURIComponent(t),"_blank")}
function dl(rows,name){var csv=rows.map(function(r){return r.map(function(v){return'"'+String(v==null?"":v).replace(/"/g,'""')+'"'}).join(",")}).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));a.download=name;a.click()}
$("view").addEventListener("click",function(e){var b=e.target.closest("[data-act]"),r=e.target.closest("[data-cid]");
  if(b){var a=b.dataset.act;
    if(a==="newc")editClient(null);else if(a==="newm")addMember();else if(a==="rmm"){if(confirm("Remove this member?"))rm("team",b.dataset.mid)}
    else if(a==="wa")sendWA();else if(a==="bn")setBoss();else if(a==="cp"){navigator.clipboard.writeText(reportText()).then(function(){alert("Report copied")})}
    else if(a==="csv")dl([["Task","Client","Assigned to","Status","Priority","Due","Description"]].concat(vis().map(function(t){return[t.title,t.client,who(t.assignee),t.status,t.pri,t.due,t.desc]})),"tasks.csv");
    else if(a==="ccsv")dl([["Client","Contact","Phone","Email","GST","Address","Status","Notes"]].concat(clients.map(function(c){return[c.name,c.contact,c.phone,c.email,c.gst,c.address,c.status,c.notes]})),"clients.csv");
    else if(a==="pr")window.print();return}
  if(r)editClient(r.dataset.cid)});
$("fa").onchange=function(){fa=this.value;render()};
$("addP").onclick=function(){editClient(null)};

function followV(){var tt=today(),T=vis().filter(function(t){return t.status!=="done"});
  var G=[["🔴 Overdue",T.filter(function(t){return t.due&&t.due<tt})],["🟠 Due today",T.filter(function(t){return t.due===tt})],["🟣 Waiting for approval (In Review)",T.filter(function(t){return t.status==="review"})],["⏰ Follow-up flagged",T.filter(function(t){return t.followUp&&t.followUp<=tt})],["⚪ Unassigned",T.filter(function(t){return!t.assignee})]],n=0;
  var h=G.map(function(g){if(!g[1].length)return"";n+=g[1].length;return'<div class="card" style="margin-bottom:12px"><h3>'+g[0]+" ("+g[1].length+")</h3>"+g[1].map(function(t){return'<div class="row" style="flex-wrap:wrap;align-items:flex-start"><div style="flex:1;min-width:200px"><div class="ti">'+esc(t.title)+(t.client?' <span class="tag">'+esc(t.client)+"</span>":"")+'</div><div class="sub">'+(t.assignee?"👤 "+esc(who(t.assignee)):"Unassigned")+" · due "+esc(t.due||"–")+(t.bossNote?" · 📝 "+esc(t.bossNote):"")+'</div></div><span><button class="btn g" data-fu="done" data-tt="'+t.id+'">✔ Approve / Done</button> <button class="btn g" data-fu="snz" data-tt="'+t.id+'">⏰ Tomorrow</button> <button class="btn g" data-fu="note" data-tt="'+t.id+'">📝 Note</button> <button class="btn g" data-fu="wa" data-tt="'+t.id+'">📲 Nudge</button></span></div>'}).join("")+"</div>"}).join("");
  return h||'<div class="card empty">Nothing needs follow-up right now 🎉</div>'}
$("view").addEventListener("click",function(e){var b=e.target.closest("[data-fu]");if(!b)return;
  var t=tasks.find(function(x){return x.id===b.dataset.tt}),a=b.dataset.fu;if(!t)return;
  if(a==="done"){t.status="done";save(t)}
  else if(a==="snz"){var d=new Date(Date.now()+864e5);t.followUp=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");save(t)}
  else if(a==="note"){var n=prompt("Note / instruction for the team",t.bossNote||"");if(n!==null){t.bossNote=n.trim();save(t)}}
  else if(a==="wa"){var m=members().find(function(x){return x.email===t.assignee}),p=m&&digits(m.phone);if(!p){alert("No WhatsApp number for this assignee. Add it in Team.");return}
    window.open("https://wa.me/"+p+"?text="+encodeURIComponent("Follow-up: "+t.title+(t.client?" ("+t.client+")":"")+" – due "+(t.due||"not set")+(t.bossNote?". Note: "+t.bossNote:"")+". Please share an update."),"_blank")}});
function lock(on){document.body.classList.toggle("locked",on);$("login").hidden=!on}
async function init(){
  lock(true);
  var configured=firebaseConfig.apiKey&&firebaseConfig.apiKey.indexOf("YOUR_")!==0;
  if(!configured){$("gs").hidden=true;$("ler").textContent="This app is not activated yet. The owner must complete the one-time setup (see README).";return}
  var auth=getAuth(initializeApp(firebaseConfig)),fs=getFirestore(),owner=String(ownerEmail).toLowerCase();
  function stop(){unsubs.forEach(function(f){f()});unsubs=[]}
  function friendly(e){var c=e&&e.code||"";return({"auth/popup-closed-by-user":"Sign-in was cancelled.","auth/cancelled-popup-request":"Sign-in was cancelled.","auth/popup-blocked":"Your browser blocked the Google pop-up. Allow pop-ups and try again.","auth/unauthorized-domain":"This website address is not authorized in Firebase (Authentication > Settings > Authorized domains).","auth/operation-not-allowed":"Google sign-in is not turned on in Firebase yet.","auth/network-request-failed":"No internet connection."})[c]||(e&&e.message)||"Something went wrong."}
  $("gs").onclick=function(){$("ler").textContent="";var pr=new GoogleAuthProvider();pr.setCustomParameters({prompt:"select_account"});signInWithPopup(auth,pr).catch(function(e){$("ler").textContent=friendly(e)})};
  $("out").onclick=function(){signOut(auth)};
  onAuthStateChanged(auth,async function(u){
    stop();$("note").innerHTML="";col=null;tasks=[];clients=[];team=[];settings={bossPhone:""};
    if(!u){meEmail="";setUser("","");$("out").hidden=true;lock(true);$("ler").textContent=denied;denied="";return}
    var em=(u.email||"").toLowerCase(),ok=!!u.emailVerified&&em===owner;
    if(!ok&&u.emailVerified){try{ok=(await getDoc(doc(fs,"team",em))).exists()}catch(e){ok=false}}
    if(!ok){denied=em+" has not been given permission by the owner. Ask the owner to add this Google email in Team, then sign in again.";signOut(auth);return}
    meEmail=em;meName=u.displayName||em.split("@")[0];isOwner=em===owner;
    $("ler").textContent="";lock(false);$("out").hidden=false;setUser(meName,u.email,u.photoURL);
    col={put:function(c,o){return setDoc(doc(fs,c,o.id),o)},rm:function(c,id){return deleteDoc(doc(fs,c,id))}};
    ["tasks","clients","team","settings"].forEach(function(c){unsubs.push(onSnapshot(collection(fs,c),function(s){
      var a=s.docs.map(function(d){return d.data()}).filter(Boolean);
      if(c==="tasks")tasks=a.filter(function(x){return x.kind==="task"}).map(norm);else if(c==="clients")clients=a;else if(c==="team")team=a;else settings=a.find(function(x){return x.id==="main"})||{bossPhone:""};
      render()},function(e){$("note").innerHTML='<div class="note">'+(e&&e.code==="permission-denied"?"Permission was removed by the owner.":"Sync error: "+esc(e&&e.message||"unknown"))+"</div>"}))});
  });
}
init();
})();
