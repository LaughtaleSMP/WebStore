# Laughtale SMP WebStore

[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/LaughtaleSMP/WebStore)

This repository contains the source code for the official website and web store of the Laughtale SMP, a Minecraft Bedrock server. The site serves as a central hub for players, providing server status, features, rules, community links, and an item shop. It also includes a comprehensive admin panel for managing the site's content and configurations.

**Live Site:** [store.laughtale.my.id](https://store.laughtale.my.id)

## Features

### Public-Facing Website

- **Homepage:** A feature-rich landing page with server branding, IP address copying, and direct connection links.
- **Live Server Status:** An API-driven dashboard that displays real-time server status, including online player count, max slots, server version, and latency.
- **Dynamic Item Shop:** A web store powered by Supabase, allowing users to browse and "order" in-game items and cosmetics by generating a pre-filled WhatsApp message to an admin.
- **Documentation Gallery:** An interactive photo gallery that dynamically fetches and displays images from shared Google Drive folders, categorized by server seasons. It includes a full-screen lightbox viewer.
- **Server Information:** Detailed sections for server features (e.g., Claim Land, Tree Capitator, X-ray Tracking) and server rules.
- **Community & Donation:** Sections with links to the server's WhatsApp, Discord, Telegram, and TikTok communities, plus a QRIS code for donations.
- **Dynamic Banners:** Supports admin-configurable maintenance overlays and "Message of the Day" (MOTD) announcement banners.

## Technology Stack

- **Frontend:** Vanilla HTML, CSS, and JavaScript.
- **Backend-as-a-Service (BaaS):** [Supabase](https://supabase.com/) is used for:
    - Admin authentication.
    - Storing and serving `site_config` data (e.g., server IP, maintenance mode, MOTD).
    - Storing and serving `shop_items` and `shop_config` data for the web store.
- **APIs:**
    - **Google Drive API:** To dynamically load images for the `dokumentasi.html` gallery.
    - **`mcsrvstat.us` API:** To fetch real-time Minecraft server status.
- **Fonts:** Nunito and Press Start 2P.

## File Structure Overview

- `index.html`: The main landing page for the website.
- `dokumentasi.html`: The page for the server's photo gallery.
- `login.html`: Login page for the admin panel.
- `admin/`: Contains the admin panel interface and logic.
    - `admin/index.html`: The main page for the admin panel.
    - `admin/js/`: JavaScript files for handling authentication, configuration, and shop management.
- `js/`: Contains all client-side JavaScript for the public website.
    - `server-status.js`: Fetches and displays the Minecraft server status.
    - `shop.js` & `shop-supabase.js`: Logic for the web store functionality, pulling data from Supabase.
    - `supabase-sync.js`: Synchronizes website content with data from the `site_config` table in Supabase.
- `css/`: Contains stylesheets for the public website.
- `CNAME`: Custom domain configuration for GitHub Pages.
