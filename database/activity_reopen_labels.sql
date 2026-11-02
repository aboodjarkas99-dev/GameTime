CREATE OR REPLACE FUNCTION public.log_work_order_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  who text := coalesce(new.updated_by,'Unknown');
  planning_changed boolean := false;
begin
  planning_changed :=
    old.product is distinct from new.product or
    old.batch is distinct from new.batch or
    old.tank is distinct from new.tank or
    old.quart is distinct from new.quart or
    old.gallon is distinct from new.gallon or
    old.five is distinct from new.five or
    old.jerry_enabled is distinct from new.jerry_enabled or
    old.jerry is distinct from new.jerry or
    old.catalyst is distinct from new.catalyst or
    old.batch_note is distinct from new.batch_note or
    old.prod_note is distinct from new.prod_note or
    old.priority is distinct from new.priority or
    old.auto_target is distinct from new.auto_target;

  if planning_changed then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'manager','edit','Work order details updated',who);
  end if;

  if old.batch_status is distinct from new.batch_status then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'batch',case when old.batch_status='done' and new.batch_status<>'done' then 'reopened' else new.batch_status end,case when old.batch_status='done' and new.batch_status<>'done' then 'Work Done undone' else 'Batch status changed' end,who);
  end if;

  if old.prod_status is distinct from new.prod_status then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod',case when old.prod_status='done' and new.prod_status<>'done' then 'reopened' else new.prod_status end,case when old.prod_status='done' and new.prod_status<>'done' then 'Work Done undone' else 'Fill Line status changed' end,who);
  end if;

  if old.batch_checked is distinct from new.batch_checked then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'batch','precheck',
      case when new.batch_checked then 'Pre-check completed' else 'Pre-check cleared' end,who);
  end if;

  if old.prod_checked is distinct from new.prod_checked then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod','precheck',
      case when new.prod_checked then 'Pre-check completed' else 'Pre-check cleared' end,who);
  end if;

  if old.held is distinct from new.held then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'all',case when new.held then 'hold' else 'resume' end,'Work hold status changed',who);
  end if;

  if old.actual_quart is distinct from new.actual_quart then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod','package','Quarts actual: '||coalesce(new.actual_quart::text,'—'),who);
  end if;

  if old.actual_gallon is distinct from new.actual_gallon then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod','package','1 Gallon actual: '||coalesce(new.actual_gallon::text,'—'),who);
  end if;

  if old.actual_five is distinct from new.actual_five then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod','package','5 Gallon actual: '||coalesce(new.actual_five::text,'—'),who);
  end if;

  if old.actual_jerry is distinct from new.actual_jerry then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'prod','package','Jerry Can 1.25 Gal actual: '||coalesce(new.actual_jerry::text,'—'),who);
  end if;

  if old.hold_line is distinct from new.hold_line
     or old.work_date is distinct from new.work_date
     or old.batch_work_date is distinct from new.batch_work_date
     or old.prod_work_date is distinct from new.prod_work_date then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'manager','schedule',
      case when new.deleted_at is not null then 'Moved to deleted history'
           when new.hold_line then 'Moved to Hold Line'
           else 'Schedule updated' end,
      who);
  end if;

  if old.deleted_at is distinct from new.deleted_at and new.deleted_at is not null then
    insert into public.activity_logs(product,dept,event_type,extra,actor)
    values(new.product,'manager','delete','Moved to deleted history',who);
  end if;

  return new;
end;
$function$

