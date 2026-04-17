# demon.beauty
demon.beauty is a dark-glam web builder for ritual-ready landing pages.

## Editor behavior
- The Layers panel is context-aware: when a container (or a child inside a container) is selected, the panel only shows that container and the items inside it to reduce visual noise.
- Block templates now include six core sections: Hero, Gallery, Pricing, Testimonials, FAQ, and Contact.
- Style controls are intentionally constrained by default (essential controls first, advanced controls behind an explicit toggle) so users can customize without fully breaking visual consistency.
- Link controls are available on text, button, and image blocks.
- Uploaded photos are automatically optimized on the backend and stored in each user's asset pool so they can be reused across elements.
- Published/public page rendering now avoids injecting editor-only container/section chrome (neon border + default padding), so newly created pages match authored styles without unexpected wrapper boxes.
- Public site admin details (the "Live Site" label, "Open Project" shortcut, and published timestamp) are only shown when the signed-in user owns that specific project.
- The canvas now separates centering from width constraints: use the center toggle for alignment and choose a width preset (Narrow / Standard / Wide / Full) to match target layouts on large monitors.
- Published pages now use the same wide (96rem) centered content width as the editor canvas default so block proportions stay consistent between editing and live viewing.
- Published pages now clamp overflowing block widths, wrap long links/button labels, and tighten mobile spacing so public sites remain usable on narrow phone screens.
- Layout primitives are now first-class schema nodes (`stack`, `row`, `column`, `grid`, and `card`) with constrained defaults for gap, alignment, distribution, and wrapping so editor and public rendering stay in sync.
- Drag/drop now supports insertion indicators, index-aware drops into layout compositions, and quick drop zones that wrap incoming blocks in a new row or column.
- Starter compositions now favor composable primitives (hero variants, feature rows, gallery strips, pricing matrix) instead of monolithic one-off templates.
- Nodes are now schema-driven: node type definitions (defaults, inspector field metadata, and render hints) live in a registry so templates and hydration can evolve safely while preserving older saved content.
- Inspector controls are now componentized and schema-driven: field definitions can declare basic/advanced visibility, validation constraints, and type-specific defaults.
- The schema field renderer now supports text/textarea/rich text, image and link pickers, numeric/range controls, toggles/selects, and list/repeater editing for multi-item content sections.
- Node prop updates now support nested paths (for example `featureItems.0.title`) so inspector controls can safely edit deeply nested structures instead of only flat keys.
- Projects now support reusable component families with variants (for example `Hero / Split Hero / Minimal Hero`) so section definitions are centrally managed and can be reused across pages.
- You can convert any selected node subtree into a reusable component from the inspector via **Save as component**; the editor replaces the original subtree with a component instance.
- Component instances keep structure in sync with their source variant while allowing controlled per-instance overrides for text, image, link, and style fields.
- Layers and inspector views now differentiate source components vs instances, including explicit instance badges and a dedicated override editor.

## Deploy with systemd
1. Install backend dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
2. Copy the service file and reload systemd:
   ```bash
   sudo cp deploy/demon-beauty.service /etc/systemd/system/demon-beauty.service
   sudo systemctl daemon-reload
   ```
3. Enable and start the service:
   ```bash
   sudo systemctl enable --now demon-beauty.service
   ```
4. Check status/logs:
   ```bash
   sudo systemctl status demon-beauty.service
   sudo journalctl -u demon-beauty.service -f
   ```
