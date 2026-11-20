export const APP_VERSION='0.5.0';
export function workerVersion(worker,timeout=1500){
 if(!worker)return Promise.resolve(null);
 return new Promise(resolve=>{
  const channel=new MessageChannel();
  const done=value=>{clearTimeout(timer);channel.port1.close();resolve(value);};
  const timer=setTimeout(()=>done(null),timeout);
  channel.port1.onmessage=e=>done(e.data?.version||null);
  try{worker.postMessage('GET_VERSION',[channel.port2]);}catch{done(null);}
 });
}
export function isNewVersion(controlled,waitingVersion){return Boolean(controlled&&waitingVersion&&waitingVersion!==APP_VERSION);}
export function watchUpdates(reg,sw,{show,beforeUpdate,reload},getVersion=workerVersion){
 let generation=0,reloading=false;
 const refresh=async()=>{
  const turn=++generation,worker=reg.waiting;
  show(false);
  const version=await getVersion(worker);
  if(turn!==generation||reg.waiting!==worker)return;
  if(!isNewVersion(Boolean(sw.controller),version))return;
  show(true,()=>{if(reg.waiting!==worker){refresh();return;}beforeUpdate();show(false);worker.postMessage('SKIP_WAITING');});
 };
 let controlled=Boolean(sw.controller);
 sw.addEventListener('controllerchange',()=>{generation++;show(false);if(controlled&&!reloading){reloading=true;reload();}controlled=true;});
 reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',refresh));
 refresh();return refresh;
}
