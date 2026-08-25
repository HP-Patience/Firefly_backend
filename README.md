# Firefly 内容后台

本项目是一个仅供本地使用的 Firefly 内容创作后台，不包含登录、注册和权限系统。可以通过 Windows 文件夹选择器连接已有 Firefly 项目，直接读取和维护项目中的文章与动态文件。

## 启动

要求 Node.js 22 或更高版本：

```bash
cd C:\Users\wjx\Desktop\new_blog\Firefly_backend
npm run dev
```

然后访问 <http://127.0.0.1:8787/>。

## 功能

- 文章和动态两种内容类型
- 草稿保存、编辑、删除、发布和撤回
- Markdown 编辑与简单实时预览
- 文章描述、分类、标签
- 动态发布时间记录
- 标题/正文搜索和状态筛选
- 所有数据本地 JSON 持久化
- 选择并记住 Firefly 项目文件夹
- 扫描 `src/content/posts` 中的文章和关联图片
- 扫描 `src/content/dynamic` 中的动态
- 直接编辑 Firefly 项目中的 Markdown 源文件
- 使用 `marked` 进行编辑器和独立预览页的 Markdown 渲染
- 上传图片到当前文章目录的 `assets` 文件夹
- 监听 Firefly 内容目录并实时刷新后台
- 独立文章预览页
- Git 状态、提交和推送
- 源码仓库与构建产物仓库分开管理
- 发布前执行 Firefly `pnpm check` 和 `pnpm build`
- 原子写入、旧文件 `.bak` 备份和文件来源显示

连接项目后，新建或编辑的文章会直接写入 `src/content/posts`，已发布动态会写入 `src/content/dynamic`。动态草稿暂存在 `data/content.json`，发布时再写入 Firefly 项目。

## 两个 Git 仓库

- 源码仓库：`Firefly` → `https://github.com/HP-Patience/blog-firefly.git`
- 构建仓库：`Firefly/dist` → `https://github.com/HP-Patience/blog-firefly-dist.git`

侧栏中的“提交源码”和“上传源码”只操作源码仓库；“构建并上传”会运行构建，然后只提交和推送 `dist` 构建仓库。首次查看或上传构建产物时，后台会自动给 `dist` 初始化独立 Git 仓库并绑定构建远程。

编辑已有文件时会保留原 frontmatter 的字段顺序、注释和未编辑字段，只更新后台修改的字段。原文件写入前会保留为同名 `.bak` 文件。
