import { describe, expect, it } from "vitest";

import { isLocalFileLink, parseFilePath, resolveLocalFileLink } from "../filepath";

const CWD = "/Users/me/proj";
const HOMEDIR = "/Users/me";

describe("parseFilePath — accepted prefixes", () => {
  it("absolute path returns the path as-is", () => {
    expect(parseFilePath("/abs/foo.ts")).toEqual({
      absolute: "/abs/foo.ts",
      cwd: undefined,
      row: undefined,
      col: undefined,
    });
  });

  it("absolute path under cwd is returned as-is (no folding)", () => {
    expect(parseFilePath("/Users/me/proj/src/x.ts", { cwd: CWD })).toEqual({
      absolute: "/Users/me/proj/src/x.ts",
      cwd: CWD,
      row: undefined,
      col: undefined,
    });
  });

  it("home-relative `~/...` is normalized to an absolute path via homedir", () => {
    expect(parseFilePath("~/.zshrc", { cwd: CWD, homedir: HOMEDIR })).toEqual({
      absolute: "/Users/me/.zshrc",
      cwd: CWD,
      row: undefined,
      col: undefined,
    });
  });

  it("explicit-relative `./` resolves against cwd", () => {
    expect(parseFilePath("./src/x.ts", { cwd: CWD })).toEqual({
      absolute: "/Users/me/proj/src/x.ts",
      cwd: CWD,
      row: undefined,
      col: undefined,
    });
  });

  it("explicit-relative `../` resolves lexically against cwd", () => {
    expect(parseFilePath("../foo.ts", { cwd: "/p/sub" })).toEqual({
      absolute: "/p/sub/../foo.ts",
      cwd: "/p/sub",
      row: undefined,
      col: undefined,
    });
  });

  it("workspace-relative resolves against cwd", () => {
    expect(parseFilePath("src/x.ts", { cwd: CWD })).toEqual({
      absolute: "/Users/me/proj/src/x.ts",
      cwd: CWD,
      row: undefined,
      col: undefined,
    });
  });

  it("trailing slash on cwd is tolerated", () => {
    expect(parseFilePath("src/x.ts", { cwd: "/p/" })).toEqual({
      absolute: "/p/src/x.ts",
      cwd: "/p/",
      row: undefined,
      col: undefined,
    });
  });

  it.each([
    ["~/.zshrc", { homedir: HOMEDIR }],
    ["~/.bashrc", { homedir: HOMEDIR }],
    ["~/.gitignore", { homedir: HOMEDIR }],
    ["~/.editorconfig", { homedir: HOMEDIR }],
    ["/var/log/events.ndjson", {}],
    ["/repo/.dockerignore", {}],
    ["/proj/.env.local", {}],
    ["~/.claude/projects/some.jsonl", { homedir: HOMEDIR }],
  ] as const)("dotfile or data format: %s", (input, opts) => {
    expect(parseFilePath(input, opts)).not.toBeNull();
  });
});

describe("parseFilePath — bare filename resolves against cwd", () => {
  it("root-level file like README.md resolves against cwd", () => {
    expect(parseFilePath("README.md", { cwd: CWD })).toEqual({
      absolute: "/Users/me/proj/README.md",
      cwd: CWD,
      row: undefined,
      col: undefined,
    });
  });

  it("bare filename keeps its position suffix", () => {
    expect(parseFilePath("README.md:10", { cwd: CWD })).toMatchObject({
      absolute: "/Users/me/proj/README.md",
      row: 10,
    });
  });

  it.each(["package.json", "tsconfig.json", "CHANGELOG.md", "index.ts", "main.go"])(
    "common bare filename resolves against cwd: %s",
    (input) => {
      expect(parseFilePath(input, { cwd: CWD })?.absolute).toBe(`${CWD}/${input}`);
    },
  );
});

describe("parseFilePath — non-ASCII (CJK, accented) paths", () => {
  const CN_CWD = "/Users/me/项目";

  it("absolute path with Chinese segments", () => {
    expect(parseFilePath("/Users/me/项目/src/文件.ts")?.absolute).toBe(
      "/Users/me/项目/src/文件.ts",
    );
  });

  it("workspace-relative with Chinese segments resolves against cwd", () => {
    expect(parseFilePath("src/中文.ts", { cwd: CN_CWD })?.absolute).toBe(
      "/Users/me/项目/src/中文.ts",
    );
  });

  it("explicit-relative Chinese path resolves against cwd", () => {
    expect(parseFilePath("./文档/说明.md", { cwd: CN_CWD })?.absolute).toBe(
      "/Users/me/项目/文档/说明.md",
    );
  });

  it("home-relative Chinese path resolves via homedir", () => {
    expect(parseFilePath("~/笔记/说明.md", { homedir: "/Users/me" })?.absolute).toBe(
      "/Users/me/笔记/说明.md",
    );
  });

  it("bare Chinese filename resolves against cwd", () => {
    expect(parseFilePath("项目说明.md", { cwd: CN_CWD })?.absolute).toBe(
      "/Users/me/项目/项目说明.md",
    );
  });

  it("Chinese path keeps its position suffix", () => {
    expect(parseFilePath("src/中文.ts:42", { cwd: CN_CWD })).toMatchObject({
      absolute: "/Users/me/项目/src/中文.ts",
      row: 42,
    });
  });

  it("accented Latin filename resolves against cwd", () => {
    expect(parseFilePath("café/menü.md", { cwd: CWD })?.absolute).toBe(`${CWD}/café/menü.md`);
  });
});

describe("parseFilePath — rejected", () => {
  it.each(["https://example.com/path.js", "http://localhost:3000/file.ts", "file:///abs/foo.ts"])(
    "URL with scheme: %s",
    (input) => {
      expect(parseFilePath(input)).toBeNull();
    },
  );

  it.each(["//cdn.example.com/script.ts", "//foo/bar.md", "//x.ts"])(
    "protocol-relative or // prefix: %s",
    (input) => {
      expect(parseFilePath(input)).toBeNull();
    },
  );

  it("workspace-relative without cwd", () => {
    expect(parseFilePath("src/foo.ts")).toBeNull();
  });

  it("workspace-relative with empty cwd", () => {
    expect(parseFilePath("src/foo.ts", { cwd: "" })).toBeNull();
  });

  it("workspace-relative with non-absolute cwd", () => {
    expect(parseFilePath("src/foo.ts", { cwd: "relative" })).toBeNull();
  });

  it("explicit-relative `./` without cwd", () => {
    expect(parseFilePath("./foo.ts")).toBeNull();
  });

  it("home-relative `~/` without homedir", () => {
    expect(parseFilePath("~/foo.ts")).toBeNull();
  });

  it("bare single-segment filename without cwd (cannot be resolved)", () => {
    expect(parseFilePath("foo.ts")).toBeNull();
    expect(parseFilePath("README.md")).toBeNull();
    expect(parseFilePath("package.json")).toBeNull();
  });

  it("bare `.env`-family token, even with cwd (process.env, import.meta.env are code, not files)", () => {
    expect(parseFilePath(".env", { cwd: CWD })).toBeNull();
    expect(parseFilePath("process.env", { cwd: CWD })).toBeNull();
    expect(parseFilePath("config.env", { cwd: CWD })).toBeNull();
  });

  it.each([
    "useState()",
    "obj.method()",
    "process.env.NODE_ENV",
    "text.replace(/^",
    "MY_CONSTANT",
    "npm install",
    "hello world",
    "1.2.3",
    "v2.0.0",
  ])("prose / identifiers: %s", (input) => {
    expect(parseFilePath(input)).toBeNull();
  });

  it.each(["look at /tmp/foo.ts", "open src/main.ts please", "/Users/me/My Project/foo.ts"])(
    "string containing whitespace is not a path token: %s",
    (input) => {
      expect(parseFilePath(input, { cwd: CWD })).toBeNull();
    },
  );

  it.each(["./guide.md#install", "./guide.md#foo.md", "/docs/api.md#section-2"])(
    "non-position `#anchor` belongs to the link, not the filename: %s",
    (input) => {
      expect(parseFilePath(input, { cwd: CWD })).toBeNull();
    },
  );
});

describe("resolveLocalFileLink", () => {
  it("distinguishes local href syntax even when cwd is unavailable", () => {
    expect(isLocalFileLink("./README.md")).toBe(true);
    expect(isLocalFileLink("assets/image.png")).toBe(true);
    expect(isLocalFileLink("src/index.ts:42:7")).toBe(true);
    expect(isLocalFileLink("https://example.com/file.ts")).toBe(false);
    expect(isLocalFileLink("#section")).toBe(false);
  });

  it("resolves explicit, parent, bare, and absolute local links", () => {
    expect(resolveLocalFileLink("./CLAUDE.md", { cwd: CWD })).toBe(`${CWD}/CLAUDE.md`);
    expect(resolveLocalFileLink("../package.json", { cwd: `${CWD}/packages` })).toBe(
      `${CWD}/packages/../package.json`,
    );
    expect(resolveLocalFileLink("assets/image.png", { cwd: CWD })).toBe(`${CWD}/assets/image.png`);
    expect(resolveLocalFileLink("/tmp/file without extension", { cwd: CWD })).toBe(
      "/tmp/file without extension",
    );
  });

  it("decodes URL-encoded local paths and strips supported position suffixes", () => {
    expect(resolveLocalFileLink("./My%20File.png", { cwd: CWD })).toBe(`${CWD}/My File.png`);
    expect(resolveLocalFileLink("src/index.ts:42:7", { cwd: CWD })).toBe(`${CWD}/src/index.ts`);
    expect(resolveLocalFileLink("src/index.ts#L42", { cwd: CWD })).toBe(`${CWD}/src/index.ts`);
    expect(resolveLocalFileLink("README.md:42", { cwd: CWD })).toBe(`${CWD}/README.md`);
  });

  it("strips supported position suffixes from explicit links regardless of extension", () => {
    expect(resolveLocalFileLink("./Makefile:42", { cwd: CWD })).toBe(`${CWD}/Makefile`);
    expect(resolveLocalFileLink("assets/image.png:42:7", { cwd: CWD })).toBe(
      `${CWD}/assets/image.png`,
    );
    expect(resolveLocalFileLink("Makefile#L42", { cwd: CWD })).toBe(`${CWD}/Makefile`);
    expect(resolveLocalFileLink("assets/image.png#L42C7", { cwd: CWD })).toBe(
      `${CWD}/assets/image.png`,
    );
  });

  it("does not include URL query or ordinary fragment suffixes in filesystem paths", () => {
    expect(isLocalFileLink("package.json?raw=1")).toBe(true);
    expect(resolveLocalFileLink("package.json?raw=1", { cwd: CWD })).toBeNull();
    expect(resolveLocalFileLink("package.json#section", { cwd: CWD })).toBeNull();
  });

  it.each([
    "https://example.com/file.ts",
    "mailto:test@example.com",
    "neo://project/open",
    "//example.com/file.ts",
    "#section",
    "",
  ])("rejects non-local href %o", (href) => {
    expect(resolveLocalFileLink(href, { cwd: CWD })).toBeNull();
  });

  it("requires cwd or homedir for non-absolute links", () => {
    expect(resolveLocalFileLink("README.md")).toBeNull();
    expect(resolveLocalFileLink("~/README.md", { homedir: HOMEDIR })).toBe(`${HOMEDIR}/README.md`);
  });
});

describe("parseFilePath — row/col", () => {
  it("`:line` → row only", () => {
    expect(parseFilePath("/p/foo.ts:42")).toMatchObject({ row: 42, col: undefined });
  });

  it("`:line:col` → row and col", () => {
    expect(parseFilePath("/p/foo.ts:42:3")).toMatchObject({ row: 42, col: 3 });
  });

  it("range `:line:col-line:col` keeps only the start (row, col)", () => {
    expect(parseFilePath("/p/foo.ts:42:3-48:9")).toMatchObject({ row: 42, col: 3 });
  });

  it("range `:line-line` keeps only the start (row, no col)", () => {
    expect(parseFilePath("/p/foo.ts:42-48")).toMatchObject({ row: 42, col: undefined });
  });

  it("en-dash range keeps only the start", () => {
    expect(parseFilePath("/p/foo.ts:42–48")).toMatchObject({ row: 42, col: undefined });
  });

  it("GitHub `#L42` → row", () => {
    expect(parseFilePath("/p/foo.ts#L42")).toMatchObject({ row: 42, col: undefined });
  });

  it("GitHub `#L42C3-L48C9` → row and col, range end dropped", () => {
    expect(parseFilePath("/p/foo.ts#L42C3-L48C9")).toMatchObject({ row: 42, col: 3 });
  });

  it("no suffix → row and col are undefined", () => {
    expect(parseFilePath("/p/foo.ts")).toMatchObject({ row: undefined, col: undefined });
  });

  it("absolute is suffix-stripped", () => {
    expect(parseFilePath("/p/foo.ts:42:3", { cwd: "/p" })?.absolute).toBe("/p/foo.ts");
  });
});
