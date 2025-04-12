# AdRemover Chrome Extension

A Chrome extension that blocks ads on all websites with special focus on YouTube ads.

## Features

- Blocks common ads across all websites
- Specifically targets and removes YouTube video ads
- Blocks pre-roll, mid-roll, and banner ads on YouTube
- Simple toggle to enable/disable ad blocking
- Tracks number of ads blocked

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store (link will be available once published)
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and active

## Usage

- The extension works automatically once installed
- Click on the extension icon in the toolbar to:
  - See the current status
  - Toggle ad blocking on/off
  - View basic statistics

## Customization

You can customize which types of ads are blocked by editing:
- `background.js` - For network request blocking
- `content.js` - For general DOM-based ad blocking
- `youtube.js` - For YouTube-specific ad blocking

## Limitations

- Some ads may still appear briefly before being removed
- Certain native advertising content may not be detected
- Website functionality that depends on ads might be affected

## Legal Notice

This extension is provided for educational purposes only. Using ad blockers may violate the terms of service of some websites. Use at your own discretion.

## License

This project is released under the MIT License.

## Privacy Policy

This extension does not collect or transmit any user data. All ad blocking happens locally on your device. 