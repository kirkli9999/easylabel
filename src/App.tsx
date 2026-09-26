import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Check, CheckCheck, ChevronRight, CircleHelp, Copy, FileCheck2, FileText, FolderOpen, Leaf, LoaderCircle, LockKeyhole, Plus, Printer, RefreshCw, ShieldCheck, SlidersHorizontal, Trash2, Upload, Wheat, X, AlertCircle, CircleCheck, BookOpen, Package, ListChecks, TableProperties, Settings2 } from 'lucide-react';
import { ALLERGENS, NUTRIENTS, RULE_VERSION, demoProduct, newProduct, newJob, uid, resetConfirmations, type Product, type Paper, type Values } from './domain/model';
import { CHECKED_AT, RULES, scopeLabels, validate, nutritionOutput, type Issue } from './domain/rules';
import { loadWorkspace, importProducts, makeBackup, STORAGE_KEY } from './domain/storage';
import { releaseReady } from './domain/release';
import { sheetLayout } from './pdf/layout';
import { buildPdf, buildCalibration } from './pdf/generate';
import { loadFont, download } from './pdf/browser';
import { PdfPreview } from './components/PdfPreview';

const STEPS = [
  { label: '適用範圍', icon: ShieldCheck, title: '先確認，這是適合你的工具。', subtitle: '第一版為台灣常見包裝烘焙點心設計。請依實際商品回答。' },
  { label: '商品資料', icon: Package, title: '從一份好吃的點心開始。', subtitle: '留下固定資料，下次製作只需要更新批次日期。' },
  { label: '過敏原', icon: Wheat, title: '讓每一口，都有清楚的資訊。', subtitle: '依配方及供應商資料逐項確認；沒勾選不代表沒有過敏原。' },
  { label: '營養標示', icon: TableProperties, title: '你的數據，清楚而準確地呈現。', subtitle: '手動輸入已知數值。原始資料完整保留，列印值另行顯示。' },
  { label: '列印設定', icon: Settings2, title: '這一批，準備好了。', subtitle: '輸入已確認的有效日期，選擇標籤尺寸與列印數量。' },
  { label: '檢查與下載', icon: FileCheck2, title: '列印之前，再看一眼。', subtitle: '檢查本工具支援的項目，下載與右側預覽相同的 PDF。' },
];
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Panel({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) { return <section className="panel"><div className="panel-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>{children}</section>; }
function CheckBox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) { return <label className="checkbox"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>; }
function Input({ value, onChange, ...props }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) { return <input value={value} onChange={e => onChange(e.target.value)} {...props}/>; }
function Numeric({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) { return <Input value={value} onChange={onChange} inputMode="decimal" aria-label={label} placeholder="—" maxLength={30}/>; }
function Notice({ children, tone = 'soft' }: { children: ReactNode; tone?: string }) { return <div className={`notice ${tone}`}><AlertCircle size={17}/><div>{children}</div></div>; }

export default function App() {
  const [initial] = useState(loadWorkspace);
  const [products, setProducts] = useState<Product[]>(() => initial.products.length ? initial.products : [demoProduct()]);
  const [selected, setSelected] = useState(() => initial.products[0]?.id ?? '');
  const [paper, setPaper] = useState<Paper>(initial.paper);
  const [job, setJob] = useState(newJob);
  const [step, setStep] = useState(1), [help, setHelp] = useState(false);
  const [recovery, setRecovery] = useState(!!initial.error);
  const [saveStatus, setSaveStatus] = useState(initial.error ? '讀取失敗' : '已儲存在此瀏覽器');
  const [toast, setToast] = useState(initial.error);
  const [busy, setBusy] = useState(false), [pdfError, setPdfError] = useState('');
  const [pdf, setPdf] = useState<{ bytes: Uint8Array; pages: number; perPage: number; draft: boolean; fingerprint: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const product = products.find(p => p.id === selected) ?? products[0];
  const fingerprint = JSON.stringify({ product, paper, job });
  const latest = useRef(fingerprint); latest.current = fingerprint;
  const issues = useMemo(() => validate(product, job), [product, job]);
  const counts = { error: issues.filter(i => i.severity === 'error').length, pending: issues.filter(i => i.severity === 'pending').length, warning: issues.filter(i => i.severity === 'warning').length };
  const currentPdf = pdf?.fingerprint === fingerprint ? pdf : null;
  let grid: ReturnType<typeof sheetLayout> | null = null, gridError = '';
  try { grid = sheetLayout(paper, job.quantity); } catch (e) { gridError = (e as Error).message; }

  useEffect(() => {
    if (recovery) return;
    setSaveStatus('儲存中…');
    const timeout = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(makeBackup(products, paper))); setSaveStatus('已儲存在此瀏覽器'); }
      catch { setSaveStatus('儲存失敗'); setToast('瀏覽器無法儲存。編輯內容仍保留，請立即匯出備份。'); }
    }, 350);
    return () => clearTimeout(timeout);
  }, [products, paper, recovery]);
  useEffect(() => { setPdfError(''); }, [fingerprint]);
  function update(changes: Partial<Product>) {
    setProducts(all => all.map(p => p.id === product.id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p));
  }
  function changeField(key: keyof Product, value: string) { update({ [key]: value, confirmedAt: '' }); }
  function changeNutrition(changes: Partial<Product['nutrition']>) { update({ nutrition: { ...product.nutrition, ...changes, confirmed: false }, confirmedAt: '' }); }
  function switchProduct(id: string) { setSelected(id); setJob(newJob()); setPdf(null); setPdfError(''); }
  function addProduct(demo = false) {
    if (products.length >= 100) { setToast('商品最多 100 筆。'); return; }
    const p = demo ? demoProduct() : newProduct(); setProducts(ps => [...ps, p]); switchProduct(p.id); setStep(demo ? 1 : 0);
  }
  function duplicate() {
    if (products.length >= 100) { setToast('商品最多 100 筆。'); return; }
    const p = { ...resetConfirmations(structuredClone(product)), id: uid(), name: `${product.name}（副本）` };
    setProducts(ps => [...ps, p]); switchProduct(p.id); setToast('已複製商品；請重新確認原料、過敏原、營養與本次日期。');
  }
  function remove() {
    if (!confirm(`刪除「${product.name || '未命名商品'}」？此操作無法復原，建議先匯出備份。`)) return;
    const remaining = products.filter(p => p.id !== product.id);
    if (!remaining.length) remaining.push(newProduct());
    setProducts(remaining); switchProduct(remaining[0].id);
  }
  function backup() { download(JSON.stringify(makeBackup(products, paper), null, 2), 'easylabel-backup.json', 'application/json'); }
  async function importFile(source?: File) {
    if (!source) return;
    try {
      if (source.size > 2_000_000) throw new Error('備份不得超過 2 MB。');
      const imported = importProducts(await source.text(), products);
      setProducts(imported); setRecovery(false); setToast(`已新增 ${imported.length - products.length} 筆商品。原有商品與紙張設定保持不變；匯入資料需重新確認。`);
    } catch (e) { setToast((e as Error).message); }
    if (file.current) file.current.value = '';
  }
  async function generate() {
    setBusy(true); setPdfError('');
    const snapshot = fingerprint;
    try {
      const draft = issues.some(i => i.severity !== 'warning');
      const result = await buildPdf(product, job, paper, await loadFont(), { draft });
      if (latest.current === snapshot) setPdf({ ...result, fingerprint: snapshot });
      else setToast('資料已變更，請再次更新預覽，以免下載舊資料。');
    } catch (e) { if (latest.current === snapshot) { setPdf(null); setPdfError((e as Error).message); } }
    finally { setBusy(false); }
  }
  async function calibration() {
    setBusy(true);
    try { download(await buildCalibration(await loadFont()), 'easylabel-100mm-test.pdf', 'application/pdf'); }
    catch (e) { setToast((e as Error).message); } finally { setBusy(false); }
  }
  function report() {
    download(JSON.stringify({ ruleVersion: RULE_VERSION, checkedAt: CHECKED_AT, generatedAt: new Date().toISOString(), product, job, paper, nutritionOutput: nutritionOutput(product), issues, layout: { checked: !!currentPdf, error: pdfError || gridError }, releaseReady: releaseReady() }, null, 2), 'easylabel-check-report.json', 'application/json');
  }
  const n = product.nutrition;
  const output = nutritionOutput(product);
  function nutritionGrid(rawEvidence = false) {
    const a = rawEvidence ? 'rawPerServing' : 'perServing', b = rawEvidence ? 'rawPer100' : 'per100';
    return <div className="table-scroll"><table className="nutrition-input"><thead><tr><th>營養素</th><th>每份</th><th>每 100 公克</th>{!rawEvidence && <th>印為 0</th>}</tr></thead><tbody>{NUTRIENTS.map(item => <tr key={item.key}><th>{item.label}<small>{item.unit}</small></th><td><Numeric label={`${rawEvidence ? '補充原始' : ''}${item.label.trim()}每份`} value={n[a][item.key]} onChange={v => changeNutrition({ [a]: { ...n[a], [item.key]: v } })}/>{!rawEvidence && <small className={output.perServing[item.key] !== n.perServing[item.key] ? 'changed' : ''}>印出 {output.perServing[item.key]}</small>}</td><td><Numeric label={`${rawEvidence ? '補充原始' : ''}${item.label.trim()}每100公克`} value={n[b][item.key]} onChange={v => changeNutrition({ [b]: { ...n[b], [item.key]: v } })}/>{!rawEvidence && <small className={output.per100[item.key] !== n.per100[item.key] ? 'changed' : ''}>印出 {output.per100[item.key]}</small>}</td>{!rawEvidence && <td><input aria-label={`${item.label.trim()}印為零`} type="checkbox" checked={n.zero.includes(item.key)} onChange={e => changeNutrition({ zero: e.target.checked ? [...n.zero, item.key] : n.zero.filter(k => k !== item.key) })}/></td>}</tr>)}</tbody></table></div>;
  }
  const issueView = (issue: Issue, i: number) => <li className={`issue ${issue.severity}`} key={`${issue.rule}-${i}`}><AlertCircle size={17}/><div><strong>{RULES[issue.rule].title}<span>{issue.severity === 'error' ? '需修正' : issue.severity === 'pending' ? '待確認' : '提醒'}</span></strong><p>{issue.message}</p>{RULES[issue.rule].source && <a href={RULES[issue.rule].source} target="_blank" rel="noreferrer">查看依據 ↗</a>}</div></li>;

  return <div className="app-shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={e => { e.preventDefault(); setStep(1); }}><span className="brand-symbol"><Wheat size={23}/></span><span>標籤日常<small>EASYLABEL</small></span></a><div className="sidebar-divider"/><span className="nav-label">我的工作台</span><button className="workspace-link" onClick={() => setStep(1)}><FolderOpen size={18}/>商品標籤<span>{products.length.toString().padStart(2, '0')}</span></button><span className="nav-label workflow-label">製作流程</span><nav>{STEPS.map((s, i) => { const Icon = s.icon; return <button key={s.label} className={`nav-step ${step === i ? 'active' : ''}`} onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}><Icon size={18}/><span>{s.label}</span><small>{String(i + 1).padStart(2, '0')}</small></button>; })}</nav><div className="sidebar-bottom"><div className="local-note"><LockKeyhole size={18}/><strong>你的資料，留在你這裡。</strong><p>免登入、不上傳。<br/>記得定期匯出商品備份。</p></div><button onClick={() => setHelp(true)}><CircleHelp size={17}/>使用說明與法規</button><span className="version">v0.1 · 台灣烘焙食品適用</span></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">工作台 <ChevronRight size={14}/> <strong>商品標籤</strong><span className="beta">測試版</span></div><div className="header-actions"><span className={`saved ${saveStatus.includes('失敗') ? 'failed' : ''}`}><span/>{saveStatus}</span><button className="button ghost compact" onClick={backup}><ArrowDownToLine size={16}/>匯出備份</button><button className="icon-button" title="匯入備份" aria-label="匯入備份" onClick={() => file.current?.click()}><Upload size={18}/></button><input ref={file} type="file" accept=".json,application/json" hidden onChange={e => void importFile(e.target.files?.[0])}/></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">一份用心，清楚標示</div><h1>把好味道，貼上好標籤<span>。</span></h1><p>專為小量烘焙設計，從商品資料到 A4 列印，一次準備好。</p></div><button className="button primary" onClick={() => addProduct()}><Plus size={18}/>新增商品</button></div>
    {toast && <div className="toast" role="status"><AlertCircle size={18}/><span>{toast}</span><button aria-label="關閉訊息" onClick={() => setToast('')}><X size={17}/></button></div>}
    {recovery && <Notice tone="danger">自動儲存已暫停，避免覆蓋無法讀取的資料。<button className="text-button" onClick={() => { try { download(localStorage.getItem(STORAGE_KEY) || '', 'easylabel-original-recovery.txt', 'text/plain'); } catch { setToast('瀏覽器阻止讀取原資料。'); } }}>下載原始資料</button><button className="text-button" onClick={() => { if (confirm('確認已保留原始資料，並用目前工作台資料取代？')) setRecovery(false); }}>重新啟用儲存</button></Notice>}
    <div className="product-bar"><div className="product-avatar"><Package size={23}/></div><div className="product-select"><label htmlFor="product-select">目前編輯的商品</label><select id="product-select" value={product.id} onChange={e => switchProduct(e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name || '未命名商品'}</option>)}</select></div><span className="product-tag">包裝烘焙</span><div className="product-actions"><button aria-label="複製商品" title="複製商品" onClick={duplicate}><Copy size={17}/></button><button aria-label="刪除商品" title="刪除商品" onClick={remove}><Trash2 size={17}/></button></div></div>
    <div className="mobile-steps">{STEPS.map((s, i) => <button key={s.label} className={step === i ? 'active' : ''} onClick={() => setStep(i)}>{i + 1}. {s.label}</button>)}</div>
    <div className="workspace-grid"><div className="editor"><div className="section-heading"><span className="step-number">{String(step + 1).padStart(2, '0')}</span><div><h2>{STEPS[step].title}</h2><p>{STEPS[step].subtitle}</p></div></div>
    {step === 0 && <><Panel title="商品適用條件" eyebrow="SCOPE"><div className="scope-list">{Object.entries(scopeLabels).map(([key, label]) => <Field label={label} key={key}><select value={product.scope[key as keyof typeof scopeLabels]} onChange={e => update({ scope: { ...product.scope, [key]: e.target.value as 'yes' | 'no' | 'unknown' }, confirmedAt: '' })}><option value="unknown">尚未確認</option><option value="yes">是，符合</option><option value="no">否，不符合</option></select></Field>)}</div><div className="form-grid"><Field label="保存型態"><select value={product.scope.storage} onChange={e => update({ scope: { ...product.scope, storage: e.target.value as Product['scope']['storage'] } })}><option value="unknown">尚未確認</option><option value="ambient">常溫</option><option value="chilled">冷藏</option><option value="frozen">冷凍（未支援）</option></select></Field><Field label="是否為真空包裝"><select value={product.scope.vacuum} onChange={e => update({ scope: { ...product.scope, vacuum: e.target.value as 'yes' | 'no' | 'unknown' } })}><option value="unknown">尚未確認</option><option value="no">否</option><option value="yes">是（未支援）</option></select></Field></div></Panel><Notice>使用奶、蛋作為烘焙原料仍可使用。產品本身屬乳品、巧克力等專屬類別，或無法判斷時，第一版只提供草稿。</Notice></>}
    {step === 1 && <><Panel title="商品基本資料" eyebrow="PRODUCT DETAILS" action={<span className="subtle">依實際包裝填寫</span>}><div className="form-grid"><Field label="品名 *"><Input value={product.name} onChange={v => changeField('name', v)} placeholder="例如：原味奶油餅乾"/></Field><Field label="淨重（公克） *"><Numeric value={product.netWeight} onChange={v => changeField('netWeight', v)}/></Field><Field label="原產地 *"><Input value={product.origin} onChange={v => changeField('origin', v)} placeholder="例如：台灣"/></Field><Field label="保存方式 *"><Input value={product.storageText} onChange={v => changeField('storageText', v)} placeholder="請依產品填寫保存條件"/></Field></div><div className="form-divider"/><div className="form-grid"><Field label="製造／國內負責廠商 *"><Input value={product.maker} onChange={v => changeField('maker', v)}/></Field><Field label="聯絡電話 *"><Input value={product.phone} onChange={v => changeField('phone', v)} type="tel"/></Field><div className="full"><Field label="廠商地址 *"><Input value={product.address} onChange={v => changeField('address', v)}/></Field></div></div></Panel>
    <Panel title="成分與添加物" eyebrow="INGREDIENTS" action={<button className="text-button" onClick={() => update({ ingredients: [...product.ingredients, { id: uid(), name: '', compound: false, subIngredients: '', additives: '', verified: false }], ingredientOrderConfirmed: false, allergenConfirmed: false })}><Plus size={15}/>新增原料</button>}><p className="panel-intro">依含量由多至少排列。複合原料請展開成分，不確定的資訊不要猜填。</p><div className="ingredients">{product.ingredients.map((ing, i) => {
      const updateIngredient = (changes: Partial<typeof ing>) => update({ ingredients: product.ingredients.map(item => item.id === ing.id ? { ...item, ...changes, verified: 'verified' in changes ? changes.verified! : false } : item), ingredientOrderConfirmed: false, allergenConfirmed: false, confirmedAt: '' });
      function move(to: number) { const reordered = [...product.ingredients]; [reordered[i], reordered[to]] = [reordered[to], reordered[i]]; update({ ingredients: reordered, ingredientOrderConfirmed: false }); }
      return <div className="ingredient" key={ing.id}><div className="ingredient-main"><span className="ingredient-index">{String(i + 1).padStart(2, '0')}</span><Input aria-label={`原料 ${i + 1}`} value={ing.name} onChange={v => updateIngredient({ name: v })} placeholder="原料名稱"/><button aria-label={`原料 ${i + 1} 上移`} disabled={i === 0} onClick={() => move(i - 1)}><ArrowUp size={15}/></button><button aria-label={`原料 ${i + 1} 下移`} disabled={i === product.ingredients.length - 1} onClick={() => move(i + 1)}><ArrowDown size={15}/></button><button aria-label={`移除原料 ${i + 1}`} onClick={() => update({ ingredients: product.ingredients.filter(item => item.id !== ing.id), ingredientOrderConfirmed: false, allergenConfirmed: false })}><X size={15}/></button></div><details><summary>複合成分、添加物與資料確認 <span>{ing.verified ? '已確認' : '待確認'}</span></summary><CheckBox checked={ing.compound} onChange={v => updateIngredient({ compound: v })}>這是複合原料（例如預拌粉、餡料）</CheckBox>{ing.compound && <Field label="複合原料子成分"><Input value={ing.subIngredients} onChange={v => updateIngredient({ subIngredients: v })}/></Field>}<Field label="具體添加物名稱（無則留白）"><Input value={ing.additives} onChange={v => updateIngredient({ additives: v })}/></Field><CheckBox checked={ing.verified} onChange={v => updateIngredient({ verified: v })}>已確認此原料的成分與添加物資料完整</CheckBox></details></div>;
    })}</div><div className="confirmation"><CheckBox checked={product.ingredientOrderConfirmed} onChange={v => update({ ingredientOrderConfirmed: v, confirmedAt: v ? new Date().toISOString() : '' })}>已確認原料依實際含量，由多至少排列</CheckBox></div></Panel><Panel title="其他標示"><Field label="補充注意事項（選填）"><textarea value={product.notes} onChange={e => changeField('notes', e.target.value)} placeholder="請勿填入未經確認的營養或健康宣稱" rows={2}/></Field></Panel></>}
    {step === 2 && <><Panel title="11 類法定過敏原" eyebrow="ALLERGEN REVIEW"><div className="allergen-list">{ALLERGENS.map(a => <div className="allergen-row" key={a.key}><Field label={a.label}><select aria-label={a.label} value={product.allergens[a.key].status} onChange={e => update({ allergens: { ...product.allergens, [a.key]: { ...product.allergens[a.key], status: e.target.value as Product['allergens'][typeof a.key]['status'] } }, allergenConfirmed: false })}><option value="unknown">待確認</option><option value="present">含有，需標示</option><option value="absent">已確認未含</option>{a.exception && <option value="exempt">有依據的例外／低於門檻</option>}</select></Field>{a.key === 'sulfite' && <small>以終產品 SO₂ 殘留量達 10 mg/kg（含）判定；使用後殘留不明請保留待確認。</small>}{product.allergens[a.key].status === 'exempt' && <><p className="hint">{a.exception}</p><Field label={`${a.label}例外依據`}><Input value={product.allergens[a.key].evidence} onChange={v => update({ allergens: { ...product.allergens, [a.key]: { ...product.allergens[a.key], evidence: v } }, allergenConfirmed: false })} placeholder="記錄原料規格、文件編號及適用條件"/></Field></>}</div>)}</div><div className="confirmation"><CheckBox checked={product.allergenConfirmed} onChange={v => update({ allergenConfirmed: v, confirmedAt: v ? new Date().toISOString() : '' })}>已依配方與供應商資料完成全部過敏原檢核</CheckBox></div></Panel><Panel title="同產線資訊"><Field label="同產線亦處理（選填）" hint="這段資訊不能取代實際含有的過敏原醒語。"><Input value={product.sharedLine} onChange={v => changeField('sharedLine', v)}/></Field></Panel></>}
    {step === 3 && <><Panel title="營養資料來源" eyebrow="NUTRITION"><div className="form-grid"><Field label="資料類型"><select value={n.kind} onChange={e => changeNutrition({ kind: e.target.value as 'raw' | 'label' })}><option value="raw">未修整原始數據</option><option value="label">既有標示值（可能已修整）</option></select></Field><Field label="每份量（公克）"><Numeric value={n.servingSize} onChange={v => changeNutrition({ servingSize: v })}/></Field><Field label="本包裝含幾份"><Numeric value={n.servings} onChange={v => changeNutrition({ servings: v })}/></Field><Field label="資料來源／文件編號"><Input value={n.source} onChange={v => changeNutrition({ source: v })}/></Field></div></Panel><Panel title="每份與每 100 公克" action={<span className="subtle">公克制固體／半固體</span>}>{nutritionGrid()}<Notice>數值依規則修整；「印為 0」需兩個基準的原始值都符合條件，不能把四捨五入後的數值當作判定依據。</Notice>{n.kind === 'label' && <div className="raw-evidence"><CheckBox checked={n.hasRawEvidence} onChange={v => changeNutrition({ hasRawEvidence: v })}>補充未修整原始資料，供零標示判定</CheckBox>{n.hasRawEvidence && nutritionGrid(true)}</div>}<div className="confirmation"><CheckBox checked={n.confirmed} onChange={v => update({ nutrition: { ...n, confirmed: v }, confirmedAt: v ? new Date().toISOString() : '' })}>已核對資料來源，以及原始輸入與實際印出值</CheckBox></div></Panel></>}
    {step === 4 && <><Panel title="本次製作批次" eyebrow="THIS BATCH" action={<button className="text-button" onClick={() => { setJob(newJob()); setToast('已開始新批次，請重新填寫並確認有效日期。'); }}><RefreshCw size={15}/>新批次</button>}><div className="form-grid"><Field label="有效日期 *" hint="由你依產品與保存條件確認，系統不推算。"><Input type="date" value={job.expiry} onChange={v => setJob({ ...job, expiry: v, confirmed: false })}/></Field><Field label="批號（選填）"><Input value={job.batch} onChange={v => setJob({ ...job, batch: v, confirmed: false })} maxLength={80}/></Field><Field label="列印張數（1–100）"><Input type="number" min={1} max={100} step={1} value={String(job.quantity)} onChange={v => setJob({ ...job, quantity: v === '' ? 0 : Number(v) })}/></Field></div><div className="confirmation"><CheckBox checked={job.confirmed} onChange={v => setJob({ ...job, confirmed: v })}>我已確認這一批的有效日期</CheckBox></div></Panel><Panel title="標籤與紙張" eyebrow="PAPER SETUP"><div className="paper-preset"><Printer size={21}/><div><strong>A4 整張貼紙・自行裁切</strong><small>210 × 297 mm / 直式</small></div><span className="pill">預設模板</span></div><div className="form-grid">{([['width', '標籤寬度（mm）'], ['height', '標籤高度（mm）'], ['margin', '紙張邊界（mm）'], ['gap', '標籤間距（mm）']] as const).map(([key, label]) => <Field key={key} label={label}><Input type="number" step="0.5" value={String(paper[key])} onChange={v => setPaper({ ...paper, [key]: v === '' ? 0 : Number(v) })}/></Field>)}</div><CheckBox checked={paper.cropMarks} onChange={v => setPaper({ ...paper, cropMarks: v })}>顯示裁切線</CheckBox>{gridError ? <Notice tone="danger">{gridError}</Notice> : <div className="layout-summary"><span>每頁 <strong>{grid?.capacity}</strong> 張</span><span>共 <strong>{grid?.pages}</strong> 頁 A4</span><span>固定字型，不自動縮字</span></div>}<button className="button secondary full-width" onClick={() => void calibration()} disabled={busy}><ArrowDownToLine size={16}/>下載 100 mm 列印測試頁</button></Panel></>}
    {step === 5 && <><Panel title="本次檢查摘要" eyebrow="PRE-FLIGHT CHECK"><div className="check-stats"><div><b>{counts.error}</b><span>需修正</span></div><div><b>{counts.pending}</b><span>待確認</span></div><div><b>{counts.warning}</b><span>提醒</span></div></div><p className="panel-intro">檢查範圍：本工具已支援的項目。內容真實性與未涵蓋規範仍需確認。</p><ul className="issues">{issues.map(issueView)}{gridError && issueView({ rule: 'LAYOUT', severity: 'error', message: gridError }, 999)}{pdfError && issueView({ rule: 'LAYOUT', severity: 'error', message: pdfError }, 1000)}</ul>{!currentPdf && <Notice>版面與缺字檢查尚未完成，請按「更新預覽」。</Notice>}<div className="report-actions"><button className="button secondary" onClick={report}><FileText size={16}/>下載檢查報告</button><button className="button primary" onClick={() => void generate()} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''}/>更新預覽</button></div></Panel><Notice>測試版需完成專業法規審閱與實印驗收才會開啟正式輸出。草稿浮水印會保留在 PDF；無法容納或缺字時不產生檔案。</Notice></>}
    <div className="step-footer"><button className="button ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft size={16}/>上一步</button><span>{step + 1} / {STEPS.length}</span><button className="button secondary" disabled={step === STEPS.length - 1} onClick={() => setStep(s => s + 1)}>下一步<ArrowRight size={16}/></button></div></div>
    <aside className="preview-column"><div className="preview-card"><div className="preview-heading"><div><span className="eyebrow">PRINT PREVIEW</span><h2>看見你的標籤</h2></div><span className="draft-badge"><span/>草稿預覽</span></div><div className="preview-info"><span>A4・直式</span><span>{paper.width} × {paper.height} mm</span><button className="icon-button" aria-label="調整列印設定" onClick={() => setStep(4)}><SlidersHorizontal size={16}/></button></div><PdfPreview bytes={currentPdf?.bytes ?? null}/>{pdf && !currentPdf && <div className="stale-notice">資料已變更，請更新預覽。</div>}{pdfError && <div className="pdf-error" role="alert">{pdfError}</div>}<div className="preview-controls"><button className="button secondary full-width" disabled={busy || !!gridError} onClick={() => void generate()}>{busy ? <LoaderCircle size={17} className="spin"/> : <RefreshCw size={17}/>} {busy ? '正在排版與嵌入中文字型…' : '更新預覽'}</button><button className="button primary full-width" disabled={!currentPdf || busy} onClick={() => currentPdf && download(currentPdf.bytes, `easylabel-${job.expiry || 'undated'}${currentPdf.draft ? '-draft' : ''}.pdf`, 'application/pdf')}><ArrowDownToLine size={18}/>{currentPdf?.draft !== false ? '下載草稿 PDF' : '下載列印 PDF'}</button><p><LockKeyhole size={12}/>PDF 在你的瀏覽器產生，不上傳商品資料</p></div></div><div className="print-tip"><span className="tip-icon"><Printer size={19}/></span><div><strong>第一次列印？先用普通紙試印。</strong><p>選擇「實際大小／100%」，關閉符合頁面。確認尺寸後再放入相容的 A4 貼紙。</p><button className="text-button" onClick={() => void calibration()} disabled={busy}>下載尺寸測試頁 <ArrowRight size={13}/></button></div></div><div className="rules-note"><ShieldCheck size={16}/><span>台灣標示規範輔助檢查<br/><small>規則查核：{CHECKED_AT} · 仍需實印驗收</small></span></div></aside></div>
    <footer className="page-footer"><span><Leaf size={14}/>給每一份手作，一張清楚的標籤。</span><button onClick={() => setHelp(true)}>適用範圍與法規來源 ↗</button></footer></main></div>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><h2 id="help-title"><BookOpen size={23}/>使用說明與法規</h2><button aria-label="關閉說明" onClick={() => setHelp(false)}><X size={20}/></button></div><p>本工具協助台灣一般包裝烘焙點心製作標籤。數據與商品資訊由你確認；系統不推測營養、效期或食材。</p><Notice>目前為測試版，未完成法規專業審閱與實印量測。軟體檢查通過不等於全面合法。</Notice><h3>建議操作</h3><ol><li>確認商品適用範圍，再依步驟填寫資料。</li><li>每次新批次，重新填寫與確認有效日期。</li><li>更新預覽，處理缺字、內容溢出及待確認事項。</li><li>先用普通紙以 100% 列印測試，再使用相容貼紙。</li><li>定期匯出備份；清除網站資料會移除本機商品。</li></ol><h3>規則依據</h3><div className="source-list">{Object.entries(RULES).map(([id, r]) => <div key={id}><strong>{r.title}</strong><p>{r.provision}</p><small>{r.effectiveDate ? `適用版本生效：${r.effectiveDate}` : '各條沿革／產品政策詳見專案文件'}</small>{r.source && <a href={r.source} target="_blank" rel="noreferrer">官方來源 ↗</a>}</div>)}</div><button className="button secondary" onClick={() => { addProduct(true); setHelp(false); }}>加入一份虛構範例商品</button></section></div>}
  </div>;
}
