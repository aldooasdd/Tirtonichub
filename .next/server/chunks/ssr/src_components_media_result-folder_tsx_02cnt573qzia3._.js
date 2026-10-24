module.exports=[85234,a=>{"use strict";var b=a.i(36737),c=a.i(19024),d=a.i(98904),e=a.i(52325),f=a.i(32755),g=a.i(3445);let h={name:"layout-grid",size:24,node:[["rect",{width:"7",height:"7",x:"3",y:"3",rx:"1",key:"1g98yp"}],["rect",{width:"7",height:"7",x:"14",y:"3",rx:"1",key:"6d4xhi"}],["rect",{width:"7",height:"7",x:"14",y:"14",rx:"1",key:"nxv5o0"}],["rect",{width:"7",height:"7",x:"3",y:"14",rx:"1",key:"1bb6yr"}]]};h.node;let i=(0,g.f)(h),j={name:"download",size:24,node:[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]]};j.node;let k=(0,g.f)(j),l={name:"upload",size:24,node:[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]};l.node;let m=(0,g.f)(l);var n=a.i(58591);let o={name:"film",size:24,node:[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M7 3v18",key:"bbkbws"}],["path",{d:"M3 7.5h4",key:"zfgn84"}],["path",{d:"M3 12h18",key:"1i2n21"}],["path",{d:"M3 16.5h4",key:"1230mu"}],["path",{d:"M17 3v18",key:"in4fa5"}],["path",{d:"M17 7.5h4",key:"myr1c1"}],["path",{d:"M17 16.5h4",key:"go4c1d"}]]};o.node;let p=(0,g.f)(o),q={aurora:{style:"streak",colors:["#f4efe9","#e9c2b8","#c2433f","#2a1e2a","#22395e","#6f97c2","#e5edf4"],scale:.7,warp:1.4,angle:-.62,gloss:.18,veins:0},ember:{style:"marble",colors:["#07090c","#16252c","#3d5f68","#1a1416","#a3201a","#ef4a2b","#ff8a5c"],scale:.62,warp:3.2,angle:-.5,gloss:.55,veins:.6},dusk:{style:"marble",colors:["#120c18","#3e2850","#8f6c9c","#2b1a24","#b3502f","#eab08a","#fbe7d2"],scale:.75,warp:3.6,angle:.8,gloss:.5,veins:.5},glacier:{style:"streak",colors:["#f7f8fa","#d9e2ea","#9fb4c7","#e8edf2","#bccbd8","#ffffff"],scale:.7,warp:1.6,angle:.35,gloss:.25,veins:0},verdant:{style:"marble",colors:["#070b08","#173024","#4f7a5a","#141812","#a7843a","#e9cf87","#fbf3d6"],scale:.7,warp:3.4,angle:2.1,gloss:.5,veins:.5}};function r(a){let b=a>>>0;return()=>{let a=b=b+0x6d2b79f5>>>0;return a=Math.imul(a^a>>>15,1|a),(((a^=a+Math.imul(a^a>>>7,61|a))^a>>>14)>>>0)/0x100000000}}function s(a){let b=0x811c9dc5;for(let c=0;c<a.length;c++)b=Math.imul(b^a.charCodeAt(c),0x1000193);return b>>>0}let t=new Map,u=[],v=!1;function w({art:a,seed:d,w:e,h:f,density:g,priority:h,className:i}){let j=c.useRef(null),[k,l]=c.useState(!1),m=JSON.stringify("string"==typeof a?q[a]:a),n=Math.round(e*g),o=Math.round(f*g);return c.useEffect(()=>{var a;let b,c,e=!0;return l(!1),(a=JSON.parse(m),b=JSON.stringify([a,d,n,o]),!(c=t.get(b))&&(c=new Promise(b=>{let c,e,f,g,i,j,k,l,m,p,q,s,t,w,x,y,z,A,B,C,D,E,F,G,H,I,J=u.length;for(;J>1&&u[J-1].priority>h;)J--;u.splice(J,0,{job:(c=Math.max(1,Math.round(n)),e=Math.max(1,Math.round(o)),g=(f=a.colors.length>=2?a.colors:["#111111","#eeeeee"]).map((a,b)=>{let c,d;return{t:b/(f.length-1),c:(3===(c=a.trim().replace(/^#/,"")).length&&(c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]),[(d=/^[0-9a-f]{6}$/i.test(c)?parseInt(c,16):8421504)>>16&255,d>>8&255,255&d])}}),i=a.scale??.7,j=a.warp??3,k=a.gloss??.4,l=a.veins??0,m="streak"===a.style,p=function(a){let b=r(a),c=new Uint8Array(512),d=new Float32Array(512),e=[];for(let a=0;a<256;a++)e.push(a);for(let a=255;a>0;a--){let c=Math.floor(b()*(a+1)),d=e[a];e[a]=e[c],e[c]=d}for(let a=0;a<512;a++)c[a]=e[255&a];for(let a=0;a<256;a++){let c=b()*Math.PI*2;d[2*a]=Math.cos(c),d[2*a+1]=Math.sin(c)}let f=(a,b)=>{let e=Math.floor(a),f=Math.floor(b),g=a-e,h=b-f,i=255&e,j=255&f,k=2*c[i+c[j]],l=2*c[i+1+c[j]],m=2*c[i+c[j+1]],n=2*c[i+1+c[j+1]],o=d[k]*g+d[k+1]*h,p=d[l]*(g-1)+d[l+1]*h,q=d[m]*g+d[m+1]*(h-1),r=d[n]*(g-1)+d[n+1]*(h-1),s=g*g*g*(g*(6*g-15)+10);return o+s*(p-o)+h*h*h*(h*(6*h-15)+10)*(q-o+s*(r-q-p+o))};return(a,b,c)=>{let d=0,e=.5;for(let g=0;g<c;g++){d+=e*f(a,b);let c=1.6*a+1.2*b+7.1;b=-1.2*a+1.6*b+3.3,a=c,e*=.5}return d}}(977*d+13),s=50*(q=r(d+1))(),t=50*q(),x=Math.cos(w=(a.angle??0)+(q()-.5)*.5),y=Math.sin(w),z=Math.min(c,e),C=new Float32Array((A=Math.ceil(c/2)+3)*(B=Math.ceil(e/2)+3)),D=new Float32Array(A*B),E=new Float32Array(c*e),F=new Float32Array(c*e),G=new Uint8ClampedArray(c*e*4),H=0,I=a=>{for(let b=0;b<A;b++){let d=((b-1)*2-c/2)/z,f=((a-1)*2-e/2)/z,g=(d*x-f*y)*i,h=(d*y+f*x)*i;m&&(g*=.14,h*=2.2);let k=p(g+=s,h+=t,3),l=p(g+5.2,h+1.3,3),n=p(g+j*k+1.7,h+j*l+9.2,3),o=p(g+j*k+8.3,h+j*l+2.8,3);C[a*A+b]=p(g+j*n,h+j*o,4),D[a*A+b]=Math.sqrt(k*k+l*l)}},{width:c,height:e,pixels:G,step:a=>{if(H>=B)return!0;let b=Math.min(B,H+Math.max(1,a));for(;H<b;)I(H++);return!(H<B)&&((()=>{let a=(a,b,c,d)=>(-a+9*b+9*c-d)/16,b=new Float32Array(c*B);for(let d=0;d<B;d++){let e=d*A;for(let f=0;f<c;f++){let g=(f>>1)+1;b[d*c+f]=1&f?a(C[e+g-1],C[e+g],C[e+g+1],C[e+g+2]):C[e+g]}}for(let d=0;d<e;d++){let e=(d>>1)+1;for(let f=0;f<c;f++){E[d*c+f]=1&d?a(b[(e-1)*c+f],b[e*c+f],b[(e+1)*c+f],b[(e+2)*c+f]):b[e*c+f];let g=(f>>1)+1,h=D[e*A+g],i=1&f?(h+D[e*A+g+1])/2:h,j=1&d?1&f?(D[(e+1)*A+g]+D[(e+1)*A+g+1])/2:D[(e+1)*A+g]:i;F[d*c+f]=(i+j)/2}}})(),(()=>{let a=[],b=Math.max(1,Math.floor(E.length/4096));for(let c=0;c<E.length;c+=b)a.push(E[c]);a.sort((a,b)=>a-b);let d=a[Math.floor(.02*a.length)],f=1/(a[Math.floor(.98*a.length)]-d||1),h=f*z*.012;for(let a=0;a<e;a++)for(let b=0;b<c;b++){let i=a*c+b,j=(E[i]-d)*f;j=j<0?0:j>1?1:j;let m=1;for(;m<g.length-1&&g[m].t<j;)m++;let n=g[m-1],o=g[m],p=(j-n.t)/(o.t-n.t||1);p=(p=p<0?0:p>1?1:p)*p*(3-2*p);let q=(E[b<c-1?i+1:i]-E[b>0?i-1:i])*h,r=(E[a<e-1?i+c:i]-E[a>0?i-c:i])*h,s=(-(-.55*q)- -.65*r+.52)/Math.sqrt(q*q+r*r+1),t=Math.pow(s>0?s:0,24)*k*255,u=(.82+.28*s)*(1+.035*Math.sin(150*j+24*F[i]))*(1-l*Math.max(0,1-14*Math.abs(F[i]-.42))*.6);G[4*i]=(n.c[0]+(o.c[0]-n.c[0])*p)*u+t,G[4*i+1]=(n.c[1]+(o.c[1]-n.c[1])*p)*u+t,G[4*i+2]=(n.c[2]+(o.c[2]-n.c[2])*p)*u+t,G[4*i+3]=255}})(),!0)}}),priority:h,done:b}),function(){if(v)return;v=!0;let a=()=>{let b=performance.now()+7;for(;u.length&&performance.now()<b;){let a=u[0];if(a.job.step(4)){u.shift();let b=document.createElement("canvas");b.width=a.job.width,b.height=a.job.height,b.getContext("2d")?.putImageData(new ImageData(a.job.pixels,b.width,b.height),0,0),a.done(b)}}u.length?requestAnimationFrame(a):v=!1};requestAnimationFrame(a)}()}),t.set(b,c)),c).then(a=>{let b=j.current;e&&b&&(b.width=a.width,b.height=a.height,b.getContext("2d")?.drawImage(a,0,0),l(!0))}),()=>{e=!1}},[m,d,n,o,h]),(0,b.jsx)("canvas",{ref:j,"aria-hidden":"true",className:i,"data-ready":k||void 0,style:{width:e,height:f,maxWidth:"none"}})}let x="M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z",y="M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z",z=[{name:"Cover — final",meta:"PNG · 4.8 MB",art:"ember"},{name:"Moodboard",meta:"24 images",art:"dusk"},{name:"Brief.pdf",meta:"PDF · 1.2 MB"}];function A({label:a="My Files",meta:d,tone:e="light",art:f="aurora",seed:g=3,image:h,files:i=z,action:j="add",onAdd:k,onFilesChange:l,menu:m=[],labelPlacement:n="bottom-left",open:o,defaultOpen:p=!1,onOpenChange:q,onFileSelect:t,width:u=340,appear:v=!0,appearDelay:C=0,className:D,style:E}){let F=c.useId().replace(/:/g,""),G=c.useRef(null),H=c.useRef(null),I=c.useRef(null),J=c.useRef(null),K=c.useRef(null),[L,M]=c.useState(i),N=c.useRef(i.map((a,b)=>b)),O=c.useRef(i.length),[P,Q]=c.useState(null),[R,S]=c.useState(0),[T,U]=c.useState(p),V=o??T,W=c.useCallback(a=>{void 0===o&&U(a),q?.(a)},[o,q]),[X,Y]=c.useState(!1),[Z,$]=c.useState(!v),_=u/340,aa=+_;c.useEffect(()=>{if(!v)return;let a=G.current;if(!a||"u"<typeof IntersectionObserver)return void $(!0);let b=0,c=new IntersectionObserver(a=>{a.some(a=>a.isIntersecting)&&(c.disconnect(),b=window.setTimeout(()=>$(!0),C))},{threshold:.25});return c.observe(a),()=>{c.disconnect(),window.clearTimeout(b)}},[v,C]),c.useEffect(()=>{let a=G.current;if(!a)return;let b=0,c=0,d=0,e=()=>{b=0,a.style.setProperty("--gf-px",c.toFixed(3)),a.style.setProperty("--gf-py",d.toFixed(3))},f=f=>{if("touch"===f.pointerType)return;let g=a.getBoundingClientRect();c=(f.clientX-g.left)/g.width*2-1,d=(f.clientY-g.top)/g.height*2-1,b||(b=requestAnimationFrame(e))},g=()=>{c=0,d=0,b||(b=requestAnimationFrame(e))};return a.addEventListener("pointermove",f),a.addEventListener("pointerleave",g),()=>{a.removeEventListener("pointermove",f),a.removeEventListener("pointerleave",g),cancelAnimationFrame(b)}},[]),c.useEffect(()=>{H.current?.toggleAttribute("inert",!V)},[V]),c.useEffect(()=>{if(!V&&!X)return;let a=a=>{"Escape"===a.key&&(X?(Y(!1),J.current?.focus()):(W(!1),I.current?.focus()))},b=a=>{let b=a.target;!X||K.current?.contains(b)||J.current?.contains(b)||Y(!1),!V||X||G.current?.contains(b)||W(!1)};return document.addEventListener("keydown",a),document.addEventListener("pointerdown",b),()=>{document.removeEventListener("keydown",a),document.removeEventListener("pointerdown",b)}},[V,X,W]),c.useEffect(()=>{X&&K.current?.querySelector("[role=menuitem]")?.focus()},[X]);let ab=[{label:V?"Close folder":"Open folder",onSelect:()=>W(!V)},...m],ac=Math.max(0,L.length-4),ad=L.slice(ac),ae=L.length,af=d??ae+(1===ae?" item":" items");return(0,b.jsxs)("div",{ref:G,className:"gf-root"+(D?" "+D:""),"data-tone":e,"data-open":V||void 0,"data-entered":Z||void 0,"data-place":n,style:{width:u,height:326*_,...E},children:[(0,b.jsx)("style",{children:B}),(0,b.jsx)("div",{className:"gf-stage",style:{transform:"translateY("+54*_+"px) scale("+_+")"},children:(0,b.jsxs)("div",{className:"gf-tilt",children:[(0,b.jsx)("div",{className:"gf-shadow","aria-hidden":"true"}),(0,b.jsxs)("div",{className:"gf-back",style:{clipPath:"path('"+x+"')"},"aria-hidden":"true",children:[h?(0,b.jsx)("img",{className:"gf-art",src:h,alt:"",width:364,height:296,draggable:!1}):"none"!==f?(0,b.jsx)(w,{className:"gf-art",art:f,seed:g,w:364,h:296,density:aa,priority:0}):null,(0,b.jsx)("div",{className:"gf-back-sheen"})]}),(0,b.jsx)("svg",{className:"gf-rim gf-back-rim",viewBox:"0 0 340 272","aria-hidden":"true",children:(0,b.jsx)("path",{d:x})}),(0,b.jsxs)("div",{className:"gf-front"+(R?" gf-front--bump":""),style:{clipPath:"path('"+y+"')"},children:[(0,b.jsx)("div",{className:"gf-tint","aria-hidden":"true"}),(0,b.jsx)("div",{className:"gf-spec","aria-hidden":"true"}),(0,b.jsxs)("svg",{className:"gf-rim gf-front-rim",viewBox:"0 0 340 198","aria-hidden":"true",children:[(0,b.jsx)("defs",{children:(0,b.jsxs)("linearGradient",{id:"gf-rim-"+F,x1:"0",y1:"0",x2:"0",y2:"1",children:[(0,b.jsx)("stop",{offset:"0",stopColor:"#fff",stopOpacity:"0.95"}),(0,b.jsx)("stop",{offset:"0.35",stopColor:"#fff",stopOpacity:"0.35"}),(0,b.jsx)("stop",{offset:"1",stopColor:"#fff",stopOpacity:"0.12"})]})}),(0,b.jsx)("path",{d:y,stroke:"url(#gf-rim-"+F+")"})]}),(0,b.jsx)("button",{ref:I,type:"button",className:"gf-hit","aria-expanded":V,"aria-label":(V?"Close ":"Open ")+a+", "+ae+(1===ae?" item":" items"),onClick:()=>{Y(!1),W(!V)}}),(0,b.jsxs)("div",{className:"gf-label",children:[(0,b.jsx)("span",{className:"gf-title",children:a}),(0,b.jsx)("span",{className:"gf-meta",children:af},af)]})]},R),(0,b.jsx)("div",{ref:H,className:"gf-files",role:"list","aria-label":a+" contents",children:ad.map((a,c)=>{var d;let e=N.current[ac+c],f=(d=ad.length)<=1?0:c/(d-1)*2-1,g=r(s(a.name)+e),h=!!(a.art||a.image),i=(0,b.jsxs)(b.Fragment,{children:[h?a.image?(0,b.jsx)("img",{className:"gf-sheet-art",src:a.image,alt:"",width:272,height:184,draggable:!1}):(0,b.jsx)(w,{className:"gf-sheet-art",art:a.art,seed:s(a.name)%997,w:272,h:184,density:Math.min(aa,1.25),priority:1}):(0,b.jsxs)("span",{className:"gf-lines","aria-hidden":"true",children:[(0,b.jsx)("i",{style:{width:"86%"}}),(0,b.jsx)("i",{style:{width:"92%"}}),(0,b.jsx)("i",{style:{width:"64%"}}),(0,b.jsx)("i",{style:{width:"88%"}}),(0,b.jsx)("i",{style:{width:"42%"}})]}),(0,b.jsxs)("span",{className:"gf-sheet-head",children:[(0,b.jsx)("span",{className:"gf-sheet-name",children:a.name}),a.meta?(0,b.jsx)("span",{className:"gf-sheet-meta",children:a.meta}):null]})]}),j={className:"gf-sheet"+(h?" gf-sheet--art":"")+(e===P?" gf-sheet--drop":""),style:{"--gf-slot":f,"--gf-depth":ad.length-1-c,"--gf-jx":((g()-.5)*10).toFixed(2)+"px","--gf-jr":((g()-.5)*3.2).toFixed(2)+"deg",zIndex:c+1},onAnimationEnd:e===P?()=>Q(null):void 0};return(0,b.jsx)("div",{role:"listitem",className:"gf-sheet-slot",children:a.href?(0,b.jsx)("a",{...j,href:a.href,onClick:()=>t?.(a,ac+c),children:i}):(0,b.jsx)("button",{...j,type:"button",onClick:()=>t?.(a,ac+c),children:i})},e)})}),"none"!==j?(0,b.jsx)("button",{ref:J,type:"button",className:"gf-key gf-key--"+j,"aria-label":"add"===j?"Add a file to "+a:"More options for "+a,"aria-haspopup":"more"===j?"menu":void 0,"aria-expanded":"more"===j?X:void 0,"aria-controls":"more"===j?"gf-menu-"+F:void 0,onClick:()=>{let a,b,c;return"add"===j?(a=k?.(L)||{name:"Untitled "+(L.length+1),meta:"Just now"},b=[...L,a],c=O.current++,void(N.current=[...N.current,c],M(b),Q(c),S(a=>a+1),l?.(b))):Y(a=>!a)},children:"add"===j?(0,b.jsx)("svg",{className:"gf-glyph gf-glyph--plus",viewBox:"0 0 24 24","aria-hidden":"true",children:(0,b.jsx)("path",{d:"M12 4.5v15M4.5 12h15"})},R):(0,b.jsxs)("svg",{className:"gf-glyph gf-glyph--more",viewBox:"0 0 30 12","aria-hidden":"true",children:[(0,b.jsx)("rect",{x:"1",y:"1.5",width:"8",height:"9",rx:"3.4"}),(0,b.jsx)("rect",{x:"11",y:"1.5",width:"8",height:"9",rx:"3.4"}),(0,b.jsx)("rect",{x:"21",y:"1.5",width:"8",height:"9",rx:"3.4"})]})}):null,"more"===j?(0,b.jsx)("div",{ref:K,id:"gf-menu-"+F,role:"menu","aria-label":a+" options",className:"gf-menu","data-open":X||void 0,onKeyDown:a=>{let b=Array.from(K.current?.querySelectorAll("[role=menuitem]")??[]),c=b.indexOf(document.activeElement),d=c=>{a.preventDefault(),b[(c+b.length)%b.length]?.focus()};"ArrowDown"===a.key?d(c+1):"ArrowUp"===a.key?d(c-1):"Home"===a.key?d(0):"End"===a.key?d(b.length-1):"Tab"===a.key&&Y(!1)},children:ab.map((a,c)=>(0,b.jsx)("button",{type:"button",role:"menuitem",tabIndex:X?-1:void 0,disabled:!X,className:"gf-menu-item"+(a.danger?" gf-menu-item--danger":""),onClick:()=>{Y(!1),J.current?.focus(),a.onSelect?.()},children:a.label},a.label+c))}):null]})})]})}let B=`
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
`,C=["aurora","ember","dusk","glacier","verdant"];function D(a){return a<1024?`${a} B`:a<1048576?`${(a/1024).toFixed(0)} KB`:a<0x40000000?`${(a/1024/1024).toFixed(1)} MB`:`${(a/1024/1024/1024).toFixed(2)} GB`}a.s(["ResultFolder",0,function({itemId:a,name:g,photoUrl:h,assets:j,canManage:l,seed:o,appearDelay:q,width:r=300}){let s=(0,d.useRouter)(),t=(0,c.useRef)(null),[u,v]=(0,c.useState)(!1),[w,x]=(0,c.useState)(null),[y,z]=(0,c.useState)(!1),[B,E]=(0,c.useState)(!1),[F,G]=(0,c.useState)(new Set),H=j.map(a=>({name:a.name,meta:D(a.size),image:a.mime.startsWith("image/")?`/api/file?key=${encodeURIComponent(a.key)}`:void 0})),I=a=>`/api/file?key=${encodeURIComponent(a.key)}`,J=a=>`${I(a)}&name=${encodeURIComponent(a.name)}`;async function K(b){let c=b.target.files?.[0];if(b.target.value="",!c)return;v(!0);let d=new FormData;d.append("itemId",a),d.append("file",c);let e=await fetch("/api/media/upload",{method:"POST",body:d});(v(!1),e.ok)?s.refresh():alert((await e.json().catch(()=>({}))).message||"Gagal unggah.")}return(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)("input",{ref:t,type:"file",className:"hidden",onChange:K}),(0,b.jsx)("div",{onMouseEnter:()=>E(!0),onMouseLeave:()=>E(!1),children:(0,b.jsx)(A,{label:g,meta:u?"Mengunggah…":`${j.length} file`,art:h?void 0:C[o%C.length],image:h??void 0,seed:o,width:r,appearDelay:q,files:H,action:l?"add":"none",open:B,onOpenChange:()=>z(!0),onAdd:()=>(t.current?.click(),{name:"Mengunggah…",meta:""})},j.map(a=>a.id).join(",")+(u?":busy":""))}),y&&(0,b.jsx)("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4",onClick:()=>z(!1),children:(0,b.jsxs)("div",{className:"flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/55 text-neutral-900 shadow-2xl backdrop-blur-2xl backdrop-saturate-150",onClick:a=>a.stopPropagation(),children:[(0,b.jsxs)("div",{className:"flex items-center gap-3 border-b border-black/10 px-4 py-2.5",children:[(0,b.jsxs)("div",{className:"group/tl flex items-center gap-1.5",children:[(0,b.jsx)("button",{title:"Tutup",onClick:()=>z(!1),className:"grid h-3.5 w-3.5 place-items-center rounded-full bg-[#ff5f57] text-[8px] font-bold text-black/50 hover:text-black/80",children:(0,b.jsx)("span",{className:"opacity-0 group-hover/tl:opacity-100",children:"✕"})}),(0,b.jsx)("span",{className:"h-3.5 w-3.5 rounded-full bg-[#febc2e]"}),(0,b.jsx)("span",{className:"h-3.5 w-3.5 rounded-full bg-[#28c840]"})]}),(0,b.jsxs)("div",{className:"ml-1 flex items-center gap-1 text-black/30",children:[(0,b.jsx)(e.f,{className:"h-5 w-5"}),(0,b.jsx)(f.f,{className:"h-5 w-5"})]}),(0,b.jsx)("p",{className:"flex-1 truncate text-center text-14 font-semibold",children:g}),(0,b.jsxs)("div",{className:"flex items-center gap-2 text-black/50",children:[(0,b.jsx)("span",{className:"grid h-7 w-7 place-items-center rounded-md bg-black/5",children:(0,b.jsx)(i,{className:"h-4 w-4"})}),l&&(0,b.jsx)("button",{title:"Unggah",className:"grid h-7 w-7 place-items-center rounded-md hover:bg-black/10",onClick:()=>t.current?.click(),children:(0,b.jsx)(m,{className:"h-4 w-4"})}),(0,b.jsx)("button",{title:F.size?`Unduh ${F.size} terpilih`:"Unduh semua",className:"grid h-7 w-7 place-items-center rounded-md hover:bg-black/10 disabled:opacity-40",disabled:0===j.length,onClick:()=>{(F.size?j.filter(a=>F.has(a.id)):j).forEach((a,b)=>setTimeout(()=>{let b=document.createElement("a");b.href=J(a),b.download=a.name,document.body.appendChild(b),b.click(),b.remove()},400*b))},children:(0,b.jsx)(k,{className:"h-4 w-4"})})]})]}),0===j.length?(0,b.jsx)("p",{className:"py-20 text-center text-black/40",children:u?"Mengunggah…":"Folder kosong."}):(0,b.jsx)("div",{className:"grid grid-cols-3 gap-5 overflow-auto p-6 sm:grid-cols-4 md:grid-cols-5",children:j.map(a=>{let c=F.has(a.id);return(0,b.jsxs)("button",{onClick:()=>{let b;return b=a.id,G(a=>{let c=new Set(a);return c.has(b)?c.delete(b):c.add(b),c})},onDoubleClick:()=>x(a),className:"group flex flex-col items-center gap-1.5",children:[(0,b.jsx)("div",{className:`grid h-24 w-24 place-items-center overflow-hidden rounded-xl ${c?"bg-blue-500/20 ring-2 ring-blue-500":"bg-black/5 ring-1 ring-black/10 group-hover:ring-black/30"}`,children:a.mime.startsWith("image/")?(0,b.jsx)("img",{src:I(a),alt:a.name,className:"h-full w-full object-cover"}):a.mime.startsWith("video/")?(0,b.jsx)(p,{className:"h-10 w-10 text-black/50"}):(0,b.jsx)(n.f,{className:"h-10 w-10 text-black/50"})}),(0,b.jsx)("p",{className:`max-w-24 truncate rounded px-1.5 text-12 ${c?"bg-blue-600 text-white":"text-neutral-800"}`,children:a.name}),(0,b.jsx)("p",{className:"text-10 text-black/40",children:D(a.size)})]},a.id)})})]})}),w&&(0,b.jsx)("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4",onClick:()=>x(null),children:(0,b.jsxs)("div",{className:"flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-xl bg-card p-4",onClick:a=>a.stopPropagation(),children:[(0,b.jsxs)("div",{className:"flex items-start justify-between gap-2",children:[(0,b.jsxs)("div",{className:"min-w-0",children:[(0,b.jsx)("p",{className:"truncate font-medium",children:w.name}),(0,b.jsxs)("p",{className:"text-12 text-muted-foreground",children:[D(w.size)," · ",w.mime]})]}),(0,b.jsx)("button",{className:"text-14 text-muted-foreground hover:text-foreground",onClick:()=>x(null),children:"Tutup"})]}),(0,b.jsx)("div",{className:"flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted",children:w.mime.startsWith("image/")?(0,b.jsx)("img",{src:I(w),alt:w.name,className:"max-h-[70vh] w-auto object-contain"}):w.mime.startsWith("video/")?(0,b.jsx)("video",{src:I(w),controls:!0,className:"max-h-[70vh] w-full"}):(0,b.jsx)("a",{href:I(w),target:"_blank",rel:"noopener",className:"p-8 text-14 text-primary underline",children:"Buka file di tab baru"})}),(0,b.jsx)("a",{href:J(w),className:"inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-14 font-medium text-primary-foreground",children:"Unduh"})]})})]})}],85234)}];

//# sourceMappingURL=src_components_media_result-folder_tsx_02cnt573qzia3._.js.map