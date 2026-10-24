(()=>{"use strict";(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,47134,1489,e=>{var t=e.i(43065);e.s(["f",()=>t.f],47134);var a=e.i(60644);let r={name:"search",size:24,node:[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]]};r.node;let o=(0,a.f)(r);e.s(["f",0,o],1489)},31019,e=>{var t=e.i(68266),a=e.i(21926),r=e.i(68943),o=e.i(55600),s=e.i(47134),n=e.i(60644);let i={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};i.node;let l=(0,n.f)(i);var f=e.i(1489);let g={name:"upload",size:24,node:[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]};g.node;let d=(0,n.f)(g);var c=e.i(54148);let p={name:"film",size:24,node:[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M7 3v18",key:"bbkbws"}],["path",{d:"M3 7.5h4",key:"zfgn84"}],["path",{d:"M3 12h18",key:"1i2n21"}],["path",{d:"M3 16.5h4",key:"1230mu"}],["path",{d:"M17 3v18",key:"in4fa5"}],["path",{d:"M17 7.5h4",key:"myr1c1"}],["path",{d:"M17 16.5h4",key:"go4c1d"}]]};p.node;let h=(0,n.f)(p),x={aurora:{style:"streak",colors:["#f4efe9","#e9c2b8","#c2433f","#2a1e2a","#22395e","#6f97c2","#e5edf4"],scale:.7,warp:1.4,angle:-.62,gloss:.18,veins:0},ember:{style:"marble",colors:["#07090c","#16252c","#3d5f68","#1a1416","#a3201a","#ef4a2b","#ff8a5c"],scale:.62,warp:3.2,angle:-.5,gloss:.55,veins:.6},dusk:{style:"marble",colors:["#120c18","#3e2850","#8f6c9c","#2b1a24","#b3502f","#eab08a","#fbe7d2"],scale:.75,warp:3.6,angle:.8,gloss:.5,veins:.5},glacier:{style:"streak",colors:["#f7f8fa","#d9e2ea","#9fb4c7","#e8edf2","#bccbd8","#ffffff"],scale:.7,warp:1.6,angle:.35,gloss:.25,veins:0},verdant:{style:"marble",colors:["#070b08","#173024","#4f7a5a","#141812","#a7843a","#e9cf87","#fbf3d6"],scale:.7,warp:3.4,angle:2.1,gloss:.5,veins:.5}};function m(e){let t=e>>>0;return()=>{let e=t=t+0x6d2b79f5>>>0;return e=Math.imul(e^e>>>15,1|e),(((e^=e+Math.imul(e^e>>>7,61|e))^e>>>14)>>>0)/0x100000000}}function u(e){let t=0x811c9dc5;for(let a=0;a<e.length;a++)t=Math.imul(t^e.charCodeAt(a),0x1000193);return t>>>0}let b=new Map,v=[],y=!1;function w({art:e,seed:r,w:o,h:s,density:n,priority:i,className:l}){let f=a.useRef(null),[g,d]=a.useState(!1),c=JSON.stringify("string"==typeof e?x[e]:e),p=Math.round(o*n),h=Math.round(s*n);return a.useEffect(()=>{var e;let t,a,o=!0;return d(!1),(e=JSON.parse(c),t=JSON.stringify([e,r,p,h]),!(a=b.get(t))&&(a=new Promise(t=>{let a,o,s,n,l,f,g,d,c,x,u,b,w,k,j,N,M,C,A,F,z,S,R,E,L,I,B=v.length;for(;B>1&&v[B-1].priority>i;)B--;v.splice(B,0,{job:(a=Math.max(1,Math.round(p)),o=Math.max(1,Math.round(h)),n=(s=e.colors.length>=2?e.colors:["#111111","#eeeeee"]).map((e,t)=>{let a,r;return{t:t/(s.length-1),c:(3===(a=e.trim().replace(/^#/,"")).length&&(a=a[0]+a[0]+a[1]+a[1]+a[2]+a[2]),[(r=/^[0-9a-f]{6}$/i.test(a)?parseInt(a,16):8421504)>>16&255,r>>8&255,255&r])}}),l=e.scale??.7,f=e.warp??3,g=e.gloss??.4,d=e.veins??0,c="streak"===e.style,x=function(e){let t=m(e),a=new Uint8Array(512),r=new Float32Array(512),o=[];for(let e=0;e<256;e++)o.push(e);for(let e=255;e>0;e--){let a=Math.floor(t()*(e+1)),r=o[e];o[e]=o[a],o[a]=r}for(let e=0;e<512;e++)a[e]=o[255&e];for(let e=0;e<256;e++){let a=t()*Math.PI*2;r[2*e]=Math.cos(a),r[2*e+1]=Math.sin(a)}let s=(e,t)=>{let o=Math.floor(e),s=Math.floor(t),n=e-o,i=t-s,l=255&o,f=255&s,g=2*a[l+a[f]],d=2*a[l+1+a[f]],c=2*a[l+a[f+1]],p=2*a[l+1+a[f+1]],h=r[g]*n+r[g+1]*i,x=r[d]*(n-1)+r[d+1]*i,m=r[c]*n+r[c+1]*(i-1),u=r[p]*(n-1)+r[p+1]*(i-1),b=n*n*n*(n*(6*n-15)+10);return h+b*(x-h)+i*i*i*(i*(6*i-15)+10)*(m-h+b*(u-m-x+h))};return(e,t,a)=>{let r=0,o=.5;for(let n=0;n<a;n++){r+=o*s(e,t);let a=1.6*e+1.2*t+7.1;t=-1.2*e+1.6*t+3.3,e=a,o*=.5}return r}}(977*r+13),b=50*(u=m(r+1))(),w=50*u(),j=Math.cos(k=(e.angle??0)+(u()-.5)*.5),N=Math.sin(k),M=Math.min(a,o),F=new Float32Array((C=Math.ceil(a/2)+3)*(A=Math.ceil(o/2)+3)),z=new Float32Array(C*A),S=new Float32Array(a*o),R=new Float32Array(a*o),E=new Uint8ClampedArray(a*o*4),L=0,I=e=>{for(let t=0;t<C;t++){let r=((t-1)*2-a/2)/M,s=((e-1)*2-o/2)/M,n=(r*j-s*N)*l,i=(r*N+s*j)*l;c&&(n*=.14,i*=2.2);let g=x(n+=b,i+=w,3),d=x(n+5.2,i+1.3,3),p=x(n+f*g+1.7,i+f*d+9.2,3),h=x(n+f*g+8.3,i+f*d+2.8,3);F[e*C+t]=x(n+f*p,i+f*h,4),z[e*C+t]=Math.sqrt(g*g+d*d)}},{width:a,height:o,pixels:E,step:e=>{if(L>=A)return!0;let t=Math.min(A,L+Math.max(1,e));for(;L<t;)I(L++);return!(L<A)&&((()=>{let e=(e,t,a,r)=>(-e+9*t+9*a-r)/16,t=new Float32Array(a*A);for(let r=0;r<A;r++){let o=r*C;for(let s=0;s<a;s++){let n=(s>>1)+1;t[r*a+s]=1&s?e(F[o+n-1],F[o+n],F[o+n+1],F[o+n+2]):F[o+n]}}for(let r=0;r<o;r++){let o=(r>>1)+1;for(let s=0;s<a;s++){S[r*a+s]=1&r?e(t[(o-1)*a+s],t[o*a+s],t[(o+1)*a+s],t[(o+2)*a+s]):t[o*a+s];let n=(s>>1)+1,i=z[o*C+n],l=1&s?(i+z[o*C+n+1])/2:i,f=1&r?1&s?(z[(o+1)*C+n]+z[(o+1)*C+n+1])/2:z[(o+1)*C+n]:l;R[r*a+s]=(l+f)/2}}})(),(()=>{let e=[],t=Math.max(1,Math.floor(S.length/4096));for(let a=0;a<S.length;a+=t)e.push(S[a]);e.sort((e,t)=>e-t);let r=e[Math.floor(.02*e.length)],s=1/(e[Math.floor(.98*e.length)]-r||1),i=s*M*.012;for(let e=0;e<o;e++)for(let t=0;t<a;t++){let l=e*a+t,f=(S[l]-r)*s;f=f<0?0:f>1?1:f;let c=1;for(;c<n.length-1&&n[c].t<f;)c++;let p=n[c-1],h=n[c],x=(f-p.t)/(h.t-p.t||1);x=(x=x<0?0:x>1?1:x)*x*(3-2*x);let m=(S[t<a-1?l+1:l]-S[t>0?l-1:l])*i,u=(S[e<o-1?l+a:l]-S[e>0?l-a:l])*i,b=(-(-.55*m)- -.65*u+.52)/Math.sqrt(m*m+u*u+1),v=Math.pow(b>0?b:0,24)*g*255,y=(.82+.28*b)*(1+.035*Math.sin(150*f+24*R[l]))*(1-d*Math.max(0,1-14*Math.abs(R[l]-.42))*.6);E[4*l]=(p.c[0]+(h.c[0]-p.c[0])*x)*y+v,E[4*l+1]=(p.c[1]+(h.c[1]-p.c[1])*x)*y+v,E[4*l+2]=(p.c[2]+(h.c[2]-p.c[2])*x)*y+v,E[4*l+3]=255}})(),!0)}}),priority:i,done:t}),function(){if(y)return;y=!0;let e=()=>{let t=performance.now()+7;for(;v.length&&performance.now()<t;){let e=v[0];if(e.job.step(4)){v.shift();let t=document.createElement("canvas");t.width=e.job.width,t.height=e.job.height,t.getContext("2d")?.putImageData(new ImageData(e.job.pixels,t.width,t.height),0,0),e.done(t)}}v.length?requestAnimationFrame(e):y=!1};requestAnimationFrame(e)}()}),b.set(t,a)),a).then(e=>{let t=f.current;o&&t&&(t.width=e.width,t.height=e.height,t.getContext("2d")?.drawImage(e,0,0),d(!0))}),()=>{o=!1}},[c,r,p,h,i]),(0,t.jsx)("canvas",{ref:f,"aria-hidden":"true",className:l,"data-ready":g||void 0,style:{width:o,height:s,maxWidth:"none"}})}let k="M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z",j="M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z",N=[{name:"Cover — final",meta:"PNG · 4.8 MB",art:"ember"},{name:"Moodboard",meta:"24 images",art:"dusk"},{name:"Brief.pdf",meta:"PDF · 1.2 MB"}];function M({label:e="My Files",meta:r,tone:o="light",art:s="aurora",seed:n=3,image:i,files:l=N,action:f="add",onAdd:g,onFilesChange:d,menu:c=[],labelPlacement:p="bottom-left",open:h,defaultOpen:x=!1,onOpenChange:b,onFileSelect:v,width:y=340,appear:A=!0,appearDelay:F=0,className:z,style:S}){let R=a.useId().replace(/:/g,""),E=a.useRef(null),L=a.useRef(null),I=a.useRef(null),B=a.useRef(null),O=a.useRef(null),[P,T]=a.useState(l),U=a.useRef(l.map((e,t)=>t)),$=a.useRef(l.length),[q,D]=a.useState(null),[W,Y]=a.useState(0),[G,J]=a.useState(x),K=h??G,X=a.useCallback(e=>{void 0===h&&J(e),b?.(e)},[h,b]),[H,Z]=a.useState(!1),[_,Q]=a.useState(!A),V=y/340,ee=Math.min(1.5,Math.max(1,window.devicePixelRatio||1))*V;a.useEffect(()=>{if(!A)return;let e=E.current;if(!e||"u"<typeof IntersectionObserver)return void Q(!0);let t=0,a=new IntersectionObserver(e=>{e.some(e=>e.isIntersecting)&&(a.disconnect(),t=window.setTimeout(()=>Q(!0),F))},{threshold:.25});return a.observe(e),()=>{a.disconnect(),window.clearTimeout(t)}},[A,F]),a.useEffect(()=>{let e=E.current;if(!e)return;let t=0,a=0,r=0,o=()=>{t=0,e.style.setProperty("--gf-px",a.toFixed(3)),e.style.setProperty("--gf-py",r.toFixed(3))},s=s=>{if("touch"===s.pointerType)return;let n=e.getBoundingClientRect();a=(s.clientX-n.left)/n.width*2-1,r=(s.clientY-n.top)/n.height*2-1,t||(t=requestAnimationFrame(o))},n=()=>{a=0,r=0,t||(t=requestAnimationFrame(o))};return e.addEventListener("pointermove",s),e.addEventListener("pointerleave",n),()=>{e.removeEventListener("pointermove",s),e.removeEventListener("pointerleave",n),cancelAnimationFrame(t)}},[]),a.useEffect(()=>{L.current?.toggleAttribute("inert",!K)},[K]),a.useEffect(()=>{if(!K&&!H)return;let e=e=>{"Escape"===e.key&&(H?(Z(!1),B.current?.focus()):(X(!1),I.current?.focus()))},t=e=>{let t=e.target;!H||O.current?.contains(t)||B.current?.contains(t)||Z(!1),!K||H||E.current?.contains(t)||X(!1)};return document.addEventListener("keydown",e),document.addEventListener("pointerdown",t),()=>{document.removeEventListener("keydown",e),document.removeEventListener("pointerdown",t)}},[K,H,X]),a.useEffect(()=>{H&&O.current?.querySelector("[role=menuitem]")?.focus()},[H]);let et=[{label:K?"Close folder":"Open folder",onSelect:()=>X(!K)},...c],ea=Math.max(0,P.length-4),er=P.slice(ea),eo=P.length,es=r??eo+(1===eo?" item":" items");return(0,t.jsxs)("div",{ref:E,className:"gf-root"+(z?" "+z:""),"data-tone":o,"data-open":K||void 0,"data-entered":_||void 0,"data-place":p,style:{width:y,height:326*V,...S},children:[(0,t.jsx)("style",{children:C}),(0,t.jsx)("div",{className:"gf-stage",style:{transform:"translateY("+54*V+"px) scale("+V+")"},children:(0,t.jsxs)("div",{className:"gf-tilt",children:[(0,t.jsx)("div",{className:"gf-shadow","aria-hidden":"true"}),(0,t.jsxs)("div",{className:"gf-back",style:{clipPath:"path('"+k+"')"},"aria-hidden":"true",children:[i?(0,t.jsx)("img",{className:"gf-art",src:i,alt:"",width:364,height:296,draggable:!1}):"none"!==s?(0,t.jsx)(w,{className:"gf-art",art:s,seed:n,w:364,h:296,density:ee,priority:0}):null,(0,t.jsx)("div",{className:"gf-back-sheen"})]}),(0,t.jsx)("svg",{className:"gf-rim gf-back-rim",viewBox:"0 0 340 272","aria-hidden":"true",children:(0,t.jsx)("path",{d:k})}),(0,t.jsxs)("div",{className:"gf-front"+(W?" gf-front--bump":""),style:{clipPath:"path('"+j+"')"},children:[(0,t.jsx)("div",{className:"gf-tint","aria-hidden":"true"}),(0,t.jsx)("div",{className:"gf-spec","aria-hidden":"true"}),(0,t.jsxs)("svg",{className:"gf-rim gf-front-rim",viewBox:"0 0 340 198","aria-hidden":"true",children:[(0,t.jsx)("defs",{children:(0,t.jsxs)("linearGradient",{id:"gf-rim-"+R,x1:"0",y1:"0",x2:"0",y2:"1",children:[(0,t.jsx)("stop",{offset:"0",stopColor:"#fff",stopOpacity:"0.95"}),(0,t.jsx)("stop",{offset:"0.35",stopColor:"#fff",stopOpacity:"0.35"}),(0,t.jsx)("stop",{offset:"1",stopColor:"#fff",stopOpacity:"0.12"})]})}),(0,t.jsx)("path",{d:j,stroke:"url(#gf-rim-"+R+")"})]}),(0,t.jsx)("button",{ref:I,type:"button",className:"gf-hit","aria-expanded":K,"aria-label":(K?"Close ":"Open ")+e+", "+eo+(1===eo?" item":" items"),onClick:()=>{Z(!1),X(!K)}}),(0,t.jsxs)("div",{className:"gf-label",children:[(0,t.jsx)("span",{className:"gf-title",children:e}),(0,t.jsx)("span",{className:"gf-meta",children:es},es)]})]},W),(0,t.jsx)("div",{ref:L,className:"gf-files",role:"list","aria-label":e+" contents",children:er.map((e,a)=>{var r;let o=U.current[ea+a],s=(r=er.length)<=1?0:a/(r-1)*2-1,n=m(u(e.name)+o),i=!!(e.art||e.image),l=(0,t.jsxs)(t.Fragment,{children:[i?e.image?(0,t.jsx)("img",{className:"gf-sheet-art",src:e.image,alt:"",width:272,height:184,draggable:!1}):(0,t.jsx)(w,{className:"gf-sheet-art",art:e.art,seed:u(e.name)%997,w:272,h:184,density:Math.min(ee,1.25),priority:1}):(0,t.jsxs)("span",{className:"gf-lines","aria-hidden":"true",children:[(0,t.jsx)("i",{style:{width:"86%"}}),(0,t.jsx)("i",{style:{width:"92%"}}),(0,t.jsx)("i",{style:{width:"64%"}}),(0,t.jsx)("i",{style:{width:"88%"}}),(0,t.jsx)("i",{style:{width:"42%"}})]}),(0,t.jsxs)("span",{className:"gf-sheet-head",children:[(0,t.jsx)("span",{className:"gf-sheet-name",children:e.name}),e.meta?(0,t.jsx)("span",{className:"gf-sheet-meta",children:e.meta}):null]})]}),f={className:"gf-sheet"+(i?" gf-sheet--art":"")+(o===q?" gf-sheet--drop":""),style:{"--gf-slot":s,"--gf-depth":er.length-1-a,"--gf-jx":((n()-.5)*10).toFixed(2)+"px","--gf-jr":((n()-.5)*3.2).toFixed(2)+"deg",zIndex:a+1},onAnimationEnd:o===q?()=>D(null):void 0};return(0,t.jsx)("div",{role:"listitem",className:"gf-sheet-slot",children:e.href?(0,t.jsx)("a",{...f,href:e.href,onClick:()=>v?.(e,ea+a),children:l}):(0,t.jsx)("button",{...f,type:"button",onClick:()=>v?.(e,ea+a),children:l})},o)})}),"none"!==f?(0,t.jsx)("button",{ref:B,type:"button",className:"gf-key gf-key--"+f,"aria-label":"add"===f?"Add a file to "+e:"More options for "+e,"aria-haspopup":"more"===f?"menu":void 0,"aria-expanded":"more"===f?H:void 0,"aria-controls":"more"===f?"gf-menu-"+R:void 0,onClick:()=>{let e,t,a;return"add"===f?(e=g?.(P)||{name:"Untitled "+(P.length+1),meta:"Just now"},t=[...P,e],a=$.current++,void(U.current=[...U.current,a],T(t),D(a),Y(e=>e+1),d?.(t))):Z(e=>!e)},children:"add"===f?(0,t.jsx)("svg",{className:"gf-glyph gf-glyph--plus",viewBox:"0 0 24 24","aria-hidden":"true",children:(0,t.jsx)("path",{d:"M12 4.5v15M4.5 12h15"})},W):(0,t.jsxs)("svg",{className:"gf-glyph gf-glyph--more",viewBox:"0 0 30 12","aria-hidden":"true",children:[(0,t.jsx)("rect",{x:"1",y:"1.5",width:"8",height:"9",rx:"3.4"}),(0,t.jsx)("rect",{x:"11",y:"1.5",width:"8",height:"9",rx:"3.4"}),(0,t.jsx)("rect",{x:"21",y:"1.5",width:"8",height:"9",rx:"3.4"})]})}):null,"more"===f?(0,t.jsx)("div",{ref:O,id:"gf-menu-"+R,role:"menu","aria-label":e+" options",className:"gf-menu","data-open":H||void 0,onKeyDown:e=>{let t=Array.from(O.current?.querySelectorAll("[role=menuitem]")??[]),a=t.indexOf(document.activeElement),r=a=>{e.preventDefault(),t[(a+t.length)%t.length]?.focus()};"ArrowDown"===e.key?r(a+1):"ArrowUp"===e.key?r(a-1):"Home"===e.key?r(0):"End"===e.key?r(t.length-1):"Tab"===e.key&&Z(!1)},children:et.map((e,a)=>(0,t.jsx)("button",{type:"button",role:"menuitem",tabIndex:H?-1:void 0,disabled:!H,className:"gf-menu-item"+(e.danger?" gf-menu-item--danger":""),onClick:()=>{Z(!1),B.current?.focus(),e.onSelect?.()},children:e.label},e.label+a))}):null]})})]})}let C=`
.gf-root {
  --gf-px: 0;
  --gf-py: 0;
  --gf-ease: cubic-bezier(.2, .8, .2, 1);
  --gf-spring: cubic-bezier(.34, 1.36, .5, 1);
  --gf-hinge: 0deg;
  --gf-lift: 42px;
  --gf-spread: 0px;
  --gf-fan: 0deg;
  --gf-stack: 15px;
  --gf-ink: #141416;
  --gf-ink-soft: rgba(20, 20, 22, .55);
  position: relative;
  display: inline-block;
  flex: none;
  vertical-align: top;
  font-family: ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  isolation: isolate;
}
.gf-root[data-tone="dark"] { --gf-ink: #f5f5f7; --gf-ink-soft: rgba(245, 245, 247, .58); }
.gf-root:hover, .gf-root:focus-within { --gf-hinge: -11deg; --gf-lift: -34px; --gf-spread: 8px; --gf-fan: 1.4deg; --gf-stack: 10px; }
.gf-root[data-open] { --gf-hinge: -24deg; --gf-lift: -96px; --gf-spread: 40px; --gf-fan: 5deg; --gf-stack: 30px; }

.gf-stage {
  position: absolute;
  left: 0;
  top: 0;
  width: 340px;
  height: 272px;
  transform-origin: 0 0;
}
.gf-tilt {
  position: absolute;
  inset: 0;
  transform: perspective(1400px) rotateX(calc(var(--gf-py) * -3deg)) rotateY(calc(var(--gf-px) * 4deg));
  transition: transform .9s var(--gf-ease);
}

.gf-shadow {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -6px;
  height: 60px;
  border-radius: 40px;
  background: rgba(16, 18, 24, .34);
  filter: blur(22px);
  transform: translateX(calc(var(--gf-px) * -8px));
  transition: transform .9s var(--gf-ease), opacity .9s var(--gf-ease);
}
.gf-root[data-tone="dark"] .gf-shadow { background: rgba(0, 0, 0, .62); }

.gf-back {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #f3f3f4 0%, #e3e3e6 100%);
}
.gf-root[data-tone="dark"] .gf-back { background: linear-gradient(180deg, #2a2a2e 0%, #121214 100%); }
.gf-art {
  position: absolute;
  left: -12px;
  top: -12px;
  max-width: none;
  object-fit: cover;
  transform: translate(calc(var(--gf-px) * -7px), calc(var(--gf-py) * -6px)) scale(1.02);
  transition: transform 1.1s var(--gf-ease), opacity 1.2s var(--gf-ease), filter 1.2s var(--gf-ease);
}
canvas.gf-art { opacity: 0; filter: blur(14px) saturate(.6); }
canvas.gf-art[data-ready] { opacity: 1; filter: none; }
.gf-back-sheen {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .22) 0%, rgba(255, 255, 255, 0) 22%),
    radial-gradient(120% 80% at 80% 0%, rgba(255, 255, 255, .16), rgba(255, 255, 255, 0) 60%);
  pointer-events: none;
}

.gf-rim {
  position: absolute;
  left: 0;
  top: 0;
  max-width: none;
  overflow: visible;
  pointer-events: none;
  fill: none;
}
.gf-back-rim { width: 340px; height: 272px; }
.gf-back-rim path { stroke: rgba(255, 255, 255, .45); stroke-width: 1; }
.gf-root[data-tone="dark"] .gf-back-rim path { stroke: rgba(255, 255, 255, .16); }

/* ---- files ---------------------------------------------------------------- */
.gf-files {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  /* nothing hangs out of the bottom of the pocket, however tall the stack */
  clip-path: inset(-400px -400px 10px -400px);
}
.gf-sheet-slot { display: contents; }
.gf-sheet {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  left: 34px;
  top: 96px;
  width: 272px;
  height: 184px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  pointer-events: auto;
  background: linear-gradient(180deg, #ffffff 0%, #f2f2f0 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .9),
    0 0 0 .5px rgba(0, 0, 0, .1),
    0 10px 26px -8px rgba(10, 12, 20, .28);
  transform-origin: 50% 100%;
  transform:
    translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)), calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1))
    rotate(calc(var(--gf-jr) + var(--gf-slot) * var(--gf-fan)));
  transition:
    transform .75s var(--gf-spring) calc(var(--gf-depth) * 40ms),
    box-shadow .4s var(--gf-ease),
    translate .9s var(--gf-ease),
    opacity .9s var(--gf-ease);
}
.gf-root[data-tone="dark"] .gf-sheet { background: linear-gradient(180deg, #2c2c30 0%, #1c1c1f 100%); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14), 0 0 0 .5px rgba(255, 255, 255, .08), 0 12px 28px -8px rgba(0, 0, 0, .7); }
.gf-sheet--art { background: #1a1a1d; }
.gf-root[data-open] .gf-sheet:hover,
.gf-root[data-open] .gf-sheet:focus-visible {
  transform:
    translate(calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)), calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1 - 18px))
    rotate(calc(var(--gf-slot) * var(--gf-fan) * .6));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 0 0 .5px rgba(0, 0, 0, .1), 0 22px 40px -12px rgba(10, 12, 20, .42);
  transition-delay: 0s;
}
.gf-sheet:focus-visible { outline: 2px solid #4c8dff; outline-offset: 2px; }
.gf-sheet-art {
  position: absolute;
  left: 0;
  top: 0;
  width: 272px;
  height: 184px;
  max-width: none;
  object-fit: cover;
  transition: opacity .9s var(--gf-ease), filter .9s var(--gf-ease);
}
canvas.gf-sheet-art { opacity: 0; filter: blur(10px); }
canvas.gf-sheet-art[data-ready] { opacity: 1; filter: none; }
.gf-sheet--art::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(0, 0, 0, .42) 0%, rgba(0, 0, 0, 0) 34%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .2);
  pointer-events: none;
}
.gf-sheet-head {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 11px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  white-space: nowrap;
}
.gf-sheet-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 560;
  letter-spacing: -.005em;
  color: #18181b;
}
.gf-sheet-meta {
  flex: none;
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: .02em;
  color: rgba(24, 24, 27, .5);
}
.gf-root[data-tone="dark"] .gf-sheet-name, .gf-sheet--art .gf-sheet-name { color: #fafafa; }
.gf-root[data-tone="dark"] .gf-sheet-meta, .gf-sheet--art .gf-sheet-meta { color: rgba(250, 250, 250, .66); }
.gf-lines {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 40px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.gf-lines i {
  display: block;
  height: 5px;
  border-radius: 3px;
  background: rgba(24, 24, 27, .08);
}
.gf-lines i:first-child { height: 9px; margin-bottom: 4px; background: rgba(24, 24, 27, .14); }
.gf-root[data-tone="dark"] .gf-lines i { background: rgba(255, 255, 255, .08); }
.gf-root[data-tone="dark"] .gf-lines i:first-child { background: rgba(255, 255, 255, .16); }

.gf-sheet--drop { animation: gf-drop .85s var(--gf-ease) both; }
@keyframes gf-drop {
  0% { translate: 0 -190px; rotate: -9deg; opacity: 0; }
  35% { opacity: 1; }
  72% { translate: 0 10px; rotate: 1deg; }
  100% { translate: 0 0; rotate: 0deg; opacity: 1; }
}

/* ---- front glass ----------------------------------------------------------- */
.gf-front {
  position: absolute;
  left: 0;
  top: 74px;
  width: 340px;
  height: 198px;
  z-index: 10;
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  backdrop-filter: blur(22px) saturate(1.5);
  transform-origin: 50% 100%;
  transform: perspective(760px) rotateX(var(--gf-hinge));
  transition: transform .8s var(--gf-spring), translate 1s var(--gf-ease), opacity 1s var(--gf-ease);
}
.gf-front--bump { animation: gf-bump .7s var(--gf-ease) .38s both; }
@keyframes gf-bump {
  0% { scale: 1; }
  35% { scale: 1.018 .975; }
  70% { scale: .996 1.006; }
  100% { scale: 1; }
}
.gf-tint {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .16) 0%, rgba(255, 255, 255, .5) 42%, rgba(252, 252, 252, .93) 100%);
}
.gf-root[data-tone="dark"] .gf-tint {
  background: linear-gradient(180deg, rgba(18, 18, 20, .18) 0%, rgba(14, 14, 16, .62) 46%, rgba(8, 8, 10, .94) 100%);
}
.gf-spec {
  position: absolute;
  inset: 0;
  background: radial-gradient(260px 200px at calc(50% + var(--gf-px) * 46%) calc(30% + var(--gf-py) * 40%), rgba(255, 255, 255, .5), rgba(255, 255, 255, 0) 70%);
  mix-blend-mode: soft-light;
  opacity: .9;
  transition: background-position .6s var(--gf-ease);
  pointer-events: none;
}
.gf-root[data-tone="dark"] .gf-spec { mix-blend-mode: screen; opacity: .16; }
.gf-front-rim { width: 340px; height: 198px; }
.gf-front-rim path { stroke-width: 2.4; transition: stroke-width .3s var(--gf-ease); }
.gf-root[data-tone="dark"] .gf-front-rim { opacity: .55; }

.gf-hit {
  all: unset;
  position: absolute;
  inset: 0;
  z-index: 1;
  cursor: pointer;
}
.gf-hit:focus-visible ~ .gf-label .gf-title { text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 4px; }
.gf-front:has(.gf-hit:focus-visible) .gf-front-rim path { stroke-width: 5; }

.gf-label {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 200px;
  pointer-events: none;
  color: var(--gf-ink);
}
.gf-root[data-place="bottom-left"] .gf-label { left: 28px; bottom: 32px; }
.gf-root[data-place="top-left"] .gf-label { left: 28px; top: 34px; }
.gf-root[data-place="top-right"] .gf-label { right: 32px; top: 52px; align-items: flex-start; }
.gf-title {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -.012em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gf-meta {
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: .03em;
  color: var(--gf-ink-soft);
  white-space: nowrap;
  animation: gf-roll .5s var(--gf-ease) both;
}
@keyframes gf-roll {
  from { opacity: 0; translate: 0 7px; filter: blur(3px); }
  to { opacity: 1; translate: 0 0; filter: blur(0); }
}

/* ---- the key: + or \xb7\xb7\xb7 ------------------------------------------------------ */
.gf-key {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 12;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform .35s var(--gf-spring), box-shadow .35s var(--gf-ease), background .35s var(--gf-ease);
}
.gf-key:hover { transform: translateY(-2px); }
.gf-key:active { transform: translateY(0) scale(.93); transition-duration: .12s; }
.gf-key:focus-visible { outline: 2px solid #4c8dff; outline-offset: 3px; }
.gf-key--add {
  color: #fff;
  background: radial-gradient(120% 90% at 50% 0%, #3a3a3f 0%, #121214 55%, #050506 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .22),
    inset 0 -3px 8px rgba(0, 0, 0, .7),
    0 0 0 1px rgba(0, 0, 0, .75),
    0 14px 22px -8px rgba(0, 0, 0, .55),
    0 3px 6px -2px rgba(0, 0, 0, .35);
}
.gf-root[data-tone="dark"] .gf-key--add {
  color: #111113;
  background: radial-gradient(120% 90% at 50% 0%, #ffffff 0%, #ececee 55%, #d2d2d6 100%);
  box-shadow: inset 0 1px 0 #fff, inset 0 -3px 8px rgba(0, 0, 0, .14), 0 0 0 1px rgba(0, 0, 0, .4), 0 14px 22px -8px rgba(0, 0, 0, .7);
}
.gf-key--more {
  color: #111113;
  background: linear-gradient(180deg, rgba(255, 255, 255, .92) 0%, rgba(226, 226, 230, .82) 100%);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -2px 4px rgba(0, 0, 0, .06),
    0 0 0 1px rgba(0, 0, 0, .16),
    0 10px 18px -8px rgba(0, 0, 0, .3);
}
.gf-root[data-tone="dark"] .gf-key--more {
  color: #f5f5f7;
  background: linear-gradient(180deg, rgba(255, 255, 255, .16) 0%, rgba(255, 255, 255, .06) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), 0 0 0 1px rgba(255, 255, 255, .1), 0 10px 18px -8px rgba(0, 0, 0, .6);
}
.gf-key--more[aria-expanded="true"] { transform: scale(.96); }
.gf-glyph { display: block; max-width: none; fill: none; stroke: currentColor; stroke-linecap: round; }
.gf-glyph--plus { width: 26px; height: 26px; stroke-width: 1.6; animation: gf-turn .6s var(--gf-spring); }
.gf-glyph--more { width: 30px; height: 12px; stroke-width: 1.7; }
@keyframes gf-turn { from { rotate: -90deg; } to { rotate: 0deg; } }

/* ---- menu ------------------------------------------------------------------- */
.gf-menu {
  position: absolute;
  right: 22px;
  bottom: 90px;
  z-index: 20;
  min-width: 176px;
  padding: 6px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  background: rgba(252, 252, 253, .72);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  backdrop-filter: blur(24px) saturate(1.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9), 0 0 0 .5px rgba(0, 0, 0, .14), 0 24px 48px -16px rgba(10, 12, 20, .4);
  transform-origin: 100% 100%;
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px) scale(.94);
  transition: opacity .2s var(--gf-ease), transform .32s var(--gf-spring), visibility 0s .32s;
}
.gf-menu[data-open] { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }
.gf-root[data-tone="dark"] .gf-menu { background: rgba(30, 30, 34, .72); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .1), 0 0 0 .5px rgba(255, 255, 255, .1), 0 24px 48px -16px rgba(0, 0, 0, .8); }
.gf-menu-item {
  all: unset;
  box-sizing: border-box;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 450;
  color: #18181b;
  cursor: pointer;
}
.gf-root[data-tone="dark"] .gf-menu-item { color: #f4f4f5; }
.gf-menu-item:hover, .gf-menu-item:focus-visible { background: rgba(24, 24, 27, .07); }
.gf-root[data-tone="dark"] .gf-menu-item:hover, .gf-root[data-tone="dark"] .gf-menu-item:focus-visible { background: rgba(255, 255, 255, .09); }
.gf-menu-item--danger { color: #d92d20; }
.gf-root[data-tone="dark"] .gf-menu-item--danger { color: #ff6b5e; }

/* ---- entrance: the folder assembles itself ---------------------------------- */
.gf-root:not([data-entered]) .gf-back,
.gf-root:not([data-entered]) .gf-back-rim { translate: 0 22px; opacity: 0; }
.gf-root:not([data-entered]) .gf-sheet { translate: 0 -120px; opacity: 0; }
.gf-root:not([data-entered]) .gf-front { translate: 0 46px; opacity: 0; }
.gf-root:not([data-entered]) .gf-key { opacity: 0; scale: .6; }
.gf-root:not([data-entered]) .gf-shadow { opacity: 0; }
.gf-back, .gf-back-rim { transition: translate 1s var(--gf-ease), opacity .9s var(--gf-ease); }
.gf-root[data-entered] .gf-sheet { transition-delay: calc(var(--gf-depth) * 40ms), 0s, calc(.18s + var(--gf-depth) * 90ms), calc(.18s + var(--gf-depth) * 90ms); }
.gf-root[data-entered] .gf-front { transition-delay: 0s, .42s, .42s; }
.gf-key { transition: transform .35s var(--gf-spring), box-shadow .35s var(--gf-ease), opacity .6s var(--gf-ease) .7s, scale .7s var(--gf-spring) .7s; }

@media (prefers-reduced-motion: reduce) {
  .gf-root *, .gf-root *::before, .gf-root *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    animation: none !important;
  }
  .gf-tilt { transform: none; }
}
`,A=["aurora","ember","dusk","glacier","verdant"];function F(e){return e<1024?`${e} B`:e<1048576?`${(e/1024).toFixed(0)} KB`:e<0x40000000?`${(e/1024/1024).toFixed(1)} MB`:`${(e/1024/1024/1024).toFixed(2)} GB`}e.s(["ResultFolder",0,function({itemId:e,name:n,photoUrl:i,assets:g,canManage:p,seed:x,appearDelay:m,width:u=300}){let b=(0,r.useRouter)(),v=(0,a.useRef)(null),[y,w]=(0,a.useState)(!1),[k,j]=(0,a.useState)(null),[N,C]=(0,a.useState)(!1),[z,S]=(0,a.useState)(!1),R=g.map(e=>({name:e.name,meta:F(e.size),image:e.mime.startsWith("image/")?`/api/file?key=${encodeURIComponent(e.key)}`:void 0})),E=e=>`/api/file?key=${encodeURIComponent(e.key)}`;async function L(t){let a=t.target.files?.[0];if(t.target.value="",!a)return;w(!0);let r=new FormData;r.append("itemId",e),r.append("file",a);let o=await fetch("/api/media/upload",{method:"POST",body:r});(w(!1),o.ok)?b.refresh():alert((await o.json().catch(()=>({}))).message||"Gagal unggah.")}return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("input",{ref:v,type:"file",className:"hidden",onChange:L}),(0,t.jsx)("div",{onMouseEnter:()=>S(!0),onMouseLeave:()=>S(!1),children:(0,t.jsx)(M,{label:n,meta:y?"Mengunggah…":`${g.length} file`,art:i?void 0:A[x%A.length],image:i??void 0,seed:x,width:u,appearDelay:m,files:R,action:p?"add":"none",open:z,onOpenChange:()=>C(!0),onAdd:()=>(v.current?.click(),{name:"Mengunggah…",meta:""})},g.map(e=>e.id).join(",")+(y?":busy":""))}),N&&(0,t.jsx)("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4",onClick:()=>C(!1),children:(0,t.jsxs)("div",{className:"flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-900/55 text-white shadow-2xl backdrop-blur-2xl backdrop-saturate-150",onClick:e=>e.stopPropagation(),children:[(0,t.jsxs)("div",{className:"flex items-center gap-3 border-b border-white/10 px-4 py-2.5",children:[(0,t.jsxs)("div",{className:"flex items-center gap-1.5",children:[(0,t.jsx)("span",{className:"h-3 w-3 rounded-full bg-[#ff5f57]"}),(0,t.jsx)("span",{className:"h-3 w-3 rounded-full bg-[#febc2e]"}),(0,t.jsx)("span",{className:"h-3 w-3 rounded-full bg-[#28c840]"})]}),(0,t.jsxs)("div",{className:"ml-1 flex items-center gap-1 text-white/50",children:[(0,t.jsx)(o.f,{className:"h-5 w-5"}),(0,t.jsx)(s.f,{className:"h-5 w-5"})]}),(0,t.jsx)("p",{className:"flex-1 truncate text-center text-14 font-semibold",children:n}),(0,t.jsxs)("div",{className:"flex items-center gap-2 text-white/60",children:[(0,t.jsx)("span",{className:"grid h-7 w-7 place-items-center rounded-md bg-white/10",children:(0,t.jsx)(l,{className:"h-4 w-4"})}),p&&(0,t.jsx)("button",{title:"Unggah",className:"grid h-7 w-7 place-items-center rounded-md hover:bg-white/10",onClick:()=>v.current?.click(),children:(0,t.jsx)(d,{className:"h-4 w-4"})}),(0,t.jsx)("span",{className:"grid h-7 w-7 place-items-center rounded-md",children:(0,t.jsx)(f.f,{className:"h-4 w-4"})}),(0,t.jsx)("button",{className:"ml-1 text-13 text-white/70 hover:text-white",onClick:()=>C(!1),children:"Tutup"})]})]}),0===g.length?(0,t.jsx)("p",{className:"py-20 text-center text-white/50",children:y?"Mengunggah…":"Folder kosong."}):(0,t.jsx)("div",{className:"grid grid-cols-3 gap-5 overflow-auto p-6 sm:grid-cols-4 md:grid-cols-5",children:g.map(e=>(0,t.jsxs)("button",{onClick:()=>j(e),className:"group flex flex-col items-center gap-1.5",children:[(0,t.jsx)("div",{className:"grid h-24 w-24 place-items-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:ring-white/40",children:e.mime.startsWith("image/")?(0,t.jsx)("img",{src:E(e),alt:e.name,className:"h-full w-full object-cover"}):e.mime.startsWith("video/")?(0,t.jsx)(h,{className:"h-10 w-10 text-white/70"}):(0,t.jsx)(c.f,{className:"h-10 w-10 text-white/70"})}),(0,t.jsx)("p",{className:"max-w-24 truncate rounded px-1.5 text-12 text-white/90 group-hover:bg-blue-600 group-hover:text-white",children:e.name}),(0,t.jsx)("p",{className:"text-10 text-white/40",children:F(e.size)})]},e.id))})]})}),k&&(0,t.jsx)("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",onClick:()=>j(null),children:(0,t.jsxs)("div",{className:"flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-xl bg-card p-4",onClick:e=>e.stopPropagation(),children:[(0,t.jsxs)("div",{className:"flex items-start justify-between gap-2",children:[(0,t.jsxs)("div",{className:"min-w-0",children:[(0,t.jsx)("p",{className:"truncate font-medium",children:k.name}),(0,t.jsxs)("p",{className:"text-12 text-muted-foreground",children:[F(k.size)," · ",k.mime]})]}),(0,t.jsx)("button",{className:"text-14 text-muted-foreground hover:text-foreground",onClick:()=>j(null),children:"Tutup"})]}),(0,t.jsx)("div",{className:"flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted",children:k.mime.startsWith("image/")?(0,t.jsx)("img",{src:E(k),alt:k.name,className:"max-h-[70vh] w-auto object-contain"}):k.mime.startsWith("video/")?(0,t.jsx)("video",{src:E(k),controls:!0,className:"max-h-[70vh] w-full"}):(0,t.jsx)("a",{href:E(k),target:"_blank",rel:"noopener",className:"p-8 text-14 text-primary underline",children:"Buka file di tab baru"})}),(0,t.jsx)("a",{href:`${E(k)}&name=${encodeURIComponent(k.name)}`,className:"inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground",children:"Unduh"})]})})]})}],31019)}])})();