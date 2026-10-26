(() => {
  const API = localStorage.getItem('editorApi') || 'http://127.0.0.1:1314';

  const els = {
    apiStatus: document.getElementById('apiStatus'),
    fileList: document.getElementById('fileList'),
    recentSection: document.getElementById('recentSection'),
    recentList: document.getElementById('recentList'),
    fileFilter: document.getElementById('fileFilter'),
    editor: document.getElementById('editor'),
    preview: document.getElementById('preview'),
    panes: document.getElementById('panes'),
    currentPath: document.getElementById('currentPath'),
    saveStatus: document.getElementById('saveStatus'),
    wordCount: document.getElementById('wordCount'),
    btnNew: document.getElementById('btnNew'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnSave: document.getElementById('btnSave'),
    btnDelete: document.getElementById('btnDelete'),
    btnPreview: document.getElementById('btnPreview'),
    btnImage: document.getElementById('btnImage'),
    imageInput: document.getElementById('imageInput'),
    btnPdf: document.getElementById('btnPdf'),
    pdfInput: document.getElementById('pdfInput'),
    newDialog: document.getElementById('newDialog'),
    newForm: document.getElementById('newForm'),
    newTitle: document.getElementById('newTitle'),
    newSlug: document.getElementById('newSlug'),
    newDir: document.getElementById('newDir'),
    newCategory: document.getElementById('newCategory'),
    btnCancelNew: document.getElementById('btnCancelNew'),
  };

  let files = [];
  let currentPath = null;
  let dirty = false;
  let previewOn = true;
  let previewTimer = null;
  let saving = false;
  let autoSaveTimer = null;
  let idleSaveTimer = null;
  const AUTO_SAVE_INTERVAL_MS = 10000; // 定时自动保存
  const IDLE_SAVE_MS = 2500; // 停止输入后稍后保存
  const RECENT_FILE_LIMIT = 6;

  async function api(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  function formatTime(d = new Date()) {
    return d.toLocaleTimeString('zh-CN', { hour12: false });
  }

  function formatRecentTime(value) {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return '';
    const elapsed = Date.now() - time;
    if (elapsed < 60 * 1000) return '刚刚更新';
    if (elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / 60000)} 分钟前更新`;
    if (elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / 3600000)} 小时前更新`;
    return `更新于 ${new Date(time).toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    })}`;
  }

  function setDirty(v) {
    dirty = v;
    els.btnSave.disabled = !currentPath || !dirty || saving;
    if (!currentPath) {
      els.saveStatus.textContent = '';
      return;
    }
    if (saving) return;
    els.saveStatus.textContent = dirty ? '未保存 · 将自动保存' : els.saveStatus.textContent || '已保存';
  }

  function scheduleIdleSave() {
    clearTimeout(idleSaveTimer);
    if (!currentPath || !dirty) return;
    idleSaveTimer = setTimeout(() => {
      autoSave('idle').catch(() => {});
    }, IDLE_SAVE_MS);
  }

  function updateWordCount() {
    const text = els.editor.value || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    els.wordCount.textContent = `${chars} 字符 · ${words} 词`;
  }

  function decorateCodeBlocks(root) {
    root.querySelectorAll('pre code').forEach((block) => {
      const match = (block.className || '').match(/\blanguage-([^\s]+)/i);
      const label = match ? match[1] : '';
      const language = label.toLowerCase();
      const normalized = ({ 'c++': 'cpp', 'c#': 'csharp' })[language] || language;
      if (match) block.classList.replace(match[0], `language-${normalized}`);
      try {
        if (!normalized || hljs.getLanguage(normalized)) {
          hljs.highlightElement(block);
        }
      } catch (err) {
        console.warn('代码高亮失败', err);
      }
      const pre = block.parentElement;
      if (!pre || pre.querySelector('.lang-badge')) return;
      const lang = label || (block.className.includes('hljs') ? 'auto' : 'text');
      const badge = document.createElement('span');
      badge.className = 'lang-badge';
      badge.textContent = lang;
      pre.classList.add('code-block');
      pre.insertBefore(badge, pre.firstChild);
    });
  }

  function expandHugoShortcodes(md) {
    // {{< pdf src="/ebooks/x.pdf" title="书名" >}} → iframe preview
    return md.replace(
      /\{\{<\s*pdf\s+([^>]+?)\s*>\}\}/g,
      (_, attrs) => {
        const src = (attrs.match(/src=["']([^"']+)["']/) || [])[1] || '';
        const title = (attrs.match(/title=["']([^"']+)["']/) || [])[1] || 'PDF';
        const height = (attrs.match(/height=["']?(\d+)/) || [])[1] || '560';
        if (!src) return '';
        return `\n\n<div class="pdf-embed"><div class="pdf-embed__bar"><strong>${title}</strong></div><iframe class="pdf-embed__frame" src="${src}" title="${title}" height="${height}"></iframe></div>\n\n`;
      }
    ).replace(/\{\{<\s*ebooks\s*>\}\}/g, '\n\n<blockquote>电子书书库（站点 /ebooks/ 页面展示）</blockquote>\n\n');
  }

  /** Fix accidental line breaks inside ![alt](url) which break Markdown image syntax. */
  function normalizeImageMarkdown(md) {
    return md.replace(/!\[([^\]]*)\]\s*[\r\n]+\s*\(([^)\s]+)\)/g, '![$1]($2)');
  }

  function resolvePreviewSrc(src) {
    if (!src) return src;
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    // Prefer editor API media for local uploads — avoids hugo server 404 on new files.
    if (src.startsWith('/images/uploads/') || src.startsWith('/ebooks/')) {
      return `${API}/media${src}`;
    }
    if (src.startsWith('/')) return `${location.origin}${src}`;
    return `${location.origin}/${src.replace(/^\.\//, '')}`;
  }

  function fixPreviewImages(root) {
    root.querySelectorAll('img').forEach((img) => {
      const raw = img.getAttribute('src') || '';
      const abs = resolvePreviewSrc(raw);
      img.src = abs + (abs.includes('?') ? '&' : '?') + 't=' + Date.now();
      img.loading = 'eager';
      img.decoding = 'async';
      img.onerror = () => {
        // Fallback: try Hugo origin if media API failed
        if (raw.startsWith('/') && !img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = `${location.origin}${raw}?t=${Date.now()}`;
          return;
        }
        const tip = document.createElement('p');
        tip.className = 'img-error';
        tip.textContent = `图片加载失败：${raw || '(空路径)'}。请确认编辑服务在运行，或重新粘贴上传。`;
        img.replaceWith(tip);
      };
    });
  }

  function renderPreviewNow() {
    if (!previewOn) return;
    const raw = els.editor.value || '';
    let body = raw.replace(/^\+\+\+[\s\S]*?\+\+\+\s*/, '').replace(/^---[\s\S]*?---\s*/, '');
    body = normalizeImageMarkdown(body);
    body = expandHugoShortcodes(body);
    const scrollTop = els.preview.scrollTop;
    els.preview.innerHTML = marked.parse(body || '<p class="preview-empty">开始输入，右侧实时预览…</p>');
    decorateCodeBlocks(els.preview);
    fixPreviewImages(els.preview);
    els.preview.scrollTop = scrollTop;
    syncPreviewScroll();
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreviewNow, 80);
  }

  function syncPreviewScroll() {
    if (!previewOn) return;
    const editorMaxScroll = els.editor.scrollHeight - els.editor.clientHeight;
    const previewMaxScroll = els.preview.scrollHeight - els.preview.clientHeight;
    if (editorMaxScroll <= 0 || previewMaxScroll <= 0) {
      els.preview.scrollTop = 0;
      return;
    }
    els.preview.scrollTop = (els.editor.scrollTop / editorMaxScroll) * previewMaxScroll;
  }

  function renderFileList(filter = '') {
    const q = filter.trim().toLowerCase();
    const list = q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files;
    els.fileList.innerHTML = '';
    for (const f of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'file-item' + (f.path === currentPath ? ' active' : '');
      btn.textContent = f.path;
      btn.title = f.path;
      btn.addEventListener('click', () => openFile(f.path));
      els.fileList.appendChild(btn);
    }
  }

  function renderRecentList() {
    const recent = files
      .filter((file) => file.mtime)
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
      .slice(0, RECENT_FILE_LIMIT);
    els.recentSection.hidden = recent.length === 0;
    els.recentList.replaceChildren();

    for (const file of recent) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `recent-item${file.path === currentPath ? ' active' : ''}`;
      btn.title = `${file.path}\n${formatRecentTime(file.mtime)}`;

      const path = document.createElement('span');
      path.className = 'recent-path';
      path.textContent = file.path;
      const time = document.createElement('span');
      time.className = 'recent-time';
      time.textContent = formatRecentTime(file.mtime);
      btn.append(path, time);
      btn.addEventListener('click', () => openFile(file.path).catch((err) => alert(err.message || err)));
      els.recentList.appendChild(btn);
    }
  }

  function markFileRecentlyEdited(path) {
    const file = files.find((item) => item.path === path);
    if (!file) return;
    file.mtime = new Date().toISOString();
    renderRecentList();
  }

  async function checkHealth() {
    try {
      await api('/api/health');
      els.apiStatus.textContent = `编辑服务已连接 · ${API}`;
      els.apiStatus.className = 'hint ok';
      return true;
    } catch {
      els.apiStatus.textContent = `无法连接 ${API}，请先运行 ./start-dev.sh`;
      els.apiStatus.className = 'hint err';
      return false;
    }
  }

  async function loadFiles() {
    const data = await api('/api/files');
    files = data.files || [];
    renderRecentList();
    renderFileList(els.fileFilter.value);
  }

  async function loadDirs() {
    const data = await api('/api/dirs');
    const dirs = (data.dirs || []).filter((d) => d !== '.');
    els.newDir.innerHTML = '';
    for (const d of dirs) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (d === 'posts') opt.selected = true;
      els.newDir.appendChild(opt);
    }
    const preferred = dirs.find((d) => d.startsWith('posts/'));
    if (preferred) els.newDir.value = preferred;
  }

  function insertTabInEditor(unindent) {
    const el = els.editor;
    if (!el || el.disabled) return;
    const value = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const tab = '\t';
    const selected = value.slice(start, end);
    const useBlock = unindent || selected.includes('\n');

    if (!useBlock) {
      el.setRangeText(tab, start, end, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let rangeEnd = end;
    if (!(end > start && value[end - 1] === '\n')) {
      const nl = value.indexOf('\n', end);
      rangeEnd = nl === -1 ? value.length : nl;
    } else {
      rangeEnd = end - 1;
    }

    const block = value.slice(lineStart, rangeEnd);
    const lines = block.split('\n');
    let deltaStart = 0;
    let deltaEnd = 0;
    const next = lines.map((line, i) => {
      let nextLine = line;
      let delta = 0;
      if (unindent) {
        if (line.startsWith('\t')) {
          nextLine = line.slice(1);
          delta = -1;
        } else {
          const m = line.match(/^ {1,4}/);
          if (m) {
            nextLine = line.slice(m[0].length);
            delta = -m[0].length;
          }
        }
      } else {
        nextLine = tab + line;
        delta = 1;
      }
      if (i === 0) deltaStart = delta;
      deltaEnd += delta;
      return nextLine;
    }).join('\n');

    el.setRangeText(next, lineStart, rangeEnd, 'end');
    const newStart = Math.max(lineStart, start + deltaStart);
    const newEnd = Math.max(newStart, end + deltaEnd);
    el.setSelectionRange(newStart, newEnd);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertAtCursor(text) {
    const el = els.editor;
    // Keep inserted markdown on a single logical line (no internal newlines).
    const safe = String(text).replace(/\s*\n+\s*/g, ' ').trim();
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const needsNlBefore = before.length && !before.endsWith('\n');
    const needsNlAfter = after.length && !after.startsWith('\n');
    const chunk = `${needsNlBefore ? '\n' : ''}${safe}${needsNlAfter ? '\n' : ''}`;
    el.value = before + chunk + after;
    const pos = start + chunk.length;
    el.focus();
    el.setSelectionRange(pos, pos);
    setDirty(true);
    updateWordCount();
    renderPreviewNow();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function uniqueImageName(file) {
    const ext = ((file && file.type) || '').includes('jpeg')
      ? '.jpg'
      : ((file && file.type) || '').includes('gif')
        ? '.gif'
        : ((file && file.type) || '').includes('webp')
          ? '.webp'
          : '.png';
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const base = (file && file.name ? file.name : 'paste')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, '-')
      .replace(/^(image|screenshot|screen.?shot|untitled)$/i, 'paste')
      .slice(0, 40) || 'paste';
    return `${base}-${stamp}${ext}`;
  }

  async function uploadImageFile(file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      throw new Error('请选择图片文件');
    }
    els.saveStatus.textContent = '正在上传粘贴的图片…';
    const filename = uniqueImageName(file);
    const dataUrl = await fileToBase64(file);
    const data = await api('/api/image', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        mime: file.type || 'image/png',
        data: dataUrl,
      }),
    });
    // Wait a tick so Hugo static server can see the new file
    await new Promise((r) => setTimeout(r, 120));
    insertAtCursor(`![image](${data.url})`);
    els.saveStatus.textContent = `已插入图片 ${data.url}（可 Cmd/Ctrl+S 保存）`;
    return data;
  }

  async function uploadBinary(file, kind) {
    const qs = new URLSearchParams({
      kind,
      filename: file.name || `${kind}-${Date.now()}`,
      title: (file.name || '').replace(/\.pdf$/i, ''),
    });
    const res = await fetch(`${API}/api/upload?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || (kind === 'pdf' ? 'application/pdf' : 'application/octet-stream') },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function uploadPdfFile(file) {
    const isPdf =
      file &&
      (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
    if (!isPdf) throw new Error('请选择 PDF 文件');
    els.saveStatus.textContent = '上传 PDF 中…';
    const data = await uploadBinary(file, 'pdf');
    const title = (file.name || data.filename || 'ebook').replace(/\.pdf$/i, '');
    insertAtCursor(`{{< pdf src="${data.url}" title="${title}" >}}`);
    els.saveStatus.textContent = `已插入 PDF ${data.url}（已加入电子书库）`;
    return data;
  }

  async function uploadImageFiles(fileList) {
    const list = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    els.saveStatus.textContent = '上传图片中…';
    for (const file of list) {
      await uploadImageFile(file);
    }
  }

  async function uploadPdfFiles(fileList) {
    const list = Array.from(fileList || []).filter(
      (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')
    );
    if (!list.length) return;
    for (const file of list) {
      await uploadPdfFile(file);
    }
  }

  async function openFile(relPath) {
    if (dirty && !confirm('有未保存的修改，确定切换？')) return;
    const data = await api(`/api/file?path=${encodeURIComponent(relPath)}`);
    currentPath = data.path;
    els.currentPath.textContent = currentPath;
    els.editor.value = data.content;
    els.editor.scrollTop = 0;
    els.preview.scrollTop = 0;
    els.editor.disabled = false;
    els.btnDelete.disabled = false;
    els.btnImage.disabled = false;
    els.btnPdf.disabled = false;
    setDirty(false);
    updateWordCount();
    renderPreviewNow();
    renderRecentList();
    renderFileList(els.fileFilter.value);
  }

  async function saveFile({ silent = false } = {}) {
    if (!currentPath || saving) return false;
    if (!dirty && silent) return false;
    saving = true;
    els.btnSave.disabled = true;
    if (!silent) els.saveStatus.textContent = '保存中…';
    else els.saveStatus.textContent = '自动保存中…';
    try {
      await api('/api/file', {
        method: 'PUT',
        body: JSON.stringify({ path: currentPath, content: els.editor.value }),
      });
      markFileRecentlyEdited(currentPath);
      dirty = false;
      els.btnSave.disabled = true;
      els.saveStatus.textContent = silent
        ? `已自动保存 ${formatTime()}`
        : `已保存 ${formatTime()} · Hugo 会自动刷新`;
      return true;
    } catch (err) {
      els.saveStatus.textContent = `保存失败：${err.message || err}`;
      els.btnSave.disabled = !dirty;
      if (!silent) throw err;
      return false;
    } finally {
      saving = false;
      els.btnSave.disabled = !currentPath || !dirty;
    }
  }

  async function autoSave(reason) {
    if (!currentPath || !dirty || saving) return;
    await saveFile({ silent: true });
  }

  async function deleteFile() {
    if (!currentPath) return;
    if (!confirm(`确定删除 ${currentPath}？`)) return;
    await api('/api/file', {
      method: 'DELETE',
      body: JSON.stringify({ path: currentPath }),
    });
    currentPath = null;
    els.currentPath.textContent = '未选择文件';
    els.editor.value = '';
    els.editor.disabled = true;
    els.btnDelete.disabled = true;
    els.btnImage.disabled = true;
    els.btnPdf.disabled = true;
    setDirty(false);
    renderPreviewNow();
    await loadFiles();
  }

  function slugify(title) {
    return title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fff._-]/gi, '');
  }

  async function createFile(ev) {
    ev.preventDefault();
    const title = els.newTitle.value.trim();
    const slug = els.newSlug.value.trim() || slugify(title);
    const dir = els.newDir.value;
    const category = els.newCategory.value.trim() || dir.split('/').pop();
    const data = await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ title, slug, dir, category }),
    });
    els.newDialog.close();
    els.newForm.reset();
    await loadFiles();
    await openFile(data.path);
  }

  function togglePreview() {
    previewOn = !previewOn;
    els.preview.classList.toggle('hidden', !previewOn);
    els.panes.classList.toggle('split', previewOn);
    els.btnPreview.textContent = previewOn ? '隐藏预览' : '显示预览';
    if (previewOn) renderPreviewNow();
  }

  // Events
  els.editor.addEventListener('input', () => {
    setDirty(true);
    updateWordCount();
    schedulePreview();
    scheduleIdleSave();
  });

  els.editor.addEventListener('scroll', syncPreviewScroll, { passive: true });

  // Auto-heal accidentally split image markdown: ![alt]\n(url)
  els.editor.addEventListener('blur', () => {
    const fixed = normalizeImageMarkdown(els.editor.value);
    if (fixed !== els.editor.value) {
      const pos = els.editor.selectionStart;
      els.editor.value = fixed;
      els.editor.setSelectionRange(pos, pos);
      setDirty(true);
      renderPreviewNow();
      scheduleIdleSave();
    }
  });

  els.editor.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveFile().catch((err) => alert(err.message || err));
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      insertTabInEditor(e.shiftKey);
    }
  });

  // 定时自动保存（有未保存修改时）
  autoSaveTimer = setInterval(() => {
    autoSave('interval').catch(() => {});
  }, AUTO_SAVE_INTERVAL_MS);

  // Paste screenshot / copied image → upload → insert markdown
  function collectClipboardImages(clipboardData) {
    const images = [];
    if (!clipboardData) return images;
    if (clipboardData.files && clipboardData.files.length) {
      for (const f of clipboardData.files) {
        if (f.type && f.type.startsWith('image/')) images.push(f);
      }
    }
    const items = clipboardData.items;
    if (items) {
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) images.push(file);
        }
      }
    }
    // de-dupe by size+type (paste often exposes both files and items)
    const seen = new Set();
    return images.filter((f) => {
      const key = `${f.type}:${f.size}:${f.name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  els.editor.addEventListener('paste', (e) => {
    const images = collectClipboardImages(e.clipboardData);
    if (!images.length) return;
    e.preventDefault();
    e.stopPropagation();
    uploadImageFiles(images).catch((err) => alert(err.message || String(err)));
  });

  // Drag & drop images onto editor
  els.editor.addEventListener('dragover', (e) => {
    if ([...e.dataTransfer.types].includes('Files')) {
      e.preventDefault();
      els.editor.classList.add('drag-over');
    }
  });
  els.editor.addEventListener('dragleave', () => els.editor.classList.remove('drag-over'));
  els.editor.addEventListener('drop', (e) => {
    els.editor.classList.remove('drag-over');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    const pdfs = [...files].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
    if (!images.length && !pdfs.length) return;
    e.preventDefault();
    Promise.resolve()
      .then(() => uploadImageFiles(images))
      .then(() => uploadPdfFiles(pdfs))
      .catch((err) => alert(err.message));
  });

  els.fileFilter.addEventListener('input', () => renderFileList(els.fileFilter.value));
  els.btnRefresh.addEventListener('click', () => loadFiles().catch(alert));
  els.btnSave.addEventListener('click', () => saveFile().catch(alert));
  els.btnDelete.addEventListener('click', () => deleteFile().catch(alert));
  els.btnPreview.addEventListener('click', togglePreview);

  els.btnImage.addEventListener('click', () => els.imageInput.click());
  els.imageInput.addEventListener('change', () => {
    uploadImageFiles(els.imageInput.files)
      .catch((err) => alert(err.message))
      .finally(() => {
        els.imageInput.value = '';
      });
  });

  els.btnPdf.addEventListener('click', () => els.pdfInput.click());
  els.pdfInput.addEventListener('change', () => {
    uploadPdfFiles(els.pdfInput.files)
      .catch((err) => alert(err.message))
      .finally(() => {
        els.pdfInput.value = '';
      });
  });

  els.btnNew.addEventListener('click', async () => {
    try {
      await loadDirs();
      els.newDialog.showModal();
      els.newTitle.focus();
    } catch (err) {
      alert(err.message);
    }
  });

  els.newTitle.addEventListener('input', () => {
    if (!els.newSlug.dataset.touched) {
      els.newSlug.value = slugify(els.newTitle.value);
    }
  });
  els.newSlug.addEventListener('input', () => {
    els.newSlug.dataset.touched = '1';
  });

  els.btnCancelNew.addEventListener('click', () => els.newDialog.close());
  els.newForm.addEventListener('submit', (e) => createFile(e).catch(alert));

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  renderPreviewNow();

  (async () => {
    const ok = await checkHealth();
    if (ok) {
      try {
        await loadFiles();
      } catch (err) {
        els.apiStatus.textContent = err.message;
        els.apiStatus.className = 'hint err';
      }
    }
  })();
})();
