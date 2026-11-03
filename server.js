const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=process.env,PIN=E.ADMIN_PIN,MPT=E.MP_TOKEN,URL=E.PUBLIC_URL,F=path.join(__dirname,'data.json');
if(!PIN||!MPT||!URL){console.error('Faltam ADMIN_PIN, MP_TOKEN ou PUBLIC_URL no arquivo .env');process.exit(1)}
let D={products:[],orders:[]};try{D=JSON.parse(fs.readFileSync(F,'utf8'))}catch(e){}
const save=()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(D));fs.renameSync(F+'.tmp',F)};
let FCM=null;try{const a=require('firebase-admin');a.initializeApp({credential:a.credential.cert(require('./firebase-key.json'))});FCM=a.messaging()}catch(e){console.log('Push desativado (sem firebase-key.json). O painel atualiza sozinho a cada 15s.')}
const notify=(t,b)=>FCM&&FCM.send({topic:'dona',notification:{title:t,body:b}}).catch(()=>{});
const mp=(p,o={})=>fetch('https://api.mercadopago.com'+p,{...o,headers:{Authorization:'Bearer '+MPT,'Content-Type':'application/json',...(o.headers||{})}}).then(r=>r.json());
const bad={};const ok=(q,pin)=>{const b=bad[q.ip]||{n:0,t:0};if(Date.now()-b.t>6e5)b.n=0;if(b.n>=5)return false;if(pin===PIN)return true;b.n++;b.t=Date.now();bad[q.ip]=b;return false};
const A=express();A.set('trust proxy',1);A.use(express.json({limit:'5mb'}));
A.use((q,s,n)=>{s.set('Access-Control-Allow-Origin','*');s.set('Access-Control-Allow-Headers','Content-Type');if(q.method==='OPTIONS')return s.sendStatus(204);n()});
A.get('/api/products',(q,s)=>s.json([...D.products].sort((a,b)=>b.id-a.id)));
A.get('/api/order/:id',(q,s)=>{const o=D.orders.find(x=>x.id===q.params.id);s.json({s:o?o.s:'?'})});
A.post('/api/pix',async(q,s)=>{try{
 const p=D.products.find(x=>String(x.id)===String(q.body.productId));if(!p||p.st<1)return s.status(400).json({error:'indisponível'});
 const o={id:crypto.randomUUID(),pid:String(p.id),name:p.name,c:p.c,s:'pendente',t:Date.now()};
 const r=await mp('/v1/payments',{method:'POST',headers:{'X-Idempotency-Key':o.id},body:JSON.stringify({transaction_amount:p.c/100,description:p.name,payment_method_id:'pix',payer:{email:'cliente@sophiaglow.app'},external_reference:o.id,notification_url:URL+'/mp'})});
 const t=r.point_of_interaction&&r.point_of_interaction.transaction_data;if(!t)return s.status(502).json({error:'Pix falhou'});
 D.orders.unshift(o);save();s.json({orderId:o.id,code:t.qr_code,img:t.qr_code_base64});
}catch(e){console.error(e);s.status(500).json({error:'erro'})}});
// Mercado Pago avisa aqui quando o Pix é pago
A.post('/mp',async(q,s)=>{try{const id=(q.body.data&&q.body.data.id)||q.query['data.id']||q.query.id;if(id){
 const r=await mp('/v1/payments/'+id);
 if(r.status==='approved'){const o=D.orders.find(x=>x.id===r.external_reference);
  if(o&&o.s!=='pago'){o.s='pago';const p=D.products.find(x=>String(x.id)===o.pid);if(p&&p.st>0)p.st--;save();notify('Pagamento recebido 💖',o.name+' — R$ '+(o.c/100).toFixed(2))}}}
}catch(e){console.error(e)}s.sendStatus(200)});
A.post('/api/admin',async(q,s)=>{const d=q.body||{};if(!ok(q,d.pin))return s.status(403).json({error:'PIN incorreto'});
 if(d.op==='save'&&d.product){const x=d.product,p={id:+x.id,name:String(x.name||'').slice(0,40),desc:String(x.desc||'').slice(0,400),c:Math.round(+x.c)||0,st:Math.max(0,parseInt(x.st)||0),k:String(x.k||'Geral').slice(0,16),hue:+x.hue||320,e:'✨'};
  if(typeof x.img==='string'&&x.img.startsWith('data:image/'))p.img=x.img;if(!p.name||p.c<1)return s.status(400).json({error:'dados'});
  const i=D.products.findIndex(y=>y.id===p.id);i<0?D.products.push(p):D.products[i]=p;save()}
 if(d.op==='del'){D.products=D.products.filter(x=>String(x.id)!==String(d.id));save()}
 if(d.op==='push'&&FCM&&d.token)await FCM.subscribeToTopic(d.token,'dona').catch(()=>{});
 if(d.op==='orders')return s.json({orders:D.orders.slice(0,50)});
 s.json({ok:true})});
A.use(express.static(path.join(__dirname,'public')));
A.listen(3000,'127.0.0.1',()=>console.log('Sophia Glow no ar'));
