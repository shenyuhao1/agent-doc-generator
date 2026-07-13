const fs = require("node:fs");
const path = require("node:path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const { createImageHelpers } = require("./doc-image-helpers.cjs");

const outputPath = path.resolve(__dirname, "agent-doc-generator-development-guide.docx");
const contentWidth = 9638;
const colors = {
  ink: "17212B",
  blue: "1769AA",
  green: "2F7D4A",
  amber: "A86400",
  red: "A33A3A",
  line: "CCD3DA",
  panel: "F6F8FA",
  muted: "59636E",
  white: "FFFFFF",
};
const border = { style: BorderStyle.SINGLE, size: 1, color: colors.line };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };
const { imageBlock } = createImageHelpers({
  manifestPath: path.resolve(__dirname, "doc-assets/images.json"),
  maxWidth: 650,
  maxHeight: 430,
  missingBehavior: "error",
});

function textRun(text, options = {}) {
  return new TextRun({
    text,
    font: options.font || "Microsoft YaHei",
    size: options.size || 21,
    bold: options.bold,
    italics: options.italics,
    color: options.color || colors.ink,
  });
}

function body(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.before || 60, after: options.after || 100, line: 360 },
    indent: options.indent,
    shading: options.shading,
    border: options.border,
    children: [textRun(text, options)],
  });
}

function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [textRun(text, { size: 34, bold: true, color: colors.blue })],
  });
}

function subheading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [textRun(text, { size: 27, bold: true })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function codeBlock(code) {
  return new Paragraph({
    spacing: { before: 100, after: 140, line: 300 },
    indent: { left: 260, right: 260 },
    shading: { fill: "EEF1F4", type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: colors.blue, space: 8 } },
    children: [textRun(code, { font: "Consolas", size: 18, color: "263544" })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "body-bullets", level },
    spacing: { before: 40, after: 70, line: 330 },
    children: [textRun(text)],
  });
}

function callout(title, text, accent, fill) {
  return new Paragraph({
    spacing: { before: 120, after: 150, line: 350 },
    indent: { left: 240, right: 240 },
    shading: { fill, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 14, color: accent, space: 10 } },
    children: [
      textRun(`${title}：`, { bold: true, color: accent }),
      textRun(text),
    ],
  });
}

function dialog(role, text, kind) {
  const isUser = kind === "user";
  return new Paragraph({
    spacing: { before: 90, after: 90, line: 340 },
    indent: { left: 220, right: 220 },
    shading: { fill: isUser ? "EEF7F1" : "EDF4FA", type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 10, color: isUser ? colors.green : colors.blue, space: 8 } },
    children: [
      textRun(`${role}：`, { bold: true, color: isUser ? colors.green : colors.blue }),
      textRun(text),
    ],
  });
}

function tableCell(text, width, options = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.LEFT,
        spacing: { before: 20, after: 20, line: 300 },
        children: [textRun(text, { size: 19, bold: options.bold, color: options.color })],
      }),
    ],
  });
}

function dataTable(headers, rows, widths) {
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) => tableCell(header, widths[index], {
          fill: colors.ink,
          color: colors.white,
          bold: true,
          alignment: AlignmentType.CENTER,
        })),
      }),
      ...rows.map((row, rowIndex) => new TableRow({
        children: row.map((value, index) => tableCell(value, widths[index], {
          fill: rowIndex % 2 === 0 ? colors.panel : colors.white,
        })),
      })),
    ],
  });
}

const children = [];

children.push(
  new Paragraph({ spacing: { before: 1700, after: 180 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [textRun("Agent Doc Generator 图片流水线", { size: 54, bold: true, color: colors.ink })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 900 },
    children: [textRun("开发文档", { size: 38, bold: true, color: colors.blue })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 180 },
    children: [textRun("从占位图模板到自动截图、清单驱动插图与 Codex 生图接口", { size: 25, color: colors.muted })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [textRun("使用 Agent Doc Generator 自身生成的自举文档", { size: 21, color: colors.muted })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [textRun("2026 年 7 月 13 日", { size: 20, color: colors.muted })],
  }),
  pageBreak()
);

children.push(
  heading("开发背景"),
  body("这次改造的目标很直接：让 Agent Doc Generator 不再只在文档里留下“此处插图”的占位框，而是能准备真实图片、自动截取网页状态、插入精确图解，并为 Codex 生图预留稳定入口。最后再用升级后的 skill 生成本文档，验证整条流程确实可用。"),
  dialog("用户", "我想让它在里面能自动插入图片，还希望能找到自动截图的工作流。", "user"),
  dialog("Codex", "把图片来源和 DOCX 生成分开：前者产出图片清单，后者只按稳定 ID 插图。", "codex"),
  subheading("原始状态"),
  dataTable(
    ["问题", "原始表现", "影响"],
    [
      ["图片只有占位框", "模板提供 imagePlaceholder()", "文档不能证明真实界面状态"],
      ["中文模板已乱码", "出现“鈥?”等错误字符串", "生成器照抄后会把乱码写进 DOCX"],
      ["缺少资产边界", "图片路径和正文代码混在一起", "难以复用、验证和重跑"],
      ["没有生图接口", "仅考虑人工截图", "概念解说图需要额外手工处理"],
    ],
    [2200, 3200, 4238]
  ),
  callout("关键判断", "乱码与图片损坏不是同一问题。前者来自文本编码错位，后者通常来自把图片字节当成 UTF-8 文本处理。", colors.red, "FBEFEF"),
  pageBreak()
);

children.push(
  heading("方案设计"),
  body("新流程把视觉资产分为四类，并要求它们最终都进入同一份 images.json。DOCX 生成器不关心图片最初来自哪里，只读取清单、二进制文件和题注。"),
  dataTable(
    ["来源", "适用场景", "处理方式"],
    [
      ["现有图片", "项目截图、图表、Logo、设计稿", "复制到 doc-assets"],
      ["真实界面截图", "功能完成后的网页或指定组件", "Playwright 自动截图"],
      ["精确图解", "架构、时序、数据流、带准确标签的图", "HTML/CSS/SVG/Mermaid 渲染后截图"],
      ["Codex 生图", "概念插画、教学示意、视觉隐喻", "生成后复制到工作区，再按普通文件入清单"],
    ],
    [2100, 3500, 4038]
  ),
  body("下面这张流程图并非手工贴入。Agent Doc Generator 的 prepare-images.mjs 打开本地 HTML，等待目标元素可见后截图，写入 images.json；本文档随后通过 imageBlock(\"pipeline\") 插入 PNG。"),
  ...imageBlock("pipeline", { required: true, maxWidth: 650, maxHeight: 420 }),
  callout("设计边界", "清单只保存路径和元数据，不保存 Base64。这样图片字节不会经过 JSON、控制台编码或文本替换。", colors.green, "EEF7F1"),
  pageBreak()
);

children.push(
  heading("自动截图流程"),
  body("prepare-images.mjs 读取 image-plan.json。遇到 screenshot 来源时，它使用 Playwright 打开 HTTP 页面、file URL 或本地 HTML，支持等待选择器、延迟、整页截图和元素截图。截图完成后，脚本直接读取 PNG 头部尺寸并生成清单。"),
  subheading("最小截图计划"),
  codeBlock('{ "id": "pipeline", "source": "screenshot", "url": "showcase.html", "selector": "#pipeline", "required": true }'),
  subheading("为什么保留计划文件"),
  bullet("截图可以重复执行，不需要凭记忆重新操作浏览器。"),
  bullet("视口、等待条件、选择器和题注都能接受代码审查。"),
  bullet("应用暂时无法启动时，可以保留计划，稍后在同一入口重试。"),
  bullet("真实 UI 截图与概念生图共享相同的下游插图逻辑。"),
  callout("本次实测", "本机通过缓存的 playwright-core 启动 Chrome，成功截取 1360 × 820 PNG，并生成 UTF-8 图片清单。", colors.blue, "EDF4FA")
);

children.push(
  heading("二进制安全插图"),
  body("此前最容易踩坑的地方，是把图片和中文文本放在同一条编码路径里。图片不是字符串。只要图片字节被按 UTF-8 解码，再转回 Buffer，原始内容就可能改变，Word 中会表现为损坏图片、空白框或无法打开。"),
  subheading("强制规则"),
  codeBlock('const data = fs.readFileSync(filePath);\nnew ImageRun({ type: "png", data, transformation, altText });'),
  dataTable(
    ["数据", "读取方式", "禁止操作"],
    [
      ["PNG/JPEG", "fs.readFileSync(path) → Buffer", "toString(\"utf8\")、文本替换、JSON 内联"],
      ["images.json", "fs.readFileSync(path, \"utf8\")", "依赖控制台默认代码页"],
      ["中文题注", "UTF-8 JavaScript/JSON 字符串", "从乱码模板复制错误字面量"],
    ],
    [1900, 3400, 4338]
  ),
  callout("回归样本", "本文档中的流程图使用中文题注。DOCX 能生成、验证并保留题注，说明文字和图片已经走两条独立的数据路径。", colors.green, "EEF7F1"),
  pageBreak()
);

children.push(
  heading("Codex 生图接口"),
  body("Codex 可以调用内置 imagegen 生成解释性位图。skill 不会让 prepare-images.mjs 直接调用模型，而是先由 Codex 生成和检查图片，再把选中的文件复制到文档工作区，最后以 source: \"generated\" 进入清单。这个边界让生图工具可以变化，而 DOCX 生成保持稳定。"),
  subheading("适合生图的内容"),
  bullet("概念性的流程隐喻或教学插画。"),
  bullet("不依赖精确界面状态的产品说明图。"),
  bullet("少文字或无文字的 infographic-diagram、scientific-educational、productivity-visual。"),
  subheading("不适合生图的内容"),
  bullet("需要逐字准确的架构标签、命令、代码和数据表。"),
  bullet("用于证明某个功能已经完成的真实界面。"),
  bullet("必须与现有 UI 像素级一致的截图。"),
  callout("选择原则", "要证明“系统现在是什么样”，用真实截图；要解释“概念如何理解”，可以用 Codex 生图；要保证标签准确，用代码化图解。", colors.amber, "FFF5E5")
);

children.push(
  heading("技能结构"),
  body("原技能只有一份已经乱码的 SKILL.md。改造后，主说明保持简短，重复执行的逻辑进入 scripts，详细图片规则进入 references，界面元数据进入 agents。"),
  codeBlock("agent-doc-generator/\n  SKILL.md\n  agents/openai.yaml\n  scripts/prepare-images.mjs\n  scripts/doc-image-helpers.cjs\n  references/image-workflow.md"),
  dataTable(
    ["文件", "职责"],
    [
      ["SKILL.md", "定义触发条件、核心流程、编码约束和失败处理"],
      ["prepare-images.mjs", "复制图片、自动截图、读取尺寸并生成清单"],
      ["doc-image-helpers.cjs", "按 ID 读取二进制图片、等比缩放、写入题注"],
      ["image-workflow.md", "保存计划格式、截图字段、生图规则和集成示例"],
      ["openai.yaml", "提供技能列表中的名称、简介和默认提示"],
    ],
    [3100, 6538]
  ),
  subheading("Codex 与 Claude Code"),
  body("SKILL.md、scripts 和 references 采用通用 Agent Skills 目录结构。放入 Codex 时可以使用内置 imagegen 和 agents/openai.yaml；放入 Claude Code 时使用 ~/.claude/skills/agent-doc-generator，并通过 /agent-doc-generator 调用。Node 截图与 DOCX 脚本无需改写，只有生图工具和技能目录变量需要按运行环境适配。"),
  pageBreak()
);

children.push(
  heading("自举验证"),
  body("这份文档本身就是验收样本。升级后的 Agent Doc Generator 准备流程图、生成清单、复制图片 helper、编写 gen_doc.js，并最终产出 DOCX。不是额外做一份展示稿，而是用目标工作流验证目标工作流。"),
  dataTable(
    ["检查项", "结果", "证据"],
    [
      ["技能结构校验", "通过", "quick_validate.py 返回 Skill is valid"],
      ["脚本语法", "通过", "两个 Node 脚本均通过 node --check"],
      ["自动截图", "通过", "生成 pipeline.png 与 images.json"],
      ["中文题注", "通过", "题注由 UTF-8 清单进入 DOCX"],
      ["二进制图片", "通过", "ImageRun 接收 fs.readFileSync 返回的 Buffer"],
      ["必需图片策略", "通过", "missingBehavior 设为 error"],
    ],
    [2700, 1500, 5438]
  ),
  subheading("运行命令"),
  codeBlock('npm install -D playwright-core\nnode prepare-images.mjs image-plan.json\n$env:NODE_PATH = npm root -g\nnode gen_doc.js'),
  callout("交付结果", "生成器、截图计划、图片清单、截图文件和最终 DOCX 位于同一展示目录，可以独立检查和重复执行。", colors.blue, "EDF4FA")
);

children.push(
  heading("使用边界"),
  body("这套流程没有把所有视觉工作都塞进一个脚本。截图需要浏览器，生图需要 Codex 的 imagegen 能力，DOCX 插图只依赖准备好的本地文件。拆开之后，每一段都能单独验证，也更容易定位错误。"),
  bullet("没有 Playwright 时，现有图片和 Codex 生图仍可正常进入文档。"),
  bullet("应用无法启动时，保留 image-plan.json，不伪造功能截图。"),
  bullet("必需图片缺失时停止生成，避免悄悄漏图。"),
  bullet("生图不可用时，优先改用代码化图解，而不是降低事实准确性。"),
  body("下一次扩展可以继续沿用同一边界，例如加入终端截图、移动端视口组、截图前操作步骤和图片压缩。下游 gen_doc.js 不需要随截图工具一起重写。", { after: 240 })
);

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Microsoft YaHei", size: 21, color: colors.ink } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 34, bold: true, font: "Microsoft YaHei", color: colors.blue },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 27, bold: true, font: "Microsoft YaHei", color: colors.ink },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "body-bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 560, hanging: 280 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: colors.line, space: 8 } },
              children: [
                textRun("Agent Doc Generator 开发文档  |  ", { size: 17, color: colors.muted }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 17, color: colors.muted }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated: ${outputPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
