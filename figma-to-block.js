/**
 * Figma-to-WordPress Block Pipeline
 *
 * Usage: node figma-to-block.js
 *
 * Flow:
 *   1. Prompt for Figma file key + section name
 *   2. Extract design data from Figma API
 *   3. Send to Claude API to interpret → structured block schema
 *   4. Generate block/ folder from boilerplate templates
 *
 * Requires FIGMA_TOKEN env var (or paste inline below)
 * Requires ANTHROPIC_API_KEY env var (or paste inline below)
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Load .env file from theme root
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    });
}

// ─── Config ────────────────────────────────────────────────────────────
const FIGMA_TOKEN =
  process.env.FIGMA_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

if (!FIGMA_TOKEN) {
  console.error("❌ FIGMA_TOKEN is not set. Add it to your .env file.");
  process.exit(1);
}

if (!ANTHROPIC_API_KEY && !DEEPSEEK_API_KEY) {
  console.error("❌ Neither ANTHROPIC_API_KEY nor DEEPSEEK_API_KEY is set. Add one to your .env file.");
  process.exit(1);
}

// Which AI provider to use — auto-detect from available keys
const AI_PROVIDER = ANTHROPIC_API_KEY ? "anthropic" : DEEPSEEK_API_KEY ? "deepseek" : null;

const THEME_COLORS = {
  primary: "#EAE4D2",
  secondary: "#082640",
  tertiary: "#F15928",
  dark: "#000B14",
  light: "#FCF2EB",
  "light-2": "#F4EDDB",
  "light-3": "#FFFAEE",
  "light-yellow": "#EDD99C",
  transparent: "transparent",
  green: "#64B446",
  navy: "#0A4971",
  "cool-grey": "#E2F0F7",
  "dark-blue": "#0269A5",
  "dark-green": "#347D19",
  "light-green": "#64B446",
  teal: "#00353D",
  red: "#5d002a",
  "dark-purple": "#3F1669",
  beige: "#fcf2eb",
  orange: "#FF571D",
  blue: "#1751cb",
  yellow: "#e9c500",
  "light-purple": "#E8C7F8",
  purple: "#8d78ff",
  grey: "#D9D9D9",
  white: "#EAE4D2",
};

const THEME_FONTS = ["Inter"];

const SCREENS = { sm: "576px", md: "768px", lg: "992px", xl: "1200px", "2xl": "1400px" };

// ─── Helpers ──────────────────────────────────────────────────────────

function walkTree(node, depth = 0) {
  if (depth > 10) return null;
  const out = { name: node.name, type: node.type };

  if (node.characters) out.text = node.characters;

  if (node.style) {
    out.style = {
      fontFamily: node.style.fontFamily,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      lineHeightPx: node.style.lineHeightPx,
      lineHeightPercent: node.style.lineHeightPercent,
      letterSpacing: node.style.letterSpacing,
    };
  }

  if (node.fills && node.fills.length) {
    out.solidFills = node.fills
      .filter((f) => f.type === "SOLID")
      .map((f) => ({
        r: Math.round(f.color.r * 255),
        g: Math.round(f.color.g * 255),
        b: Math.round(f.color.b * 255),
        a: f.color.a,
      }));
    out.hasImage = node.fills.some((f) => f.type === "IMAGE");
  }

  if (node.absoluteBoundingBox) {
    out.bounds = {
      x: node.absoluteBoundingBox.x,
      y: node.absoluteBoundingBox.y,
      width: node.absoluteBoundingBox.width,
      height: node.absoluteBoundingBox.height,
    };
  }

  if (node.layoutMode) {
    out.layout = {
      mode: node.layoutMode,
      spacing: node.itemSpacing,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      primaryAlign: node.primaryAxisAlignItems,
      counterAlign: node.counterAxisAlignItems,
    };
  }

  if (node.children) {
    out.children = node.children.map((c) => walkTree(c, depth + 1)).filter(Boolean);
  }

  return out;
}

function isDecorGroup(node) {
  // A GROUP containing only VECTOR children = decorative illustration
  if (node.type !== "GROUP" || !node.children) return false;
  return node.children.every((c) => c.type === "VECTOR" || c.type === "GROUP");
}

function isPlaceholderContainer(node, sectionFill) {
  // Only a FRAME with a DIFFERENT fill from the section = image placeholder
  if (node.type !== "FRAME") return false;
  if (node.hasImage) return false;
  if (!node.solidFills || !node.solidFills.length) return false;

  // Skip if this frame's fill is the same as the section background
  if (sectionFill && node.solidFills.length) {
    const sf = sectionFill;
    const nf = node.solidFills[0];
    if (Math.abs(sf.r - nf.r) < 10 && Math.abs(sf.g - nf.g) < 10 && Math.abs(sf.b - nf.b) < 10) {
      return false; // same fill as section = section background, not a placeholder
    }
  }

  // Skip if this frame contains text children (it's a text block, not an image)
  const hasText = node.children?.some((c) => c.type === "TEXT" || (c.children && c.children.some((cc) => cc.type === "TEXT")));
  if (hasText) return false;

  // Must be a content-area frame (has layout, or is positioned within the section)
  return true;
}

function isButtonFrame(node) {
  // FRAME with text child, solid fill, and name containing "btn" or "cta"
  if (node.type !== "FRAME") return false;
  if (!node.solidFills || !node.solidFills.length) return false;
  const name = node.name.toLowerCase();
  if (!name.includes("btn") && !name.includes("cta") && !name.includes("button")) return false;
  return true;
}

function summarizeSection(tree) {
  const textNodes = [];
  const frames = [];
  const images = [];
  const placeholderContainers = [];
  const buttonFrames = [];
  const decorGroups = [];

  const sectionFill = tree.solidFills?.[0] || null;

  function crawl(node) {
    if (node.text) textNodes.push(node);
    if (node.hasImage || (node.type === "FRAME" && node.layout)) images.push(node);
    if (node.type === "FRAME" && node.layout) frames.push(node);
    if (isPlaceholderContainer(node, sectionFill)) placeholderContainers.push(node);
    if (isButtonFrame(node)) buttonFrames.push(node);
    if (isDecorGroup(node)) decorGroups.push(node);
    if (node.children) node.children.forEach(crawl);
  }
  crawl(tree);

  return {
    name: tree.name,
    type: tree.type,
    bounds: tree.bounds,
    layout: tree.layout,
    solidFills: tree.solidFills,
    hasImage: tree.hasImage,
    textNodes: textNodes.map((t) => ({
      text: t.text,
      style: t.style,
      color: t.solidFills,
      bounds: t.bounds,
    })),
    keyFrames: frames
      .filter((f) => f.layout)
      .map((f) => ({
        name: f.name,
        layout: f.layout,
        solidFills: f.solidFills,
        hasImage: f.hasImage,
        childCount: f.children?.length || 0,
      })),
    sectionBackground: sectionFill,
    placeholderContainers: placeholderContainers.map((p) => ({
      name: p.name,
      solidFills: p.solidFills,
      bounds: p.bounds,
      layout: p.layout,
      role: "content-image",
      hint: "This is a CONTENT IMAGE area (different fill from section background). Create an ACF image field. The fill color is a placeholder — use it as fallback background-color ONLY on this specific div, not on the whole section.",
    })),
    buttonFrames: buttonFrames.map((b) => ({
      name: b.name,
      solidFills: b.solidFills,
      layout: b.layout,
      bounds: b.bounds,
      label: b.children?.find((c) => c.text)?.text || "",
      hint: "This is a button. Match to closest theme btn class, or use bg-[#RRGGBB] arbitrary value.",
    })),
    decorGroups: decorGroups.map((d) => ({
      name: d.name,
      bounds: d.bounds,
      hint: "This is a decorative vector/group (shapes, waves, blobs). Create an optional ACF image field — developer must manually export from Figma.",
    })),
  };
}

// ─── Step 1: Fetch Figma file (once, reused for listing + extraction) ───

async function fetchFigmaFile(fileKey, { silent = false, retries = 3 } = {}) {
  if (!silent) console.log(`\n[1/4] Fetching Figma file ${fileKey}...`);

  const cachePath = path.join(__dirname, ".figma-cache", `${fileKey}.json`);
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=4`, {
        headers: { "X-Figma-Token": FIGMA_TOKEN },
      });

      if (res.status === 429 && attempt < retries) {
        const delay = attempt * 15;
        if (!silent) console.log(`   Rate limited, retrying in ${delay}s (attempt ${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, delay * 1000));
        continue;
      }

      if (!res.ok) throw new Error(`Figma API error: ${res.status} ${res.statusText}`);

      const data = await res.json();

      // Cache the response for next time
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(data));
      if (!silent) console.log(`   Cached to .figma-cache/`);

      return data;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        if (!silent) console.log(`   Retrying (attempt ${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  // Try cached fallback
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const age = Math.round((Date.now() - stat.mtimeMs) / 1000 / 60);
    console.log(`   ⚠ Using cached data from ${age}m ago (API rate limited)`);
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }

  throw lastError || new Error("Could not fetch Figma file");
}

function extractSection(fileData, sectionName) {
  // Collect all matches across canvases/frames, prefer 1440px desktop
  const matches = [];
  for (const canvas of fileData.document.children) {
    if (!canvas.children) continue;
    for (const frame of canvas.children) {
      if (!frame.children) continue;
      for (const section of frame.children) {
        if (section.name === sectionName && section.type === "FRAME") {
          matches.push({
            canvas: canvas.name,
            frame: frame.name,
            isDesktop1920: frame.name.includes("1920"),
          isDesktop1440: frame.name.includes("1440"),
            isDesktop: frame.name.includes("desktop"),
            node: section,
          });
        }
      }
    }
  }

  if (!matches.length) {
    const allSections = [];
    for (const canvas of fileData.document.children) {
      if (!canvas.children) continue;
      for (const frame of canvas.children) {
        if (!frame.children) continue;
        for (const section of frame.children) {
          if (section.type === "FRAME") allSections.push(section.name);
        }
      }
    }
    console.log("   Available sections:", allSections.join(", "));
    throw new Error(`Section "${sectionName}" not found in file.`);
  }

  // Prefer 1920px desktop, then 1440px, then any desktop, then first match
  const selected = matches.find((m) => m.isDesktop1920)
    || matches.find((m) => m.isDesktop1440)
    || matches.find((m) => m.isDesktop)
    || matches[0];

  if (matches.length > 1) {
    console.log(`   Found in ${matches.length} frames — using "${selected.frame}" (${selected.canvas})`);
  }

  const tree = walkTree(selected.node);
  const summary = summarizeSection(tree);
  console.log(`   Found "${sectionName}" — ${summary.textNodes.length} text nodes, ${summary.keyFrames.length} layout frames`);
  return { raw: tree, summary };
}

// ─── Step 2: AI interpretation ────────────────────────────────────────

function safeJsonParse(text, label) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json|js|javascript)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const errPos = parseInt(e.message.match(/position (\d+)/)?.[1]) || 0;
    console.error(`\n   JSON parse error in ${label}: ${e.message}`);
    console.error(`   Around error (position ${errPos}):`);
    console.error(`   ...${cleaned.slice(Math.max(0, errPos - 80), errPos + 120)}...\n`);

    // Try common LLM JSON fixes
    let fixed = cleaned.trim();

    // Fix 1: Missing commas between adjacent objects in arrays
    // Handles: "}\n{" , "}\n\n{" , "}  \n  {" , "]  \n  {"
    fixed = fixed.replace(/\}[ \t]*\n[ \t]*\n?[ \t]*\{/g, "},\n{");
    fixed = fixed.replace(/\][ \t]*\n[ \t]*\n?[ \t]*\{/g, "],\n{");
    fixed = fixed.replace(/\}[ \t]*\n[ \t]*\n?[ \t]*\]/g, "}\n]");
    fixed = fixed.replace(/\}[ \t]*\n[ \t]*\n?[ \t]*"/g, "},\n\"");

    // Fix 2: Trailing comma before closing bracket/brace
    fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

    // Fix 3: Missing comma between string values in array
    fixed = fixed.replace(/\"[ \t]*\n[ \t]*\n?[ \t]*\"/g, '",\n"');

    // Fix 4: Missing comma between number/boolean and next element
    fixed = fixed.replace(/(\d|true|false)\s*\n\s*\{/g, "$1,\n{");
    fixed = fixed.replace(/(\d|true|false)\s*\n\s*\"/g, "$1,\n\"");

    // Fix 5: Single quotes used instead of double quotes (common LLM mistake on values)
    // Only fix values, not keys — keys are usually fine
    fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');

    try {
      const result = JSON.parse(fixed);
      console.error(`   ✓ Auto-fixed JSON, proceeding.\n`);
      return result;
    } catch (e2) {
      throw new Error(`Failed to parse ${label} even after repair: ${e2.message}\nContext: ${cleaned.slice(Math.max(0, errPos - 100), errPos + 200)}`);
    }
  }
}

function buildPrompt(summary) {
  return `You are a WordPress block generator for a theme that uses:
- Timber/Twig templating
- Tailwind CSS 3.4 with fluid-tailwind plugin (fluid type scale: ~text-[min]/[max])
- ACF (Advanced Custom Fields) for block data
- The block is registered via register_block_type() from a block.json

Theme colors available:
${JSON.stringify(THEME_COLORS, null, 2)}

Theme fonts: ${THEME_FONTS.join(", ")}
Screens: ${JSON.stringify(SCREENS)}

Tailwind classes reference (matches tailwind.config.js + bf.json):
- Typography: font-inter (the only font-family registered in the Tailwind config)
- Text sizes: text-[16px], text-[18px], text-[20px] etc, or fluid: ~text-[1.875rem]/[3.75rem]
- Spacing: py-[Npx], px-[Npx], mb-[Npx], or fluid: ~px-[1.5rem]/[2rem]
- Colors: bg-{primary,secondary,tertiary,dark,light,light-2,light-3,light-yellow,green,navy,cool-grey,dark-blue,dark-green,light-green,teal,red,dark-purple,beige,orange,blue,yellow,light-purple,purple,grey,white} — all from bf.json
- Layout: flex, flex-col, flex-row, items-center, justify-between, gap-[Npx]
- Rounded: rounded-corners (8px), rounded-[25px]
- Container: container (max-w-[1342px] mx-auto with fluid px)

Match Figma colors to the closest theme color. If no close match exists, use an arbitrary value like bg-[#043873].

FIGMA SECTION DATA:
${JSON.stringify(summary, null, 2)}

Based on this Figma section, output using this EXACT format with NO extra text before or after:

===META===
{
  "blockName": "kebab-case-name",
  "blockTitle": "Human Readable Title",
  "acfFields": [
    {
      "name": "field_name",
      "label": "Field Label",
      "type": "text|textarea|image|link|select|true_false",
      "instructions": "Helper text",
      "default_value": ""
    }
  ],
  "customCss": "/* only if Tailwind can't handle it */",
  "jsLogic": "/* none, or brief description */"
}
===TEMPLATE===
<full twig template here — no escaping needed>
===END===

CRITICAL RULES:
- You MUST output ===META=== and ===TEMPLATE=== and ===END=== delimiters exactly as shown
- META section MUST be strictly valid JSON — double-check every comma between array elements
- NEVER wrap the META JSON in markdown code fences (\`\`\`)
- NEVER add text before ===META=== or after ===END===
- blockName: lowercase, dashes only
- The TEMPLATE section is raw Twig — no JSON escaping needed, just write the template directly
- Template MUST use this EXACT cache line: {% cache "block;" ~ post.id ~ ";" ~ block.id ~ ";" ~ post.modified_timestamp ~ ";" ~ cache_key %}
- Template MUST end with {% endcache %}
- NEVER use a static cache key like {% cache 'block-name' %}
- Use <section>, container class (NOT max-w-[1342px] mx-auto px-[Npx]), section-anchor pattern
- PADDING: Use py-16 lg:py-[140px] on the section for responsive vertical spacing
- NEVER add px-[Npx] to the section or to the inner content wrapper — the container class handles that
- BUTTONS: ALWAYS use an <a> tag (not <span> or <button>). href defaults to '#' if no link set. ALWAYS include no-underline class
- Use theme color names where possible: bg-secondary (not bg-[#043873]), bg-primary, etc. Only use arbitrary bg-[#xxx] for colors not in the theme
- FONT: Use font-inter on every text element. Never use font-ibm-plex-sans or font-lt-museum
- DEFAULTS: Every text field MUST have a |default('...') fallback so nothing renders empty
- IMAGE CONTAINER: Use w-full aspect-[W/H] for responsive sizing, never hardcoded w-[824px] h-[549px]
- Use get_image() for images (NOT TimberImage or Image)
- SECTION BACKGROUND: sectionBackground → optional ACF image + CSS fallback
- CONTENT IMAGE: placeholderContainers[] → ACF image + colored div fallback matching Figma bounds
- DECORATIVE: decorGroups[] → optional ACF image, absolute positioned at z-0 with pointer-events-none. These must NEVER cover text or CTA. Position them BEHIND all content — use z-[1] max, and put content at z-10 or higher
- Include EVERY text node, placeholder, and button from the data
- No ob_start, ob_get_clean, echo, or include in Twig`;
}

async function callAI(prompt) {
  if (!AI_PROVIDER) {
    console.log("\n   ⚠ No API key set (ANTHROPIC_API_KEY or DEEPSEEK_API_KEY) — skipping AI step");
    return null;
  }

  console.log(`   Calling ${AI_PROVIDER} API...`);

  let res, text;

  if (AI_PROVIDER === "anthropic") {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    text = data.content[0].text;
  } else {
    // DeepSeek (OpenAI-compatible)
    res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    // DeepSeek v4 Pro may return reasoning_content in addition to content
    text = data.choices[0].message.content || data.choices[0].message.reasoning_content || "";
  }

  // Parse delimiter-based format: ===META=== {json} ===TEMPLATE=== {twig} ===END===
  const metaMatch = text.match(/===META===\s*([\s\S]*?)\s*===TEMPLATE===/);

  if (!metaMatch) {
    // Fallback: try old JSON-only format
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid output format found in AI response");
    return safeJsonParse(jsonMatch[0], "AI response");
  }

  const schema = safeJsonParse(metaMatch[1].trim(), "===META=== section");

  // Extract template: everything between ===TEMPLATE=== and ===END=== (or end of text)
  const afterTemplate = text.slice(text.indexOf('===TEMPLATE===') + '===TEMPLATE==='.length);
  const endIdx = afterTemplate.indexOf('===END===');
  schema.twigTemplate = (endIdx >= 0 ? afterTemplate.slice(0, endIdx) : afterTemplate).trim();

  return schema;
}

// ─── Step 3: Generate block files ─────────────────────────────────────

function generateBlock(schema) {
  const blocksDir = path.join(__dirname, "blocks");
  const blockPath = path.join(blocksDir, schema.blockName);

  if (fs.existsSync(blockPath)) {
    console.log(`   ⚠ Block "${schema.blockName}" already exists at ${blockPath}`);
    return blockPath;
  }

  fs.mkdirSync(blockPath, { recursive: true });

  // block.json
  const blockJson = {
    name: schema.blockName,
    title: schema.blockTitle,
    viewScript: ["file:./script.js"],
    viewStyle: [],
    supports: {
      align: ["full"],
    },
    acf: {
      mode: "edit",
      renderTemplate: "./controller.php",
      postTypes: ["page"],
    },
  };

  fs.writeFileSync(path.join(blockPath, "block.json"), JSON.stringify(blockJson, null, 2));

  // controller.php
  const controller = `<?php
use Timber\\Timber;

acf_setup_meta($block["data"], $block["id"], true);

$context = Timber::context([
  "block" => $block,
  "fields" => get_field("block")
]);

$context["block"]["slug"] = sanitize_title($block["title"]);

acf_reset_meta($block["id"]);

Timber::render("./template.twig", $context);
`;
  fs.writeFileSync(path.join(blockPath, "controller.php"), controller);

  // template.twig
  const twigContent = schema.twigTemplate || `{% cache "block;" ~ post.id ~ ";" ~ block.id ~ ";" ~ post.modified_timestamp ~ ";" ~ cache_key %}

<section class="{{ block.slug }}">
    {% if block.anchor %}
        <div class="section-anchor" id="{{ block.anchor ?? block.id }}"></div>
    {% endif %}

    <div class="container">
        <div class="pt-[60px] pb-[60px] lg:pt-[100px] lg:pb-[100px]">

        </div>
    </div>
</section>

{% endcache %}
`;
  fs.writeFileSync(path.join(blockPath, "template.twig"), twigContent);

  // block.css
  const cssContent = schema.customCss || `@layer components {\n    .${schema.blockName} {\n        /* Add your styles here */\n    }\n}`;
  fs.writeFileSync(path.join(blockPath, "block.css"), cssContent);

  // script.js
  const jsContent = `baseTheme.addModule({
  init(baseTheme) {
    const $ = baseTheme.$;

    const script = () => {
      const els = $("section.${schema.blockName}");
      if (!els.length) return;

      els.each(function () {
        const self = $(this);
        ${schema.jsLogic ? "// " + schema.jsLogic.replace(/\n/g, "\n        ") : "// Add your logic here"}
      });
    };

    script();
  },
});
`;
  fs.writeFileSync(path.join(blockPath, "script.js"), jsContent);

  // script.asset.php
  const assetPhp = `<?php return array('dependencies' => array('jquery'), 'version' => '1.0.0');`;
  fs.writeFileSync(path.join(blockPath, "script.asset.php"), assetPhp);

  // ACF field group JSON loaded by functions.php.
  if (schema.acfFields && schema.acfFields.length) {
    const fieldKeyPrefix = schema.blockName.replace(/-/g, "_");
    const acfJson = {
      key: `group_${schema.blockName.replace(/-/g, "_")}`,
      title: `${schema.blockTitle} Fields`,
      fields: [
        {
          key: `field_${fieldKeyPrefix}_block`,
          label: "Block",
          name: "block",
          type: "group",
          instructions: "",
          required: 0,
          layout: "block",
          sub_fields: schema.acfFields.map((f) => ({
            key: `field_${fieldKeyPrefix}_${f.name}`,
            label: f.label,
            name: f.name,
            type: f.type || "text",
            instructions: f.instructions || "",
            required: f.required || 0,
            default_value: f.default_value ?? "",
            ...(f.choices ? { choices: f.choices } : {}),
            ...(f.return_format ? { return_format: f.return_format } : {}),
            ...(!f.return_format && f.type === "select" ? { return_format: "value" } : {}),
            ...(!f.return_format && f.type === "link" ? { return_format: "array" } : {}),
          })),
        },
      ],
      location: [
        [
          {
            param: "block",
            operator: "==",
            value: `acf/${schema.blockName}`,
          },
        ],
      ],
      active: true,
    };
    fs.writeFileSync(path.join(blockPath, "acf-field-group.json"), JSON.stringify(acfJson, null, 2));
  }

  // Copy preview.png placeholder
  const defaultPreview = path.join(__dirname, "assets", "img", "png", "preview.png");
  if (fs.existsSync(defaultPreview)) {
    fs.copyFileSync(defaultPreview, path.join(blockPath, "preview.png"));
  }

  console.log(`   Generated ${blockPath}/`);
  const files = fs.readdirSync(blockPath);
  files.forEach((f) => console.log(`     ✅ ${f}`));

  return blockPath;
}

// ─── List mode — browse all sections in a Figma file ──────────────────

async function listSections(fileKeyOrData) {
  let data;
  if (typeof fileKeyOrData === "string") {
    console.log(`\n   Fetching file ${fileKeyOrData}...`);
    data = await fetchFigmaFile(fileKeyOrData, { silent: true });
  } else {
    data = fileKeyOrData;
  }

  const results = [];
  for (const canvas of data.document.children) {
    if (!canvas.children) continue;
    for (const frame of canvas.children) {
      if (!frame.children) continue;
      const sections = [];
      for (const section of frame.children) {
        if (section.type === "FRAME") sections.push(section.name);
      }
      if (sections.length) {
        results.push({ canvas: canvas.name, frame: frame.name, sections });
      }
    }
  }

  console.log(`\n   Sections found:\n`);
  results.forEach((r) => {
    console.log(`   ┌─ Canvas: ${r.canvas}`);
    console.log(`   │  Frame:  ${r.frame}`);
    r.sections.forEach((s) => console.log(`   │    └─ "${s}"`));
    console.log("");
  });

  return { results, fileData: data };
}

// ─── Interactive mode — ask for input when run directly ───────────────

async function interactive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q) => new Promise((resolve) => rl.question(q, resolve));

  // Parse CLI args: node figma-to-block.js [file-key] [section-name]
  const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const argFileKey = cliArgs[0];
  const argvSectionName = cliArgs[1];

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Figma → WordPress Block Generator       ║");
  console.log("╚══════════════════════════════════════════╝");

  // ── Step 0: Get file key ──
  let fileKey = argFileKey;
  if (fileKey) {
    console.log(`\n   File key (from CLI): ${fileKey}`);
  } else {
    fileKey = await question("\nFigma file key (enter for demo): ");
    if (!fileKey) fileKey = "3A0LylN53fJYUbTe6qYZCa";
  }

  // ── Step 1: Fetch file ──
  console.log(`\n   Fetching...`);
  let fileData;
  try {
    fileData = await fetchFigmaFile(fileKey, { silent: true });
    console.log(`   Got it: "${fileData.name}"\n`);
  } catch (e) {
    console.error(`   ❌ ${e.message}`);
    process.exit(1);
  }

  // ── Step 2: Select Canvas ──
  const canvases = (fileData.document.children || []).filter((c) => c.type === "CANVAS");
  if (!canvases.length) { console.error("   No canvases found."); process.exit(1); }

  // --list mode: print full tree and exit
  if (process.argv.includes("--list")) {
    console.log(`\n   Full structure of "${fileData.name}":\n`);
    for (const canvas of canvases) {
      console.log(`   ┌─ Canvas: ${canvas.name}`);
      const canvasFrames = (canvas.children || []).filter((f) => f.type === "FRAME" && f.children);
      for (const frame of canvasFrames) {
        console.log(`   │  Frame: ${frame.name}`);
        const frameSections = (frame.children || []).filter((s) => s.type === "FRAME");
        for (const section of frameSections) {
          console.log(`   │    └─ "${section.name}"`);
        }
      }
      console.log("");
    }
    rl.close();
    return;
  }

  console.log("   ── Canvases ──");
  canvases.forEach((c, i) => console.log(`   [${i + 1}] ${c.name}`));

  const canvasChoice = await question(`\n   Pick canvas [1-${canvases.length}]: `);
  const canvasIndex = (parseInt(canvasChoice) || 1) - 1;
  const canvas = canvases[canvasIndex] || canvases[0];
  console.log(`   → ${canvas.name}\n`);

  // ── Step 3: Select Frame ──
  const frames = (canvas.children || []).filter((f) => f.type === "FRAME" && f.children);
  if (!frames.length) { console.error("   No frames found in this canvas."); process.exit(1); }

  console.log("   ── Frames ──");
  frames.forEach((f, i) => console.log(`   [${i + 1}] ${f.name}`));

  const frameChoice = await question(`\n   Pick frame [1-${frames.length}]: `);
  const frameIndex = (parseInt(frameChoice) || 1) - 1;
  const frame = frames[frameIndex] || frames[0];
  console.log(`   → ${frame.name}\n`);

  // ── Step 4: Select Section ──
  const sections = (frame.children || []).filter((s) => s.type === "FRAME");
  if (!sections.length) { console.error("   No sections found in this frame."); process.exit(1); }

  console.log("   ── Sections ──");
  sections.forEach((s, i) => console.log(`   [${i + 1}] ${s.name}`));

  let sectionName = argvSectionName;
  if (!sectionName) {
    const sectionChoice = await question(`\n   Pick section [1-${sections.length}] or type name: `);
    const sectionIndex = parseInt(sectionChoice) - 1;
    if (sectionIndex >= 0 && sections[sectionIndex]) {
      sectionName = sections[sectionIndex].name;
    } else {
      sectionName = sectionChoice;
    }
  }
  if (!sectionName) sectionName = sections[0].name;

  console.log(`   → ${sectionName}\n`);
  rl.close();

  // ── Step 5: Extract & Generate ──
  try {
    // Find the section node directly (already have it if picked by number)
    let sectionNode;
    if (sections.find((s) => s.name === sectionName)) {
      sectionNode = sections.find((s) => s.name === sectionName);
    } else {
      // Fallback search
      sectionNode = (frame.children || []).find((s) => s.name === sectionName);
    }

    if (!sectionNode) throw new Error(`Section "${sectionName}" not found in "${frame.name}".`);

    const tree = walkTree(sectionNode);
    const summary = summarizeSection(tree);
    console.log(`[2/4] Extracted — ${summary.textNodes.length} text nodes, ${summary.keyFrames.length} layout frames`);

    // Step 3: AI interpret
    const prompt = buildPrompt(summary);
    console.log(`\n[3/4] AI interpreting design...`);
    const schema = (await callAI(prompt)) || {
      blockName: sectionName.toLowerCase().replace(/\s+/g, "-"),
      blockTitle: sectionName,
      twigTemplate: `{% cache "block;" ~ post.id ~ ";" ~ block.id ~ ";" ~ post.modified_timestamp ~ ";" ~ cache_key %}

<section class="{{ block.slug }}">
    {% if block.anchor %}
        <div class="section-anchor" id="{{ block.anchor ?? block.id }}"></div>
    {% endif %}

    <div class="container">
        <div class="pt-[60px] pb-[60px] lg:pt-[100px] lg:pb-[100px]">

        </div>
    </div>
</section>

{% endcache %}`,
    };

    // Step 4: Generate
    console.log(`\n[4/4] Generating block files...`);
    const blockPath = generateBlock(schema);

    console.log(`\n✅ Done! Block created at:`);
    console.log(`   ${blockPath}`);

    if (!AI_PROVIDER) {
      console.log(`\n💡 Tip: Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY env var to enable AI-powered template generation.`);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────

if (require.main === module) {
  interactive();
}

module.exports = { fetchFigmaFile, extractSection, buildPrompt, callAI, generateBlock, listSections };
