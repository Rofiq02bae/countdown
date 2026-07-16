export default async function handler(req, res) {
  // CORS headers – allow same origin only in production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
  const BIN_ID     = process.env.JSONBIN_BIN_ID;
  const BIN_URL    = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

  if (!MASTER_KEY || !BIN_ID) {
    return res.status(500).json({ error: 'Server misconfigured: missing env vars.' });
  }

  // ── GET: ambil semua komentar ──────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${BIN_URL}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      if (!r.ok) throw new Error(`JSONBin GET failed: ${r.status}`);
      const data = await r.json();
      const comments = Array.isArray(data.record) ? data.record : [];
      return res.status(200).json({ comments });
    } catch (err) {
      console.error('[GET comments]', err);
      return res.status(502).json({ error: 'Gagal memuat komentar.' });
    }
  }

  // ── POST: tambah komentar baru ─────────────────────────
  if (req.method === 'POST') {
    try {
      const { name, color, initials, text, time } = req.body;

      // Validasi server-side
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Komentar tidak boleh kosong.' });
      }
      if (text.length > 500) {
        return res.status(400).json({ error: 'Komentar maksimal 500 karakter.' });
      }
      if (!name || typeof name !== 'string' || name.trim().length < 3) {
        return res.status(400).json({ error: 'Nama minimal 3 karakter.' });
      }

      // Ambil data terkini dulu (baca → tulis agar tidak conflict)
      const readRes = await fetch(`${BIN_URL}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      if (!readRes.ok) throw new Error(`JSONBin READ failed: ${readRes.status}`);
      const readData  = await readRes.json();
      const existing  = Array.isArray(readData.record) ? readData.record : [];

      const newComment = {
        id:       Date.now(),
        name:     name.trim().slice(0, 30),
        color:    color   || '#7c3aed',
        initials: initials || name.trim().slice(0, 2).toUpperCase(),
        text:     text.trim(),
        time:     time || new Date().toISOString()
      };

      const updated = [...existing, newComment];

      // Tulis kembali ke JSONBin
      const writeRes = await fetch(BIN_URL, {
        method:  'PUT',
        headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify(updated)
      });
      if (!writeRes.ok) throw new Error(`JSONBin WRITE failed: ${writeRes.status}`);

      return res.status(200).json({ success: true, comment: newComment });
    } catch (err) {
      console.error('[POST comment]', err);
      return res.status(502).json({ error: 'Gagal menyimpan komentar.' });
    }
  }

  // Method lain tidak didukung
  return res.status(405).json({ error: 'Method not allowed.' });
}
