<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/logo.png">

[![GitHub version](https://badge.fury.io/gh/tentone%2FnunuStudio.svg)](https://badge.fury.io/gh/tentone%2FnunuStudio)[![npm version](https://badge.fury.io/js/nunu-studio.svg)](https://badge.fury.io/js/nunu-studio)[![GitHub issues](https://img.shields.io/github/issues/tentone/nunuStudio.svg)](https://github.com/tentone/nunuStudio/issues) [![GitHub stars](https://img.shields.io/github/stars/tentone/nunuStudio.svg)](https://github.com/tentone/nunuStudio/stargazers)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio?ref=badge_shield)


- nunuStudio is an open source  game engine for the web it allows designers and web developers to easily develop 3D experiences for the web.
- Powered by [three.js](https://github.com/mrdoob/three.js) can run directly in the web or be exported as desktop application trough [nwjs.io](https://nwjs.io).
- Fully featured visual editor, supports a wide range of file formats, the tools are open source and completely free to use for both personal and commercial usage.
- Visual scene editor, code editor, visual tools to edit textures, materials, particle emitters and a powerful scripting API that allows the creation of complex applications using [JavaScript](https://www.javascript.com/) or [Python](https://www.python.org/).
- Fully featured [web version](https://www.nunustudio.org/build/editor/index.html) of the editor is available on the project page.
- The web version is tested with [Firefox](https://www.mozilla.org/en-US/firefox/new/), [Chrome](https://www.google.com/chrome/) and [Microsoft Edge](https://www.microsoft.com/en-us/edge), mobile browsers are supported as well.

<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/web.png">

- [API Documentation](https://nunustudio.org/docs) with full details about the inner working of every module are available. These can also be generated from the project source code by running `npm run docs`.
- Basic tutorials are available on the [project page](https://www.nunustudio.org/learn). The basic tutorials explain step-by-step how to use the editor.
- To build the project first install [Node.js LTS](https://nodejs.org/en/) and NPM:
  - The building system generates minified builds for the runtime and for the editor
  - Documentation generation uses [YuiDocs](https://yui.github.io/yuidoc/)
  - Install dependencies from npm by running `npm install --legacy-peer-deps`
  - Build the runtime and editor with `npm run build`; `npm run build-all` also builds the webpage and documentation, and `npm run release` bumps the version first
- Webpage of the project is built using [Angular](https://angular.io/) and is hosted on [GitHub Pages](https://pages.github.com/)



## LiteGraph integration fork

The `nunu_litegraph` branch combines the `first_litegraph` prototype with upstream
`tentone/master`. Visual scripts are available from the scene sidebar in both
production and development editors; double-click a visual script in the tree to
open its graph. Use the **Nunu Object** node's **use selected** button to bind a
scene object by UUID, then connect it to **Set Position** and a three-component
vector. Save normally to persist the graph with the scene.

The custom library is developed separately in the sibling `../litegraph.js`
checkout. This repository vendors a browser distribution, CSS, MIT license and
`source/lib/litegraph.provenance.json`; builds do not depend on that sibling
checkout being present. To refresh from its current source without modifying it:

```sh
npm run sync-litegraph -- --rebuild
# A different local source checkout can be passed before --rebuild:
npm run sync-litegraph -- /path/to/litegraph.js --rebuild
npm test
npm run check-integration-builds
```

Use Node.js 22 and Python 3 for this workflow. Rebuilding the library requires its
own installed build dependencies. Omitting `--rebuild` copies its existing build
instead; provenance explicitly distinguishes that from a fresh source snapshot.
Local uncommitted changes are included when rebuilding and recorded as such.

The engine owns graph timing and execution; the graph does not run an independent
animation/interval loop. Startup waits for node readiness (`script.ready`), stop
cancels pending startup, and restart waits for asynchronous node cleanup. Scene
object bindings resolve after attachment and follow the current scene; paste
remaps references inside the copied selection and preserves external UUIDs.
Editor selection access is injected by the graph tab, outside runtime code.

Regression checks cover lifecycle, references, loading, paste and canvas disposal.
`check-integration-builds` produces both production runtime bundles and the editor
under a temporary directory, verifies runtime/editor separation and CSS packaging,
and leaves the package version and tracked generated `docs/` files untouched.
`npm run build` no longer increments the package version and works on a dirty
working tree; the version bump moved to `npm run release` (which needs a clean tree).
Project execution notes, memories and plans are local files under the ignored
`.idea/` directory, named `YYYYMMDD_XXX.md`.


### First visual-script workflow

1. Add a **LiteGraph Graph** from the scene sidebar's script drawer, then double-click **Visual Script** in Project Explorer.
2. Select the **box** in Project Explorer while keeping the graph tab open. Click **Spin selected**. This appends a bound object reference, Scene Events and Rotate; it leaves the authored scene unchanged.
3. Click **Run**. Stop the preview to return to editing. Set Rotate's X/Y/Z rates in radians per second; use Translate for units per second in the object's parent axes.
4. **Undo/Redo** and Ctrl+Z / Ctrl+Y apply to the graph while its canvas has focus. The first edit is undoable; graph and scene histories remain separate. **Frame all** fits the graph; **Check** reports missing bindings, types or dependencies in the status bar.
5. Save the project normally. Binary `.nsp` and JSON `.isp` files both include the graph and its schema version. Reopen and export through the normal project workflow; the standalone runtime registers the same nunu nodes.

Use the second toolbar row to **Search nodes** (title, category, type or
description; Enter adds the first match) or choose a category and **Nunu node**,
then **Add node**. Descriptions explain each node's contract. Choose a **Starter
example** and **Add example** with a compatible scene object selected; one example
is one undoable edit. Examples that need a different object type are marked
"(needs Mesh)", "(needs Light)" and so on. Existing graphs are appended to, never
replaced.

Thirteen self-contained projects cover spin, W-held movement, Space visibility
toggle, mesh tint, perspective camera projection, light intensity, spawning on
start, Space spawn / D delete, highlight on hover, click to copy, jumping only
while grounded (physics), playing a generated beep (audio) and pausing a bobbing
animation. Every project has
JSON `.isp` and binary `.nsp` versions in [the example manifest](source/files/examples/visual-script-examples.json).
Load one through **File → Load**, then Run. Each includes a camera, box and lights
and requires no external assets; the sound example embeds its own short WAV. Regenerate projects and the published node
catalog with `node --experimental-vm-modules scripts/create-visual-script-example.cjs`.

| Node | First-release contract |
| --- | --- |
| Nunu Object | Bind an object in this script's scene; outputs the object and a found flag. Missing/deleted targets are reported. |
| Script Context | Current script (`self`), parent, scene and running program. |
| Scene Events | Started, per-frame update, stopped, resized and app-data events, with delta/time (seconds), size and data outputs. |
| Keyboard | Program keyboard state and pressed/released events; key codes, e.g. Space 32, A 65, W 87. |
| Mouse | Program canvas position/delta, wheel and selected-button state/events (left 0). No extra browser listeners. |
| Get Transform | Local position, Euler rotation in radians, scale and visibility. |
| Set Transform | Event-driven: on **apply**, write only connected fields and emit **done**. |
| Translate / Rotate | Event-driven: on **apply**, integrate velocity by delta seconds; unconnected delta uses the engine frame delta. Static object matrices update too. |
| Set Position | Compatibility node: writes the position every frame; new event graphs can use Set Transform instead. |

| Find Object / Object Info | Exact-name lookup (first and all matches), identity and hierarchy reads in the current scene. UUID references remain preferable for stable bindings. |
| World Transform / Look At | Parent-aware world position, quaternion, scale and forward; event-driven world target orientation. Look At requires positive uniform parent scale. |
| Visibility | Event-driven toggle or explicit boolean set. Hidden objects remain in the scene. |
| Get / Set Object Data | Read userData with fallback; write JSON scalars using safe keys. |
| Camera Projection | Atomically validate and update perspective FOV and clipping; orthographic cameras support clipping. |
| Light Settings | Atomically set non-negative intensity and color. |
| Mesh Color | Tint color-capable materials; default isolates shared materials with one clone per object, with explicit shared-edit opt-in. |
| Pointer | Hover and click on an object or its children through the scene's active camera; nearer visible objects block it. Hovering, world hit point and distance, plus entered/exited/clicked events that fire once per transition. |
| Proximity | World distance between two objects with a radius; inside flag and entered/exited events. A missing object counts as outside. |
| Spawn Primitive / Spawn Copy | Event-driven: add a box, sphere or group, or a copy of an authored object, owned by the running script. Copies keep the source's world rotation and scale, share its geometry and materials, and can stack at an offset. Per-node limit 1–128, per-script cap 128. Everything spawned is removed on stop and never saved. Objects with scripts, physics, audio or cameras cannot be copied. |
| Delete Spawned Object | Delete a primitive or copy this script spawned and free what it allocated. Authored objects, other scripts' objects and spawns with attached children are rejected. |
| Physics Body | Apply an impulse at the center, or set/add linear velocity, on a dynamic physics object while scene physics runs. Static and kinematic bodies are rejected. |
| Collision | Contacts of a physics object from the last physics step: touching flag, began/ended events once per touching body, the other object and its impact speed. An optional other input watches one object only. |
| Animation Playback | Play, pause, toggle, stop (rewind), restart or set the speed of an object's animation clips. A clip name plays that clip alone; playing all clips restores each clip's authored enabled state. |
| Audio Playback | Play (resumes, never restarts), restart, pause, stop or toggle an audio emitter once its audio has loaded. |

New mutation nodes expose **done**, **failed**, **success** and **message**. Invalid
inputs leave their target unchanged. Their object inputs accept only objects in
the script's owning scene. Colors accept `#RRGGBB` or normalized RGB vectors.

Connect Scene Events **update** to a mutation node's **apply**, and **delta** to
its delta input. Use LiteGraph's existing math, logic, branch, counter and data
nodes between engine nodes. To move only while a key is held, connect update to
an `events/branch` event input, Keyboard **down** to its condition, and its true
output to Translate **apply**. Engine nodes resolve context correctly inside
subgraphs. Rotations are local Euler angles, not world-axis rotations; animated
transforms do not teleport physics bodies in this first pass.

Bindings are UUID-based. Drag an object from the scene tree onto the graph to
add a bound reference; drop it on a Nunu Object node to rebind that node, or on
an object input to add a reference and connect it. **Reference selected** adds a
reference to the selected object. **Bind selected** binds selected Nunu Object
graph nodes to the current scene selection. Right-click a Nunu Object node for
**Select in scene** and **Bind to selected object**; double-click selects its
object in the scene. Each of these is one undoable step. Resources and objects in other scenes are not
accepted. Run follows the editor's existing immediate-mode setting; the status
bar explicitly identifies that mode because it can mutate the authored scene.
App data/initial resize received during startup wait for node readiness. Graph
version 1 is written on save; legacy unversioned scripts load as version 1.

The production-build verifier also writes `visual-script-runtime.html` next to
the temporary editor build. Serve that folder on loopback and open the page to
exercise actual Program cloning, JSON save/reopen, static matrices and a binary
NSP projects running through App with only `nunu.min.js` loaded. Its live example
selector allows keyboard and object operations to be tried directly.


### Growing the baseline

Register stable `nunu/...` IDs through `registerNunuNode` with category, accepted
object type, effect and description. The runtime catalog supplies the editor
palette and generated [port/property schema](source/files/examples/visual-script-catalog.json).
Keep runtime modules free of editor imports. Validate mutations before writing,
report failures through ports, respect static matrices and shared resources,
and preserve existing IDs and serialization contracts.

Add starter builders in `LiteGraphStarter.js` so the editor and fixture generator
use the same wiring. Regenerate all examples, test their connected behavior,
invalid inputs and save/reopen, then run `npm test` and
`npm run check-integration-builds`. This is the baseline for incremental growth;
loading audio or models at runtime, animation events (clip finished) and
per-node failure badges in the editor are future work.

## Screenshots

<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/2.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/3.png">
<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/4.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/1.png">
<img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/5.png"><img src="https://raw.githubusercontent.com/tentone/nunuStudio/master/source/page/src/assets/github/6.png">



## Features

- Visual application editor
  - Drag and drop files directly into the project (images, video, models, ...)
  - Manage project resources.
  - Edit material, textures, shaders, code, ...
- Built on [three.js](https://threejs.org/) library w/ physics by [cannon.js](https://schteppe.github.io/cannon.js/)
  - Real time lighting and shadow map support
  - three.js libraries can be imported into the editor
  - Wide range of file formats supported (gltf, dae, obj, fbx, 3ds, ...)
- [NW.js](https://nwjs.io/) and [Cordova](https://cordova.apache.org/) exports for desktop and mobile deployment
- Compatible with [WebXR](https://www.w3.org/TR/webxr/) for Virtual Reality and Augmented Reality

## Build
The project uses [Webpack](https://webpack.js.org/) to build and bundle its code base.
  - The building system generates minified builds for the runtime and for the editor
  - JavaScript is optimized and minified using [Uglify](https://www.npmjs.com/package/uglify-js)
  - Documentation generation uses [YuiDocs](https://yui.github.io/yuidoc/)

Steps needed to build the project:
1. To build the project first install [Java](https://www.oracle.com/java/technologies/javase-jdk8-downloads.html), [Node.js](https://nodejs.org/en/) and NPM and ensure that java command is working properly.
2. Install dependencies from npm by running `npm install`.
    1. If running on Node >=16 run `npm install --legacy-peer-deps` instead
3. Install the dependencies for the project webpage running `cd source/page && npm install`
4. Building/running
    1. Building: `npm run build` builds the runtime (`dist/`) and editor (`docs/editor/`); `npm run build-all` also builds the webpage and documentation; `npm run release` bumps the patch version (clean git tree required) and runs `build-all`
    2. Running: To start the editor locally for development and testing run `npm run start`
        1. On Linux, if webpack reports `ENOSPC` file-watcher errors, other applications have used up the inotify limit. The dev server keeps running and polls instead; to restore native watching raise the limit, e.g. `echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/60-inotify.conf && sudo sysctl --system`

## Embedding Application

- Application developed with can be embedded into already existing web pages, and are compatible with frameworks like [Angular](https://angular.io/) or [React](https://reactjs.org/).
- To embed applications in HTML pages the following code can be used, the application is bootstrapped using the `loadApp(file, id)` method.

```html
<html>
    <head>
        <script src="nunu.min.js"></script>
    </head>
    <body onload="Nunu.App.loadApp('pong.nsp', 'canvas')">
        <canvas width="800" height="480" id="canvas"></canvas>
    </body>
</html>
```

## Vue.js with Nuxtjs

 - Build `nunu.min.js` and place into `static/js` folder of your nuxt instance
 - Place canvas element into your `template` area where you want it, for example:
```vue
<template>
  <div>
    <canvas
      id="canvas"
      width="800"
      height="480"
    />
</div>
</template>
```
 - Add the script to your head function of the page you want the 3D integration on (or place is into your global head)
```js
head() {
return {
      script: [
        {
          hid: 'Nunu',
          src: 'assets/js/nunu.min.js',
          defer: true,
          callback: () => {
            Nunu.App.loadApp('assets/file.nsp', 'canvas') //add file to load in here
          },
        },
      ],
    },
  }
```

 - You are now able to address `Nunu` as usual within the app.


## License

- The project is distributed under a MIT license that allow for commercial usage of the platform without any cost.
- The license is available on the project GitHub page

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Ftentone%2FnunuStudio?ref=badge_large)
