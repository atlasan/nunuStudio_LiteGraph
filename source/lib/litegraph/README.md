# LiteGraph integration

The editor and standalone nunuStudio runtime use the same vendored LiteGraph ESM build. The build is based on Atlasan LiteGraph `f80ca96` with the host-driven start option. Its MIT license is included here.

To refresh the bundle and stylesheet, run `npm run build` in the LiteGraph checkout and copy the generated files into this directory. Check the editor, Play and Stop, and exported playback after refreshing.

```sh
cp ../litegraph.js/.lg/local-build/build/litegraph.mini.js source/lib/litegraph/
cp ../litegraph.js/css/litegraph.css source/lib/litegraph/
npm run test:e2e -- litegraph.spec.mjs
```

In nunuStudio, add a **LiteGraph Script** from the scene editor’s script drawer. Double-click it in the project tree to open the graph. To bind a **Scene Object** node, select the target in the project tree, right-click the node, and choose **Bind selected scene object**. A **Set Position** node accepts that object and a three-component vector. The binding stores the object UUID and resolves it inside the script’s scene, including when Play runs a clone of the project.

Earlier projects with `LiteGraphScript` data and the `nunu/object` and `nunu/position_set` nodes open through the normal project loader. The integration uses nunuStudio’s frame loop and saves graph data with the owning project. The prototype-format fixture is in [the browser harness](../../../test/harness/legacy-litegraph.isp).

Invalid graph data fails project loading with a validation error. Missing node types are preserved as placeholders so their saved configuration remains available.

Open the visual scripting projects through **File → Examples → LiteGraph Starters**. The menu uses the bundled binary project when available and falls back to its JSON counterpart. Press **Run** to focus the preview and see the scene’s controls. In **Rover test track**, tap **W** or **S** to take a step, hold either key to keep driving, and press **R** to return to the start.

Open **Graph Debug** to inspect a running script in the **Live Graph** tab. Select a script, click a node to see its outputs, and watch for highlighted connections as values change or events pass through. Opening the tab keeps the visible Run preview ready for keyboard input. After using the picker, press **Focus preview** to send keys to the project again.

**Input monitor** shows what two independent scripts receive when you press keys and mouse buttons, move the pointer, or scroll. The second script also contains a nested listener. All listeners read the same frame of input.

## Preview input

The runtime samples keyboard and mouse state before updating the scene. A key or mouse button pressed and released between frames exposes both transitions in the next sample. Each listening node sees those transitions once per sample, including when a nested graph runs twice. Switching the graph shown in Graph Debug changes only the view.

The Run canvas owns preview input. Opening Graph Debug focuses the visible preview, and using the picker gives the picker keyboard focus. Click **Focus preview** to resume keyboard control. Losing preview focus clears held keys and buttons.

## Verification

```sh
npm run test:static
npm run test:e2e -- --workers=2
npm run build-editor
```

The browser suite covers all 14 starters, matching JSON and binary copies, Rover taps and held keys, Jump’s Space control, multiple input listeners, graph highlighting, and legacy project playback. The production build places both starter formats under `docs/editor/files/examples/`.
