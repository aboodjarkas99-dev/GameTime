const SUPABASE_URL='https://bqnptjfdsxzbxtkzigim.supabase.co';
const SUPABASE_KEY='sb_publishable_PW16QU5CtZBRe42mGPBrHg_g8McvcP1';
const BUILD='SECURE_V2_20261009o';
const shippingPortal=new URLSearchParams(location.search).get('workspace')==='shipping';
let shippingRefreshTimer=null;
let shippingRefreshBusy=false;
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage},
  realtime:{params:{eventsPerSecond:20}}
});

const $=id=>document.getElementById(id);
let view='all';
let isManager=false;
let authUser=null;
let profile=null;
let staffRows=[];
let inventoryStockRows=[];
let shippingShipments=[];
let shippingCurrentId=null;
let shippingCurrentStatus='DRAFT';
let shippingDraftLines=[];
let shippingDraftPlan=null;
let shippingSourceKind='manual';
let shippingSourceFilename='';
let shippingFilter='all';
let shippingAutoOpened=false;
let authStarting=false;
let recoveryMode=location.hash.includes('type=recovery')||new URLSearchParams(location.search).get('type')==='recovery';
const CACHE_KEY='gametime_secure_v2_cache';
const LEGACY_KEY='gametime_factory_orders_v2';
const DEVICE_KEY='gametime_device_id';
const NAME_KEY='gametime_device_name';
const LANG_KEY='gametime_language';
const INSTALL_HELP_PREFIX='gametime_install_help_seen_v1:';
let deferredInstallPrompt=null;
const STRINGS={
  en:{
    setYourName:'Set Your Name',manager:'Manager',assistantManager:'Assistant Manager',settings:'Settings',productionRole:'Production',batchMakerRole:'Batch Maker',
    allWork:'ALL WORK',productionFilling:'PRODUCTION / FILLING',batchMaker:'BATCH MAKER',
    previous:'← Previous',next:'Next →',searchPlaceholder:'Search ALL dates — Product or Batch #',allDates:'ALL DATES',searchResults:'Search Results',holdMatches:'Hold Line Matches',monthlyChart:'▥ Monthly Chart',monthlyChartTitle:'Monthly Production Chart',month:'Month',showChart:'Show Chart',chartLoading:'Loading monthly production…',chartNoData:'No production recorded for this month.',totalGallons:'Total Gallons',products:'Products',batches:'Batches',ofMonth:'of month',gallons:'gal',printSavePdf:'Print / Save PDF',holdLine:'▣ HOLD LINE',addWorkOrder:'+ Add Work Order',
    sendBoard:'Send work board to employees',sendProduction:'↗ Send to Production',sendBatchMaker:'↗ Send to Batch Maker',liveActivity:'● Live Activity',unfinishedQueue:'☰ Unfinished Queue',
    workOrders:'Work Orders',batchTasks:'Batch Tasks',productionTasks:'Production Tasks',completed:'Completed',tasks:'tasks',
    noBatchWork:'No Batch Maker work.',noProductionWork:'No Production work.',
    dragReorder:'☰ DRAG TO REORDER',tankGal:'TANK GAL',filling:'FILLING',batchWord:'BATCH',priority:'PRIORITY',batchNumber:'BATCH #',
    waitingBatch:'⏳ WAITING FOR BATCH MAKER — Production locked until WORK DONE',onHold:'ON HOLD',
    productionNote:'Production Note:',batchNote:'Batch Maker Note:',prepareBatch:'Prepare batch for production.',
    precheck:'PRE-CHECK',prodCheckHint:'Labels • Pallets • Containers / Cans',batchCheckHint:'All raw materials are available and ready',
    startWork:'▶ START WORK',workDone:'✓ WORK DONE',resumeWork:'RESUME WORK',putOnHold:'PUT ON HOLD',
    edit:'Edit',moveToHold:'Move to Hold Line',delete:'Delete',
    quarts:'QUARTS',oneGallon:'1 GALLON',fiveGallon:'5 GALLON',jerryCan:'JERRY CAN 1.25G',
    tapWhenFilled:'Tap when filled',boxes:'BOXES',actual:'ACTUAL',planned:'Planned amount',batchMadeOn:'Batch made on',
    notStarted:'○ NOT STARTED',inProgress:'● IN PROGRESS',completedStatus:'✓ COMPLETED',
    readOnly:'READ ONLY',waitingSchedule:'Waiting for schedule',holdEmpty:'Hold Line is empty.',addHoldItem:'+ Add Hold Line Item',schedule:'Schedule',noDateAssigned:'No date assigned yet',
    noActivity:'No activity yet.',nothingUnfinished:'Nothing unfinished.',by:'BY',from:'From',batchUnfinished:'Batch unfinished',productionUnfinished:'Production unfinished',scheduleSelected:'Schedule on selected date',
    fullDayPrint:'Full Day — Batch + Production',printBatch:'Batch Maker',printProduction:'Production / Filling',
    addHoldLineItem:'Add Hold Line Item',editHoldLineItem:'Edit Hold Line Item',editWorkOrder:'Edit Work Order',
    productName:'Product Name',batchMakerDate:'Batch Maker Date',productionDate:'Production Date',totalBatchGallons:'Total Batch Gallons',
    normal:'Normal',rush:'Rush',firstThingMorning:'First Thing Morning',autoFillRemaining:'Auto-fill Remaining Gallons Into',
    addJerry:'Add Jerry Can 1.25 Gallon',onlyShowPackage:'Only show this package on the work order when selected.',catalystOption:'Catalyst',catalystHelp:'Mark this Production order as containing Catalyst.',catalystBadge:'CATALYST',
    cancel:'Cancel',saveWorkOrder:'Save Work Order',saving:'Saving…',
    actualQuantity:'Actual Quantity',actualFilled:'Actual amount filled',saveActualQuantity:'Save Actual Quantity',
    whoUsing:'Who is using this device?',identityHelp:'Enter your name once. GameTime will remember it on this browser and automatically attach it to your changes.',
    yourName:'Your Name',exampleName:'Example: Abood',saveNameDevice:'Save Name on This Device',
    moveRemainderNext:'Move Remainder to Next Day',carryHelp:'Enter what Production actually filled today. GameTime will calculate the remaining quantities for the next work day.',
    moveRemainderTo:'Move remainder to',quartsFilled:'Quarts filled today',oneFilled:'1 Gallon filled today',fiveFilled:'5 Gallon filled today',jerryFilled:'Jerry Can 1.25G filled today',moveRemainder:'Move Remainder',
    total:'Total',used:'Used',exactTotal:'Exact total ✓',unassigned:'Unassigned',over:'Over',
    waitingBatchToast:'Waiting for Batch Maker to complete this batch',productionLocked:'Waiting for Batch Maker — Production is locked until WORK DONE',quantitiesLocked:'Waiting for Batch Maker — quantities are locked',
    completePrecheck:'Complete PRE-CHECK first',enterActualFirst:'Enter actual filled quantity for each planned package first',
    enterValidNumber:'Enter a valid number 0 or higher',actualSaved:'Actual quantity saved',
    weekendOff:'Saturday and Sunday are OFF — choose Monday through Friday',enterProduct:'Enter Product Name',enterBothDates:'Enter both Batch Maker Date and Production Date',
    productionBeforeBatch:'Production Date cannot be before Batch Maker Date',batchExists:'That Batch Number already exists — use a different number',
    saved:'Saved',deletedHistory:'Deleted — recoverable from audit history',movedHold:'Moved to Hold Line',scheduled:'Scheduled',rescheduled:'Rescheduled',
    confirmDelete:'Move this order to deleted history?',printError:'Print could not open on this device. Try the browser Share / Print option.',
    noWorkScheduled:'No work scheduled.',factorySheet:'GAMETIME FACTORY DAILY WORK SHEET',task:'TASK',taskPlural:'TASKS',
    syncLive:'LIVE',syncSyncing:'SYNCING',syncSaving:'SAVING',syncOffline:'OFFLINE',syncRetrying:'RETRYING',syncReconnecting:'RECONNECTING',syncImporting:'IMPORTING',
    languageButton:'Español'
  },
  es:{
    setYourName:'Pon tu nombre',manager:'Gerente',assistantManager:'Subgerente',settings:'Configuración',productionRole:'Producción',batchMakerRole:'Preparación',
    allWork:'TODO EL TRABAJO',productionFilling:'PRODUCCIÓN / LLENADO',batchMaker:'PREPARACIÓN DE LOTES',
    previous:'← Anterior',next:'Siguiente →',searchPlaceholder:'Buscar en TODAS las fechas — Producto o lote #',allDates:'TODAS LAS FECHAS',searchResults:'Resultados de búsqueda',holdMatches:'Coincidencias en Línea de Espera',monthlyChart:'▥ Gráfica mensual',monthlyChartTitle:'Gráfica mensual de producción',month:'Mes',showChart:'Mostrar gráfica',chartLoading:'Cargando producción mensual…',chartNoData:'No hay producción registrada para este mes.',totalGallons:'Galones totales',products:'Productos',batches:'Lotes',ofMonth:'del mes',gallons:'gal',printSavePdf:'Imprimir / Guardar PDF',holdLine:'▣ LÍNEA DE ESPERA',addWorkOrder:'+ Agregar orden',
    sendBoard:'Enviar tablero a empleados',sendProduction:'↗ Enviar a Producción',sendBatchMaker:'↗ Enviar a Preparación',liveActivity:'● Actividad en vivo',unfinishedQueue:'☰ Trabajo pendiente',
    workOrders:'Órdenes',batchTasks:'Tareas de lotes',productionTasks:'Tareas de producción',completed:'Completadas',tasks:'tareas',
    noBatchWork:'No hay trabajo de preparación.',noProductionWork:'No hay trabajo de producción.',
    dragReorder:'☰ ARRASTRA PARA ORDENAR',tankGal:'GAL. DEL TANQUE',filling:'LLENADO',batchWord:'LOTE',priority:'PRIORIDAD',batchNumber:'LOTE #',
    waitingBatch:'⏳ ESPERANDO PREPARACIÓN DEL LOTE — Producción bloqueada hasta TERMINAR TRABAJO',onHold:'EN ESPERA',
    productionNote:'Nota de Producción:',batchNote:'Nota de Preparación:',prepareBatch:'Preparar lote para producción.',
    precheck:'VERIFICACIÓN PREVIA',prodCheckHint:'Etiquetas • Tarimas • Envases / Latas',batchCheckHint:'Todas las materias primas están disponibles y listas',
    startWork:'▶ INICIAR TRABAJO',workDone:'✓ TRABAJO TERMINADO',resumeWork:'REANUDAR TRABAJO',putOnHold:'PONER EN ESPERA',
    edit:'Editar',moveToHold:'Mover a Línea de Espera',delete:'Eliminar',
    quarts:'QUARTS',oneGallon:'1 GALÓN',fiveGallon:'5 GALONES',jerryCan:'JERRY CAN 1.25G',
    tapWhenFilled:'Toca al llenar',boxes:'CAJAS',actual:'REAL',planned:'Cantidad planificada',batchMadeOn:'Lote hecho el',
    notStarted:'○ NO INICIADO',inProgress:'● EN PROGRESO',completedStatus:'✓ COMPLETADO',
    readOnly:'SOLO LECTURA',waitingSchedule:'Esperando fecha',holdEmpty:'La Línea de Espera está vacía.',addHoldItem:'+ Agregar a Línea de Espera',schedule:'Programar',noDateAssigned:'Sin fecha asignada',
    noActivity:'Todavía no hay actividad.',nothingUnfinished:'No hay trabajo pendiente.',by:'POR',from:'Desde',batchUnfinished:'Preparación pendiente',productionUnfinished:'Producción pendiente',scheduleSelected:'Programar en la fecha seleccionada',
    fullDayPrint:'Día completo — Preparación + Producción',printBatch:'Preparación de Lotes',printProduction:'Producción / Llenado',
    addHoldLineItem:'Agregar a Línea de Espera',editHoldLineItem:'Editar Línea de Espera',editWorkOrder:'Editar orden',
    productName:'Nombre del producto',batchMakerDate:'Fecha de Preparación',productionDate:'Fecha de Producción',totalBatchGallons:'Galones totales del lote',
    normal:'Normal',rush:'Urgente',firstThingMorning:'Primero en la mañana',autoFillRemaining:'Completar galones restantes en',
    addJerry:'Agregar Jerry Can de 1.25 galones',onlyShowPackage:'Mostrar este envase solo cuando esté seleccionado.',catalystOption:'Catalizador',catalystHelp:'Marcar esta orden de Producción como que contiene catalizador.',catalystBadge:'CATALIZADOR',
    cancel:'Cancelar',saveWorkOrder:'Guardar orden',saving:'Guardando…',
    actualQuantity:'Cantidad real',actualFilled:'Cantidad realmente llenada',saveActualQuantity:'Guardar cantidad real',
    whoUsing:'¿Quién está usando este dispositivo?',identityHelp:'Escribe tu nombre una vez. GameTime lo recordará en este navegador y lo agregará automáticamente a tus cambios.',
    yourName:'Tu nombre',exampleName:'Ejemplo: Abood',saveNameDevice:'Guardar nombre en este dispositivo',
    moveRemainderNext:'Mover restante al próximo día',carryHelp:'Escribe lo que Producción llenó hoy. GameTime calculará lo restante para el próximo día laboral.',
    moveRemainderTo:'Mover restante a',quartsFilled:'Quarts llenados hoy',oneFilled:'1 galón llenado hoy',fiveFilled:'5 galones llenados hoy',jerryFilled:'Jerry Can 1.25G llenados hoy',moveRemainder:'Mover restante',
    total:'Total',used:'Usado',exactTotal:'Total exacto ✓',unassigned:'Sin asignar',over:'Exceso',
    waitingBatchToast:'Esperando que Preparación termine este lote',productionLocked:'Esperando Preparación — Producción está bloqueada hasta TERMINAR TRABAJO',quantitiesLocked:'Esperando Preparación — las cantidades están bloqueadas',
    completePrecheck:'Completa la VERIFICACIÓN PREVIA primero',enterActualFirst:'Ingresa la cantidad real de cada envase planificado primero',
    enterValidNumber:'Ingresa un número válido de 0 o mayor',actualSaved:'Cantidad real guardada',
    weekendOff:'Sábado y domingo están cerrados — elige de lunes a viernes',enterProduct:'Ingresa el nombre del producto',enterBothDates:'Ingresa la fecha de Preparación y la fecha de Producción',
    productionBeforeBatch:'La fecha de Producción no puede ser antes de la fecha de Preparación',batchExists:'Ese número de lote ya existe — usa otro número',
    saved:'Guardado',deletedHistory:'Eliminado — recuperable desde el historial',movedHold:'Movido a Línea de Espera',scheduled:'Programado',rescheduled:'Reprogramado',
    confirmDelete:'¿Mover esta orden al historial de eliminados?',printError:'No se pudo abrir la impresión. Usa la opción Compartir / Imprimir del navegador.',
    noWorkScheduled:'No hay trabajo programado.',factorySheet:'HOJA DIARIA DE TRABAJO GAMETIME',task:'TAREA',taskPlural:'TAREAS',
    syncLive:'EN VIVO',syncSyncing:'SINCRONIZANDO',syncSaving:'GUARDANDO',syncOffline:'SIN CONEXIÓN',syncRetrying:'REINTENTANDO',syncReconnecting:'RECONECTANDO',syncImporting:'IMPORTANDO',
    languageButton:'English'
  }
};
let lang=localStorage.getItem(LANG_KEY)==='es'?'es':'en';
function t(key){return STRINGS[lang]?.[key]??STRINGS.en[key]??key}
function locale(){return lang==='es'?'es-US':'en-US'}
function directLabel(inputId,key){
  const input=$(inputId),label=input&&input.closest?input.closest('label'):null;if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(node)node.textContent=t(key)
}
function staticText(selector,key){const el=document.querySelector(selector);if(el)el.textContent=t(key)}
function applyLanguage(){
  document.documentElement.lang=lang;
  const lt=$('langToggle');if(lt)lt.textContent=t('languageButton');
  refreshUserLabel();
  const map={prevBtn:'previous',nextBtn:'next',printBtn:'printSavePdf',holdLineBtn:'holdLine',settingsBtn:'settings',addBtn:'addWorkOrder',shareProd:'sendProduction',shareBatch:'sendBatchMaker',saveOrderBtn:'saveWorkOrder',saveQtyBtn:'saveActualQuantity',saveCarryBtn:'moveRemainder',saveDeviceName:'saveNameDevice'};
  for(const [id,key] of Object.entries(map)){const el=$(id);if(el){const label=el.querySelector?.('b');if(label)label.textContent=t(key);else el.textContent=t(key)}}
  const search=$('search');if(search)search.placeholder=t('searchPlaceholder');
  staticText('#managerTools .sendbox > b','sendBoard');
  for(const [sel,key] of [['[data-drawer="activity"]','liveActivity'],['[data-drawer="queue"]','unfinishedQueue'],['[data-drawer="holdline"]','holdLine']]){
    const el=document.querySelector(sel);if(el){const label=el.querySelector?.('b');if(label)label.textContent=t(key);else el.textContent=t(key)}
  }
  document.querySelectorAll('[data-print-option]').forEach(b=>{
    const key=b.dataset.printOption==='all'?'fullDayPrint':b.dataset.printOption==='batch'?'printBatch':'printProduction';
    b.textContent=t(key);
  });
  const holdOpen=document.querySelector('[data-hold-option="open"]');if(holdOpen)holdOpen.textContent=lang==='es'?'Ver Línea de Espera':'View Hold Line';
  const holdAdd=document.querySelector('[data-hold-option="add"]');if(holdAdd)holdAdd.textContent=lang==='es'?'+ Agregar a Línea de Espera':'+ Add Hold Line Item';
  document.querySelectorAll('[data-settings-option]').forEach(b=>{
    const labels={
      account:lang==='es'?'Mi Cuenta':'My Account',
      security:lang==='es'?'Contraseña y Seguridad':'Password & Security',
      about:lang==='es'?'Acerca de la App':'About The App',
      install:lang==='es'?'Instalar en Este Dispositivo':'Install on This Device'
    };b.textContent=labels[b.dataset.settingsOption]||b.textContent;
  });
  staticText('.stats .stat:nth-child(1) span','workOrders');staticText('.stats .stat:nth-child(2) span','batchTasks');staticText('.stats .stat:nth-child(3) span','productionTasks');staticText('.stats .stat:nth-child(4) span','completed');
  staticText('#batchPanel .panelhead h2','batchMaker');staticText('#prodPanel .panelhead h2','productionFilling');
  directLabel('product','productName');directLabel('workDate','batchMakerDate');directLabel('prodWorkDate','productionDate');directLabel('batchNumber','batchNumber');directLabel('tank','totalBatchGallons');directLabel('priority','priority');
  directLabel('quart','quarts');directLabel('gallon','oneGallon');directLabel('five','fiveGallon');directLabel('jerry','jerryCan');directLabel('batchNote','batchNote');directLabel('prodNote','productionNote');
  staticText('.auto > b','autoFillRemaining');
  const ab={five:'fiveGallon',gallon:'oneGallon',quart:'quarts',jerry:'jerryCan'};document.querySelectorAll('[data-auto]').forEach(b=>{if(ab[b.dataset.auto])b.textContent=t(ab[b.dataset.auto])});
  staticText('.optional-package span b','addJerry');staticText('.optional-package span small','onlyShowPackage');
  if($('catalystOptionTitle'))$('catalystOptionTitle').textContent=t('catalystOption');
  if($('catalystOptionHelp'))$('catalystOptionHelp').textContent=t('catalystHelp');
  if($('monthlyChartBtn')){const el=$('monthlyChartBtn'),label=el.querySelector?.('b');if(label)label.textContent=t('monthlyChart');else el.textContent=t('monthlyChart')}
  if($('analyticsTitle'))$('analyticsTitle').textContent=t('monthlyChartTitle');
  directLabel('analyticsMonth','month');
  if($('analyticsLoadBtn'))$('analyticsLoadBtn').textContent=t('showChart');
  const opts=$('priority')?.options;if(opts&&opts.length>=3){opts[0].textContent=t('normal');opts[1].textContent=t('rush');opts[2].textContent=t('firstThingMorning')}
  if($('editorTitle')){const eo=editingId?orders.find(x=>x.id===editingId):null;$('editorTitle').textContent=editorMode==='hold'?(eo?t('editHoldLineItem'):t('addHoldLineItem')):(eo?t('editWorkOrder'):t('addWorkOrder'))}
  document.querySelectorAll('.dialogactions button[data-close]').forEach(b=>{if(b.textContent.trim()!=='✕')b.textContent=t('cancel')});
  directLabel('qtyInput','actualFilled');
  staticText('#identityModal h2','whoUsing');staticText('#identityModal p','identityHelp');directLabel('deviceNameInput','yourName');if($('deviceNameInput'))$('deviceNameInput').placeholder=t('exampleName');
  staticText('#carryModal .dialoghead h2','moveRemainderNext');staticText('#carryModal .carryhelp','carryHelp');directLabel('carryDate','moveRemainderTo');directLabel('carryQuart','quartsFilled');directLabel('carryGallon','oneFilled');directLabel('carryFive','fiveFilled');directLabel('carryJerry','jerryFilled');
}
function setLanguage(next){
  lang=next==='es'?'es':'en';localStorage.setItem(LANG_KEY,lang);applyLanguage();render();
  if($('monthModal')?.classList.contains('show'))renderMonth();
  if($('drawerBackdrop')?.classList.contains('show'))openDrawer($('drawerBackdrop').dataset.type);
  if($('analyticsModal')?.classList.contains('show'))loadMonthlyAnalytics();
}
let deviceId=localStorage.getItem(DEVICE_KEY);
if(!deviceId){deviceId=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());localStorage.setItem(DEVICE_KEY,deviceId)}
let deviceName='';
function roleLabel(){
  if(profile?.job_title)return profile.job_title;
  const r=profile?.role;
  return r==='manager'?t('manager'):r==='prod'?t('productionRole'):r==='batch'?t('batchMakerRole'):r==='chemist'?'Chemist':r==='shipping'?'Shipping':r==='viewer'?t('readOnly'):'';
}
function actor(){return profile?.display_name||'Authenticated User'}
function refreshUserLabel(){
  const el=$('currentUser');if(!el)return;
  el.textContent=profile?'👤 '+profile.display_name+' • '+roleLabel():'👤 Sign In';
}
let orders=[],logs=[],selected=new Date(),monthCursor=new Date(),editorMode='order',editingId=null,editingVersion=null,autoTarget=null,qtyState=null,carryState=null,saveBusy=false,dragState=null,channel=null,reconcileTimer=null,logPollTick=0;

function authMessage(msg,bad=false){
  const el=$('authMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
function staffMessage(msg,bad=false){
  const el=$('staffMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
function switchAuthPane(which){
  $('managerLoginPane').style.display=which==='manager'?'':'none';
  $('employeeLoginPane').style.display=which==='employee'?'':'none';
  if($('forgotPasswordPane'))$('forgotPasswordPane').style.display=which==='forgot'?'':'none';
  if($('recoveryPasswordPane'))$('recoveryPasswordPane').style.display=which==='recovery'?'':'none';
  $('managerSetupPane').style.display=which==='setup'?'':'none';
  $('authManagerTab').classList.toggle('active',which==='manager');
  $('authEmployeeTab').classList.toggle('active',which==='employee');
  authMessage('');
}
function showAuthScreen(){if($('authScreen'))$('authScreen').classList.remove('hidden')}
function hideAuthScreen(){if($('authScreen'))$('authScreen').classList.add('hidden')}
function stopSecureSession(){
  if(reconcileTimer){clearInterval(reconcileTimer);reconcileTimer=null}
  if(channel){db.removeChannel(channel);channel=null}
  orders=[];logs=[];profile=null;authUser=null;isManager=false;view='all';
  localStorage.removeItem(CACHE_KEY);
  refreshUserLabel();
}
function applyProfile(p){
  profile=p;
  isManager=p?.role==='manager'||p?.role==='chemist';
  view=p?.role==='prod'?'prod':p?.role==='batch'?'batch':'all';
  document.body.classList.toggle('shipping-only',shippingPortal||p?.role==='shipping');
  if(shippingPortal||p?.role==='shipping'){document.title='GameTime Shipping';$('viewLabel').textContent='SHIPPING'}
  refreshUserLabel();
}
function canManageStaff(){return profile?.role==='manager'}
function canViewInventory(){return ['manager','chemist','shipping'].includes(profile?.role)}
function canUseShipping(){return ['manager','chemist','shipping'].includes(profile?.role)}
async function fetchMyProfile(userId){
  const {data,error}=await db.from('profiles').select('id,display_name,role,employee_code,job_title,active').eq('id',userId).maybeSingle();
  if(error)throw error;
  if(!data||!data.active)throw new Error('This account does not have active GameTime access.');
  return data;
}
function isStandaloneApp(){
  return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
}
function installHelpKey(){return profile?.id?INSTALL_HELP_PREFIX+profile.id:null}
function detectInstallDevice(){
  const ua=navigator.userAgent||'';
  if(/iPad|iPhone|iPod/.test(ua))return 'ios';
  if(/Android/i.test(ua))return 'android';
  return 'desktop';
}
function updateInstallHelpUI(){
  const type=detectInstallDevice();
  document.querySelectorAll('[data-install-device]').forEach(el=>el.classList.toggle('recommended',el.dataset.installDevice===type));
  if($('installAppBtn'))$('installAppBtn').style.display=deferredInstallPrompt?'':'none';
}
function openInstallHelp(force=false){
  if(isStandaloneApp()&&!force)return;
  updateInstallHelpUI();
  showModal('installHelpModal');
}
function maybeShowEmployeeInstallHelp(){
  if(!profile||profile.role==='manager'||isStandaloneApp())return;
  const key=installHelpKey();if(!key||localStorage.getItem(key)==='1')return;
  setTimeout(()=>openInstallHelp(),350);
}
function finishInstallHelp(){
  const key=installHelpKey();if(key)localStorage.setItem(key,'1');
  hideModal('installHelpModal');
}
async function promptInstallApp(){
  if(!deferredInstallPrompt){updateInstallHelpUI();return}
  deferredInstallPrompt.prompt();
  try{await deferredInstallPrompt.userChoice}catch{}
  deferredInstallPrompt=null;
  updateInstallHelpUI();
  const key=installHelpKey();if(key)localStorage.setItem(key,'1');
}
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstallPrompt=e;updateInstallHelpUI();
});
window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;const key=installHelpKey();if(key)localStorage.setItem(key,'1');hideModal('installHelpModal');
});

async function activateSession(user){
  authUser=user;
  const p=await fetchMyProfile(user.id);
  applyProfile(p);
  hideAuthScreen();
  await initialLoad();
  maybeShowEmployeeInstallHelp();
}
async function managerLogin(){
  const email=$('loginEmail').value.trim(),password=$('loginPassword').value;
  if(!email||!password){authMessage('Enter email and password.',true);return}
  authMessage('Signing in…');
  const {data,error}=await db.auth.signInWithPassword({email,password});
  if(error){authMessage(error.message,true);return}
  try{await activateSession(data.user)}catch(e){await db.auth.signOut();authMessage(e.message||String(e),true)}
}
async function employeeLogin(){
  const name=$('employeeCodeLogin').value.trim().replace(/\s+/g,' '),pin=$('employeePinLogin').value.trim();
  if(!name||!/^\d{4,12}$/.test(pin)){authMessage('Enter your name and 4–12 digit PIN.',true);return}
  authMessage('Signing in…');
  const {data,error}=await db.functions.invoke('employee-login',{body:{name,pin}});
  if(error||data?.error||!data?.session?.access_token||!data?.session?.refresh_token){
    authMessage('Invalid employee name or PIN.',true);return
  }
  const {data:sessionData,error:setError}=await db.auth.setSession({
    access_token:data.session.access_token,
    refresh_token:data.session.refresh_token
  });
  if(setError||!sessionData?.user){authMessage('Could not start employee session.',true);return}
  try{await activateSession(sessionData.user)}catch(e){await db.auth.signOut();authMessage(e.message||String(e),true)}
}
async function createFirstManager(){
  const display_name=$('setupName').value.trim(),job_title=$('setupJobTitle')?.value||'Assistant Manager',email=$('setupEmail').value.trim(),password=$('setupPassword').value,setup_code=$('setupCode').value.trim();
  if(!display_name||!email||password.length<8||!setup_code){authMessage('Enter name, email, password (8+ characters), and Setup Code.',true);return}
  authMessage('Creating secure management account…');
  const {data,error}=await db.functions.invoke('bootstrap-manager',{body:{display_name,job_title,email,password,setup_code}});
  if(error||data?.error){authMessage(data?.error||error?.message||'Manager setup failed.',true);return}
  $('loginEmail').value=email;$('loginPassword').value=password;
  switchAuthPane('manager');
  authMessage('Management account created. Signing in…');
  await managerLogin();
}
async function requestPasswordReset(){
  const email=$('forgotEmail')?.value.trim().toLowerCase();
  if(!email){authMessage('Enter your management account email.',true);return}
  authMessage('Sending secure reset link…');
  const redirectTo=location.origin+location.pathname;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){authMessage(error.message,true);return}
  authMessage('Reset link sent. Check your email and open the GameTime recovery link.');
}
async function saveRecoveryPassword(){
  const p1=$('recoveryNewPassword')?.value||'',p2=$('recoveryConfirmPassword')?.value||'';
  if(p1.length<8){authMessage('New password must be at least 8 characters.',true);return}
  if(p1!==p2){authMessage('Passwords do not match.',true);return}
  authMessage('Saving new password…');
  const {error}=await db.auth.updateUser({password:p1});
  if(error){authMessage(error.message,true);return}
  recoveryMode=false;
  history.replaceState(null,'',location.pathname);
  await db.auth.signOut();
  stopSecureSession();
  showAuthScreen();switchAuthPane('manager');
  $('loginPassword').value='';
  authMessage('Password changed. Sign in with your new password.');
}
function passwordMessage(msg,bad=false){
  const el=$('passwordMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
function switchSettingsTab(tab){
  document.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('active',b.dataset.settingsTab===tab));
  document.querySelectorAll('[data-settings-pane]').forEach(p=>p.classList.toggle('active',p.dataset.settingsPane===tab));
}
function fillAccountSettings(){
  if($('settingsAccountName'))$('settingsAccountName').textContent=profile?.display_name||'—';
  if($('settingsAccountTitle'))$('settingsAccountTitle').textContent=profile?.job_title||roleLabel()||'—';
  if($('settingsAccountEmail'))$('settingsAccountEmail').textContent=authUser?.email||profile?.employee_code||'—';
  if($('settingsAccountRole'))$('settingsAccountRole').textContent=profile?.role==='manager'?'Management':profile?.role==='batch'?'Batch Maker':profile?.role==='prod'?'Production':profile?.role==='chemist'?'Chemist':profile?.role==='shipping'?'Shipping':profile?.role==='viewer'?'View Only':'—';
  if($('aboutBuild'))$('aboutBuild').textContent='Secure V2 • Build '+BUILD;
}
function openSettings(tab='account'){
  if(!authUser||!profile)return;
  fillAccountSettings();passwordMessage('');
  if($('currentPassword'))$('currentPassword').value='';
  if($('newPassword'))$('newPassword').value='';
  if($('confirmPassword'))$('confirmPassword').value='';
  switchSettingsTab(tab);showModal('settingsModal');
}
async function changeMyPassword(){
  if(!authUser?.email){passwordMessage('This account does not have an email login.',true);return}
  const current=$('currentPassword')?.value||'',next=$('newPassword')?.value||'',confirm=$('confirmPassword')?.value||'';
  const management=profile?.role==='manager';
  if(!current){passwordMessage(management?'Enter your current password.':'Enter your current PIN.',true);return}
  if(management){
    if(next.length<8){passwordMessage('New password must be at least 8 characters.',true);return}
  }else if(!/^\d{4,12}$/.test(next)){
    passwordMessage('New PIN must be 4–12 digits.',true);return
  }
  if(next!==confirm){passwordMessage(management?'New passwords do not match.':'New PINs do not match.',true);return}

  if(management){
    passwordMessage('Checking current password…');
    const {error:verifyError}=await db.auth.signInWithPassword({email:authUser.email,password:current});
    if(verifyError){passwordMessage('Current password is incorrect.',true);return}
    passwordMessage('Changing password…');
    const {error}=await db.auth.updateUser({password:next});
    if(error){passwordMessage(error.message,true);return}
  }else{
    passwordMessage('Changing PIN…');
    const {error}=await db.rpc('change_employee_pin',{p_current_pin:current,p_new_pin:next});
    if(error){passwordMessage(error.message?.includes('Current PIN')?'Current PIN is incorrect.':error.message,true);return}
  }

  $('currentPassword').value='';$('newPassword').value='';$('confirmPassword').value='';
  passwordMessage(management?'Password changed successfully.':'PIN changed successfully.');
}
async function signOutSecure(){
  await db.auth.signOut();
  stopSecureSession();
  showAuthScreen();
  switchAuthPane('manager');
  authMessage('Signed out.');
}
async function loadStaff(){
  if(!canManageStaff())return;
  const {data,error}=await db.from('profiles').select('id,display_name,role,employee_code,job_title,active,created_at').order('display_name');
  if(error){staffMessage(error.message,true);return}
  staffRows=data||[];
  $('staffList').innerHTML=staffRows.map(p=>{
    const employee=p.role!=='manager';
    return '<div class="staffrow"><div class="staffrowinfo"><b>'+esc(p.display_name)+'</b><small>'+esc(p.employee_code||'Management')+' • '+esc(p.job_title||p.role)+(p.active?'':' • INACTIVE')+'</small></div>'+
      (employee?'<div class="staffactions"><button type="button" data-staff-edit="'+p.id+'">Edit</button><button type="button" class="danger" data-staff-delete="'+p.id+'">Delete</button></div>':'')+
      '</div>';
  }).join('')||'<div class="analytics-empty">No staff accounts yet.</div>';
  bindStaffActions();
}
async function openStaff(){
  if(!canManageStaff())return;
  staffMessage('');managementMessage('');
  showModal('staffModal');
  await loadStaff();
}
async function createStaff(){
  if(!canManageStaff())return;
  const display_name=$('staffName').value.trim(),employee_code=$('staffCode').value.trim().toLowerCase(),role=$('staffRole').value,pin=$('staffPin').value.trim();
  if(!display_name||!employee_code||!/^[a-z0-9._-]{1,30}$/.test(employee_code)||!/^\d{4,12}$/.test(pin)){staffMessage('Enter a name, any simple employee code (1, 2, 3 are allowed), and a 4–12 digit PIN.',true);return}
  $('createStaffBtn').disabled=true;staffMessage('Creating employee…');
  try{
    const {data,error}=await db.functions.invoke('create-employee',{body:{display_name,employee_code,role,pin}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Could not create employee');
    $('staffName').value='';$('staffCode').value='';$('staffPin').value='';
    staffMessage('Employee created.');
    await loadStaff();
  }catch(e){staffMessage(e.message||String(e),true)}
  finally{$('createStaffBtn').disabled=false}
}
function managementMessage(msg,bad=false){
  const el=$('managementMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
async function createManagementAccount(){
  if(!canManageStaff())return;
  const display_name=$('managementName')?.value.trim()||'';
  const job_title=$('managementTitle')?.value||'Manager';
  const email=$('managementEmail')?.value.trim().toLowerCase()||'';
  const password=$('managementPassword')?.value||'';
  if(!display_name||!email||password.length<8){managementMessage('Enter name, email, and a temporary password of at least 8 characters.',true);return}
  $('createManagementBtn').disabled=true;managementMessage('Creating management account…');
  try{
    const {data,error}=await db.functions.invoke('create-management-account',{body:{display_name,job_title,email,password}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Could not create management account');
    $('managementName').value='';$('managementEmail').value='';$('managementPassword').value='';
    managementMessage('Management account created. They can sign in from the Manager tab with this email and password.');
    await loadStaff();
  }catch(e){managementMessage(e.message||String(e),true)}
  finally{$('createManagementBtn').disabled=false}
}
function editStaffMessage(msg,bad=false){
  const el=$('editStaffMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
function openStaffEditor(id){
  if(!canManageStaff())return;
  const p=staffRows.find(x=>x.id===id);
  if(!p||p.role==='manager')return;
  $('editStaffId').value=p.id;
  $('editStaffName').value=p.display_name||'';
  $('editStaffCode').value=p.employee_code||'';
  $('editStaffRole').value=p.role||'viewer';
  $('editStaffPin').value='';
  editStaffMessage('');
  showModal('editStaffModal');
}
async function saveStaffEdit(){
  if(!canManageStaff())return;
  const id=$('editStaffId').value;
  const display_name=$('editStaffName').value.trim();
  const employee_code=$('editStaffCode').value.trim().toLowerCase();
  const role=$('editStaffRole').value;
  const pin=$('editStaffPin').value.trim();
  if(!display_name||!/^[a-z0-9._-]{1,30}$/.test(employee_code)){
    editStaffMessage('Enter a valid name and Employee Code.',true);return
  }
  if(pin&&!/^\d{4,12}$/.test(pin)){editStaffMessage('New PIN must be 4–12 digits, or leave it blank.',true);return}
  $('saveStaffEditBtn').disabled=true;editStaffMessage('Saving employee…');
  try{
    const {data,error}=await db.functions.invoke('update-employee',{body:{id,display_name,employee_code,role,pin}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Could not update employee');
    editStaffMessage('Employee updated.');
    await loadStaff();
    setTimeout(()=>hideModal('editStaffModal'),250);
  }catch(e){editStaffMessage(e.message||String(e),true)}
  finally{$('saveStaffEditBtn').disabled=false}
}
async function deleteStaffEmployee(id){
  if(!canManageStaff())return;
  const p=staffRows.find(x=>x.id===id);
  if(!p||p.role==='manager')return;
  if(!confirm('Delete '+(p.display_name||'this employee')+' from GameTime? This removes their login access.'))return;
  staffMessage('Deleting employee…');
  try{
    const {data,error}=await db.functions.invoke('delete-employee',{body:{id}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Could not delete employee');
    staffMessage('Employee deleted.');
    await loadStaff();
  }catch(e){staffMessage(e.message||String(e),true)}
}
function bindStaffActions(){
  document.querySelectorAll('[data-staff-edit]').forEach(b=>b.onclick=()=>openStaffEditor(b.dataset.staffEdit));
  document.querySelectorAll('[data-staff-delete]').forEach(b=>b.onclick=()=>deleteStaffEmployee(b.dataset.staffDelete));
}
async function secureStart(){
  if(authStarting)return;authStarting=true;
  applyLanguage();tick();
  const {data:{session}}=await db.auth.getSession();
  if(recoveryMode&&session){authUser=session.user;showAuthScreen();switchAuthPane('recovery');authStarting=false;return}
  if(!session){showAuthScreen();switchAuthPane('manager');authStarting=false;return}
  try{await activateSession(session.user)}
  catch(e){await db.auth.signOut();stopSecureSession();showAuthScreen();switchAuthPane('manager');authMessage(e.message||String(e),true)}
  finally{authStarting=false}
}
selected.setHours(12,0,0,0);

function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function isWeekendDateStr(s){if(!s)return false;const d=new Date(s+'T12:00:00'),n=d.getDay();return n===0||n===6}
function shiftWorkdayDate(d,step){const x=new Date(d);do{x.setDate(x.getDate()+step)}while(x.getDay()===0||x.getDay()===6);return x}
function nextBusinessDateStr(s){let d=new Date(s+'T12:00:00');do{d.setDate(d.getDate()+1)}while(d.getDay()===0||d.getDay()===6);return iso(d)}
if(selected.getDay()===0||selected.getDay()===6){while(selected.getDay()===0||selected.getDay()===6)selected.setDate(selected.getDate()+1)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function num(v){let m=String(v??'').match(/-?\d+(?:\.\d+)?/);return m?Math.max(0,Number(m[0])||0):0}
function boxes(v){return Math.ceil(num(v)/4)}
function prodBatch(v){let m=String(v||'').trim().match(/^(.*?)(\d+)\s*$/);return m?m[1]+String(Number(m[2])+1).padStart(m[2].length,'0'):String(v||'')}
function pretty(d=selected){return d.toLocaleDateString(locale(),{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
function usDate(s){if(!s)return'';return new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'})}
function nextId(){return Date.now()*1000+Math.floor(Math.random()*1000)}
function titleCase(s){return String(s||'').replace(/(^|\s)([a-z])/g,(m,a,b)=>a+b.toUpperCase())}
function statusText(s){return s==='done'?t('completedStatus'):s==='progress'?t('inProgress'):t('notStarted')}
function statusClass(s){return s==='done'?'done-status':s==='progress'?'progress':'ready'}
function deptText(d){return d==='prod'?t('productionRole'):d==='batch'?t('batchMakerRole'):d==='all'?t('allWork'):String(d||'')}
function eventTypeText(v){const s=String(v||'');return s==='done'?t('completed'):s==='progress'?t('inProgress').replace(/^●\s*/,''):s==='package'?t('actualQuantity'):s.toUpperCase()}
function setSync(state,label){const el=$('syncStatus');el.className='sync '+state;const k={LIVE:'syncLive',SYNCING:'syncSyncing',SAVING:'syncSaving',OFFLINE:'syncOffline',RETRYING:'syncRetrying',RECONNECTING:'syncReconnecting',IMPORTING:'syncImporting'}[label||state.toUpperCase()];el.textContent=k?t(k):(label||state.toUpperCase())}
let toastTimer=null;function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
function cache(){localStorage.setItem(CACHE_KEY,JSON.stringify(orders))}
function normalizeLegacy(raw){
  const out=[],seen=new Set();
  for(const o of Array.isArray(raw)?raw:[]){
    const sig=[o.date||'',o.product||'',o.batch||'',o.tank||0,o.quart||'0',o.gallon||'0',o.five||'0',!!o.holdLine].join('|').toLowerCase();
    if(seen.has(sig))continue;seen.add(sig);
    out.push({
      id:Number(o.id)||nextId(),date:o.holdLine?'':(o.date||''),product:o.product||'Untitled',batch:o.batch||'',tank:Number(o.tank)||0,
      quart:String(o.quart??'0'),gallon:String(o.gallon??'0'),five:String(o.five??'0'),batchNote:o.batchNote||'',prodNote:o.prodNote||'',
      priority:o.priority||'Normal',autoTarget:o.autoTarget||null,batchChecked:!!o.batchChecked,prodChecked:!!o.prodChecked,
      batchStatus:o.batchStatus||'ready',prodStatus:o.prodStatus||'ready',held:!!o.held,
      actualQuart:o.actual?.quart??null,actualGallon:o.actual?.gallon??null,actualFive:o.actual?.five??null,actualJerry:null,jerryEnabled:false,jerry:'0',catalyst:!!o.catalyst,
      batchOrder:Number(o.batchOrder)||999,prodOrder:Number(o.prodOrder)||999,holdLine:!!o.holdLine,productionOnly:false,carryoverFrom:null,version:1
    });
  }
  return out;
}
function fromRow(r){return{
  id:Number(r.id),date:r.work_date||'',batchDate:r.batch_work_date||r.work_date||'',prodDate:r.prod_work_date||r.work_date||'',batchMadeDate:r.batch_made_date||null,product:r.product||'',batch:r.batch||'',tank:Number(r.tank)||0,
  quart:String(r.quart??'0'),gallon:String(r.gallon??'0'),five:String(r.five??'0'),jerryEnabled:!!r.jerry_enabled,jerry:String(r.jerry??'0'),catalyst:!!r.catalyst,batchNote:r.batch_note||'',prodNote:r.prod_note||'',
  priority:r.priority||'Normal',autoTarget:r.auto_target||null,batchChecked:!!r.batch_checked,prodChecked:!!r.prod_checked,
  batchStatus:r.batch_status||'ready',prodStatus:r.prod_status||'ready',held:!!r.held,
  actualQuart:r.actual_quart==null?null:Number(r.actual_quart),actualGallon:r.actual_gallon==null?null:Number(r.actual_gallon),actualFive:r.actual_five==null?null:Number(r.actual_five),actualJerry:r.actual_jerry==null?null:Number(r.actual_jerry),
  batchOrder:Number(r.batch_order)||999,prodOrder:Number(r.prod_order)||999,holdLine:!!r.hold_line,productionOnly:!!r.production_only,carryoverFrom:r.carryover_from==null?null:Number(r.carryover_from),version:Number(r.version)||1,
  updatedAt:r.updated_at||null,deletedAt:r.deleted_at||null
}}
function toRow(o){return{
  id:Number(o.id),work_date:o.holdLine?null:(o.date||o.prodDate||o.batchDate||null),batch_work_date:o.holdLine?null:(o.batchDate||o.date||null),prod_work_date:o.holdLine?null:(o.prodDate||o.date||null),batch_made_date:o.batchMadeDate||null,product:o.product||'',batch:o.batch||'',tank:Number(o.tank)||0,
  quart:String(o.quart??'0'),gallon:String(o.gallon??'0'),five:String(o.five??'0'),jerry_enabled:!!o.jerryEnabled,jerry:String(o.jerry??'0'),catalyst:!!o.catalyst,batch_note:o.batchNote||'',prod_note:o.prodNote||'',
  priority:o.priority||'Normal',auto_target:o.autoTarget||null,batch_checked:!!o.batchChecked,prod_checked:!!o.prodChecked,
  batch_status:o.batchStatus||'ready',prod_status:o.prodStatus||'ready',held:!!o.held,
  actual_quart:o.actualQuart==null?null:Number(o.actualQuart),actual_gallon:o.actualGallon==null?null:Number(o.actualGallon),actual_five:o.actualFive==null?null:Number(o.actualFive),actual_jerry:o.actualJerry==null?null:Number(o.actualJerry),
  actual:{quart:o.actualQuart??null,gallon:o.actualGallon??null,five:o.actualFive??null,jerry:o.actualJerry??null},
  batch_order:Number(o.batchOrder)||999,prod_order:Number(o.prodOrder)||999,hold_line:!!o.holdLine,production_only:!!o.productionOnly,carryover_from:o.carryoverFrom??null,
  updated_by:actor(),updated_from:isManager?'manager':view
}}
function mergeOrder(o){const i=orders.findIndex(x=>x.id===o.id);if(o.deletedAt){if(i>=0)orders.splice(i,1)}else if(i>=0)orders[i]=o;else orders.push(o);cache()}
function orderSig(list){return JSON.stringify(list.map(o=>[o.id,o.version,o.batchStatus,o.prodStatus,o.batchChecked,o.prodChecked,o.held,o.actualQuart,o.actualGallon,o.actualFive,o.actualJerry,o.jerryEnabled,o.jerry,o.catalyst,o.batchOrder,o.prodOrder,o.holdLine,o.productionOnly,o.carryoverFrom,o.batchDate,o.prodDate,o.batchMadeDate,o.date,o.deletedAt]))}

async function fetchOrders(){
  const {data,error}=await db.from('work_orders').select('*').is('deleted_at',null);
  if(error)throw error;
  return (data||[]).map(fromRow);
}
async function fetchLogs(){
  const {data,error}=await db.from('activity_logs').select('*').order('event_ts',{ascending:false}).limit(200);
  if(error)throw error;
  return (data||[]).map(r=>({id:r.id,ts:new Date(r.event_ts).getTime(),date:r.event_date,product:r.product,dept:r.dept,type:r.event_type,extra:r.extra||'',actor:r.actor||''}));
}
async function importLegacyIfNeeded(cloud){
  if(!isManager||cloud.length)return cloud;
  let raw=[];
  try{raw=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]')}catch{}
  const legacy=normalizeLegacy(raw).filter(o=>o.product);
  if(!legacy.length)return cloud;
  setSync('syncing','IMPORTING');
  const rows=legacy.map(toRow);
  const {error}=await db.from('work_orders').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
  if(error)throw error;
  toast('Existing work imported to cloud');
  return await fetchOrders();
}
async function initialLoad(){
  try{
    setSync('syncing','SYNCING');
    const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');if(Array.isArray(cached))orders=cached;
    render();
    const cloud=await fetchOrders();orders=cloud;cache();
    logs=await fetchLogs();render();subscribeLive();setSync('live','LIVE');
    if((shippingPortal||profile?.role==='shipping')&&canUseShipping()&&!shippingAutoOpened){shippingAutoOpened=true;setTimeout(()=>openShippingWorkspace(),250)}
    if(reconcileTimer)clearInterval(reconcileTimer);reconcileTimer=setInterval(reconcile,4000);
  }catch(e){console.error(e);setSync('offline','OFFLINE');if(authUser){toast('Cloud connection problem — retrying');setTimeout(()=>{if(authUser)initialLoad()},3500)}}
}
async function reconcile(){
  if(!navigator.onLine){setSync('offline','OFFLINE');return}
  try{
    const cloud=await fetchOrders();
    if(orderSig(cloud)!==orderSig(orders)){orders=cloud;cache();render()}
    await refreshShippingData();
    logPollTick++;if(logPollTick%3===0){logs=await fetchLogs();renderFeedIfOpen()}
    if(!channel)setSync('syncing','SYNCING');
  }catch(e){console.error(e);setSync('offline','OFFLINE')}
}
function subscribeLive(){
  if(channel){db.removeChannel(channel);channel=null}
  channel=db.channel('gametime-live-v3')
    .on('postgres_changes',{event:'*',schema:'public',table:'work_orders'},payload=>{
      if(payload.eventType==='DELETE'){orders=orders.filter(o=>o.id!==Number(payload.old.id));cache();render();return}
      const o=fromRow(payload.new);mergeOrder(o);render();setSync('live','LIVE');
    })
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_logs'},payload=>{
      const r=payload.new;logs.unshift({id:r.id,ts:new Date(r.event_ts).getTime(),date:r.event_date,product:r.product,dept:r.dept,type:r.event_type,extra:r.extra||'',actor:r.actor||''});
      logs=logs.slice(0,200);renderFeedIfOpen();setSync('live','LIVE');
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'shipping_shipments'},scheduleShippingRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'inventory_event_lines'},scheduleShippingRefresh)
    .subscribe(status=>{if(status==='SUBSCRIBED')setSync('live','LIVE');else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setSync('syncing','RECONNECTING')});
}
async function patchOrder(id,patch,expectedVersion=null){
  setSync('syncing','SAVING');
  let q=db.from('work_orders').update({...patch,updated_by:actor(),updated_from:isManager?'manager':view}).eq('id',Number(id)).is('deleted_at',null);
  if(expectedVersion!=null)q=q.eq('version',Number(expectedVersion));
  const {data,error}=await q.select().maybeSingle();
  if(error)throw error;
  if(expectedVersion!=null&&!data)return{conflict:true};
  if(data){mergeOrder(fromRow(data));render()}
  setSync('live','LIVE');return{conflict:false,data}
}
async function insertOrder(o){
  setSync('syncing','SAVING');
  const {data,error}=await db.from('work_orders').insert(toRow(o)).select().single();
  if(error)throw error;mergeOrder(fromRow(data));render();setSync('live','LIVE');return data
}

function searchQuery(){return $('search').value.trim().toLowerCase()}
function isGlobalSearch(){return !!searchQuery()}
function matchSearch(o){
  const q=searchQuery();
  return !q||(o.product+' '+o.batch+' '+prodBatch(o.batch)+' '+(o.batchNote||'')+' '+(o.prodNote||'')).toLowerCase().includes(q)
}
function currentDay(dept){
  const d=iso(selected);
  if(dept==='batch')return orders.filter(o=>!o.holdLine&&!o.productionOnly&&o.batchDate===d);
  if(dept==='prod')return orders.filter(o=>!o.holdLine&&o.prodDate===d);
  return orders.filter(o=>!o.holdLine&&(o.batchDate===d||o.prodDate===d));
}
function departmentList(dept){
  if(!isGlobalSearch())return currentDay(dept);
  const list=orders.filter(o=>!o.holdLine&&matchSearch(o)&&(
    dept==='batch'?(!o.productionOnly&&!!o.batchDate):!!o.prodDate
  ));
  return list.sort((a,b)=>{
    const ad=dept==='batch'?a.batchDate:a.prodDate,bd=dept==='batch'?b.batchDate:b.prodDate;
    return String(bd||'').localeCompare(String(ad||''))||((dept==='batch'?a.batchOrder:a.prodOrder)-(dept==='batch'?b.batchOrder:b.prodOrder));
  })
}
function holdSearchMatches(){return isGlobalSearch()?orders.filter(o=>o.holdLine&&matchSearch(o)):[]}
function renderHoldSearch(){
  const panel=$('searchHoldPanel');if(!panel)return;
  const q=holdSearchMatches();
  if(!isGlobalSearch()||!q.length){panel.style.display='none';panel.innerHTML='';return}
  panel.style.display='';
  panel.innerHTML='<div class="searchhold-head"><b>'+esc(t('holdMatches'))+'</b><span>'+q.length+'</span></div>'+
    '<div class="searchhold-grid">'+q.map(o=>'<div class="searchhold-item"><div><b>'+esc(o.product)+'</b>'+(o.batch?' <span>'+esc(t('batchNumber'))+' '+esc(o.batch)+'</span>':'')+'</div><small>'+(o.tank?esc(o.tank)+' gal • ':'')+esc(o.batchNote||o.prodNote||t('waitingSchedule'))+'</small></div>').join('')+'</div>';
}
function actual(o,k){return k==='quart'?o.actualQuart:k==='gallon'?o.actualGallon:k==='five'?o.actualFive:o.actualJerry}
function pkgClass(o,k){const a=actual(o,k),p=num(o[k]);if(a==null)return'';return a>=p?'done':'partial'}
function pkgCard(o,k,labelKey){
  const a=actual(o,k),p=num(o[k]),mark=a==null?'':(a>=p?'✓':'◐'),label=t(labelKey);
  const extra=a==null?((k==='five'||k==='jerry')?t('tapWhenFilled'):boxes(o[k])+' '+t('boxes')+' • '+t('tapWhenFilled')):t('actual')+' '+a+' / '+p;
  return '<div class="pkg '+pkgClass(o,k)+'" data-qty="'+o.id+'" data-key="'+k+'"><span class="pkgmark">'+mark+'</span><b>'+esc(o[k])+'</b><span>'+esc(label)+'</span><small>'+esc(extra)+'</small></div>';
}
function card(o,dept,i){
  const checked=dept==='batch'?o.batchChecked:o.prodChecked,
        st=dept==='batch'?o.batchStatus:o.prodStatus,
        bn=dept==='prod'?prodBatch(o.batch):o.batch,
        note=dept==='prod'?o.prodNote:o.batchNote,
        prodWaiting=dept==='prod'&&o.batchStatus!=='done',
        hasMade=dept==='prod'&&!!o.batchMadeDate,
        resultDate=dept==='batch'?o.batchDate:o.prodDate,
        canAct=isManager||(profile?.role==='batch'&&dept==='batch')||(profile?.role==='prod'&&dept==='prod'),
        drag=isManager&&!isGlobalSearch()?' data-card="'+o.id+'" data-dept="'+dept+'"':'';
  return '<article class="card '+(prodWaiting?'prod-waiting ':'')+(hasMade?'has-batch-made':'')+'"'+drag+'>'+
    (isManager&&!isGlobalSearch()?'<div class="draghandle" draggable="true" data-drag="'+o.id+'" data-dept="'+dept+'">'+esc(t('dragReorder'))+'</div>':'')+
    '<div class="tank"><b>'+esc(o.tank||'—')+'</b><span>'+esc(t('tankGal'))+'</span></div>'+
    '<div class="order">'+esc(dept==='prod'?t('filling'):t('batchWord'))+' '+esc(t('priority'))+' #'+(i+1)+(isGlobalSearch()&&resultDate?' <button type="button" class="result-date" data-search-date="'+esc(resultDate)+'">'+esc(usDate(resultDate))+'</button>':'')+'</div>'+
    '<div class="productrow"><h3>'+esc(o.product)+'</h3>'+(dept==='prod'&&o.catalyst?'<span class="catalyst-badge">'+esc(t('catalystBadge'))+'</span>':'')+(bn?'<span class="batch">'+esc(t('batchNumber'))+' '+esc(bn)+'</span>':'')+'</div>'+
    (prodWaiting?'<div class="batchwait">'+esc(t('waitingBatch'))+'</div>':'')+
    (o.held?'<div class="note"><b>'+esc(t('onHold'))+'</b></div>':'')+
    (dept==='prod'
      ?'<div class="qty '+(o.jerryEnabled?'four':'')+'">'+pkgCard(o,'quart','quarts')+pkgCard(o,'gallon','oneGallon')+pkgCard(o,'five','fiveGallon')+(o.jerryEnabled?pkgCard(o,'jerry','jerryCan'):'')+'</div>'+
        (note?'<div class="note work-note"><b>'+esc(t('productionNote'))+'</b> '+esc(note)+'</div>':'')
      :(note?'<div class="note work-note"><b>'+esc(t('batchNote'))+'</b> '+esc(note)+'</div>':'<div class="note">'+esc(t('prepareBatch'))+'</div>'))+
    '<label class="precheck '+(checked?'ok ':'')+(prodWaiting?'locked-wait ':'')+(!canAct?'readonly-control':'')+'" '+(canAct?'data-check="'+o.id+'" data-dept="'+dept+'" data-waiting="'+(prodWaiting?'1':'0')+'"':'')+'><span class="sq">'+(checked?'✓':'')+'</span><span class="checktxt"><b>'+esc(t('precheck'))+'</b><small>'+esc(dept==='prod'?t('prodCheckHint'):t('batchCheckHint'))+'</small></span></label>'+
    '<div class="status '+statusClass(st)+'">'+esc(statusText(st))+'</div>'+
    (canAct?'<div class="actions"><button class="start '+(checked&&!prodWaiting?'':'locked')+'" data-action="start" data-id="'+o.id+'" data-dept="'+dept+'" '+(prodWaiting?'disabled':'')+'>'+esc(t('startWork'))+'</button><button class="finish '+(checked&&!prodWaiting?'':'locked')+'" data-action="done" data-id="'+o.id+'" data-dept="'+dept+'" '+(prodWaiting?'disabled':'')+'>'+esc(t('workDone'))+'</button><button class="hold" data-action="hold" data-id="'+o.id+'">'+esc(o.held?t('resumeWork'):t('putOnHold'))+'</button></div>':'<div class="readonlytag inline-readonly">'+esc(t('readOnly'))+'</div>')+
    (isManager?'<div class="manage"><button data-edit="'+o.id+'">'+esc(t('edit'))+'</button><button data-tohold="'+o.id+'">'+esc(t('moveToHold'))+'</button><button data-delete="'+o.id+'">'+esc(t('delete'))+'</button></div>':'')+
    (hasMade?'<div class="batchmade-corner">'+esc(t('batchMadeOn'))+' <b>'+esc(usDate(o.batchMadeDate))+'</b></div>':'')+
    '</article>';
}
function render(){
  $('viewLabel').textContent=(shippingPortal||profile?.role==='shipping')?'SHIPPING':isManager?t('allWork'):view==='prod'?t('productionFilling'):view==='batch'?t('batchMaker'):(roleLabel()||t('readOnly')).toUpperCase();
  $('dateLabel').textContent=isGlobalSearch()?t('searchResults')+' — '+t('allDates'):pretty();
  $('managerTools').style.display=isManager?'flex':'none';$('addBtn').style.display=isManager?'':'none';
  if($('staffBtn'))$('staffBtn').style.display=canManageStaff()?'':'none';
  if($('inventoryBtn'))$('inventoryBtn').style.display=canViewInventory()?'':'none';
  if($('shippingChartBtn'))$('shippingChartBtn').style.display=canViewInventory()?'':'none';
  if($('shippingWorkspaceBtn'))$('shippingWorkspaceBtn').style.display=canUseShipping()?'':'none';
  if($('setInventoryBtn'))$('setInventoryBtn').style.display=isManager?'':'none';
  document.querySelectorAll('[data-print-option]').forEach(b=>{
    const mode=b.dataset.printOption;
    b.style.display=isManager||mode===view?'':'none';
  });
  const addHoldOption=document.querySelector('[data-hold-option="add"]');
  if(addHoldOption)addHoldOption.style.display=isManager?'':'none';
  const batch=departmentList('batch'),prod=departmentList('prod');
  const visibleIds=new Set((view==='batch'?batch:view==='prod'?prod:[...batch,...prod]).map(o=>o.id));
  $('sOrders').textContent=visibleIds.size;$('sBatch').textContent=batch.length;$('sProd').textContent=prod.length;$('sDone').textContent=(isManager||view==='all')?batch.filter(o=>o.batchStatus==='done').length+prod.filter(o=>o.prodStatus==='done').length:view==='batch'?batch.filter(o=>o.batchStatus==='done').length:prod.filter(o=>o.prodStatus==='done').length;
  $('batchCount').textContent=batch.length+' '+t('tasks');$('prodCount').textContent=prod.length+' '+t('tasks');
  $('batchList').innerHTML=batch.length?batch.map((o,i)=>card(o,'batch',i)).join(''):'<div class="empty">'+esc(t('noBatchWork'))+'</div>';
  $('prodList').innerHTML=prod.length?prod.map((o,i)=>card(o,'prod',i)).join(''):'<div class="empty">'+esc(t('noProductionWork'))+'</div>';
  $('batchPanel').style.display=view==='prod'?'none':'';$('prodPanel').style.display=view==='batch'?'none':'';$('board').style.gridTemplateColumns=isManager?'1fr 1fr':'1fr';
  renderHoldSearch();
  bindDynamic();
}
function bindDynamic(){
  document.querySelectorAll('[data-search-date]').forEach(b=>b.onclick=e=>{e.stopPropagation();const d=b.dataset.searchDate;if(!d)return;$('search').value='';selected=new Date(d+'T12:00:00');render()});
  document.querySelectorAll('[data-check]').forEach(el=>el.onclick=async()=>{const o=orders.find(x=>x.id===Number(el.dataset.check)),dept=el.dataset.dept;if(!o)return;if(dept==='prod'&&o.batchStatus!=='done'){toast(t('waitingBatchToast'));return}try{await patchOrder(o.id,{[dept==='batch'?'batch_checked':'prod_checked']:!(dept==='batch'?o.batchChecked:o.prodChecked)})}catch(e){fail(e)}});
  document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>handleAction(btn));
  document.querySelectorAll('[data-qty]').forEach(el=>el.onclick=()=>openQty(Number(el.dataset.qty),el.dataset.key));
  if(isManager){
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(Number(b.dataset.edit),false));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>softDelete(Number(b.dataset.delete)));
    document.querySelectorAll('[data-tohold]').forEach(b=>b.onclick=()=>moveToHold(Number(b.dataset.tohold)));
    bindDrag();
  }
}
async function handleAction(btn){
  const id=Number(btn.dataset.id),o=orders.find(x=>x.id===id);if(!o)return;
  try{
    if(btn.dataset.action==='hold'){await patchOrder(id,{held:!o.held});return}
    const dept=btn.dataset.dept;if(dept==='prod'&&o.batchStatus!=='done'){toast(t('productionLocked'));return}const checked=dept==='batch'?o.batchChecked:o.prodChecked;if(!checked){toast(t('completePrecheck'));return}
    if(btn.dataset.action==='done'&&dept==='prod'){
      const needed=['quart','gallon','five'].filter(k=>num(o[k])>0);if(o.jerryEnabled&&num(o.jerry)>0)needed.push('jerry');const ok=needed.every(k=>actual(o,k)!=null);if(!ok){toast(t('enterActualFirst'));return}
    }
    await patchOrder(id,{[dept==='batch'?'batch_status':'prod_status']:btn.dataset.action==='start'?'progress':'done'});
  }catch(e){fail(e)}
}
function openQty(id,key){
  if(view!=='prod'&&!isManager)return;const o=orders.find(x=>x.id===id);if(!o)return;if(o.batchStatus!=='done'){toast(t('quantitiesLocked'));return}qtyState={id,key};
  const keyMap={quart:'quarts',gallon:'oneGallon',five:'fiveGallon',jerry:'jerryCan'},label=t(keyMap[key]),a=actual(o,key),p=num(o[key]);
  $('qtyTitle').textContent=label+' — '+t('actualQuantity');$('qtyPlanned').innerHTML=esc(t('planned'))+': <b>'+p+'</b><br><small>'+esc(t('enterValidNumber'))+'</small>';$('qtyInput').value=a==null?String(p):String(a);showModal('qtyModal');setTimeout(()=>$('qtyInput').select(),50)
}
async function saveQty(){
  if(!qtyState)return;const raw=$('qtyInput').value.trim(),v=Number(raw);if(raw===''||!Number.isFinite(v)||v<0){toast(t('enterValidNumber'));return}
  const field=qtyState.key==='quart'?'actual_quart':qtyState.key==='gallon'?'actual_gallon':qtyState.key==='five'?'actual_five':'actual_jerry';
  try{$('saveQtyBtn').disabled=true;await patchOrder(qtyState.id,{[field]:v});hideModal('qtyModal');toast(t('actualSaved'))}catch(e){fail(e)}finally{$('saveQtyBtn').disabled=false}
}
function carryTomorrow(dateStr){return nextBusinessDateStr(dateStr||iso(selected))}
function carryValue(id){const raw=$(id).value.trim(),v=Number(raw);return raw!==''&&Number.isFinite(v)&&v>=0?v:null}
function updateCarryPreview(){
  if(!carryState)return;const o=orders.find(x=>x.id===carryState.id);if(!o)return;
  const vals={quart:carryValue('carryQuart'),gallon:carryValue('carryGallon'),five:carryValue('carryFive'),jerry:carryValue('carryJerry')};
  if(Object.values(vals).some(v=>v===null)){$('carryPreview').innerHTML='<b>Enter valid quantities 0 or higher.</b>';return}
  const rem={
    quart:Math.max(num(o.quart)-vals.quart,0),
    gallon:Math.max(num(o.gallon)-vals.gallon,0),
    five:Math.max(num(o.five)-vals.five,0),
    jerry:o.jerryEnabled?Math.max(num(o.jerry)-vals.jerry,0):0
  };
  const gallons=rem.quart*.25+rem.gallon+rem.five*5+rem.jerry*1.25;
  $('carryPreview').innerHTML='<b>Remaining for '+esc($('carryDate').value||'next day')+':</b><br>Quarts: <b>'+rem.quart+'</b> • 1 Gallon: <b>'+rem.gallon+'</b> • 5 Gallon: <b>'+rem.five+'</b>'+(o.jerryEnabled?' • Jerry 1.25G: <b>'+rem.jerry+'</b>':'')+'<br>Approx. remaining gallons: <b>'+gallons.toFixed(2)+'</b>';
}
function openCarry(id){
  if(view!=='prod'&&!isManager)return;const o=orders.find(x=>x.id===id);if(!o)return;carryState={id};
  $('carryProduct').innerHTML='<b>'+esc(o.product)+'</b>'+(o.batch?' • Batch '+esc(prodBatch(o.batch)):'')+'<br><small>Planned: Q '+esc(o.quart)+' • 1G '+esc(o.gallon)+' • 5G '+esc(o.five)+(o.jerryEnabled?' • Jerry '+esc(o.jerry):'')+'</small>';
  $('carryDate').value=carryTomorrow(o.date);
  const fields=[['quart','carryQuart','carryQuartWrap'],['gallon','carryGallon','carryGallonWrap'],['five','carryFive','carryFiveWrap'],['jerry','carryJerry','carryJerryWrap']];
  for(const [k,input,wrap] of fields){
    const enabled=k!=='jerry'||o.jerryEnabled,planned=enabled?num(o[k]):0,a=enabled?actual(o,k):null;
    $(wrap).style.display=enabled&&planned>0?'':'none';$(input).value=a==null?'0':String(a);
  }
  updateCarryPreview();showModal('carryModal');
}
async function saveCarry(){
  if(!carryState)return;const o=orders.find(x=>x.id===carryState.id);if(!o)return;
  const q=carryValue('carryQuart'),g=carryValue('carryGallon'),f=carryValue('carryFive'),j=o.jerryEnabled?carryValue('carryJerry'):0,date=$('carryDate').value;
  if([q,g,f,j].some(v=>v===null)||!date){toast('Enter valid filled quantities and next date');return}
  if(isWeekendDateStr(date)){toast(t('weekendOff'));return}
  if(date<=o.date){toast('Choose a date after the current work date');return}
  const remaining=Math.max(num(o.quart)-q,0)+Math.max(num(o.gallon)-g,0)+Math.max(num(o.five)-f,0)+(o.jerryEnabled?Math.max(num(o.jerry)-j,0):0);
  if(remaining<=0){toast('Nothing remains. Use WORK DONE instead.');return}
  try{
    $('saveCarryBtn').disabled=true;$('saveCarryBtn').textContent='Moving…';setSync('syncing','SAVING');
    const {error}=await db.rpc('carry_production_to_next_day',{p_order_id:o.id,p_next_date:date,p_actual_quart:q,p_actual_gallon:g,p_actual_five:f,p_actual_jerry:j,p_actor:actor()});
    if(error)throw error;
    hideModal('carryModal');carryState=null;await reconcile();setSync('live','LIVE');toast('Remainder moved to '+date)
  }catch(e){fail(e)}finally{$('saveCarryBtn').disabled=false;$('saveCarryBtn').textContent='Move Remainder'}
}
function openEditor(id=null,hold=false){
  if(!isManager)return;const o=id?orders.find(x=>x.id===id):null;editorMode=hold||o?.holdLine?'hold':'order';editingId=o?.id||null;editingVersion=o?.version||null;
  $('editorTitle').textContent=editorMode==='hold'?(o?t('editHoldLineItem'):t('addHoldLineItem')):(o?t('editWorkOrder'):t('addWorkOrder'));
  $('editId').value=o?.id||'';$('editVersion').value=o?.version||'';$('product').value=o?.product||'';
  const defaultDate=iso(selected);
  $('workDate').value=editorMode==='hold'?'':(o?.batchDate||o?.date||defaultDate);
  $('prodWorkDate').value=editorMode==='hold'?'':(o?.prodDate||o?.date||defaultDate);
  $('dateField').style.display=editorMode==='hold'?'none':'';
  $('batchNumber').value=o?.batch||'';$('tank').value=o?.tank||'';$('priority').value=o?.priority||'Normal';$('quart').value=o?.quart??'0';$('gallon').value=o?.gallon??'0';$('five').value=o?.five??'0';$('jerryEnabled').checked=!!o?.jerryEnabled;$('catalystEnabled').checked=!!o?.catalyst;$('jerry').value=o?.jerry??'0';toggleJerryField(false);$('batchNote').value=o?.batchNote||'';$('prodNote').value=o?.prodNote||'';setAuto(o?.autoTarget||null);showModal('editorModal')
}
function setAuto(t){
  if(t==='jerry'&&!$('jerryEnabled').checked)t=null;
  autoTarget=t;
  document.querySelectorAll('[data-auto]').forEach(b=>b.classList.toggle('on',b.dataset.auto===t));
  ['quart','gallon','five','jerry'].forEach(k=>$(k).readOnly=k===t);
  recalc()
}
function toggleJerryField(reset=true){
  const on=$('jerryEnabled').checked;
  $('jerryField').style.display=on?'':'none';
  $('jerryAutoBtn').style.display=on?'':'none';
  if(!on&&autoTarget==='jerry')setAuto(null);
  if(!on&&reset)$('jerry').value='0';
  recalc();
}
function recalc(){
  const total=num($('tank').value),jOn=$('jerryEnabled').checked;
  if(autoTarget){
    let used=0;
    for(const k of ['quart','gallon','five','jerry']){
      if(k===autoTarget)continue;
      if(k==='jerry'&&!jOn)continue;
      const v=num($(k).value);
      used+=k==='five'?v*5:k==='gallon'?v:k==='quart'?v*.25:v*1.25;
    }
    const rem=Math.max(0,total-used);
    const autoValue=autoTarget==='five'?Math.floor(rem/5):
                    autoTarget==='gallon'?Math.floor(rem):
                    autoTarget==='quart'?Math.floor(rem*4):
                    Math.floor(rem/1.25);
    $(autoTarget).value=String(autoValue);
  }
  const q=num($('quart').value),g=num($('gallon').value),f=num($('five').value),j=jOn?num($('jerry').value):0;
  const used=f*5+g+q*.25+j*1.25,left=total-used;
  $('qBoxes').textContent=Math.ceil(q/4)+' '+t('boxes').toLowerCase();$('gBoxes').textContent=Math.ceil(g/4)+' '+t('boxes').toLowerCase();
  $('calc').innerHTML=esc(t('total'))+': <b>'+total+'</b> gal • '+esc(t('used'))+': <b>'+used+'</b> gal • '+(jOn?esc(t('jerryCan'))+': <b>'+j+'</b> × 1.25 = <b>'+(j*1.25).toFixed(2)+'</b> gal • ':'')+(Math.abs(left)<.001?'<b>'+esc(t('exactTotal'))+'</b>':esc(left>0?t('unassigned'):t('over'))+': <b>'+Math.abs(left).toFixed(2)+'</b> gal')
}
async function saveEditor(){
  if(saveBusy)return;
  const product=titleCase($('product').value.trim()),
        batchDate=editorMode==='hold'?'':$('workDate').value,
        prodDate=editorMode==='hold'?'':$('prodWorkDate').value,
        batchNo=$('batchNumber').value.trim();
  if(!product||((!batchDate||!prodDate)&&editorMode!=='hold')){toast(editorMode==='hold'?t('enterProduct'):t('enterBothDates'));return}
  if(editorMode!=='hold'&&(isWeekendDateStr(batchDate)||isWeekendDateStr(prodDate))){toast(t('weekendOff'));return}
  if(editorMode!=='hold'&&prodDate<batchDate){toast(t('productionBeforeBatch'));return}
  if(batchNo){
    const localDuplicate=orders.find(o=>o.id!==editingId&&String(o.batch||'').trim().toLowerCase()===batchNo.toLowerCase());
    if(localDuplicate){toast(t('batchExists'));return}
    const {data:available,error:batchError}=await db.rpc('batch_number_available',{p_batch:batchNo,p_exclude_id:editingId});
    if(batchError){fail(batchError);return}
    if(!available){toast('Batch # '+batchNo+' already exists');return}
  }
  saveBusy=true;$('saveOrderBtn').disabled=true;$('saveOrderBtn').textContent=t('saving');
  try{
    const plan={work_date:editorMode==='hold'?null:batchDate,batch_work_date:editorMode==='hold'?null:batchDate,prod_work_date:editorMode==='hold'?null:prodDate,hold_line:editorMode==='hold',product,batch:batchNo,tank:num($('tank').value),priority:$('priority').value,quart:$('quart').value.trim()||'0',gallon:$('gallon').value.trim()||'0',five:$('five').value.trim()||'0',jerry_enabled:$('jerryEnabled').checked,jerry:$('jerryEnabled').checked?($('jerry').value.trim()||'0'):'0',catalyst:$('catalystEnabled').checked,batch_note:$('batchNote').value.trim(),prod_note:$('prodNote').value.trim(),auto_target:autoTarget};
    if(editingId){
      const res=await patchOrder(editingId,plan,editingVersion);
      if(res.conflict){await reconcile();hideModal('editorModal');toast('This order changed on another manager screen. Latest version loaded.');return}
    }else{
      const sameBatchDate=orders.filter(o=>!o.holdLine&&o.batchDate===batchDate),
            sameProdDate=orders.filter(o=>!o.holdLine&&o.prodDate===prodDate),
            o={id:nextId(),date:batchDate,holdLine:editorMode==='hold',product,batch:plan.batch,tank:plan.tank,priority:plan.priority,quart:plan.quart,gallon:plan.gallon,five:plan.five,jerryEnabled:plan.jerry_enabled,jerry:plan.jerry,catalyst:plan.catalyst,batchNote:plan.batch_note,prodNote:plan.prod_note,autoTarget,batchChecked:false,prodChecked:false,batchStatus:'ready',prodStatus:'ready',held:false,actualQuart:null,actualGallon:null,actualFive:null,actualJerry:null,productionOnly:false,carryoverFrom:null,batchDate,prodDate,batchMadeDate:null,batchOrder:editorMode==='hold'?999:Math.max(0,...sameBatchDate.map(x=>x.batchOrder))+1,prodOrder:editorMode==='hold'?999:Math.max(0,...sameProdDate.map(x=>x.prodOrder))+1};
      await insertOrder(o)
    }
    hideModal('editorModal');if(editorMode!=='hold')selected=new Date(batchDate+'T12:00:00');render();toast(t('saved')+' — '+t('batchMakerDate')+' '+usDate(batchDate)+' • '+t('productionDate')+' '+usDate(prodDate))
  }catch(e){
    if(e&&e.code==='23505'){toast(t('batchExists'))}
    else if(e&&e.code==='23514'){toast(t('weekendOff'))}
    else fail(e)
  }finally{saveBusy=false;$('saveOrderBtn').disabled=false;$('saveOrderBtn').textContent=t('saveWorkOrder')}
}
async function softDelete(id){if(!isManager||!confirm(t('confirmDelete')))return;try{await patchOrder(id,{deleted_at:new Date().toISOString()});orders=orders.filter(o=>o.id!==id);cache();render();toast(t('deletedHistory'))}catch(e){fail(e)}}
async function moveToHold(id){if(!isManager)return;try{await patchOrder(id,{hold_line:true,work_date:null,batch_work_date:null,prod_work_date:null});toast(t('movedHold'))}catch(e){fail(e)}}
async function scheduleHold(id,date){if(!date)return;if(isWeekendDateStr(date)){toast(t('weekendOff'));return}const day=orders.filter(o=>!o.holdLine&&o.date===date);try{await patchOrder(id,{hold_line:false,work_date:date,batch_work_date:date,prod_work_date:date,batch_order:Math.max(0,...day.map(x=>x.batchOrder))+1,prod_order:Math.max(0,...day.map(x=>x.prodOrder))+1});selected=new Date(date+'T12:00:00');closeDrawer();toast(t('scheduled'))}catch(e){fail(e)}}
async function reschedule(id,date){if(!date)return;if(isWeekendDateStr(date)){toast(t('weekendOff'));return}const o=orders.find(x=>x.id===id);if(!o)return;if(o.batchStatus==='done'&&o.prodStatus!=='done'&&o.batchDate&&date<o.batchDate){toast('Production cannot be scheduled before the Batch Maker date');return}const p={work_date:date};if(o.batchStatus!=='done')p.batch_work_date=date;if(o.prodStatus!=='done')p.prod_work_date=date;try{await patchOrder(id,p);selected=new Date(date+'T12:00:00');closeDrawer();toast(t('rescheduled'))}catch(e){fail(e)}}

function bindDrag(){
  document.querySelectorAll('.draghandle[draggable="true"]').forEach(handle=>{
    const card=handle.closest('.card');if(!card)return;
    handle.ondragstart=e=>{
      dragState={id:Number(handle.dataset.drag),dept:handle.dataset.dept};
      card.classList.add('dragging');
      if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragState.id))}
    };
    handle.ondragend=()=>{
      document.querySelectorAll('.dragging,.dropzone').forEach(x=>x.classList.remove('dragging','dropzone'));
      dragState=null
    };
  });
  document.querySelectorAll('.card[data-card]').forEach(card=>{
    card.ondragover=e=>{
      if(dragState&&dragState.dept===card.dataset.dept){e.preventDefault();card.classList.add('dropzone')}
    };
    card.ondragleave=()=>card.classList.remove('dropzone');
    card.ondrop=e=>{
      e.preventDefault();card.classList.remove('dropzone');
      if(dragState&&dragState.dept===card.dataset.dept)reorder(dragState.id,Number(card.dataset.card),dragState.dept)
    };
  });
}
let touchDrag=null;
document.addEventListener('touchstart',e=>{const h=e.target.closest('.draghandle');if(!h||!isManager)return;touchDrag={id:Number(h.dataset.drag),dept:h.dataset.dept,target:null};h.closest('.card')?.classList.add('dragging')},{passive:true});
document.addEventListener('touchmove',e=>{if(!touchDrag)return;const t=e.touches[0],card=document.elementFromPoint(t.clientX,t.clientY)?.closest('.card');document.querySelectorAll('.dropzone').forEach(x=>x.classList.remove('dropzone'));if(card&&card.dataset.dept===touchDrag.dept){card.classList.add('dropzone');touchDrag.target=Number(card.dataset.card)}e.preventDefault()},{passive:false});
document.addEventListener('touchend',()=>{if(!touchDrag)return;document.querySelectorAll('.dragging,.dropzone').forEach(x=>x.classList.remove('dragging','dropzone'));if(touchDrag.target)reorder(touchDrag.id,touchDrag.target,touchDrag.dept);touchDrag=null});
async function reorder(dragId,targetId,dept){
  if(dragId===targetId)return;const day=currentDay(dept).sort((a,b)=>(dept==='batch'?a.batchOrder-b.batchOrder:a.prodOrder-b.prodOrder)),from=day.findIndex(o=>o.id===dragId),to=day.findIndex(o=>o.id===targetId);if(from<0||to<0)return;const item=day.splice(from,1)[0];day.splice(to,0,item);
  try{setSync('syncing','SAVING');const {error}=await db.rpc('reorder_work_orders',{p_work_date:iso(selected),p_dept:dept,p_ids:day.map(o=>o.id),p_actor:actor()});if(error)throw error;day.forEach((o,i)=>{if(dept==='batch')o.batchOrder=i+1;else o.prodOrder=i+1});cache();render();setSync('live','LIVE')}catch(e){fail(e)}
}

function entriesForDate(d){
  if(view==='batch')return orders.filter(o=>!o.holdLine&&!o.productionOnly&&o.batchDate===d).map(o=>({o,dept:'batch'}));
  if(view==='prod')return orders.filter(o=>!o.holdLine&&o.prodDate===d).map(o=>({o,dept:'prod'}));
  return [
    ...orders.filter(o=>!o.holdLine&&!o.productionOnly&&o.batchDate===d).map(o=>({o,dept:'batch'})),
    ...orders.filter(o=>!o.holdLine&&o.prodDate===d).map(o=>({o,dept:'prod'}))
  ]
}
function entryDone(e){return e.dept==='batch'?e.o.batchStatus==='done':e.o.prodStatus==='done'}
function dayState(d){const a=entriesForDate(d);if(!a.length)return'emptyday';return a.every(entryDone)?'good':'bad'}
function openMonth(){monthCursor=new Date(selected.getFullYear(),selected.getMonth(),1);showModal('monthModal');renderMonth()}
function renderMonth(){
  $('monthTitle').textContent=monthCursor.toLocaleDateString(locale(),{month:'long',year:'numeric'});
  let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<div class="dow">'+x+'</div>').join(''),
      first=new Date(monthCursor.getFullYear(),monthCursor.getMonth(),1),start=new Date(first);
  start.setDate(1-first.getDay());const today=iso(new Date());
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const di=iso(d),weekend=d.getDay()===0||d.getDay()===6;
    const arr=weekend?[]:entriesForDate(di);
    const chips=weekend?'<div class="weekendoff">OFF</div>':arr.map(e=>'<div class="calorder '+(entryDone(e)?'calgood':'calbad')+'" title="'+esc(e.o.product)+'"><b>'+(e.dept==='batch'?'B':'P')+'</b> '+esc(e.o.product)+(e.o.batch?' <span>'+esc(e.o.batch)+'</span>':'')+(e.dept==='prod'&&e.o.batchMadeDate?' <span>• Made '+esc(usDate(e.o.batchMadeDate))+'</span>':'')+'</div>').join('');
    html+='<div class="day '+(weekend?'weekend ':(!arr.length?'emptyday ':''))+(di===today?'today':'')+'" '+(weekend?'':'data-day="'+di+'"')+'><div class="daynum">'+d.getDate()+'</div><div class="calorders">'+chips+'</div></div>';
  }
  $('calendar').innerHTML=html;
  document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>{selected=new Date(el.dataset.day+'T12:00:00');hideModal('monthModal');render()})
}
function renderFeedHTML(){
  return logs.length?logs.slice(0,80).map(e=>'<div class="event '+(e.type==='progress'?'start':e.type==='done'?'done':e.type==='package'?'package':'')+'"><b>'+esc(e.product)+' — '+esc(deptText(e.dept))+'</b><small>'+new Date(e.ts).toLocaleString(locale())+' • '+esc(eventTypeText(e.type))+(e.actor?' • '+esc(t('by'))+' '+esc(e.actor):'')+(e.extra?' • '+esc(e.extra):'')+'</small></div>').join(''):'<div class="event">'+esc(t('noActivity'))+'</div>'
}
function renderQueueHTML(){
  const today=iso(new Date()),q=orders.filter(o=>!o.holdLine&&o.date&&o.date<today&&(o.batchStatus!=='done'||o.prodStatus!=='done'));
  return q.length?q.map(o=>'<div class="queueitem"><b>'+esc(o.product)+(o.batch?' • '+esc(o.batch):'')+'</b><small>'+esc(t('from'))+' '+esc(o.date)+' • '+(o.batchStatus!=='done'?esc(t('batchUnfinished'))+' ':'')+(o.prodStatus!=='done'?esc(t('productionUnfinished')):'')+'</small><input type="date" data-resdate="'+o.id+'" value="'+iso(selected)+'"><button data-reschedule="'+o.id+'">'+esc(t('scheduleSelected'))+'</button></div>').join(''):'<div class="queueitem">'+esc(t('nothingUnfinished'))+'</div>'
}
function renderHoldHTML(){
  const q=orders.filter(o=>o.holdLine);
  if(!isManager){
    return q.length?q.map(o=>
      '<div class="holditem holdreadonly"><b>'+esc(o.product)+(o.batch?' • '+esc(t('batchNumber'))+' '+esc(o.batch):'')+'</b>'+
      '<small>'+(o.tank?esc(o.tank)+' gal • ':'')+esc(o.batchNote||o.prodNote||t('waitingSchedule'))+'</small>'+
      '<div class="readonlytag">'+esc(t('readOnly'))+'</div></div>'
    ).join(''):'<div class="holditem">'+esc(t('holdEmpty'))+'</div>'
  }
  return '<div style="padding:8px"><button class="draweraction" id="addHold">'+esc(t('addHoldItem'))+'</button></div>'+
    (q.length?q.map(o=>'<div class="holditem"><b>'+esc(o.product)+(o.batch?' • '+esc(o.batch):'')+'</b><small>'+(o.tank?o.tank+' gal • ':'')+esc(o.batchNote||t('noDateAssigned'))+'</small><input type="date" data-holddate="'+o.id+'" value="'+iso(selected)+'"><div class="holdactions"><button data-schedulehold="'+o.id+'">'+esc(t('schedule'))+'</button><button class="secondary" data-edithold="'+o.id+'">'+esc(t('edit'))+'</button><button class="secondary" data-delhold="'+o.id+'">'+esc(t('delete'))+'</button></div></div>').join(''):'<div class="holditem">'+esc(t('holdEmpty'))+'</div>')
}
function openDrawer(type){
  if(!isManager&&type!=='holdline')return;
  $('drawerBackdrop').classList.add('show');$('drawerBackdrop').dataset.type=type;
  $('drawerTitle').textContent=type==='activity'?t('liveActivity').replace(/^●\s*/,''):type==='queue'?t('unfinishedQueue').replace(/^☰\s*/,''):type==='holdline'?t('holdLine').replace(/^▣\s*/,''):t('printSavePdf');
  if(type==='activity')$('drawerBody').innerHTML=renderFeedHTML();
  if(type==='queue'){$('drawerBody').innerHTML=renderQueueHTML();document.querySelectorAll('[data-reschedule]').forEach(b=>b.onclick=()=>reschedule(Number(b.dataset.reschedule),document.querySelector('[data-resdate="'+b.dataset.reschedule+'"]').value))}
  if(type==='holdline'){$('drawerBody').innerHTML=renderHoldHTML();if(isManager){$('addHold').onclick=()=>{closeDrawer();openEditor(null,true)};document.querySelectorAll('[data-schedulehold]').forEach(b=>b.onclick=()=>scheduleHold(Number(b.dataset.schedulehold),document.querySelector('[data-holddate="'+b.dataset.schedulehold+'"]').value));document.querySelectorAll('[data-edithold]').forEach(b=>b.onclick=()=>{closeDrawer();openEditor(Number(b.dataset.edithold),true)});document.querySelectorAll('[data-delhold]').forEach(b=>b.onclick=()=>softDelete(Number(b.dataset.delhold)))}}
  if(type==='print'){$('drawerBody').innerHTML='<div style="padding:8px"><button class="draweraction" data-print="all">'+esc(t('fullDayPrint'))+'</button><button class="draweraction" data-print="batch">'+esc(t('printBatch'))+'</button><button class="draweraction" data-print="prod">'+esc(t('printProduction'))+'</button></div>';document.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{closeDrawer();printSheet(b.dataset.print)})}
}
function renderFeedIfOpen(){if($('drawerBackdrop').classList.contains('show')&&$('drawerBackdrop').dataset.type==='activity')$('drawerBody').innerHTML=renderFeedHTML()}
function closeDrawer(){$('drawerBackdrop').classList.remove('show')}
async function shareShipping(){
  const url=new URL('shipping.html',location.href).href;
  try{if(navigator.share){await navigator.share({title:'GameTime Shipping',url});return}}catch(e){if(e.name==='AbortError')return}
  try{await navigator.clipboard.writeText(url);toast('Shipping link copied')}catch{prompt('Copy Shipping link:',url)}
}
async function shareDept(dept){const base=location.href.split('?')[0].replace(/[^/]*$/,''),url=base+(dept==='prod'?'production.html?build=SECURE_V2_20261009o':'batch-maker.html?build=SECURE_V2_20261009o'),title=dept==='prod'?t('productionFilling'):t('batchMaker');try{if(navigator.share){await navigator.share({title,text:'GameTime Factory Work Board',url});return}}catch(e){if(e.name==='AbortError')return}try{await navigator.clipboard.writeText(url);toast(title+' ✓')}catch{prompt(lang==='es'?'Copia este enlace:':'Copy this link:',url)}}

function monthBounds(monthValue){
  const m=/^(\d{4})-(\d{2})$/.exec(monthValue||'');
  if(!m)return null;
  const y=Number(m[1]),mo=Number(m[2]),start=m[1]+'-'+m[2]+'-01';
  const next=new Date(y,mo,1);
  return {start,next:iso(next)}
}
function actualGallons(q,g,f,j){
  return (Number(q)||0)*.25+(Number(g)||0)+(Number(f)||0)*5+(Number(j)||0)*1.25
}
function addAnalyticsRow(map,product,gallons,orderId){
  if(!(gallons>0))return;
  const name=(product||'').trim()||'Unnamed';
  const key=name.toLowerCase();
  if(!map.has(key))map.set(key,{product:name,gallons:0,batches:new Set()});
  const row=map.get(key);row.gallons+=gallons;if(orderId!=null)row.batches.add(String(orderId))
}

let shippingEnginePromise=null;
async function shippingEngine(){
  if(!shippingEnginePromise)shippingEnginePromise=import('./gametim-shipping.mjs?v='+BUILD);
  return shippingEnginePromise;
}
async function shippingPlan(mode,payload={}){
  const engine=await shippingEngine();
  let data;
  if(mode==='slip'){
    data=engine.planFromSlip(String(payload.text||''));
  }else if(mode==='lines'){
    data=engine.planShipment({
      orderName:String(payload.orderName||''),
      customer:String(payload.customer||''),
      lines:Array.isArray(payload.lines)?payload.lines:[]
    },String(payload.slipText||''));
  }else{
    throw new Error('Unknown shipping plan mode');
  }
  if(data?.ok&&Array.isArray(data.lines)){
    data.lines=data.lines.map(line=>({
      ...line,
      inventoryProduct:engine.productLabel(line.sku||'',line.description||'',line.size||'')
    }));
  }
  return data;
}
function shippingSizeLabel(size){
  return {quart:'Quart',pint:'Pint',gal1:'1 Gallon',gal125:'1.25 Gallon',gal15:'1.5 Gallon',gal5:'5 Gallon',vinyl:'Vinyl Box',drawdown:'Drawdown'}[size]||size;
}
function shippingSizeOptions(selected){
  return ['gal5','gal15','gal125','gal1','quart','pint','vinyl','drawdown'].map(s=>'<option value="'+s+'" '+(s===selected?'selected':'')+'>'+esc(shippingSizeLabel(s))+'</option>').join('');
}
function shippingStatusClass(status){return status==='SHIPPED'?'shipped':status==='READY'?'ready':status==='CANCELED'?'canceled':'draft'}
function shippingKnownProducts(){
  const map=new Map();
  for(const o of orders){const v=(o.product||'').trim();if(v)map.set(v.toLowerCase(),v)}
  for(const r of inventoryStockRows){const v=String(r.product||'').trim();if(v)map.set(v.toLowerCase(),v)}
  return [...map.values()].sort((a,b)=>a.localeCompare(b));
}
function shippingPopulateProducts(){
  const list=$('inventoryProductList');if(!list)return;
  const all=new Map();
  for(const x of shippingKnownProducts())all.set(x.toLowerCase(),x);
  for(const r of inventoryStockRows){const x=String(r.product||'').trim();if(x)all.set(x.toLowerCase(),x)}
  list.innerHTML=[...all.values()].map(x=>'<option value="'+esc(x)+'"></option>').join('');
}
function shippingCleanProduct(desc,sku){
  let s=String(desc||'').replace(/\s*\[\[[^\]]+\]\]\s*/g,' ').replace(/\s+/g,' ').trim();
  const known=shippingKnownProducts();
  const hay=(String(sku||'')+' '+s).toLowerCase().replace(/excel/g,'xcel');
  const hits=known.filter(x=>hay.includes(x.toLowerCase().replace(/excel/g,'xcel'))).sort((a,b)=>b.length-a.length);
  if(hits[0])return hits[0];
  s=s.replace(/\b(?:5\s*gallon|1\.?5\s*gallon|1\.?25\s*gallon|1\s*gallon|gallon|quart|pint|pails?|buckets?)\b/ig,' ').replace(/\s*[-–—]\s*$/,' ').replace(/\s+/g,' ').trim();
  const skuText=String(sku||'').trim();
  if(skuText&&s.toLowerCase().startsWith(skuText.toLowerCase())){
    s=s.slice(skuText.length).replace(/^\s*[-–—:]?\s*/,'').trim();
  }
  return s||skuText||'Item';
}
function shippingLineFromEngine(line,batch=''){
  return {
    sku:line.sku||'',
    description:line.description||'',
    size:line.size||'gal1',
    qty:Number(line.qty)||0,
    inventory_product:line.inventoryProduct||shippingCleanProduct(line.description,line.sku),
    batch:batch||'',
    source:line.source||''
  };
}
function shippingEditorMessage(msg,bad=false){
  const el=$('shippingEditorMessage');if(!el)return;el.textContent=msg||'';el.className='authmessage'+(bad?' bad':' good');
}
function shippingScanMessage(msg,busy=false){
  const el=$('shippingScanStatus');if(!el)return;el.textContent=msg||'';el.className='shippingscanstatus'+(busy?' busy':'');
}
function shippingCollectLines(){
  return [...document.querySelectorAll('.shipping-line-row')].map(row=>({
    sku:row.querySelector('[data-ship-field="sku"]').value.trim(),
    description:row.querySelector('[data-ship-field="description"]').value.trim(),
    size:row.querySelector('[data-ship-field="size"]').value,
    qty:Number(row.querySelector('[data-ship-field="qty"]').value),
    inventory_product:row.querySelector('[data-ship-field="inventory"]').value.trim(),
    batch:row.querySelector('[data-ship-field="batch"]').value.trim(),
    source:row.dataset.source||''
  }));
}
function shippingRenderLines(){
  shippingPopulateProducts();
  const host=$('shippingLines');if(!host)return;
  host.innerHTML=shippingDraftLines.map((l,i)=>
    '<div class="shipping-line-row" data-line-index="'+i+'" data-source="'+esc(l.source||'')+'">'+
      '<div class="shiplineindex">'+(i+1)+'</div>'+
      '<label>SKU<input data-ship-field="sku" value="'+esc(l.sku||'')+'"></label>'+
      '<label class="shipdesc">Description<input data-ship-field="description" value="'+esc(l.description||'')+'"></label>'+
      '<label>Size<select data-ship-field="size">'+shippingSizeOptions(l.size)+'</select></label>'+
      '<label>Qty Units<input data-ship-field="qty" type="number" min="1" step="1" inputmode="numeric" value="'+esc(l.qty)+'"></label>'+
      '<label class="shipinventory">Inventory Product<input data-ship-field="inventory" list="inventoryProductList" value="'+esc(l.inventory_product||'')+'"></label>'+
      '<label>Batch<input data-ship-field="batch" value="'+esc(l.batch||'')+'"></label>'+
      '<button type="button" class="shiplineremove" data-remove-ship-line="'+i+'" aria-label="Remove line">✕</button>'+
    '</div>'
  ).join('')||'<div class="analytics-empty">No shipment lines yet.</div>';
  document.querySelectorAll('[data-remove-ship-line]').forEach(b=>b.onclick=()=>{
    shippingDraftLines=shippingCollectLines();shippingDraftLines.splice(Number(b.dataset.removeShipLine),1);shippingRenderLines();
  });
}
function shippingAddLine(){
  if(shippingCurrentStatus==='SHIPPED'||shippingCurrentStatus==='CANCELED')return;
  shippingDraftLines=shippingCollectLines();shippingDraftLines.push({sku:'',description:'',size:'gal1',qty:1,inventory_product:'',batch:'',source:''});shippingRenderLines();
}
function shippingRenderPlan(plan){
  const host=$('shippingPalletPlan');if(!host)return;
  if(!plan||!plan.ok){host.innerHTML='<div class="analytics-empty">'+esc(plan?.error||'Build the pallet plan to continue.')+'</div>';return}
  const drawdowns=shippingDraftLines.filter(x=>x.size==='drawdown').reduce((s,x)=>s+(Number(x.qty)||0),0);
  host.innerHTML=
    '<div class="shippingplansummary">'+
      '<div><span>Pallets</span><b>'+esc(plan.totals?.pallets??0)+'</b></div>'+
      '<div><span>Full</span><b>'+esc(plan.totals?.full??0)+'</b></div>'+
      '<div><span>Mixed</span><b>'+esc(plan.totals?.mixed??0)+'</b></div>'+
      '<div><span>Gross Weight</span><b>'+Number(plan.totals?.grossLb||0).toLocaleString(locale())+' lb</b></div>'+
      (drawdowns?'<div><span>Drawdowns / Mail</span><b>'+drawdowns+'</b></div>':'')+
    '</div>'+
    '<div class="palletgrid">'+(plan.pallets||[]).map(p=>
      '<article class="palletcard">'+
        '<div class="pallethead"><div><b>Pallet '+p.number+'</b><span class="palletkind '+esc(p.kind)+'">'+esc(p.kind)+'</span></div><strong>'+Number(p.pounds||0).toLocaleString(locale())+' lb</strong></div>'+
        '<div class="palletitems">'+(p.items||[]).map(item=>
          '<div class="palletitem '+(item.onTop?'ontop':'')+'">'+
            '<div><b>'+esc(item.product)+'</b><small>'+esc(item.size)+(item.sku?' • '+esc(item.sku):'')+'</small></div>'+
            '<div class="palletqty">'+(item.onTop?'<span>ON TOP</span>':'')+'<b>'+esc(item.units)+'</b><small>units'+(item.boxes?' • '+esc(item.boxes)+' boxes':'')+'</small></div>'+
          '</div>'
        ).join('')+'</div>'+
      '</article>'
    ).join('')+'</div>';
}
async function shippingBuildPlan(){
  shippingDraftLines=shippingCollectLines();
  const bad=shippingDraftLines.find(l=>!l.description||!l.size||!Number.isFinite(l.qty)||l.qty<=0||!Number.isInteger(l.qty));
  if(bad){shippingEditorMessage('Every line needs a description, size, and a whole-number quantity greater than zero.',true);return null}
  const lines=shippingDraftLines.map((l,i)=>({id:String(i+1),sku:l.sku,description:l.description,size:l.size,qty:Math.round(Number(l.qty))}));
  const plan=await shippingPlan('lines',{orderName:$('shippingNumber').value.trim(),customer:$('shippingCustomer').value.trim(),lines,slipText:$('shippingSlipText').value||''});
  shippingDraftPlan=plan;shippingRenderPlan(plan);
  if(!plan.ok)shippingEditorMessage(plan.error||'Could not build pallets.',true);else shippingEditorMessage('Pallet plan updated.');
  return plan;
}
async function shippingProcessSlip(){
  const text=($('shippingSlipText').value||'').trim();
  if(!text){shippingScanMessage('Add a packing slip photo, file, or text first.');return}
  shippingScanMessage('Reading packing slip and calculating pallets…',true);shippingEditorMessage('');
  try{
    const plan=await shippingPlan('slip',{text});
    if(!plan.ok)throw new Error(plan.error||'No product lines found.');
    $('shippingNumber').value=plan.orderName||'';$('shippingCustomer').value=plan.customer||'';$('shippingPo').value=plan.po||'';
    $('shippingSalesperson').value=plan.salesperson?.name||plan.salesperson?.email||'';
    const batch=(plan.batchCodes||[]).length===1?plan.batchCodes[0]:'';
    shippingDraftLines=(plan.lines||[]).map(x=>shippingLineFromEngine(x,batch));shippingDraftPlan=plan;
    shippingRenderLines();shippingRenderPlan(plan);$('shippingReviewSection').style.display='';
    shippingScanMessage('Packing slip read successfully. Review the details below.');
    shippingEditorMessage((plan.batchCodes||[]).length>1?'Multiple batch codes were found. Confirm the batch on each line before shipping.':'Review the extracted details, then Save Ready.');
    setTimeout(()=>$('shippingReviewSection').scrollIntoView({behavior:'smooth',block:'start'}),80);
  }catch(e){console.error(e);shippingScanMessage(e.message||String(e));shippingEditorMessage(e.message||String(e),true)}
}
function shippingLoadScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  if(globalName==='jspdfAutoTableReady'&&window.jspdf?.jsPDF.API.autoTable)return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const old=document.querySelector('script[data-shipping-lib="'+globalName+'"]');
    if(old){old.addEventListener('load',()=>resolve(window[globalName]),{once:true});old.addEventListener('error',reject,{once:true});return}
    const s=document.createElement('script');s.src=src;s.async=true;s.dataset.shippingLib=globalName;
    s.onload=()=>{const result=globalName==='jspdfAutoTableReady'?window.jspdf?.jsPDF.API.autoTable:window[globalName];result?resolve(result):reject(new Error(globalName+' did not load'))};
    s.onerror=()=>reject(new Error('Could not load '+globalName));document.head.appendChild(s);
  });
}
async function shippingOcrImage(source,label='photo'){
  shippingScanMessage('Reading '+label+'… 0%',true);
  const T=await shippingLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
  const result=await T.recognize(source,'eng',{logger:m=>{
    if(m.status==='recognizing text')shippingScanMessage('Reading '+label+'… '+Math.round((m.progress||0)*100)+'%',true);
    else if(m.status)shippingScanMessage(m.status.replace(/\b\w/g,c=>c.toUpperCase())+'…',true);
  }});
  return result?.data?.text||'';
}
async function shippingExtractPdf(file){
  shippingScanMessage('Opening PDF…',true);
  const pdfjs=await shippingLoadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;const pages=Math.min(doc.numPages,8);let out='';
  for(let i=1;i<=pages;i++){shippingScanMessage('Reading PDF page '+i+' of '+pages+'…',true);const page=await doc.getPage(i),tc=await page.getTextContent();out+=(tc.items||[]).map(x=>x.str).join(' ')+'\n'}
  if(out.replace(/\s/g,'').length>=80)return out;
  out='';
  for(let i=1;i<=pages;i++){
    shippingScanMessage('Scanning PDF image page '+i+' of '+pages+'…',true);
    const page=await doc.getPage(i),viewport=page.getViewport({scale:1.7});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;out+=await shippingOcrImage(canvas,'PDF page '+i)+'\n';
  }
  return out;
}
async function shippingReadSelectedFile(file,kind){
  if(!file)return;shippingSourceKind=kind;shippingSourceFilename=file.name||'';
  try{
    let text='';if(file.type.startsWith('image/'))text=await shippingOcrImage(file,kind==='camera'?'photo':'image');
    else if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))text=await shippingExtractPdf(file);else text=await file.text();
    $('shippingSlipText').value=text.trim();shippingScanMessage('File read. Building shipment details…',true);await shippingProcessSlip();
  }catch(e){console.error(e);shippingScanMessage('Could not read this file: '+(e.message||String(e)))}
}
function shippingResetEditor(){
  shippingCurrentId=null;shippingCurrentStatus='DRAFT';shippingDraftLines=[];shippingDraftPlan=null;shippingSourceKind='manual';shippingSourceFilename='';
  $('shippingEditorTitle').textContent='New Shipment';$('shippingEditorStatus').textContent='DRAFT';
  $('shippingSlipText').value='';$('shippingNumber').value='';$('shippingCustomer').value='';$('shippingPo').value='';$('shippingSalesperson').value='';$('shippingNotes').value='';
  $('shippingReviewSection').style.display='none';$('shippingPalletPlan').innerHTML='';$('shippingLines').innerHTML='';
  shippingScanMessage('Ready for a packing slip.');shippingEditorMessage('');shippingUpdateEditorMode();
}
function shippingUpdateEditorMode(){
  const locked=shippingCurrentStatus==='SHIPPED'||shippingCurrentStatus==='CANCELED';
  $('shippingEditorStatus').textContent=shippingCurrentStatus;$('shippingEditorStatus').className='shipstatus '+shippingStatusClass(shippingCurrentStatus);
  const capture=$('shippingCaptureSection');if(capture)capture.classList.toggle('locked',locked);
  ['shippingSlipText','shippingNumber','shippingCustomer','shippingPo','shippingSalesperson','shippingNotes'].forEach(id=>{if($(id))$(id).disabled=locked});
  document.querySelectorAll('#shippingLines input,#shippingLines select,#shippingLines button').forEach(el=>el.disabled=locked);
  ['shippingCameraBtn','shippingUploadBtn','shippingProcessTextBtn','shippingAddLineBtn','shippingRebuildBtn','shippingSaveDraftBtn','shippingSaveReadyBtn'].forEach(id=>{if($(id))$(id).style.display=locked?'none':''});
  $('shippingMarkShippedBtn').style.display=shippingCurrentStatus==='READY'?'':'none';
  $('shippingCancelShipmentBtn').style.display=shippingCurrentId&&shippingCurrentStatus!=='SHIPPED'&&shippingCurrentStatus!=='CANCELED'?'':'none';
}
function openNewShipment(){if(!canUseShipping())return;loadInventoryStock().catch(()=>{});shippingResetEditor();showModal('shippingEditorModal')}
async function shippingSave(status){
  if(!canUseShipping()||shippingCurrentStatus==='SHIPPED'||shippingCurrentStatus==='CANCELED')return false;
  const plan=await shippingBuildPlan();if(!plan?.ok)return false;shippingDraftLines=shippingCollectLines();
  if(shippingDraftLines.some(l=>!l.inventory_product)){shippingEditorMessage('Choose an Inventory Product for every shipment line before saving.',true);return false}
  const header={shipment_number:$('shippingNumber').value.trim(),packing_slip:$('shippingNumber').value.trim(),customer:$('shippingCustomer').value.trim(),po:$('shippingPo').value.trim(),salesperson_name:$('shippingSalesperson').value.trim(),salesperson_email:'',source_kind:shippingSourceKind,source_filename:shippingSourceFilename,slip_text:$('shippingSlipText').value||'',batch_codes:[...new Set(shippingDraftLines.map(x=>x.batch).filter(Boolean))],status,notes:$('shippingNotes').value.trim()};
  const btn=status==='READY'?$('shippingSaveReadyBtn'):$('shippingSaveDraftBtn');btn.disabled=true;shippingEditorMessage(status==='READY'?'Saving Ready shipment…':'Saving Draft…');
  try{
    const {data,error}=await db.rpc('save_shipping_shipment',{p_shipment_id:shippingCurrentId,p_header:header,p_lines:shippingDraftLines,p_plan:plan,p_totals:plan.totals||{}});
    if(error)throw error;shippingCurrentId=data;shippingCurrentStatus=status;
    shippingEditorMessage(status==='READY'?'Shipment is READY. Mark Shipped only after it actually leaves the factory.':'Draft saved.');
    shippingUpdateEditorMode();await loadShippingShipments();return true;
  }catch(e){shippingEditorMessage(e.message||String(e),true);return false}finally{btn.disabled=false}
}
async function loadShippingShipments(){
  if(!canUseShipping())return;
  const {data,error}=await db.from('shipping_shipments').select('*').order('created_at',{ascending:false}).limit(300);
  if(error)throw error;shippingShipments=data||[];renderShippingList();
}
function shippingDisplayDate(s){const d=s.shipped_date||String(s.created_at||'').slice(0,10);return d?usDate(d):''}
function renderShippingList(){
  const host=$('shippingList');if(!host)return;const q=($('shippingSearch')?.value||'').trim().toLowerCase();const today=iso(new Date());
  const visible=shippingShipments.filter(s=>(shippingFilter==='all'||s.status===shippingFilter)&&(!q||[s.shipment_number,s.packing_slip,s.customer,s.po].some(v=>String(v||'').toLowerCase().includes(q))));
  $('shippingDraftCount').textContent=shippingShipments.filter(x=>x.status==='DRAFT').length;$('shippingReadyCount').textContent=shippingShipments.filter(x=>x.status==='READY').length;
  $('shippingShippedCount').textContent=shippingShipments.filter(x=>x.status==='SHIPPED').length;$('shippingTodayCount').textContent=shippingShipments.filter(x=>x.status==='SHIPPED'&&x.shipped_date===today).length;
  if(!visible.length){host.innerHTML='<div class="analytics-empty">No shipments in this view.</div>';return}
  host.innerHTML=visible.map(s=>{
    const pallets=Number(s.totals?.pallets||0),weight=Number(s.totals?.grossLb||0);
    return '<article class="shipmentcard" data-open-shipment="'+s.id+'"><div class="shipmentmain"><span class="shipstatus '+shippingStatusClass(s.status)+'">'+esc(s.status)+'</span><h3>'+esc(s.shipment_number||s.packing_slip||'Shipment')+'</h3><p>'+esc(s.customer||'No customer')+(s.po?' • PO '+esc(s.po):'')+'</p></div>'+
      '<div class="shipmentmetrics"><div><span>Pallets</span><b>'+pallets+'</b></div><div><span>Weight</span><b>'+weight.toLocaleString(locale())+' lb</b></div><div><span>'+esc(s.status==='SHIPPED'?'Shipped':'Created')+'</span><b>'+esc(shippingDisplayDate(s))+'</b></div></div>'+
      '<div class="shipmentactions">'+(s.status==='READY'?'<button type="button" class="shipbutton" data-ship-now="'+s.id+'">✓ Mark Shipped</button>':'')+'<button type="button" data-edit-shipment="'+s.id+'">'+(s.status==='SHIPPED'?'View':'Open')+'</button></div></article>';
  }).join('');
  document.querySelectorAll('[data-edit-shipment]').forEach(b=>b.onclick=e=>{e.stopPropagation();openShippingShipment(b.dataset.editShipment)});
  document.querySelectorAll('[data-ship-now]').forEach(b=>b.onclick=e=>{e.stopPropagation();shippingMarkShipped(b.dataset.shipNow)});
  document.querySelectorAll('[data-open-shipment]').forEach(c=>c.onclick=()=>openShippingShipment(c.dataset.openShipment));
}
async function openShippingShipment(id){
  if(!canUseShipping())return;const s=shippingShipments.find(x=>x.id===id);if(!s)return;
  const {data:lines,error}=await db.from('shipping_lines').select('*').eq('shipment_id',id).order('line_order');if(error){toast(error.message);return}
  shippingCurrentId=id;shippingCurrentStatus=s.status;shippingSourceKind=s.source_kind||'manual';shippingSourceFilename=s.source_filename||'';
  $('shippingEditorTitle').textContent=(s.status==='SHIPPED'?'Shipped ':'')+(s.shipment_number||'Shipment');$('shippingSlipText').value=s.slip_text||'';
  $('shippingNumber').value=s.shipment_number||s.packing_slip||'';$('shippingCustomer').value=s.customer||'';$('shippingPo').value=s.po||'';
  $('shippingSalesperson').value=s.salesperson_name||s.salesperson_email||'';$('shippingNotes').value=s.notes||'';
  shippingDraftLines=(lines||[]).map(l=>({sku:l.sku||'',description:l.description||'',size:l.size,qty:Number(l.qty),inventory_product:l.inventory_product||'',batch:l.batch||'',source:l.source||''}));
  shippingDraftPlan=s.pallet_plan&&Object.keys(s.pallet_plan).length?s.pallet_plan:null;shippingRenderLines();shippingRenderPlan(shippingDraftPlan);
  $('shippingReviewSection').style.display='';shippingScanMessage(s.source_filename?'Source: '+s.source_filename:'Saved shipment');
  shippingEditorMessage(s.status==='SHIPPED'?'Inventory was deducted when this shipment was marked shipped.':'');shippingUpdateEditorMode();showModal('shippingEditorModal');
}
async function shippingMarkShipped(id=shippingCurrentId){
  if(!canUseShipping()||!id)return;const s=shippingShipments.find(x=>x.id===id);if(s&&s.status!=='READY'){toast('Save the shipment as Ready first.');return}
  if(!confirm('Mark this shipment SHIPPED? GameTime will subtract every shipment line from factory inventory.'))return;
  try{
    const {data,error}=await db.rpc('mark_shipping_shipped',{p_shipment_id:id,p_ship_date:iso(new Date())});if(error)throw error;
    await Promise.all([loadShippingShipments(),loadInventoryStock().catch(()=>{})]);
    if(shippingCurrentId===id){shippingCurrentStatus='SHIPPED';shippingUpdateEditorMode();shippingEditorMessage(data?.duplicate?'This shipment was already deducted. No inventory was deducted twice.':'Shipment marked SHIPPED. Inventory updated.')}
    toast(data?.duplicate?'Already shipped — no duplicate deduction.':'Shipment shipped — inventory updated.');
  }catch(e){shippingEditorMessage(e.message||String(e),true);toast(e.message||String(e))}
}
async function shippingCancelCurrent(){
  if(!shippingCurrentId||shippingCurrentStatus==='SHIPPED'||shippingCurrentStatus==='CANCELED')return;if(!confirm('Cancel this shipment? It will not subtract inventory.'))return;
  try{const {error}=await db.rpc('cancel_shipping_shipment',{p_shipment_id:shippingCurrentId});if(error)throw error;shippingCurrentStatus='CANCELED';shippingUpdateEditorMode();await loadShippingShipments();shippingEditorMessage('Shipment canceled.')}
  catch(e){shippingEditorMessage(e.message||String(e),true)}
}
function openShippingWorkspace(){
  if(!canUseShipping())return;loadInventoryStock().catch(()=>{});showModal('shippingWorkspaceModal');loadShippingShipments().catch(e=>{console.error(e);$('shippingList').innerHTML='<div class="analytics-empty">Could not load shipping.</div>'});
}

function scheduleShippingRefresh(){
  clearTimeout(shippingRefreshTimer);
  shippingRefreshTimer=setTimeout(()=>refreshShippingData().catch(e=>{console.error(e);setSync('offline','RETRYING')}),150);
}
async function refreshShippingData(){
  if(!canUseShipping()||shippingRefreshBusy)return;
  shippingRefreshBusy=true;
  try{
    if($('shippingWorkspaceModal').classList.contains('show')||$('shippingEditorModal').classList.contains('show'))await loadShippingShipments();
    if($('inventoryModal').classList.contains('show')||$('shippingEditorModal').classList.contains('show'))await loadInventoryStock(true);
    const current=shippingShipments.find(s=>s.id===shippingCurrentId);
    if(current&&current.status!==shippingCurrentStatus&&['SHIPPED','CANCELED'].includes(current.status)){
      shippingCurrentStatus=current.status;shippingUpdateEditorMode();
      shippingEditorMessage('Updated on another device: '+current.status+'.');
    }
  }finally{shippingRefreshBusy=false}
}
async function shippingDownloadPdf(){
  if(!canUseShipping())return;
  const btn=$('shippingPdfBtn');btn.disabled=true;
  try{
    const plan=['SHIPPED','CANCELED'].includes(shippingCurrentStatus)?shippingDraftPlan:await shippingBuildPlan();
    if(!plan?.ok)throw new Error('Build and review the pallet plan first.');
    const lib=await shippingLoadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','jspdf');
    await shippingLoadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js','jspdfAutoTableReady');
    const {createShippingPdf}=await import('./shipping-pdf.mjs?v='+BUILD);
    const doc=createShippingPdf(lib.jsPDF,{
      number:$('shippingNumber').value.trim(),customer:$('shippingCustomer').value.trim(),
      po:$('shippingPo').value.trim(),status:shippingCurrentStatus,notes:$('shippingNotes').value.trim(),
      plan,lines:shippingDraftLines
    });
    const name=($('shippingNumber').value.trim()||'shipment').replace(/[^a-z0-9_-]/gi,'_');
    doc.save('GameTime-Shipping-'+name+'.pdf');shippingEditorMessage('PDF downloaded. Open it to print.');
  }catch(e){shippingEditorMessage(e.message||String(e),true)}finally{btn.disabled=false}
}
function inventoryPackageLabel(type){
  return {
    five_gallon_pail:'5 Gallon Pail',gallon:'1 Gallon',quart_can:'Quart Can',pint_can:'Pint Can',
    jerry_1_25:'Jerry 1.25G',gallon_1_5:'1.5 Gallon',vinyl_box:'Vinyl Box',drawdown_box:'Drawdown Box',box:'Box',unit:'Unit'
  }[type]||type||'Unit';
}
function inventoryPackageShort(type){
  return {five_gallon_pail:'5G',gallon:'1G',quart_can:'Q',pint_can:'Pint',jerry_1_25:'Jerry',gallon_1_5:'1.5G',vinyl_box:'Vinyl Box',drawdown_box:'Drawdown Box',box:'Box',unit:'Unit'}[type]||type;
}
function inventoryNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function populateInventoryProducts(){
  const names=new Map();
  for(const o of orders){if(o.product)names.set(o.product.trim().toLowerCase(),o.product.trim())}
  for(const r of inventoryStockRows){if(r.product)names.set(String(r.product).trim().toLowerCase(),String(r.product).trim())}
  const list=$('inventoryProductList');if(list)list.innerHTML=[...names.values()].sort((a,b)=>a.localeCompare(b)).map(x=>'<option value="'+esc(x)+'"></option>').join('');
}
function renderInventoryStock(){
  const body=$('inventoryBody');if(!body)return;
  const q=($('inventorySearch')?.value||'').trim().toLowerCase();
  const rows=inventoryStockRows.filter(r=>!q||String(r.product||'').toLowerCase().includes(q));
  const grouped=new Map();
  for(const r of rows){
    const key=r.product_key||String(r.product||'').toLowerCase();
    if(!grouped.has(key))grouped.set(key,{product:r.product||key,items:[],gallons:0});
    const g=grouped.get(key);g.items.push(r);g.gallons+=inventoryNum(r.stock_gallons);
  }
  const products=[...grouped.values()].sort((a,b)=>b.gallons-a.gallons||a.product.localeCompare(b.product));
  if(!products.length){
    body.innerHTML='<div class="analytics-empty"><b>No inventory balance yet.</b><br><small>Use Set Current Stock to enter today’s physical stock. After that, Production and Shipping update it automatically.</small></div>';
    return;
  }
  const allItems=products.flatMap(x=>x.items),negative=allItems.filter(x=>inventoryNum(x.stock_units)<0).length;
  const totalGallons=products.reduce((s,x)=>s+x.gallons,0);
  body.innerHTML=
    '<div class="analytics-summary">'+
      '<div><span>Products</span><b>'+products.length+'</b></div>'+
      '<div><span>Paint Equivalent</span><b>'+totalGallons.toLocaleString(locale(),{maximumFractionDigits:2})+' gal</b></div>'+
      '<div><span>Below Zero</span><b>'+negative+'</b></div>'+
    '</div>'+
    (negative?'<div class="inventorywarning">Some stock is below zero. Set the physical current stock for those products before relying on the balance.</div>':'')+
    '<div class="inventorycards">'+products.map(g=>{
      const items=g.items.slice().sort((a,b)=>inventoryPackageLabel(a.package_type).localeCompare(inventoryPackageLabel(b.package_type)));
      return '<section class="inventorycard"><div class="inventorycardhead"><div><b>'+esc(g.product)+'</b><small>'+(g.gallons?g.gallons.toLocaleString(locale(),{maximumFractionDigits:2})+' gal equivalent':'Non-paint / unit inventory')+'</small></div></div>'+
        '<div class="stockpackages">'+items.map((r,i)=>{
          const units=inventoryNum(r.stock_units),bad=units<0?' negative':'';
          return '<div class="stockpackage'+bad+'"><span>'+esc(inventoryPackageShort(r.package_type))+'</span><b>'+units.toLocaleString(locale(),{maximumFractionDigits:2})+'</b><small>Remaining</small><small>Produced: '+inventoryNum(r.produced_units).toLocaleString(locale())+'<br>Shipped: '+inventoryNum(r.shipped_units).toLocaleString(locale())+'<br>Stock adjustments: '+inventoryNum(r.adjustment_units).toLocaleString(locale())+'</small>'+
            (isManager?'<button type="button" data-stock-row="'+inventoryStockRows.indexOf(r)+'">Set</button>':'')+'</div>';
        }).join('')+'</div></section>';
    }).join('')+'</div>';
  document.querySelectorAll('[data-stock-row]').forEach(b=>b.onclick=()=>{
    const r=inventoryStockRows[Number(b.dataset.stockRow)];if(r)openInventorySet(r);
  });
}
async function loadInventoryStock(quiet=false){
  if(!canViewInventory())return;
  const body=$('inventoryBody');if(body&&!quiet)body.innerHTML='<div class="analytics-empty">Loading factory inventory…</div>';
  const {data,error}=await db.from('inventory_current_stock').select('*').order('product');
  if(error){if(body)body.innerHTML='<div class="analytics-empty">Could not load inventory.</div>';throw error}
  inventoryStockRows=data||[];
  populateInventoryProducts();renderInventoryStock();
}
function openInventory(){
  if(!canViewInventory())return;
  if($('setInventoryBtn'))$('setInventoryBtn').style.display=isManager?'':'none';
  showModal('inventoryModal');loadInventoryStock().catch(console.error);
}
function openInventorySet(row=null){
  if(!isManager)return;
  populateInventoryProducts();
  $('inventorySetProduct').value=row?.product||'';
  $('inventorySetPackage').value=row?.package_type||'five_gallon_pail';
  $('inventorySetQty').value=row?String(inventoryNum(row.stock_units)):'';
  $('inventorySetDate').value=iso(new Date());
  $('inventorySetNote').value=row?'Cycle count / stock correction':'Opening stock count';
  const m=$('inventorySetMessage');if(m){m.textContent='';m.className='authmessage'}
  showModal('inventorySetModal');
}
async function saveInventorySet(){
  if(!isManager)return;
  const product=$('inventorySetProduct').value.trim().replace(/\s+/g,' ');
  const package_type=$('inventorySetPackage').value;
  const raw=$('inventorySetQty').value.trim(),target_units=Number(raw);
  const event_date=$('inventorySetDate').value,note=$('inventorySetNote').value.trim();
  const msg=$('inventorySetMessage');
  const say=(x,bad=false)=>{msg.textContent=x;msg.className='authmessage'+(bad?' bad':' good')};
  if(!product||raw===''||!Number.isFinite(target_units)||target_units<0||!event_date){say('Enter product, package, current quantity, and date.',true);return}
  $('saveInventorySetBtn').disabled=true;say('Saving current stock…');
  try{
    const {data,error}=await db.functions.invoke('inventory-set-stock',{body:{product,package_type,target_units,event_date,note}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Could not save stock');
    say(data?.no_change?'Stock already matches this quantity.':'Current stock saved.');
    await loadInventoryStock();
    setTimeout(()=>hideModal('inventorySetModal'),300);
  }catch(e){say(e.message||String(e),true)}
  finally{$('saveInventorySetBtn').disabled=false}
}
function shippingGroupRows(rows){
  const map=new Map();
  for(const r of rows){
    const key=r.product_key||String(r.product||'').toLowerCase();
    if(!map.has(key))map.set(key,{product:r.product||key,items:[],gallons:0});
    const g=map.get(key);g.items.push(r);g.gallons+=inventoryNum(r.shipped_gallons);
  }
  return [...map.values()].sort((a,b)=>b.gallons-a.gallons||a.product.localeCompare(b.product));
}
function renderShippingSection(groups,title,paint=true){
  if(!groups.length)return '';
  const max=Math.max(...groups.map(g=>paint?Math.max(g.gallons,0):g.items.reduce((s,r)=>s+Math.max(inventoryNum(r.shipped_units),0),0)),1);
  return '<div class="shippingsection"><h3>'+esc(title)+'</h3><div class="analytics-chart">'+groups.map((g,i)=>{
    const metric=paint?g.gallons:g.items.reduce((s,r)=>s+inventoryNum(r.shipped_units),0);
    const bar=Math.max(0,100*metric/max);
    const packages=g.items.map(r=>inventoryPackageShort(r.package_type)+' '+inventoryNum(r.shipped_units).toLocaleString(locale(),{maximumFractionDigits:2})).join(' • ');
    return '<div class="analytics-row shippingrow"><div class="analytics-rank">'+(i+1)+'</div><div class="analytics-product"><b>'+esc(g.product)+'</b><small>'+esc(packages)+'</small></div>'+
      '<div class="analytics-barwrap"><div class="analytics-bar" style="width:'+bar.toFixed(2)+'%"></div></div>'+
      '<div class="analytics-values"><b>'+(paint?metric.toLocaleString(locale(),{maximumFractionDigits:2})+' gal':metric.toLocaleString(locale(),{maximumFractionDigits:2})+' units')+'</b><small>shipped</small></div></div>';
  }).join('')+'</div></div>';
}
async function loadShippingAnalytics(){
  if(!canViewInventory())return;
  const month=$('shippingAnalyticsMonth').value,bounds=monthBounds(month),body=$('shippingAnalyticsBody');if(!bounds)return;
  body.innerHTML='<div class="analytics-empty">Loading shipping…</div>';
  try{
    const [lineRes,eventRes]=await Promise.all([
      db.from('inventory_shipping_monthly').select('*').eq('month',bounds.start),
      db.from('inventory_events').select('event_id',{count:'exact',head:true}).in('event_type',['SHIPPED','SHIPPING_CORRECTION']).gte('event_date',bounds.start).lt('event_date',bounds.next)
    ]);
    if(lineRes.error)throw lineRes.error;if(eventRes.error)throw eventRes.error;
    const rows=lineRes.data||[],groups=shippingGroupRows(rows);
    const paint=groups.filter(g=>g.gallons!==0),other=groups.filter(g=>g.gallons===0);
    const totalGallons=paint.reduce((s,g)=>s+g.gallons,0);
    if(!groups.length){body.innerHTML='<div class="analytics-empty"><b>No Mark shipped events for this month.</b><br><small>Old packing slips are intentionally not guessed as shipments.</small></div>';return}
    body.innerHTML=
      '<div class="analytics-summary">'+
        '<div><span>Shipment Events</span><b>'+(eventRes.count||0)+'</b></div>'+
        '<div><span>Products</span><b>'+groups.length+'</b></div>'+
        '<div><span>Paint Shipped</span><b>'+totalGallons.toLocaleString(locale(),{maximumFractionDigits:2})+' gal</b></div>'+
      '</div>'+
      renderShippingSection(paint,'Paint / Finish Shipments',true)+
      renderShippingSection(other,'Other Shipments',false);
  }catch(e){console.error(e);body.innerHTML='<div class="analytics-empty">Could not load shipping chart.</div>'}
}
function openShippingAnalytics(){
  if(!canViewInventory())return;
  $('shippingAnalyticsMonth').value=iso(selected).slice(0,7);
  showModal('shippingAnalyticsModal');loadShippingAnalytics();
}

async function loadMonthlyAnalytics(){
  if(!isManager)return;
  const monthValue=$('analyticsMonth').value,bounds=monthBounds(monthValue);if(!bounds)return;
  const body=$('analyticsBody');body.innerHTML='<div class="analytics-empty">'+esc(t('chartLoading'))+'</div>';
  try{
    const {data:progress,error}=await db.from('work_order_daily_progress')
      .select('order_id,work_date,product,actual_quart,actual_gallon,actual_five,actual_jerry')
      .gte('work_date',bounds.start).lt('work_date',bounds.next);
    if(error)throw error;

    const grouped=new Map();
    for(const r of progress||[]){
      addAnalyticsRow(grouped,r.product,actualGallons(r.actual_quart,r.actual_gallon,r.actual_five,r.actual_jerry),r.order_id)
    }

    for(const o of orders){
      if(o.holdLine||!o.prodDate||o.prodDate<bounds.start||o.prodDate>=bounds.next)continue;
      const hasActual=[o.actualQuart,o.actualGallon,o.actualFive,o.actualJerry].some(v=>v!=null);
      let gal=0;
      if(hasActual)gal=actualGallons(o.actualQuart,o.actualGallon,o.actualFive,o.actualJerry);
      else if(o.prodStatus==='done')gal=Number(o.tank)||0;
      addAnalyticsRow(grouped,o.product,gal,o.id)
    }

    const rows=[...grouped.values()].sort((a,b)=>b.gallons-a.gallons||a.product.localeCompare(b.product));
    const total=rows.reduce((s,r)=>s+r.gallons,0);
    const batchIds=new Set();rows.forEach(r=>r.batches.forEach(id=>batchIds.add(id)));
    if(!rows.length||total<=0){body.innerHTML='<div class="analytics-empty">'+esc(t('chartNoData'))+'</div>';return}

    const max=Math.max(...rows.map(r=>r.gallons),1);
    body.innerHTML=
      '<div class="analytics-summary">'+
        '<div><span>'+esc(t('totalGallons'))+'</span><b>'+total.toLocaleString(locale(),{maximumFractionDigits:2})+'</b></div>'+
        '<div><span>'+esc(t('products'))+'</span><b>'+rows.length+'</b></div>'+
        '<div><span>'+esc(t('batches'))+'</span><b>'+batchIds.size+'</b></div>'+
      '</div>'+
      '<div class="analytics-chart">'+rows.map((r,i)=>{
        const pct=total?100*r.gallons/total:0,bar=100*r.gallons/max;
        const ratio=rows.length<=1?0:i/(rows.length-1);
        const level=ratio<0.34?'green':ratio<0.67?'orange':'red';
        return '<div class="analytics-row analytics-level-'+level+'">'+
          '<div class="analytics-rank">'+(i+1)+'</div>'+
          '<div class="analytics-product"><b>'+esc(r.product)+'</b><small>'+r.batches.size+' '+esc(t('batches'))+'</small></div>'+
          '<div class="analytics-barwrap"><div class="analytics-bar" style="width:'+bar.toFixed(2)+'%"></div></div>'+
          '<div class="analytics-values"><b>'+r.gallons.toLocaleString(locale(),{maximumFractionDigits:2})+' '+esc(t('gallons'))+'</b><strong>'+pct.toFixed(1)+'%</strong><small>'+esc(t('ofMonth'))+'</small></div>'+
        '</div>'
      }).join('')+'</div>'+
      '<div class="analytics-table"><table><thead><tr><th>#</th><th>'+esc(t('products'))+'</th><th>'+esc(t('totalGallons'))+'</th><th>'+esc(t('batches'))+'</th><th>%</th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.product)+'</td><td>'+r.gallons.toLocaleString(locale(),{maximumFractionDigits:2})+'</td><td>'+r.batches.size+'</td><td>'+((100*r.gallons/total).toFixed(1))+'%</td></tr>').join('')+
      '</tbody></table></div>';
  }catch(e){
    console.error(e);body.innerHTML='<div class="analytics-empty">'+esc(lang==='es'?'No se pudo cargar la gráfica.':'Could not load the chart.')+'</div>'
  }
}
function openMonthlyAnalytics(){
  if(!isManager)return;
  const base=iso(selected).slice(0,7);
  $('analyticsMonth').value=base;
  showModal('analyticsModal');
  loadMonthlyAnalytics()
}

function printSheet(mode){
  const batch=currentDay('batch').slice().sort((a,b)=>a.batchOrder-b.batchOrder);
  const prod=currentDay('prod').slice().sort((a,b)=>a.prodOrder-b.prodOrder);
  const showBatch=mode!=='prod',showProd=mode!=='batch';
  const bCount=showBatch?batch.length:0,pCount=showProd?prod.length:0;

  function cardCols(count,singleDept){
    if(count<=5)return 1;
    if(count<=10)return 2;
    if(singleDept&&count<=15)return 3;
    return 2;
  }
  const singleDept=!(showBatch&&showProd);
  const bCols=showBatch?cardCols(bCount,singleDept):1;
  const pCols=showProd?cardCols(pCount,singleDept):1;
  const maxRows=Math.max(
    showBatch?Math.ceil(Math.max(bCount,1)/bCols):0,
    showProd?Math.ceil(Math.max(pCount,1)/pCols):0
  );
  const density=maxRows<=4?'normal':maxRows<=5?'compact':maxRows<=6?'dense':'micro';

  function printCard(o,dept,i){
    const bn=dept==='prod'?prodBatch(o.batch):o.batch;
    const note=dept==='prod'?o.prodNote:o.batchNote;
    const st=statusText(dept==='batch'?o.batchStatus:o.prodStatus).replace(/[✓●○]/g,'').trim();
    return '<article class="ps-card">'+
      '<div class="ps-top"><div class="ps-main"><small>'+esc(dept==='prod'?t('productionRole'):t('batchMakerRole'))+' #'+(i+1)+'</small><h3>'+esc(o.product)+(dept==='prod'&&o.catalyst?' <span class="ps-catalyst">'+esc(t('catalystBadge'))+'</span>':'')+'</h3>'+
      (bn?'<span class="ps-batch">'+esc(t('batchNumber'))+' '+esc(bn)+'</span>':'')+
      '</div><div class="ps-tank"><b>'+esc(o.tank||'—')+'</b><span>'+esc(t('tankGal'))+'</span></div></div>'+
      (dept==='prod'
        ?'<div class="ps-pkgs '+(o.jerryEnabled?'four':'three')+'">'+
          '<div><b>'+esc(o.quart)+'</b><small>'+esc(t('quarts'))+'</small></div>'+
          '<div><b>'+esc(o.gallon)+'</b><small>'+esc(t('oneGallon'))+'</small></div>'+
          '<div><b>'+esc(o.five)+'</b><small>'+esc(t('fiveGallon'))+'</small></div>'+
          (o.jerryEnabled?'<div><b>'+esc(o.jerry)+'</b><small>'+esc(t('jerryCan'))+'</small></div>':'')+
          '</div>'
        :'')+
      '<div class="ps-note">'+esc(note||(dept==='batch'?t('prepareBatch'):''))+'</div>'+
      '<div class="ps-bottom"><span>'+((dept==='batch'?o.batchChecked:o.prodChecked)?'✓':'□')+' '+esc(t('precheck'))+'</span><b>'+esc(st)+'</b></div>'+
      (dept==='prod'&&o.batchMadeDate?'<div class="ps-made-bottom">'+esc(t('batchMadeOn'))+' '+esc(usDate(o.batchMadeDate))+'</div>':'')+
      '</article>'
  }

  function section(title,list,dept,cols){
    return '<section class="ps-section"><div class="ps-section-title">'+esc(title)+' <span>'+list.length+' '+esc(list.length===1?t('task'):t('taskPlural'))+'</span></div>'+
      '<div class="ps-cards" style="--ps-cols:'+cols+'">'+
      (list.length?list.map((o,i)=>printCard(o,dept,i)).join(''):'<div class="ps-empty">'+esc(t('noWorkScheduled'))+'</div>')+
      '</div></section>'
  }

  const stage=$('printStage');
  stage.className='print-stage ps-'+density+' '+(singleDept?'ps-single':'ps-all');
  stage.innerHTML=
    '<div class="ps-sheet">'+
      '<header class="ps-head"><div><h1>'+esc(t('factorySheet'))+'</h1><p>'+esc(pretty())+'</p></div><strong>'+
      esc(mode==='all'?t('allWork'):mode==='prod'?t('productionFilling'):t('batchMaker'))+
      '</strong></header>'+
      '<div class="ps-layout">'+
        (showBatch?section(t('batchMaker'),batch,'batch',bCols):'')+
        (showProd?section(t('productionFilling'),prod,'prod',pCols):'')+
      '</div>'+
    '</div>';

  document.body.classList.add('printing');
  void stage.offsetHeight;
  try{
    window.print();
  }catch(e){
    console.error(e);
    toast(t('printError'))
  }
}
function showModal(id){$(id).classList.add('show')}function hideModal(id){$(id).classList.remove('show')}
function fail(e){console.error(e);setSync('offline','RETRYING');toast('Could not save. Nothing was deleted — retrying sync.')}

function openIdentity(){
  $('deviceNameInput').value=deviceName;
  $('identityModal').classList.add('show');
  setTimeout(()=>$('deviceNameInput').focus(),50);
}
function saveIdentity(){
  const name=$('deviceNameInput').value.trim();
  if(!name){toast(t('yourName'));return}
  deviceName=name;localStorage.setItem(NAME_KEY,name);refreshUserLabel();hideModal('identityModal');toast((lang==='es'?'Este dispositivo ahora está identificado como ':'This device is now identified as ')+name)
}
function ensureIdentity(){refreshUserLabel();if(!deviceName)openIdentity()}

function tick(){$('clock').textContent=new Date().toLocaleTimeString(locale(),{hour:'numeric',minute:'2-digit'})}

if($('langToggle'))$('langToggle').onclick=()=>setLanguage(lang==='en'?'es':'en');
function setShellNavActive(id){
  document.querySelectorAll('.sidenav button').forEach(b=>b.classList.remove('active'));
  const el=$(id);if(el)el.classList.add('active');
}
function closeSidebarSubmenus(exceptMenu=''){
  [['printMenu','printBtn'],['holdMenu','holdLineBtn'],['settingsMenu','settingsBtn']].forEach(([menuId,btnId])=>{
    if(menuId===exceptMenu)return;
    $(menuId)?.classList.remove('show');$(btnId)?.setAttribute('aria-expanded','false');
  });
}
function toggleSidebarSubmenu(menuId,btnId){
  const menu=$(menuId);if(!menu)return false;
  const willOpen=!menu.classList.contains('show');
  closeSidebarSubmenus(menuId);
  menu.classList.toggle('show',willOpen);
  $(btnId)?.setAttribute('aria-expanded',willOpen?'true':'false');
  return willOpen;
}
function openMobileSidebar(){
  if(!window.matchMedia('(max-width:700px)').matches)return;
  $('mainSidebar')?.classList.add('open');
  $('mobileSidebarBackdrop')?.classList.add('show');
  document.body.classList.add('mobile-nav-open');
  $('mobileMenuBtn')?.setAttribute('aria-expanded','true');
}
function closeMobileSidebar(){
  $('mainSidebar')?.classList.remove('open');
  $('mobileSidebarBackdrop')?.classList.remove('show');
  document.body.classList.remove('mobile-nav-open');
  $('mobileMenuBtn')?.setAttribute('aria-expanded','false');
}
if($('mobileMenuBtn'))$('mobileMenuBtn').onclick=openMobileSidebar;
if($('sidebarCloseBtn'))$('sidebarCloseBtn').onclick=closeMobileSidebar;
if($('mobileSidebarBackdrop'))$('mobileSidebarBackdrop').onclick=closeMobileSidebar;
if($('overviewNav'))$('overviewNav').onclick=()=>{setShellNavActive('overviewNav');$('overviewSection')?.scrollIntoView({behavior:'smooth',block:'start'})};
if($('scheduleNav'))$('scheduleNav').onclick=()=>{setShellNavActive('scheduleNav');$('scheduleSection')?.scrollIntoView({behavior:'smooth',block:'start'})};
$('prevBtn').onclick=()=>{selected=shiftWorkdayDate(selected,-1);render()};
$('nextBtn').onclick=()=>{selected=shiftWorkdayDate(selected,1);render()};
$('dateLabel').onclick=openMonth;
$('search').oninput=render;
$('addBtn').onclick=()=>openEditor(null,false);
if($('monthlyChartBtn'))$('monthlyChartBtn').onclick=()=>{setShellNavActive('monthlyChartBtn');openMonthlyAnalytics()};
if($('inventoryBtn'))$('inventoryBtn').onclick=()=>{setShellNavActive('inventoryBtn');openInventory()};
if($('shippingChartBtn'))$('shippingChartBtn').onclick=()=>{setShellNavActive('shippingChartBtn');openShippingAnalytics()};
if($('shippingWorkspaceBtn'))$('shippingWorkspaceBtn').onclick=()=>{setShellNavActive('shippingWorkspaceBtn');openShippingWorkspace()};
if($('newShipmentBtn'))$('newShipmentBtn').onclick=openNewShipment;
if($('shareShipping'))$('shareShipping').onclick=shareShipping;
if($('shippingPdfBtn'))$('shippingPdfBtn').onclick=shippingDownloadPdf;
if($('shippingCameraBtn'))$('shippingCameraBtn').onclick=()=>$('shippingCameraInput').click();
if($('shippingUploadBtn'))$('shippingUploadBtn').onclick=()=>$('shippingFileInput').click();
if($('shippingCameraInput'))$('shippingCameraInput').onchange=e=>{const f=e.target.files?.[0];if(f)shippingReadSelectedFile(f,'camera');e.target.value=''};
if($('shippingFileInput'))$('shippingFileInput').onchange=e=>{const f=e.target.files?.[0];if(f)shippingReadSelectedFile(f,'upload');e.target.value=''};
if($('shippingProcessTextBtn'))$('shippingProcessTextBtn').onclick=()=>{shippingSourceKind=shippingSourceKind==='manual'?'paste':shippingSourceKind;shippingProcessSlip()};
if($('shippingAddLineBtn'))$('shippingAddLineBtn').onclick=shippingAddLine;
if($('shippingRebuildBtn'))$('shippingRebuildBtn').onclick=shippingBuildPlan;
if($('shippingSaveDraftBtn'))$('shippingSaveDraftBtn').onclick=()=>shippingSave('DRAFT');
if($('shippingSaveReadyBtn'))$('shippingSaveReadyBtn').onclick=()=>shippingSave('READY');
if($('shippingMarkShippedBtn'))$('shippingMarkShippedBtn').onclick=async()=>{const ok=await shippingSave('READY');if(ok)await shippingMarkShipped(shippingCurrentId)};
if($('shippingCancelShipmentBtn'))$('shippingCancelShipmentBtn').onclick=shippingCancelCurrent;
if($('shippingSearch'))$('shippingSearch').oninput=renderShippingList;
document.querySelectorAll('[data-shipping-filter]').forEach(b=>b.onclick=()=>{shippingFilter=b.dataset.shippingFilter;document.querySelectorAll('[data-shipping-filter]').forEach(x=>x.classList.toggle('active',x===b));renderShippingList()});
if($('setInventoryBtn'))$('setInventoryBtn').onclick=()=>openInventorySet();
if($('saveInventorySetBtn'))$('saveInventorySetBtn').onclick=saveInventorySet;
if($('inventorySearch'))$('inventorySearch').oninput=renderInventoryStock;
if($('shippingAnalyticsLoadBtn'))$('shippingAnalyticsLoadBtn').onclick=loadShippingAnalytics;
if($('shippingAnalyticsMonth'))$('shippingAnalyticsMonth').onchange=loadShippingAnalytics;
if($('analyticsLoadBtn'))$('analyticsLoadBtn').onclick=loadMonthlyAnalytics;
if($('analyticsMonth'))$('analyticsMonth').onchange=loadMonthlyAnalytics;
if($('staffBtn'))$('staffBtn').onclick=()=>{if(!canManageStaff())return;setShellNavActive('staffBtn');openStaff()};
if($('settingsBtn'))$('settingsBtn').onclick=()=>{
  setShellNavActive('settingsBtn');toggleSidebarSubmenu('settingsMenu','settingsBtn');
};
document.querySelectorAll('[data-settings-option]').forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  const opt=b.dataset.settingsOption;
  $('settingsMenu')?.classList.remove('show');$('settingsBtn')?.setAttribute('aria-expanded','false');
  if(opt==='install')openInstallHelp(true);else openSettings(opt);
});
if($('changePasswordBtn'))$('changePasswordBtn').onclick=changeMyPassword;
document.querySelectorAll('[data-settings-tab]').forEach(b=>b.onclick=()=>switchSettingsTab(b.dataset.settingsTab));
if($('openInstallHelpBtn'))$('openInstallHelpBtn').onclick=()=>openInstallHelp(true);
if($('installHelpDoneBtn'))$('installHelpDoneBtn').onclick=finishInstallHelp;
if($('installAppBtn'))$('installAppBtn').onclick=promptInstallApp;
if($('createStaffBtn'))$('createStaffBtn').onclick=createStaff;
if($('createManagementBtn'))$('createManagementBtn').onclick=createManagementAccount;
if($('saveStaffEditBtn'))$('saveStaffEditBtn').onclick=saveStaffEdit;
$('printBtn').onclick=()=>{
  setShellNavActive('printBtn');toggleSidebarSubmenu('printMenu','printBtn');
};
document.querySelectorAll('[data-print-option]').forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  const mode=b.dataset.printOption;
  if(!isManager&&mode!==view)return;
  $('printMenu')?.classList.remove('show');$('printBtn')?.setAttribute('aria-expanded','false');
  printSheet(mode);
});
$('holdLineBtn').onclick=()=>{
  setShellNavActive('holdLineBtn');toggleSidebarSubmenu('holdMenu','holdLineBtn');
};
document.querySelectorAll('[data-hold-option]').forEach(b=>b.onclick=e=>{
  e.stopPropagation();
  const opt=b.dataset.holdOption;
  $('holdMenu')?.classList.remove('show');$('holdLineBtn')?.setAttribute('aria-expanded','false');
  if(opt==='add'){if(isManager)openEditor(null,true);return}
  openDrawer('holdline');
});
$('shareProd').onclick=()=>shareDept('prod');
$('shareBatch').onclick=()=>shareDept('batch');
$('currentUser').onclick=signOutSecure;

if($('authManagerTab'))$('authManagerTab').onclick=()=>switchAuthPane('manager');
if($('authEmployeeTab'))$('authEmployeeTab').onclick=()=>switchAuthPane('employee');
if($('showSetupBtn'))$('showSetupBtn').onclick=()=>switchAuthPane('setup');
if($('forgotPasswordBtn'))$('forgotPasswordBtn').onclick=()=>{if($('forgotEmail'))$('forgotEmail').value=$('loginEmail')?.value||'';switchAuthPane('forgot')};
if($('backFromForgotBtn'))$('backFromForgotBtn').onclick=()=>switchAuthPane('manager');
if($('sendResetBtn'))$('sendResetBtn').onclick=requestPasswordReset;
if($('saveRecoveryPasswordBtn'))$('saveRecoveryPasswordBtn').onclick=saveRecoveryPassword;
if($('backToLoginBtn'))$('backToLoginBtn').onclick=()=>switchAuthPane('manager');
if($('managerLoginBtn'))$('managerLoginBtn').onclick=managerLogin;
if($('employeeLoginBtn'))$('employeeLoginBtn').onclick=employeeLogin;
if($('createManagerBtn'))$('createManagerBtn').onclick=createFirstManager;
if($('loginPassword'))$('loginPassword').onkeydown=e=>{if(e.key==='Enter')managerLogin()};
if($('employeePinLogin'))$('employeePinLogin').onkeydown=e=>{if(e.key==='Enter')employeeLogin()};

function openFullDatePicker(input){
  if(!input||input.disabled||input.readOnly)return;
  try{
    input.focus({preventScroll:true});
    if(typeof input.showPicker==='function')input.showPicker();
  }catch{}
}
function enableFullDatePickerClicks(){
  document.querySelectorAll('input[type="date"],input[type="month"]').forEach(input=>{
    if(input.dataset.fullPickerBound==='1')return;
    input.dataset.fullPickerBound='1';
    input.classList.add('full-picker-click');
    input.addEventListener('click',()=>openFullDatePicker(input));
    const label=input.closest('label');
    if(label&&label.dataset.fullPickerBound!=='1'){
      label.dataset.fullPickerBound='1';
      label.classList.add('full-picker-label');
      label.addEventListener('click',e=>{
        if(e.target===input||e.target.closest?.('button'))return;
        e.preventDefault();
        openFullDatePicker(input);
      });
    }
  });
}
enableFullDatePickerClicks();

document.querySelectorAll('[data-drawer]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.sidenav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');openDrawer(b.dataset.drawer)});
$('closeDrawer').onclick=closeDrawer;
$('drawerBackdrop').onclick=e=>{if(e.target===$('drawerBackdrop'))closeDrawer()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
$('monthPrev').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderMonth()};
$('monthNext').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderMonth()};
$('saveQtyBtn').onclick=saveQty;
$('saveCarryBtn').onclick=saveCarry;
$('saveOrderBtn').onclick=saveEditor;
document.querySelectorAll('[data-auto]').forEach(b=>b.onclick=()=>setAuto(autoTarget===b.dataset.auto?null:b.dataset.auto));
for(const id of ['tank','quart','gallon','five','jerry'])$(id).oninput=recalc;
for(const id of ['carryQuart','carryGallon','carryFive','carryJerry','carryDate'])$(id).oninput=updateCarryPreview;
$('jerryEnabled').onchange=()=>toggleJerryField(true);
$('workDate').onchange=()=>{if(isWeekendDateStr($('workDate').value))toast(t('weekendOff'))};
$('prodWorkDate').onchange=()=>{if(isWeekendDateStr($('prodWorkDate').value))toast(t('weekendOff'))};
$('product').oninput=e=>{const p=e.target.selectionStart;e.target.value=titleCase(e.target.value);try{e.target.setSelectionRange(p,p)}catch{}};

window.addEventListener('afterprint',()=>document.body.classList.remove('printing'));
window.addEventListener('online',()=>{if(!authUser)return;setSync('syncing','RECONNECTING');reconcile();if(!channel)subscribeLive()});
window.addEventListener('offline',()=>{if(authUser)setSync('offline','OFFLINE')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&authUser)reconcile()});
document.addEventListener('click',e=>{
  const inAccordion=e.target.closest?.('.sideaccordion');
  if(!inAccordion)closeSidebarSubmenus('');
});
$('mainSidebar')?.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(!btn||['printBtn','holdLineBtn','settingsBtn','sidebarCloseBtn'].includes(btn.id))return;
  if(window.matchMedia('(max-width:700px)').matches)setTimeout(closeMobileSidebar,60);
});
window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width:700px)').matches)closeMobileSidebar()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileSidebar()});

db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){
    recoveryMode=true;authUser=session?.user||authUser;showAuthScreen();switchAuthPane('recovery');
  }
});
tick();setInterval(tick,30000);secureStart();