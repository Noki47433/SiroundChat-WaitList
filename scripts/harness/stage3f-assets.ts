import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
const BASE = process.env.BASE_URL ?? "https://siroundchat.com";
const N = Number(process.argv[2]);
const businessId = `3f00000${N}-0000-4000-8000-000000000001`;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const png = (variant: number) => {
  const size = 400;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) { const row = y * (size * 3 + 1); raw[row] = 0;
    for (let x = 0; x < size; x++) { const p = row + 1 + x * 3;
      raw[p] = variant === 0 ? 40 + (x % 200) : 220 - (x % 200);
      raw[p+1] = variant === 0 ? 60 + (y % 120) : 120;
      raw[p+2] = variant === 0 ? 90 : 160 - (y % 140); } }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const tbl: number[] = []; for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;tbl[n]=c>>>0;}
    let crc=0xffffffff; for (const b of body) crc = tbl[(crc^b)&0xff]^(crc>>>8);
    const cb = Buffer.alloc(4); cb.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([len, body, cb]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk("IHDR",ihdr), chunk("IDAT",deflateSync(raw)), chunk("IEND",Buffer.alloc(0))]);
};
(async () => {
  const s = JSON.parse(readFileSync(`/tmp/s${N}.json`,"utf8"));
  const upload = async (name: string, v: number) => {
    const form = new FormData();
    form.append("siteId", s.siteId); form.append("kind","gallery");
    form.append("file", new Blob([png(v)], { type: "image/png" }), name);
    const r = await fetch(`${BASE}/api/builder/upload-image`, { method:"POST", headers:{cookie:s.cookie}, body: form });
    return { status: r.status, json: await r.json().catch(()=>({})) };
  };
  const a = await upload(`stage3f-${N}-a.png`, 0);
  const b = await upload(`stage3f-${N}-b.png`, 1);
  console.log(`  upload a: HTTP ${a.status}  upload b: HTTP ${b.status}`);
  if (a.status !== 200) console.log("   ", JSON.stringify(a.json).slice(0,160));
  const { data: assets } = await db.from("builder_site_assets").select("id, kind").eq("site_id", s.siteId);
  console.log(`  assets owned by this site: ${(assets??[]).length}`);
  // bind one through the real edit route
  const state = await (await fetch(`${BASE}/api/site-spec/state?siteId=${s.siteId}`, {headers:{cookie:s.cookie}})).json();
  const bind = await fetch(`${BASE}/api/site-spec/edit`, { method:"POST", headers:{cookie:s.cookie,"content-type":"application/json"},
    body: JSON.stringify({ siteId: s.siteId, baseVersionId: state.state.draftVersionId, requestId:`s3f-bind-${N}-${Date.now()}`, message:"Use one of my photos for the hero image" })});
  const bj = await bind.json();
  console.log(`  bind edit: HTTP ${bind.status} changed=${bj.changed} — ${String(bj.reply??bj.error).slice(0,70)}`);
  const after = await (await fetch(`${BASE}/api/site-spec/state?siteId=${s.siteId}`, {headers:{cookie:s.cookie}})).json();
  const blob = JSON.stringify(after.spec);
  const urls = blob.match(/https?:\/\/[^"]{0,70}/g) ?? [];
  console.log(`  media URLs in the spec: ${urls.length === 0 ? "none ✓" : urls.slice(0,2).join(" ")}`);
  const assetRefs = (blob.match(/"assetId"/g) ?? []).length;
  console.log(`  assetId references in the spec: ${assetRefs}`);
})();
