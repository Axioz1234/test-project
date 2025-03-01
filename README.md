# Web to Google Docs Chrome Extension

A Chrome extension that automatically adds copied text from the web to a Google Doc.

## Features

- Copy text from any webpage and have it automatically added to a specified Google Doc
- Manual paste option via popup or floating button
- Keeps track of the source URL and title when copying text

## Installation

### Development Mode

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing this extension

### Configuration

Before using the extension, you need to:

1. Create a Google Cloud Platform project and set up OAuth credentials:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Docs API
   - Configure OAuth consent screen
   - Create OAuth credentials (Web application type)
   - Add `chrome-extension://<YOUR-EXTENSION-ID>` to the authorized redirect URIs

2. Update the `manifest.json` file:
   - After loading the extension to Chrome, find your extension ID in the chrome://extensions page
   - In Google Cloud Console, add `https://<YOUR-EXTENSION-ID>.chromiumapp.org/` as an authorized redirect URI
   - Get your OAuth client ID and update the manifest.json by replacing `PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com`

3. Create a Google Doc to use for your copied text:
   - Create a new Google Doc
   - Copy the document ID from the URL (the long string between `/d/` and `/edit`)

## Usage

1. Click on the extension icon in the Chrome toolbar
2. Paste your Google Doc ID in the input field
3. Click "Save Settings"
4. Click "Authorize with Google" and grant the necessary permissions
5. Now, whenever you copy text from a webpage, it will be automatically added to your specified Google Doc

## Options

- **Auto-paste**: When enabled, text is automatically added to your Doc when copied
- **Floating button**: When enabled, a button appears on webpages that allows you to quickly paste selected text

## License

MIT