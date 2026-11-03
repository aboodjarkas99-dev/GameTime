(()=>{
 if(window.__gameTimeDatePicker)return;window.__gameTimeDatePicker=true;
 // Delegation also covers fields mounted later by Shipping and modal dialogs.
 document.addEventListener('click',event=>{
  const target=event.target;if(!target||typeof target.closest!=='function')return;
  if(target.closest('button,a,select,textarea'))return;
  const input=target.closest('input[type="date"]')||target.closest('label')?.querySelector('input[type="date"]');
  if(!input||input.disabled||input.readOnly||typeof input.showPicker!=='function')return;
  try{input.focus({preventScroll:true});input.showPicker();event.preventDefault()}catch{
   // Keep the browser's native action when showPicker is unavailable or blocked.
  }
 },true);
})();
