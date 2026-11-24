import { useState, useEffect, useLayoutEffect, useRef } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "bootstrap-icons/font/bootstrap-icons.css";

function createFontIcon(name) {
  return function FontIcon({ size = 16, className = "", strokeWidth, ...props }) {
    return <i className={`bi bi-${name}${className ? ` ${className}` : ""}`} style={{fontSize:size}} {...props} />;
  };
}

const Archive = createFontIcon("archive");
const AlertTriangle = createFontIcon("exclamation-triangle");
const BarChart3 = createFontIcon("bar-chart");
const Building2 = createFontIcon("buildings");
const CalendarDays = createFontIcon("calendar3");
const ClipboardList = createFontIcon("clipboard2-check");
const Download = createFontIcon("download");
const Eye = createFontIcon("eye");
const FileSpreadsheet = createFontIcon("file-earmark-spreadsheet");
const FileText = createFontIcon("file-earmark-text");
const ImageIcon = createFontIcon("image");
const Inbox = createFontIcon("inbox");
const Landmark = createFontIcon("bank");
const LayoutDashboard = createFontIcon("grid-1x2");
const Loader2 = createFontIcon("arrow-repeat");
const LogOut = createFontIcon("box-arrow-right");
const Mail = createFontIcon("envelope");
const MapPin = createFontIcon("geo-alt");
const Paperclip = createFontIcon("paperclip");
const Phone = createFontIcon("telephone");
const Receipt = createFontIcon("receipt");
const Search = createFontIcon("search");
const Settings = createFontIcon("gear");
const Ship = createFontIcon("truck");
const Moon = createFontIcon("moon-stars");
const Sun = createFontIcon("sun");
const Trash2 = createFontIcon("trash3");
const Upload = createFontIcon("upload");
const WalletCards = createFontIcon("wallet2");
const Robot = createFontIcon("robot");
const Send = createFontIcon("send");
const X = createFontIcon("x-lg");
const Plus = createFontIcon("plus-lg");
const Globe = createFontIcon("globe");
const Maximize2 = createFontIcon("arrows-fullscreen");
const ArrowLeft = createFontIcon("arrow-left");
const MessageSquare = createFontIcon("chat-dots");

const API = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
const DEFAULT_ADMIN_LOGIN = { username: "admin", password: "ChangeMe123!" };

// ── Auth token plumbing ───────────────────────────────────────────────────────
let authToken = null;
let onUnauthorized = () => {};

function setAuthToken(token) {
  authToken = token;
}

function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    onUnauthorized();
  }
  return res;
}

async function apiJson(url, options = {}) {
  const response = await authFetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Erreur HTTP ${response.status}`);
  }
  return data;
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

const STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow-x: hidden; }
  #root, #app { width: 100%; min-height: 100vh; }
  :root { color-scheme:light;--ink:#26313F;--paper:#F3F5F7;--accent:#5368D9;--accent-strong:#4053B5;--accent-light:#EEF0FC;--accent-fill:#5368D9;--accent-fill-hover:#4053B5;--teal:#31877E;--teal-soft:#E8F4F1;--amber:#A66D24;--amber-soft:#F9F0E2;--violet:#7659B0;--violet-soft:#F1ECF9;--rose:#B45C70;--rose-soft:#F8EAED;--sky:#3F7FA8;--sky-soft:#E8F2F8;--cyan:#277F91;--cyan-soft:#E5F3F5;--coral:#B76550;--coral-soft:#F9ECE7;--mint:#3F8E67;--mint-soft:#E8F4ED;--plum:#8D527F;--plum-soft:#F5EAF2;--muted:#6C7684;--border:#E0E4E8;--white:#FFFFFF;--danger:#B84A52;--success:#2E7D62;--info:#3F7FA8;--warning:#A66D24;--sidebar:#FBFCFD;--subtle:#F6F8F9;--subtle-strong:#F9FAFB;--hover:#F0F3F5;--hover-ink:#26313F;--nav-ink:#606B78;--quiet:#8C95A1;--danger-soft:#F8E8EA;--overlay:rgba(25,32,43,.56);--modal-shadow:0 22px 60px rgba(30,42,55,.16);--on-color:#FFFFFF; }
  :root[data-theme="dark"] { color-scheme:dark;--ink:#E3E8EE;--paper:#11161D;--accent:#8D9BE8;--accent-strong:#B2BDF3;--accent-light:#292F4A;--accent-fill:#5568CC;--accent-fill-hover:#485AB8;--teal:#65B9AD;--teal-soft:#1D3835;--amber:#D8A65E;--amber-soft:#3B3021;--violet:#A995D5;--violet-soft:#332B45;--rose:#D98B9B;--rose-soft:#402A31;--sky:#78AFD0;--sky-soft:#203543;--cyan:#66B9C7;--cyan-soft:#1D383D;--coral:#D89582;--coral-soft:#402D28;--mint:#72BD91;--mint-soft:#20382B;--plum:#C28AB5;--plum-soft:#3C2938;--muted:#9AA4B1;--border:#303844;--white:#1A2029;--danger:#ED858B;--success:#69C3A0;--info:#78AFD0;--warning:#D8A65E;--sidebar:#161C24;--subtle:#202731;--subtle-strong:#1D242D;--hover:#252D38;--hover-ink:#F2F5F8;--nav-ink:#AAB3BE;--quiet:#828C99;--danger-soft:#41282D;--overlay:rgba(0,0,0,.7);--modal-shadow:0 24px 70px rgba(0,0,0,.46); }
  body { font-family:"Inter Variable","Inter",Arial,sans-serif;background:var(--paper);color:var(--ink);min-height:100vh;letter-spacing:-.012em;transition:background-color .2s ease,color .2s ease; }
  .shell{display:flex;width:100%;min-height:100vh}
  .sidebar{width:244px;min-height:100vh;background:var(--sidebar);padding:22px 14px;display:flex;flex-direction:column;gap:3px;flex-shrink:0;border-right:1px solid var(--border)}
  .main{flex:1;min-width:0;width:100%;padding:72px 40px 32px;overflow-y:auto;overflow-x:hidden}
  .brand{display:flex;align-items:center;gap:10px;color:var(--ink);margin:0 8px 28px}
  .brand-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:var(--accent-fill);color:#fff;font-size:12px;font-weight:760;letter-spacing:.05em}
  .brand-copy{display:flex;flex-direction:column;line-height:1.15}
  .brand-copy strong{font-size:17px;font-weight:680;letter-spacing:.01em}
  .brand-copy small{font-size:10px;color:var(--quiet);text-transform:uppercase;letter-spacing:.12em;margin-top:4px}
  .login-brand{display:flex;align-items:center;gap:11px;margin-bottom:5px}
  .login-brand .brand-mark{width:34px;height:34px}
  .login-brand strong{font-size:21px;letter-spacing:-.025em}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:6px;color:var(--nav-ink);font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;background:none;width:100%;text-align:left;transition:background .14s,color .14s,border-color .14s}
  .nav-item i{flex:none;color:var(--nav-tone,var(--nav-ink))}
  .nav-item:hover{background:var(--hover);color:var(--hover-ink)}
  .nav-item.active{background:var(--nav-soft,var(--accent-light));color:var(--nav-active,var(--accent-strong));border-color:color-mix(in srgb,var(--nav-tone,var(--accent)) 28%,var(--border));font-weight:650}
  .nav-factures{--nav-tone:var(--accent);--nav-soft:var(--accent-light);--nav-active:var(--accent-strong)}
  .nav-clients{--nav-tone:var(--teal);--nav-soft:var(--teal-soft);--nav-active:var(--teal)}
  .nav-conteneurs{--nav-tone:var(--sky);--nav-soft:var(--sky-soft);--nav-active:var(--sky)}
  .nav-charges{--nav-tone:var(--amber);--nav-soft:var(--amber-soft);--nav-active:var(--amber)}
  .nav-virement_tva{--nav-tone:var(--violet);--nav-soft:var(--violet-soft);--nav-active:var(--violet)}
  .nav-virement_zizi{--nav-tone:var(--rose);--nav-soft:var(--rose-soft);--nav-active:var(--rose)}
  .nav-comptabilite{--nav-tone:var(--cyan);--nav-soft:var(--cyan-soft);--nav-active:var(--cyan)}
  .nav-anomalies{--nav-tone:var(--danger);--nav-soft:var(--danger-soft);--nav-active:var(--danger)}
  .nav-societe{--nav-tone:var(--coral);--nav-soft:var(--coral-soft);--nav-active:var(--coral)}
  .nav-label{flex:1;min-width:0}
  .nav-count{min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:var(--danger);color:#fff;font:700 10px/1 "JetBrains Mono Variable","JetBrains Mono",monospace}
  .sidebar-footer{margin-top:auto;padding-top:14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:7px}
  .sidebar-user{color:var(--muted);font-size:11px;padding:0 11px}
  .theme-toggle{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:7px;background:var(--white);color:var(--ink);font:600 12px/1 "Inter Variable","Inter",Arial,sans-serif;cursor:pointer;transition:background .14s,border-color .14s,color .14s}
  .theme-toggle:hover{background:var(--hover);border-color:color-mix(in srgb,var(--accent) 38%,var(--border))}
  .theme-toggle i{color:var(--accent);width:17px;text-align:center}
  .global-theme-toggle{position:fixed;top:20px;right:24px;width:auto;z-index:1100;padding:10px 13px;box-shadow:0 6px 20px rgba(15,23,42,.08)}
  :root[data-theme="dark"] .global-theme-toggle{box-shadow:0 8px 24px rgba(0,0,0,.28)}
  .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px}
  .page-title{font-size:27px;font-weight:680;letter-spacing:-.035em}
  .page-sub{color:var(--muted);font-size:14px;margin-top:4px}
  .page-factures{--page-tone:var(--accent);--page-soft:var(--accent-light)}
  .page-clients{--page-tone:var(--teal);--page-soft:var(--teal-soft)}
  .page-conteneurs{--page-tone:var(--sky);--page-soft:var(--sky-soft)}
  .page-charges{--page-tone:var(--amber);--page-soft:var(--amber-soft)}
  .page-virement_tva{--page-tone:var(--violet);--page-soft:var(--violet-soft)}
  .page-virement_zizi{--page-tone:var(--rose);--page-soft:var(--rose-soft)}
  .page-comptabilite{--page-tone:var(--cyan);--page-soft:var(--cyan-soft)}
  .page-anomalies{--page-tone:var(--danger);--page-soft:var(--danger-soft)}
  .page-societe{--page-tone:var(--coral);--page-soft:var(--coral-soft)}
  .main .page-title{color:var(--page-tone,var(--ink))}
  .main .card-header{background:color-mix(in srgb,var(--page-soft,var(--subtle)) 64%,var(--white))}
  .main thead th{background:color-mix(in srgb,var(--page-soft,var(--subtle)) 72%,var(--subtle))}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:36px}
  .stats-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:36px}
  .stat-card{background:var(--white);border-radius:7px;padding:19px 20px;border:1px solid var(--border);min-width:0}
  :is(.stats,.stats-3) .stat-card{border-top-width:3px}
  :is(.stats,.stats-3) .stat-card:nth-child(1){border-top-color:var(--accent)}
  :is(.stats,.stats-3) .stat-card:nth-child(2){border-top-color:var(--teal)}
  :is(.stats,.stats-3) .stat-card:nth-child(3){border-top-color:var(--amber)}
  :is(.stats,.stats-3) .stat-card:nth-child(4){border-top-color:var(--violet)}
  :is(.stats,.stats-3) .stat-card:nth-child(1){background:color-mix(in srgb,var(--accent-light) 58%,var(--white))}
  :is(.stats,.stats-3) .stat-card:nth-child(2){background:color-mix(in srgb,var(--teal-soft) 58%,var(--white))}
  :is(.stats,.stats-3) .stat-card:nth-child(3){background:color-mix(in srgb,var(--amber-soft) 58%,var(--white))}
  :is(.stats,.stats-3) .stat-card:nth-child(4){background:color-mix(in srgb,var(--violet-soft) 58%,var(--white))}
  :is(.stats,.stats-3) .stat-card:nth-child(2) .stat-value{color:var(--teal)}
  :is(.stats,.stats-3) .stat-card:nth-child(3) .stat-value{color:var(--amber)}
  :is(.stats,.stats-3) .stat-card:nth-child(4) .stat-value{color:var(--violet)}
  .stat-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px}
  .stat-value{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:25px;font-weight:620;letter-spacing:-.045em}
  .stat-value.accent{color:var(--accent)}
  .stat-value.success{color:var(--success)}
  .stat-value.danger{color:var(--danger)}
  .stat-value.info{color:var(--info)}
  .card{background:var(--white);border-radius:7px;border:1px solid var(--border);overflow:hidden;width:100%}
  .card-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
  .card-title{font-weight:600;font-size:16px}
  .table-scroll{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;min-width:760px;border-collapse:collapse;table-layout:auto}
  thead th{padding:12px 20px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:var(--subtle);border-bottom:1px solid var(--border);white-space:nowrap}
  tbody tr{border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
  tbody tr:last-child{border-bottom:none}
  tbody tr:hover{background:var(--subtle)}
  tbody td{padding:14px 20px;font-size:14px}
  .mono{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:12px}
  .badge{display:inline-block;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:650}
  .badge-paid{background:var(--teal-soft);color:var(--success)}
  .badge-pending{background:var(--amber-soft);color:var(--amber)}
  .badge-transit{background:var(--sky-soft);color:var(--info)}
  .badge-arrived{background:var(--teal-soft);color:var(--success)}
  .badge-customs{background:var(--amber-soft);color:var(--warning)}
  .badge-delivered{background:var(--teal-soft);color:var(--success)}
  .badge-cloture{background:var(--teal-soft);color:var(--success)}
  .badge-encours{background:var(--accent-light);color:var(--accent)}
  .badge-physique{background:var(--violet-soft);color:var(--violet)}
  .badge-societe{background:var(--sky-soft);color:var(--info)}
  :root[data-theme="dark"] .badge-paid,
  :root[data-theme="dark"] .badge-arrived,
  :root[data-theme="dark"] .badge-delivered,
  :root[data-theme="dark"] .badge-cloture{background:var(--teal-soft);color:var(--teal)}
  :root[data-theme="dark"] .badge-pending,
  :root[data-theme="dark"] .badge-customs{background:var(--amber-soft);color:var(--amber)}
  :root[data-theme="dark"] .badge-encours{background:var(--accent-light);color:var(--accent)}
  :root[data-theme="dark"] .badge-transit,
  :root[data-theme="dark"] .badge-societe{background:var(--sky-soft);color:var(--sky)}
  :root[data-theme="dark"] .badge-physique{background:var(--violet-soft);color:var(--violet)}
  .expanded-row td{padding:0}
  .invoice-stamp{background:var(--subtle-strong);border-top:1px solid var(--border);padding:23px 28px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
  .container-stamp{background:var(--subtle-strong);border-top:1px solid var(--border);padding:23px 28px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
  .stamp-section h4{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px}
  .stamp-section p{font-size:14px}
  .stamp-amount{text-align:right}
  .stamp-amount .big{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:30px;font-weight:620;color:var(--accent)}
  .stamp-amount .label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
  .stamp-actions{display:flex;gap:10px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;border-radius:7px;font-size:13px;font-weight:620;cursor:pointer;border:none;transition:background .14s,border-color .14s,color .14s;font-family:inherit;white-space:nowrap}
  .btn svg{flex:none}
  .icon-spin{animation:iconSpin .8s linear infinite}
  @keyframes iconSpin{to{transform:rotate(360deg)}}
  .btn:disabled{opacity:.55;cursor:not-allowed}
  .btn-primary{background:var(--accent-fill);color:var(--on-color)}
  .btn-primary:hover:not(:disabled){background:var(--accent-fill-hover)}
  .btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--border)}
  .btn-ghost:hover:not(:disabled){background:var(--paper)}
  .btn-danger{background:var(--danger-soft);color:var(--danger)}
  .btn-sm{padding:6px 12px;font-size:12px}
  .btn-success{background:var(--success);color:#071A10}
  .btn-success:hover:not(:disabled){background:#1E8449}
  .btn-info{background:var(--info);color:#07111F}
  .btn-info:hover:not(:disabled){background:#1A5276}
  .btn-warning{background:var(--warning);color:#1C1100}
  .btn-warning:hover:not(:disabled){background:#D68910}
  .modal-overlay{position:fixed;inset:0;background:var(--overlay);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px}
  .modal{background:var(--white);border-radius:11px;border:1px solid var(--border);box-shadow:var(--modal-shadow);width:100%;max-width:760px;max-height:90vh;overflow-y:auto;padding:32px}
  .modal-title{font-size:22px;font-weight:680;letter-spacing:-.02em;margin-bottom:26px}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .form-group{display:flex;flex-direction:column;gap:6px;min-width:0}
  .form-group.full{grid-column:1/-1}
  label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)}
  input,select,textarea{padding:10px 12px;border:1px solid var(--border);border-radius:7px;font-family:inherit;font-size:14px;color:var(--ink);background:var(--white);transition:border-color .15s,box-shadow .15s;outline:none;width:100%}
  input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,70,229,.11)}
  textarea{resize:vertical;min-height:80px}
  /* Hide the native up/down spinner arrows on number inputs. They're the
     visual invitation to scroll/click-drag a value by accident. Since the
     wheel-blur handler below stops scroll-driven changes, but the little
     arrows themselves are still clickable steppers users can bump with a
     stray click, so we remove them entirely for numeric fields. */
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  .form-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:28px;padding-top:20px;border-top:1px solid var(--border)}
  .search-bar{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .search-input-wrap{position:relative;flex:1;min-width:200px}
  .search-input-wrap input{padding-left:38px;width:100%}
  .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px}
  .filter-group{display:flex;gap:8px;align-items:center}
  .filter-group select{min-width:140px}
  .empty{text-align:center;padding:60px 20px;color:var(--muted)}
  .empty-icon{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 14px;border-radius:9px;background:var(--accent-light);color:var(--accent)}
  .calc-preview{background:var(--subtle);border-radius:7px;padding:16px;margin-top:4px;border:1px solid var(--border)}
  .calc-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
  .calc-row.total{font-weight:700;font-size:15px;border-top:1px solid var(--border);padding-top:8px;margin-top:4px}
  .calc-row.adjust{color:var(--warning);font-weight:600}
  .toggle-group{display:flex;gap:8px;background:var(--subtle);padding:4px;border-radius:7px;border:1px solid var(--border)}
  .toggle-btn{flex:1;padding:8px 14px;border-radius:6px;border:none;background:transparent;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s}
  .toggle-btn.active{background:var(--accent-fill);color:var(--on-color)}
  .client-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .client-card{background:var(--white);border:1px solid var(--border);border-radius:7px;padding:20px;min-width:0}
  .client-card:nth-child(6n+1){border-top:3px solid var(--teal);background:color-mix(in srgb,var(--teal-soft) 38%,var(--white))}
  .client-card:nth-child(6n+2){border-top:3px solid var(--sky);background:color-mix(in srgb,var(--sky-soft) 38%,var(--white))}
  .client-card:nth-child(6n+3){border-top:3px solid var(--violet);background:color-mix(in srgb,var(--violet-soft) 38%,var(--white))}
  .client-card:nth-child(6n+4){border-top:3px solid var(--coral);background:color-mix(in srgb,var(--coral-soft) 38%,var(--white))}
  .client-card:nth-child(6n+5){border-top:3px solid var(--mint);background:color-mix(in srgb,var(--mint-soft) 38%,var(--white))}
  .client-card:nth-child(6n){border-top:3px solid var(--plum);background:color-mix(in srgb,var(--plum-soft) 38%,var(--white))}
  .client-name{font-weight:600;font-size:16px;margin-bottom:6px}
  .client-ice{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:12px;color:var(--muted);margin-bottom:12px}
  .client-detail{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:7px;margin-bottom:6px}
  .client-detail svg{flex:none;color:var(--muted)}
  .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:white;padding:12px 20px;border-radius:10px;font-size:14px;z-index:9999;animation:slideIn .2s ease;max-width:calc(100vw - 48px)}
  .toast.error{background:var(--danger)}
  @keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  .loading{text-align:center;padding:60px;color:var(--muted)}
  .doc-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
  .doc-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--subtle);border-radius:7px;border:1px solid var(--border);transition:all .15s;flex-wrap:wrap;gap:8px}
  .doc-item:hover{background:var(--hover);border-color:var(--accent)}
  .doc-info{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
  .doc-icon{display:grid;place-items:center;color:var(--accent)}
  .doc-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .doc-size{font-size:11px;color:var(--muted);font-family:"JetBrains Mono Variable","JetBrains Mono",monospace}
  .doc-actions{display:flex;gap:6px;flex-wrap:wrap}
  .doc-actions button{padding:5px 10px;font-size:11px}
  .upload-zone{border:1px dashed var(--muted);border-radius:9px;padding:24px;text-align:center;cursor:pointer;transition:all .15s;background:var(--subtle)}
  .upload-zone:hover{border-color:var(--accent);background:var(--accent-light)}
  .upload-zone.dragover{border-color:var(--accent);background:var(--accent-light)}
  .upload-zone-text{color:var(--muted);font-size:13px;margin-top:8px}
  .upload-zone-icon{display:grid;place-items:center;color:var(--accent)}
  .section-title{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:660;margin-bottom:16px;color:var(--ink)}
  .doc-section{margin-top:20px;padding-top:20px;border-top:1px solid var(--border)}
  .anomaly-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  .anomaly-filters{display:flex;gap:6px;flex-wrap:wrap}
  .anomaly-list{display:flex;flex-direction:column;gap:10px}
  .anomaly-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:start;padding:17px 18px;background:var(--white);border:1px solid var(--border);border-left:4px solid var(--warning);border-radius:8px}
  .anomaly-card.critical{border-left-color:var(--danger)}
  .anomaly-icon{width:34px;height:34px;border-radius:7px;display:grid;place-items:center;background:var(--amber-soft);color:var(--warning)}
  .anomaly-card.critical .anomaly-icon{background:var(--danger-soft);color:var(--danger)}
  .anomaly-title{font-size:14px;font-weight:680;margin-bottom:4px}
  .anomaly-message{font-size:13px;color:var(--muted);line-height:1.45}
  .anomaly-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;font-size:11px;color:var(--quiet)}
  .anomaly-entity{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;color:var(--ink)}
  .anomaly-note{padding:12px 15px;border:1px solid var(--border);border-radius:7px;background:var(--subtle);font-size:12px;color:var(--muted);margin-bottom:18px}
  .badge-critical{background:var(--danger-soft);color:var(--danger)}
  .badge-warning{background:var(--amber-soft);color:var(--warning)}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:36px}
  .kpi-card{background:var(--white);border-radius:7px;padding:21px;border:1px solid var(--border);position:relative;overflow:hidden;min-width:0}
  .kpi-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}
  .kpi-card:nth-child(2)::before{background:var(--teal)}
  .kpi-card:nth-child(3)::before{background:var(--amber)}
  .kpi-card:nth-child(4)::before{background:var(--violet)}
  .kpi-card:nth-child(1){background:color-mix(in srgb,var(--accent-light) 45%,var(--white))}
  .kpi-card:nth-child(2){background:color-mix(in srgb,var(--teal-soft) 45%,var(--white))}
  .kpi-card:nth-child(3){background:color-mix(in srgb,var(--amber-soft) 45%,var(--white))}
  .kpi-card:nth-child(4){background:color-mix(in srgb,var(--violet-soft) 45%,var(--white))}
  .kpi-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:8px}
  .kpi-value{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:23px;font-weight:620}
  .kpi-sub{font-size:12px;color:var(--muted);margin-top:4px}
  .chart-bar{display:flex;align-items:flex-end;gap:8px;height:200px;padding:20px 0}
  .chart-bar-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
  .chart-bar-fill{width:100%;border-radius:6px 6px 0 0;transition:height .3s ease;min-height:4px}
  .chart-bar-label{font-size:10px;color:var(--muted);text-align:center}
  .chart-bar-value{font-size:11px;font-weight:600;font-family:"JetBrains Mono Variable","JetBrains Mono",monospace}
  .progress-bar{background:var(--border);border-radius:4px;height:8px;overflow:hidden}
  .progress-bar-fill{height:100%;border-radius:4px;transition:width .3s ease}
  .tax-card{background:var(--white);border-radius:9px;border:1px solid var(--border);padding:24px;margin-bottom:20px;min-width:0}
  .tax-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .tax-card-title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:670}
  .tax-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);gap:12px}
  .tax-row:last-child{border-bottom:none}
  .tax-row.highlight{background:var(--subtle);margin:0 -24px;padding:10px 24px;border-bottom:none}
  .tax-label{font-size:13px;color:var(--muted)}
  .tax-value{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:13px;font-weight:600;text-align:right}
  .tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:24px;flex-wrap:wrap}
  .tab{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;font-size:14px;font-weight:550;color:var(--muted);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
  .tab:hover{color:var(--ink)}
  .tab.active{color:var(--accent);border-bottom-color:var(--accent)}
  .compta-grid{display:grid;grid-template-columns:2fr 1fr;gap:24px;min-width:0}
  .compta-main{min-width:0}
  .compta-side{display:flex;flex-direction:column;gap:20px;min-width:0}
  .mini-stat{background:var(--white);border-radius:9px;border:1px solid var(--border);padding:20px}
  .mini-stat:nth-child(3n+1){border-left:3px solid var(--sky)}
  .mini-stat:nth-child(3n+2){border-left:3px solid var(--teal)}
  .mini-stat:nth-child(3n){border-left:3px solid var(--violet)}
  .mini-stat-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
  .mini-stat-value{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:19px;font-weight:600}
  .tva-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:24px}
  .tva-card{background:var(--white);border-radius:9px;border:1px solid var(--border);padding:24px;text-align:center;min-width:0}
  .tva-card:nth-child(1){border-top:3px solid var(--sky)}
  .tva-card:nth-child(2){border-top:3px solid var(--rose)}
  .tva-card:nth-child(3){border-top:3px solid var(--amber)}
  .tva-card-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:12px}
  .tva-card-value{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:26px;font-weight:600}
  .tva-card-sub{font-size:12px;color:var(--muted);margin-top:4px}
  .acompte-row{display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--border)}
  .acompte-row:last-child{border-bottom:none}
  .acompte-date{font-size:13px;color:var(--muted);width:100px;flex-shrink:0}
  .acompte-bar{flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;min-width:0}
  .acompte-bar-fill{height:100%;border-radius:4px;background:var(--accent)}
  .acompte-montant{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:13px;font-weight:600;width:120px;text-align:right;flex-shrink:0}
  .exercice-row{display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap}
  .exercice-row:last-child{border-bottom:none}
  .exercice-annee{font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:17px;font-weight:600;width:80px}
  .exercice-statut{font-size:12px}
  .exercice-ca{flex:1;text-align:right;font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:13px}
  .exercice-resultat{flex:1;text-align:right;font-family:"JetBrains Mono Variable","JetBrains Mono",monospace;font-size:13px}
  .exercice-actions{display:flex;gap:8px}

  .agent-fab{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;border:none;background:var(--accent-fill);color:var(--on-color);box-shadow:0 12px 28px rgba(30,42,55,.24);display:grid;place-items:center;cursor:pointer;z-index:1200;transition:transform .15s,background .15s}
  .agent-fab:hover{transform:translateY(-2px);background:var(--accent-fill-hover)}
  .agent-panel{position:fixed;right:24px;bottom:92px;width:420px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 120px);background:var(--white);border:1px solid var(--border);border-radius:14px;box-shadow:var(--modal-shadow);display:flex;flex-direction:column;z-index:1200;overflow:hidden}
  .agent-header{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--border);background:var(--subtle-strong);flex:none}
  .agent-avatar{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--accent-light);color:var(--accent);flex:none}
  .agent-header-copy{min-width:0}
  .agent-header-copy strong{display:block;font-size:14px;line-height:1.2}
  .agent-header-copy small{display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent-header-actions{margin-left:auto;display:flex;gap:5px;flex:none}
  .agent-icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:background .15s,color .15s}
  .agent-icon-btn:hover{background:var(--hover);color:var(--ink)}
  .agent-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--paper);min-height:0}
  .agent-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:26px 12px;color:var(--muted)}
  .agent-empty-icon{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:var(--accent-light);color:var(--accent);margin-bottom:4px}
  .agent-empty strong{color:var(--ink);font-size:15px}
  .agent-empty p{font-size:12.5px;line-height:1.5;max-width:290px}
  .agent-suggestions{display:flex;flex-direction:column;gap:6px;width:100%;margin-top:10px}
  .agent-suggestion{padding:9px 12px;border:1px solid var(--border);border-radius:9px;background:var(--white);color:var(--ink);font-family:inherit;font-size:12.5px;text-align:left;cursor:pointer;transition:border-color .15s,background .15s}
  .agent-suggestion:hover{border-color:var(--accent);background:var(--accent-light)}
  .agent-msg{max-width:88%;padding:10px 13px;border-radius:12px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
  .agent-msg.assistant{background:var(--white);border:1px solid var(--border);border-bottom-left-radius:4px;align-self:flex-start}
  .agent-msg.user{background:var(--accent-fill);color:var(--on-color);border-bottom-right-radius:4px;align-self:flex-end}
  .agent-msg.is-error{background:var(--danger-soft);color:var(--danger);border-color:var(--danger-soft)}
  .agent-artifacts{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  .agent-artifact{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--subtle);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left}
  .agent-artifact:hover{background:var(--accent-light)}
  .agent-typing{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);align-self:flex-start;padding:4px 2px}
  .agent-typing-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:agentPulse 1s infinite}
  .agent-typing-dot:nth-child(2){animation-delay:.15s}
  .agent-typing-dot:nth-child(3){animation-delay:.3s}
  @keyframes agentPulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1)}}
  .agent-warning{padding:9px 14px;font-size:11.5px;line-height:1.45;color:var(--warning);background:var(--amber-soft);border-top:1px solid var(--border)}
  .agent-input-row{border-top:1px solid var(--border);padding:10px;display:flex;gap:8px;align-items:flex-end;background:var(--white);flex:none}
  .agent-input{flex:1;resize:none;min-height:42px;max-height:120px;padding:11px 12px;border:1px solid var(--border);border-radius:10px;font-family:inherit;font-size:13.5px;line-height:1.4;background:var(--white);color:var(--ink);outline:none}
  .agent-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,70,229,.11)}
  .agent-send{width:42px;height:42px;border-radius:10px;border:none;background:var(--accent-fill);color:var(--on-color);display:grid;place-items:center;cursor:pointer;flex:none}
  .agent-send:hover:not(:disabled){background:var(--accent-fill-hover)}
  .agent-send:disabled{opacity:.5;cursor:not-allowed}
  .agent-hint{padding:0 14px 9px;font-size:10.5px;color:var(--quiet);background:var(--white);flex:none}

  .agent-workspace{height:calc(100vh - 104px);height:calc(100dvh - 104px);min-height:560px;display:flex;background:var(--white);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(30,42,55,.06)}
  .agent-workspace-sidebar{width:292px;flex:none;display:flex;flex-direction:column;background:var(--subtle-strong);border-right:1px solid var(--border)}
  .agent-workspace-sidebar-header{padding:16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:12px}
  .agent-brand-row{display:flex;align-items:center;gap:10px}
  .agent-brand-row strong{display:block;font-size:14px;line-height:1.25}
  .agent-brand-row small{display:block;font-size:11px;color:var(--muted);margin-top:2px}
  .agent-new-btn{width:100%;justify-content:center}
  .agent-conv-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:4px}
  .agent-section-title{display:flex;align-items:center;gap:6px;padding:4px 4px 6px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--quiet)}
  .agent-conv-empty{padding:24px 12px;text-align:center;font-size:12px;color:var(--muted)}
  .agent-conv-item{display:flex;flex-direction:column;gap:3px;padding:10px 11px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ink);font-family:inherit;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}
  .agent-conv-item:hover{background:var(--hover)}
  .agent-conv-item.active{background:var(--accent-light);border-color:var(--accent)}
  .agent-conv-item strong{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .agent-conv-item small{font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .agent-workspace-sidebar-footer{padding:12px 16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px}
  .agent-config-line{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted)}
  .agent-workspace-sidebar-footer small{font-size:10.5px;color:var(--quiet)}
  .agent-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--muted)}
  .agent-dot.online{background:var(--success)}
  .agent-dot.offline{background:var(--danger)}
  .agent-workspace-main{flex:1;min-width:0;display:flex;flex-direction:column}
  .agent-workspace-header{display:flex;align-items:center;gap:11px;padding:15px 20px;border-bottom:1px solid var(--border);background:var(--white);flex:none}
  .agent-workspace-body{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--paper)}
  .agent-workspace .agent-messages{padding:24px 28px;gap:16px}
  .agent-workspace .agent-msg{max-width:76%;font-size:14px;padding:12px 15px}
  .agent-workspace .agent-input-row{padding:14px 20px;background:var(--white)}
  .agent-workspace .agent-input{min-height:48px;font-size:14px;padding:13px 14px}
  .agent-workspace .agent-send{width:48px;height:48px}
  .agent-workspace .agent-hint{padding:0 20px 12px}
  .agent-empty-wide{max-width:560px;margin:auto;padding:38px 20px}
  .agent-empty-wide .agent-suggestions{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;margin-top:14px}
  .agent-empty-wide .agent-suggestion{font-size:12px}
  .agent-workspace-meta{font-size:11px;color:var(--quiet);margin-left:auto;white-space:nowrap}

  @media (max-width: 1024px) {
    .kpi-grid, .stats, .stats-3 { grid-template-columns: repeat(2,1fr); }
    .compta-grid { grid-template-columns: 1fr; }
    .tva-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .shell { flex-direction: column; }
    .sidebar { width: 100%; min-height: auto; flex-direction: row; overflow-x: auto; }
    .main { padding: 70px 20px 20px; }
    .global-theme-toggle { top: 16px; right: 16px; }
    .kpi-grid, .stats, .stats-3 { grid-template-columns: 1fr; }
    .form-grid { grid-template-columns: 1fr; }
    .invoice-stamp, .container-stamp { grid-template-columns: 1fr; }
    .anomaly-card { grid-template-columns: auto minmax(0,1fr); }
    .anomaly-card > .btn { grid-column: 2; justify-self:start; }
    .agent-fab { right:16px; bottom:16px; width:50px; height:50px; }
    .agent-panel { right:8px; left:8px; bottom:76px; width:auto; height:calc(100vh - 96px); max-height:none; }
    .agent-workspace { flex-direction:column; height:auto; min-height:0; }
    .agent-workspace-sidebar { width:100%; max-height:240px; border-right:none; border-bottom:1px solid var(--border); }
    .agent-conv-list { max-height:145px; }
    .agent-workspace .agent-messages { padding:18px 16px; }
    .agent-workspace .agent-msg { max-width:90%; }
    .agent-workspace .agent-input-row { padding:10px 12px; }
    .agent-workspace .agent-hint { padding:0 12px 9px; }
    .agent-empty-wide .agent-suggestions { grid-template-columns:1fr; }
  }
`;

const COMPANY = { name:"TRADIVIA", ice:"003748656000065", rc:"681839", cnss:"6201633", patente:"34108310", if_number:"66999694", address:"Ste Tradivia au 26, Rue Mers Sultan, Appartement 3, 1er Etage, 20370 Anfa - Anfa (AR)", phone:"+212 5 21 24 81 48", email:"tradiviasarl@gmail.com" };

function frNumber(n, decimals) {
  const num = Number(n || 0);
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = neg ? "-" : "";
  return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}
const fmt = n => frNumber(n, 2);
const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const fmtInt = n => n ? frNumber(n, 0) : "0";
const fmtFileSize = bytes => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const STATUTS = [
  { value: "En transit", label: "En transit", class: "badge-transit" },
  { value: "Arrivé", label: "Arrivé", class: "badge-arrived" },
  { value: "Dédouanement", label: "Dédouanement", class: "badge-customs" },
  { value: "Livré", label: "Livré", class: "badge-delivered" },
  { value: "En attente", label: "En attente", class: "badge-pending" }
];

const TYPES_CONTENEUR = ["20ft", "40ft", "40ft HC", "20ft Reefer", "40ft Reefer", "Open Top", "Flat Rack"];

const CATEGORIES_CHARGE = ["Fournitures", "Logistique", "Salaires", "Charges sociales", "Marketing", "Frais bancaires", "Loyer", "Entretien", "Transport", "Autres"];

const MODES_PAIEMENT = ["Virement", "Cheque", "Especes", "Prelevement", "Carte bancaire"];

const MODES_PAIEMENT_FACTURE = ["Cheque", "Virement bancaire", "Especes"];

const ANOMALY_TYPE_LABELS = {
  duplicate_invoice: "Doublon facture",
  price_outlier: "Prix inhabituel",
  vat_mismatch: "TVA",
  weight_mismatch: "Poids",
  suspicious_identity: "Identifiant",
  suspicious_bank_account: "RIB / IBAN",
  unusual_charge: "Charge"
};

function ThemeToggle({ theme, onToggle, className = "" }) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const nextLabel = isDark ? "Mode clair" : "Mode sombre";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={onToggle}
      aria-label={`Activer le ${nextLabel.toLowerCase()}`}
      title={`Activer le ${nextLabel.toLowerCase()}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{nextLabel}</span>
    </button>
  );
}

function getBadgeClass(statut) {
  return STATUTS.find(s => s.value === statut)?.class || "badge-pending";
}

function FileKindIcon({ mimeType, size = 18 }) {
  let Icon = FileText;
  if (mimeType?.includes("excel") || mimeType?.includes("sheet")) Icon = FileSpreadsheet;
  else if (mimeType?.includes("image")) Icon = ImageIcon;
  else if (mimeType?.includes("zip")) Icon = Archive;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function numToWords(n) {
  const ones=["","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
  const tens=["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingts","quatre-vingt"];
  function b100(n){if(n<20)return ones[n];const t=Math.floor(n/10),u=n%10;if(t===7)return"soixante-"+ones[10+u];if(t===9)return"quatre-vingt-"+(u?ones[u]:"");return tens[t]+(u?"-"+ones[u]:(t===8?"s":""));}
  function b1000(n){if(n<100)return b100(n);const h=Math.floor(n/100),r=n%100;return(h>1?ones[h]+" ":"")+"cent"+(r?(h>1?"s":"")+"-"+b100(r):"s");}
  n=Math.round(n);if(n===0)return"zero";let res="";
  if(n>=1000){const m=Math.floor(n/1000);res+=(m>1?b1000(m)+" ":"")+"mille ";n%=1000;}
  if(n>0)res+=b1000(n);return res.trim();
}

// ── Calculs de facture (miroir cote client des formules serveur, pour l'apercu) ──
function calcTotals(calcType, values) {
  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  if (calcType === "total") {
    const total = parseFloat(values.total_ttc_saisi);
    const pu = round2(parseFloat(values.pu_ttc));
    if (!total || !pu || total <= 0 || pu <= 0) return null;
    const tva = round2(total / 6);
    const montant_ht = round2(total - tva);
    const qte_kg = Math.floor(total / pu);
    const pt_ttc = round2(qte_kg * pu);
    const ajustement_arrondi = round2(total - pt_ttc);
    return { qte_kg, pu_ttc: pu, pt_ttc, montant_ht, tva, ajustement_arrondi, total_ttc_saisi: total };
  }

  const qte = parseFloat(values.qte_kg);
  const pu = round2(parseFloat(values.pu_ttc));
  if (!qte || !pu || qte <= 0 || pu <= 0) return null;
  const pt_ttc = round2(qte * pu);
  const tva = round2(pt_ttc / 6);
  const montant_ht = round2(pt_ttc - tva);
  return { qte_kg: qte, pu_ttc: pu, pt_ttc, montant_ht, tva, ajustement_arrondi: 0, total_ttc_saisi: null };
}

// Construit les variables du template Word/PDF a partir d'une facture enregistree.
function buildInvoiceVars(facture, client) {
  const isPhysique = facture.client_type === "physique";
  const totalTTC = (facture.pt_ttc || 0) + (facture.ajustement_arrondi || 0);

  const client_nom = isPhysique ? (facture.client_nom_manuel || client?.name || "-") : (client?.name || "-");
  const client_adresse = isPhysique ? (facture.client_adresse_manuel || client?.address || "-") : (client?.address || "-");
  const client_identity = isPhysique
    ? `CIN : ${facture.client_cin_manuel || client?.cin || "-"}`
    : `ICE : ${client?.ice || "-"}`;

  return {
    client_nom,
    client_identity,
    client_adresse,
    numero: facture.numero,
    lieu: facture.lieu,
    date: fmtDate(facture.date),
    qte_kg: fmtInt(facture.qte_kg),
    designation: facture.designation,
    pu_ttc: fmt(facture.pu_ttc),
    total_ttc: fmt((facture.pt_ttc || 0) + (facture.ajustement_arrondi || 0)),
    pt_ttc: fmt(facture.pt_ttc),
    montant_ht: fmt(facture.montant_ht),
    tva: fmt(facture.tva),
    pt_ttc_letters: numToWords(Math.round(totalTTC)) + " dirhams",
    mode_paiement: facture.mode_paiement || "-",
    ajustement_arrondi: fmt(facture.ajustement_arrondi || 0)
  };
}

async function exportInvoice(facture, client, format) {
  const vars = buildInvoiceVars(facture, client);
  const resp = await authFetch(API+(format==="pdf"?"/invoice":"/invoice/docx"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(vars)});
  if(!resp.ok){const e=await resp.json().catch(()=>({error:resp.statusText}));throw new Error(e.error);}
  const blob=await resp.blob();
  downloadBlob(blob, `facture_${facture.numero.replaceAll("/","_")}.${format}`);
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erreur de connexion");
      onLogin(data.token, data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--paper)"}}>
      <form onSubmit={handleSubmit} style={{background:"var(--white)",padding:40,borderRadius:16,border:"1px solid var(--border)",width:"100%",maxWidth:380}}>
        <div className="login-brand"><span className="brand-mark">TV</span><strong>Tradivia</strong></div>
        <div style={{color:"var(--muted)",fontSize:13,marginBottom:28}}>Connexion a votre espace</div>

        {error && <div style={{background:"var(--danger-soft)",color:"var(--danger)",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:16}}>{error}</div>}

        <div className="form-group" style={{marginBottom:16}}>
          <label>Identifiant</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{marginBottom:24}}>
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{width:"100%",justifyContent:"center"}}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function AgentChat({ user, onDataChanged, onOpenWorkspace }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    (async () => {
      try {
        const cfg = await apiJson(API + "/agent/config");
        setConfig(cfg);
        const conversations = await apiJson(API + "/agent/conversations");
        if (conversations.length) {
          const latest = conversations[0];
          setConversationId(latest.id);
          const data = await apiJson(API + "/agent/conversations/" + latest.id + "/messages");
          setMessages((data.messages || []).map(item => ({ role: item.role, content: item.content })));
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [open, loaded]);

  useEffect(() => { if (open) scrollToBottom(); }, [messages, sending, open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 60); }, [open]);

  const startNewConversation = async () => {
    try {
      const conversation = await apiJson(API + "/agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nouvelle conversation" })
      });
      setConversationId(conversation.id);
      setMessages([]);
      setError("");
      setTimeout(() => inputRef.current?.focus(), 40);
    } catch (e) {
      setError(e.message);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    if (config && !config.configured) {
      setError("L'assistant n'est pas configure. Ajoutez AGENT_API_KEY dans le fichier .env puis redemarrez l'API.");
      return;
    }
    setSending(true);
    setError("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setInput("");
    try {
      const data = await apiJson(API + "/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message })
      });
      setConversationId(data.conversation_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, artifacts: data.artifacts || [] }]);
      if (onDataChanged) onDataChanged();
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: e.message, isError: true }]);
      setError(e.message);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const downloadArtifact = async (artifact) => {
    try {
      const response = await authFetch(API + artifact.url);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Telechargement impossible");
      }
      downloadBlob(await response.blob(), artifact.filename || "document");
    } catch (e) {
      setError(e.message);
    }
  };

  const suggestions = [
    "Fais le point sur la comptabilite de cette annee",
    "Quelles sont les factures impayees ?",
    "Prepare un ordre de virement TVA pour le trimestre",
    "Montre les conteneurs en transit"
  ];

  return (
    <>
      <button className="agent-fab" type="button" onClick={() => setOpen(value => !value)} title="Assistant Tradivia" aria-label="Assistant Tradivia">
        {open ? <X size={22} /> : <Robot size={24} />}
      </button>
      {open && (
        <section className="agent-panel" aria-label="Assistant Tradivia">
          <header className="agent-header">
            <div className="agent-avatar"><Robot size={18} /></div>
            <div className="agent-header-copy">
              <strong>Assistant Tradivia</strong>
              <small>{config?.configured ? `${config.model} · ${user?.username || ""}` : "Configuration requise"}</small>
            </div>
            <div className="agent-header-actions">
              <button className="agent-icon-btn" type="button" title="Ouvrir en plein ecran" onClick={() => { setOpen(false); onOpenWorkspace?.(); }}><Maximize2 size={17} /></button>
              <button className="agent-icon-btn" type="button" title="Nouvelle conversation" onClick={startNewConversation}><Plus size={17} /></button>
              <button className="agent-icon-btn" type="button" title="Fermer" onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
          </header>

          <div className="agent-messages" ref={messagesRef}>
            {messages.length === 0 && !sending && (
              <div className="agent-empty">
                <div className="agent-empty-icon"><Robot size={22} /></div>
                <strong>Que puis-je faire pour vous ?</strong>
                <p>Je peux creer des factures, suivre les conteneurs, analyser la comptabilite, preparer des ordres de virement et chercher sur le web.</p>
                <div className="agent-suggestions">
                  {suggestions.map(item => (
                    <button key={item} className="agent-suggestion" type="button" onClick={() => { setInput(item); inputRef.current?.focus(); }}>{item}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`agent-msg ${message.role === "user" ? "user" : "assistant"}${message.isError ? " is-error" : ""}`}>
                {message.content}
                {message.artifacts?.length > 0 && (
                  <div className="agent-artifacts">
                    {message.artifacts.map(artifact => (
                      <button key={artifact.url} className="agent-artifact" type="button" onClick={() => downloadArtifact(artifact)}>
                        <Download size={14} /> {artifact.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="agent-typing">
                <span className="agent-typing-dot" /><span className="agent-typing-dot" /><span className="agent-typing-dot" />
                L'assistant analyse la demande...
              </div>
            )}
          </div>

          {config && !config.configured && (
            <div className="agent-warning">
              Assistant non configure. Ajoutez <b>AGENT_API_KEY</b> et <b>AGENT_MODEL</b> dans <b>.env</b>, puis redemarrez l'API. Un fournisseur local compatible OpenAI (Ollama) fonctionne via <b>AGENT_BASE_URL</b>.
            </div>
          )}
          {error && <div className="agent-warning" style={{color:"var(--danger)"}}>{error}</div>}

          <form className="agent-input-row" onSubmit={sendMessage}>
            <textarea
              className="agent-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex : cree une facture pour Atlas, 1200 kg a 56 DH..."
              rows={1}
            />
            <button className="agent-send" type="submit" disabled={sending || !input.trim()} title="Envoyer"><Send size={17} /></button>
          </form>
          <div className="agent-hint">Les actions qui modifient le systeme demandent une confirmation. Verifiez toujours les montants et les RIB.</div>
        </section>
      )}
    </>
  );
}

function AgentWorkspace({ user, onDataChanged, onClose }) {
  const [config, setConfig] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  };

  const formatConversationDate = value => {
    if (!value) return "";
    const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T") + "Z";
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
      + " · " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  async function openConversation(id) {
    setLoadingConversation(true);
    setError("");
    try {
      const data = await apiJson(API + "/agent/conversations/" + id + "/messages");
      setConversationId(id);
      setMessages((data.messages || []).map(item => ({ role: item.role, content: item.content })));
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingConversation(false);
    }
  }

  async function loadWorkspace() {
    try {
      const [cfg, list] = await Promise.all([
        apiJson(API + "/agent/config"),
        apiJson(API + "/agent/conversations")
      ]);
      setConfig(cfg);
      setConversations(list);
      if (list.length) await openConversation(list[0].id);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const startNewConversation = async () => {
    try {
      const conversation = await apiJson(API + "/agent/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nouvelle conversation" })
      });
      setConversations(prev => [conversation, ...prev.filter(item => item.id !== conversation.id)]);
      setConversationId(conversation.id);
      setMessages([]);
      setInput("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 40);
    } catch (e) {
      setError(e.message);
    }
  };

  const sendMessage = async event => {
    event?.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    if (config && !config.configured) {
      setError("L'assistant n'est pas configure. Ajoutez AGENT_API_KEY dans le fichier .env puis redemarrez l'API.");
      return;
    }
    setSending(true);
    setError("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setInput("");
    try {
      const data = await apiJson(API + "/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message })
      });
      setConversationId(data.conversation_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, artifacts: data.artifacts || [] }]);
      if (onDataChanged) onDataChanged();
      apiJson(API + "/agent/conversations").then(setConversations).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: e.message, isError: true }]);
      setError(e.message);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  const handleKeyDown = event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const downloadArtifact = async artifact => {
    try {
      const response = await authFetch(API + artifact.url);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Telechargement impossible");
      }
      downloadBlob(await response.blob(), artifact.filename || "document");
    } catch (e) {
      setError(e.message);
    }
  };

  const suggestions = [
    "Cree une facture pour Grande Surface Atlas, 100 kg a 50 DH TTC/kg",
    "Quelles sont les factures impayees ?",
    "Prepare un ordre de virement TVA pour le trimestre",
    "Suis le conteneur MSCU1234567 sur Maersk",
    "Fais le point sur la comptabilite de cette annee",
    "Quels clients ou factures presentent des anomalies ?"
  ];

  const currentConversation = conversations.find(item => item.id === conversationId);
  const currentTitle = currentConversation?.title || "Nouvelle conversation";

  return (
    <section className="agent-workspace" aria-label="Espace assistant Tradivia">
      <aside className="agent-workspace-sidebar">
        <div className="agent-workspace-sidebar-header">
          <div className="agent-brand-row">
            <div className="agent-avatar"><Robot size={20} /></div>
            <div>
              <strong>Assistant Tradivia</strong>
              <small>Factures, conteneurs, comptabilite, web</small>
            </div>
          </div>
          <button className="btn btn-primary agent-new-btn" type="button" onClick={startNewConversation}>
            <Plus size={16} /> Nouvelle conversation
          </button>
        </div>
        <div className="agent-conv-list">
          <div className="agent-section-title"><MessageSquare size={14} /> Conversations</div>
          {conversations.length === 0 && <div className="agent-conv-empty">Aucune conversation pour le moment.</div>}
          {conversations.map(item => (
            <button
              key={item.id}
              type="button"
              className={`agent-conv-item ${conversationId === item.id ? "active" : ""}`}
              onClick={() => openConversation(item.id)}
            >
              <strong>{item.title || "Nouvelle conversation"}</strong>
              <small>{formatConversationDate(item.updated_at)}{item.message_count ? ` · ${item.message_count} message(s)` : ""}</small>
            </button>
          ))}
        </div>
        <div className="agent-workspace-sidebar-footer">
          <div className="agent-config-line">
            <span className={`agent-dot ${config?.configured ? "online" : "offline"}`} />
            {config?.configured ? config.model : "Assistant non configure"}
          </div>
          {config?.web_search && <small>Recherche web : {config.web_search_provider}</small>}
          {config?.web_browse && <small>Navigation web : Chrome</small>}
          <small>Les ecritures demandent une confirmation explicite.</small>
        </div>
      </aside>

      <div className="agent-workspace-main">
        <header className="agent-workspace-header">
          <button className="agent-icon-btn" type="button" title="Retour" onClick={onClose}><ArrowLeft size={18} /></button>
          <div className="agent-avatar"><Robot size={19} /></div>
          <div className="agent-header-copy">
            <strong>{currentTitle}</strong>
            <small>{config?.configured ? `${config.model} · ${user?.username || ""}` : "Configuration requise"}</small>
          </div>
          <span className="agent-workspace-meta">{user?.role}</span>
          <div className="agent-header-actions">
            <button className="agent-icon-btn" type="button" title="Nouvelle conversation" onClick={startNewConversation}><Plus size={18} /></button>
          </div>
        </header>

        <div className="agent-workspace-body">
          <div className="agent-messages" ref={messagesRef}>
            {loadingConversation && (
              <div className="agent-typing">Chargement de la conversation...</div>
            )}
            {!loadingConversation && messages.length === 0 && !sending && (
              <div className="agent-empty agent-empty-wide">
                <div className="agent-empty-icon"><Robot size={24} /></div>
                <strong>Que puis-je faire pour vous ?</strong>
                <p>Je peux creer des factures, preparer des ordres de virement, suivre les conteneurs, analyser la comptabilite et chercher sur le web.</p>
                <div className="agent-suggestions">
                  {suggestions.map(item => (
                    <button key={item} className="agent-suggestion" type="button" onClick={() => { setInput(item); inputRef.current?.focus(); }}>{item}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`agent-msg ${message.role === "user" ? "user" : "assistant"}${message.isError ? " is-error" : ""}`}>
                {message.content}
                {message.artifacts?.length > 0 && (
                  <div className="agent-artifacts">
                    {message.artifacts.map(artifact => (
                      <button key={artifact.url} className="agent-artifact" type="button" onClick={() => downloadArtifact(artifact)}>
                        <Download size={14} /> {artifact.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="agent-typing">
                <span className="agent-typing-dot" /><span className="agent-typing-dot" /><span className="agent-typing-dot" />
                L'assistant analyse la demande...
              </div>
            )}
          </div>

          {config && !config.configured && (
            <div className="agent-warning">
              Assistant non configure. Ajoutez <b>AGENT_API_KEY</b> et <b>AGENT_MODEL</b> dans <b>.env</b>, puis redemarrez l'API.
            </div>
          )}
          {error && <div className="agent-warning" style={{ color: "var(--danger)" }}>{error}</div>}

          <form className="agent-input-row" onSubmit={sendMessage}>
            <textarea
              className="agent-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question ou demandez une action... (Entree pour envoyer, Maj+Entree pour un retour a la ligne)"
              rows={1}
            />
            <button className="agent-send" type="submit" disabled={sending || !input.trim()} title="Envoyer"><Send size={19} /></button>
          </form>
          <div className="agent-hint">Les actions qui modifient le systeme demandent une confirmation. Verifiez toujours les montants et les RIB.</div>
        </div>
      </div>
    </section>
  );
}


function Dashboard({ token, user, onLogout }) {
  const [company, setCompany] = useState(null);
  const [companyDraft, setCompanyDraft] = useState(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const loadCompany = () => {
    setCompanyError("");
    apiJson(API + "/company").then(setCompany).catch(e => setCompanyError(e.message));
  };
  useEffect(loadCompany, []);
  const saveCompany = async event => {
    event.preventDefault();
    setCompanySaving(true);
    setCompanyError("");
    try {
      const saved = await apiJson(API + "/company", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(companyDraft) });
      setCompany(saved);
      setCompanyDraft(null);
      showToast("Informations de la societe enregistrees");
    } catch (e) { setCompanyError(e.message); }
    finally { setCompanySaving(false); }
  };
  const [page, setPage] = useState("factures");
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [containers, setContainers] = useState([]);
  const [charges, setCharges] = useState([]);
  const [chargeCategories, setChargeCategories] = useState([]);
  const [ordresVirement, setOrdresVirement] = useState([]);
  const [ordresVirementZizi, setOrdresVirementZizi] = useState([]);
  const [ovExportLoading, setOvExportLoading] = useState({});
  const [ovZiziExportLoading, setOvZiziExportLoading] = useState({});
  const [comptaData, setComptaData] = useState(null);
  const [tvaData, setTvaData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [exercices, setExercices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({});
  const [calcPreview, setCalcPreview] = useState(null);
  const [btnLoading, setBtnLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [comptaTab, setComptaTab] = useState("dashboard");
  const [comptaAnnee, setComptaAnnee] = useState(() => new Date().getFullYear());
  const [tvaTrimestre, setTvaTrimestre] = useState("");

  // Filtres conteneurs
  const [filterStatut, setFilterStatut] = useState("");
  const [filterFournisseur, setFilterFournisseur] = useState("");
  const [filterPortDepart, setFilterPortDepart] = useState("");
  const [filterPortArrivee, setFilterPortArrivee] = useState("");

  // Filtres charges
  const [filterChargeAnnee, setFilterChargeAnnee] = useState("");
  const [filterChargeCategorie, setFilterChargeCategorie] = useState("");
  const [filterChargeQ, setFilterChargeQ] = useState("");

  // Filtres factures
  const [filterFactureQ, setFilterFactureQ] = useState("");
  const [filterFactureAnnee, setFilterFactureAnnee] = useState("");
  const [filterFactureMois, setFilterFactureMois] = useState("");
  const [filterFactureClient, setFilterFactureClient] = useState("");
  const [filterFactureStatut, setFilterFactureStatut] = useState("");
  const [selectedFactureIds, setSelectedFactureIds] = useState(new Set());
  const [groupExportLoading, setGroupExportLoading] = useState(false);
  const [groupDeleteLoading, setGroupDeleteLoading] = useState(false);

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [dragOverId, setDragOverId] = useState(null);
  const fileInputRefs = useRef({});

  const showToast = (msg, error=false) => { setToast({msg,error}); setTimeout(()=>setToast(null),3500); };

  const loadAnomalies = async () => {
    setAnomalyLoading(true);
    try {
      setAnomalyData(await apiJson(API+"/anomalies"));
    } catch (e) {
      showToast(e.message || "Erreur analyse des anomalies", true);
    } finally {
      setAnomalyLoading(false);
    }
  };

  // ── Global fix: prevent mouse-wheel scroll from silently changing the
  // value of a focused number input (e.g. PU TTC 56.00 -> 55.99 while the
  // user just scrolls the page). Browsers apply wheel-to-increment on
  // <input type="number"> by default; this blurs the field the instant a
  // wheel event fires so scrolling never mutates a typed value. Combined
  // with the CSS above that hides the spin buttons, values in every numeric
  // field (quantite, PU TTC, montants, poids, nb sacs, etc.) can only ever
  // change by direct typing.
  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement && document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    };
    document.addEventListener("wheel", handleWheel, { passive: true });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  // ── Load from API ──
  const reloadData = async (silent = false) => {
    try {
      const [c,f,ct,ch,cat,ex,ov,zizi] = await Promise.all([
        apiJson(API+"/clients"),
        apiJson(API+"/factures"),
        apiJson(API+"/containers"),
        apiJson(API+"/charges"),
        apiJson(API+"/charges/categories"),
        apiJson(API+"/comptabilite/exercices"),
        apiJson(API+"/ordres-virement-tva"),
        apiJson(API+"/ordres-virement-zizi"),
      ]);
      setClients(c); setFactures(f); setContainers(ct); setCharges(ch); setChargeCategories(cat); setExercices(ex); setOrdresVirement(ov); setOrdresVirementZizi(zizi); setLoading(false);
    } catch (e) {
      if (!silent) showToast(e.message || "Impossible de joindre le serveur", true);
      setLoading(false);
    }
  };

  useEffect(() => { reloadData(true); }, []);

  useEffect(() => {
    if (!loading) loadAnomalies();
  }, [loading, factures, clients, containers, charges, ordresVirementZizi]);

  // ── Load comptabilite data ──
  useEffect(() => {
    if (page === "comptabilite") {
      loadComptaData();
    }
  }, [page, comptaAnnee, comptaTab, tvaTrimestre]);

  const loadComptaData = async () => {
    try {
      const [dash, tva] = await Promise.all([
        apiJson(API+"/comptabilite/dashboard?annee="+comptaAnnee),
        apiJson(API+"/comptabilite/tva?annee="+comptaAnnee+(tvaTrimestre?"&trimestre="+tvaTrimestre:"")),
      ]);
      setComptaData(dash);
      setTvaData(tva);
    } catch(e) {
      showToast("Erreur chargement comptabilite", true);
    }
  };

  const filteredFactures = factures.filter(f => {
    const cl = clients.find(c => c.id === f.clientId);
    const nomAffiche = f.client_type === "physique" ? (f.client_nom_manuel || cl?.name || "") : (cl?.name || "");
    const q = filterFactureQ.trim().toLocaleLowerCase("fr");
    const matchSearch = String(f.numero || "").toLocaleLowerCase("fr").includes(q)
      || nomAffiche.toLocaleLowerCase("fr").includes(q)
      || String(f.designation || "").toLocaleLowerCase("fr").includes(q);

    const [factureAnnee, factureMois] = String(f.date || "").split("-").map(Number);
    const matchAnnee = !filterFactureAnnee || factureAnnee === Number(filterFactureAnnee);
    const matchMois = !filterFactureMois || factureMois === Number(filterFactureMois);
    const factureClientKey = f.clientId
      ? `${f.client_type === "physique" ? "physique" : "societe"}:${f.clientId}`
      : `physique-legacy:${f.client_nom_manuel}`;
    const matchClient = !filterFactureClient || factureClientKey === filterFactureClient;
    const matchStatut = !filterFactureStatut
      || (filterFactureStatut === "pending" ? !f.paid : !!f.paid);

    return matchSearch && matchAnnee && matchMois && matchClient && matchStatut;
  });

  const visibleAnomalies = (anomalyData?.anomalies || []).filter(item =>
    anomalyFilter === "all" || item.severity === anomalyFilter);

  const totalTTC = filteredFactures.reduce((total, f) =>
    total + Number(f.pt_ttc || 0) + Number(f.ajustement_arrondi || 0), 0);
  const totalHT = filteredFactures.reduce((total, f) => total + Number(f.montant_ht || 0), 0);
  const pending = filteredFactures.filter(f => !f.paid).length;
  const filteredFactureIds = filteredFactures.map(f => f.id);
  const visibleSelectedFactureIds = filteredFactureIds.filter(id => selectedFactureIds.has(id));
  const allFilteredFacturesSelected = filteredFactureIds.length > 0
    && filteredFactureIds.every(id => selectedFactureIds.has(id));

  const anneesDisponibles = [...new Set(factures
    .map(f => Number(String(f.date || "").slice(0, 4)))
    .filter(Number.isInteger))].sort((a,b)=>b-a);

  const toggleSelectFacture = (id) => {
    setSelectedFactureIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllFactures = () => {
    setSelectedFactureIds(prev =>
      filteredFactureIds.length > 0 && filteredFactureIds.every(id => prev.has(id))
        ? new Set()
        : new Set(filteredFactureIds)
    );
  };

  useEffect(() => {
    setSelectedFactureIds(prev => {
      const visible = new Set(filteredFactureIds);
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [factures, clients, filterFactureQ, filterFactureAnnee, filterFactureMois, filterFactureClient, filterFactureStatut]);

  const exportGroup = async (format, scope = "selected") => {
    const ids = scope === "filtered" ? filteredFactureIds : visibleSelectedFactureIds;
    if (ids.length === 0) {
      showToast(scope === "filtered" ? "Aucune facture ne correspond aux filtres" : "Selectionnez au moins une facture visible", true);
      return;
    }
    setGroupExportLoading(true);
    try {
      const resp = await authFetch(API + "/factures/export-group", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ ids, format })
      });
      if (!resp.ok) { const e = await resp.json().catch(()=>({error:resp.statusText})); throw new Error(e.error); }
      const blob = await resp.blob();
      downloadBlob(blob, `${scope === "filtered" ? "factures_filtrees" : "factures_selectionnees"}.${format}`);
      showToast(`${ids.length} facture(s) filtree(s) exportee(s)`);
    } catch(e) { showToast(`Erreur: ${e.message}`, true); }
    finally { setGroupExportLoading(false); }
  };

  const deleteSelected = async () => {
    const ids = visibleSelectedFactureIds;
    if (ids.length === 0) { showToast("Selectionnez au moins une facture visible", true); return; }
    if (!window.confirm(`Supprimer ${ids.length} facture(s) ? Cette action est irreversible.`)) return;
    setGroupDeleteLoading(true);
    try {
      const r = await authFetch(API + "/factures", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error); }
      const deletedIds = new Set(ids);
      setFactures(prev => prev.filter(f => !deletedIds.has(f.id)));
      setSelectedFactureIds(new Set());
      showToast("Factures supprimees avec succes");
    } catch(e) {
      showToast(`Erreur: ${e.message}`, true);
    } finally {
      setGroupDeleteLoading(false);
    }
  };

  // ── Container helpers ──
  const buildContainerQuery = (overrides = {}) => {
    const params = new URLSearchParams();
    const q = overrides.search ?? search;
    const statut = overrides.statut ?? filterStatut;
    const fournisseur = overrides.fournisseur ?? filterFournisseur;
    const portDepart = overrides.portDepart ?? filterPortDepart;
    const portArrivee = overrides.portArrivee ?? filterPortArrivee;
    if (q) params.append("q", q);
    if (statut) params.append("statut", statut);
    if (fournisseur) params.append("fournisseur", fournisseur);
    if (portDepart) params.append("port_depart", portDepart);
    if (portArrivee) params.append("port_arrivee", portArrivee);
    return params.toString();
  };

  const loadContainers = async (overrides = {}) => {
    const qs = buildContainerQuery(overrides);
    try {
      const data = await apiJson(API+"/containers"+(qs?"?"+qs:""));
      setContainers(data);
    } catch(e) {
      showToast("Erreur chargement conteneurs", true);
    }
  };

  useEffect(() => {
    if (page !== "conteneurs") return;
    const handle = setTimeout(() => { loadContainers(); }, 300);
    return () => clearTimeout(handle);
  }, [page, search, filterStatut, filterFournisseur, filterPortDepart, filterPortArrivee]);

  // ── Charges helpers ──
  const loadCharges = async () => {
    const params = new URLSearchParams();
    if (filterChargeAnnee) params.append("annee", filterChargeAnnee);
    if (filterChargeCategorie) params.append("categorie", filterChargeCategorie);
    if (filterChargeQ) params.append("q", filterChargeQ);
    try {
      const data = await apiJson(API+"/charges"+(params.toString()?"?"+params.toString():""));
      setCharges(data);
    } catch(e) {
      showToast("Erreur chargement charges", true);
    }
  };

  useEffect(() => {
    if (page !== "charges") return;
    const handle = setTimeout(() => { loadCharges(); }, 300);
    return () => clearTimeout(handle);
  }, [page, filterChargeAnnee, filterChargeCategorie, filterChargeQ]);

  // ── Facture CRUD ──
  const openNew = () => {
    setEditTarget(null);
    setForm({
      lieu:"CASABLANCA", 
      designation:"CAFE VERT OUGANDA GRADE 15",
      date:new Date().toISOString().slice(0,10),
      paid:false,
      client_type:"societe", clientId:"",
      client_nom_manuel:"", client_cin_manuel:"", client_adresse_manuel:"",
      calc_type:"qte", qte_kg:"", pu_ttc:"", total_ttc_saisi:"",
      mode_paiement:""
    });
    setCalcPreview(null);
    setShowModal(true);
  };

  const openEdit = f => {
    setEditTarget(f.id);
    setForm({
      ...f,
      paid: !!f.paid,
      client_type: f.client_type || "societe",
      calc_type: f.calc_type || "qte",
      clientId: f.clientId || "",
      client_nom_manuel: f.client_nom_manuel || "",
      client_cin_manuel: f.client_cin_manuel || "",
      client_adresse_manuel: f.client_adresse_manuel || "",
      total_ttc_saisi: f.total_ttc_saisi || "",
      mode_paiement: f.mode_paiement || ""
    });
    setCalcPreview(calcTotals(f.calc_type || "qte", f));
    setShowModal(true);
  };

  const handleFormChange = (k,v) => {
    const next={...form,[k]:v}; setForm(next);
    const calcType = next.calc_type || "qte";
    if (["qte_kg","pu_ttc","total_ttc_saisi","calc_type"].includes(k)) {
      setCalcPreview(calcTotals(calcType, next));
    }
  };

  const handleSave = async () => {
    if (!form.numero || !String(form.numero).trim()) { showToast("Le numero de facture est obligatoire", true); return; }

    const clientType = form.client_type || "societe";
    if (!form.clientId) { showToast(clientType === "physique" ? "La personne physique est obligatoire" : "Le client est obligatoire", true); return; }

    const calcType = form.calc_type || "qte";
    if (calcType === "qte" && (!form.qte_kg || !form.pu_ttc)) { showToast("Quantite (kg) et PU TTC sont obligatoires", true); return; }
    if (calcType === "total" && (!form.total_ttc_saisi || !form.pu_ttc)) { showToast("Total TTC et PU TTC sont obligatoires", true); return; }

    const body = {
      numero: form.numero,
      lieu: form.lieu,
      date: form.date,
      designation: form.designation,
      paid: !!form.paid,
      client_type: clientType,
      clientId: parseInt(form.clientId),
      calc_type: calcType,
      qte_kg: calcType === "qte" ? form.qte_kg : null,
      pu_ttc: form.pu_ttc,
      total_ttc_saisi: calcType === "total" ? form.total_ttc_saisi : null,
      mode_paiement: form.mode_paiement
    };

    try {
      if(editTarget) {
        const r=await authFetch(API+"/factures/"+editTarget,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated=await r.json();
        setFactures(prev=>prev.map(f=>f.id===editTarget?updated:f));
      } else {
        const r=await authFetch(API+"/factures",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created=await r.json();
        setFactures(prev=>[created,...prev]);
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    try {
      await apiJson(API+"/factures/"+id,{method:"DELETE"});
      setFactures(prev=>prev.filter(f=>f.id!==id)); setExpandedId(null);
      showToast("Facture supprimee");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  const togglePaid = async f => {
    const updated={...f,paid:f.paid?0:1};
    try {
      const saved = await apiJson(API+"/factures/"+f.id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(updated)});
      setFactures(prev=>prev.map(x=>x.id===f.id?saved:x));
    } catch (e) { showToast(e.message || "Erreur mise a jour", true); }
  };

  const doExport = async (f, format) => {
    const key=`${f.id}-${format}`; setBtnLoading(l=>({...l,[key]:true}));
    try { await exportInvoice(f,clients.find(c=>c.id===f.clientId),format); showToast(`Facture ${f.numero} exportee`); }
    catch(e){ showToast(`Erreur: ${e.message}`,true); }
    finally { setBtnLoading(l=>({...l,[key]:false})); }
  };

  // ── Container CRUD ──
  const openNewContainer = () => {
    setEditTarget(null);
    setForm({numero:"",type:"40ft",scelle:"",statut:"En transit",fournisseur:"",port_depart:"",port_arrivee:"",date_depart:"",date_arrivee:"",nb_sacs:"",poids_total:"",poids_commande:"",poids_recu:"",bl:"",facture_commerciale:""});
    setShowModal("container");
  };

  const openEditContainer = (ct) => { setEditTarget(ct.id); setForm({...ct}); setShowModal("container"); };

  const saveContainer = async () => {
    if (!form.numero) { showToast("Le numero de conteneur est obligatoire", true); return; }
    const body = {...form};
    try {
      if (editTarget) {
        const r = await authFetch(API+"/containers/"+editTarget, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated = await r.json();
        setContainers(prev => prev.map(c => c.id === editTarget ? updated : c));
        showToast("Conteneur modifie");
      } else {
        const r = await authFetch(API+"/containers", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created = await r.json();
        setContainers(prev => [created, ...prev]);
        showToast("Conteneur cree");
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const deleteContainer = async (id) => {
    if (!window.confirm("Supprimer ce conteneur ?")) return;
    try {
      await apiJson(API+"/containers/"+id, {method:"DELETE"});
      setContainers(prev => prev.filter(c => c.id !== id));
      setExpandedId(null);
      showToast("Conteneur supprime");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  const handleContainerChange = (k, v) => { setForm(f => ({...f, [k]: v})); };

  // ── Document upload handlers ──
  const handleFileSelect = async (containerId, files) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('documents', file));
    setUploadingFiles(prev => ({...prev, [containerId]: { progress: 0, count: files.length, current: 0 }}));
    try {
      const r = await authFetch(API+"/containers/"+containerId+"/documents", {method: "POST", body: formData});
      if (!r.ok) { const err = await r.json().catch(() => ({error: "Erreur upload"})); throw new Error(err.error); }
      const result = await r.json();
      setContainers(prev => prev.map(c => c.id === containerId ? {...c, documents: [...(c.documents||[]), ...result.documents]} : c));
      showToast(`${files.length} document${files.length > 1 ? 's' : ''} televerse${files.length > 1 ? 's' : ''}`);
    } catch (e) { showToast(`Erreur upload: ${e.message}`, true); }
    finally { setUploadingFiles(prev => { const next={...prev}; delete next[containerId]; return next; }); }
  };

  const handleDrop = (e, containerId) => { e.preventDefault(); e.stopPropagation(); setDragOverId(null); handleFileSelect(containerId, e.dataTransfer.files); };
  const handleDragOver = (e, containerId) => { e.preventDefault(); e.stopPropagation(); setDragOverId(containerId); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(null); };

  const deleteDocument = async (containerId, docId) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    try {
      await apiJson(API+"/containers/"+containerId+"/documents/"+docId, {method: "DELETE"});
      setContainers(prev => prev.map(c => c.id === containerId ? {...c, documents: (c.documents||[]).filter(d => d.id !== docId)} : c));
      showToast("Document supprime");
    } catch (e) { showToast("Erreur suppression", true); }
  };

  const downloadDocument = async (containerId, docId, originalName) => {
    try {
      const response = await authFetch(API+"/containers/"+containerId+"/documents/"+docId+"/download");
      if (!response.ok) { const data = await response.json().catch(()=>null); throw new Error(data?.error || `Erreur HTTP ${response.status}`); }
      downloadBlob(await response.blob(), originalName);
    } catch (e) { showToast(e.message || "Erreur telechargement", true); }
  };

  const viewDocument = async (containerId, docId) => {
    const preview = window.open("", "_blank");
    try {
      const response = await authFetch(API+"/containers/"+containerId+"/documents/"+docId+"/view");
      if (!response.ok) { const data = await response.json().catch(()=>null); throw new Error(data?.error || `Erreur HTTP ${response.status}`); }
      const objectUrl = URL.createObjectURL(await response.blob());
      if (preview) preview.location.href = objectUrl;
      else window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (e) {
      if (preview) preview.close();
      showToast(e.message || "Erreur apercu", true);
    }
  };

  // ── Charges CRUD ──
  const openNewCharge = () => {
    setEditTarget(null);
    setForm({date:new Date().toISOString().slice(0,10),categorie:"Fournitures",libelle:"",montant_ht:"",tva:"",montant_ttc:"",fournisseur:"",mode_paiement:"Virement",reference:"",deductible:true,notes:""});
    setShowModal("charge");
  };

  const openEditCharge = (ch) => { setEditTarget(ch.id); setForm({...ch,deductible:!!ch.deductible}); setShowModal("charge"); };

  const saveCharge = async () => {
    if (!form.libelle || !form.montant_ht) { showToast("Libelle et montant HT obligatoires", true); return; }
    const ht = parseFloat(form.montant_ht);
    const tva = parseFloat(form.tva || 0);
    const ttc = parseFloat(form.montant_ttc) || (ht + tva);
    const body = {...form, montant_ht: ht, tva, montant_ttc: ttc};
    try {
      if (editTarget) {
        const r = await authFetch(API+"/charges/"+editTarget, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated = await r.json();
        setCharges(prev => prev.map(c => c.id === editTarget ? updated : c));
        showToast("Charge modifiee");
      } else {
        const r = await authFetch(API+"/charges", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created = await r.json();
        setCharges(prev => [created, ...prev]);
        showToast("Charge creee");
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const deleteCharge = async (id) => {
    if (!window.confirm("Supprimer cette charge ?")) return;
    try {
      await apiJson(API+"/charges/"+id, {method:"DELETE"});
      setCharges(prev => prev.filter(c => c.id !== id));
      showToast("Charge supprimee");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  const handleChargeChange = (k, v) => {
    const next = {...form, [k]: v};
    if (k === "montant_ht" || k === "tva") {
      const ht = parseFloat(next.montant_ht) || 0;
      const tva = parseFloat(next.tva) || 0;
      next.montant_ttc = ht + tva;
    }
    setForm(next);
  };

  // ── Ordres de virement TVA CRUD ──
  const openNewOV = () => {
    setEditTarget(null);
    setForm({ date: new Date().toISOString().slice(0,10), montant: "", reference: "", notes: "" });
    setShowModal("ov");
  };

  const openEditOV = (o) => { setEditTarget(o.id); setForm({...o}); setShowModal("ov"); };

  const saveOV = async () => {
    if (!form.date) { showToast("La date est obligatoire", true); return; }
    if (!form.montant || parseFloat(form.montant) <= 0) { showToast("Le montant est obligatoire", true); return; }
    const body = { date: form.date, montant: parseFloat(form.montant), reference: form.reference || null, notes: form.notes || null };
    try {
      if (editTarget) {
        const r = await authFetch(API+"/ordres-virement-tva/"+editTarget, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated = await r.json();
        setOrdresVirement(prev => prev.map(o => o.id === editTarget ? updated : o));
        showToast("Ordre de virement modifie");
      } else {
        const r = await authFetch(API+"/ordres-virement-tva", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created = await r.json();
        setOrdresVirement(prev => [created, ...prev]);
        showToast("Ordre de virement cree");
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const deleteOV = async (id) => {
    if (!window.confirm("Supprimer cet ordre de virement ?")) return;
    try {
      await apiJson(API+"/ordres-virement-tva/"+id, {method:"DELETE"});
      setOrdresVirement(prev => prev.filter(o => o.id !== id));
      showToast("Ordre de virement supprime");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  const exportOV = async (o, format) => {
    const key = `${o.id}-${format}`;
    setOvExportLoading(l => ({...l, [key]: true}));
    try {
      const resp = await authFetch(API+"/ordres-virement-tva/"+o.id+"/export?format="+format);
      if (!resp.ok) { const e = await resp.json().catch(()=>({error:resp.statusText})); throw new Error(e.error); }
      const blob = await resp.blob();
      downloadBlob(blob, `ordre_virement_tva_${o.id}.${format}`);
      showToast("Ordre de virement exporte");
    } catch(e) {
      showToast(`Erreur: ${e.message}`, true);
    } finally {
      setOvExportLoading(l => ({...l, [key]: false}));
    }
  };

  // ── Ordres de virement ZIZI CRUD ──
  const openNewOVZizi = () => {
    setEditTarget(null);
    setForm({ date: new Date().toISOString().slice(0,10), nom: "", rib: "", banque: "", montant: "", reference: "", notes: "" });
    setShowModal("ov_zizi");
  };

  const openEditOVZizi = (o) => { 
    setEditTarget(o.id); 
    setForm({...o, banque: o.banque || ""}); 
    setShowModal("ov_zizi"); 
  };

  const saveOVZizi = async () => {
    if (!form.date) { showToast("La date est obligatoire", true); return; }
    if (!form.nom?.trim()) { showToast("Le nom du beneficiaire est obligatoire", true); return; }
    if (!form.rib?.trim()) { showToast("Le RIB / IBAN du beneficiaire est obligatoire", true); return; }
    if (!form.banque?.trim()) { showToast("La banque est obligatoire", true); return; }
    if (!form.montant || parseFloat(form.montant) <= 0) { showToast("Le montant est obligatoire", true); return; }
    const body = { date: form.date, nom: form.nom.trim(), rib: form.rib.trim(), banque: form.banque.trim(), montant: parseFloat(form.montant), reference: form.reference || null, notes: form.notes || null };
    try {
      if (editTarget) {
        const r = await authFetch(API+"/ordres-virement-zizi/"+editTarget, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated = await r.json();
        setOrdresVirementZizi(prev => prev.map(o => o.id === editTarget ? updated : o));
        showToast("Ordre de virement modifie");
      } else {
        const r = await authFetch(API+"/ordres-virement-zizi", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created = await r.json();
        setOrdresVirementZizi(prev => [created, ...prev]);
        showToast("Ordre de virement cree");
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const deleteOVZizi = async (id) => {
    if (!window.confirm("Supprimer cet ordre de virement ?")) return;
    try {
      await apiJson(API+"/ordres-virement-zizi/"+id, {method:"DELETE"});
      setOrdresVirementZizi(prev => prev.filter(o => o.id !== id));
      showToast("Ordre de virement supprime");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  const exportOVZizi = async (o, format) => {
    const key = `${o.id}-${format}`;
    setOvZiziExportLoading(l => ({...l, [key]: true}));
    try {
      const resp = await authFetch(API+"/ordres-virement-zizi/"+o.id+"/export?format="+format);
      if (!resp.ok) { const e = await resp.json().catch(()=>({error:resp.statusText})); throw new Error(e.error); }
      const blob = await resp.blob();
      downloadBlob(blob, `ordre_virement_${o.id}.${format}`);
      showToast("Ordre de virement exporte");
    } catch(e) {
      showToast(`Erreur: ${e.message}`, true);
    } finally {
      setOvZiziExportLoading(l => ({...l, [key]: false}));
    }
  };

  // ── Comptabilite actions ──
  const cloturerExercice = async (annee) => {
    if (!window.confirm(`Cloturer l'exercice ${annee} ? Cette action est irreversible.`)) return;
    try {
      const r = await authFetch(API+"/comptabilite/exercices/"+annee+"/cloturer", {method: "POST"});
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Erreur cloture");
      showToast(result.message);
      loadComptaData();
      const ex = await apiJson(API+"/comptabilite/exercices");
      setExercices(ex);
    } catch(e) { showToast("Erreur cloture", true); }
  };

  // ── Client CRUD ──
  const saveClient = async () => {
    if(!form.name) { showToast("Le nom du client est obligatoire", true); return; }
    try {
      if(editTarget) {
        const r=await authFetch(API+"/clients/"+editTarget,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const updated=await r.json(); setClients(prev=>prev.map(c=>c.id===editTarget?updated:c));
      } else {
        const r=await authFetch(API+"/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
        if(!r.ok){ const e=await r.json().catch(()=>({error:"Erreur"})); throw new Error(e.error); }
        const created=await r.json(); setClients(prev=>[...prev,created]);
      }
      setShowModal(false);
    } catch(e) {
      showToast(e.message || "Erreur enregistrement", true);
    }
  };

  const deleteClient = async id => {
    if (!window.confirm("Supprimer ce client ?")) return;
    try {
      await apiJson(API+"/clients/"+id,{method:"DELETE"});
      setClients(prev=>prev.filter(c=>c.id!==id));
      showToast("Client supprime");
    } catch (e) { showToast(e.message || "Erreur suppression", true); }
  };

  if(loading) return <><style>{STYLE}</style><div className="loading">Chargement...</div></>;


  return (
    <>
      <style>{STYLE}</style>
      {toast && <div className={`toast ${toast.error?"error":""}`}>{toast.msg}</div>}
      <div className="shell">
        <aside className="sidebar">
          <div className="brand"><span className="brand-mark">TV</span><span className="brand-copy"><strong>Tradivia</strong><small>Operations</small></span></div>
          {[{id:"factures",label:"Factures",icon:FileText},{id:"clients",label:"Clients",icon:Building2},{id:"conteneurs",label:"Conteneurs",icon:Ship},{id:"charges",label:"Charges",icon:WalletCards},{id:"virement_tva",label:"Ordre virement TVA",icon:Landmark},{id:"virement_zizi",label:"Ordre de virement",icon:ClipboardList},{id:"comptabilite",label:"Comptabilite",icon:BarChart3},{id:"anomalies",label:"Anomalies",icon:AlertTriangle,count:anomalyData?.summary?.total||0},{id:"assistant",label:"Assistant IA",icon:Robot},{id:"societe",label:"Societe",icon:Settings}].map(n=>(
            <button key={n.id} className={`nav-item nav-${n.id} ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
              <n.icon size={17} strokeWidth={1.8} aria-hidden="true" /><span className="nav-label">{n.label}</span>{n.count>0&&<span className="nav-count">{n.count>99?"99+":n.count}</span>}
            </button>
          ))}
          <div className="sidebar-footer">
            <div className="sidebar-user">Connecte: <b>{user?.username}</b> ({user?.role})</div>
            <button className="nav-item" onClick={onLogout}><LogOut size={17} strokeWidth={1.8} aria-hidden="true" /> Deconnexion</button>
          </div>
        </aside>
        <main className={`main page-${page}`}>

          {page==="assistant"&&<AgentWorkspace user={user} onDataChanged={reloadData} onClose={()=>setPage("factures")} />}

          {/* ── Factures ── */}
          {page==="factures"&&<>
            <div className="page-header">
              <div><div className="page-title">Factures</div><div className="page-sub">{company?.name || COMPANY.name}</div></div>
              <button className="btn btn-primary" onClick={openNew}>+ Nouvelle facture</button>
            </div>
            <div className="stats-3">
              <div className="stat-card"><div className="stat-label">Total TTC</div><div className="stat-value accent">{fmt(totalTTC)} DH</div></div>
              <div className="stat-card"><div className="stat-label">Total HT</div><div className="stat-value">{fmt(totalHT)} DH</div></div>
              <div className="stat-card"><div className="stat-label">En attente</div><div className="stat-value">{pending}</div></div>
            </div>

            <div className="search-bar">
              <div className="search-input-wrap">
                <span className="search-icon"><Search size={15} strokeWidth={1.9} /></span>
                <input placeholder="Numero, client, designation..." value={filterFactureQ} onChange={e=>setFilterFactureQ(e.target.value)}/>
              </div>
              <div className="filter-group">
                <select value={filterFactureAnnee} onChange={e=>setFilterFactureAnnee(e.target.value)}>
                  <option value="">Toutes annees</option>
                  {anneesDisponibles.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <select value={filterFactureMois} onChange={e=>setFilterFactureMois(e.target.value)}>
                  <option value="">Tous les mois</option>
                  {["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"].map((m,i)=>(
                    <option key={i} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select value={filterFactureClient} onChange={e=>setFilterFactureClient(e.target.value)}>
                  <option value="">Tous les clients</option>
                  {clients.map(c=><option key={c.id} value={`${c.client_type==="physique"?"physique":"societe"}:${c.id}`}>{c.name}{c.client_type==="physique"?" (personne physique)":""}</option>)}
                  {[...new Set(factures.filter(f=>f.client_type==="physique"&&!f.clientId).map(f=>f.client_nom_manuel).filter(Boolean))].map(n=>(
                    <option key={n} value={`physique-legacy:${n}`}>{n} (ancienne fiche)</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select value={filterFactureStatut} onChange={e=>setFilterFactureStatut(e.target.value)}>
                  <option value="">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="paid">Reglee</option>
                </select>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setFilterFactureQ("");setFilterFactureAnnee("");setFilterFactureMois("");setFilterFactureClient("");setFilterFactureStatut("");}}>Reinitialiser</button>
            </div>

            {filteredFactures.length > 0 && (
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,padding:"12px 16px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:600}}>Exporter les {filteredFactures.length} resultat(s) affiche(s)</span>
                <button className="btn btn-sm btn-primary" disabled={groupExportLoading} onClick={()=>exportGroup("pdf","filtered")}>{groupExportLoading?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} PDF filtres</button>
                <button className="btn btn-sm btn-ghost" disabled={groupExportLoading} onClick={()=>exportGroup("docx","filtered")}>{groupExportLoading?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} Word filtres</button>
              </div>
            )}

            {visibleSelectedFactureIds.length > 0 && (
              <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,padding:"12px 16px",background:"var(--accent-light)",borderRadius:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:600}}>{visibleSelectedFactureIds.length} facture(s) visible(s) selectionnee(s)</span>
                <button className="btn btn-sm btn-primary" disabled={groupExportLoading} onClick={()=>exportGroup("pdf","selected")}>{groupExportLoading?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} PDF selection</button>
                <button className="btn btn-sm btn-ghost" disabled={groupExportLoading} onClick={()=>exportGroup("docx","selected")}>{groupExportLoading?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} Word selection</button>
                <button className="btn btn-sm btn-danger" disabled={groupDeleteLoading} onClick={deleteSelected}>{groupDeleteLoading?<Loader2 size={14} className="icon-spin"/>:<Trash2 size={14}/>} Supprimer selection</button>
                <button className="btn btn-sm btn-ghost" onClick={()=>setSelectedFactureIds(new Set())}>Deselectionner</button>
              </div>
            )}

            <div className="card">
              <div className="card-header"><span className="card-title">{filteredFactures.length} facture{filteredFactures.length!==1?"s":""}</span></div>
              <div className="table-scroll"><table>
                <thead><tr>
                  <th style={{width:36}}><input type="checkbox" checked={allFilteredFacturesSelected} onChange={toggleSelectAllFactures}/></th>
                  <th>Numero</th><th>Client</th><th>Type</th><th>Date</th><th>Designation</th><th>Qte</th><th>PT TTC</th><th>Statut</th>
                </tr></thead>
                <tbody>
                  {filteredFactures.length===0&&<tr><td colSpan={9}><div className="empty"><div className="empty-icon"><Inbox size={22}/></div>Aucune facture</div></td></tr>}
                  {filteredFactures.map(f=>{
                    const cl=clients.find(c=>c.id===f.clientId);
                    const isPhysique = f.client_type === "physique";
                    const nomAffiche = isPhysique ? (f.client_nom_manuel || cl?.name || "—") : (cl?.name||"—");
                    const isOpen=expandedId===f.id;
                    return(<>
                      <tr key={f.id} onClick={()=>setExpandedId(isOpen?null:f.id)}>
                        <td onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={selectedFactureIds.has(f.id)} onChange={()=>toggleSelectFacture(f.id)}/>
                        </td>
                        <td className="mono">{f.numero}</td><td>{nomAffiche}</td>
                        <td><span className={`badge ${isPhysique?"badge-physique":"badge-societe"}`}>{isPhysique?"Physique":"Societe"}</span></td>
                        <td>{fmtDate(f.date)}</td>
                        <td>{f.designation}</td><td className="mono">{f.qte_kg} kg</td>
                        <td className="mono"><b>{fmt(f.pt_ttc)}</b> DH</td>
                        <td><span className={`badge ${f.paid?"badge-paid":"badge-pending"}`}>{f.paid?"Reglee":"En attente"}</span></td>
                      </tr>
                      {isOpen&&<tr className="expanded-row" key={`${f.id}-exp`}><td colSpan={9}>
                        <div className="invoice-stamp">
                          <div className="stamp-section">
                            <h4>Client</h4>
                            {isPhysique ? (<>
                              <p><b>{f.client_nom_manuel || cl?.name || "—"}</b></p>
                              <p className="mono" style={{fontSize:12,color:"var(--muted)"}}>CIN: {f.client_cin_manuel || cl?.cin || "—"}</p>
                              <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>{f.client_adresse_manuel || cl?.address}</p>
                              <span className="badge badge-physique" style={{marginTop:8,display:"inline-block"}}>Personne physique</span>
                            </>) : (<>
                              <p><b>{cl?.name||"—"}</b></p>
                              {cl?.ice&&<p className="mono" style={{fontSize:12,color:"var(--muted)"}}>ICE: {cl.ice}</p>}
                              <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>{cl?.address}</p>
                            </>)}
                          </div>
                          <div className="stamp-section">
                            <h4>Details</h4>
                            <p>{f.designation}</p>
                            <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>{f.qte_kg} kg x {fmt(f.pu_ttc)} DH/kg</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>HT: {fmt(f.montant_ht)} | TVA: {fmt(f.tva)} DH</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>{f.lieu}, {fmtDate(f.date)}</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>Paiement: {f.mode_paiement||"—"}</p>
                            {f.calc_type==="total"&&<p style={{fontSize:13,color:"var(--warning)"}}>Ajustement d'arrondi: {fmt(f.ajustement_arrondi||0)} DH</p>}
                          </div>
                          <div className="stamp-section stamp-amount">
                            <div className="label">Total TTC</div>
                            <div className="big">{fmt((f.pt_ttc||0)+(f.ajustement_arrondi||0))}</div>
                            <div className="label">dirhams</div>
                            <div className="stamp-actions">
                              <button className="btn btn-sm btn-primary" disabled={btnLoading[`${f.id}-pdf`]} onClick={e=>{e.stopPropagation();doExport(f,"pdf");}}>
                                {btnLoading[`${f.id}-pdf`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} PDF</button>
                              <button className="btn btn-sm btn-ghost" disabled={btnLoading[`${f.id}-docx`]} onClick={e=>{e.stopPropagation();doExport(f,"docx");}}>
                                {btnLoading[`${f.id}-docx`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} Word</button>
                              <button className="btn btn-sm btn-ghost" onClick={e=>{e.stopPropagation();togglePaid(f);}}>{f.paid?"Impayee":"Reglee"}</button>
                              <button className="btn btn-sm btn-ghost" onClick={e=>{e.stopPropagation();openEdit(f);}}>Editer</button>
                              <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();handleDelete(f.id);}}>Suppr.</button>
                            </div>
                          </div>
                        </div>
                      </td></tr>}
                    </>);
                  })}
                </tbody>
              </table></div>
            </div>
          </>}

          {/* ── Clients ── */}
          {page==="clients"&&<>
            <div className="page-header">
              <div><div className="page-title">Clients</div><div className="page-sub">{clients.length} fiche{clients.length!==1?"s":""} — societes et personnes physiques</div></div>
              <button className="btn btn-primary" onClick={()=>{setEditTarget(null);setForm({client_type:"societe"});setShowModal("client");}}>+ Nouvelle fiche</button>
            </div>
            <div className="client-grid">
              {clients.map(cl=>(
                <div className="client-card" key={cl.id}>
                  <div className="client-name">{cl.name}</div>
                  <span className={`badge ${cl.client_type==="physique"?"badge-physique":"badge-societe"}`} style={{marginTop:8,display:"inline-block"}}>{cl.client_type==="physique"?"Personne physique":"Societe"}</span>
                  {cl.client_type==="physique" ? (cl.cin&&<div className="client-ice">CIN: {cl.cin}</div>) : (cl.ice&&<div className="client-ice">ICE: {cl.ice}</div>)}
                  {cl.address&&<div className="client-detail"><MapPin size={14}/>{cl.address}</div>}
                  {cl.phone&&<div className="client-detail"><Phone size={14}/>{cl.phone}</div>}
                  {cl.email&&<div className="client-detail"><Mail size={14}/>{cl.email}</div>}
                  <div style={{marginTop:12,display:"flex",gap:8}}>
                    <button className="btn btn-sm btn-ghost" onClick={()=>{setEditTarget(cl.id);setForm({...cl});setShowModal("client");}}>Modifier</button>
                    <button className="btn btn-sm btn-danger" onClick={()=>deleteClient(cl.id)}>Suppr.</button>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* ── Conteneurs ── */}
          {page==="conteneurs"&&<>
            <div className="page-header">
              <div><div className="page-title">Conteneurs</div><div className="page-sub">Gestion logistique import/export</div></div>
              <button className="btn btn-primary" onClick={openNewContainer}>+ Nouveau conteneur</button>
            </div>
            <div className="stats-3">
              <div className="stat-card"><div className="stat-label">Total Conteneurs</div><div className="stat-value accent">{containers.length}</div></div>
              <div className="stat-card"><div className="stat-label">En transit</div><div className="stat-value">{containers.filter(c=>c.statut==="En transit").length}</div></div>
              <div className="stat-card"><div className="stat-label">Poids total</div><div className="stat-value">{fmt(containers.reduce((a,c)=>a+(parseFloat(c.poids_total)||0),0))} kg</div></div>
            </div>
            <div className="search-bar">
              <div className="search-input-wrap">
                <span className="search-icon"><Search size={15} strokeWidth={1.9}/></span>
                <input placeholder="Rechercher conteneur, scelle, B/L..." value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <div className="filter-group">
                <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
                  <option value="">Tous statuts</option>
                  {STATUTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <input placeholder="Fournisseur" value={filterFournisseur} onChange={e=>setFilterFournisseur(e.target.value)} style={{width:140}}/>
              </div>
              <div className="filter-group">
                <input placeholder="Port depart" value={filterPortDepart} onChange={e=>setFilterPortDepart(e.target.value)} style={{width:120}}/>
              </div>
              <div className="filter-group">
                <input placeholder="Port arrivee" value={filterPortArrivee} onChange={e=>setFilterPortArrivee(e.target.value)} style={{width:120}}/>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setSearch("");setFilterStatut("");setFilterFournisseur("");setFilterPortDepart("");setFilterPortArrivee("");}}>Reinitialiser</button>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">{containers.length} conteneur{containers.length!==1?"s":""}</span></div>
              <div className="table-scroll"><table>
                <thead><tr><th>N Conteneur</th><th>Type</th><th>Fournisseur</th><th>Port depart</th><th>Port arrivee</th><th>Date depart</th><th>Nb sacs</th><th>Poids</th><th>Statut</th></tr></thead>
                <tbody>
                  {containers.length===0&&<tr><td colSpan={9}><div className="empty"><div className="empty-icon"><Ship size={22}/></div>Aucun conteneur</div></td></tr>}
                  {containers.map(ct=>{
                    const isOpen=expandedId===ct.id;
                    const docs = ct.documents || [];
                    return(<>
                      <tr key={ct.id} onClick={()=>setExpandedId(isOpen?null:ct.id)}>
                        <td className="mono"><b>{ct.numero}</b></td>
                        <td>{ct.type}</td>
                        <td>{ct.fournisseur||"—"}</td>
                        <td>{ct.port_depart||"—"}</td>
                        <td>{ct.port_arrivee||"—"}</td>
                        <td>{fmtDate(ct.date_depart)}</td>
                        <td className="mono">{fmtInt(ct.nb_sacs)}</td>
                        <td className="mono">{ct.poids_total ? fmt(ct.poids_total)+" kg" : "—"}</td>
                        <td><span className={`badge ${getBadgeClass(ct.statut)}`}>{ct.statut}</span></td>
                      </tr>
                      {isOpen&&<tr className="expanded-row" key={`${ct.id}-exp`}><td colSpan={9}>
                        <div className="container-stamp">
                          <div className="stamp-section">
                            <h4>Identification</h4>
                            <p><b className="mono">{ct.numero}</b></p>
                            <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Type: {ct.type}</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>Scelle: <span className="mono">{ct.scelle||"—"}</span></p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>B/L: <span className="mono">{ct.bl||"—"}</span></p>
                          </div>
                          <div className="stamp-section">
                            <h4>Itineraire</h4>
                            <p>{ct.port_depart||"—"} → {ct.port_arrivee||"—"}</p>
                            <p style={{fontSize:13,color:"var(--muted)",marginTop:4}}>Depart: {fmtDate(ct.date_depart)}</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>Arrivee: {fmtDate(ct.date_arrivee)}</p>
                            <p style={{fontSize:13,color:"var(--muted)"}}>Fournisseur: {ct.fournisseur||"—"}</p>
                          </div>
                          <div className="stamp-section stamp-amount">
                            <div className="label">Chargement</div>
                            <div className="big" style={{fontSize:28}}>{fmtInt(ct.nb_sacs)} <span style={{fontSize:14}}>sacs</span></div>
                            <div className="label">{ct.poids_total ? fmt(ct.poids_total)+" kg" : "—"}</div>
                            {(ct.poids_commande||ct.poids_recu)&&<div style={{fontSize:12,color:"var(--muted)",marginTop:8}}>
                              Commande: {ct.poids_commande?fmt(ct.poids_commande)+" kg":"—"}<br/>
                              Recu: {ct.poids_recu?fmt(ct.poids_recu)+" kg":"—"}
                            </div>}
                            <div className="stamp-actions">
                              <button className="btn btn-sm btn-ghost" onClick={e=>{e.stopPropagation();openEditContainer(ct);}}>Editer</button>
                              <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();deleteContainer(ct.id);}}>Suppr.</button>
                            </div>
                          </div>
                        </div>
                        <div style={{padding:"0 32px 24px 32px",background:"var(--subtle)"}}>
                          <div className="doc-section">
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                              <h3 className="section-title"><Paperclip size={17}/> Documents ({docs.length})</h3>
                              <button className="btn btn-sm btn-info" onClick={e=>{e.stopPropagation();fileInputRefs.current[ct.id]?.click();}}>+ Ajouter</button>
                            </div>
                            <input type="file" multiple ref={el => fileInputRefs.current[ct.id] = el} style={{display:"none"}} onChange={e=>{e.stopPropagation();handleFileSelect(ct.id, e.target.files); e.target.value="";}} />
                            <div className={`upload-zone ${dragOverId===ct.id?'dragover':''}`} onClick={e=>{e.stopPropagation();fileInputRefs.current[ct.id]?.click();}} onDrop={e=>handleDrop(e, ct.id)} onDragOver={e=>handleDragOver(e, ct.id)} onDragLeave={handleDragLeave}>
                              <div className="upload-zone-icon"><Upload size={25} strokeWidth={1.7}/></div>
                              <div className="upload-zone-text">{uploadingFiles[ct.id] ? "Televersement en cours..." : "Glissez-deposez des fichiers ici ou cliquez pour parcourir"}</div>
                              <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>PDF, Word, Excel, Images (max 50MB)</div>
                            </div>
                            {docs.length > 0 && (
                              <div className="doc-list">
                                {docs.map(doc => (
                                  <div key={doc.id} className="doc-item" onClick={e=>e.stopPropagation()}>
                                    <div className="doc-info">
                                      <span className="doc-icon"><FileKindIcon mimeType={doc.mime_type}/></span>
                                      <div style={{minWidth:0}}>
                                        <div className="doc-name">{doc.original_name}</div>
                                        <div className="doc-size">{fmtFileSize(doc.file_size)} • {fmtDate(doc.uploaded_at)}</div>
                                      </div>
                                    </div>
                                    <div className="doc-actions">
                                      <button className="btn btn-sm btn-ghost" onClick={()=>viewDocument(ct.id, doc.id)}><Eye size={13}/> Voir</button>
                                      <button className="btn btn-sm btn-primary" onClick={()=>downloadDocument(ct.id, doc.id, doc.original_name)}><Download size={13}/> Telecharger</button>
                                      <button className="btn btn-sm btn-danger" aria-label="Supprimer le document" onClick={()=>deleteDocument(ct.id, doc.id)}><Trash2 size={13}/></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td></tr>}
                    </>);
                  })}
                </tbody>
              </table></div>
            </div>
          </>}

          {/* ── Charges ── */}
          {page==="charges"&&<>
            <div className="page-header">
              <div><div className="page-title">Charges</div><div className="page-sub">Gestion des depenses et achats</div></div>
              <button className="btn btn-primary" onClick={openNewCharge}>+ Nouvelle charge</button>
            </div>
            <div className="search-bar">
              <div className="search-input-wrap">
                <span className="search-icon"><Search size={15} strokeWidth={1.9}/></span>
                <input placeholder="Rechercher charge..." value={filterChargeQ} onChange={e=>setFilterChargeQ(e.target.value)}/>
              </div>
              <div className="filter-group">
                <select value={filterChargeAnnee} onChange={e=>setFilterChargeAnnee(e.target.value)}>
                  <option value="">Toutes annees</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div className="filter-group">
                <select value={filterChargeCategorie} onChange={e=>setFilterChargeCategorie(e.target.value)}>
                  <option value="">Toutes categories</option>
                  {chargeCategories.map(cat=><option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>{setFilterChargeQ("");setFilterChargeAnnee("");setFilterChargeCategorie("");}}>Reinitialiser</button>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">{charges.length} charge{charges.length!==1?"s":""}</span></div>
              <div className="table-scroll"><table>
                <thead><tr><th>Date</th><th>Categorie</th><th>Libelle</th><th>Fournisseur</th><th>HT</th><th>TVA</th><th>TTC</th><th>Paiement</th><th>Reference</th><th>Actions</th></tr></thead>
                <tbody>
                  {charges.length===0&&<tr><td colSpan={10}><div className="empty"><div className="empty-icon"><Receipt size={22}/></div>Aucune charge</div></td></tr>}
                  {charges.map(ch=>(
                    <tr key={ch.id}>
                      <td>{fmtDate(ch.date)}</td>
                      <td><span className="badge badge-pending">{ch.categorie}</span></td>
                      <td>{ch.libelle}</td>
                      <td>{ch.fournisseur||"—"}</td>
                      <td className="mono">{fmt(ch.montant_ht)}</td>
                      <td className="mono">{fmt(ch.tva)}</td>
                      <td className="mono"><b>{fmt(ch.montant_ttc)}</b></td>
                      <td>{ch.mode_paiement}</td>
                      <td className="mono">{ch.reference||"—"}</td>
                      <td style={{display:"flex",gap:6}}>
                        <button className="btn btn-sm btn-ghost" onClick={()=>openEditCharge(ch)}>Editer</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>deleteCharge(ch.id)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </>}

          {/* ── Ordre de virement TVA ── */}
          {page==="virement_tva"&&<>
            <div className="page-header">
              <div><div className="page-title">Ordre de virement TVA</div><div className="page-sub">Genere le document a partir de template_ordre_virement_TVA.docx</div></div>
              <button className="btn btn-primary" onClick={openNewOV}>+ Nouvel ordre</button>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">{ordresVirement.length} ordre{ordresVirement.length!==1?"s":""}</span></div>
              <div className="table-scroll"><table>
                <thead><tr><th>Date</th><th>Montant</th><th>Reference</th><th>Actions</th></tr></thead>
                <tbody>
                  {ordresVirement.length===0&&<tr><td colSpan={4}><div className="empty"><div className="empty-icon"><Landmark size={22}/></div>Aucun ordre de virement</div></td></tr>}
                  {ordresVirement.map(o=>(
                    <tr key={o.id}>
                      <td>{fmtDate(o.date)}</td>
                      <td className="mono"><b>{fmt(o.montant)}</b> DH</td>
                      <td>{o.reference||"—"}</td>
                      <td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button className="btn btn-sm btn-primary" disabled={ovExportLoading[`${o.id}-pdf`]} onClick={()=>exportOV(o,"pdf")}>{ovExportLoading[`${o.id}-pdf`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} PDF</button>
                        <button className="btn btn-sm btn-ghost" disabled={ovExportLoading[`${o.id}-docx`]} onClick={()=>exportOV(o,"docx")}>{ovExportLoading[`${o.id}-docx`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} Word</button>
                        <button className="btn btn-sm btn-ghost" onClick={()=>openEditOV(o)}>Editer</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>deleteOV(o.id)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </>}

          {/* ── Ordre de virement bénéficiaire ── */}
          {page==="virement_zizi"&&<>
            <div className="page-header">
              <div><div className="page-title">Ordre de virement</div><div className="page-sub">Documents de virement aux beneficiaires</div></div>
              <button className="btn btn-primary" onClick={openNewOVZizi}>+ Nouvel ordre</button>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">{ordresVirementZizi.length} ordre{ordresVirementZizi.length!==1?"s":""}</span></div>
              <div className="table-scroll"><table>
                <thead><tr><th>Date</th><th>Beneficiaire</th><th>RIB / IBAN</th><th>Montant</th><th>Montant en lettres</th><th>Reference</th><th>Actions</th></tr></thead>
                <tbody>
                  {ordresVirementZizi.length===0&&<tr><td colSpan={7}><div className="empty"><div className="empty-icon"><ClipboardList size={22}/></div>Aucun ordre de virement</div></td></tr>}
                  {ordresVirementZizi.map(o=>{
                    const montantLettres = numToWords(Math.round(o.montant)) + " dirhams";
                    return(
                      <tr key={o.id}>
                        <td>{fmtDate(o.date)}</td>
                        <td><b>{o.nom||"—"}</b></td>
                        <td className="mono">{o.rib||"—"}</td>
                        <td className="mono"><b>{fmt(o.montant)}</b> DH</td>
                        <td style={{fontSize:12}}>{montantLettres}</td>
                        <td>{o.reference||"—"}</td>
                        <td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <button className="btn btn-sm btn-primary" disabled={ovZiziExportLoading[`${o.id}-pdf`]} onClick={()=>exportOVZizi(o,"pdf")}>
                            {ovZiziExportLoading[`${o.id}-pdf`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} PDF
                          </button>
                          <button className="btn btn-sm btn-ghost" disabled={ovZiziExportLoading[`${o.id}-docx`]} onClick={()=>exportOVZizi(o,"docx")}>
                            {ovZiziExportLoading[`${o.id}-docx`]?<Loader2 size={14} className="icon-spin"/>:<FileText size={14}/>} Word
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={()=>openEditOVZizi(o)}>Editer</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>deleteOVZizi(o.id)}>Suppr.</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          </>}

          {/* ── Comptabilite ── */}
          {page==="comptabilite"&&<>
            <div className="page-header">
              <div><div className="page-title">Comptabilite</div><div className="page-sub">Exercice {comptaAnnee}</div></div>
              <div className="filter-group">
                <select value={comptaAnnee} onChange={e=>setComptaAnnee(parseInt(e.target.value))} style={{padding:"10px 14px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:14}}>
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>
            </div>

            <div className="tabs">
              <button className={`tab ${comptaTab==="dashboard"?"active":""}`} onClick={()=>setComptaTab("dashboard")}><LayoutDashboard size={15}/> Tableau de bord</button>
              <button className={`tab ${comptaTab==="tva"?"active":""}`} onClick={()=>setComptaTab("tva")}><Receipt size={15}/> TVA</button>
              <button className={`tab ${comptaTab==="exercices"?"active":""}`} onClick={()=>setComptaTab("exercices")}><CalendarDays size={15}/> Exercices</button>
            </div>

            {/* ── Dashboard ── */}
            {comptaTab==="dashboard"&&comptaData&&<>
              <div className="kpi-grid">
                <div className="kpi-card success">
                  <div className="kpi-label">Chiffre d'affaires HT</div>
                  <div className="kpi-value">{fmt(comptaData.chiffre_affaires.ht)} DH</div>
                  <div className="kpi-sub">{comptaData.chiffre_affaires.count} facture(s)</div>
                </div>
                <div className="kpi-card danger">
                  <div className="kpi-label">Charges totales</div>
                  <div className="kpi-value">{fmt(comptaData.charges.ht)} DH</div>
                  <div className="kpi-sub">{comptaData.charges.count} depense(s)</div>
                </div>
                <div className="kpi-card info">
                  <div className="kpi-label">Resultat brut</div>
                  <div className="kpi-value">{fmt(comptaData.resultat.brut)} DH</div>
                  <div className="kpi-sub">Marge: {comptaData.resultat.marge}%</div>
                </div>
                <div className="kpi-card warning">
                  <div className="kpi-label">Creances clients</div>
                  <div className="kpi-value">{fmt(comptaData.creances.impayees)} DH</div>
                  <div className="kpi-sub">{comptaData.creances.count_impayees} facture(s) impayee(s)</div>
                </div>
              </div>

              <div className="compta-grid">
                <div className="compta-main">
                  <div className="card" style={{marginBottom:24}}>
                    <div className="card-header"><span className="card-title">Evolution CA vs Charges (mois par mois)</span></div>
                    <div style={{padding:24}}>
                      {comptaData.caByMonth.length===0&&<div className="empty"><div className="empty-icon"><BarChart3 size={22}/></div>Aucune donnee</div>}
                      <div className="chart-bar">
                        {comptaData.caByMonth.map((m,i)=>{
                          const maxVal = Math.max(...comptaData.caByMonth.map(x=>x.ht), ...comptaData.chargesByMonth.map(x=>x.ht), 1);
                          const chg = comptaData.chargesByMonth.find(c=>c.mois===m.mois);
                          return(
                            <div key={m.mois} className="chart-bar-item">
                              <div style={{display:"flex",gap:2,width:"100%",alignItems:"flex-end",height:160}}>
                                <div className="chart-bar-fill" style={{height:`${(m.ht/maxVal)*100}%`,background:"var(--accent)",flex:1}}></div>
                                <div className="chart-bar-fill" style={{height:`${((chg?.ht||0)/maxVal)*100}%`,background:"var(--danger)",flex:1,opacity:0.7}}></div>
                              </div>
                              <div className="chart-bar-value">{fmt(m.ht)}</div>
                              <div className="chart-bar-label">{m.mois}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",gap:20,justifyContent:"center",marginTop:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,background:"var(--accent)",borderRadius:3}}></div><span style={{fontSize:12}}>CA HT</span></div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:12,height:12,background:"var(--danger)",borderRadius:3,opacity:0.7}}></div><span style={{fontSize:12}}>Charges HT</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><span className="card-title">Repartition des charges par categorie</span></div>
                    <div style={{padding:24}}>
                      {comptaData.chargesByCategory.length===0&&<div className="empty"><div className="empty-icon"><WalletCards size={22}/></div>Aucune charge</div>}
                      {comptaData.chargesByCategory.map((cat,i)=>{
                        const total = comptaData.charges.ht || 1;
                        const pct = ((cat.ht/total)*100).toFixed(1);
                        const colors = ["var(--accent)","var(--sky)","var(--teal)","var(--amber)","var(--rose)","var(--violet)","var(--success)"];
                        return(
                          <div key={cat.categorie} style={{marginBottom:16}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{fontSize:13,fontWeight:500}}>{cat.categorie}</span>
                              <span style={{fontSize:13,color:"var(--muted)"}}>{fmt(cat.ht)} DH ({pct}%)</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-bar-fill" style={{width:`${pct}%`,background:colors[i%colors.length]}}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="compta-side">
                  <div className="card">
                    <div className="card-header"><span className="card-title">Top clients</span></div>
                    <div style={{padding:20}}>
                      {comptaData.topClients.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:13}}>Aucun client</div>}
                      {comptaData.topClients.map((cl,i)=>{
                        const maxVal = Math.max(...comptaData.topClients.map(x=>x.total), 1);
                        return(
                          <div key={cl.name} style={{marginBottom:14}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontSize:13}}>{i+1}. {cl.name}</span>
                              <span className="mono" style={{fontSize:12}}>{fmt(cl.total)} DH</span>
                            </div>
                            <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${(cl.total/maxVal)*100}%`,background:"var(--accent)"}}></div></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><span className="card-title">Resume fiscal</span></div>
                    <div style={{padding:20}}>
                      <div className="tax-row"><span className="tax-label">CA HT</span><span className="tax-value">{fmt(comptaData.chiffre_affaires.ht)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">Charges deductibles</span><span className="tax-value">{fmt(comptaData.charges.ht)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">Resultat brut</span><span className="tax-value">{fmt(comptaData.resultat.brut)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">IS ({comptaData.impots.taux_is}%)</span><span className="tax-value">{fmt(comptaData.impots.is_du)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">Cotisation minimale</span><span className="tax-value">{fmt(comptaData.impots.cm_du)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">CSS</span><span className="tax-value">{fmt(comptaData.impots.css_du)} DH</span></div>
                      <div className="tax-row highlight"><span className="tax-label">Total impots</span><span className="tax-value">{fmt(comptaData.impots.total_impots)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">Resultat net estime</span><span className="tax-value" style={{color:"var(--success)"}}>{fmt(comptaData.resultat.net)} DH</span></div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header"><span className="card-title">TVA</span></div>
                    <div style={{padding:20}}>
                      <div className="tax-row"><span className="tax-label">TVA collectee</span><span className="tax-value">{fmt(comptaData.tva.collectee)} DH</span></div>
                      <div className="tax-row"><span className="tax-label">TVA deductible</span><span className="tax-value">{fmt(comptaData.tva.deductible)} DH</span></div>
                      <div className="tax-row highlight"><span className="tax-label">TVA a payer</span><span className="tax-value" style={{color:comptaData.tva.a_payer>0?"var(--danger)":"var(--success)"}}>{fmt(comptaData.tva.a_payer)} DH</span></div>
                      {comptaData.tva.credit>0&&<div className="tax-row"><span className="tax-label">Credit TVA</span><span className="tax-value" style={{color:"var(--success)"}}>{fmt(comptaData.tva.credit)} DH</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            </>}

            {/* ── TVA ── */}
            {comptaTab==="tva"&&tvaData&&<>
              <div className="tva-grid">
                <div className="tva-card">
                  <div className="tva-card-label">TVA Collectee</div>
                  <div className="tva-card-value" style={{color:"var(--info)"}}>{fmt(tvaData.tva_ventes.tva)}</div>
                  <div className="tva-card-sub">DH sur ventes</div>
                </div>
                <div className="tva-card">
                  <div className="tva-card-label">TVA Deductible</div>
                  <div className="tva-card-value" style={{color:"var(--warning)"}}>{fmt(tvaData.tva_achats.tva)}</div>
                  <div className="tva-card-sub">DH sur achats</div>
                </div>
                <div className="tva-card">
                  <div className="tva-card-label">TVA a Payer</div>
                  <div className="tva-card-value" style={{color:tvaData.tva_a_payer>0?"var(--danger)":"var(--success)"}}>{fmt(tvaData.tva_a_payer)}</div>
                  <div className="tva-card-sub">DH</div>
                </div>
              </div>

              <div className="search-bar" style={{marginBottom:24}}>
                <div className="filter-group">
                  <select value={tvaTrimestre} onChange={e=>setTvaTrimestre(e.target.value)}>
                    <option value="">Annee complete</option>
                    <option value="1">Trimestre 1</option>
                    <option value="2">Trimestre 2</option>
                    <option value="3">Trimestre 3</option>
                    <option value="4">Trimestre 4</option>
                  </select>
                </div>
              </div>

              <div className="compta-grid">
                <div className="card">
                  <div className="card-header"><span className="card-title">TVA sur ventes (detail mensuel)</span></div>
                  <div className="table-scroll"><table>
                    <thead><tr><th>Periode</th><th>CA HT</th><th>TVA</th><th>Factures</th></tr></thead>
                    <tbody>
                      {tvaData.detail_ventes.length===0&&<tr><td colSpan={4}><div className="empty">Aucune donnee</div></td></tr>}
                      {tvaData.detail_ventes.map(v=>(
                        <tr key={v.periode}>
                          <td className="mono">{v.periode}</td>
                          <td className="mono">{fmt(v.ht)} DH</td>
                          <td className="mono" style={{color:"var(--info)"}}><b>{fmt(v.tva)} DH</b></td>
                          <td>{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
                <div className="card">
                  <div className="card-header"><span className="card-title">TVA sur achats (detail mensuel)</span></div>
                  <div className="table-scroll"><table>
                    <thead><tr><th>Periode</th><th>Achats HT</th><th>TVA</th><th>Charges</th></tr></thead>
                    <tbody>
                      {tvaData.detail_achats.length===0&&<tr><td colSpan={4}><div className="empty">Aucune donnee</div></td></tr>}
                      {tvaData.detail_achats.map(v=>(
                        <tr key={v.periode}>
                          <td className="mono">{v.periode}</td>
                          <td className="mono">{fmt(v.ht)} DH</td>
                          <td className="mono" style={{color:"var(--warning)"}}><b>{fmt(v.tva)} DH</b></td>
                          <td>{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              </div>
            </>}

            {/* ── Exercices ── */}
            {comptaTab==="exercices"&&<>
              <div className="card">
                <div className="card-header"><span className="card-title">Historique des exercices comptables</span></div>
                <div>
                {exercices.length===0&&<div className="empty"><div className="empty-icon"><CalendarDays size={22}/></div>Aucun exercice cloture</div>}
                  {exercices.map(ex=>(
                    <div key={ex.id} className="exercice-row">
                      <span className="exercice-annee">{ex.annee}</span>
                      <span className={`badge ${ex.statut==='Cloture'?'badge-cloture':'badge-encours'}`}>{ex.statut}</span>
                      <span className="exercice-ca">CA: {fmt(ex.ca_total)} DH</span>
                      <span className="exercice-resultat" style={{color:ex.resultat_net>=0?"var(--success)":"var(--danger)"}}>Resultat: {fmt(ex.resultat_net)} DH</span>
                      <span className="mono" style={{fontSize:12,color:"var(--muted)"}}>IS: {fmt(ex.is_du)} DH</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{marginTop:24,textAlign:"center"}}>
                  <button className="btn btn-primary" onClick={()=>cloturerExercice(comptaAnnee)}><CalendarDays size={15}/> Cloturer l'exercice {comptaAnnee}</button>
                <p style={{fontSize:12,color:"var(--muted)",marginTop:8}}>Cette action calcule et archive tous les indicateurs fiscaux de l'exercice</p>
              </div>
            </>}
          </>}

          {/* ── Anomalies ── */}
          {page==="anomalies"&&<>
            <div className="page-header">
              <div><div className="page-title">Detection des anomalies</div><div className="page-sub">Controle automatique des donnees commerciales et comptables</div></div>
              <button className="btn btn-primary" disabled={anomalyLoading} onClick={loadAnomalies}>{anomalyLoading?<Loader2 size={14} className="icon-spin"/>:<AlertTriangle size={14}/>} Relancer l'analyse</button>
            </div>

            <div className="stats-3">
              <div className="stat-card"><div className="stat-label">Total signale</div><div className="stat-value accent">{anomalyData?.summary?.total||0}</div></div>
              <div className="stat-card"><div className="stat-label">Critiques</div><div className="stat-value" style={{color:"var(--danger)"}}>{anomalyData?.summary?.critical||0}</div></div>
              <div className="stat-card"><div className="stat-label">A verifier</div><div className="stat-value" style={{color:"var(--warning)"}}>{anomalyData?.summary?.warning||0}</div></div>
            </div>

            <div className="anomaly-note">Ces alertes sont des controles automatiques. Elles signalent un risque ou une valeur inhabituelle, mais la decision finale reste une verification humaine.</div>
            <div className="anomaly-toolbar">
              <div className="anomaly-filters">
                {[{id:"all",label:"Toutes"},{id:"critical",label:"Critiques"},{id:"warning",label:"A verifier"}].map(filter=><button key={filter.id} className={`btn btn-sm ${anomalyFilter===filter.id?"btn-primary":"btn-ghost"}`} onClick={()=>setAnomalyFilter(filter.id)}>{filter.label}</button>)}
              </div>
              <span style={{fontSize:12,color:"var(--muted)"}}>{visibleAnomalies.length} resultat{visibleAnomalies.length!==1?"s":""}</span>
            </div>

            {!anomalyData&&anomalyLoading&&<div className="loading"><Loader2 size={22} className="icon-spin"/> Analyse en cours...</div>}
            {anomalyData&&visibleAnomalies.length===0&&<div className="card"><div className="empty"><div className="empty-icon"><AlertTriangle size={22}/></div>Aucune anomalie dans cette categorie</div></div>}
            <div className="anomaly-list">
              {visibleAnomalies.map(anomaly=><div className={`anomaly-card ${anomaly.severity}`} key={anomaly.id}>
                <div className="anomaly-icon"><AlertTriangle size={17}/></div>
                <div>
                  <div className="anomaly-title">{anomaly.title}</div>
                  <div className="anomaly-message">{anomaly.message}</div>
                  <div className="anomaly-meta">
                    <span className={`badge ${anomaly.severity==="critical"?"badge-critical":"badge-warning"}`}>{anomaly.severity==="critical"?"Critique":"A verifier"}</span>
                    <span>{ANOMALY_TYPE_LABELS[anomaly.type]||anomaly.type}</span>
                    <span className="anomaly-entity">{anomaly.entity_label}</span>
                  </div>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={()=>setPage(anomaly.action_page)}>Ouvrir</button>
              </div>)}
            </div>
          </>}

          {/* ── Societe ── */}
          {page==="societe"&&<>
            <div className="page-header"><div className="page-title">Societe</div>
              {user.role === "admin" && company && !companyDraft && <button className="btn btn-primary" onClick={() => { setCompanyDraft({...company}); setCompanyError(""); }}>Modifier les informations</button>}
            </div>
            {companyError && <div role="alert" style={{color:"var(--red)",marginBottom:16}}>{companyError}{!company && <button className="btn btn-ghost" onClick={loadCompany}>Reessayer</button>}</div>}
            {!company && !companyError && <p>Chargement des informations...</p>}
            {companyDraft ? <form className="card" style={{padding:32,maxWidth:600}} onSubmit={saveCompany}>
              <fieldset disabled={companySaving} style={{border:0,padding:0,margin:0,minWidth:0}}>
                {[["name","Nom"],["ice","ICE"],["rc","RC"],["cnss","CNSS"],["patente","Patente"],["if_number","IF"],["address","Adresse"],["phone","Telephone"],["email","Email"]].map(([key,label]) => <div className="form-group" key={key} style={{marginBottom:16}}>
                  <label htmlFor={`company-${key}`}>{label}{key === "name" ? " *" : ""}</label>
                  <input id={`company-${key}`} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} required={key === "name"} maxLength={key === "address" ? 1000 : 255} pattern={key === "ice" ? "[0-9]{15}" : undefined} title={key === "ice" ? "15 chiffres" : undefined} value={companyDraft[key]} onChange={e => setCompanyDraft({...companyDraft,[key]:e.target.value})}/>
                </div>)}
                <div style={{display:"flex",gap:12}}><button type="submit" className="btn btn-primary">{companySaving ? "Enregistrement..." : "Enregistrer"}</button><button type="button" className="btn btn-ghost" onClick={() => { setCompanyDraft(null); setCompanyError(""); }}>Annuler</button></div>
              </fieldset>
            </form> : company &&
            <div className="card" style={{padding:32,maxWidth:600}}>
              {[["Nom",company.name],["ICE",company.ice],["RC",company.rc],["CNSS",company.cnss],["Patente",company.patente],["IF",company.if_number],["Adresse",company.address],["Telephone",company.phone],["Email",company.email]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:16,padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{width:100,fontWeight:600,fontSize:12,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",paddingTop:2}}>{k}</span>
                  <span style={{overflowWrap:"anywhere",minWidth:0,fontFamily:["ICE","RC","CNSS","Patente","IF"].includes(k)?"JetBrains Mono Variable, JetBrains Mono, monospace":"inherit",fontSize:14}}>{v||"—"}</span>
                </div>
              ))}
            </div>}
          </>}
        </main>
      </div>

      {/* ── Facture Modal ── */}
      {showModal===true&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier":"Nouvelle facture"}</div>

          <div className="form-group full" style={{marginBottom:16}}>
            <label>Type de facture</label>
            <div className="toggle-group">
              <button type="button" className={`toggle-btn ${(form.client_type||"societe")==="societe"?"active":""}`} onClick={()=>setForm(f=>({...f,client_type:"societe",clientId:""}))}>Client (societe)</button>
              <button type="button" className={`toggle-btn ${form.client_type==="physique"?"active":""}`} onClick={()=>setForm(f=>({...f,client_type:"physique",clientId:""}))}>Personne physique</button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group"><label>Numero</label><input value={form.numero||""} onChange={e=>handleFormChange("numero",e.target.value)}/></div>

            <div className="form-group"><label>{form.client_type==="physique"?"Personne physique":"Client"}</label>
              <select value={form.clientId||""} onChange={e=>handleFormChange("clientId",e.target.value)}>
                <option value="">— Selectionner —</option>
                {clients.filter(c=>(c.client_type||"societe")===(form.client_type||"societe")).map(c=><option key={c.id} value={c.id}>{c.name}{c.client_type==="physique"&&c.cin?` — CIN ${c.cin}`:""}</option>)}
              </select>
            </div>

            <div className="form-group"><label>Date</label><input type="date" value={form.date||""} onChange={e=>handleFormChange("date",e.target.value)}/></div>
            <div className="form-group"><label>Lieu</label><input value={form.lieu||""} onChange={e=>handleFormChange("lieu",e.target.value)}/></div>

            <div className="form-group full"><label>Designation</label><input value={form.designation||""} onChange={e=>handleFormChange("designation",e.target.value)}/></div>

            <div className="form-group full">
              <label>Mode de calcul</label>
              <div className="toggle-group">
                <button type="button" className={`toggle-btn ${(form.calc_type||"qte")==="qte"?"active":""}`} onClick={()=>handleFormChange("calc_type","qte")}>Quantite (kg) × PU TTC</button>
                <button type="button" className={`toggle-btn ${form.calc_type==="total"?"active":""}`} onClick={()=>handleFormChange("calc_type","total")}>Total TTC + PU TTC</button>
              </div>
            </div>

            {(form.calc_type||"qte")==="qte" ? (<>
              <div className="form-group"><label>Quantite (kg)</label><input type="number" min="0" value={form.qte_kg||""} onChange={e=>handleFormChange("qte_kg",e.target.value)}/></div>
              <div className="form-group"><label>PU TTC (DH)</label><input type="number" min="0" value={form.pu_ttc||""} onChange={e=>handleFormChange("pu_ttc",e.target.value)}/></div>
            </>) : (<>
              <div className="form-group"><label>Total TTC recu (DH)</label><input type="number" min="0" value={form.total_ttc_saisi||""} onChange={e=>handleFormChange("total_ttc_saisi",e.target.value)}/></div>
              <div className="form-group"><label>PU TTC (DH)</label><input type="number" min="0" value={form.pu_ttc||""} onChange={e=>handleFormChange("pu_ttc",e.target.value)}/></div>
            </>)}

            <div className="form-group full">
              <label>Mode de paiement</label>
              <input list="modes-paiement-facture" value={form.mode_paiement||""} onChange={e=>handleFormChange("mode_paiement",e.target.value)} placeholder="Cheque, Virement bancaire..." />
              <datalist id="modes-paiement-facture">
                {MODES_PAIEMENT_FACTURE.map(m=><option key={m} value={m} />)}
              </datalist>
            </div>

            {calcPreview&&<div className="form-group full"><div className="calc-preview">
              {(form.calc_type||"qte")==="total" && <div className="calc-row"><span>Quantite calculee</span><span className="mono">{fmtInt(calcPreview.qte_kg)} kg</span></div>}
              <div className="calc-row"><span>Montant HT</span><span className="mono">{fmt(calcPreview.montant_ht)} DH</span></div>
              <div className="calc-row"><span>TVA 20%</span><span className="mono">{fmt(calcPreview.tva)} DH</span></div>
              <div className="calc-row total"><span>PT TTC</span><span className="mono">{fmt(calcPreview.pt_ttc)} DH</span></div>
              {(form.calc_type||"qte")==="total" && <div className="calc-row adjust"><span>Ajustement d'arrondi</span><span className="mono">{fmt(calcPreview.ajustement_arrondi)} DH</span></div>}
            </div></div>}
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {/* ── Container Modal ── */}
      {showModal==="container"&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier le conteneur":"Nouveau conteneur"}</div>
          <div className="form-grid">
            <div className="form-group"><label>N Conteneur *</label><input className="mono" value={form.numero||""} onChange={e=>handleContainerChange("numero",e.target.value)} placeholder="ABCU1234567"/></div>
            <div className="form-group"><label>Type</label>
              <select value={form.type||"40ft"} onChange={e=>handleContainerChange("type",e.target.value)}>
                {TYPES_CONTENEUR.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>N Scelle</label><input className="mono" value={form.scelle||""} onChange={e=>handleContainerChange("scelle",e.target.value)}/></div>
            <div className="form-group"><label>Statut</label>
              <select value={form.statut||"En transit"} onChange={e=>handleContainerChange("statut",e.target.value)}>
                {STATUTS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Fournisseur</label><input value={form.fournisseur||""} onChange={e=>handleContainerChange("fournisseur",e.target.value)}/></div>
            <div className="form-group"><label>B/L (Bill of Lading)</label><input className="mono" value={form.bl||""} onChange={e=>handleContainerChange("bl",e.target.value)}/></div>
            <div className="form-group"><label>Port de depart</label><input value={form.port_depart||""} onChange={e=>handleContainerChange("port_depart",e.target.value)}/></div>
            <div className="form-group"><label>Port d'arrivee</label><input value={form.port_arrivee||""} onChange={e=>handleContainerChange("port_arrivee",e.target.value)}/></div>
            <div className="form-group"><label>Date de depart</label><input type="date" value={form.date_depart||""} onChange={e=>handleContainerChange("date_depart",e.target.value)}/></div>
            <div className="form-group"><label>Date d'arrivee</label><input type="date" value={form.date_arrivee||""} onChange={e=>handleContainerChange("date_arrivee",e.target.value)}/></div>
            <div className="form-group"><label>Nombre de sacs</label><input type="number" min="0" value={form.nb_sacs||""} onChange={e=>handleContainerChange("nb_sacs",e.target.value)}/></div>
            <div className="form-group"><label>Poids total (kg)</label><input type="number" min="0" value={form.poids_total||""} onChange={e=>handleContainerChange("poids_total",e.target.value)}/></div>
            <div className="form-group"><label>Poids commande (kg)</label><input type="number" min="0" value={form.poids_commande||""} onChange={e=>handleContainerChange("poids_commande",e.target.value)}/></div>
            <div className="form-group"><label>Poids recu (kg)</label><input type="number" min="0" value={form.poids_recu||""} onChange={e=>handleContainerChange("poids_recu",e.target.value)}/></div>
            <div className="form-group full"><label>Facture commerciale (reference)</label><input value={form.facture_commerciale||""} onChange={e=>handleContainerChange("facture_commerciale",e.target.value)} placeholder="Reference ou nom du fichier"/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveContainer}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {/* ── Charge Modal ── */}
      {showModal==="charge"&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier la charge":"Nouvelle charge"}</div>
          <div className="form-grid">
            <div className="form-group"><label>Date *</label><input type="date" value={form.date||""} onChange={e=>handleChargeChange("date",e.target.value)}/></div>
            <div className="form-group"><label>Categorie *</label>
              <select value={form.categorie||"Fournitures"} onChange={e=>handleChargeChange("categorie",e.target.value)}>
                {CATEGORIES_CHARGE.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group full"><label>Libelle *</label><input value={form.libelle||""} onChange={e=>handleChargeChange("libelle",e.target.value)} placeholder="Description de la charge"/></div>
            <div className="form-group"><label>Montant HT *</label><input type="number" min="0" value={form.montant_ht||""} onChange={e=>handleChargeChange("montant_ht",e.target.value)}/></div>
            <div className="form-group"><label>TVA</label><input type="number" min="0" value={form.tva||""} onChange={e=>handleChargeChange("tva",e.target.value)}/></div>
            <div className="form-group"><label>Montant TTC</label><input type="number" min="0" value={form.montant_ttc||""} onChange={e=>handleChargeChange("montant_ttc",e.target.value)}/></div>
            <div className="form-group"><label>Fournisseur</label><input value={form.fournisseur||""} onChange={e=>handleChargeChange("fournisseur",e.target.value)}/></div>
            <div className="form-group"><label>Mode de paiement</label>
              <select value={form.mode_paiement||"Virement"} onChange={e=>handleChargeChange("mode_paiement",e.target.value)}>
                {MODES_PAIEMENT.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Reference</label><input value={form.reference||""} onChange={e=>handleChargeChange("reference",e.target.value)}/></div>
            <div className="form-group"><label>Deductible</label>
              <select value={form.deductible?"1":"0"} onChange={e=>handleChargeChange("deductible",e.target.value==="1")}>
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </div>
            <div className="form-group full"><label>Notes</label><textarea value={form.notes||""} onChange={e=>handleChargeChange("notes",e.target.value)} placeholder="Commentaires..."/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveCharge}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {/* ── Ordre de virement TVA Modal ── */}
      {showModal==="ov"&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier l'ordre de virement":"Nouvel ordre de virement TVA"}</div>
          <div className="form-grid">
            <div className="form-group"><label>Date *</label><input type="date" value={form.date||""} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <div className="form-group"><label>Montant (DH) *</label><input type="number" min="0" value={form.montant||""} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/></div>
            <div className="form-group full"><label>Reference (optionnel)</label><input value={form.reference||""} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></div>
            <div className="form-group full"><label>Notes (optionnel)</label><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveOV}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {/* ── Ordre de virement bénéficiaire Modal ── */}
      {showModal==="ov_zizi"&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier l'ordre de virement":"Nouvel ordre de virement"}</div>
          <div className="form-grid">
            <div className="form-group"><label>Date *</label><input type="date" value={form.date||""} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <div className="form-group"><label>Montant (DH) *</label><input type="number" min="0" value={form.montant||""} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/></div>
            <div className="form-group full"><label>Nom du beneficiaire *</label><input value={form.nom||""} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom complet ou raison sociale"/></div>
            <div className="form-group full"><label>RIB / IBAN du beneficiaire *</label><input className="mono" value={form.rib||""} onChange={e=>setForm(f=>({...f,rib:e.target.value}))} placeholder="RIB ou IBAN"/></div>
            <div className="form-group full"><label>Banque *</label><input value={form.banque||""} onChange={e=>setForm(f=>({...f,banque:e.target.value}))} placeholder="Nom de la banque"/></div>
            <div className="form-group full"><label>Montant en lettres (auto-generé)</label>
              <div style={{padding:"10px 14px",background:"var(--paper)",borderRadius:8,fontSize:14,minHeight:40}}>
                {form.montant && parseFloat(form.montant) > 0 
                  ? numToWords(Math.round(parseFloat(form.montant))) + " dirhams"
                  : "Saisissez un montant pour voir les lettres"}
              </div>
            </div>
            <div className="form-group full"><label>Reference (optionnel)</label><input value={form.reference||""} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></div>
            <div className="form-group full"><label>Notes (optionnel)</label><textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveOVZizi}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {/* ── Client Modal ── */}
      {showModal==="client"&&<div className="modal-overlay" onClick={()=>setShowModal(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-title">{editTarget?"Modifier la fiche":"Nouvelle fiche client"}</div>
          <div className="form-group full" style={{marginBottom:16}}>
            <label>Type</label>
            <div className="toggle-group">
              <button type="button" className={`toggle-btn ${(form.client_type||"societe")==="societe"?"active":""}`} onClick={()=>setForm(f=>({...f,client_type:"societe",cin:""}))}>Societe</button>
              <button type="button" className={`toggle-btn ${form.client_type==="physique"?"active":""}`} onClick={()=>setForm(f=>({...f,client_type:"physique",ice:""}))}>Personne physique</button>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group full"><label>Nom</label><input value={form.name||""} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
            {(form.client_type||"societe")==="societe"
              ? <div className="form-group full"><label>ICE</label><input className="mono" value={form.ice||""} onChange={e=>setForm(f=>({...f,ice:e.target.value}))}/></div>
              : <div className="form-group full"><label>CIN (facultatif)</label><input className="mono" value={form.cin||""} onChange={e=>setForm(f=>({...f,cin:e.target.value}))} placeholder="AB123456"/></div>}
            <div className="form-group full"><label>Adresse</label><input value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>
            <div className="form-group"><label>Telephone</label><input value={form.phone||""} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
            <div className="form-group"><label>Email</label><input type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveClient}>{editTarget?"Enregistrer":"Creer"}</button>
          </div>
        </div>
      </div>}

      {page!=="assistant" && <AgentChat user={user} onDataChanged={reloadData} onOpenWorkspace={()=>setPage("assistant")} />}
    </>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("tradivia_theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("tradivia_token");
    const user = localStorage.getItem("tradivia_user");
    return token && user ? { token, user: JSON.parse(user) } : null;
  });
  const [checking, setChecking] = useState(true);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("tradivia_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");

  const doLogout = () => {
    localStorage.removeItem("tradivia_token");
    localStorage.removeItem("tradivia_user");
    setAuthToken(null);
    setAuth(null);
  };

  useEffect(() => { setOnUnauthorized(doLogout); }, []);

  useEffect(() => {
    if (auth) {
      setAuthToken(auth.token);
      authFetch(API + "/auth/me")
        .then(r => { if (!r.ok) throw new Error(); return r.json(); })
        .then(() => setChecking(false))
        .catch(() => { doLogout(); setChecking(false); });
      return;
    }

    const autoLoginDefaultAdmin = async () => {
      try {
        const r = await fetch(API + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_ADMIN_LOGIN)
        });
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.token) throw new Error(data?.error || "Login admin impossible");
        handleLogin(data.token, data.user);
      } catch (error) {
        setChecking(false);
      }
    };

    autoLoginDefaultAdmin();
  }, [auth]);

  const handleLogin = (token, user) => {
    localStorage.setItem("tradivia_token", token);
    localStorage.setItem("tradivia_user", JSON.stringify(user));
    setAuthToken(token);
    setAuth({ token, user });
    setChecking(false);
  };

  const themeControl = <ThemeToggle theme={theme} onToggle={toggleTheme} className="global-theme-toggle" />;

  if (checking) return <><style>{STYLE}</style>{themeControl}<div className="loading">Chargement...</div></>;
  if (!auth) return <><style>{STYLE}</style>{themeControl}<LoginScreen onLogin={handleLogin} /></>;

  return <>{themeControl}<Dashboard token={auth.token} user={auth.user} onLogout={doLogout} /></>;
}
