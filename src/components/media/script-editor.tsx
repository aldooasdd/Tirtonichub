"use client";
// Editor Script Konten (Tiptap 3, MIT). Semua tombol toolbar menjalankan perintah editor sungguhan.
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, ChevronUp, Eraser, Highlighter, ImagePlus, IndentDecrease, IndentIncrease, Italic,
  Link2, List, ListChecks, ListOrdered, MessageSquarePlus, Minus, Plus, Printer, Redo2, Search, Strikethrough, Table2, Underline, Undo2, X,
} from "lucide-react";
import { FONTS } from "@/lib/media/script";

export const ScriptImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ref: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("data-ref"), renderHTML: (a: { ref?: string | null }) => (a.ref ? { "data-ref": a.ref } : {}) },
    };
  },
});

export function scriptExtensions(editable: boolean) {
  return [
    StarterKit.configure({ link: { openOnClick: !editable, autolink: true, defaultProtocol: "https", HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } } }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyleKit,
    Highlight.configure({ multicolor: true }),
    ScriptImage.configure({ inline: true, resize: editable ? { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 60, minHeight: 60 } : false }),
    TableKit.configure({ table: { resizable: editable } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: "Tulis script di sini…" }),
  ];
}

export const DOC_CSS = `
.sdoc{font-family:"DM Sans",system-ui,sans-serif;font-size:15px;line-height:1.6;color:#202328;outline:none;min-height:60vh}
.sdoc h1{font:700 28px/1.25 Manrope,sans-serif;margin:18px 0 8px}.sdoc h2{font:700 21px/1.3 Manrope,sans-serif;margin:16px 0 6px}.sdoc h3{font:700 17px/1.35 Manrope,sans-serif;margin:14px 0 4px}
.sdoc p{margin:0 0 6px}.sdoc ul{list-style:disc;padding-left:24px}.sdoc ol{list-style:decimal;padding-left:24px}
.sdoc ul[data-type=taskList]{list-style:none;padding-left:4px}.sdoc ul[data-type=taskList] li{display:flex;gap:8px;align-items:flex-start}.sdoc ul[data-type=taskList] li>label{margin-top:4px}
.sdoc blockquote{border-left:3px solid #E7E9ED;padding-left:12px;color:#5b6170}.sdoc hr{border:0;border-top:1px solid #E7E9ED;margin:16px 0}
.sdoc a{color:#2F6FEB;text-decoration:underline}.sdoc img{max-width:100%;height:auto;border-radius:6px;display:inline-block;vertical-align:top;margin:0 6px 6px 0}
.sdoc img.ProseMirror-selectednode,.sdoc [data-resize-container].ProseMirror-selectednode img{outline:2px solid #B5D916}
.sdoc table{border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed}.sdoc td,.sdoc th{border:1px solid #D9DCE1;padding:6px 8px;vertical-align:top}.sdoc th{background:#F2F3F5;font-weight:600}
.sdoc .selectedCell{background:#EEF6D0}.sdoc .column-resize-handle{position:absolute;right:-2px;top:0;bottom:0;width:4px;background:#B5D916}.sdoc .tableWrapper{overflow-x:auto}
.sdoc p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#9AA0A9;float:left;height:0;pointer-events:none}
.sdoc mark{border-radius:2px;padding:0 1px}.sdoc pre{background:#F2F3F5;border-radius:6px;padding:10px;font-size:13px;overflow-x:auto}
.sdoc .sfound{background:#FFE58A}
@media print{body *{visibility:hidden!important}.sprint,.sprint *{visibility:visible!important}.sprint{position:absolute;left:0;top:0;width:100%;zoom:1!important;box-shadow:none!important;border:0!important;padding:0!important}}
`;

const btn = "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[#3c4049] hover:bg-[#F2F3F5] disabled:opacity-35 disabled:hover:bg-transparent aria-pressed:bg-[#E9F2C4] aria-pressed:text-[#202328]";
const sel = "h-8 shrink-0 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] text-[#3c4049] hover:bg-[#F2F3F5] focus:border-[#E7E9ED] focus:outline-none";
const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-[#E7E9ED]" aria-hidden />;

function B({ label, onClick, on, disabled, children }: { label: string; onClick: () => void; on?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className={btn} title={label} aria-label={label} aria-pressed={on === undefined ? undefined : on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

/** Cari teks di dokumen: kembalikan posisi kecocokan (tanpa membedakan huruf besar/kecil). */
function findAll(ed: Editor, q: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  const s = q.trim().toLowerCase();
  if (!s) return out;
  ed.state.doc.descendants((n, pos) => {
    if (!n.isText || !n.text) return;
    const t = n.text.toLowerCase();
    let i = t.indexOf(s);
    while (i >= 0 && out.length < 500) {
      out.push({ from: pos + i, to: pos + i + s.length });
      i = t.indexOf(s, i + s.length);
    }
  });
  return out;
}
export function selectText(ed: Editor, q: string): boolean {
  const m = findAll(ed, q)[0];
  if (!m) return false;
  ed.chain().focus().setTextSelection(m).scrollIntoView().run();
  return true;
}

type Media = { ref: string; src: string; name: string };

export function Toolbar({ ed, zoom, setZoom, media, onComment }: { ed: Editor; zoom: number; setZoom: (z: number) => void; media: Media[]; onComment: (quote: string) => void }) {
  const st = useEditorState({
    editor: ed,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      h: e.isActive("heading", { level: 1 }) ? "1" : e.isActive("heading", { level: 2 }) ? "2" : e.isActive("heading", { level: 3 }) ? "3" : "p",
      font: String(e.getAttributes("textStyle").fontFamily || "").replace(/["']/g, ""),
      size: String(e.getAttributes("textStyle").fontSize || ""),
      lh: String(e.getAttributes("textStyle").lineHeight || ""),
      color: String(e.getAttributes("textStyle").color || "#202328"),
      align: (["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) || "left") as string,
      bl: e.isActive("bulletList"), ol: e.isActive("orderedList"), tl: e.isActive("taskList"), link: e.isActive("link"), table: e.isActive("table"),
      undo: e.can().undo(), redo: e.can().redo(),
      sink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"), lift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
      empty: e.state.selection.empty,
    }),
  });
  const [find, setFind] = useState<{ open: boolean; q: string; i: number; n: number }>({ open: false, q: "", i: 0, n: 0 });
  const [link, setLink] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [tbl, setTbl] = useState(false);
  const c = () => ed.chain().focus();
  const size = parseInt(st.size) || 15;
  const setSize = (n: number) => c().setFontSize(Math.max(8, Math.min(72, n)) + "px").run();
  const go = (dir: number) => {
    const m = findAll(ed, find.q);
    if (!m.length) return setFind({ ...find, n: 0, i: 0 });
    const i = (find.i + dir + m.length) % m.length;
    ed.chain().focus().setTextSelection(m[i]).scrollIntoView().run();
    setFind({ ...find, i, n: m.length });
  };
  return (
    <div className="relative border-b border-[#E7E9ED] bg-white">
      <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto px-2 py-1 [scrollbar-width:thin] min-[640px]:flex-wrap" role="toolbar" aria-label="Format dokumen">
        <B label="Cari di dokumen (Ctrl+F)" on={find.open} onClick={() => setFind({ ...find, open: !find.open })}><Search className="size-4" /></B>
        <B label="Urungkan (Ctrl+Z)" disabled={!st.undo} onClick={() => c().undo().run()}><Undo2 className="size-4" /></B>
        <B label="Ulangi (Ctrl+Y)" disabled={!st.redo} onClick={() => c().redo().run()}><Redo2 className="size-4" /></B>
        <B label="Cetak / simpan PDF" onClick={() => window.print()}><Printer className="size-4" /></B>
        <B label="Hapus format" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser className="size-4" /></B>
        <Sep />
        <select className={sel} aria-label="Zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
          {[50, 75, 90, 100, 125, 150, 200].map((z) => <option key={z} value={z}>{z}%</option>)}
        </select>
        <Sep />
        <select className={sel + " w-[118px]"} aria-label="Gaya paragraf" value={st.h} onChange={(e) => (e.target.value === "p" ? c().setParagraph().run() : c().setHeading({ level: Number(e.target.value) as 1 | 2 | 3 }).run())}>
          <option value="p">Teks normal</option><option value="1">Judul 1</option><option value="2">Judul 2</option><option value="3">Judul 3</option>
        </select>
        <Sep />
        <select className={sel + " w-[124px]"} aria-label="Font" value={st.font} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}>
          <option value="">Font bawaan</option>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <Sep />
        <B label="Perkecil huruf" onClick={() => setSize(size - 1)}><Minus className="size-3.5" /></B>
        <input className="h-7 w-10 shrink-0 rounded-md border border-[#E7E9ED] text-center text-[13px]" aria-label="Ukuran huruf" value={st.size ? size : ""} placeholder="15" inputMode="numeric"
          onChange={(e) => { const n = parseInt(e.target.value); if (n >= 8 && n <= 72) setSize(n); }} />
        <B label="Perbesar huruf" onClick={() => setSize(size + 1)}><Plus className="size-3.5" /></B>
        <Sep />
        <B label="Tebal (Ctrl+B)" on={st.bold} onClick={() => c().toggleBold().run()}><Bold className="size-4" /></B>
        <B label="Miring (Ctrl+I)" on={st.italic} onClick={() => c().toggleItalic().run()}><Italic className="size-4" /></B>
        <B label="Garis bawah (Ctrl+U)" on={st.underline} onClick={() => c().toggleUnderline().run()}><Underline className="size-4" /></B>
        <B label="Coret" on={st.strike} onClick={() => c().toggleStrike().run()}><Strikethrough className="size-4" /></B>
        <label className={btn + " relative cursor-pointer"} title="Warna teks" aria-label="Warna teks">
          <span className="text-[15px] font-bold leading-none" style={{ borderBottom: "3px solid " + st.color }}>A</span>
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={/^#[0-9a-f]{6}$/i.test(st.color) ? st.color : "#202328"} onChange={(e) => c().setColor(e.target.value).run()} />
        </label>
        <label className={btn + " relative cursor-pointer"} title="Warna sorotan" aria-label="Warna sorotan">
          <Highlighter className="size-4" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" defaultValue="#fff59d" onChange={(e) => c().setHighlight({ color: e.target.value }).run()} />
        </label>
        <Sep />
        <B label="Sisipkan / ubah link (Ctrl+K)" on={st.link} onClick={() => setLink(String(ed.getAttributes("link").href || "https://"))}><Link2 className="size-4" /></B>
        <B label="Tambah komentar pada teks terpilih" disabled={st.empty} onClick={() => { const { from, to } = ed.state.selection; onComment(ed.state.doc.textBetween(from, to, " ").slice(0, 300)); }}><MessageSquarePlus className="size-4" /></B>
        <B label="Sisipkan foto" on={pick} onClick={() => setPick(!pick)}><ImagePlus className="size-4" /></B>
        <B label="Tabel" on={tbl || st.table} onClick={() => setTbl(!tbl)}><Table2 className="size-4" /></B>
        <B label="Garis pemisah" onClick={() => c().setHorizontalRule().run()}><span className="text-[15px] leading-none">—</span></B>
        <Sep />
        <B label="Rata kiri" on={st.align === "left"} onClick={() => c().setTextAlign("left").run()}><AlignLeft className="size-4" /></B>
        <B label="Rata tengah" on={st.align === "center"} onClick={() => c().setTextAlign("center").run()}><AlignCenter className="size-4" /></B>
        <B label="Rata kanan" on={st.align === "right"} onClick={() => c().setTextAlign("right").run()}><AlignRight className="size-4" /></B>
        <B label="Rata kanan-kiri" on={st.align === "justify"} onClick={() => c().setTextAlign("justify").run()}><AlignJustify className="size-4" /></B>
        <select className={sel} aria-label="Jarak baris" value={st.lh} onChange={(e) => (e.target.value ? c().setLineHeight(e.target.value).run() : c().unsetLineHeight().run())}>
          <option value="">Jarak baris</option>
          {["1", "1.15", "1.5", "2"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <Sep />
        <B label="Daftar centang" on={st.tl} onClick={() => c().toggleTaskList().run()}><ListChecks className="size-4" /></B>
        <B label="Daftar berbutir" on={st.bl} onClick={() => c().toggleBulletList().run()}><List className="size-4" /></B>
        <B label="Daftar bernomor" on={st.ol} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="size-4" /></B>
        <B label="Kurangi indentasi (daftar)" disabled={!st.lift} onClick={() => (ed.can().liftListItem("taskItem") ? c().liftListItem("taskItem").run() : c().liftListItem("listItem").run())}><IndentDecrease className="size-4" /></B>
        <B label="Tambah indentasi (daftar)" disabled={!st.sink} onClick={() => (ed.can().sinkListItem("taskItem") ? c().sinkListItem("taskItem").run() : c().sinkListItem("listItem").run())}><IndentIncrease className="size-4" /></B>
      </div>

      {find.open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#E7E9ED] px-3 py-1.5 text-[13px]">
          <input autoFocus className="h-8 w-56 max-w-full rounded-md border border-[#E7E9ED] px-2" placeholder="Cari di dokumen…" value={find.q}
            onChange={(e) => setFind({ ...find, q: e.target.value, i: -1, n: findAll(ed, e.target.value).length })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); } if (e.key === "Escape") setFind({ ...find, open: false }); }} />
          <span className="text-[#747B86]">{find.q ? (find.n ? `${Math.max(1, find.i + 1)} dari ${find.n}` : "Tidak ditemukan") : ""}</span>
          <B label="Sebelumnya" disabled={!find.n} onClick={() => go(-1)}><ChevronUp className="size-4" /></B>
          <B label="Berikutnya" disabled={!find.n} onClick={() => go(1)}><ChevronDown className="size-4" /></B>
          <B label="Tutup pencarian" onClick={() => setFind({ ...find, open: false })}><X className="size-4" /></B>
        </div>
      )}
      {link !== null && (
        <form className="flex flex-wrap items-center gap-2 border-t border-[#E7E9ED] px-3 py-1.5 text-[13px]" onSubmit={(e) => {
          e.preventDefault();
          const u = link.trim();
          if (!u || u === "https://") c().extendMarkRange("link").unsetLink().run();
          else if (/^(https?:\/\/|mailto:)/i.test(u)) c().extendMarkRange("link").setLink({ href: u }).run();
          else return;
          setLink(null);
        }}>
          <input autoFocus className="h-8 w-72 max-w-full rounded-md border border-[#E7E9ED] px-2" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Alamat link" />
          <button className="h-8 rounded-md bg-[#222428] px-3 text-white">Simpan link</button>
          {st.link && <button type="button" className="h-8 rounded-md border border-[#E7E9ED] px-3" onClick={() => { c().extendMarkRange("link").unsetLink().run(); setLink(null); }}>Hapus link</button>}
          <button type="button" className="h-8 px-2 text-[#747B86]" onClick={() => setLink(null)}>Batal</button>
          {!/^(https?:\/\/|mailto:)/i.test(link.trim()) && link.trim() && <span className="text-[#C34646]">Harus diawali https:// atau mailto:</span>}
        </form>
      )}
      {tbl && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E7E9ED] px-3 py-1.5 text-[13px]">
          {[
            ["Sisipkan tabel 3×3", () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), !st.table],
            ["+ Baris", () => c().addRowAfter().run(), st.table], ["+ Kolom", () => c().addColumnAfter().run(), st.table],
            ["Hapus baris", () => c().deleteRow().run(), st.table], ["Hapus kolom", () => c().deleteColumn().run(), st.table], ["Hapus tabel", () => c().deleteTable().run(), st.table],
          ].map(([l, f, ok]) => (
            <button key={l as string} type="button" disabled={!ok} className="h-8 rounded-md border border-[#E7E9ED] px-2.5 disabled:opacity-40" onMouseDown={(e) => e.preventDefault()} onClick={f as () => void}>{l as string}</button>
          ))}
          <B label="Tutup" onClick={() => setTbl(false)}><X className="size-4" /></B>
        </div>
      )}
      {pick && (
        <div className="border-t border-[#E7E9ED] px-3 py-2 text-[13px]">
          <div className="mb-1.5 flex items-center justify-between"><b>Sisipkan foto dari barang / kartu ini</b><B label="Tutup" onClick={() => setPick(false)}><X className="size-4" /></B></div>
          {media.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {media.map((m) => (
                <button key={m.ref} type="button" title={m.name} className="w-24 shrink-0 overflow-hidden rounded-md border border-[#E7E9ED] text-left hover:border-[#B5D916]" onClick={() => { c().insertContent({ type: "image", attrs: { src: m.src, alt: m.name.slice(0, 120), width: 280, ref: m.ref } }).run(); setPick(false); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.src} alt="" loading="lazy" className="h-24 w-24 object-cover" />
                  <span className="block truncate px-1.5 py-1 text-[11px] text-[#747B86]">{m.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[#747B86]">Belum ada foto yang terhubung dengan Content ID ini. Unggah foto ke folder barang/kartu di halaman File, lalu buka lagi.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Pratinjau hanya-baca (riwayat versi). */
export function ReadOnlyDoc({ content }: { content: unknown }) {
  const ext = useMemo(() => scriptExtensions(false), []);
  const ed = useEditor({ extensions: ext, content: content as object, editable: false, immediatelyRender: false, editorProps: { attributes: { class: "sdoc" } } });
  const last = useRef(content);
  useEffect(() => {
    if (ed && last.current !== content) {
      last.current = content;
      ed.commands.setContent(content as object, { emitUpdate: false });
    }
  }, [ed, content]);
  return <EditorContent editor={ed} />;
}
