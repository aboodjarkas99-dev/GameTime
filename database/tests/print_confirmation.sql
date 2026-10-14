begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b6000338-5bd6-4d1a-b7ab-43e879f04cfb',true);
do $test$
declare v_id uuid; result jsonb; f jsonb; n bigint; v_lines jsonb;
begin
 f:='{"orderName":"__PRINT_TEST__","customer":"TEST","lines":[{"id":"1","sku":"T","description":"TEST","size":"gal1","qty":7}],"inventoryProducts":{},"batchCodes":{}}';
 v_lines:='[{"sku":"T","description":"TEST","size":"gal1","qty":7,"inventory_product":"__PRINT_TEST_PRODUCT__"},{"sku":"D","description":"sample","size":"drawdown","qty":1,"inventory_product":"__PRINT_SAMPLE__"}]';
 v_id:=public.save_shipping_shipment(null,'{"shipment_number":"__PRINT_TEST__","packing_slip":"__PRINT_TEST__","customer":"TEST","status":"READY","source_kind":"manual"}',v_lines,jsonb_build_object('floor',f),'{}');
 if exists(select 1 from inventory_events where metadata->>'shipment_id'=v_id::text) then raise exception 'save deducted inventory'; end if;
 begin
  perform public.confirm_shipping_print(v_id,jsonb_set(f,'{customer}','"changed"'));
  raise exception 'stale snapshot accepted';
 exception when others then if sqlerrm not like 'Order changed%' then raise; end if; end;
 result:=public.confirm_shipping_print(v_id,f);
 if (result->>'duplicate')::boolean then raise exception 'first confirmation duplicate'; end if;
 result:=public.confirm_shipping_print(v_id,f);
 if not (result->>'duplicate')::boolean then raise exception 'reprint not duplicate'; end if;
 result:=public.mark_shipping_shipped(v_id,current_date);
 if not (result->>'duplicate')::boolean then raise exception 'mark shipped deducted twice'; end if;
 perform public.complete_printed_shipping(v_id,f,'{"day":"2026-10-14","lines":[]}');
 select count(*) into n from inventory_event_lines where inventory_event_id=(select inventory_event_id from shipping_shipments where id=v_id) and qty_delta=-7;
 if n<>1 then raise exception 'wrong deduction count'; end if;
 if exists(select 1 from inventory_event_lines where inventory_event_id=(select inventory_event_id from shipping_shipments where id=v_id) and product='__PRINT_SAMPLE__') then raise exception 'drawdown deducted'; end if;
 begin
  perform public.save_shipping_shipment(null,'{"shipment_number":" __print_test__ ","packing_slip":" __print_test__ ","status":"READY","source_kind":"manual"}',v_lines,jsonb_build_object('floor',f),'{}');
  raise exception 'duplicate slip accepted';
 exception when unique_violation then null; end;
end $test$;
rollback;
