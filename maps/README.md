# Writing maps by hand

Each `.json` file in this folder is one mind map. Open the app, click **Maps**, then **Import…** and pick the file. Importing always creates a new map, so you can import the same file again after editing it.

[`oswald-spengler.json`](oswald-spengler.json) is a full example: 146 nodes in 13 nested areas, using every node type. [`react.json`](react.json) shows a technical map with many code blocks.

## The file

```json
{
  "app": "mindmap",
  "version": 1,
  "name": "Oswald Spengler",
  "nodes": { "<id>": { … } },
  "edges": { "<id>": { … } },
  "viewports": {}
}
```

- **`app`** must be `"mindmap"` and **`version`** at most `1`.
- **`name`** is the map's name in the Maps window. Without it, the file name is used.
- **`viewports`** can stay empty. Each area then opens zoomed to fit its nodes.
- `exportedAt` is written by the app on export and ignored on import.

Anything the importer doesn't accept is dropped, not an error. The app tells you how many items it skipped, so check that message after importing.

## Ids

Node and edge ids are 1–64 characters of letters, digits, `_` and `-`. `root`, `__proto__`, `constructor` and `prototype` are not allowed as node ids.

Use readable ids (`bio-1880`, `book-decline-summary`). They make a map much easier to update later: an agent can find a node by id and change just that node.

## Nodes

```json
"book-decline": {
  "id": "book-decline",
  "areaId": "b-books",
  "kind": "topic",
  "position": { "x": 340, "y": 0 },
  "size": { "width": 300 },
  "data": { "label": "The Decline of the West", "color": "red" }
}
```

- **`id`** is the same as the key.
- **`areaId`** is the area the node is drawn in (see below).
- **`position`** is the node's top-left corner, in pixels. `x` grows to the right and `y` grows down.
- **`size`** is optional, and its effect depends on the kind (see the table).
- **`data`** holds the content. Only `label`, `text`, `src`, `url` and `color` are kept.
- **`color`** is optional: `cyan`, `green`, `yellow`, `orange`, `red` or `purple`.

| `kind`   | Fields in `data`                                  | `size`                                 | Shows                                             |
| -------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `topic`  | `label` (inline Markdown; `\n` starts a new line) | ignored; it grows to fit the label     | A pill-shaped heading                             |
| `text`   | `text` (Markdown)                                 | `width` (min 120); height is automatic | A text card                                       |
| `sticky` | `text` (Markdown)                                 | `width` (min 120); height is automatic | A sticky note                                     |
| `link`   | `url`, optional `label`                           | ignored; up to 300 px wide             | Site icon, title and host                         |
| `video`  | `url` (YouTube), optional `label`, `text`         | `width` (min 240); height is automatic | Thumbnail that plays in place, title, description |
| `image`  | `src` (data URL), optional `label`                | `width` and `height`                   | The picture; `label` is its alt text              |

### Text formatting

`text` in text, sticky and video nodes supports:

- `**bold**`, `*italic*` or `_italic_`, `~~strike~~` and `` `code` ``
- `[links](https://example.com)` and bare `https://…` URLs
- lists starting with `- ` or `1. `
- a new line inside a paragraph, and a blank line between paragraphs
- code blocks between two ` ``` ` lines, shown in a monospace box exactly as written: indentation, blank lines and `*`, `_` or `-` are kept, and nothing inside is formatted

````text
**Example**
```jsx
function Hello({ name }) {
  return <p>Hi, {name}</p>
}
```
````

The opening fence may name a language (` ```jsx `). It's not used for colouring yet. Close every block: an unclosed one runs to the end of the text. A code-only text node at about 440 px wide works well for examples.

A topic `label` takes the same inline formatting, but no lists, paragraphs or code blocks. Write `\n` for a new line in JSON strings.

There are **no headings, quotes or tables**. Start a card with a bold first line, such as `**Summary**\n…`, instead.

### Links and videos

- **Links:** a `url` must be `http`, `https` or `mailto`. Anything else shows as "Invalid link".
- **Videos:** a `url` can be any YouTube form: `watch?v=`, `youtu.be/`, `shorts/` or `embed/`. A `t=` or `start=` value starts the video at that time. Check that a video exists before adding it; `https://www.youtube.com/oembed?url=<video url>&format=json` returns its title, or an error if it's gone.

### Images

`src` must be a `data:image/…;base64,…` URL. Web addresses are not loaded, so download the picture and embed it.

- Keep pictures around 500 px on the long side. Each one is stored inside the map, so a few large photos quickly make the file several MB.
- Set `size` to the picture's aspect ratio, for example `{ "width": 220, "height": 240 }`.
- Use images you're allowed to reuse, such as public-domain or CC-licensed files from Wikimedia Commons, and note the source in a nearby node.

## Areas: putting nodes inside nodes

Any node can contain other nodes. A node whose `areaId` is another node's id is drawn _inside_ that node. The outer node then shows a number badge with how many items are inside; clicking the badge opens it, and the path at the top leads back out.

- `"areaId": "root"` is the map's main view.
- Areas can go as deep as you like, such as root → Books → The Decline of the West.
- A node whose `areaId` points at a missing node is dropped, along with everything inside it.
- Each area has its own coordinates, so every area can start near `(0, 0)`.

A good pattern is a short overview in each area, with the details one level down. In the example, the main view has only six branch topics with one-line descriptions. Each branch opens into its own area, and each book in Books opens into its summary, links, quotes and videos.

## Edges

```json
"e1": {
  "id": "e1",
  "areaId": "root",
  "source": "portrait",
  "target": "b-bio",
  "sourceHandle": "l",
  "targetHandle": "r",
  "label": "optional"
}
```

- Both ends must be in the same area, and that area must be the edge's `areaId`. Otherwise the edge is dropped.
- Handles are the four sides of a node: `t` (top), `r` (right), `b` (bottom) and `l` (left). Any side can start or end an edge.
- Choose handles that face each other, such as `r` to `l` for a node to the right and `b` to `t` for a node below. Otherwise lines loop around nodes.
- Use edges sparingly. A few lines that show flow (a timeline, "leads to") help; connecting every card adds clutter.

## Layout

Text, sticky and video nodes get their height from their content, and the file can't say what that will be. Plan with these estimates (14–15 px text), then leave room to spare:

| Node               | Height                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| topic              | 45 px; width about 8 px per character + 36                                                       |
| text               | 22 px + 20.5 px per line, with about `(width − 28) / 7` characters a line                        |
| sticky             | 32 px + 21 px per line, with about `(width − 32) / 7.6` characters a line                        |
| code block         | 36 px + 18.75 px per line (blank lines count), with about `(width − 48) / 7.5` characters a line |
| link               | 64 px; up to 300 px wide                                                                         |
| video, 320 px wide | about 260 px, plus about 19 px per extra line of description                                     |

Each list item counts as at least one line.

**Tips that worked well**

- **Use a few fixed column widths:** 230–360 px for cards and 320 px for videos, with 40–60 px between columns and 16–30 px between rows.
- **Stack in columns:** place a topic, then its card about 12 px below it, then the next item below that, using the estimated heights.
- **Use a shape that fits the content:** a left-to-right row for timelines, a grid for collections such as quotes, ideas or videos, and a central hub with branches for the main view.
- **Group by colour:** give each kind of item its own colour and keep it the same across areas.
- **Check after importing:** open each area and look for overlaps. For exact sizes, run this in the browser console while an area is open; it lists the real width and height of every node:

  ```js
  Object.fromEntries(
    [...document.querySelectorAll('.react-flow__node')].map((el) => [
      el.dataset.id,
      [el.offsetWidth, el.offsetHeight]
    ])
  )
  ```

  Fix the positions in the file and import it again.

## Updating a map

The app's **Export** writes the same format, so a map can make a round trip:

1. Export the map.
2. Edit the JSON: change a node's `data`, add nodes with new ids, or move them.
3. Import it. This creates a new copy of the map.
4. Delete the old map in the Maps window.

Exported nodes also carry `measured`: their real size on screen, which is exactly what you need for layout. You can leave `measured` out of new nodes; the app measures them when it draws them.
