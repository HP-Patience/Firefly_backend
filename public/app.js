const state = { items: [], filter: "all", status: "all", editingId: null, editingSourcePath: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "未发布";
const toast = (message) => { const item = document.createElement("div"); item.className = "toast-message"; item.textContent = message; $("#toast").append(item); requestAnimationFrame(() => item.classList.add("show")); setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 2600); };
const renderMarkdown = (source, sourcePath = null) => {
  const lines = String(source).replace(/\r/g, "").split("\n");
  const html = [];
  let inCode = false;
  let code = [];
  let list = false;
  const inline = (value) => {
    const tokens = [];
    const protect = (html) => { const token = `@@MDTOKEN${tokens.length}@@`; tokens.push(html); return token; };
    let result = escapeHtml(value)
      .replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']+)["'])?\)/g, (_, alt, url, title) => { const src = /^https?:\/\//i.test(url) || !sourcePath ? url : `/api/project/resource?file=${encodeURIComponent(sourcePath)}&asset=${encodeURIComponent(url)}`; return protect(`<img src="${src}" alt="${alt}" title="${title || ""}" loading="lazy">`); })
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+["']([^"']+)["'])?\)/g, (_, text, url, title) => protect(`<a href="${url}" title="${title || ""}" target="_blank" rel="noreferrer">${text}</a>`))
      .replace(/`([^`]+)`/g, (_, code) => protect(`<code>${code}</code>`))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
    return result.replace(/@@MDTOKEN(\d+)@@/g, (_, index) => tokens[Number(index)]);
  };
  const closeList = () => { if (list) { html.push("</ul>"); list = false; } };
  for (const line of lines) {
    if (line.startsWith("```")) { if (inCode) { html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); code = []; } inCode = !inCode; continue; }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { closeList(); const level = Math.min(heading[1].length + 1, 6); html.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (item) { if (!list) { html.push("<ul>"); list = true; } html.push(`<li>${inline(item[1])}</li>`); continue; }
    if (line.startsWith("> ")) { closeList(); html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue; }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return html.join("");
};
const refreshProject = async () => { const project = await fetch("/api/project").then((response) => response.json()); const connected = Boolean(project.path); $("#project-bar").classList.toggle("connected", connected); $("#header-connection").textContent = connected ? "已连接" : "未连接"; $("#project-name").textContent = connected ? "Firefly 已连接" : "尚未连接 Firefly"; $("#project-path").textContent = connected ? project.path : "选择博客项目文件夹后，即可读取真实文章、动态和图片资源"; $("#project-metrics").classList.toggle("hidden", !connected); $("#project-articles").textContent = project.articles || 0; $("#project-dynamics").textContent = project.dynamics || 0; $("#project-resources").textContent = project.resources || 0; $("#select-project").textContent = connected ? "更换文件夹" : "选择文件夹"; };
const refresh = async () => { await refreshProject(); state.items = await fetch("/api/content").then((response) => response.json()); render(); };
const render = () => {
  const query = $("#search").value.trim().toLowerCase();
  const visible = state.items.filter((item) => (state.filter === "all" || item.type === state.filter || (state.filter === "draft" && item.status === "draft")) && (state.status === "all" || item.status === state.status) && (!query || `${item.title} ${item.content}`.toLowerCase().includes(query)));
  $("#content-list").innerHTML = visible.length ? visible.map((item) => `<article class="content-row"><div><div class="content-meta"><span class="badge ${item.status}">${item.status === "published" ? "已发布" : "草稿"}</span><span>${item.type === "article" ? "文章" : "动态"}</span><span>${formatDate(item.updatedAt)}</span></div><div class="row-title">${escapeHtml(item.title)}</div><div class="row-description">${escapeHtml(item.description || item.content.replace(/[#*`]/g, "").slice(0, 120))}</div></div><div class="row-actions"><button data-action="preview" data-id="${item.id}">预览</button><button data-action="edit" data-id="${item.id}">编辑</button>${item.type === "article" ? `<button data-action="toggle" data-id="${item.id}">${item.status === "published" ? "撤回" : "发布"}</button>` : ""}<button data-action="delete" data-id="${item.id}">删除</button></div></article>`).join("") : `<div class="empty">还没有内容。<br />从一篇文章或一条动态开始今天的创作。</div>`;
  const count = (filter) => state.items.filter((item) => filter === "all" ? true : filter === "draft" ? item.status === "draft" : item.type === filter).length;
  $("#all-count").textContent = count("all"); $("#article-count").textContent = count("article"); $("#dynamic-count").textContent = count("dynamic"); $("#draft-count").textContent = count("draft"); $("#stat-total").textContent = count("all"); $("#stat-published").textContent = state.items.filter((item) => item.status === "published").length; $("#stat-drafts").textContent = count("draft"); $("#stat-latest").textContent = state.items[0] ? formatDate(state.items[0].updatedAt) : "暂无"; if ($("#content-count")) $("#content-count").textContent = `共 ${visible.length} 篇文章`;
};
const openEditor = (item = null) => { const meta = item?.frontmatter || {}; state.editingId = item?.id || null; state.editingSourcePath = item?.sourcePath || null; $("#editor-title").textContent = item ? "编辑内容" : "新建内容"; $("#file-source").textContent = item?.sourcePath ? item.sourcePath : "新内容将在连接的 Firefly 项目中创建"; $("#title").value = item?.title || ""; $("#description").value = item?.description || ""; $("#category").value = item?.category || ""; $("#tags").value = item?.tags?.join(", ") || ""; $("#published").value = meta.published || item?.publishedAt || ""; $("#updated").value = meta.updated || ""; $("#author").value = meta.author || ""; $("#image").value = meta.image || ""; $("#sourceLink").value = meta.sourceLink || ""; $("#pinned").checked = Boolean(meta.pinned); $("#comment").checked = meta.comment !== false; $("#location").value = meta.location || ""; $("#content").value = item?.content || ""; $("#markdown-preview").classList.add("hidden"); $("#content").classList.remove("hidden"); $("#preview-toggle").textContent = "预览"; document.querySelector(`input[name="type"][value="${item?.type || "article"}"]`).checked = true; updateTypeFields(); $("#editor-modal").classList.remove("hidden"); $("#title").focus(); };
const updateTypeFields = () => { const dynamic = document.querySelector('input[name="type"]:checked').value === "dynamic"; document.querySelectorAll(".article-only").forEach((element) => element.classList.toggle("hidden", dynamic)); document.querySelectorAll(".dynamic-only").forEach((element) => element.classList.toggle("hidden", !dynamic)); $("#title").required = !dynamic; $("#title-hint").textContent = dynamic ? "动态标题可选，用于后台识别" : "文章标题"; };
const save = async (status) => { const type = document.querySelector('input[name="type"]:checked').value; const metadata = { published: $("#published").value, updated: $("#updated").value, author: $("#author").value, image: $("#image").value, sourceLink: $("#sourceLink").value, pinned: $("#pinned").checked, comment: $("#comment").checked }; const payload = { type, title: $("#title").value, description: $("#description").value, category: $("#category").value, tags: $("#tags").value.split(",").map((tag) => tag.trim()).filter(Boolean), location: $("#location").value, content: $("#content").value, status, metadata }; const url = state.editingId ? `/api/content/${state.editingId}` : "/api/content"; const response = await fetch(url, { method: state.editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) return toast(result.error); $("#editor-modal").classList.add("hidden"); toast(status === "published" ? "已写入 Firefly，构建后前台生效" : "草稿已保存"); await refresh(); };
$("#new-button").onclick = () => openEditor(); $("#select-project").onclick = async () => { const button = $("#select-project"); button.disabled = true; button.textContent = "等待选择..."; try { const response = await fetch("/api/project/select", { method: "POST" }); const result = await response.json(); if (!response.ok) toast(result.error); else if (!result.cancelled) { toast("Firefly 项目连接成功"); await refresh(); } } catch { toast("无法打开文件夹选择器"); } finally { button.disabled = false; await refreshProject(); } }; $("#close-editor").onclick = () => $("#editor-modal").classList.add("hidden"); $("#editor-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#editor-modal").classList.add("hidden"); }; $("#save-draft").onclick = () => save("draft"); $("#editor-form").onsubmit = (event) => { event.preventDefault(); if (confirm("确认发布这条内容吗？它会写入 Firefly 源文件，并在下次构建后显示在前台。")) save("published"); }; $("#preview-toggle").onclick = async () => { const response = await fetch("/api/markdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: $("#content").value, sourcePath: state.editingSourcePath }) }); const result = await response.json(); $("#markdown-preview").innerHTML = result.html || escapeHtml(result.error || "预览失败"); $("#markdown-preview").classList.toggle("hidden"); $("#content").classList.toggle("hidden"); $("#preview-toggle").textContent = $("#content").classList.contains("hidden") ? "返回编辑" : "预览"; };
document.querySelectorAll("input[name=type]").forEach((input) => input.addEventListener("change", updateTypeFields));
document.querySelectorAll(".nav-item").forEach((button) => button.onclick = () => { state.filter = button.dataset.filter; document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button)); $("#page-title").textContent = button.textContent.trim().replace(/\d+$/, ""); render(); });
document.querySelectorAll(".tab").forEach((button) => button.onclick = () => { state.status = button.dataset.status; document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button)); render(); });
$("#search").oninput = render;
$("#asset-upload").onchange = async () => { const file = $("#asset-upload").files[0]; if (!file) return; if (!state.editingSourcePath) return toast("请先保存内容，再上传图片"); const form = new FormData(); form.append("sourcePath", state.editingSourcePath); form.append("file", file); const response = await fetch("/api/project/upload", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) return toast(result.error); $("#content").setRangeText(`![${file.name}](${result.path})`, $("#content").selectionStart, $("#content").selectionEnd, "end"); toast("图片已上传并插入正文"); };
const projectAction = async (url, options = {}) => { const response = await fetch(url, options); const result = await response.json(); if (!response.ok) return toast(result.error || result.output || "操作失败"); return result; };
$("#source-submit-push").onclick = async () => { const message = prompt("源码提交说明", "content: update from Firefly studio"); if (!message) return; const commit = await projectAction("/api/git/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); if (!commit) return; const push = await projectAction("/api/git/push", { method: "POST" }); if (push) toast("源码已提交并推送"); };
$("#run-build").onclick = async () => { const button = $("#run-build"); button.disabled = true; button.textContent = "构建中..."; const result = await projectAction("/api/project/build", { method: "POST" }); button.disabled = false; button.textContent = "执行构建"; if (result) toast("构建完成，dist 已更新"); };
$("#artifact-submit-push").onclick = async () => { const message = prompt("构建产物提交说明", "deploy: update dist"); if (!message) return; const commit = await projectAction("/api/git/artifact-commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); if (!commit) return; const push = await projectAction("/api/git/artifact-push", { method: "POST" }); if (push) toast("构建产物已提交并推送"); };
if (window.EventSource) { const events = new EventSource("/api/events"); events.addEventListener("content-changed", () => { refresh(); toast("检测到项目文件变化，内容已刷新"); }); }
$("#content-list").onclick = async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const item = state.items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "preview") { window.open(`/preview.html?id=${encodeURIComponent(item.id)}`, "_blank", "noopener"); return; }
  if (button.dataset.action === "edit") openEditor(item);
  if (button.dataset.action === "toggle") {
    const response = await fetch(`/api/content/${item.id}/${item.status === "published" ? "unpublish" : "publish"}`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return toast(result.error);
    await refresh();
    toast(item.status === "published" ? "内容已撤回" : "内容已发布");
  }
  if (button.dataset.action === "delete" && confirm(`确定删除“${item.title}”吗？此操作会删除项目中的源文件。`)) {
    const response = await fetch(`/api/content/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return toast(result.error);
    await refresh();
    toast("内容已删除");
  }
};
refresh();
$("#side-new").onclick = () => openEditor(); $("#side-build").onclick = () => $("#run-build").click(); $("#project-help").onclick = () => $("#project-help-modal").classList.remove("hidden"); $("#close-project-help").onclick = () => $("#project-help-modal").classList.add("hidden"); $("#project-help-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#project-help-modal").classList.add("hidden"); };
let remoteTarget = "source"; const openRemote = (target) => { remoteTarget = target; $("#remote-title").textContent = target === "artifact" ? "选择构建产物远程仓库" : "选择源码远程仓库"; $("#remote-url").value = ""; $("#remote-output").textContent = "等待操作..."; $("#remote-modal").classList.remove("hidden"); $("#remote-url").focus(); }; $("#source-remote").onclick = () => openRemote("source"); $("#artifact-remote").onclick = () => openRemote("artifact"); $("#close-remote").onclick = () => $("#remote-modal").classList.add("hidden"); $("#remote-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#remote-modal").classList.add("hidden"); }; const remoteRequest = async (path, payload) => { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, target: remoteTarget }) }); const result = await response.json(); $("#remote-output").textContent = result.output || result.error || "操作完成"; return response.ok; }; $("#remote-add").onclick = async () => { const ok = await remoteRequest("/api/git/remote/add", { alias: $("#remote-alias").value, url: $("#remote-url").value }); if (ok) toast("远程仓库已添加"); }; $("#remote-test").onclick = () => remoteRequest("/api/git/remote/test", {});
