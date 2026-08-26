# Firefly Hub

[![GitHub Stars](https://img.shields.io/github/stars/HP-Patience/Firefly_Hub?style=flat-square&logo=github)](https://github.com/HP-Patience/Firefly_Hub/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/HP-Patience/Firefly_Hub?style=flat-square&logo=github)](https://github.com/HP-Patience/Firefly_Hub/forks)
[![Contributors](https://img.shields.io/github/contributors/HP-Patience/Firefly_Hub?style=flat-square)](https://github.com/HP-Patience/Firefly_Hub/graphs/contributors)
[![Open Issues](https://img.shields.io/github/issues/HP-Patience/Firefly_Hub?style=flat-square)](https://github.com/HP-Patience/Firefly_Hub/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/HP-Patience/Firefly_Hub?style=flat-square)](https://github.com/HP-Patience/Firefly_Hub/pulls)
[![Last Commit](https://img.shields.io/github/last-commit/HP-Patience/Firefly_Hub?style=flat-square)](https://github.com/HP-Patience/Firefly_Hub/commits/main)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

Firefly Hub 是一个仅在本机运行的 Firefly 博客内容工作台，用于管理文章、动态、图片、源码仓库和静态构建产物。项目不包含登录、注册或权限系统。

## 界面预览

![Firefly Hub 首页](docs/images/homepage.png)

## 环境要求

- Windows
- Node.js 22 或更高版本
- 已安装 `git`
- 已安装 `pnpm`，用于检查和构建 Firefly

## 安装与启动

```powershell
git clone https://github.com/HP-Patience/Firefly_Hub.git
cd Firefly_Hub
npm install
npm run dev
```

访问 <http://127.0.0.1:8787/>。

生产式启动可使用：

```powershell
npm start
```

## 连接 Firefly 项目

点击左侧项目卡中的“选择文件夹”，选择 Firefly 根目录，例如：

```text
C:\Users\wjx\Desktop\new_blog\Firefly
```

后台会读取：

```text
src/content/posts/      文章和文章资源
src/content/dynamic/    动态
public/                 公共静态资源
dist/                   构建产物
```

项目路径保存在 `data/settings.json`，该文件不会提交到 Git。

## 内容管理

支持两种内容类型：

- 文章：支持草稿、发布、撤回、分类、标签和完整 frontmatter。
- 动态：支持正文、图片、位置、发布时间、发布和撤回。

主要功能：

- 按文章、动态和草稿筛选
- 搜索标题和正文
- 按更新时间升序或降序排列
- 点击内容行进入独立编辑器
- 创建、保存、发布、撤回和删除内容
- 外部文件变更后自动刷新列表

## Markdown 编辑器

独立编辑器采用左右双栏：

```text
左侧：完整 Markdown 源文件和行号
右侧：实时 Markdown 预览
```

编辑器支持：

- 标题、粗体、斜体和行内代码
- 无序列表和有序列表
- 链接、图片和表格
- 代码块、引用和分隔线
- KaTeX 行内公式 `$...$` 和块级公式 `$$...$$`
- 本地图片上传到当前文章目录的 `assets/`
- 编辑区与预览区同步滚动
- `Ctrl + S` 保存
- 浏览器原生 `Ctrl + Z` 撤销和 `Ctrl + Y` 恢复
- 使用系统默认外部编辑器打开源文件

Markdown 由 `marked` 渲染，数学公式由 `marked-katex-extension` 和与 Firefly 同版本的 `katex` 渲染。KaTeX 样式及字体、本地 Geist Variable 字体和 Phosphor Icons 均由后台本地提供，不依赖 CDN。

### 实时编辑预览

![Markdown 实时编辑预览](docs/images/live-editor-preview.png)

### 独立预览页

![文章独立预览页](docs/images/article-preview.png)

## 文件保存与备份

文章写入使用临时文件替换，避免写入过程中产生半截文件。

保存前的备份位于：

```text
Firefly_Hub/data/backups/
```

备份不会放进 Firefly 的 `src/content`，因此不会被 Astro 构建扫描。`data/backups/` 已加入后台仓库的 `.gitignore`。

## 源码与 dist 双仓库

Firefly Hub 将源码和构建产物作为两个独立 Git 仓库管理。

### 源码仓库

工作目录：

```text
Firefly/
```

典型远程：

```text
https://github.com/HP-Patience/blog-firefly.git
```

### 构建产物仓库

工作目录：

```text
Firefly/dist/
```

典型远程：

```text
https://github.com/HP-Patience/blog-firefly-dist.git
```

首次使用 dist 时，后台会将其初始化为独立 Git 仓库。

## 远程仓库配置

“选择远程仓库”弹窗提供三个操作：

```bash
git remote -v
git remote add <别名> <HTTPS 地址>
git push --set-upstream <别名> <当前分支>
```

它们的区别：

- `git remote add`：保存远程仓库地址。
- `git push --set-upstream`：完成首次推送，并绑定本地分支与远程分支。
- `git remote -v`：查看当前仓库配置的远程地址。

![远程仓库配置](docs/images/remote-repository.png)

## 代码文件管理

源码和 dist 各自提供独立命令按钮：

```bash
git status --short
git add -A
git commit
git push
```

这些按钮不会合并步骤：

1. `git status --short` 查看变更。
2. `git add -A` 将变更加入暂存区。
3. `git commit` 只提交已暂存内容。
4. `git push` 只推送已有提交。

首次源码推送如果没有 upstream，后台会自动执行 `git push --set-upstream`。

dist 推送会先执行 `git fetch`，再使用 `--force-with-lease` 更新构建仓库，避免使用无保护的强制推送。

![代码文件管理](docs/images/code-management.png)

## 检查与构建

两个命令已经拆分：

```bash
pnpm check
pnpm build
```

- `pnpm check` 只检查 Astro 项目。
- `pnpm build` 执行全量静态构建、图标生成和 Pagefind 索引。

当前 Firefly 是 Astro 静态输出模式，构建不会根据 Git diff 增量生成页面。实际耗时取决于文章数量、Markdown 插件和静态资源体积。

## 实时命令输出

代码管理弹窗中的 Git、检查和构建命令使用流式子进程执行：

- stdout 和 stderr 实时追加到输出框
- 自动滚动到最新输出
- 清理 ANSI 控制字符
- 显示最终退出码
- 执行期间禁用其它命令按钮，避免输出混合

## 本地数据

```text
data/content.json     尚未写入 Firefly 的本地草稿数据
data/settings.json    当前连接的 Firefly 路径
data/backups/         内容备份
```

`settings.json` 和 `backups/` 不会提交到后台远程仓库。

## 后台远程仓库

```text
https://github.com/HP-Patience/Firefly_Hub
```
