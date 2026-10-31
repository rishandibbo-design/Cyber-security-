# ClearShare — one-to-one screen-sharing demo

This is a **consent-based** screen-sharing demo. It is NOT a silent capture or monitoring tool. Screen sharing only starts after the owner clicks **Start screen sharing** and approves their browser's native screen/window picker. Sharing remains visible and can be stopped at any time.

## Use with your phone

- **Computer (sharer)**: open `https://your-domain/share` in desktop Chrome, Edge, Firefox or supported Safari. Copy the invitation link. When a viewer joins, click **Start screen sharing** and approve the browser permission prompt.
- **Phone (viewer)**: open the invitation link in your phone browser to watch the live video. You do not need to install an app.
- Mobile screen *capture* may not be supported by your phone's browser; the phone can still be the viewer. Never rely on screen capture from Android Chrome.

## Deploy from your phone (GitHub + Render)

1. Create a **private** repository on GitHub and upload `package.json`, `server.js`, and `public/` preserving their folders.
2. Log in to https://dashboard.render.com/ → **New** → **Web Service** → connect the GitHub repository.
3. Choose Node, set **Build Command** to `npm install`, and **Start Command** to `npm start`. Keep the service's generated HTTPS URL.
4. Visit `https://your-service.onrender.com/share` from a **computer** and send the generated invitation URL to your phone.
5. The sharer authorizes access using the browser's built-in screen/window picker and can stop using the red **Stop sharing** button.

To run locally on a computer: `npm install && npm start`, then visit http://localhost:3000/share.

## Privacy and limitations

- Only one viewer at a time. Invitations are random 128-bit tokens, expire after 60 minutes, and become invalid if the sharer closes/disconnects.
- The server relays only WebRTC connection messages, never the captured screen content. Media flows via WebRTC, normally peer-to-peer with encrypted transport.
- There is no recording, file logging, stealth feature, or remote-control capability.
- **STUN-only prototype:** restrictive NAT/firewalls can block P2P connectivity. A secure TURN relay would be required for reliable cross-network operation.
- The viewer link is a bearer secret: anyone who has it can connect until expiry. Don't publish it.
- Use only on devices you own or with informed authorization.
- The UI and signaling server do not constitute a hardened production security product.

## Phone → phone (Android / iPhone)

Visit `https://your-service.onrender.com/mobile.html` from a phone.

Select **Generate meeting link**, share the link with the other phone, and join using the **Jitsi Meet native app** on both phones. The person sharing uses the Jitsi app's **Share screen** action and approves the Android/iOS screen-sharing permission. Sharing can be stopped from the app or system controls.

**Important:** This is a handoff to the third-party Jitsi Meet service; it is not captured or streamed through ClearShare's Node.js server, and its privacy/security policies are separate. The moderator may need to sign in to start the meeting on meet.jit.si. Mobile Chrome still cannot share the entire screen through `getDisplayMedia()`. This feature does not provide remote control, recording, hidden capture, or permission bypass.
