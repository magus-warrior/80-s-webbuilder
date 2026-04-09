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
- The canvas now includes a "Center all" toggle that quickly centers the full page composition for easier editing.

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
