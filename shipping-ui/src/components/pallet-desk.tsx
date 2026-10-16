import {ShippingStatusTabs} from "./shipping-status-tabs";
import { account,db,persistDesk,deskStatus,shipDesk,confirmDeskPrint } from "@/lib/pallet/api";
import {readSlipPhoto} from "@/lib/pallet/scan";
import {scanPage} from "@/document-scan.mjs";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { BolScan } from "@/components/bol-scan";
import { InstallApp, useShowHomeIntro } from "@/components/install-app";
import {
  cancelDeskDone,
  cancelDeskOpen,
  claimDeskOrder,
  completeDeskOrder,
  confirmDeskOrder,
  listWork,
  postDeskOrder,
  pullDeskOrder,
  pulseWork,
  readPackingSlip,
  releaseDeskOrder,
  returnDeskOrder,
  touchDeskOrder,
  type DoneOrder,
  type FloorPerson,
  type OpenOrder,
  type ReturnSlip,
} from "@/lib/pallet/api";
import { DEFAULT_RULES, DEFAULT_SETTINGS } from "@/lib/pallet/defaults";
import { formatNum, containerPhrase, pailExplain, pailSplit, sizeTitle } from "@/lib/pallet/format";
import { buildPlan, broughtIn, isOvertime125, isOvertime8oz, isPaintGallon, isSharedQuart, isPlan, loadRows, overtime125Pack, paintDetail, paintRowName, paintShareBoxes, productLabel, quartShareBoxes, readPaintMix, slipColor, unitsInBox } from "@/lib/pallet/plan";
import { batchRecordPdf, recordFileName, type BatchRecord } from "@/lib/pallet/record-pdf";
import { parseOrderText, parseSlipMeta, extractBatchCodes, toUnits, salespersonFromSlip, shipMethodFromSlip } from "@/lib/pallet/parse";
import { consumeSharedInbox } from "@/lib/pallet/share-inbox";
import {
  newId,
  packsPerPallet,
  ruleFor,
  ruleError,
  unitsPerPallet,
  isSizeKey,
  type OrderLine,
  type Pallet,
  type PalletRule,
  type SizeKey,
} from "@/lib/pallet/types";

const STORAGE_KEY = "pallet-desk-v3";
const DAY_KEY = "katchup-day-v1";
const RULES_KEY = "astuto-pallet-rules-v1";
const TYPED_CODES_KEY = "astuto-typed-batch-codes-v1";
const BATCH_LIST_ID = "astuto-batch-codes";
const TEAM_EMAILS = [
  "chuck@gametimecoatings.com",
  "mike@gametimecoatings.com",
  "shannon@gametimecoatings.com",
  "Suzanne@gametimecoatings.com",
  "bob@gametimecoatings.com",
  "kyle@gametimecoatings.com",
  "Abood@gametimecoatings.com",
];
const CONTACTS_KEY = "katchup-contacts-v1";

type Stage = "upload" | "choose" | "build" | "codes" | "send";

type TaskPayload = {
  o: string;
  c: string;
  n: string;
  l: [string, string, SizeKey, number][];
};

function encodeTask(orderName: string, customer: string, notes: string, lines: OrderLine[]): string {
  const payload: TaskPayload = {
    o: orderName,
    c: customer,
    n: notes,
    l: lines.filter((line) => line.qty > 0).map((line) => [line.sku, line.description, line.size, line.qty]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeTask(token: string): { orderName: string; customer: string; notes: string; lines: OrderLine[] } | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as TaskPayload;
    if (!payload || !Array.isArray(payload.l)) return null;
    const lines = payload.l
      .filter((row) => Array.isArray(row) && isSizeKey(row[2]) && Number(row[3]) > 0)
      .map((row) => ({
        id: newId(),
        sku: String(row[0] ?? ""),
        description: String(row[1] ?? ""),
        size: row[2],
        qty: Number(row[3]),
      }));
    if (lines.length === 0) return null;
    return { orderName: String(payload.o ?? ""), customer: String(payload.c ?? ""), notes: String(payload.n ?? ""), lines };
  } catch {
    return null;
  }
}

function taskFromLocation() {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search).get("task");
  const hash = window.location.hash.replace(/^#/, "");
  const hashMatch = hash.match(/(?:^|&)task=([^&]+)/);
  const token = query || (hashMatch ? decodeURIComponent(hashMatch[1]) : "");
  if (!token) return null;
  return decodeTask(token);
}

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

type ShipmentPhoto = {
  id: string;
  name: string;
  url: string;
  file: File;
};

function readContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as Contact[];
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item.name === "string") : [];
  } catch {
    return [];
  }
}

function writeContacts(contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}
const SIZES: SizeKey[] = ["quart", "pint", "gal1", "gal125", "gal15", "gal5", "vinyl", "drawdown"];

type DayOrder = {
  id: string;
  at: string;
  orderName: string;
  customer: string;
  notes: string;
  batchDate: string;
  pallets: number;
  pails: number;
  boxes: number;
  lines: { name: string; qty: string; sku: string; size: string; batch: string }[];
};

function doneToDay(item: DoneOrder): DayOrder {
  return {
    id: item.id,
    at: new Date(item.finishedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    orderName: item.orderName || "Order",
    customer: item.customer || "Customer",
    notes: item.notes,
    batchDate: item.day,
    pallets: item.pallets,
    pails: item.pails,
    boxes: item.boxes,
    lines: item.lines,
  };
}

function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function workSessionId(): string {
  const key = "katchup-work-session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = newId();
  sessionStorage.setItem(key, id);
  return id;
}

function readToday(): DayOrder[] {
  try {
    const raw = localStorage.getItem(DAY_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as { date?: string; orders?: DayOrder[] };
    if (saved.date !== todayStamp() || !Array.isArray(saved.orders)) {
      localStorage.setItem(DAY_KEY, JSON.stringify({ date: todayStamp(), orders: [] }));
      return [];
    }
    return saved.orders;
  } catch {
    return [];
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function readSavedRules(): { rules: PalletRule[]; mixSmall: boolean } | null {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { rules?: PalletRule[]; mixSmall?: boolean };
    if (!Array.isArray(saved.rules)) return null;
    const rules = DEFAULT_RULES.map((base) => {
      const next = saved.rules?.find((rule) => rule.size === base.size);
      if (!next) return base;
      return {
        ...base,
        unitsPerCase: Math.max(1, Math.round(Number(next.unitsPerCase) || base.unitsPerCase)),
        casesPerLayer: Math.max(1, Math.round(Number(next.casesPerLayer) || base.casesPerLayer)),
        layers: Math.max(1, Math.round(Number(next.layers) || base.layers)),
      };
    });
    if (ruleError(rules)) return null;
    return {
      rules,
      mixSmall: typeof saved.mixSmall === "boolean" ? saved.mixSmall : DEFAULT_SETTINGS.mixSmall,
    };
  } catch {
    return null;
  }
}

function readTypedCodes(): string[] {
  try {
    const raw = localStorage.getItem(TYPED_CODES_KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function rememberTypedCode(code: string) {
  const clean = code.trim();
  if (clean.length < 2) return;
  const next = [clean, ...readTypedCodes().filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 40);
  localStorage.setItem(TYPED_CODES_KEY, JSON.stringify(next));
}

function downloadRecord(record: BatchRecord) {
  const bytes = batchRecordPdf(record);
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = recordFileName(record.orderName, record.batchDate);
  link.click();
  URL.revokeObjectURL(url);
}

export function PalletDesk() {
  const [orderName, setOrderName] = useState("");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [salespersonName, setSalespersonName] = useState("");
  const [salespersonEmail, setSalespersonEmail] = useState("");
  const [headerOk, setHeaderOk] = useState(false);
  const [bol, setBol] = useState("");
  const [carrier, setCarrier] = useState("");
  const [shipMethod, setShipMethod] = useState<"" | "UPS Ground" | "FedEx Ground" | "LTL">("");
  const [scanBol, setScanBol] = useState(false);
  const [batchPad, setBatchPad] = useState<{ mode: "product"; name: string; size: SizeKey } | { mode: "line"; id: string } | null>(null);
  const [confirmReady, setConfirmReady] = useState(false);
  const [date, setDate] = useState("");
  const [mixSmall, setMixSmall] = useState(DEFAULT_SETTINGS.mixSmall);
  const [palletTareLb, setPalletTareLb] = useState(DEFAULT_SETTINGS.palletTareLb);
  const [rules, setRules] = useState<PalletRule[]>(DEFAULT_RULES);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [status, setStatus] = useState("Drop a packing slip to load the order.");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [dayOrders, setDayOrders] = useState<DayOrder[]>([]);
  const [focus, setFocus] = useState(0);
  const [batchCodes, setBatchCodes] = useState<Record<string, string>>({});
  const [shots, setShots] = useState<ShipmentPhoto[]>([]);
  const [typedCodes, setTypedCodes] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [stage, setStage] = useState<Stage>("upload");
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const showHomeIntro = useShowHomeIntro();
  const [taskMode, setTaskMode] = useState(false);
  const [people, setPeople] = useState<FloorPerson[]>([]);
  const [returns, setReturns] = useState<ReturnSlip[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [activeOpenId, setActiveOpenId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pageCameraRef=useRef<HTMLInputElement>(null);
  const [scanText,setScanText]=useState('');
  const [appendScan,setAppendScan]=useState(false);
  const linesRef = useRef<OrderLine[]>([]);
  linesRef.current = lines;
  const workStamp = useRef<{ key: string; startedAt: number }>({ key: "", startedAt: 0 });
  const floorRef = useRef({ orderName: "", customer: "" });
  floorRef.current = { orderName, customer };

  const isAdmin = true;
  const [cloudStatus,setCloudStatus]=useState('DRAFT');
  const [cloudMessage,setCloudMessage]=useState('Live factory storage');
  const [inventoryProducts,setInventoryProducts]=useState<Record<string,string>>({});
  const [stockProducts,setStockProducts]=useState<string[]>([]);
  const [printPending,setPrintPending]=useState<{id:string;state:any}|null>(null);
  const [printBusy,setPrintBusy]=useState(false);
  const [printError,setPrintError]=useState('');
  const printLock=useRef(false);
  const autoSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const skipNextAutoSave=useRef(false);
  const cloudQueue=useRef<Promise<unknown>>(Promise.resolve());
  useEffect(()=>{db.from('inventory_current_stock').select('product').then(({data})=>setStockProducts([...new Set((data||[]).map(r=>r.product as string))]));},[]);
  function deskState(){return {id:activeOpenId,orderName,customer,notes,date,salespersonName,salespersonEmail,bol,carrier,shipMethod,mixSmall,palletTareLb,rules,lines,loaded,batchCodes,headerOk,inventoryProducts,slipText:scanText,worker:account?.display_name,workerSession:workSessionId()};}
  useEffect(()=>{
    if(skipNextAutoSave.current){skipNextAutoSave.current=false;return;}
    if(printLock.current||!activeOpenId||!lines.some(l=>l.qty>0)||['SHIPPED','CANCELED'].includes(cloudStatus))return;
    setCloudStatus('DRAFT');
    const state=deskState();const timer=setTimeout(()=>{
      setCloudMessage('Saving live…');
      cloudQueue.current=cloudQueue.current.catch(()=>{}).then(()=>persistDesk(state,'DRAFT')).then(()=>{setCloudStatus('DRAFT');setCloudMessage('Saved to factory — live');}).catch(e=>setCloudMessage('Not saved: '+e.message));
    },1000);autoSaveTimer.current=timer;return()=>clearTimeout(timer);
  },[activeOpenId,orderName,customer,notes,date,salespersonName,salespersonEmail,bol,carrier,shipMethod,mixSmall,palletTareLb,rules,lines,loaded,batchCodes,headerOk,inventoryProducts]);
  async function saveFactory(ready=false){try{await cloudQueue.current;const id=await persistDesk(deskState(),ready?'READY':'DRAFT');setActiveOpenId(id);setCloudStatus(ready?'READY':'DRAFT');setCloudMessage(ready?'READY — loading complete. Stock changes after printed confirmation or Mark Shipped.':'Draft saved live');return id}catch(e){setCloudMessage('Could not save: '+(e instanceof Error?e.message:'Error'));return null}}
  async function markFactoryShipped(id=activeOpenId){if(!id)return;if(!confirm('This shipment has left the factory? Mark Shipped deducts inventory once.'))return;try{await cloudQueue.current;const result=await shipDesk(id);if(id===activeOpenId)setCloudStatus('SHIPPED');setCloudMessage(result.duplicate?'Already completed — no additional inventory change.':'SHIPPED — factory inventory updated.')}catch(e){setCloudMessage(e instanceof Error?e.message:'Could not mark shipped')}}


  async function preparePrintedSnapshot(state:any){
    setPrintBusy(true);setPrintError('');
    try{
      if(!state.orderName.trim())throw new Error('Printing is available, but enter the Packing Slip number before updating inventory. Cancel this confirmation, add the number, and print again.');
      if(mismatch)throw new Error('Printing is available, but fix quantities that do not match the packing slip before updating inventory.');
      await cloudQueue.current.catch(()=>{});
      const saved=state.id?await deskStatus(state.id):null;
      const alreadyShipped=saved?.status==='SHIPPED';
      const id=alreadyShipped?state.id:await persistDesk(state,'READY');
      setActiveOpenId(id);setCloudStatus(alreadyShipped?'SHIPPED':'READY');
      setPrintPending({id,state});
    }catch(e){setPrintError('Inventory has not been updated: '+(e instanceof Error?e.message:'Could not save. Retry when connected.'));}
    finally{setPrintBusy(false);}
  }
  function printBreakdown(){
    if(printLock.current)return;
    printLock.current=true;setPrintBusy(true);setPrintError('');
    if(autoSaveTimer.current)clearTimeout(autoSaveTimer.current);
    const state={...deskState(),lines:lines.filter(l=>l.qty>0)};
    setPrintPending({id:'',state});
    // Keep print in the click handler: no network wait or lost user activation.
    try{window.print();}
    catch(e){setPrintError('Could not open the print dialog: '+(e instanceof Error?e.message:'Try Print again.'));setPrintBusy(false);return;}
    void preparePrintedSnapshot(state);
  }
  async function confirmPrinted(){
    if(!printPending?.id||printBusy||printError)return;
    setPrintBusy(true);setPrintError('');
    try{
      const result=await confirmDeskPrint(printPending.id,printPending.state);
      setCloudStatus('SHIPPED');setCloudMessage(result.duplicate?'Reprint recorded — no additional inventory change.':'Printed confirmed — inventory deducted once.');
      setPrintPending(null);printLock.current=false;
    }catch(e){setPrintError(e instanceof Error?e.message:'Could not confirm print. Retry when connected.');}
    finally{setPrintBusy(false);}
  }
  function cancelPrint(){setPrintPending(null);printLock.current=false;setPrintError('');setCloudMessage('Print not confirmed — no inventory deduction.');}


  useEffect(() => {
    setDayOrders(readToday());
    const opened = taskFromLocation();
    if (opened) {
      setOrderName(opened.orderName);
      setCustomer(opened.customer);
      setNotes(opened.notes);
      setLines(opened.lines);
      setLoaded({});
      setBatchCodes({});
      setFocus(0);
      setTaskMode(true);
      setStage("build");
      setStatus("Task opened. Check each product as you load the pallet.");
      setContacts(readContacts());
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setContacts(readContacts());
        return;
      }
      const saved = JSON.parse(raw) as {
        cloudId?: string;
        orderName?: string;
        customer?: string;
        notes?: string;
        salespersonName?: string;
        salespersonEmail?: string;
        bol?: string;
        carrier?: string;
        shipMethod?: string;
        mixSmall?: boolean;
        palletTareLb?: number;
        rules?: PalletRule[];
        lines?: OrderLine[];
        loaded?: Record<string, boolean>;
        batchCodes?: Record<string, string>;
      };
      if(typeof saved.cloudId==="string"&&saved.cloudId){setActiveOpenId(saved.cloudId);void deskStatus(saved.cloudId).then(row=>setCloudStatus(row.status)).catch(()=>{});}
      if (typeof saved.orderName === "string") setOrderName(saved.orderName);
      if (typeof saved.customer === "string") setCustomer(saved.customer);
      if (typeof saved.notes === "string") setNotes(saved.notes);
      if (typeof saved.salespersonName === "string") setSalespersonName(saved.salespersonName);
      if (typeof saved.salespersonEmail === "string") setSalespersonEmail(saved.salespersonEmail);
      if (typeof saved.bol === "string") setBol(saved.bol);
      if (typeof saved.carrier === "string") setCarrier(saved.carrier);
      if (saved.shipMethod === "UPS Ground" || saved.shipMethod === "FedEx Ground" || saved.shipMethod === "LTL") setShipMethod(saved.shipMethod);
      if (typeof saved.mixSmall === "boolean") setMixSmall(saved.mixSmall);
      if (typeof saved.palletTareLb === "number") setPalletTareLb(saved.palletTareLb);
      if (
        Array.isArray(saved.rules) &&
        saved.rules.length === DEFAULT_RULES.length &&
        saved.rules.every((rule) => isSizeKey(rule.size))
      ) {
        setRules(saved.rules);
      }
      const kept = readSavedRules();
      if (kept) {
        setRules(kept.rules);
        setMixSmall(kept.mixSmall);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setContacts(readContacts());
    setTypedCodes(readTypedCodes());
  }, []);

  useEffect(() => {
    const session = workSessionId();
    if (!workStamp.current.startedAt) workStamp.current = { key: session, startedAt: Date.now() };
    const since = workStamp.current.startedAt;
    const send = (active: boolean) => {
      const current = floorRef.current;
      void pulseWork({
        data: {
          session,
          name: "Admin",
          role: "admin",
          orderName: active ? current.orderName : "",
          customer: active ? current.customer : "",
          since,
          active,
        },
      }).catch(() => undefined);
    };
    send(true);
    const id = window.setInterval(() => send(true), 4000);
    const leave = () => send(false);
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", leave);
    };
  }, []);

  const openSnap = useRef("");
  const doneSnap = useRef("");
  const peopleSnap = useRef("");
  const boardGen = useRef(0);

  useEffect(() => {
    let stop = false;
    async function pull() {
      const gen = boardGen.current;
      try {
        const result = await listWork({ data: { day: todayStamp() } });
        if (stop || gen !== boardGen.current) return;
        const nextOpen = result.open ?? [];
        const nextDone = result.done ?? [];
        const nextPeople = (result.people ?? []).filter((person) => person.session !== workSessionId());
        const openText = JSON.stringify(nextOpen);
        const doneText = JSON.stringify(nextDone.map(doneToDay));
        const peopleText = JSON.stringify(nextPeople);
        if (openText !== openSnap.current) {
          openSnap.current = openText;
          setOpenOrders(nextOpen);
        }
        if (doneText !== doneSnap.current) {
          doneSnap.current = doneText;
          setDayOrders(nextDone.map(doneToDay));
        }
        if (peopleText !== peopleSnap.current) {
          peopleSnap.current = peopleText;
          setPeople(nextPeople);
        }
      } catch {
        /* keep the board that's already on screen */
      }
    }
    void pull();
    const id = window.setInterval(() => void pull(), 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const skipSave = useRef(true);
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ cloudId:activeOpenId,orderName, customer, notes, salespersonName, salespersonEmail, bol, carrier, shipMethod, mixSmall, palletTareLb, rules, lines, loaded, batchCodes }),
    );
  }, [orderName, customer, notes, salespersonName, salespersonEmail, bol, carrier, shipMethod, mixSmall, palletTareLb, rules, lines, loaded, batchCodes]);

  const plan = useMemo(
    () => buildPlan(lines, rules, { mixSmall, palletTareLb }),
    [lines, rules, mixSmall, palletTareLb],
  );
  const rows = isPlan(plan) ? loadRows(plan, lines, rules) : [];
  const containers = isPlan(plan) ? containerTotals(plan.pallets) : { pails: 0, boxes: 0 };
  const pailPer = unitsPerPallet(ruleFor(rules, "gal5"));
  const pieces = containers.pails + containers.boxes;
  const bySize = isPlan(plan) ? sizeCounts(plan.pallets) : null;
  const hasOrder = lines.some((line) => line.qty > 0);
  const slipLines = lines.filter((line) => line.qty > 0);
  const stories = isPlan(plan) ? productStories(plan.pallets, lines, rules) : [];
  const sharedPaint = paintShareBoxes(lines);
  const sharedQuarts = quartShareBoxes(lines);
  const firstPaintKey = stories.find((item) => item.byColor && item.sizeKey === "gal1")?.key ?? "";
  const lastPaintKey = [...stories].reverse().find((item) => item.byColor && item.sizeKey === "gal1")?.key ?? "";
  const firstQuartKey = stories.find((item) => item.sizeKey === "quart" && !/cataly|catylist/i.test(item.name))?.key ?? "";
  const mismatch = stories.some((item) => item.sizeKey !== "drawdown" && item.ordered !== item.placed);
  const firstOpen = isPlan(plan)
    ? plan.pallets.findIndex((pallet) => pallet.lines.some((line) => !loaded[loadKey(pallet.number, line)]))
    : 0;
  const palletCount = isPlan(plan) ? plan.pallets.length : 0;
  const view = palletCount === 0 ? 0 : Math.min(focus, palletCount - 1);
  const codeLines = slipLines.filter((line) => line.size !== "drawdown");
  const codedCount = codeLines.filter((line) => (batchCodes[line.id] ?? "").trim().length > 0).length;
  const codesReady = slipLines.length > 0 && codedCount === codeLines.length;
  const needed = useMemo(() => {
    if (!isPlan(plan)) return [];
    const totals = new Map<string, { name: string; size: string; count: number; key: SizeKey }>();
    for (const pallet of plan.pallets) {
      for (const line of pallet.lines) {
        const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
        const name = productLabel(line.sku, line.description, line.size);
        const id = `${name}|${line.size}`;
        const current = totals.get(id);
        if (current) current.count += count;
        else totals.set(id, { name, size: sizeTitle(line.size), count, key: line.size });
      }
    }
    return [...totals.values()];
  }, [plan]);
  const productKeys = needed.map((item) => `product:${item.name}|${item.key}`);
  const checkTotal = productKeys.length;
  const checkedCount = productKeys.filter((key) => loaded[key]).length;
  const needsBol = isPlan(plan) && plan.pallets.length > 0;
  const bolReady = !needsBol || bol.trim().length > 0;
  const checksDone = hasOrder && checkTotal > 0 && checkedCount === checkTotal;
  const readyToSave = hasOrder && headerOk && bolReady && checksDone && !mismatch && codesReady;
  const recordReady = readyToSave;
  function orderBlock(): string {
    if (!headerOk) return "Match the shipment, customer, and salesperson to the paper before you check a product.";
    if (mismatch) return "Stop. A count does not match the slip. Do not check that line or send the email.";
    if (!checksDone) return "Check each product only after it is on the pallet.";
    if (!codesReady) return "Enter the batch code from the can or pail. Paint needs one code per color.";
    if (!bolReady) return "Enter the BOL number for the shipping company before you email.";
    if (needsBol && !carrier.trim()) return "Enter the shipping company before you email.";
    return "";
  }

  useEffect(() => {
    if (!activeOpenId || stage !== "build" || checkTotal === 0) return;
    const timer = window.setTimeout(() => {
      void touchDeskOrder({
        data: { id: activeOpenId, session: workSessionId(), checked: checkedCount, total: checkTotal, ready: recordReady },
      }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeOpenId, stage, checkedCount, checkTotal, recordReady]);

  function saveDay() {
    if (!readyToSave || !isPlan(plan)) return;
    const entry: DayOrder = {
      id: newId(),
      at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      orderName: orderName || "Order",
      customer: customer || "Customer",
      notes,
      batchDate: date,
      pallets: plan.totals.pallets,
      pails: containers.pails,
      boxes: containers.boxes,
      lines: plan.pallets.flatMap((pallet) =>
        pallet.lines.map((line) => {
          const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
          const source = lines.find((item) => item.sku.toUpperCase() === line.sku.toUpperCase() && item.size === line.size);
          return {
            name: productLabel(line.sku, line.description, line.size),
            qty: containerPhrase(line.size, count, pailPer),
            sku: line.sku,
            size: sizeTitle(line.size),
            batch: source ? (batchCodes[source.id] ?? "").trim() : "",
          };
        }),
      ),
    };
    const next = [entry, ...readToday()];
    localStorage.setItem(DAY_KEY, JSON.stringify({ date: todayStamp(), orders: next }));
    setDayOrders(next);
    setLines([]);
    setLoaded({});
    setFocus(0);
    setOrderName("");
    setCustomer("");
    setNotes("");
    setBatchCodes({});
    clearShots();
    setTaskMode(false);
    setStage("upload");
    setStatus(`${entry.orderName} is complete.`);
  }

  function clearShots() {
    setShots((current) => {
      for (const shot of current) URL.revokeObjectURL(shot.url);
      return [];
    });
  }

  function addShots(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added = [...list].map((file) => ({
      id: newId(),
      name: file.name || "photo.jpg",
      url: URL.createObjectURL(file),
      file,
    }));
    setShots((current) => [...current, ...added]);
    setConfirmReady(false);
  }

  function removeShot(id: string) {
    setShots((current) => {
      const shot = current.find((item) => item.id === id);
      if (shot) URL.revokeObjectURL(shot.url);
      return current.filter((item) => item.id !== id);
    });
    setConfirmReady(false);
  }

  async function deliverMail(to: string, subject: string, body: string, cc = "") {
    const files = shots.map((shot, index) => {
      const type = shot.file.type || "image/jpeg";
      const ext = type === "image/png" ? "png" : "jpg";
      const safe = (orderName || "shipment").replace(/[^\w.-]+/g, "-").slice(0, 40);
      return new File([shot.file], `${safe}-${index + 1}.${ext}`, { type });
    });
    const note = files.length === 0 ? body : `${body}\n\n${files.length} shipment ${files.length === 1 ? "photo" : "photos"} attached.`;
    if (files.length > 0 && typeof navigator.share === "function" && navigator.canShare?.({ files })) {
      try {
        await navigator.share({
          files,
          title: subject,
          text: `To: ${to}${cc ? `\nCc: ${cc}` : ""}\n\n${note}`,
        });
        return "shared" as const;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancel" as const;
      }
    }
    const extra = cc ? `&cc=${encodeURIComponent(cc)}` : "";
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(note)}${extra}`;
    return files.length > 0 ? "plain" as const : "mail" as const;
  }

  function keepTypedCode(code: string) {
    rememberTypedCode(code);
    setTypedCodes(readTypedCodes());
  }

  function shareBreakdown() {
    if (!isPlan(plan) || stories.length === 0) return;
    const blocks = stories.flatMap((item) => {
      if (item.byColor && item.sizeKey === "gal1") {
        if (item.key !== firstPaintKey || sharedPaint.length === 0) return [];
        const qty = sharedPaint.map((box) => mailBig(`${formatNum(box.boxes)} ${gallonBoxWord(box.kind, box.boxes)}`)).join("\n");
        return [[
          `[ ]  ${mailBold("Paint")}`,
          "Another department brings this. Not in this warehouse.",
          "",
          "SIZE",
          mailBig("1 Gallon"),
          "",
          "QTY",
          qty,
          "",
          "BATCH",
          "__________",
        ].join("\n")];
      }
      const parts = storyQtyParts(item, pailPer);
      const name = storyName(item, slipLines);
      const batch = item.sizeKey === "drawdown" ? "—" : storyBatch(item, slipLines, batchCodes);
      const explained = item.sizeKey === "gal5" ? pailExplain(item.total, pailPer) : null;
      const qty = explained ? mailBig(explained.line) : parts.map((part) => mailBig(`${part.count} ${part.label}`)).join("\n");
      const kit = item.kitUnits > 0 ? overtime125Pack(item.kitUnits).note : explained?.note ?? "";
      return [[
        `[ ]  ${mailBold(name)}`,
        ...(broughtIn(name, item.sizeKey) ? ["Another department brings this. Not in this warehouse."] : []),
        "",
        "SIZE",
        mailBig(checkSize(item.sizeKey)),
        "",
        "QTY",
        qty,
        ...(kit ? ["", kit] : []),
        "",
        "BATCH",
        batch,
      ].join("\n")];
    });
    const boxWord = containers.boxes === 1 ? "box" : "boxes";
    const pailWord = containers.pails === 1 ? "pail" : "pails";
    const pieceLabel = pieces === 1 ? "piece" : "pieces";
    const body = [
      "GameTime Logistics",
      "Load checklist",
      "",
      `Order: ${orderName || "—"}`,
      `Customer: ${customer || "—"}`,
      `Date: ${date || "—"}`,
      ...(bol.trim() ? [`BOL: ${bol.trim()}`] : []),
      "",
      ...blocks.flatMap((block) => [block, ""]),
      "Checked by ____________________    Date ____________________",
      "",
      `${formatNum(containers.boxes)} ${boxWord} + ${formatNum(containers.pails)} ${pailWord} = ${formatNum(pieces)} ${pieceLabel}`,
    ].join("\n");
    const subject = `Breakdown ${orderName || ""}`.trim();
    window.location.href = `mailto:brian@gametimecoatings.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function productBatch(name: string, size: SizeKey) {
    const match = slipLines.find((line) => lineTitle(line) === name && line.size === size);
    return match ? (batchCodes[match.id] ?? "") : "";
  }

  function setProductBatch(name: string, size: SizeKey, code: string) {
    setBatchCodes((current) => {
      const next = { ...current };
      for (const line of lines) {
        if (line.qty <= 0) continue;
        if (lineTitle(line) === name && line.size === size) next[line.id] = code;
      }
      return next;
    });
  }

  function padValue() {
    if (!batchPad) return "";
    if (batchPad.mode === "line") return batchCodes[batchPad.id] ?? "";
    return productBatch(batchPad.name, batchPad.size);
  }

  function changePad(update: (current: string) => string) {
    if (!batchPad) return;
    setConfirmReady(false);
    if (batchPad.mode === "line") {
      const id = batchPad.id;
      setBatchCodes((current) => ({ ...current, [id]: update(current[id] ?? "") }));
      return;
    }
    const name = batchPad.name;
    const size = batchPad.size;
    setBatchCodes((current) => {
      const match = lines.find((line) => line.qty > 0 && lineTitle(line) === name && line.size === size);
      const nextValue = update(match ? (current[match.id] ?? "") : "");
      const next = { ...current };
      for (const line of lines) {
        if (line.qty <= 0) continue;
        if (lineTitle(line) === name && line.size === size) next[line.id] = nextValue;
      }
      return next;
    });
  }

  async function shareAccounts() {
    if (!isPlan(plan) || slipLines.length === 0) return;
    const blocked = orderBlock();
    if (blocked) {
      setStatus(blocked);
      return;
    }
    const record: BatchRecord = {
      orderName,
      customer,
      batchDate: date,
      notes,
      lines: slipLines
        .filter((line) => !/shipping|freight/i.test(`${line.sku} ${line.description}`))
        .map((line) => ({
          sku: line.sku,
          product: productLabel(line.sku, line.description, line.size),
          size: checkSize(line.size),
          qty: formatNum(line.qty),
          batch: line.size === "drawdown" ? "" : (batchCodes[line.id] ?? "").trim(),
        })),
    };
    downloadRecord(record);
    const products: string[] = [];
    let paintListed = false;
    for (const item of stories) {
      if (item.byColor && item.sizeKey === "gal1") {
        if (paintListed || sharedPaint.length === 0) continue;
        paintListed = true;
        const qty = sharedPaint.map((box) => `${formatNum(box.boxes)} ${gallonBoxWord(box.kind, box.boxes)}`).join(", ");
        const codes = slipLines
          .filter((line) => isPaintGallon(line) && line.qty > 0)
          .map((line) => {
            const code = (batchCodes[line.id] ?? "").trim() || "—";
            const color = slipColor(line.description);
            return color ? `${color} ${code}` : code;
          })
          .join(", ");
        products.push(`${mailBold("Paint")}  —  1 Gallon  —  ${qty}  —  ${codes}`);
        continue;
      }
      const explained = item.sizeKey === "gal5" ? pailExplain(item.total, pailPer) : null;
      const qty = explained ? (explained.note ? `${explained.line} — ${explained.note}` : explained.line) : storyQtyParts(item, pailPer).map((part) => `${part.count} ${part.label}`).join(", ");
      const kit = item.kitUnits > 0 ? ` — ${overtime125Pack(item.kitUnits).note}` : "";
      const batch = storyBatch(item, slipLines, batchCodes);
      products.push(`${mailBold(storyName(item, slipLines))}  —  ${checkSize(item.sizeKey)}  —  ${qty}${kit}  —  ${batch === "__________" ? "—" : batch}`);
    }
    const photoLine = shots.length === 0 ? "None" : shots.length === 1 ? "1 photo attached" : `${shots.length} photos attached`;
    const body = [
      `${mailBold("Customer")}  ${customer.trim() || "—"}`,
      `${mailBold("Packing slip")}  ${orderName.trim() || "—"}`,
      `${mailBold("Shipping company")}  ${carrier.trim() || "—"}`,
      `${mailBold("BOL PRO")}  ${bol.trim() || "—"}`,
      `${mailBold("Photos")}  ${photoLine}`,
      "",
      ...products,
    ].join("\n");
    const subject = `${customer.trim() || "Shipment"} ${orderName.trim()}`.trim();
    const sent = await deliverMail("brian@gametimecoatings.com", subject, body);
    if (sent === "cancel") {
      setStatus("Email canceled. The photos are still on this order.");
      return;
    }
    setConfirmReady(true);
    if (sent === "shared") setStatus("Confirmation is ready with the photos. Send it to brian@gametimecoatings.com.");
    else if (sent === "plain") setStatus("This phone opened the email without the photos. Attach them from your camera roll.");
    else setStatus("Confirmation is in your email. Send it to the team when it looks right.");
  }

  async function shareTeam() {
    if (!confirmReady) {
      setStatus("Email the confirmation to yourself first.");
      return;
    }
    const blocked = orderBlock();
    if (blocked) {
      setConfirmReady(false);
      setStatus(blocked);
      return;
    }
    const tagged = salespersonEmail.trim();
    const already = TEAM_EMAILS.some((email) => email.toLowerCase() === tagged.toLowerCase());
    const who = tagged ? `${salespersonName ? `${salespersonName} ` : ""}<${tagged}>` : "not on the slip";
    const body = [
      "CONFIRMATION",
      `Shipment # ${orderName || "Order"}`,
      `Shipped to ${customer || "Customer"}`,
      `Salesperson: ${who}`,
      `BOL: ${bol.trim() || "none"}`,
      "",
      ...slipLines
        .filter((line) => !/shipping|freight/i.test(`${line.sku} ${line.description}`))
        .map((line, index) => {
          const product = productLabel(line.sku, line.description, line.size);
          const size = checkSize(line.size);
          const explained = line.size === "gal5" ? pailExplain(line.qty, pailPer) : null;
          const batch = line.size === "drawdown" ? "Ship by FedEx or UPS. Not on a pallet." : `Batch    ${mailBold((batchCodes[line.id] ?? "").trim() || "—")}`;
          return [`${index + 1}. ${mailBold(product)}`, `Size     ${size}`, `Qty      ${explained ? explained.line : formatNum(line.qty)}`, ...(explained?.note ? [explained.note] : []), batch, ""].join("\n");
        }),
    ].join("\n");
    const subject = `Packing Slip Shipment # ${orderName || "Order"}`.trim();
    const sent = await deliverMail(TEAM_EMAILS.join(","), subject, body, tagged && !already ? tagged : "");
    if (sent === "cancel") {
      setStatus("Email canceled. The photos are still on this order.");
      return;
    }
    if (sent === "shared") {
      setStatus(tagged ? `Photos are attached. Send it to the team and ${tagged}.` : "Photos are attached. Send it to the team.");
      return;
    }
    if (sent === "plain") {
      setStatus("This phone opened the team email without the photos. Attach them from your camera roll.");
      return;
    }
    setStatus(tagged ? `Team email includes ${tagged}.` : "No salesperson email was on this slip. The team list still opens.");
  }

  function refreshTabs() {
    linesRef.current = [];
    setLines([]);
    setLoaded({});
    setFocus(0);
    setOrderName("");
    setCustomer("");
    setNotes("");
    setSalespersonName("");
    setSalespersonEmail("");
    setHeaderOk(false);
    setBol("");
    setCarrier("");
    setShipMethod("");
    setConfirmReady(false);
    setDate("");
    setBatchCodes({});
    clearShots();
    setTaskMode(false);
    setStage("upload");
    setConfirmRefresh(false);
    setScanText("");setAppendScan(false);
    setActiveOpenId("");
    window.history.replaceState(null, "", window.location.pathname);
    setStatus("Cleared. Drop a PDF packing slip to start again.");
  }

  function applySlip(text: string) {
    if(appendScan&&scanText.trim())text=scanText+"\n\n"+text;
    setScanText(text);
    setActiveOpenId('');setCloudStatus('DRAFT');
    const parsed = parseOrderText(text);
    if (parsed.lines.length === 0) {
      setStatus(parsed.warnings[0] ?? "No product lines found. Use the original PDF packing slip.");
      return false;
    }
    const meta = parseSlipMeta(text);
    const seller = salespersonFromSlip(text);
    const nextLines = parsed.lines.map((line) => ({
      id: newId(),
      sku: line.sku,
      description: line.description,
      size: line.size,
      qty: toUnits(line, rules),
    }));
    const codes = extractBatchCodes(text);
    const filled: Record<string, string> = {};
    if (codes.length === nextLines.length) {
      nextLines.forEach((line, index) => {
        filled[line.id] = codes[index];
      });
    }
    const combined = nextLines;
    linesRef.current = combined;
    const nextPlan = buildPlan(combined, rules, { mixSmall, palletTareLb });
    setLines(combined);
    setTaskMode(false);
    setStage("build");
    setLoaded({});
    setFocus(0);
    setBatchCodes(filled);
    clearShots();
    setDate(todayStamp());
    setOrderName(meta.orderName);
    setCustomer(meta.customer);
    setNotes(meta.po ? `PO ${meta.po}` : "");
    setSalespersonName(seller.name);
    setSalespersonEmail(seller.email);
    setHeaderOk(false);
    setBol("");
    setCarrier("");
    setShipMethod(shipMethodFromSlip(text));
    setConfirmReady(false);
    window.history.replaceState(null, "", window.location.pathname);
    if (isAdmin) {
      void postDeskOrder({
        data: {
          orderName: meta.orderName,
          customer: meta.customer,
          notes: meta.po ? `PO ${meta.po}` : "",
          lines: nextLines.map((line) => ({
            id:line.id,
            sku: line.sku,
            description: line.description,
            size: line.size,
            qty: line.qty,
          })),
        },
      }).then(result=>{setActiveOpenId(result.id);setCloudStatus('DRAFT');setCloudMessage('Draft saved live');}).catch(e=>setCloudMessage('Not saved: '+e.message));
    }
    if (isPlan(nextPlan)) {
      setStatus(
        `${meta.orderName || "Order"} is ready. ${parsed.lines.length} lines, about ${nextPlan.totals.pallets} pallets. The pallet count is an estimate. Check each product as you load it.`,
      );
    } else {
      setStatus(nextPlan.error);
    }
    return true;
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|gif)$/i.test(file.name);
    if(isImage){setBusy(true);setStatus('Set the four corners around the complete page.');try{const canvas=await scanPage(file);if(!canvas)return;const blob=await new Promise<Blob>(r=>canvas.toBlob((b:Blob|null)=>r(b!), 'image/jpeg',.98));const text=await readSlipPhoto(new File([blob],'scanned-page.jpg',{type:'image/jpeg'}));applySlip(text);setStatus('Photo read. Compare every row and quantity against the original slip before checking products.');}catch(e){setStatus(e instanceof Error?e.message:'Could not read image')}finally{setBusy(false)}return;}
    setBusy(true);
    setStatus("Reading packing slip…");
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        applySlip(await file.text());
        return;
      }
      const base64 = await fileToBase64(file);
      const result = await readPackingSlip({ data: { base64 } });
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      applySlip(result.text);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't read that packing slip.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (hasOrder) void nav.setAppBadge?.(1).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [hasOrder]);

  useEffect(() => {
    const queue = (
      window as Window & {
        launchQueue?: { setConsumer: (cb: (params: { files: Array<{ getFile: () => Promise<File> }> }) => void | Promise<void>) => void };
      }
    ).launchQueue;
    queue?.setConsumer(async (params) => {
      for (const handle of params.files ?? []) {
        const file = await handle.getFile();
        if (file.type.startsWith("image/")) continue;
        await onFile(file);
      }
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") !== "1") return;
    void (async () => {
      const shared = await consumeSharedInbox();
      if (shared.length === 0) return;
      window.history.replaceState(null, "", window.location.pathname);
      const files = shared.filter((file) => !file.type.startsWith("image/"));
      if (files.length === 0) {
        setStatus("Photos are not used. Share the original PDF packing slip.");
        return;
      }
      for (const file of files) await onFile(file);
    })();
  }, []);

  function updateRule(size: SizeKey, patch: Partial<PalletRule>) {
    setRules((current) => current.map((rule) => (rule.size === size ? { ...rule, ...patch } : rule)));
  }

  function saveRules() {
    const error = ruleError(rules);
    if (error) {
      setStatus(error);
      return;
    }
    localStorage.setItem(RULES_KEY, JSON.stringify({ rules, mixSmall }));
    setStatus("Pallet rules saved. They stay on this device for the next order.");
  }

  function resetRules() {
    setRules(DEFAULT_RULES);
    setMixSmall(DEFAULT_SETTINGS.mixSmall);
    localStorage.setItem(
      RULES_KEY,
      JSON.stringify({ rules: DEFAULT_RULES, mixSmall: DEFAULT_SETTINGS.mixSmall }),
    );
    setStatus("Pallet rules reset to the floor defaults and saved.");
  }

  async function loadOpen(order: OpenOrder) {
    if (order.id === activeOpenId && lines.some((line) => line.qty > 0)) {
      setStage("build");
      return;
    }
    if (activeOpenId && activeOpenId !== order.id) {
      void releaseDeskOrder({ data: { id: activeOpenId, session: workSessionId() } }).catch(() => undefined);
    }
    const saved=await deskStatus(order.id);const floor=saved.pallet_plan?.floor||{};
    skipNextAutoSave.current=true;
    setCloudStatus(saved.status);setInventoryProducts(floor.inventoryProducts||{});
    setActiveOpenId(order.id);
    setOrderName(order.orderName);
    setCustomer(order.customer);
    setNotes(order.notes);
    setLines(
      order.lines.map((line) => ({
        id: (line as OrderLine).id||newId(),
        sku: line.sku,
        description: line.description,
        size: line.size,
        qty: line.qty,
      })),
    );
    setLoaded({});
    setBatchCodes({});
    clearShots();
    setFocus(0);
    setTaskMode(false);
    setStage("build");
    if(floor.lines)setLines(floor.lines);if(floor.rules)setRules(floor.rules);if(typeof floor.mixSmall==='boolean')setMixSmall(floor.mixSmall);if(typeof floor.palletTareLb==='number')setPalletTareLb(floor.palletTareLb);if(floor.date)setDate(floor.date);setScanText(floor.slipText||'');setBatchCodes(floor.batchCodes||{});setLoaded(floor.loaded||{});setHeaderOk(!!floor.headerOk);setBol(floor.bol||'');setCarrier(floor.carrier||'');setSalespersonName(floor.salespersonName||'');setSalespersonEmail(floor.salespersonEmail||'');
    const worker = account?.display_name||'Shipping';
    void claimDeskOrder({ data: { id: order.id, session: workSessionId(), worker } }).catch(() => undefined);
    setStatus(`${order.orderName || "Order"} is open. Check each product, then mark it complete.`);
  }

  async function openSavedShipment(id:string){
    try{
      await cloudQueue.current.catch(()=>{});
      const saved=await deskStatus(id),floor=saved.pallet_plan?.floor||{};
      let savedLines=floor.lines;
      if(!savedLines){const r=await db.from('shipping_lines').select('id,sku,description,size,qty').eq('shipment_id',id).order('line_order');if(r.error)throw r.error;savedLines=r.data||[];}
      await loadOpen({id,orderName:saved.shipment_number||saved.packing_slip||'',customer:saved.customer||'',notes:saved.notes||'',lines:savedLines,openedAt:Date.parse(saved.created_at),worker:floor.worker||'',workerSession:floor.workerSession||'',claimedAt:floor.claimedAt||0,checked:floor.checked||0,total:floor.total||0,ready:saved.status==='READY'});
      setCloudMessage(saved.status==='SHIPPED'?'Finished / shipped — reprints do not deduct inventory again.':saved.status+' — saved order opened.');
    }catch(e){setCloudMessage(e instanceof Error?e.message:'Could not open saved order.');}
  }

  async function markComplete() {
    if (!recordReady || !isPlan(plan)) return;
    const cloudId=cloudStatus==='SHIPPED'?activeOpenId:await saveFactory(true);if(!cloudId)return;
    const finishedBy = account?.display_name||'Shipping';
    const recordLines = plan.pallets.flatMap((pallet) =>
      pallet.lines.map((line) => {
        const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
        const source = lines.find((item) => item.sku.toUpperCase() === line.sku.toUpperCase() && item.size === line.size);
        return {
          name: productLabel(line.sku, line.description, line.size),
          qty: containerPhrase(line.size, count, pailPer),
          sku: line.sku,
          size: sizeTitle(line.size),
          batch: source ? (batchCodes[source.id] ?? "").trim() : "",
        };
      }),
    );
    const result = await completeDeskOrder({
      data: {
        id: cloudId,
        floor:deskState(),
        day: todayStamp(),
        orderName: orderName || "Order",
        customer: customer || "Customer",
        notes,
        finishedBy,
        pallets: plan.totals.pallets,
        pails: containers.pails,
        boxes: containers.boxes,
        lines: recordLines,
      },
    });
    if (!result.ok) {
      setStatus("That order is already complete or was canceled.");
      return;
    }
    boardGen.current += 1;
    openSnap.current = "";
    doneSnap.current = "";
    downloadRecord({
      orderName,
      customer,
      batchDate: date,
      notes,
      lines: recordLines.map((line) => ({
        sku: line.sku,
        product: line.name,
        size: line.size,
        qty: line.qty,
        batch: line.batch,
      })),
    });
    setOpenOrders((current) => current.filter((order) => order.id !== activeOpenId));
    setActiveOpenId("");
    setLines([]);
    setLoaded({});
    setFocus(0);
    setOrderName("");
    setCustomer("");
    setNotes("");
    setSalespersonName("");
    setSalespersonEmail("");
    setHeaderOk(false);
    setBol("");
    setCarrier("");
    setShipMethod("");
    setConfirmReady(false);
    setBatchCodes({});
    clearShots();
    setTaskMode(false);
    setStage("upload");
    setStatus("Order complete. The record PDF downloaded.");
  }

  async function sendBack() {
    if (!recordReady || !isPlan(plan)) return;
    await returnDeskOrder({
      data: {
        orderName: orderName || "Order",
        customer: customer || "Customer",
        notes,
        finishedBy: "Annette",
        pallets: plan.totals.pallets,
        pails: containers.pails,
        boxes: containers.boxes,
        lines: plan.pallets.flatMap((pallet) =>
          pallet.lines.map((line) => {
            const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
            const source = lines.find((item) => item.sku.toUpperCase() === line.sku.toUpperCase() && item.size === line.size);
            return {
              name: productLabel(line.sku, line.description, line.size),
              qty: containerPhrase(line.size, count, pailPer),
              sku: line.sku,
              size: sizeTitle(line.size),
              batch: source ? (batchCodes[source.id] ?? "").trim() : "",
            };
          }),
        ),
      },
    });
    setLines([]);
    setLoaded({});
    setFocus(0);
    setOrderName("");
    setCustomer("");
    setNotes("");
    setSalespersonName("");
    setSalespersonEmail("");
    setHeaderOk(false);
    setBol("");
    setCarrier("");
    setShipMethod("");
    setConfirmReady(false);
    setBatchCodes({});
    clearShots();
    setTaskMode(false);
    setStage("upload");
    setStatus("Sent back to the admin board to confirm.");
  }

  function acceptReturn(item: ReturnSlip) {
    const entry: DayOrder = {
      id: item.id,
      at: new Date(item.finishedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      orderName: item.orderName || "Order",
      customer: item.customer || "Customer",
      notes: item.notes,
      batchDate: date,
      pallets: item.pallets,
      pails: item.pails,
      boxes: item.boxes,
      lines: item.lines,
    };
    const next = [entry, ...readToday()];
    localStorage.setItem(DAY_KEY, JSON.stringify({ date: todayStamp(), orders: next }));
    setDayOrders(next);
    setReturns((current) => current.filter((slip) => slip.id !== item.id));
    void confirmDeskOrder({ data: { id: item.id } }).catch(() => undefined);
    downloadRecord({
      orderName: item.orderName,
      customer: item.customer,
      batchDate: date,
      notes: item.notes,
      lines: item.lines.map((line) => ({
        sku: line.sku,
        product: line.name,
        size: line.size,
        qty: line.qty,
        batch: line.batch,
      })),
    });
  }

  function addContact() {
    const name = contactName.trim();
    const phone = contactPhone.trim();
    const email = contactEmail.trim();
    if (!name || (!phone && !email)) {
      setStatus("A contact needs a name and a phone number or email.");
      return;
    }
    const next = [{ id: newId(), name, phone, email }, ...contacts];
    setContacts(next);
    writeContacts(next);
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setStatus(`${name} saved in contacts.`);
  }

  function removeContact(id: string) {
    const next = contacts.filter((contact) => contact.id !== id);
    setContacts(next);
    writeContacts(next);
  }

  return (
    <main className="relative flex min-h-dvh flex-col">
      <div className="desk-art" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh flex-1 flex-col">
        <datalist id={BATCH_LIST_ID}>
          {typedCodes.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
        <header className="desk-header">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src="/shipping-desk/gametime-logo.jpg"
                alt="GameTime Logistics"
                width={280}
                height={280}
                className="desk-mark"
              />
              <div className="min-w-0">
                <p className="desk-kicker">Pallet calculator</p>
                <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">GameTime Logistics</h1>
                <p className="desk-live" aria-live="polite">
                  <span className="desk-dot" />
                  {showHomeIntro ? "Browser" : "Installed"}
                </p>
                <p className="desk-mission">
                  Drop the packing slip. It lists every product and the count. Check it off, write the batch code, and load it right.
                </p>
              </div>
            </div>
            {hasOrder ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:w-[26rem]">
              <label className="desk-field">
                Order
                <input
                  value={orderName}
                  readOnly={!isAdmin}
                  onChange={(event) => setOrderName(event.target.value)}
                  placeholder="From the slip"
                />
              </label>
              <label className="desk-field">
                Customer
                <input
                  value={customer}
                  readOnly={!isAdmin}
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="Ship to"
                />
              </label>
              <label className="desk-field">
                Date
                <input
                  type="date"
                  value={date}
                  readOnly={!isAdmin}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            </div>
            ) : null}
          </div>
        </header>
        <div className="brand-rule" />
        <section className="no-print border-b border-line bg-card px-5 py-3 text-sm">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-3"><a href="/index.html">Factory board</a>{[account?.role,...(account?.page_roles||[])].some(r=>["inventory","manager","chemist"].includes(r||""))&&<a href="/inventory.html">Inventory</a>}<span>{account?.display_name} · {cloudMessage}</span>
          {hasOrder&&<><button className="katchup-btn" disabled={cloudStatus==='SHIPPED'} onClick={()=>void saveFactory()}>Save live draft</button><button className="katchup-btn" disabled={!recordReady||cloudStatus==='SHIPPED'} onClick={()=>void saveFactory(true)}>Save Ready</button><button className="katchup-btn is-lit" disabled={cloudStatus!=='READY'} onClick={()=>void markFactoryShipped()}>Mark Shipped</button></>}
          </div>
          {hasOrder&&<details className="mx-auto max-w-6xl mt-2"><summary>Inventory products — review before shipping</summary><datalist id="factory-stock-products">{stockProducts.map(p=><option key={p} value={p}/>)}</datalist>{lines.filter(l=>l.qty>0&&l.size!=='drawdown').map(l=><label key={l.id} className="block my-2">{l.sku} · {l.description}<input className="ml-2 border border-line bg-card p-2" list="factory-stock-products" value={inventoryProducts[l.id]??productLabel(l.sku,l.description,l.size)} onChange={e=>setInventoryProducts(p=>({...p,[l.id]:e.target.value}))}/></label>)}</details>}
          {dayOrders.length>0&&<details className="mx-auto max-w-6xl mt-2"><summary>Completed loading — dispatch status</summary>{dayOrders.map(d=><DispatchRow key={d.id} id={d.id} name={d.orderName} ship={()=>markFactoryShipped(d.id)}/>)}</details>}
        </section>
        <ShippingStatusTabs onOpen={openSavedShipment}/>
        {(printPending||printBusy)&&<div className="no-print fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-5"><div role="dialog" aria-modal="true" aria-labelledby="print-confirm-title" className="bg-card border border-line rounded-xl p-6 max-w-lg w-full">
          <h2 id="print-confirm-title" className="text-xl font-bold">{printPending?'Was the breakdown printed?':'Preparing breakdown…'}</h2>
          {printPending&&<><p className="my-4">Packing Slip: <strong>{printPending.state.orderName}</strong>. Confirm only after the breakdown was printed. Inventory is deducted once for this slip, including reprints.</p>
          {printBusy&&<p role="status" className="my-3">Saving the printed order — inventory has not been deducted yet.</p>}
          {printError&&<p role="alert" className="my-3">{printError}</p>}
          <div className="flex flex-wrap gap-3"><button className="katchup-btn" type="button" onClick={()=>window.print()}>Print again</button>{printError&&<button className="katchup-btn" type="button" disabled={printBusy} onClick={()=>void preparePrintedSnapshot(printPending.state)}>Retry live save</button>}<button autoFocus className="katchup-btn is-lit" disabled={printBusy||!printPending.id||!!printError} onClick={()=>void confirmPrinted()}>Printed — update inventory</button><button className="katchup-btn" disabled={printBusy} onClick={cancelPrint}>Canceled / not printed</button></div></>}
        </div></div>}
        <InstallApp />
        {scanBol ? (
          <BolScan
            onClose={() => setScanBol(false)}
            onCode={(code) => {
              setBol(code);
              setConfirmReady(false);
              setScanBol(false);
            }}
          />
        ) : null}

        <div className="print-page mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">

          {isAdmin ? (
            <section
              className={"slip-well no-print" + (dragOver ? " is-over" : "")}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = [...event.dataTransfer.files][0];
                if (file) void onFile(file);
              }}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="desk-kicker">Intake</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">Packing slip</h2>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                    Drop the original PDF, or tap to choose it. The file is read as text so the counts stay exact.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <label className={"catch-btn" + (busy ? " is-busy" : "")}>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,application/pdf,.txt,.csv,text/plain,text/csv,image/*"
                    disabled={busy}
                    className="file-tap"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void onFile(file);
                    }}
                  />
                  <span>{busy ? "Reading…" : "Upload PDF"}</span>
                </label>
                <input ref={pageCameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void onFile(f)}}/>
                <button type="button" disabled={busy} className="katchup-btn" onClick={()=>pageCameraRef.current?.click()}>Scan page</button>
                <label className="text-sm"><input type="checkbox" checked={appendScan} onChange={e=>setAppendScan(e.target.checked)}/> Add next page</label>
                {confirmRefresh ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">Clear this order?</span>
                    <button type="button" onClick={refreshTabs} className="katchup-btn is-lit">
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirmRefresh(false)} className="katchup-btn">
                      No
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmRefresh(true)} className="katchup-btn">
                    Clear
                  </button>
                )}
                </div>
              </div>
              <p className="mt-4 min-h-5 text-sm text-ink" aria-live="polite">
                {status}
              </p>
            </section>
          ) : null}

          {!hasOrder || (stage !== "choose" && stage !== "build") ? null : !isPlan(plan) ? (
            <p className="border border-line bg-card px-4 py-3 text-sm">{plan.error}</p>
          ) : (
            <section className="print-sheet desk-sheet">
              <article className="handout">
                <div className="hand-top">
                  <div>
                    <p className="hand-kicker">GameTime Logistics</p>
                    <h2>Load checklist</h2>
                  </div>
                  <div className="hand-facts">
                    <p><span>Order</span><strong>{orderName || "—"}</strong></p>
                    <p><span>Customer</span><strong>{customer || "—"}</strong></p>
                    <p><span>Date</span><strong>{date || "—"}</strong></p>
                    {bol ? <p><span>BOL</span><strong>{bol}</strong></p> : null}
                    {shipMethod ? (
                      <p>
                        <span>Ship via</span>
                        <strong>{shipMethod === "FedEx Ground" ? "FedEx Ground. Ships from another department." : shipMethod}</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                <table>
                  <colgroup>
                    <col className="col-done" />
                    <col className="col-name" />
                    <col className="col-size" />
                    <col className="col-slip" />
                    <col className="col-qty" />
                    <col className="col-batch" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Done</th>
                      <th>Product</th>
                      <th>Size</th>
                      <th>Slip quantity</th>
                      <th>Actual load</th>
                      <th>Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stories.map((item) => {
                      if (item.byColor && item.sizeKey === "gal1") {
                        if (item.key !== firstPaintKey || sharedPaint.length === 0) return null;
                        return (
                          <tr key="paint-boxes">
                            <td className="hand-done"><span className="tick" /></td>
                            <td>
                              <strong className="hand-name">Paint</strong>
                              <span className="hand-note">Another department brings this. Not in this warehouse.</span>
                            </td>
                            <td className="hand-size">1 Gallon</td>
                            <td className="hand-slip">
                              <strong>{formatNum(stories.filter((row) => row.byColor && row.sizeKey === "gal1").reduce((sum, row) => sum + row.slipQty, 0))}</strong>
                              <span>gallons</span>
                            </td>
                            <td className="hand-qty">
                              <span className="hand-boxmix">
                                {sharedPaint.map((box) => (
                                  <span key={box.kind}>
                                    <strong>{formatNum(box.boxes)}</strong> {gallonBoxWord(box.kind, box.boxes)}
                                  </span>
                                ))}
                              </span>
                            </td>
                            <td className="hand-batch"><span className="batch-blank">&nbsp;</span></td>
                          </tr>
                        );
                      }
                      if (item.sizeKey === "quart" && !/cataly|catylist/i.test(item.name)) {
                        if (item.key !== firstQuartKey || sharedQuarts.length === 0) return null;
                        const quartStories = stories.filter((row) => row.sizeKey === "quart" && !/cataly|catylist/i.test(row.name));
                        const cans = quartStories.reduce((sum, row) => sum + row.slipQty, 0);
                        const boxes = sharedQuarts.reduce((sum, box) => sum + box.boxes, 0);
                        const pallets = Math.floor(boxes / 180);
                        const extra = boxes % 180;
                        const title = quartStories.length === 1 ? storyName(quartStories[0], slipLines) : "Quarts";
                        return (
                          <tr key="quart-boxes">
                            <td className="hand-done"><span className="tick" /></td>
                            <td>
                              <strong className="hand-name">{title}</strong>
                              {quartStories.length > 1 ? (
                                <span className="hand-note">{quartStories.map((row) => `${storyName(row, slipLines)} ${formatNum(row.slipQty)}`).join(" · ")}</span>
                              ) : null}
                              <span className="hand-note">Colors can share a box. 4 quarts to a box.</span>
                            </td>
                            <td className="hand-size">Quart</td>
                            <td className="hand-slip">
                              <strong>{formatNum(cans)}</strong>
                              <span>{cans === 1 ? "quart" : "quarts"}</span>
                            </td>
                            <td className="hand-qty">
                              <span className="hand-boxmix">
                                {sharedQuarts.map((box) => (
                                  <span key={box.kind}>
                                    <strong>{formatNum(box.boxes)}</strong> {box.kind}-quart {box.boxes === 1 ? "box" : "boxes"}
                                  </span>
                                ))}
                              </span>
                              {pallets > 0 ? (
                                <span className="hand-note">
                                  {formatNum(pallets)} {pallets === 1 ? "pallet" : "pallets"}
                                  {extra > 0 ? ` / ${formatNum(extra)} extra` : ""}. 180 4-quart boxes = 1 pallet
                                </span>
                              ) : null}
                            </td>
                            <td className="hand-batch"><span className="batch-blank">&nbsp;</span></td>
                          </tr>
                        );
                      }
                      const mail = item.sizeKey === "drawdown";
                      const parts = storyQtyParts(item, pailPer);
                      const name = storyName(item, slipLines);
                      const outside = broughtIn(name, item.sizeKey);
                      return (
                        <tr key={item.key}>
                          <td className="hand-done"><span className="tick" /></td>
                          <td>
                            <strong className="hand-name">{name}</strong>
                            {outside ? <span className="hand-note">Another department brings this. Not in this warehouse.</span> : null}
                          </td>
                          <td className="hand-size">{checkSize(item.sizeKey)}</td>
                          <td className="hand-slip">
                            <strong>{formatNum(item.slipQty || item.ordered)}</strong>
                            <span>{slipBeforeWord(item)}</span>
                          </td>
                          <td className="hand-qty">
                            {item.kitUnits > 0 ? (
                              <Overtime125Qty units={item.kitUnits} />
                            ) : item.sizeKey === "quart" && /catalyst/i.test(item.name) && item.quarts > 0 ? (
                              <CatalystQty quarts={item.quarts} />
                            ) : item.alphaOmega && item.sizeKey === "gal1" ? (
                              <CasePalletQty cans={item.slipQty || item.ordered} perBox={4} boxesPerPallet={30} kind="gallon" />
                            ) : item.sizeKey === "gal5" ? (
                              <PailQty pails={item.total} per={pailPer} />
                            ) : parts.length === 1 ? (
                              <>
                                <strong>{parts[0].count}</strong>
                                <span>{parts[0].label}</span>
                              </>
                            ) : (
                              <span className="hand-boxmix">
                                {parts.map((part) => (
                                  <span key={part.label}>
                                    <strong>{part.count}</strong> {part.label}
                                  </span>
                                ))}
                              </span>
                            )}
                          </td>
                          <td className="hand-batch">{mail ? "—" : <span className="batch-blank">&nbsp;</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="hand-sign">Checked by ____________________ &nbsp;&nbsp; Date ____________________</p>
                <p className="hand-pieces">
                  {formatNum(containers.boxes)} {containers.boxes === 1 ? "box" : "boxes"}
                  {" + "}
                  {formatNum(containers.pails)} {containers.pails === 1 ? "pail" : "pails"}
                  {" = "}
                  <strong>{formatNum(pieces)} {pieces === 1 ? "piece" : "pieces"}</strong>
                </p>
                <p className="hand-check"><span className="tick" /> Verify that this printout matches the packing slip before loading. Product, size, quantity, and batch code must agree.</p>
              </article>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 print-head">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.18em] text-muted">
                    PACKING SLIP {orderName || "—"}
                    <span className="print-only"> · {customer || "Customer"} · {date || "—"}</span>
                  </p>
                  <h2 className="screen-detail mt-1 text-2xl font-semibold tracking-tight">{customer || "Customer"}</h2>
                  {salespersonEmail ? (
                    <p className="mt-1 text-sm text-muted">
                      Salesperson {salespersonName ? `${salespersonName} · ` : ""}{salespersonEmail}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[#ff8d8d]">No salesperson email was on this slip.</p>
                  )}
                  <label className="no-print mt-3 flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={headerOk}
                      onChange={(event) => setHeaderOk(event.target.checked)}
                      className="mt-0.5 size-11 shrink-0 touch-manipulation accent-mustard"
                    />
                    <span>Shipment, customer, and salesperson match the paper.</span>
                  </label>
                  <label className="no-print mt-3 block text-sm">
                    <span className="font-semibold">Shipping company</span>
                    <input
                      value={carrier}
                      onChange={(event) => {
                        setCarrier(event.target.value);
                        setConfirmReady(false);
                      }}
                      placeholder="Shipping company"
                      className="mt-1 h-12 w-full max-w-sm touch-manipulation border border-line bg-card px-3 text-base outline-none"
                    />
                  </label>
                  <label className="mt-3 block text-sm">
                    <span className="font-semibold">{carrier.trim() ? `${carrier.trim()} BOL number` : "Shipping BOL"}</span>
                    <span className="mt-1 flex max-w-sm gap-2">
                      <input
                        value={bol}
                        onChange={(event) => {
                          setBol(event.target.value);
                          setConfirmReady(false);
                        }}
                        placeholder={needsBol ? "PRO number" : "None for mail-only"}
                        inputMode="numeric"
                        className="h-12 min-w-0 flex-1 touch-manipulation border border-line bg-card px-3 font-mono text-base outline-none"
                      />
                      <button
                        type="button"
                        className="no-print h-12 shrink-0 border border-line bg-card px-3 text-sm font-semibold"
                        onClick={() => setScanBol(true)}
                      >
                        Scan
                      </button>
                    </span>
                    <span className="no-print mt-1 block text-xs text-muted">Scan the PRO barcode on the bill of lading, or type it.</span>
                  </label>
                  <p className="print-blurb mt-2 max-w-xl text-base leading-relaxed">
                    Check the bold count against the slip. Pallet numbers are only an estimate.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 no-print">
                  <button type="button" onClick={()=>void printBreakdown()} disabled={printBusy} className="katchup-btn is-lit">
                    Print breakdown
                  </button>
                  <button type="button" onClick={shareBreakdown} className="katchup-btn">
                    Email breakdown
                  </button>
                  <button type="button" onClick={shareAccounts} className="katchup-btn">
                    Email me
                  </button>
                  {confirmReady ? (
                    <button type="button" onClick={shareTeam} className="katchup-btn is-lit">
                      Send to team
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="no-print border-t border-line px-5 py-4">
                <h3 className="text-base font-semibold">Shipment photos</h3>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  Take a photo or attach pictures of this order. They go with the confirmation email.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="katchup-btn is-lit">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="file-tap"
                      onChange={(event) => {
                        addShots(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    Take photo
                  </label>
                  <label className="katchup-btn">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="file-tap"
                      onChange={(event) => {
                        addShots(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    Attach photos
                  </label>
                </div>
                {shots.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-3">
                    {shots.map((shot) => (
                      <li key={shot.id} className="w-24">
                        <img src={shot.url} alt="" className="h-24 w-24 border border-line object-cover" />
                        <button
                          type="button"
                          onClick={() => removeShot(shot.id)}
                          className="mt-1 w-full text-left text-xs font-semibold text-[#ff8d8d]"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="print-stats grid grid-cols-2 sm:grid-cols-4">
                <div className="border-b border-line bg-mustard px-5 py-4 text-black sm:border-b-0">
                  <p className="font-mono text-[11px] tracking-[0.16em] text-black">FULL PALLETS, ABOUT</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tabular-nums leading-none">{formatNum(plan.totals.full)}</p>
                </div>
                <div className="border-b border-l border-line px-5 py-4 sm:border-b-0">
                  <p className="font-mono text-[11px] tracking-[0.16em] text-muted">PALLETS, ABOUT</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tabular-nums leading-none">{formatNum(plan.totals.pallets)}</p>
                </div>
                <div className="border-l border-line px-5 py-4">
                  <p className="font-mono text-[11px] tracking-[0.16em] text-muted">PAILS</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tabular-nums leading-none">{formatNum(containers.pails)}</p>
                </div>
                <div className="border-l border-line px-5 py-4">
                  <p className="font-mono text-[11px] tracking-[0.16em] text-muted">BOXES</p>
                  <p className="mt-1 font-mono text-4xl font-semibold tabular-nums leading-none">{formatNum(containers.boxes)}</p>
                </div>
              </div>
              <div className="piece-total border-t border-line px-5 py-4">
                <p className="font-mono text-[11px] tracking-[0.16em] text-muted">TOTAL PIECES</p>
                <p className="piece-num mt-1 font-mono text-5xl font-bold tabular-nums leading-none">{formatNum(pieces)}</p>
                <p className="mt-2 text-base">
                  <span className="font-bold">{formatNum(containers.pails)} {containers.pails === 1 ? "pail" : "pails"}</span>
                  {" + "}
                  <span className="font-bold">{formatNum(containers.boxes)} {containers.boxes === 1 ? "box" : "boxes"}</span>
                </p>
              </div>
              <div className="border-t border-line">
                <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <h3 className="text-base font-semibold">Check each product</h3>
                  <p className="print-blurb text-base font-bold">{formatNum(pieces)} pieces</p>
                </div>
                {orderBlock() ? <p className="no-print px-5 pb-3 text-sm font-semibold text-[#ff8d8d]">{orderBlock()}</p> : null}
                <div className="no-print mx-5 mb-3 h-2 bg-stripe">
                  <div
                    className="h-2 bg-mustard"
                    style={{ width: checkTotal === 0 ? "0%" : `${Math.round((checkedCount / checkTotal) * 100)}%` }}
                  />
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {stories.map((item) => {
                    const checked = Boolean(loaded[item.key]);
                    const mail = item.sizeKey === "drawdown";
                    const matches = mail || item.ordered === item.placed;
                    const parts = storyQtyParts(item, pailPer);
                    const explained = item.sizeKey === "gal5" ? pailExplain(item.total, pailPer) : null;
                    const kitNote = item.kitUnits > 0 ? overtime125Pack(item.kitUnits).note : "";
                    const loadLine = mail
                      ? "Mail. FedEx or UPS. Not a pallet."
                      : explained?.note
                        ? explained.note
                        : explained
                        ? ""
                        : item.full > 0
                        ? `${formatNum(item.full)} full ${item.full === 1 ? "pallet" : "pallets"}${item.each > 0 ? ` of ${formatNum(item.each)}` : ""}${item.leftover > 0 ? `. ${formatNum(item.leftover)} extra` : ""}`
                        : "Not a full pallet. Load these with the rest.";
                    const warn = matches ? "" : `Slip ${formatNum(item.ordered)}. Loaded ${formatNum(item.placed)}.`;
                    return (
                      <Fragment key={item.key}>
                      <li>
                        <label className={"flex cursor-pointer items-start gap-4 px-5 py-4 " + (checked ? "bg-[#2a2410]" : "bg-card")}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!matches) setStatus("This count does not match the slip. Check it only if the load is right.");
                              setConfirmReady(false);
                              setLoaded((current) => ({ ...current, [item.key]: !current[item.key] }));
                            }}
                            aria-label={`Checked ${checkSize(item.sizeKey)} ${item.name}`}
                            className="mt-1 size-11 shrink-0 touch-manipulation accent-mustard"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="print-only">
                              {checkSize(item.sizeKey)} · {item.name} · {explained ? `${explained.line}${explained.note ? `. ${explained.note}` : ""}` : parts.map((part) => `${part.count} ${part.label}`).join(", ")}{kitNote ? ` · ${kitNote}` : ""}{loadLine ? ` · ${loadLine}` : ""}
                              {warn ? ` ${warn}` : ""}
                            </span>
                            <span className="screen-detail">
                            <span className="mt-0.5 inline-block bg-mustard px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-black">{checkSize(item.sizeKey)}</span>
                            <span className={"mt-1 block text-xl font-semibold " + (checked ? "text-muted line-through" : "")}>{item.name}</span>
                            {loadLine ? <span className="mt-1 block text-base leading-snug">{loadLine}</span> : null}
                            {kitNote ? <span className="mt-1 block text-sm font-semibold">{kitNote}</span> : null}
                            {warn ? <span className="mt-1 block text-sm font-semibold text-[#ff8d8d]">{warn}</span> : null}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            {parts.map((part) => (
                              <span key={part.label} className="mb-1 block">
                                <span className="block font-mono text-3xl font-bold tabular-nums leading-none">
                                  {part.count}
                                </span>
                                <span className="mt-1 block text-sm font-bold uppercase tracking-wide">
                                  {part.label}
                                </span>
                              </span>
                            ))}
                          </span>
                        </label>
                        {item.sizeKey === "drawdown" ? null : (
                        <div className="print-only batch-spots">
                          {(() => {
                            const colors = slipLines.filter((line) => {
                              const detail = paintDetail(line.sku, line.description);
                              return Boolean(detail && slipColor(line.description) && detail.title === item.name && line.size === item.sizeKey);
                            });
                            const spots =
                              colors.length > 0
                                ? colors.map((line) => ({
                                    key: line.id,
                                    label: slipColor(line.description),
                                    code: (batchCodes[line.id] ?? "").trim(),
                                  }))
                                : [{ key: item.key, label: "", code: productBatch(item.name, item.sizeKey).trim() }];
                            return spots.map((spot) => (
                              <p key={spot.key}>
                                Batch code{spot.label ? ` · ${spot.label}` : ""}: <span className="batch-blank">{spot.code}</span>
                              </p>
                            ));
                          })()}
                        </div>
                        )}
                        {item.sizeKey === "drawdown" ? null : (
                        <div className="no-print px-5 pb-4">
                          {(() => {
                            const colors = slipLines.filter((line) => {
                              const detail = paintDetail(line.sku, line.description);
                              return Boolean(detail && slipColor(line.description) && detail.title === item.name && line.size === item.sizeKey);
                            });
                            if (colors.length === 0) {
                              return (
                                <>
                                  <span className="text-xs font-semibold tracking-wide text-muted">Batch code from the container</span>
                                  <button
                                    type="button"
                                    aria-label={`Batch code for ${item.name}`}
                                    onClick={(event) => {
                                      setBatchPad({ mode: "product", name: item.name, size: item.sizeKey });
                                      event.currentTarget.scrollIntoView({ block: "center" });
                                    }}
                                    className={"mt-1 h-12 w-full max-w-xs touch-manipulation border px-3 text-left font-mono text-lg " + (batchPad?.mode === "product" && batchPad.name === item.name && batchPad.size === item.sizeKey ? "border-mustard bg-[#2a2410]" : "border-line bg-card")}
                                  >
                                    {productBatch(item.name, item.sizeKey) || "Tap for the date"}
                                  </button>
                                </>
                              );
                            }
                            return (
                              <div className="grid gap-2">
                                {colors.map((line) => (
                                  <label key={line.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_12rem]">
                                    <span className="font-semibold">{slipColor(line.description)}</span>
                                    <span className="font-mono text-sm font-bold tabular-nums">{formatNum(line.qty)} gal</span>
                                    <button
                                      type="button"
                                      aria-label={`Batch code for ${slipColor(line.description)}`}
                                      onClick={(event) => {
                                        setBatchPad({ mode: "line", id: line.id });
                                        event.currentTarget.scrollIntoView({ block: "center" });
                                      }}
                                      className={"h-12 w-full touch-manipulation border px-3 text-left font-mono text-lg " + (batchPad?.mode === "line" && batchPad.id === line.id ? "border-mustard bg-[#2a2410]" : "border-line bg-card")}
                                    >
                                      {(batchCodes[line.id] ?? "") || "Tap for the date"}
                                    </button>
                                  </label>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        )}
                      </li>
                      {item.key === lastPaintKey && sharedPaint.length > 0 ? (
                        <li className="px-5 py-4">
                          <p className="text-base font-semibold">Paint boxes</p>
                          <p className="text-sm">Colors can share a box.</p>
                          {sharedPaint.map((box) => (
                            <p key={box.kind} className="mt-1 font-mono text-2xl font-bold">
                              {formatNum(box.boxes)} {gallonBoxWord(box.kind, box.boxes)}
                            </p>
                          ))}
                        </li>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </ul>
              </div>
              <div className="no-print border-t border-line px-4 py-3">
                <p className="text-sm text-muted">{checkedCount} of {checkTotal} products checked.</p>
              </div>
            </section>
          )}

          {stage === "codes" && checksDone ? (
            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-mono text-xs tracking-widest text-muted">BATCH CODES</h2>
                  <p className="mt-1 text-sm">{codedCount} of {codeLines.length} batch codes.</p>
                </div>
              </div>
              <div className="glass overflow-x-auto border border-white/70">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="bg-stripe text-left text-muted">
                    <tr>
                      {["SKU", "Product", "Size", "Qty", "Batch code"].map((heading) => (
                        <th key={heading} className="px-3 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slipLines.filter((line) => line.size !== "drawdown").map((line) => (
                      <tr key={line.id} className="border-t border-line">
                        <td className="px-3 py-2 font-mono">{line.sku}</td>
                        <td className="px-3 py-2">{productLabel(line.sku, line.description, line.size)}</td>
                        <td className="px-3 py-2">{sizeTitle(line.size)}</td>
                        <td className="px-3 py-2 text-right font-mono text-lg font-bold tabular-nums">
                          {formatNum(line.qty)}
                          {line.size === "gal5" && line.qty > pailPer ? (
                            <span className="mt-1 block text-xs font-semibold normal-case">{pailExplain(line.qty, pailPer).line}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            aria-label={`Batch code for ${productLabel(line.sku, line.description, line.size)}`}
                            onClick={() => setBatchPad({ mode: "line", id: line.id })}
                            className={"h-11 w-full min-w-36 touch-manipulation border px-2 text-left font-mono text-base " + (batchPad?.mode === "line" && batchPad.id === line.id ? "border-mustard bg-[#2a2410]" : "border-line bg-card")}
                          >
                            {(batchCodes[line.id] ?? "") || "Tap for the date"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {lines.some((line) => line.qty > 0) ? (
          <section className="no-print">
            <div className="mb-2">
              <h2 className="font-mono text-xs tracking-widest text-muted">ORDER LINES</h2>
            </div>
            <div className="glass overflow-x-auto border border-white/70">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-stripe text-left text-muted">
                  <tr>
                    {["SKU", "Product", "Size", "Qty", ""].map((heading) => (
                      <th key={heading || "remove"} className="px-3 py-2 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t border-line">
                      <td className="px-2 py-1">
                        <input
                          aria-label="SKU"
                          value={line.sku}
                          readOnly={!isAdmin}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) => (item.id === line.id ? { ...item, sku: event.target.value } : item)),
                            )
                          }
                          className="h-11 w-full bg-transparent px-1 font-mono text-sm outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          aria-label="Product"
                          value={isAdmin ? line.description : productLabel(line.sku, line.description, line.size)}
                          readOnly={!isAdmin}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.id === line.id ? { ...item, description: event.target.value } : item,
                              ),
                            )
                          }
                          className="h-11 w-full bg-transparent px-1 text-sm outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          aria-label="Size"
                          value={line.size}
                          disabled={!isAdmin}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.id === line.id ? { ...item, size: event.target.value as SizeKey } : item,
                              ),
                            )
                          }
                          className="h-11 w-full bg-transparent px-1 text-sm outline-none"
                        >
                          {SIZES.map((size) => (
                            <option key={size} value={size}>
                              {ruleFor(rules, size).label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          aria-label="Quantity"
                          type="number"
                          min={0}
                          step={1}
                          value={line.qty || ""}
                          readOnly={!isAdmin}
                          onChange={(event) =>
                            setLines((current) =>
                              current.map((item) =>
                                item.id === line.id
                                  ? { ...item, qty: Math.max(0, Math.round(Number(event.target.value) || 0)) }
                                  : item,
                              ),
                            )
                          }
                          className="h-11 w-24 bg-transparent px-1 text-right font-mono text-lg font-bold tabular-nums outline-none"
                        />
                        {line.size === "gal5" && line.qty > pailPer ? (
                          <p className="mt-1 max-w-40 text-right text-xs font-semibold">{pailExplain(line.qty, pailPer).line}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {isAdmin ? (
                        <button
                          type="button"
                          aria-label={`Remove ${line.sku || "line"}`}
                          onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          className="inline-flex size-11 items-center justify-center text-muted"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          {isAdmin ? (
          <section className="no-print glass border border-white/70 p-4">
            <details>
              <summary className="cursor-pointer font-mono text-xs tracking-widest text-muted">CHANGE AND SAVE PALLET RULES</summary>
              <p className="mt-3 text-sm text-muted">
                Change how many fit on a pallet, then save. Saved rules stay on this device after you clear an order.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {SIZES.map((size) => {
                  const rule = ruleFor(rules, size);
                  const boxes = packsPerPallet(rule);
                  const units = unitsPerPallet(rule);
                  return (
                    <div key={size} className="border border-line bg-stripe p-3">
                      <p className="font-medium">{rule.label}</p>
                      <label className="mt-2 block text-xs text-muted">
                        {size === "gal5" ? "Pails (always 1)" : "Per box"}
                        <input
                          type="number"
                          min={1}
                          value={rule.unitsPerCase}
                          onChange={(event) =>
                            updateRule(size, { unitsPerCase: Math.max(1, Math.round(Number(event.target.value) || 1)) })
                          }
                          className="mt-1 h-11 w-full border border-line bg-card px-2 font-mono text-sm"
                        />
                      </label>
                      <label className="mt-2 block text-xs text-muted">
                        {size === "gal5" ? "Pails per pallet" : "Boxes per pallet"}
                        <input
                          type="number"
                          min={1}
                          value={rule.casesPerLayer * rule.layers}
                          onChange={(event) =>
                            updateRule(size, {
                              layers: 1,
                              casesPerLayer: Math.max(1, Math.round(Number(event.target.value) || 1)),
                            })
                          }
                          className="mt-1 h-11 w-full border border-line bg-card px-2 font-mono text-sm"
                        />
                      </label>
                      <p className="mt-2 font-mono text-xs tabular-nums text-muted">
                        {size === "gal5" ? `${units} pails is 1 pallet. Leftover is extra.` : `${boxes} boxes · ${units} units`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={mixSmall}
                  onChange={(event) => setMixSmall(event.target.checked)}
                  className="mt-1 size-5 accent-amber"
                />
                <span>Put leftover quarts and gallon boxes together on the same pallet when they fit.</span>
              </label>
              <p className="mt-3 text-sm text-muted">
                A full pallet of 5-gallon pails is 36 pails, 4 across and 3 high. Anything left over shows as extra and can be loaded with other materials. Paint boxes go on that skid when they fit: up to six 4-gallon boxes, and the stack stays under 60 inches. A full pallet of 4-gallon boxes stays 30 boxes. 1.25-gallon boxes go full across, 4 high. OverTime 1.25 is 2 in a box with 2 of the 8 oz catalyst. Quart boxes are 20 to a layer.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={saveRules} className="katchup-btn is-lit">
                  Save rules
                </button>
                <button type="button" onClick={resetRules} className="katchup-btn">
                  Reset to defaults
                </button>
              </div>
            </details>
          </section>
          ) : null}
        </div>
        <footer className="mx-auto mt-auto w-full max-w-6xl px-4 py-8 text-center text-sm text-white/75">
          <p>© 2026 Gametime Coatings / B.Smith Tech. All rights reserved.</p>
        </footer>
        {batchPad ? (
          <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#0c1014] px-3 pb-4 pt-3 text-white">
            <div className="mx-auto flex max-w-sm items-center gap-2">
              <p className="min-h-10 flex-1 font-mono text-2xl tracking-wide">{padValue() || "—"}</p>
              <button type="button" className="h-12 w-16 border border-white/30 text-xl font-bold" onClick={() => changePad((current) => current.slice(0, -1))}>
                ⌫
              </button>
            </div>
            <div className="mx-auto mt-2 grid max-w-sm grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className="h-14 bg-white text-2xl font-bold text-black"
                  onClick={() => changePad((current) => `${current}${key}`)}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                className="h-14 bg-mustard text-lg font-bold text-black"
                onClick={() => {
                  keepTypedCode(padValue());
                  setBatchPad(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-3">
      <p className="font-mono text-[11px] tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: "Full" | "Mixed" | "Partial" | "On top" }) {
  const tone =
    type === "Full"
      ? "bg-ink text-paper"
      : type === "On top" || type === "Mixed"
        ? "bg-amber text-paper"
        : "border border-line text-ink";
  return <span className={`inline-block px-2 py-1 text-xs font-medium ${tone}`}>{type}</span>;
}

function sizeCounts(
  pallets: { lines: { size: SizeKey; units: number; packs: number }[] }[],
): Record<SizeKey, number> {
  const counts = Object.fromEntries(SIZES.map((size) => [size, 0])) as Record<SizeKey, number>;
  for (const pallet of pallets) {
    for (const line of pallet.lines) {
      const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
      counts[line.size] += count;
    }
  }
  return counts;
}

function containerTotals(pallets: { lines: { size: SizeKey; units: number; packs: number }[] }[]): {
  pails: number;
  boxes: number;
} {
  let pails = 0;
  let boxes = 0;
  for (const pallet of pallets) {
    for (const line of pallet.lines) {
      if (line.size === "gal5") pails += line.units;
      else boxes += line.packs > 0 ? line.packs : line.units > 0 ? 1 : 0;
    }
  }
  return { pails, boxes };
}

function containerLabel(lines: { size: SizeKey; units: number; packs: number }[], per = 36): string {
  return SIZES.map((size) => {
    const count = lines
      .filter((line) => line.size === size)
      .reduce((sum, line) => sum + (line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units), 0);
    return count > 0 ? containerPhrase(size, count, per) : "";
  })
    .filter(Boolean)
    .join(" · ");
}

function loadKey(
  pallet: number,
  line: { sku: string; onTop: boolean; boxKind?: number; size: SizeKey },
): string {
  return `${pallet}|${line.sku}|${line.size}|${line.onTop ? "top" : "base"}|${line.boxKind ?? ""}`;
}

function pieceCount(line: { size: SizeKey; units: number; packs: number }): number {
  return line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
}

function mailBold(value: string): string {
  return [...value].map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + code - 97);
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + code - 48);
    return char;
  }).join("");
}

function mailBig(value: string): string {
  return [...value].map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if (code === 32) return "\u3000";
    if (code >= 33 && code <= 126) return String.fromCodePoint(0xff01 + code - 33);
    return char;
  }).join("");
}

function gallonBoxWord(kind: 1 | 2 | 4, count: number): string {
  const size = kind === 4 ? "4-gallon" : kind === 2 ? "2-gallon" : "1-gallon";
  return `${size} ${count === 1 ? "box" : "boxes"}`;
}

function checkSize(size: SizeKey): string {
  if (size === "gal5") return "5 Gallon";
  if (size === "gal1") return "1 Gallon";
  if (size === "gal125") return "1.25 Gallon";
  if (size === "gal15") return "1.5 Gallon";
  if (size === "quart") return "Quart";
  if (size === "pint") return "Pint";
  if (size === "vinyl") return "Vinyl box";
  return "Drawdown";
}

function lineTitle(line: { sku: string; description: string; size: SizeKey }): string {
  const detail = paintDetail(line.sku, line.description);
  return detail ? detail.title : productLabel(line.sku, line.description, line.size);
}

function pieceWord(size: SizeKey, count: number): string {
  const one = count === 1;
  if (size === "gal5") return one ? "5-gallon pail" : "5-gallon pails";
  if (size === "gal1") return one ? "1-gallon box" : "1-gallon boxes";
  if (size === "gal125") return one ? "1.25-gallon box" : "1.25-gallon boxes";
  if (size === "gal15") return one ? "1.5-gallon box" : "1.5-gallon boxes";
  if (size === "quart") return one ? "quart box" : "quart boxes";
  if (size === "pint") return one ? "pint box" : "pint boxes";
  if (size === "vinyl") return one ? "vinyl box" : "vinyl boxes";
  return one ? "drawdown" : "drawdowns";
}

function slipBeforeWord(item: ProductStory): string {
  const count = item.slipQty || item.ordered;
  const one = count === 1;
  if (item.sizeKey === "gal5") return one ? "5 gallon" : "5 gallons";
  if (item.sizeKey === "gal1") return one ? "gallon" : "gallons";
  if (item.sizeKey === "gal125") return "1.25";
  if (item.sizeKey === "gal15") return "1.5";
  if (item.sizeKey === "quart" || item.quarts > 0) return one ? "quart" : "quarts";
  if (item.sizeKey === "pint") return one ? "pint" : "pints";
  if (item.sizeKey === "vinyl") return one ? "box" : "boxes";
  return one ? "drawdown" : "drawdowns";
}

function storyName(item: ProductStory, slipLines: OrderLine[]): string {
  const colors = slipLines.filter((line) => {
    const detail = paintDetail(line.sku, line.description);
    return Boolean(detail && slipColor(line.description) && detail.title === item.name && line.size === item.sizeKey);
  });
  if (colors.length === 0) return item.name;
  return `${item.name} · ${colors.map((line) => `${slipColor(line.description)} ${formatNum(line.qty)}`).join(" · ")}`;
}

function Overtime125Qty({ units }: { units: number }) {
  const pack = overtime125Pack(units);
  if (pack.boxes > 0 && pack.extra > 0) {
    return (
      <span className="hand-eq">
        <span className="hand-pair">
          <strong>{formatNum(pack.boxes)}</strong>
          {pack.boxes === 1 ? " box" : " boxes"}
        </span>
        <span className="hand-eqword">/</span>
        <span className="hand-pair">
          <strong>1</strong>
          {" extra"}
        </span>
        <span className="hand-extra">{pack.note}</span>
      </span>
    );
  }
  const boxes = pack.boxes > 0 ? pack.boxes : 1;
  return (
    <span className="hand-eq">
      <span className="hand-pair">
        <strong>{formatNum(boxes)}</strong>
        {boxes === 1 ? " box" : " boxes"}
      </span>
      <span className="hand-extra">{pack.note}</span>
    </span>
  );
}

function CatalystQty({ quarts }: { quarts: number }) {
  const full = Math.floor(quarts / 9);
  const extra = quarts % 9;
  if (full > 0 && extra > 0) {
    return (
      <span className="hand-eq">
        <span className="hand-pair">
          <strong>{formatNum(full)}</strong>
          {full === 1 ? " box" : " boxes"}
        </span>
        <span className="hand-eqword">/</span>
        <span className="hand-pair">
          <strong>{formatNum(extra)}</strong>
          {" extra"}
        </span>
        <span className="hand-extra">Extra goes in another box.</span>
      </span>
    );
  }
  if (full > 0) {
    return (
      <>
        <strong>{formatNum(full)}</strong>
        <span>{full === 1 ? "box" : "boxes"}</span>
      </>
    );
  }
  return (
    <span className="hand-eq">
      <strong>{formatNum(extra)}</strong>
      <span>extra</span>
      <span className="hand-extra">Goes in one box.</span>
    </span>
  );
}

function CasePalletQty({
  cans,
  perBox,
  boxesPerPallet,
  kind,
}: {
  cans: number;
  perBox: number;
  boxesPerPallet: number;
  kind: "gallon" | "quart";
}) {
  const boxName = kind === "gallon" ? "4-gallon" : "4-quart";
  const boxes = Math.ceil(Math.max(0, cans) / Math.max(1, perBox));
  const note =
    kind === "gallon"
      ? "120 one-gallon cans or 30 4-gallon boxes of this product = 1 pallet"
      : "720 quart cans or 180 4-quart boxes of this product = 1 pallet";
  if (boxes < boxesPerPallet) {
    return (
      <>
        <strong>{formatNum(boxes)}</strong>
        <span>{boxes === 1 ? `${boxName} box` : `${boxName} boxes`}</span>
      </>
    );
  }
  const pallets = Math.floor(boxes / boxesPerPallet);
  const extra = boxes % boxesPerPallet;
  return (
    <span className="hand-eq">
      <span className="hand-pair">
        <strong>{formatNum(pallets)}</strong>
        {pallets === 1 ? " pallet" : " pallets"}
      </span>
      {extra > 0 ? (
        <>
          <span className="hand-eqword">/</span>
          <span className="hand-pair">
            <strong>{formatNum(extra)}</strong>
            {extra === 1 ? ` ${boxName} box` : ` ${boxName} boxes`}
          </span>
        </>
      ) : null}
      <span className="hand-extra">{note}</span>
    </span>
  );
}

function PailQty({ pails, per }: { pails: number; per: number }) {
  const size = Math.max(1, Math.round(per));
  const count = Math.max(0, Math.round(pails));
  if (count < size) {
    return (
      <>
        <strong>{formatNum(count)}</strong>
        <span>{count === 1 ? "five gallon" : "five gallons"}</span>
      </>
    );
  }
  const pallets = Math.floor(count / size);
  const extra = count % size;
  return (
    <span className="hand-eq">
      <span className="hand-pair">
        <strong>{formatNum(pallets)}</strong>
        {pallets === 1 ? " pallet" : " pallets"}
      </span>
      {extra > 0 ? (
        <>
          <span className="hand-eqword">/</span>
          <span className="hand-pair">
            <strong>{formatNum(extra)}</strong>
            {" extra"}
          </span>
        </>
      ) : null}
      <span className="hand-extra">{formatNum(size)} five gallons of this product = 1 pallet</span>
    </span>
  );
}

function storyQtyParts(item: ProductStory, pailPer = 36): { count: string; label: string }[] {
  if (item.kitUnits > 0) {
    const pack = overtime125Pack(item.kitUnits);
    if (pack.boxes > 0 && pack.extra > 0) {
      return [{ count: formatNum(pack.boxes), label: `${pack.boxes === 1 ? "box" : "boxes"} / 1 extra` }];
    }
    const boxes = pack.boxes > 0 ? pack.boxes : 1;
    return [{ count: formatNum(boxes), label: boxes === 1 ? "box" : "boxes" }];
  }
  if (item.sizeKey === "gal1" && item.boxes.length > 0) {
    return item.boxes.map((box) => ({
      count: formatNum(box.boxes),
      label: gallonBoxWord(box.kind, box.boxes),
    }));
  }
  if (item.sizeKey === "quart" && /catalyst/i.test(item.name) && item.quarts > 0) {
    const full = Math.floor(item.quarts / 9);
    const extra = item.quarts % 9;
    if (full === 0) return [{ count: formatNum(extra), label: "extra" }];
    const label = full === 1 ? "box" : "boxes";
    return [{ count: formatNum(full), label: extra > 0 ? `${label} plus ${formatNum(extra)} extra` : label }];
  }
  if (item.sizeKey === "quart") {
    const count = item.slipQty || item.total;
    return [{ count: formatNum(count), label: count === 1 ? "quart" : "quarts" }];
  }
  if (item.sizeKey === "gal5") {
    const parts = [{ count: formatNum(item.total), label: item.total === 1 ? "pail" : "pails" }];
    if (item.total > pailPer) {
      const split = pailSplit(item.total, pailPer);
      if (split.pallets > 0) parts.push({ count: formatNum(split.pallets), label: split.pallets === 1 ? "pallet" : "pallets" });
      if (split.extra > 0) parts.push({ count: formatNum(split.extra), label: "extra" });
    }
    return parts;
  }
  const shown = item.byColor ? item.gallons : item.total;
  const label = item.byColor ? (shown === 1 ? "gallon" : "gallons") : pieceWord(item.sizeKey, shown);
  return [{ count: formatNum(shown), label }];
}

function storyBatch(item: ProductStory, slipLines: OrderLine[], codes: Record<string, string>): string {
  const found = slipLines
    .filter((line) => {
      const detail = paintDetail(line.sku, line.description);
      const name = detail ? detail.title : productLabel(line.sku, line.description, line.size);
      return name === item.name && line.size === item.sizeKey;
    })
    .map((line) => (codes[line.id] ?? "").trim())
    .filter(Boolean);
  const unique = [...new Set(found)];
  return unique.length > 0 ? unique.join(", ") : "__________";
}

type BoxBreak = { kind: 1 | 2 | 4; boxes: number };

type ProductStory = {
  key: string;
  name: string;
  size: string;
  sizeKey: SizeKey;
  full: number;
  each: number;
  leftover: number;
  total: number;
  slipQty: number;
  ordered: number;
  placed: number;
  gallons: number;
  byColor: boolean;
  boxes: BoxBreak[];
  quarts: number;
  kitUnits: number;
  alphaOmega: boolean;
};

function productStories(pallets: Pallet[], order: OrderLine[], rules: PalletRule[]): ProductStory[] {
  const rows = new Map<string, ProductStory & { eachs: number[] }>();
  const containers = (line: OrderLine) =>
    line.size === "gal5" ? line.qty : Math.ceil(line.qty / Math.max(1, unitsInBox(line, rules)));
  const rowFor = (sku: string, description: string, size: SizeKey) => {
    const name = paintRowName(sku, description, size);
    const id = `${name}|${size}`;
    const current = rows.get(id);
    if (current) return current;
    const next: ProductStory & { eachs: number[] } = {
      key: `product:${id}`,
      name,
      size: sizeTitle(size),
      sizeKey: size,
      full: 0,
      each: 0,
      leftover: 0,
      total: 0,
      slipQty: 0,
      ordered: 0,
      placed: 0,
      gallons: 0,
      byColor: false,
      eachs: [],
      boxes: [],
      quarts: 0,
      kitUnits: 0,
      alphaOmega: false,
    };
    rows.set(id, next);
    return next;
  };
  for (const line of order) {
    if (line.qty <= 0 || isOvertime8oz(line)) continue;
    const row = rowFor(line.sku, line.description, line.size);
    row.slipQty += line.qty;
    if (/alpha|omega/i.test(`${line.sku} ${line.description}`)) row.alphaOmega = true;
    if (isOvertime125(line)) row.kitUnits += line.qty;
    if (isPaintGallon(line)) {
      row.byColor = true;
      row.ordered += line.qty;
      row.gallons += line.qty;
    } else if (line.size === "quart" && isSharedQuart(line)) {
      row.ordered += line.qty;
    } else {
      row.ordered += containers(line);
    }
    if (line.size === "quart" && /cataly|catylist|gtotcat/i.test(`${line.sku} ${line.description}`)) {
      row.quarts += line.qty;
    }
    if (line.size === "drawdown") {
      row.placed += line.qty;
      row.total += line.qty;
    }
  }
  for (const pallet of pallets) {
    const base = pallet.lines.filter((line) => !line.onTop);
    const names = new Set(base.map((line) => `${productLabel(line.sku, line.description, line.size)}|${line.size}`));
    const soloFull = pallet.kind === "full" && names.size === 1;
    if (soloFull && base[0]) {
      const row = rowFor(base[0].sku, base[0].description, base[0].size);
      row.full += 1;
      row.eachs.push(base.reduce((sum, line) => sum + pieceCount(line), 0));
    }
    for (const line of pallet.lines) {
      const mix = line.size === "gal1" || line.size === "quart" ? readPaintMix(line.description) : null;
      if (mix) {
        for (const part of mix) {
          const row = rows.get(`${part.name}|${line.size}`);
          if (!row) continue;
          row.placed += part.units;
          row.byColor = true;
        }
        continue;
      }
      if (isPaintGallon(line)) {
        const row = rowFor(line.sku, line.description, line.size);
        row.placed += line.units;
        row.byColor = true;
        continue;
      }
      if (line.size === "quart" && isSharedQuart(line)) {
        const row = rowFor(line.sku, line.description, line.size);
        row.placed += line.units;
        row.total += line.units;
        continue;
      }
      const row = rowFor(line.sku, line.description, line.size);
      const count = pieceCount(line);
      row.placed += count;
      row.total += count;
      if (line.size === "gal1") {
        const kind: 1 | 2 | 4 = line.boxKind === 1 || line.boxKind === 2 || line.boxKind === 4 ? line.boxKind : 4;
        const boxes = line.packs > 0 ? line.packs : line.units > 0 ? 1 : 0;
        const found = row.boxes.find((box) => box.kind === kind);
        if (found) found.boxes += boxes;
        else if (boxes > 0) row.boxes.push({ kind, boxes });
      }
      if (!(soloFull && !line.onTop)) row.leftover += pieceCount(line);
    }
  }
  return [...rows.values()].map((row) => {
    const same = row.eachs.length > 0 && row.eachs.every((count) => count === row.eachs[0]);
    return {
      ...row,
      each: same ? row.eachs[0] : 0,
      boxes: [...row.boxes].sort((a, b) => b.kind - a.kind),
    };
  });
}

function proofGaps(
  order: OrderLine[],
  pallets: Pallet[],
): { name: string; ordered: number; placed: number }[] {
  const placed = new Map<string, number>();
  for (const pallet of pallets) {
    for (const line of pallet.lines) {
      const key = `${line.sku.toUpperCase()}|${line.size}`;
      placed.set(key, (placed.get(key) ?? 0) + line.units);
    }
  }
  const seen = new Set<string>();
  const gaps: { name: string; ordered: number; placed: number }[] = [];
  for (const line of order) {
    const key = `${line.sku.toUpperCase()}|${line.size}`;
    if (line.size === "drawdown" || seen.has(key) || line.qty <= 0) continue;
    seen.add(key);
    const ordered = order
      .filter((item) => `${item.sku.toUpperCase()}|${item.size}` === key)
      .reduce((sum, item) => sum + item.qty, 0);
    const got = placed.get(key) ?? 0;
    if (got !== ordered) {
      gaps.push({ name: productLabel(line.sku, line.description, line.size), ordered, placed: got });
    }
  }
  return gaps;
}

function LoadCheck({
  pallet,
  total,
  loaded,
  batchFor,
  onCode,
  onToggle,
}: {
  pallet: Pallet;
  total: number;
  loaded: Record<string, boolean>;
  batchFor: (sku: string, size: SizeKey) => string;
  onCode: (key: string, sku: string, size: SizeKey, code: string) => void;
  onToggle: (key: string) => void;
}) {
  return (
    <article className="glass border border-white/70 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-2xl font-semibold tracking-tight">Pallet {pallet.number}</h3>
        <span className="font-mono text-sm text-muted">
          {pallet.number} of {total}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{containerLabel(pallet.lines)}</p>
      <ul className="mt-4 divide-y divide-line border border-line bg-card">
        {pallet.lines.map((line) => {
          const count = line.size === "gal5" ? line.units : line.packs > 0 ? line.packs : line.units;
          const explained = line.size === "gal5" ? pailExplain(count) : null;
          const name = productLabel(line.sku, line.description, line.size);
          const key = loadKey(pallet.number, line);
          const checked = Boolean(loaded[key]);
          const code = batchFor(line.sku, line.size);
          const needsCode = line.size !== "drawdown" && checked && code.trim().length === 0;
          return (
            <li key={key}>
              <label className={"flex cursor-pointer items-center gap-4 px-3 py-4 " + (checked ? "bg-stripe" : "")}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(key)}
                  aria-label={`On pallet ${pallet.number}: ${count} ${name}`}
                  className="size-8 shrink-0 accent-amber"
                />
                <span className={"min-w-0 flex-1 " + (checked && code.trim() ? "text-muted line-through" : "")}>
                  <span className="block text-lg font-medium">{name}</span>
                  <span className="block text-sm text-muted">
                    {sizeTitle(line.size)}
                    {explained ? ` · ${explained.line}` : ""}
                    {line.boxKind ? ` · ${line.boxKind} gal box` : ""}
                    {line.onTop ? " · on top" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-4xl font-bold leading-none tabular-nums text-ink">{formatNum(count)}</span>
                  <span className="mt-1 block text-sm font-bold uppercase tracking-wide text-ink">
                    {line.size === "gal5" ? (count === 1 ? "pail" : "pails") : count === 1 ? "box" : "boxes"}
                  </span>
                </span>
              </label>
              {needsCode ? (
                <form
                  className="flex flex-wrap items-end gap-2 border-t border-line bg-paper px-3 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const nextCode = String(data.get("batch") ?? "").trim();
                    if (!nextCode) return;
                    onCode(key, line.sku, line.size, nextCode);
                  }}
                >
                  <label className="min-w-48 flex-1 text-sm font-medium">
                    Batch code for {name}
                    <input
                      name="batch"
                      placeholder="Batch code when it is ready"
                      className="mt-1 h-12 w-full border border-ink bg-card px-3 font-mono text-lg outline-none"
                    />
                  </label>
                  <button type="submit" className="katchup-btn is-lit">
                    Save code
                  </button>
                  <button type="button" onClick={() => onToggle(key)} className="h-11 border border-ink bg-card px-3 text-sm">
                    Not ready
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function DispatchRow({id,name,ship}:{id:string;name:string;ship:()=>Promise<void>}){const [status,setStatus]=useState('');useEffect(()=>{let stop=false;const pull=()=>deskStatus(id).then(s=>{if(!stop)setStatus(s.status)}).catch(()=>{});void pull();const timer=setInterval(pull,4000);return()=>{stop=true;clearInterval(timer)}},[id]);return <div className="flex items-center gap-3 py-2"><span>{name} — {status}</span><button className="katchup-btn" disabled={status!=='READY'} onClick={()=>void ship()}>Mark Shipped</button></div>}
