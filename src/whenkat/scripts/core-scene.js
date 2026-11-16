/** Whenkat compute core. Native WebGL2, no dependencies or external assets.
 * The solid is a ray-marched signed-distance field with bevels, material lighting,
 * soft shadows, ambient occlusion, and a secondary floor-reflection ray.
 * Each scene owns its GPU resources. Animation pauses offscreen and in hidden tabs.
 */
export const vertexSource = `#version 300 es
in vec2 position;
void main(){ gl_Position=vec4(position,0.,1.); }`;
export const fragmentSource = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float travel;
mat2 rotate(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
// x = distance, y = material: 1 titanium, 2 luminous core, 3 floor.
vec2 solid(vec3 p){
  p.xz=rotate(-.2)*p.xz;
  float cell=clamp(floor((p.x+.096)/.192),-5.,5.);
  float metal=10.;
  for(int j=-1;j<=1;j++){
    float index=clamp(cell+float(j),-5.,5.);
    if(abs(index)<.5) continue;
    vec3 q=p;
    q.x-=index*.192;
    float h=1.24-.085*abs(index);
    q.y-=h-.72;
    metal=min(metal,box(q,vec3(.055,h,.58+.045*abs(index)))-.026);
  }
  float core=box(p-vec3(0.,.32,0.),vec3(.072,.96,.45))-.035;
  float foot=box(p-vec3(0.,-.79,0.),vec3(1.105,.06,.88))-.04;
  metal=min(metal,foot);
  return core<metal ? vec2(core,2.) : vec2(metal,1.);
}
vec2 world(vec3 p){vec2 m=solid(p);float floorD=p.y+.92;return floorD<m.x?vec2(floorD,3.):m;}
vec2 trace(vec3 ro,vec3 rd){float t=0.;vec2 h=vec2(0.);for(int i=0;i<76;i++){h=world(ro+rd*t);if(h.x<.0015||t>16.)break;t+=h.x*.82;}return vec2(t,h.y);}
vec3 normal(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(world(p+e.xyy).x-world(p-e.xyy).x,world(p+e.yxy).x-world(p-e.yxy).x,world(p+e.yyx).x-world(p-e.yyx).x));}
float shadow(vec3 p,vec3 l){float t=.025,s=1.;for(int i=0;i<22;i++){float h=solid(p+l*t).x;s=min(s,10.*h/t);t+=clamp(h,.035,.24);if(h<.001||t>5.)break;}return clamp(s,.1,1.);}
float occlusion(vec3 p,vec3 n){float a=0.,w=1.;for(int i=1;i<4;i++){float d=float(i)*.075;a+=(d-world(p+n*d).x)*w;w*=.6;}return clamp(1.-a*2.8,.3,1.);}
vec3 lightSurface(vec3 p,vec3 n,vec3 rd,float mat){
  vec3 lime=vec3(.68,1.,.11);
  if(mat>1.5&&mat<2.5) return lime*(2.3+.15*sin(time*.7));
  vec3 key=normalize(vec3(-3.,5.,4.));
  vec3 rim=normalize(vec3(3.,2.,-3.));
  float diffuse=max(dot(n,key),0.);
  float spec=pow(max(dot(n,normalize(key-rd)),0.),65.);
  float rimSpec=pow(max(dot(n,normalize(rim-rd)),0.),28.);
  float fresnel=pow(1.-max(dot(n,-rd),0.),3.);
  float brush=.5+.5*sin(p.y*540.+sin(p.z*99.)*2.);
  float ao=occlusion(p,n);
  float sh=shadow(p+n*.015,key);
  vec3 base=vec3(.29,.32,.31)*( .92+.08*brush );
  vec3 c=base*(.065+diffuse*.55*sh)*ao;
  c+=vec3(.95,1.,.92)*spec*1.8*sh;
  c+=vec3(.46,.58,.58)*rimSpec*.65;
  c+=vec3(.29,.36,.34)*fresnel*.55;
  vec3 reflected=reflect(rd,n);
  float panel=pow(max(dot(reflected,normalize(vec3(-2.,2.4,3.))),0.),12.);
  float strip=pow(max(dot(reflected,normalize(vec3(3.,1.,1.))),0.),35.);
  c+=vec3(.68,.74,.73)*panel*.75+vec3(.85,.92,.8)*strip*.55;
  float glow=exp(-abs(p.x)*5.)*max(0.,1.-abs(p.y-.3)*.42);
  c+=lime*glow*.22*ao;
  return c;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
  float a=.65+pointer.x*.35+travel*.25+.035*sin(time*.22);
  float elevation=2.1+pointer.y*.3+travel*.4;
  vec3 ro=vec3(sin(a)*5.4,elevation,cos(a)*5.4);
  vec3 target=vec3(0.,.3,0.);
  vec3 forward=normalize(target-ro),right=normalize(cross(forward,vec3(0.,1.,0.))),up=cross(right,forward);
  vec3 rd=normalize(forward*1.55+right*uv.x+up*uv.y);
  vec3 bg=vec3(.0015,.002,.0012);
  vec3 color=bg;
  vec2 hit=trace(ro,rd);
  if(hit.x<16.){
    vec3 p=ro+rd*hit.x,n=normal(p);
    if(hit.y>2.5){
      float pool=exp(-dot(p.xz,p.xz)*.22);
      color=vec3(.002,.003,.0015)+vec3(.009,.013,.005)*pool;
      color*=shadow(p+n*.02,normalize(vec3(-3.,5.,4.)));
      vec3 reflected=reflect(rd,n);
      vec2 h=trace(p+n*.02,reflected);
      if(h.x<10.&&h.y<2.5){vec3 rp=p+n*.02+reflected*h.x;color+=lightSurface(rp,normal(rp),reflected,h.y)*.18*exp(-h.x*.1);}
      color=mix(bg,color,exp(-hit.x*.035));
    }else{color=lightSurface(p,n,rd,hit.y);}
  }
  // A restrained optical halo at the energy source; surface rendering remains 3D.
  float center=length(uv-vec2(-.03,.05));
  color+=vec3(.28,.45,.035)*exp(-center*7.)*.09;
  color*=1.-.25*smoothstep(.25,1.,length(uv));
  color=color/(color+vec3(1.));
  color=pow(color,vec3(1./2.2));
  fragColor=vec4(color,1.);
}`;

export function mountCoreScene(root) {
  if (root.dataset.mounted) return root._coreCleanup;
  root.dataset.mounted = 'true';
  const canvas = root.querySelector('canvas');
  const button = root.querySelector('[data-core-toggle]');
  const status = root.querySelector('[data-core-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 650px)');
  let gl, program, buffer, uniforms;
  let running = false, ready = false, inView = false, disposed = false, frame = 0;
  let elapsed = 0, last = 0, previousDraw = 0;
  const target = [0, 0], smoothed = [0, 0];
  let slowFrames = 0, quality = 1;
  const listeners = new AbortController();
  function label() {
    button.textContent = ready ? (running ? 'Pause motion' : 'Resume motion') : 'Enable 3D';
    button.setAttribute('aria-label', button.textContent);
    button.hidden = false;
    if(status) status.textContent=ready?'MOVE TO EXPLORE':'REBUILD. RETHINK. REPEAT.';
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);
    }
    return shader;
  }
  function resize() {
    if (!gl) return;
    const box = root.getBoundingClientRect();
    // Limit fragment work rather than rendering at an unrestricted device DPR.
    const scale = Math.min(devicePixelRatio || 1, 1.35, 900 / Math.max(box.width, 1)) * quality;
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (ready && !running) draw();
  }
  function draw() {
    if (!gl || !program || gl.isContextLost()) return;
    const rect=root.getBoundingClientRect();
    const progress=Math.max(-1,Math.min(1,(innerHeight*.5-rect.top-rect.height*.5)/innerHeight));
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
    gl.uniform2f(uniforms.pointer,smoothed[0],smoothed[1]);
    gl.uniform1f(uniforms.time,elapsed);
    gl.uniform1f(uniforms.travel,progress);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function tick(now) {
    frame=0;
    if(disposed || !running || !inView || document.hidden) { last=0; return; }
    const dt=last?Math.min((now-last)/1000,.08):0;
    last=now;elapsed+=dt;
    const blend=1-Math.exp(-dt*4);
    smoothed[0]+=(target[0]-smoothed[0])*blend;
    smoothed[1]+=(target[1]-smoothed[1])*blend;
    // 30fps is sufficient for this deliberately slow scene.
    if(now-previousDraw>=32){
      if(now-previousDraw>80&&previousDraw){slowFrames++;}else{slowFrames=Math.max(0,slowFrames-1);}
      if(slowFrames>12&&quality>.55){quality*=.8;resize();slowFrames=0;}
      previousDraw=now;draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!frame&&running&&ready&&inView&&!document.hidden){last=0;previousDraw=0;frame=requestAnimationFrame(tick);}}
  function halt(){cancelAnimationFrame(frame);frame=0;last=0;}
  function release(){if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);}buffer=null;program=null;}
  function fail(error){
    running=false;ready=false;halt();release();root.classList.remove('core-ready');
    button.hidden=true;if(status)status.textContent='REBUILD. RETHINK. REPEAT.';
    root.dataset.coreState='fallback';
    console.warn('Whenkat 3D unavailable; showing artwork.',error);
  }
  function start(){
    if(disposed)return;
    if(!ready){
      try{
        gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
        if(!gl)throw new Error('WebGL2 unavailable');
        program=gl.createProgram();
        const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragmentSource);
        gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
        gl.deleteShader(vs);gl.deleteShader(fs);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
        const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
        uniforms=Object.fromEntries(['resolution','pointer','time','travel'].map(n=>[n,gl.getUniformLocation(program,n)]));
        resize();draw();ready=true;root.classList.add('core-ready');root.dataset.coreState='ready';
      }catch(error){fail(error);return;}
    }
    root.classList.add('core-ready');running=true;label();schedule();
  }
  function pause(){running=false;halt();label();}
  button.addEventListener('click',()=>running?pause():start(),{signal:listeners.signal});
  root.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    const r=root.getBoundingClientRect();target[0]=((e.clientX-r.left)/r.width-.5)*2;target[1]=((e.clientY-r.top)/r.height-.5)*2;
  },{signal:listeners.signal,passive:true});
  root.addEventListener('pointerleave',()=>{target[0]=target[1]=0;},{signal:listeners.signal});
  document.addEventListener('visibilitychange',()=>document.hidden?halt():schedule(),{signal:listeners.signal});
  reduced.addEventListener('change',()=>{if(reduced.matches){pause();root.classList.remove('core-ready');}else if(ready){root.classList.add('core-ready');}},{signal:listeners.signal});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('context lost');},{signal:listeners.signal});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(root);
  const observer=new IntersectionObserver(entries=>{
    inView=entries.some(e=>e.isIntersecting);
    if(inView){if(!ready&&!reduced.matches&&!mobile.matches&&!navigator.connection?.saveData&&root.dataset.coreState!=='fallback')start();else schedule();}
    else halt();
  },{threshold:.05});observer.observe(root);
  label();
  const cleanup=()=>{if(disposed)return;disposed=true;halt();listeners.abort();observer.disconnect();resizeObserver.disconnect();release();gl?.getExtension('WEBGL_lose_context')?.loseContext();delete root.dataset.mounted;delete root._coreCleanup;};
  root._coreCleanup=cleanup;
  return cleanup;
}
export function mountAllCoreScenes(){return [...document.querySelectorAll('[data-core-scene]')].map(mountCoreScene);}
