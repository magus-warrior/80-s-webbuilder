# demon.beauty
demon.beauty is a dark-glam web builder for ritual-ready landing pages.

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
