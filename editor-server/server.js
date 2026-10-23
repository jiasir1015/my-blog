#!/usr/bin/env node
/**
 * Local-only Markdown editor API for the Hugo blog.
 * Binds to 127.0.0.1 — do not expose to the network.
 */
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.EDITOR_PORT || 1314);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.join(ROOT, 'content');
const STATIC_ROOT = path.join(ROOT, 'static');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(STATIC_ROOT, 'images', 'uploads');
const EBOOK_DIR = path.join(STATIC_ROOT, 'ebooks');
const EBOOKS_DATA = path.join(ROOT, 'data', 'ebooks.json');

const IMAGE_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const UPLOAD_KINDS = {
  image: {
    dir: UPLOAD_DIR,
    urlPrefix: '/images/uploads/',
    staticPrefix: 'static/images/uploads/',
    publicRel: 'images/uploads',
    maxBytes: 12 * 1024 * 1024,
    mimes: IMAGE_MIME,
  },
  pdf: {
    dir: EBOOK_DIR,
    urlPrefix: '/ebooks/',
    staticPrefix: 'static/ebooks/',
    publicRel: 'ebooks',
    maxBytes: 80 * 1024 * 1024,
    mimes: { 'application/pdf': '.pdf' },
  },
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJsonBody(req) {
  return readBody(req).then((buf) => {
    const text = buf.toString('utf8');
    return text ? JSON.parse(text) : {};
  });
}

function sanitizeBaseName(rawName, fallback) {
  return (
    path
      .basename(rawName || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || fallback
  );
}

async function saveUniqueFile(dir, base, ext, buf) {
  await fsp.mkdir(dir, { recursive: true });
  let filename = `${base}${ext}`;
  let abs = path.join(dir, filename);
  let n = 1;
  while (fs.existsSync(abs)) {
    filename = `${base}-${n}${ext}`;
    abs = path.join(dir, filename);
    n += 1;
  }
  await fsp.writeFile(abs, buf);
  return { abs, filename };
}

/** Mirror into public/ so a long-running `hugo server` can serve new uploads immediately. */
async function mirrorToPublic(publicRel, filename, buf) {
  const dir = path.join(PUBLIC_ROOT, publicRel);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, filename), buf);
}

function mediaTypeFromExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    }[ext] || 'application/octet-stream'
  );
}

async function readEbooksIndex() {
  try {
    const raw = await fsp.readFile(EBOOKS_DATA, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function upsertEbookIndex(entry) {
  const list = await readEbooksIndex();
  const idx = list.findIndex((x) => x.url === entry.url);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  await fsp.mkdir(path.dirname(EBOOKS_DATA), { recursive: true });
  await fsp.writeFile(EBOOKS_DATA, JSON.stringify(list, null, 2) + '\n', 'utf8');
  return list;
}

async function listEbookFiles() {
  await fsp.mkdir(EBOOK_DIR, { recursive: true });
  const entries = await fsp.readdir(EBOOK_DIR, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.pdf')) continue;
    const abs = path.join(EBOOK_DIR, ent.name);
    const st = await fsp.stat(abs);
    files.push({
      name: ent.name,
      url: `/ebooks/${ent.name}`,
      path: `static/ebooks/${ent.name}`,
      size: st.size,
      mtime: st.mtime.toISOString(),
    });
  }
  files.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return files;
}

/** Resolve a content-relative path safely under CONTENT_ROOT. */
function resolveContentPath(relPath) {
  if (!relPath || typeof relPath !== 'string') {
    throw Object.assign(new Error('path is required'), { status: 400 });
  }
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('\0') || normalized.split('/').some((p) => p === '..')) {
    throw Object.assign(new Error('invalid path'), { status: 400 });
  }
  if (!normalized.endsWith('.md')) {
    throw Object.assign(new Error('only .md files are allowed'), { status: 400 });
  }
  const abs = path.resolve(CONTENT_ROOT, normalized);
  if (!abs.startsWith(CONTENT_ROOT + path.sep) && abs !== CONTENT_ROOT) {
    throw Object.assign(new Error('path escapes content root'), { status: 400 });
  }
  return { abs, rel: normalized };
}

async function walkMarkdown(dir, baseRel = '') {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await walkMarkdown(abs, rel)));
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      const st = await fsp.stat(abs);
      files.push({
        path: rel,
        name: ent.name,
        dir: baseRel || '.',
        size: st.size,
        mtime: st.mtime.toISOString(),
      });
    }
  }
  return files;
}

async function listDirs(dir, baseRel = '') {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const dirs = baseRel ? [baseRel] : ['.'];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
    dirs.push(...(await listDirs(path.join(dir, ent.name), rel)));
  }
  return dirs;
}

function defaultFrontMatter({ title, category }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tz = -now.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${hh}:${mm}`;
  const cat = category || 'Tech';
  return `+++
title = '${title.replace(/'/g, "''")}'
date = '${date}'
draft = false
categories = ['${cat}']
tags = []
ShowToc = true
TocOpen = true
+++

# ${title}

`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      return send(res, 204, '');
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/api/health') {
      return send(res, 200, { ok: true, contentRoot: CONTENT_ROOT });
    }

    if (req.method === 'GET' && pathname === '/api/files') {
      const files = await walkMarkdown(CONTENT_ROOT);
      files.sort((a, b) => a.path.localeCompare(b.path, 'zh'));
      return send(res, 200, { files });
    }

    if (req.method === 'GET' && pathname === '/api/dirs') {
      const dirs = await listDirs(CONTENT_ROOT);
      const postDirs = (await listDirs(path.join(CONTENT_ROOT, 'posts'), 'posts')).filter((d) => d !== 'posts');
      return send(res, 200, { dirs, postDirs });
    }

    if (req.method === 'GET' && pathname === '/api/file') {
      const { abs, rel } = resolveContentPath(url.searchParams.get('path'));
      if (!fs.existsSync(abs)) {
        return send(res, 404, { error: 'file not found' });
      }
      const content = await fsp.readFile(abs, 'utf8');
      return send(res, 200, { path: rel, content });
    }

    if (req.method === 'PUT' && pathname === '/api/file') {
      const body = await readJsonBody(req);
      const { abs, rel } = resolveContentPath(body.path);
      if (!fs.existsSync(abs)) {
        return send(res, 404, { error: 'file not found' });
      }
      if (typeof body.content !== 'string') {
        return send(res, 400, { error: 'content must be a string' });
      }
      await fsp.writeFile(abs, body.content, 'utf8');
      return send(res, 200, { ok: true, path: rel });
    }

    if (req.method === 'POST' && pathname === '/api/file') {
      const body = await readJsonBody(req);
      let relPath = body.path;
      if (!relPath) {
        const dir = (body.dir || 'posts').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const slug = (body.slug || body.title || 'untitled')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\u4e00-\u9fff._-]/gi, '')
          .replace(/\.md$/i, '');
        if (!slug) {
          return send(res, 400, { error: 'slug or title required' });
        }
        relPath = `${dir}/${slug}.md`;
      }
      const { abs, rel } = resolveContentPath(relPath);
      if (fs.existsSync(abs)) {
        return send(res, 409, { error: 'file already exists', path: rel });
      }
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      const content =
        typeof body.content === 'string'
          ? body.content
          : defaultFrontMatter({
              title: body.title || path.basename(rel, '.md'),
              category: body.category || path.basename(path.dirname(abs)),
            });
      await fsp.writeFile(abs, content, 'utf8');
      return send(res, 201, { ok: true, path: rel });
    }

    if (req.method === 'DELETE' && pathname === '/api/file') {
      const body = await readJsonBody(req);
      const { abs, rel } = resolveContentPath(body.path);
      if (!fs.existsSync(abs)) {
        return send(res, 404, { error: 'file not found' });
      }
      await fsp.unlink(abs);
      return send(res, 200, { ok: true, path: rel });
    }

    if (req.method === 'GET' && pathname === '/api/ebooks') {
      const files = await listEbookFiles();
      const index = await readEbooksIndex();
      return send(res, 200, { files, index });
    }

    // Serve uploaded media for admin preview (bypasses hugo static lag/404).
    // e.g. GET /media/images/uploads/foo.png
    if (req.method === 'GET' && pathname.startsWith('/media/')) {
      const rel = pathname.slice('/media/'.length).replace(/^\/+/, '');
      if (!rel || rel.includes('..') || rel.includes('\0')) {
        return send(res, 400, { error: 'invalid path' });
      }
      const allowed =
        rel.startsWith('images/uploads/') || rel.startsWith('ebooks/');
      if (!allowed || (!rel.includes('.') )) {
        return send(res, 403, { error: 'forbidden' });
      }
      const absStatic = path.join(STATIC_ROOT, rel);
      const absPublic = path.join(PUBLIC_ROOT, rel);
      const abs = fs.existsSync(absStatic)
        ? absStatic
        : fs.existsSync(absPublic)
          ? absPublic
          : null;
      if (!abs || !abs.startsWith(ROOT)) {
        return send(res, 404, { error: 'not found' });
      }
      const buf = await fsp.readFile(abs);
      res.writeHead(200, {
        'Content-Type': mediaTypeFromExt(rel),
        'Content-Length': buf.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      return res.end(buf);
    }

    async function handleUpload({ kind, mime, filename, buf, title }) {
      const conf = UPLOAD_KINDS[kind];
      if (!conf) throw Object.assign(new Error('unknown upload kind'), { status: 400 });
      const ext = conf.mimes[(mime || '').toLowerCase()];
      if (!ext) {
        throw Object.assign(new Error(`unsupported type for ${kind}`), { status: 400 });
      }
      if (!buf || !buf.length) {
        throw Object.assign(new Error('empty file'), { status: 400 });
      }
      if (buf.length > conf.maxBytes) {
        throw Object.assign(new Error(`file too large (max ${Math.floor(conf.maxBytes / 1024 / 1024)}MB)`), {
          status: 400,
        });
      }
      const base = sanitizeBaseName(filename, kind === 'pdf' ? `ebook-${Date.now()}` : `img-${Date.now()}`);
      const saved = await saveUniqueFile(conf.dir, base, ext, buf);
      // Keep public/ in sync — otherwise hugo server may 404 new static files.
      if (conf.publicRel) {
        await mirrorToPublic(conf.publicRel, saved.filename, buf);
      }
      const url = `${conf.urlPrefix}${saved.filename}`;
      const result = {
        ok: true,
        kind,
        url,
        path: `${conf.staticPrefix}${saved.filename}`,
        filename: saved.filename,
        size: buf.length,
      };
      if (kind === 'pdf') {
        await upsertEbookIndex({
          title: title || base.replace(/-/g, ' '),
          url,
          filename: saved.filename,
          size: buf.length,
          added: new Date().toISOString(),
        });
      }
      return result;
    }

    // Binary upload: POST /api/upload?kind=pdf|image&filename=xxx.pdf
    // Body = raw file bytes, Content-Type = mime
    if (req.method === 'POST' && pathname === '/api/upload') {
      const kind = (url.searchParams.get('kind') || 'image').toLowerCase();
      const filename = url.searchParams.get('filename') || '';
      const title = url.searchParams.get('title') || '';
      const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const buf = await readBody(req);
      const result = await handleUpload({ kind, mime, filename, buf, title });
      return send(res, 201, result);
    }

    // Legacy JSON/base64 image upload (kept for paste compatibility)
    if (req.method === 'POST' && pathname === '/api/image') {
      const body = await readJsonBody(req);
      const mime = (body.mime || '').toLowerCase();
      if (typeof body.data !== 'string' || !body.data) {
        return send(res, 400, { error: 'data (base64) is required' });
      }
      const b64 = body.data.replace(/^data:[^;]+;base64,/, '');
      let buf;
      try {
        buf = Buffer.from(b64, 'base64');
      } catch {
        return send(res, 400, { error: 'invalid base64 data' });
      }
      const result = await handleUpload({
        kind: 'image',
        mime,
        filename: body.filename || `paste-${Date.now()}`,
        buf,
      });
      return send(res, 201, result);
    }

    // JSON/base64 PDF upload
    if (req.method === 'POST' && pathname === '/api/pdf') {
      const body = await readJsonBody(req);
      const mime = (body.mime || 'application/pdf').toLowerCase();
      if (typeof body.data !== 'string' || !body.data) {
        return send(res, 400, { error: 'data (base64) is required' });
      }
      const b64 = body.data.replace(/^data:[^;]+;base64,/, '');
      let buf;
      try {
        buf = Buffer.from(b64, 'base64');
      } catch {
        return send(res, 400, { error: 'invalid base64 data' });
      }
      const result = await handleUpload({
        kind: 'pdf',
        mime,
        filename: body.filename || `ebook-${Date.now()}.pdf`,
        buf,
        title: body.title,
      });
      return send(res, 201, result);
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    const status = err.status || 500;
    send(res, status, { error: err.message || String(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[editor-api] http://${HOST}:${PORT}`);
  console.log(`[editor-api] content: ${CONTENT_ROOT}`);
  console.log(`[editor-api] open http://localhost:1313/admin/ (with hugo server)`);
});
