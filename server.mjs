import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const dataDir = join(root, "data");
const dataFile = join(dataDir, "content.json");
const settingsFile = join(dataDir, "settings.json");
const port = Number(process.env.PORT || 8787);

mkdirSync(dataDir, { recursive: true });
if (!existsSync(dataFile)) writeFileSync(dataFile, "[]\n", "utf8");
if (!existsSync(settingsFile)) writeFileSync(settingsFile, "{}\n", "utf8");

const readJson = (file, fallback) => {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
};
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
const readContent = () => readJson(dataFile, []);
const saveContent = (items) => writeJson(dataFile, items);
const readSettings = () => readJson(settingsFile, {});
const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
};
const body = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};
const slugify = (value) => value.trim().toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || "untitled";
const dateText = (value = new Date()) => {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const validateProject = (projectPath) => {
  const resolved = resolve(String(projectPath || "").trim());
  if (!existsSync(join(resolved, "package.json")) || !existsSync(join(resolved, "src", "content", "posts"))) throw new Error("所选目录不是有效的 Firefly 项目");
  return resolved;
};
const projectPath = () => {
  const configured = readSettings().projectPath;
  if (!configured || !existsSync(configured)) return null;
  return configured;
};
const walk = (directory, extensions, result = []) => {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, extensions, result);
    else if (extensions.includes(extname(entry.name).toLowerCase())) result.push(path);
  }
  return result;
};
const parseValue = (raw) => {
  const value = raw.trim();
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (value.startsWith("[") && value.endsWith("]")) {
    try { return JSON.parse(value.replace(/'/g, '"')); } catch { return value; }
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
};
const parseMarkdown = (file) => {
  const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) meta[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1));
  }
  return { meta, content: match[2].replace(/^\r?\n/, "") };
};
const yamlValue = (value, key) => {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (key === "published" && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(String(value))) return String(value);
  return JSON.stringify(String(value ?? ""));
};
const markdownText = (meta, content) => `---\n${Object.entries(meta).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => `${key}: ${yamlValue(value, key)}`).join("\n")}\n---\n\n${content.trim()}\n`;
const plainMarkdown = (content) => content
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[#>*_`~]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const projectId = (file, base) => `project-${Buffer.from(relative(base, file)).toString("base64url")}`;

const scanProject = () => {
  const base = projectPath();
  if (!base) return { path: null, items: [], resources: 0 };
  const postsDir = join(base, "src", "content", "posts");
  const dynamicsDir = join(base, "src", "content", "dynamic");
  const files = [...walk(postsDir, [".md", ".mdx"]), ...walk(dynamicsDir, [".md"])];
  const items = files.map((file) => {
    const { meta, content } = parseMarkdown(file);
    const type = file.startsWith(dynamicsDir) ? "dynamic" : "article";
    const stats = statSync(file);
    const published = String(meta.published || stats.birthtime.toISOString());
    const plainText = plainMarkdown(content);
    return {
      id: projectId(file, base), type,
      title: type === "dynamic" ? plainText.slice(0, 34) || "无文字动态" : String(meta.title || "未命名文章"),
      slug: relative(type === "dynamic" ? dynamicsDir : postsDir, file).replace(/\\/g, "/").replace(/\.(md|mdx)$/i, "").replace(/\/index$/, ""),
      description: String(meta.description || (type === "dynamic" ? plainText : "")), category: String(meta.category || ""), tags: Array.isArray(meta.tags) ? meta.tags : [], content,
      status: type === "article" && meta.draft === true ? "draft" : "published",
      publishedAt: published, createdAt: stats.birthtime.toISOString(), updatedAt: stats.mtime.toISOString(), sourcePath: file, frontmatter: meta
    };
  });
  const resources = walk(postsDir, [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]).length + walk(join(base, "public"), [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]).length;
  return { path: base, items, resources };
};
const writeProjectItem = (item, input, status) => {
  const meta = { ...item.frontmatter };
  if (item.type === "article") Object.assign(meta, { title: input.title.trim(), published: meta.published || dateText(), draft: status !== "published", description: input.description?.trim() || "", tags: input.tags || [], category: input.category?.trim() || "" });
  else Object.assign(meta, { published: meta.published || dateText(), pinned: meta.pinned || false });
  writeFileSync(item.sourcePath, markdownText(meta, input.content), "utf8");
};
const createProjectItem = (input, status) => {
  const base = projectPath();
  if (!base || (input.type === "dynamic" && status === "draft")) return null;
  const now = new Date();
  const directory = join(base, "src", "content", input.type === "dynamic" ? "dynamic" : "posts");
  mkdirSync(directory, { recursive: true });
  const filename = input.type === "dynamic" ? `${dateText(now).replace(/[-: ]/g, "").replace(/^(\d{8})(\d{6})$/, "$1-$2")}.md` : `${slugify(input.slug || input.title)}.md`;
  const file = join(directory, filename);
  if (existsSync(file)) throw new Error("同名内容已经存在，请修改标题后重试");
  const meta = input.type === "dynamic" ? { published: dateText(now), pinned: false } : { title: input.title.trim(), published: dateText(now).slice(0, 10), draft: status !== "published", description: input.description?.trim() || "", tags: input.tags || [], category: input.category?.trim() || "" };
  writeFileSync(file, markdownText(meta, input.content), "utf8");
  return scanProject().items.find((item) => item.sourcePath === file);
};

const api = async (req, res, pathname, url) => {
  if (pathname === "/api/project/resource" && req.method === "GET") {
    const base = projectPath();
    const source = resolve(String(url.searchParams.get("file") || ""));
    const asset = resolve(join(source ? source.replace(/[^\\/]+$/, "") : base, String(url.searchParams.get("asset") || "")));
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"].includes(extname(asset).toLowerCase());
    if (!base || !source.startsWith(base) || !asset.startsWith(base) || !allowed || !existsSync(asset)) return json(res, 404, { error: "资源不存在" });
    const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif" };
    res.writeHead(200, { "Content-Type": types[extname(asset).toLowerCase()], "Cache-Control": "no-store" });
    res.end(readFileSync(asset));
    return;
  }
  if (pathname === "/api/project" && req.method === "GET") {
    const project = scanProject();
    return json(res, 200, { path: project.path, articles: project.items.filter((item) => item.type === "article").length, dynamics: project.items.filter((item) => item.type === "dynamic").length, resources: project.resources });
  }
  if (pathname === "/api/project/connect" && req.method === "POST") {
    const input = await body(req);
    const path = validateProject(input.path);
    writeJson(settingsFile, { projectPath: path });
    return json(res, 200, { path });
  }
  if (pathname === "/api/project/select" && req.method === "POST") {
    const initial = projectPath() || root;
    const script = `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '选择 Firefly 项目文件夹'; $d.SelectedPath = '${initial.replace(/'/g, "''")}'; if ($d.ShowDialog() -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $d.SelectedPath }`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: true });
    if (!stdout.trim()) return json(res, 200, { cancelled: true });
    const path = validateProject(stdout.trim());
    writeJson(settingsFile, { projectPath: path });
    return json(res, 200, { path });
  }
  if (pathname === "/api/content" && req.method === "GET") {
    const items = [...scanProject().items, ...readContent()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return json(res, 200, items);
  }
  if (pathname === "/api/content" && req.method === "POST") {
    const input = await body(req);
    if ((!input.title?.trim() && input.type !== "dynamic") || !input.content?.trim()) return json(res, 400, { error: input.type === "dynamic" ? "动态正文不能为空" : "标题和正文不能为空" });
    const status = input.status === "published" ? "published" : "draft";
    const projectItem = createProjectItem(input, status);
    if (projectItem) return json(res, 201, projectItem);
    const now = new Date().toISOString();
    const title = input.title?.trim() || `动态 ${now.slice(0, 10)}`;
    const item = { id: crypto.randomUUID(), type: input.type === "dynamic" ? "dynamic" : "article", title, slug: slugify(input.slug || title), description: String(input.description || "").trim(), category: String(input.category || "").trim(), tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [], content: input.content, status, publishedAt: status === "published" ? now : null, createdAt: now, updatedAt: now };
    const items = readContent(); items.push(item); saveContent(items);
    return json(res, 201, item);
  }

  const match = pathname.match(/^\/api\/content\/([^/]+)(?:\/(publish|unpublish))?$/);
  if (!match) return json(res, 404, { error: "接口不存在" });
  const [, id, action] = match;
  const projectItem = scanProject().items.find((item) => item.id === id);
  if (projectItem) {
    if (action && req.method === "POST") {
      if (projectItem.type === "dynamic" && action === "unpublish") return json(res, 400, { error: "Firefly 动态不支持草稿状态，可以编辑或删除这条动态" });
      writeProjectItem(projectItem, projectItem, action === "publish" ? "published" : "draft");
      return json(res, 200, scanProject().items.find((item) => item.id === id));
    }
    if (!action && req.method === "PUT") {
      const input = await body(req);
      if ((!input.title?.trim() && input.type !== "dynamic") || !input.content?.trim()) return json(res, 400, { error: "标题或正文不能为空" });
      writeProjectItem(projectItem, input, input.status === "published" ? "published" : "draft");
      return json(res, 200, scanProject().items.find((item) => item.id === id));
    }
    if (!action && req.method === "DELETE") { unlinkSync(projectItem.sourcePath); return json(res, 200, { ok: true }); }
  }
  const items = readContent();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return json(res, 404, { error: "内容不存在" });
  if (action && req.method === "POST") {
    if (action === "publish" && projectPath()) {
      const exported = createProjectItem(items[index], "published");
      if (exported) { items.splice(index, 1); saveContent(items); return json(res, 200, exported); }
    }
    const now = new Date().toISOString(); items[index].status = action === "publish" ? "published" : "draft"; items[index].publishedAt = action === "publish" ? (items[index].publishedAt || now) : null; items[index].updatedAt = now; saveContent(items);
    return json(res, 200, items[index]);
  }
  if (!action && req.method === "PUT") {
    const input = await body(req); const previous = items[index]; const title = input.title?.trim() || previous.title; const status = input.status === "published" ? "published" : "draft";
    items[index] = { ...previous, ...input, id, title, status, publishedAt: status === "published" ? (previous.publishedAt || new Date().toISOString()) : null, updatedAt: new Date().toISOString() }; saveContent(items);
    return json(res, 200, items[index]);
  }
  if (!action && req.method === "DELETE") { items.splice(index, 1); saveContent(items); return json(res, 200, { ok: true }); }
  return json(res, 405, { error: "不支持的请求方法" });
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    try { await api(req, res, url.pathname, url); } catch (error) { json(res, 400, { error: error.message || "请求处理失败" }); }
    return;
  }
  const requested = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^[/\\]+/, "");
  const file = join(publicDir, requested);
  if (!file.startsWith(publicDir) || !existsSync(file)) return json(res, 404, { error: "页面不存在" });
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

server.listen(port, "127.0.0.1", () => console.log(`Firefly 内容后台运行于 http://127.0.0.1:${port}`));
