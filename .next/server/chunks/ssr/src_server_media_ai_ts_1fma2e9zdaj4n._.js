module.exports=[33911,a=>{"use strict";let b=process.env.AI_MODEL||"claude-sonnet-5-5",c=`Anda analis konten untuk Tirtonic, toko perlengkapan tenis di Yogyakarta. Tim media (Tirtonic Studio) membuat konten IDCC: konten Instagram untuk membantu menjual stok lama (stok yang lama tidak laku).
Data berasal dari laporan "Umur Persediaan" finance. Setiap barang sudah dikelompokkan per model; varian adalah ukuran, grip, atau warna.
Kolom: stok total, stok_lebih_90_hari (umur 91-120 dan >120 hari), stok_lebih_120_hari, umur_rata_hari (perkiraan), jumlah_varian.
Pedoman rekomendasi:
- "video": barang yang paling mendesak dan menarik ditunjukkan bergerak/dipakai (sepatu dan raket populer, stok lama banyak, banyak ukuran tersedia). Slot video IDCC hanya sekitar 1 per minggu, jadi pilih dengan ketat.
- "foto": layak diangkat tetapi cukup dengan foto (tas, raket atau sepatu dengan stok lama sedang).
- "keduanya": hanya untuk barang dengan stok lama sangat banyak.
- "pantau": stok lama sedikit, varian tinggal sisa ukuran yang sulit, atau sudah ada di pipeline.
Prioritas 1 = kerjakan minggu ini, 2 = dua minggu ke depan, 3 = bisa menunggu.
Tulis alasan singkat (maks. 25 kata) berdasarkan angka, dan ide konten konkret (maks. 20 kata) dalam Bahasa Indonesia santai-profesional. Jangan mengarang harga atau diskon.`,d=`Anda copywriter media sosial untuk Tirtonic, toko perlengkapan tenis di Yogyakarta.
Tulis isi caption Instagram berbahasa Indonesia yang santai, akrab, dan tetap informatif untuk satu postingan.
Struktur: satu kalimat pembuka yang menarik perhatian, lalu 2-4 baris keunggulan barang berdasarkan deskripsi (boleh diawali emoji yang relevan, secukupnya), lalu satu ajakan singkat.
Sesuaikan gaya dengan jenis konten: foto produk menonjolkan tampilan dan detail, video produk menonjolkan cara pakai/tampilan bergerak, video review mengajak menonton ulasan lengkap.
Jika gender ukuran diketahui (Men/Women/Unisex), sebutkan secara wajar.
Aturan penting: jangan mengarang spesifikasi, harga, diskon, stok, atau garansi yang tidak tertulis di deskripsi. Jangan menulis hashtag di dalam caption. Jangan menulis alamat, kontak, atau info toko karena sudah ada di template. Maksimal 900 karakter.
Berikan juga 5-8 hashtag spesifik barang (brand, seri, kategori, olahraga) tanpa tanda # dan tanpa spasi.`,e={name:"hasil_penilaian",description:"Kembalikan penilaian untuk SETIAP barang yang diberikan.",input_schema:{type:"object",properties:{items:{type:"array",items:{type:"object",properties:{id:{type:"string"},rekomendasi:{type:"string",enum:["video","foto","keduanya","pantau"]},prioritas:{type:"integer",enum:[1,2,3]},alasan:{type:"string"},ide_konten:{type:"string"}},required:["id","rekomendasi","prioritas","alasan","ide_konten"]}}},required:["items"]}},f={name:"ringkasan",description:"Ringkasan untuk admin media.",input_schema:{type:"object",properties:{ringkasan:{type:"string"}},required:["ringkasan"]}},g={name:"caption_instagram",description:"Isi caption dan hashtag untuk satu postingan.",input_schema:{type:"object",properties:{caption:{type:"string"},hashtag:{type:"array",items:{type:"string"}}},required:["caption","hashtag"]}};async function h(a,d,e,f=c){let g=process.env.ANTHROPIC_API_KEY;if(!g)throw Error("ANTHROPIC_API_KEY belum diatur di server.");let i=new AbortController,j=setTimeout(()=>i.abort(),55e3);try{let c=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:i.signal,headers:{"content-type":"application/json","x-api-key":g,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:b,max_tokens:e,system:f,tools:[a],tool_choice:{type:"tool",name:a.name},messages:[{role:"user",content:d}]})}),h=await c.json().catch(()=>({}));if(!c.ok)throw Error("AI menolak ("+c.status+"): "+(h.error?.message||""));let j=(h.content||[]).find(a=>"tool_use"===a.type);if(!j?.input)throw Error("AI tidak mengembalikan hasil terstruktur.");return j.input}finally{clearTimeout(j)}}async function i(a,b){let c=a.slice(0,25),d=`Laporan umur persediaan per ${b||"-"}.
Nilai ${c.length} barang berikut (JSON):
${JSON.stringify(c)}`,f=await h(e,d,6e3),g=new Set(c.map(a=>String(a.id)));return(f.items||[]).filter(a=>g.has(String(a.id)))}async function j(a,b){let c=`Hasil penilaian barang IDCC dari laporan per ${b||"-"} (JSON):
${JSON.stringify(a.slice(0,100))}

Tulis ringkasan 3-5 kalimat untuk admin media: berapa barang direkomendasikan per kategori, 3-5 barang paling mendesak dan alasannya, serta saran urutan pengerjaan minggu ini. Tanpa poin-poin, tanpa markdown.`;return(await h(f,c,1200)).ringkasan||""}async function k(a){let b=(a,b)=>String(a||"").slice(0,b),c=b(a.deskripsi,4e3);if(c.trim().length<20)throw Error("Deskripsi barang terlalu pendek.");let e=`Nama barang: ${b(a.nama,200)}
Jenis konten: ${b(a.jenis_konten,60)}
Kategori: ${b(a.kategori,40)}
Gender ukuran: ${b(a.gender,20)||"-"}
Catatan tim: ${b(a.catatan,500)||"-"}

Deskripsi dari toko online:
${c}`,f=await h(g,e,1500,d);return{caption:String(f.caption||"").slice(0,1500),hashtag:Array.isArray(f.hashtag)?f.hashtag.slice(0,10).map(String):[]}}a.s(["aiCaption",0,k,"aiNilai",0,i,"aiRingkas",0,j])}];

//# sourceMappingURL=src_server_media_ai_ts_1fma2e9zdaj4n._.js.map