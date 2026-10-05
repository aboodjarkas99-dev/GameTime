const SUPABASE_URL='https://bqnptjfdsxzbxtkzigim.supabase.co';
const SUPABASE_KEY='sb_publishable_PW16QU5CtZBRe42mGPBrHg_g8McvcP1';
const BUILD='SECURE_V2_20261005a';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{realtime:{params:{eventsPerSecond:20}}});

const $=id=>document.getElementById(id);
let view='all';
let isManager=false;
let authUser=null;
let profile=null;
let authStarting=false;
const CACHE_KEY='gametime_secure_v2_cache';
const LEGACY_KEY='gametime_factory_orders_v2';
const DEVICE_KEY='gametime_device_id';
const NAME_KEY='gametime_device_name';
const LANG_KEY='gametime_language';
const STRINGS={
  en:{
    setYourName:'Set Your Name',manager:'Manager',productionRole:'Production',batchMakerRole:'Batch Maker',
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
    setYourName:'Pon tu nombre',manager:'Gerente',productionRole:'Producción',batchMakerRole:'Preparación',
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
  const map={prevBtn:'previous',nextBtn:'next',printBtn:'printSavePdf',holdLineBtn:'holdLine',addBtn:'addWorkOrder',shareProd:'sendProduction',shareBatch:'sendBatchMaker',saveOrderBtn:'saveWorkOrder',saveQtyBtn:'saveActualQuantity',saveCarryBtn:'moveRemainder',saveDeviceName:'saveNameDevice'};
  for(const [id,key] of Object.entries(map)){const el=$(id);if(el)el.textContent=t(key)}
  const search=$('search');if(search)search.placeholder=t('searchPlaceholder');
  staticText('#managerTools .sendbox > b','sendBoard');
  staticText('[data-drawer="activity"]','liveActivity');staticText('[data-drawer="queue"]','unfinishedQueue');staticText('[data-drawer="holdline"]','holdLine');
  staticText('.stats .stat:nth-child(1) span','workOrders');staticText('.stats .stat:nth-child(2) span','batchTasks');staticText('.stats .stat:nth-child(3) span','productionTasks');staticText('.stats .stat:nth-child(4) span','completed');
  staticText('#batchPanel .panelhead h2','batchMaker');staticText('#prodPanel .panelhead h2','productionFilling');
  directLabel('product','productName');directLabel('workDate','batchMakerDate');directLabel('prodWorkDate','productionDate');directLabel('batchNumber','batchNumber');directLabel('tank','totalBatchGallons');directLabel('priority','priority');
  directLabel('quart','quarts');directLabel('gallon','oneGallon');directLabel('five','fiveGallon');directLabel('jerry','jerryCan');directLabel('batchNote','batchNote');directLabel('prodNote','productionNote');
  staticText('.auto > b','autoFillRemaining');
  const ab={five:'fiveGallon',gallon:'oneGallon',quart:'quarts',jerry:'jerryCan'};document.querySelectorAll('[data-auto]').forEach(b=>{if(ab[b.dataset.auto])b.textContent=t(ab[b.dataset.auto])});
  staticText('.optional-package span b','addJerry');staticText('.optional-package span small','onlyShowPackage');
  if($('catalystOptionTitle'))$('catalystOptionTitle').textContent=t('catalystOption');
  if($('catalystOptionHelp'))$('catalystOptionHelp').textContent=t('catalystHelp');
  if($('monthlyChartBtn'))$('monthlyChartBtn').textContent=t('monthlyChart');
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
let deviceName=(localStorage.getItem(NAME_KEY)||'').trim();
function roleLabel(){return isManager?t('manager'):view==='prod'?t('productionRole'):t('batchMakerRole')}
function actor(){return deviceName?deviceName:roleLabel()+'-'+deviceId.slice(-5)}
function refreshUserLabel(){const el=$('currentUser');if(el)el.textContent='👤 '+(deviceName||t('setYourName'))}
let orders=[],logs=[],selected=new Date(),monthCursor=new Date(),editorMode='order',editingId=null,editingVersion=null,autoTarget=null,qtyState=null,carryState=null,saveBusy=false,dragState=null,channel=null,reconcileTimer=null,logPollTick=0;
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
    let cloud=await fetchOrders();cloud=await importLegacyIfNeeded(cloud);orders=cloud;cache();
    logs=await fetchLogs();render();subscribeLive();setSync('live','LIVE');
    reconcileTimer=setInterval(reconcile,4000);
  }catch(e){console.error(e);setSync('offline','OFFLINE');toast('Cloud connection problem — retrying');setTimeout(initialLoad,3500)}
}
async function reconcile(){
  if(!navigator.onLine){setSync('offline','OFFLINE');return}
  try{
    const cloud=await fetchOrders();
    if(orderSig(cloud)!==orderSig(orders)){orders=cloud;cache();render()}
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
    '<label class="precheck '+(checked?'ok ':'')+(prodWaiting?'locked-wait':'')+'" data-check="'+o.id+'" data-dept="'+dept+'" data-waiting="'+(prodWaiting?'1':'0')+'"><span class="sq">'+(checked?'✓':'')+'</span><span class="checktxt"><b>'+esc(t('precheck'))+'</b><small>'+esc(dept==='prod'?t('prodCheckHint'):t('batchCheckHint'))+'</small></span></label>'+
    '<div class="status '+statusClass(st)+'">'+esc(statusText(st))+'</div>'+
    '<div class="actions"><button class="start '+(checked&&!prodWaiting?'':'locked')+'" data-action="start" data-id="'+o.id+'" data-dept="'+dept+'" '+(prodWaiting?'disabled':'')+'>'+esc(t('startWork'))+'</button><button class="finish '+(checked&&!prodWaiting?'':'locked')+'" data-action="done" data-id="'+o.id+'" data-dept="'+dept+'" '+(prodWaiting?'disabled':'')+'>'+esc(t('workDone'))+'</button><button class="hold" data-action="hold" data-id="'+o.id+'">'+esc(o.held?t('resumeWork'):t('putOnHold'))+'</button></div>'+
    (isManager?'<div class="manage"><button data-edit="'+o.id+'">'+esc(t('edit'))+'</button><button data-tohold="'+o.id+'">'+esc(t('moveToHold'))+'</button><button data-delete="'+o.id+'">'+esc(t('delete'))+'</button></div>':'')+
    (hasMade?'<div class="batchmade-corner">'+esc(t('batchMadeOn'))+' <b>'+esc(usDate(o.batchMadeDate))+'</b></div>':'')+
    '</article>';
}
function render(){
  $('viewLabel').textContent=isManager?t('allWork'):view==='prod'?t('productionFilling'):t('batchMaker');
  $('dateLabel').textContent=isGlobalSearch()?t('searchResults')+' — '+t('allDates'):pretty();
  $('managerTools').style.display=isManager?'flex':'none';$('addBtn').style.display=isManager?'':'none';
  const batch=departmentList('batch'),prod=departmentList('prod');
  const visibleIds=new Set((view==='batch'?batch:view==='prod'?prod:[...batch,...prod]).map(o=>o.id));
  $('sOrders').textContent=visibleIds.size;$('sBatch').textContent=batch.length;$('sProd').textContent=prod.length;$('sDone').textContent=isManager?batch.filter(o=>o.batchStatus==='done').length+prod.filter(o=>o.prodStatus==='done').length:view==='batch'?batch.filter(o=>o.batchStatus==='done').length:prod.filter(o=>o.prodStatus==='done').length;
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
async function shareDept(dept){const base=location.href.split('?')[0].replace(/[^/]*$/,''),url=base+(dept==='prod'?'production.html?build=SECURE_V2_20261005a':'batch-maker.html?build=SECURE_V2_20261005a'),title=dept==='prod'?t('productionFilling'):t('batchMaker');try{if(navigator.share){await navigator.share({title,text:'GameTime Factory Work Board',url});return}}catch(e){if(e.name==='AbortError')return}try{await navigator.clipboard.writeText(url);toast(title+' ✓')}catch{prompt(lang==='es'?'Copia este enlace:':'Copy this link:',url)}}

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
        return '<div class="analytics-row">'+
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
$('prevBtn').onclick=()=>{selected=shiftWorkdayDate(selected,-1);render()};
$('nextBtn').onclick=()=>{selected=shiftWorkdayDate(selected,1);render()};
$('dateLabel').onclick=openMonth;$('search').oninput=render;$('addBtn').onclick=()=>openEditor(null,false);if($('monthlyChartBtn'))$('monthlyChartBtn').onclick=openMonthlyAnalytics;if($('analyticsLoadBtn'))$('analyticsLoadBtn').onclick=loadMonthlyAnalytics;if($('analyticsMonth'))$('analyticsMonth').onchange=loadMonthlyAnalytics;$('printBtn').onclick=()=>isManager?openDrawer('print'):printSheet(view);$('holdLineBtn').onclick=()=>openDrawer('holdline');
$('shareProd').onclick=()=>shareDept('prod');$('shareBatch').onclick=()=>shareDept('batch');$('currentUser').onclick=openIdentity;$('saveDeviceName').onclick=saveIdentity;document.querySelectorAll('[data-drawer]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.drawer));
$('closeDrawer').onclick=closeDrawer;$('drawerBackdrop').onclick=e=>{if(e.target===$('drawerBackdrop'))closeDrawer()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>hideModal(b.dataset.close));$('monthPrev').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderMonth()};$('monthNext').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderMonth()};
$('saveQtyBtn').onclick=saveQty;$('saveCarryBtn').onclick=saveCarry;$('saveOrderBtn').onclick=saveEditor;document.querySelectorAll('[data-auto]').forEach(b=>b.onclick=()=>setAuto(autoTarget===b.dataset.auto?null:b.dataset.auto));
for(const id of ['tank','quart','gallon','five','jerry'])$(id).oninput=recalc;for(const id of ['carryQuart','carryGallon','carryFive','carryJerry','carryDate'])$(id).oninput=updateCarryPreview;$('jerryEnabled').onchange=()=>toggleJerryField(true);
$('workDate').onchange=()=>{
  if(isWeekendDateStr($('workDate').value))toast(t('weekendOff'));
};
$('prodWorkDate').onchange=()=>{if(isWeekendDateStr($('prodWorkDate').value))toast(t('weekendOff'))};
$('product').oninput=e=>{const p=e.target.selectionStart;e.target.value=titleCase(e.target.value);try{e.target.setSelectionRange(p,p)}catch{}};
window.addEventListener('afterprint',()=>document.body.classList.remove('printing'));
window.addEventListener('online',()=>{setSync('syncing','RECONNECTING');reconcile();if(!channel)subscribeLive()});window.addEventListener('offline',()=>setSync('offline','OFFLINE'));document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile()});

applyLanguage();tick();setInterval(tick,30000);render();ensureIdentity();initialLoad();