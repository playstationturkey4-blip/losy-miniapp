/* One AudioContext and one completed preload promise. No delayed HTMLAudio. */
const FILES={start:'/assets/sounds/losy-start.mp3',tick:'/assets/sounds/losy-tap.mp3',click:'/assets/sounds/losy-tap.mp3',cashout:'/assets/sounds/salute-win.mp3',win:'/assets/sounds/salute-win.mp3',lose:'/assets/sounds/losy-lose.mp3'};
export function createUpgradeAudio(enabled) {
  let ctx=null,soundsReadyPromise=null,resuming=null,decodeCount=0;
  const buffers={},active=new Set(),played={};
  function ensureAudioContext(){
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;ctx=new AC();}
    return ctx;
  }
  function resumeAudioContext(){
    if(!enabled()||document.hidden)return Promise.resolve(false);
    try{
      const c=ensureAudioContext();if(!c)return Promise.resolve(false);
      if(c.state==='running')return Promise.resolve(true);
      // A resume attempted on pageshow can remain pending until a gesture.
      // Never let that pending request suppress the real gesture's resume call.
      const attempt=c.resume();
      if(navigator.userActivation?.isActive){
        const unlock=c.createBufferSource();unlock.buffer=c.createBuffer(1,1,c.sampleRate);
        unlock.connect(c.destination);unlock.onended=()=>unlock.disconnect();unlock.start(0);
      }
      return attempt.then(()=>c.state==='running').catch(()=>false);
    }catch{return Promise.resolve(false);}
  }
  function preloadSounds(){
    if(soundsReadyPromise)return soundsReadyPromise;
    const c=ensureAudioContext();if(!c)return Promise.resolve(false);
    soundsReadyPromise=Promise.all([...new Set(Object.values(FILES))].map(async url=>{
      const response=await fetch(url);if(!response.ok)throw Error('Audio '+response.status);
      const data=await response.arrayBuffer();decodeCount++;
      const buffer=await c.decodeAudioData(data);
      for(const [name,path] of Object.entries(FILES))if(path===url)buffers[name]=buffer;
    })).then(()=>true).catch(()=>{soundsReadyPromise=null;return false;});
    return soundsReadyPromise;
  }
  async function prepareForSpin(){
    if(!enabled())return true;
    const resume=resumeAudioContext(); // called synchronously in the user gesture
    const ready=preloadSounds();
    let timer;
    try{return await Promise.race([Promise.all([resume,ready]).then(v=>v.every(Boolean)&&ctx?.state==='running'),new Promise(r=>{timer=setTimeout(()=>r(false),4000);})]);}
    finally{clearTimeout(timer);}
  }
  function startBuffer(name,volume,valid){
    if(!enabled()||document.hidden||!valid()||ctx?.state!=='running'||!buffers[name])return false;
    try{
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffers[name];gain.gain.value=volume;
      source.connect(gain);gain.connect(ctx.destination);active.add(source);
      source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};
      source.start();played[name]=(played[name]||0)+1;return true;
    }catch{return false;}
  }
  function playBuffer(name,volume=.8,valid=()=>true){
    if(!enabled()||document.hidden||!valid())return Promise.resolve(false);
    if(ctx?.state==='running')return Promise.resolve(startBuffer(name,volume,valid));
    const deadline=performance.now()+700;
    return resumeAudioContext().then(ok=>ok&&startBuffer(name,volume,()=>valid()&&performance.now()<deadline));
  }
  function stopAll(){for(const source of active){try{source.stop();}catch{}}active.clear();}
  function onReturn(){if(!document.hidden&&enabled())resumeAudioContext();}
  document.addEventListener('visibilitychange',()=>document.hidden?stopAll():onReturn());
  window.addEventListener('pageshow',onReturn);window.addEventListener('focus',onReturn);window.addEventListener('pagehide',stopAll);
  return {ensureAudioContext,resumeAudioContext,preloadSounds,prepareForSpin,playBuffer,stopAll,
    isReady:()=>Object.keys(FILES).every(k=>buffers[k]),
    diag:()=>({ctxState:ctx?.state,ready:Object.keys(buffers),decodeCount,active:active.size,played:{...played}})};
}
