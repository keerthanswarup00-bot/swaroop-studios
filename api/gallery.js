const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OWNER = process.env.GITHUB_OWNER || 'keerthanswarup00-bot';
const REPO = process.env.GITHUB_REPO || 'swaroop-studios';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const API_VERSION = '2022-11-28';
const DATA_PATH = 'data/gallery.json';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const defaultCategories = [{id:'wedding',label:'Weddings'},{id:'event',label:'Events'},{id:'corporate',label:'Corporate'},{id:'portrait',label:'Portraits'}];

function json(res,status,body){res.status(status).setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
function secret(){return String(ADMIN_PASSWORD||'')+':'+String(TOKEN||'')+':swaroop-studios-admin';}
function sessionToken(){return crypto.createHmac('sha256',secret()).update('authenticated').digest('hex');}
function safeEqual(a,b){const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return [i>-1?v.slice(0,i):v,i>-1?decodeURIComponent(v.slice(i+1)):''];}));}
function isAuthed(req){return Boolean(ADMIN_PASSWORD&&TOKEN&&safeEqual(cookies(req).swaroop_admin,sessionToken()));}
function requireConfig(res){if(!ADMIN_PASSWORD||!TOKEN){json(res,503,{ok:false,error:'Admin is not configured. Add ADMIN_PASSWORD and GITHUB_TOKEN in Vercel.'});return false;}return true;}
async function github(pathname,options={}){const response=await fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/'+pathname,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+TOKEN,'X-GitHub-Api-Version':API_VERSION,'Content-Type':'application/json',...(options.headers||{})}});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={message:text};}if(!response.ok){const error=new Error(data.message||'GitHub request failed: '+response.status);error.status=response.status;throw error;}return data;}
function decodeContent(data){return Buffer.from(String(data.content||'').replace(/\n/g,''),'base64').toString('utf8');}
async function readGalleryData(){try{return JSON.parse(fs.readFileSync(path.join(process.cwd(),DATA_PATH),'utf8'));}catch{}if(!TOKEN)return {categories:defaultCategories,images:[]};return JSON.parse(decodeContent(await github(DATA_PATH)));}
async function writeGalleryData(data){const current=await github(DATA_PATH);const content=Buffer.from(JSON.stringify(data,null,2)+'\n').toString('base64');await github(DATA_PATH,{method:'PUT',body:JSON.stringify({message:'Update gallery content',content,sha:current.sha,branch:BRANCH})});}
function slug(value){return String(value||'photo').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'photo';}
function sendCookie(res,value){res.setHeader('Set-Cookie','swaroop_admin='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800');}
function clearCookie(res){res.setHeader('Set-Cookie','swaroop_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12*1024*1024)throw new Error('Request is too large.');}return raw?JSON.parse(raw):{};}

module.exports=async(req,res)=>{
try{
if(req.method==='OPTIONS'){res.status(204).end();return;}
if(req.method==='GET'){if(req.query&&req.query.action==='session')return json(res,200,{ok:true,authenticated:isAuthed(req),configured:Boolean(ADMIN_PASSWORD&&TOKEN)});return json(res,200,await readGalleryData());}
if(!requireConfig(res))return;
const action=req.query&&req.query.action;
if(action==='login'){const input=await body(req);if(!safeEqual(input.password,ADMIN_PASSWORD))return json(res,401,{ok:false,error:'Incorrect password.'});sendCookie(res,sessionToken());return json(res,200,{ok:true});}
if(action==='logout'){clearCookie(res);return json(res,200,{ok:true});}
if(!isAuthed(req))return json(res,401,{ok:false,error:'Authentication required.'});
if(action==='save-category'){const input=await body(req);const label=String(input.label||'').trim().replace(/\s+/g,' ');const id=slug(input.id||label);if(!label||!id)return json(res,400,{ok:false,error:'Category name is required.'});const data=await readGalleryData();data.categories=Array.isArray(data.categories)?data.categories:defaultCategories.slice();if(data.categories.some(c=>c.id===id))return json(res,409,{ok:false,error:'That category already exists.'});data.categories.push({id,label});await writeGalleryData(data);return json(res,200,{ok:true,data});}
if(action==='delete-category'){const input=await body(req);const id=String(input.id||'');const data=await readGalleryData();if(defaultCategories.some(c=>c.id===id))return json(res,400,{ok:false,error:'Default categories cannot be deleted.'});if((data.images||[]).some(image=>image.category===id))return json(res,400,{ok:false,error:'Move or delete the photographs in this category first.'});data.categories=(data.categories||[]).filter(c=>c.id!==id);await writeGalleryData(data);return json(res,200,{ok:true,data});}
if(action==='upload'){const input=await body(req);const mime=String(input.mime||'');const raw=String(input.data||'').replace(/^data:[^;]+;base64,/,'');const bytes=Buffer.from(raw,'base64');if(!/^image\/(jpeg|jpg|png|webp)$/i.test(mime))return json(res,400,{ok:false,error:'Use JPG, PNG or WebP.'});if(!bytes.length||bytes.length>MAX_UPLOAD_BYTES)return json(res,413,{ok:false,error:'Image must be under 8 MB after processing.'});const category=String(input.category||'wedding');const title=String(input.title||'').trim();const location=String(input.location||'').trim();const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';const filename=slug(input.filename||'photo').slice(0,45)+'-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.'+ext;const assetPath='assets/images/gallery/'+filename;const data=await readGalleryData();if(!(data.categories||[]).some(c=>c.id===category))return json(res,400,{ok:false,error:'Unknown gallery category.'});await github(assetPath,{method:'PUT',body:JSON.stringify({message:'Add gallery photo: '+filename,content:bytes.toString('base64'),branch:BRANCH})});const image={id:crypto.randomUUID(),category,title,location,src:'/assets/images/gallery/'+filename,filename,createdAt:new Date().toISOString()};data.images=[image,...(data.images||[])];try{await writeGalleryData(data);}catch(error){try{const existing=await github(assetPath);await github(assetPath,{method:'DELETE',body:JSON.stringify({message:'Rollback gallery photo upload',sha:existing.sha,branch:BRANCH})});}catch{}throw error;}return json(res,200,{ok:true,image,data});}
if(action==='delete-image'){const input=await body(req);const data=await readGalleryData();const image=(data.images||[]).find(x=>x.id===input.id);if(!image)return json(res,404,{ok:false,error:'Image not found.'});data.images=(data.images||[]).filter(x=>x.id!==input.id);await writeGalleryData(data);if(image.src){try{const assetPath=image.src.replace(/^\//,'');const existing=await github(assetPath);await github(assetPath,{method:'DELETE',body:JSON.stringify({message:'Remove gallery photo: '+(image.filename||image.id),sha:existing.sha,branch:BRANCH})});}catch{}}return json(res,200,{ok:true,data});}
return json(res,404,{ok:false,error:'Unknown gallery action.'});
}catch(error){console.error(error);return json(res,error.status||500,{ok:false,error:error.message||'Server error.'});}
};