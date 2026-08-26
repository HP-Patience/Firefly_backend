const state = { items: [], filter: "all", status: "all", sort: "desc", editingId: null, editingSourcePath: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "未发布";
const toast = (message) => { const item = document.createElement("div"); item.className = "toast-message"; item.textContent = message; $("#toast").append(item); requestAnimationFrame(() => item.classList.add("show")); setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 2600); };
const refreshProject = async () => { const project = await fetch("/api/project").then((response) => response.json()); const connected = Boolean(project.path); $("#project-bar").classList.toggle("connected", connected); $("#header-connection").textContent = connected ? "已连接" : "未连接"; $("#project-name").textContent = connected ? "Firefly 已连接" : "尚未连接 Firefly"; $("#project-path").textContent = connected ? project.path : "选择博客项目文件夹后，即可读取真实文章、动态和图片资源"; $("#project-metrics").classList.toggle("hidden", !connected); $("#project-articles").textContent = project.articles || 0; $("#project-dynamics").textContent = project.dynamics || 0; $("#project-resources").textContent = project.resources || 0; $("#select-project").textContent = connected ? "更换文件夹" : "选择文件夹"; };
const refresh = async () => { try { await refreshProject(); const response = await fetch("/api/content"); if (!response.ok) throw new Error("内容读取失败"); state.items = await response.json(); render(); } catch (error) { $("#content-list").innerHTML = `<div class="empty"><strong>无法读取项目内容</strong><span>${escapeHtml(error.message)}</span><button class="workflow-button" data-action="retry">重新加载</button></div>`; } };
const render = () => {
  const query = $("#search").value.trim().toLowerCase();
  const visible = state.items.filter((item) => (state.filter === "all" || item.type === state.filter || (state.filter === "draft" && item.status === "draft")) && (state.status === "all" || item.status === state.status) && (!query || `${item.title} ${item.content}`.toLowerCase().includes(query))).sort((a, b) => (new Date(a.updatedAt) - new Date(b.updatedAt)) * (state.sort === "asc" ? 1 : -1));
  $("#content-list").innerHTML = visible.length ? `<div class="content-table-head"><span>标题</span><span>状态</span><span>更新时间</span><span>类型</span><span>操作</span></div>${visible.map((item) => `<article class="content-row" data-id="${item.id}" tabindex="0"><div class="row-primary"><div class="row-title">${escapeHtml(item.title)}</div><div class="row-description">${escapeHtml(item.description || item.content.replace(/[#*`]/g, "").slice(0, 120))}</div></div><div class="row-status"><span class="badge ${item.status}">${item.status === "published" ? "已发布" : "草稿"}</span></div><time class="row-date">${formatDate(item.updatedAt)}</time><span class="row-type">${item.type === "article" ? "文章" : "动态"}</span><div class="row-actions"><button data-action="preview" data-id="${item.id}">预览</button><button data-action="edit" data-id="${item.id}">编辑</button>${item.type === "article" ? `<button data-action="toggle" data-id="${item.id}">${item.status === "published" ? "撤回" : "发布"}</button>` : ""}<button data-action="delete" data-id="${item.id}">删除</button></div></article>`).join("")}` : `<div class="empty"><strong>${query ? "没有匹配的内容" : "这里还没有内容"}</strong><span>${query ? "换一个关键词，或清空搜索条件。" : "创建一篇文章或动态，内容会直接保存到 Firefly 项目。"}</span>${query ? "" : '<button class="workflow-button" data-action="new">创建第一条内容</button>'}</div>`;
  const count = (filter) => state.items.filter((item) => filter === "all" ? true : filter === "draft" ? item.status === "draft" : item.type === filter).length;
  $("#all-count").textContent = count("all"); $("#article-count").textContent = count("article"); $("#dynamic-count").textContent = count("dynamic"); $("#draft-count").textContent = count("draft"); if ($("#content-count")) $("#content-count").textContent = `共 ${visible.length} 条内容`;
};
const openEditor = (item = null) => { const meta = item?.frontmatter || {}; state.editingId = item?.id || null; state.editingSourcePath = item?.sourcePath || null; $("#editor-title").textContent = item ? "编辑内容" : "新建内容"; $("#file-source").textContent = item?.sourcePath ? item.sourcePath : "新内容将在连接的 Firefly 项目中创建"; $("#title").value = item?.title || ""; $("#description").value = item?.description || ""; $("#category").value = item?.category || ""; $("#tags").value = item?.tags?.join(", ") || ""; $("#published").value = meta.published || item?.publishedAt || ""; $("#updated").value = meta.updated || ""; $("#author").value = meta.author || ""; $("#image").value = meta.image || ""; $("#sourceLink").value = meta.sourceLink || ""; $("#pinned").checked = Boolean(meta.pinned); $("#comment").checked = meta.comment !== false; $("#location").value = meta.location || ""; $("#content").value = item?.content || ""; $("#markdown-preview").classList.add("hidden"); $("#content").classList.remove("hidden"); $("#preview-toggle").textContent = "预览"; document.querySelector(`input[name="type"][value="${item?.type || "article"}"]`).checked = true; updateTypeFields(); $("#editor-modal").classList.remove("hidden"); $("#title").focus(); };
const updateTypeFields = () => { const dynamic = document.querySelector('input[name="type"]:checked').value === "dynamic"; document.querySelectorAll(".article-only").forEach((element) => element.classList.toggle("hidden", dynamic)); document.querySelectorAll(".dynamic-only").forEach((element) => element.classList.toggle("hidden", !dynamic)); $("#title").required = !dynamic; $("#title-hint").textContent = dynamic ? "动态标题可选，用于后台识别" : "文章标题"; };
const save = async (status) => { const type = document.querySelector('input[name="type"]:checked').value; const metadata = { published: $("#published").value, updated: $("#updated").value, author: $("#author").value, image: $("#image").value, sourceLink: $("#sourceLink").value, pinned: $("#pinned").checked, comment: $("#comment").checked }; const payload = { type, title: $("#title").value, description: $("#description").value, category: $("#category").value, tags: $("#tags").value.split(",").map((tag) => tag.trim()).filter(Boolean), location: $("#location").value, content: $("#content").value, status, metadata }; const url = state.editingId ? `/api/content/${state.editingId}` : "/api/content"; const response = await fetch(url, { method: state.editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) return toast(result.error); $("#editor-modal").classList.add("hidden"); toast(status === "published" ? "已写入 Firefly，构建后前台生效" : "草稿已保存"); await refresh(); };
$("#new-button").onclick = () => openEditor(); $("#select-project").onclick = async () => { const button = $("#select-project"); button.disabled = true; button.textContent = "等待选择..."; try { const response = await fetch("/api/project/select", { method: "POST" }); const result = await response.json(); if (!response.ok) toast(result.error); else if (!result.cancelled) { toast("Firefly 项目连接成功"); await refresh(); } } catch { toast("无法打开文件夹选择器"); } finally { button.disabled = false; await refreshProject(); } }; $("#close-editor").onclick = () => $("#editor-modal").classList.add("hidden"); $("#editor-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#editor-modal").classList.add("hidden"); }; $("#save-draft").onclick = () => save("draft"); $("#editor-form").onsubmit = async (event) => { event.preventDefault(); const confirmed = await askAction({ title: "发布内容", message: "内容会写入 Firefly 源文件，并在下次构建后显示在前台。", confirmText: "确认发布", kicker: "PUBLISH CONTENT" }); if (confirmed) save("published"); }; $("#preview-toggle").onclick = async () => { const response = await fetch("/api/markdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: $("#content").value, sourcePath: state.editingSourcePath }) }); const result = await response.json(); $("#markdown-preview").innerHTML = result.html || escapeHtml(result.error || "预览失败"); $("#markdown-preview").classList.toggle("hidden"); $("#content").classList.toggle("hidden"); $("#preview-toggle").textContent = $("#content").classList.contains("hidden") ? "返回编辑" : "预览"; };
document.querySelectorAll("input[name=type]").forEach((input) => input.addEventListener("change", updateTypeFields));
document.querySelectorAll(".nav-item").forEach((button) => button.onclick = () => { state.filter = button.dataset.filter; document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button)); $("#page-title").textContent = button.textContent.trim().replace(/\d+$/, ""); render(); });
document.querySelectorAll(".tab").forEach((button) => button.onclick = () => { state.status = button.dataset.status; document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === button)); render(); });
$("#search").oninput = render;
$("#sort-toggle").onclick = () => { state.sort = state.sort === "desc" ? "asc" : "desc"; $("#sort-toggle").innerHTML = state.sort === "desc" ? '<i class="ph ph-sort-descending" aria-hidden="true"></i>按更新时间（降序）' : '<i class="ph ph-sort-ascending" aria-hidden="true"></i>按更新时间（升序）'; render(); };
$("#asset-upload").onchange = async () => { const file = $("#asset-upload").files[0]; if (!file) return; if (!state.editingSourcePath) return toast("请先保存内容，再上传图片"); const form = new FormData(); form.append("sourcePath", state.editingSourcePath); form.append("file", file); const response = await fetch("/api/project/upload", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) return toast(result.error); $("#content").setRangeText(`![${file.name}](${result.path})`, $("#content").selectionStart, $("#content").selectionEnd, "end"); toast("图片已上传并插入正文"); };
const projectAction = async (url, options = {}) => { const response = await fetch(url, options); const result = await response.json(); if (!response.ok) return toast(result.error || result.output || "操作失败"); return result; };
const managementOutput = (message) => { $("#management-output").textContent = message || "操作完成"; };
const appendManagementOutput = (text) => { const output = $("#management-output"); output.textContent += text; output.scrollTop = output.scrollHeight; };
const streamAction = async (action, payload = {}, button = null, successMessage = "命令执行完成") => {
  const original = button?.innerHTML;
  const managementButtons = [...document.querySelectorAll(".management-actions button")];
  managementButtons.forEach((item) => { item.disabled = true; });
  managementOutput(`$ ${action}\n\n`);
  try {
    const response = await fetch("/api/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    if (!response.ok) { const error = await response.json(); throw new Error(error.error || "命令启动失败"); }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneEvent = null;
    const processLine = (line) => { if (!line.trim()) return; const event = JSON.parse(line); if (event.type === "output") appendManagementOutput(event.data); if (event.type === "done") doneEvent = event; };
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(processLine);
      if (done) break;
    }
    if (buffer) processLine(buffer);
    if (!doneEvent?.ok) { appendManagementOutput(`\n\n[失败，退出码 ${doneEvent?.code ?? 1}]`); toast("命令执行失败"); return false; }
    if ($("#management-output").textContent === `$ ${action}\n\n`) appendManagementOutput("（命令没有输出）");
    appendManagementOutput("\n\n[完成，退出码 0]");
    toast(successMessage);
    return true;
  } catch (error) {
    appendManagementOutput(`\n${error.message}\n\n[命令启动失败]`);
    toast(error.message);
    return false;
  } finally {
    managementButtons.forEach((item) => { item.disabled = false; });
    if (button) button.innerHTML = original;
  }
};
$("#source-status").onclick = () => streamAction("source-status", {}, $("#source-status"), "源码状态读取完成");
$("#source-add").onclick = () => streamAction("source-add", {}, $("#source-add"), "源码变更已加入暂存区");
$("#artifact-status").onclick = () => streamAction("artifact-status", {}, $("#artifact-status"), "产物状态读取完成");
$("#artifact-add").onclick = () => streamAction("artifact-add", {}, $("#artifact-add"), "构建产物已加入暂存区");
const askAction = ({ title, message, input = false, value = "", confirmText = "确认", danger = false, kicker = "CONFIRM ACTION" }) => new Promise((resolve) => { const dialog = $("#action-dialog"); dialog.returnValue = ""; $("#action-title").textContent = title; $("#action-message").textContent = message; $("#action-kicker").textContent = kicker; $("#action-input-wrap").classList.toggle("hidden", !input); $("#action-input").value = value; $("#action-confirm").textContent = confirmText; $("#action-confirm").classList.toggle("danger-button", danger); $("#action-confirm").classList.toggle("primary", !danger); dialog.showModal(); if (input) setTimeout(() => $("#action-input").select(), 0); dialog.onclose = () => resolve(dialog.returnValue === "confirm" ? (input ? $("#action-input").value.trim() : true) : null); });
$("#source-commit").onclick = async () => { const message = await askAction({ title: "提交源码", message: "提交当前暂存区中的源码变更。", input: true, value: "content: update from Firefly studio", confirmText: "创建提交", kicker: "GIT COMMIT" }); if (message) streamAction("source-commit", { message }, $("#source-commit"), "源码提交完成"); };
$("#source-push").onclick = () => streamAction("source-push", {}, $("#source-push"), "源码推送完成");
$("#run-check").onclick = () => streamAction("artifact-check", {}, $("#run-check"), "项目检查完成");
$("#run-build").onclick = () => streamAction("artifact-build", {}, $("#run-build"), "构建完成，dist 已更新");
$("#artifact-commit").onclick = async () => { const message = await askAction({ title: "提交构建产物", message: "提交 dist 仓库当前暂存区中的变更。", input: true, value: "deploy: update dist", confirmText: "创建提交", kicker: "GIT COMMIT" }); if (message) streamAction("artifact-commit", { message }, $("#artifact-commit"), "构建产物提交完成"); };
$("#artifact-push").onclick = () => streamAction("artifact-push", {}, $("#artifact-push"), "构建产物推送完成");
if (window.EventSource) { const events = new EventSource("/api/events"); events.addEventListener("content-changed", () => { refresh(); toast("检测到项目文件变化，内容已刷新"); }); }
$("#content-list").onclick = async (event) => {
  const button = event.target.closest("button");
  if (button?.dataset.action === "new") { openEditor(); return; }
  if (button?.dataset.action === "retry") { refresh(); return; }
  if (!button) { const row = event.target.closest(".content-row"); if (row?.dataset.id) location.href = `/editor.html?id=${encodeURIComponent(row.dataset.id)}`; return; }
  const item = state.items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "preview") { window.open(`/preview.html?id=${encodeURIComponent(item.id)}`, "_blank", "noopener"); return; }
  if (button.dataset.action === "edit") { location.href = `/editor.html?id=${encodeURIComponent(item.id)}`; return; }
  if (button.dataset.action === "toggle") {
    const response = await fetch(`/api/content/${item.id}/${item.status === "published" ? "unpublish" : "publish"}`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return toast(result.error);
    await refresh();
    toast(item.status === "published" ? "内容已撤回" : "内容已发布");
  }
  if (button.dataset.action === "delete" && await askAction({ title: "删除内容", message: `“${item.title}”的源文件会被永久删除。`, confirmText: "删除源文件", danger: true, kicker: "DELETE SOURCE FILE" })) {
    const response = await fetch(`/api/content/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return toast(result.error);
    await refresh();
    toast("内容已删除");
  }
};
$("#content-list").onkeydown = (event) => { if (event.key === "Enter" && event.target.matches(".content-row")) location.href = `/editor.html?id=${encodeURIComponent(event.target.dataset.id)}`; };
refresh();
$("#side-new").onclick = () => openEditor(); $("#project-help").onclick = () => $("#project-help-modal").classList.remove("hidden"); $("#close-project-help").onclick = () => $("#project-help-modal").classList.add("hidden"); $("#project-help-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#project-help-modal").classList.add("hidden"); };
let remoteTarget = "source"; const openRemote = (target) => { remoteTarget = target; $("#remote-title").textContent = target === "artifact" ? "选择构建产物远程仓库" : "选择源码远程仓库"; $("#remote-url").value = ""; $("#remote-output").textContent = "等待操作..."; $("#remote-modal").classList.remove("hidden"); $("#remote-url").focus(); }; $("#source-remote").onclick = () => openRemote("source"); $("#artifact-remote").onclick = () => openRemote("artifact"); $("#close-remote").onclick = () => $("#remote-modal").classList.add("hidden"); $("#remote-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#remote-modal").classList.add("hidden"); }; const remoteRequest = async (path, payload) => { const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, target: remoteTarget }) }); const result = await response.json(); $("#remote-output").textContent = result.output || result.error || "操作完成"; return response.ok; }; $("#remote-add").onclick = async () => { const ok = await remoteRequest("/api/git/remote/add", { alias: $("#remote-alias").value, url: $("#remote-url").value }); if (ok) toast("远程仓库已添加"); }; $("#remote-test").onclick = () => remoteRequest("/api/git/remote/test", {});
$("#remote-upstream").onclick = async () => { const alias = $("#remote-alias").value.trim() || "origin"; const confirmed = await askAction({ title: "绑定并首次推送", message: `将当前分支推送到 ${alias}，并设置为上游跟踪分支。`, confirmText: "绑定并推送", kicker: "GIT PUSH --SET-UPSTREAM" }); if (!confirmed) return; $("#remote-output").textContent = "正在绑定上游分支并推送..."; const ok = await remoteRequest("/api/git/remote/upstream", { alias }); if (ok) toast("上游分支已绑定并完成首次推送"); };
const openCodeManagement = (target) => { $("#source-management-section").classList.toggle("hidden", target !== "source"); $("#artifact-management-section").classList.toggle("hidden", target !== "artifact"); $("#management-output").textContent = "等待操作..."; $("#code-management-modal").classList.remove("hidden"); }; $("#source-manager").onclick = () => openCodeManagement("source"); $("#artifact-manager").onclick = () => openCodeManagement("artifact"); $("#close-code-management").onclick = () => $("#code-management-modal").classList.add("hidden"); $("#code-management-modal").onclick = (event) => { if (event.target === event.currentTarget) $("#code-management-modal").classList.add("hidden"); };
$("#action-dialog").onclick = (event) => { if (event.target === event.currentTarget) $("#action-dialog").close("cancel"); };
