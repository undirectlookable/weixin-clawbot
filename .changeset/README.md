# Changesets

这个仓库使用 Changesets 管理版本和 changelog。

## 什么时候需要 changeset

- 修改 `packages/*` 下的 public 包时，需要新增一个 `.changeset/*.md`
- 其他不影响 public 包发布内容的改动，不需要 changeset

## 如何创建

在仓库根目录运行：

```sh
pnpm changeset
```

按提示选择要发布的包和版本级别，然后提交生成的 `.changeset/*.md` 文件。

## PR 校验规则

- 非 version PR 且改动涉及 public 包时，PR 必须包含 `.changeset/*.md`
- PR 还需要通过 `pnpm changeset:status`
- 由 `changesets/action` 生成的 `Version Packages` PR 不要求额外附带 changeset

## 发布失败后如何重试

- `Publish NPM` workflow 默认会在 `Version Packages` PR 合并后自动触发
- 如果因为 npm Trusted Publishing、仓库权限或外部配置问题导致发布失败，修复配置后可以在 GitHub Actions 手动运行 `Publish NPM`
- 手动重试时，`ref` 建议填写已合并的 version PR merge commit SHA；如果要直接按当前 `main` 重试，也可以填写 `main`
