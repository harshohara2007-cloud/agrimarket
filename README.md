# KrishiMarket — Farmer Camera & Real Crop Image Upload System

A complete, production-ready Camera and Crop Photography Upload system integrated directly into KrishiMarket (`https://krishimarket-seven.vercel.app`), configured and ready to run on **localhost** and in production.

---

## 1. Project Overview & Architecture

KrishiMarket is a full-stack smart agricultural market platform connecting Indian farmers directly to verified merchants, wholesalers, and retail chains. This upgrade delivers a secure, mobile-friendly camera capture and image upload pipeline:

- **Frontend**: React SPA with Tailwind CSS, Lucide icons, Dark/Light glassmorphism theme, and tri-lingual support (English, Hindi, Marathi).
- **Backend API & Persistent Storage**: Production-grade HTTP REST server with multipart upload handling, image validation, file compression, and persistent JSON/disk database.
- **Directory Structure**:
```
krishimarket/
├── backend/
│   ├── server.py              # Production Python HTTP & REST API server
│   ├── data/
│   │   └── lots.json          # Persistent database of crop listings & digital passports
│   └── uploads/
│       └── crops/             # Real crop photo persistent disk storage
├── public/
│   ├── index.html             # HTML5 entrypoint with Google Fonts
│   └── assets/
│       ├── index.css          # KrishiMarket design system & compiled Tailwind styles
│       └── index.js           # Upgraded React application bundle
├── run.bat                    # One-click Windows launch script
└── README.md                  # System documentation & test results
```

---

## 2. Key Features Implemented

### 📸 1. Farmer Camera Feature ("Take Crop Photo")
- **One-tap activation**: Accessible via the prominent **"📸 Take Crop Photo"** button (`📸 फसल की फोटो लें` / `📸 पिकाचा फोटो काढा`).
- **Live camera preview**: Uses browser `navigator.mediaDevices.getUserMedia` with video stream.
- **Camera switching**: Live toggle between Rear Camera (`facingMode: "environment"`) and Front Camera (`facingMode: "user"`), with the rear camera preferred by default.
- **Viewfinder with guides**: Visual framing guide focused on crop produce and natural lighting.
- **Capture, Retake, and Use**:
  - `📸 Capture Photo`: Grabs current frame to an off-screen HTML5 canvas.
  - `🔄 Retake Photo`: Instantly reopens the live viewfinder without saving the previous frame.
  - `✅ Use Photo`: Adds the captured photo to the attached photos list and closes the camera stream.
- **Graceful degradation & fallback**:
  - If camera permission is denied, camera is unavailable, or on unsupported desktop environments, displays a clear explanation with a direct switch to Gallery Upload.
  - Provides an accessible `<input type="file" accept="image/*" capture="environment">` fallback.
- **Safe stream cleanup**: All video tracks (`track.stop()`) are explicitly released when the camera closes, the component unmounts, or the user submits.

### 🖼️ 2. Gallery Upload ("Upload from Gallery")
- **Multi-image upload**: Supports selecting multiple crop photos (1 to 5 photos per listing).
- **Format validation**: Accepts JPEG, PNG, and WebP image formats. Unsupported formats or corrupted files display clear warnings.
- **File size limits**: Enforces a 10MB maximum file size per image.
- **Client-side compression**: Automatically resizes high-resolution camera photos (e.g., 12MP/4K) to max 1600px at 85% quality using an offscreen canvas to prevent network bottlenecks while preserving crisp crop details (calyx, skin, surface texture).
- **Photo management strip**:
  - `⭐ Primary` badge on the cover photo.
  - "Make Primary" button to reorder cover image.
  - `🔄 Replace` button to swap a specific image.
  - `✕ Remove` button to delete individual photos.

### 📋 3. Complete Crop Listing Form
Seamlessly integrated into the listing modal with all essential agricultural fields:
- Crop / Produce Name (e.g. Tomato, Grapes, Onion, Capsicum, Wheat, Soyabean)
- Crop Category (Vegetables, Fruits, Grains, Pulses, Spices, Cash Crops, Exotic)
- Variety / Hybrid (e.g. Shivam Hybrid, Thompson Seedless, Garwa)
- Quantity Available & Unit (Quintals, Kg, Tonnes, Crates, Bags)
- Expected Price (₹) & Pricing Unit (₹/Quintal, ₹/Kg, ₹/Tonne)
- Preliminary Quality Grade (Grade A+, Grade A, Grade B, Commercial)
- Harvest Date / Availability Date
- Farm Location (Village, District, State, Detailed Survey Address)
- Farmer Contact Number & Name
- Additional Quality Notes / Description (Textarea)
- Multi-lingual labels in English, Hindi, and Marathi.

### 💾 4. Real Backend & Persistent Storage
- **`POST /api/upload`**:
  - Handles multipart/form-data and dataURL payloads.
  - Server-side MIME type verification and magic byte validation.
  - Generates collision-resistant unique filenames (`crop_{timestamp}_{uuid}.jpg`).
  - Saves files to `backend/uploads/crops/`.
  - Returns permanent public URL `/uploads/crops/<filename>`.
- **`GET /uploads/crops/<filename>`**:
  - Serves uploaded crop images with proper `Content-Type` and `Cache-Control` headers.
- **`POST /api/lots`**:
  - Persists listing details, digital passport provenance events, and permanent image URLs into `backend/data/lots.json`.
  - Enforces farmer authorization and ownership checks.
- **`PUT /api/lots/<id>`**:
  - Allows farmers to edit listing details, add photos, replace photos, and remove photos.
  - Verifies ownership (`farmerId`).
- **`DELETE /api/lots/<id>`**:
  - Deletes listing and cleans up associated uploaded photos from disk.
- **`GET /api/lots`**:
  - Retrieves all active listings.
- **`GET /api/health`**:
  - Status check returning total lots and upload counts.

### 🛒 5. Merchant Marketplace Integration & Lightbox Zoom
- **Primary crop photo card**: The cover photo appears on every produce card in the B2B Marketplace (`Buyer Marketplace`).
- **Real Photo Badge**: Displays a `📷 Real Crop Photo` badge and total photo count (`🖼️ N Photos`).
- **High-Resolution Lightbox Zoom Modal**:
  - Merchants can tap any crop photo to open full-screen inspection mode.
  - Zoom controls: `🔍 +` (zoom in up to 300%), `🔍 -` (zoom out), and 100% reset.
  - Close button (`✕`) and keyboard `Escape` key listener.
  - Thumbnail carousel at bottom of lightbox allows browsing through all photos for that lot.
  - Header displays produce commodity, lot code, verified grade, location, and quantity.

### 📊 6. Farmer Dashboard & Management
- View active listings in "My Crop Lots" (`lots`) and "Farmer Home" (`home`).
- Multi-photo gallery preview in the active lot card with thumbnail selector.
- `✏️ Edit Listing & Photos` button: Opens an interactive modal to update price, quantity, harvest date, address, description, or add/remove photos.
- `🗑️ Delete Listing` button: Confirms and deletes lot from database and UI.

---

## 3. How to Run Locally

### Prerequisites
- Python 3.10+ (Standard library only; **no external pip packages required**!)
- Any modern web browser (Chrome, Edge, Firefox, Brave, Safari)

### Option A: One-Click Launch (Windows)
Double-click `run.bat` in the project root:
```cmd
run.bat
```

### Option B: Command Line Launch
Open PowerShell or Command Prompt in the project folder and run:
```cmd
python backend\server.py 8000
```

Open your browser and navigate to:
```
http://localhost:8000
```

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server status, version, and storage counts |
| `GET` | `/api/lots` | Retrieve all persistent crop listings |
| `POST` | `/api/lots` | Create a new crop listing with image URLs |
| `PUT` | `/api/lots/:id` | Update an existing listing details or photos |
| `DELETE` | `/api/lots/:id` | Delete a listing and clean up uploaded files |
| `POST` | `/api/upload` | Multipart/form-data upload returning permanent URL |
| `GET` | `/uploads/crops/:filename` | Serve uploaded crop photograph file |

---

## 5. Automated Test Verification Results

All automated tests passed:
```
[PASS] Test 1: GET /api/health -> 200 OK (Status: healthy, storage: persistent_disk)
[PASS] Test 2: GET /api/lots -> 200 OK (Retrieved active listings)
[PASS] Test 3: POST /api/upload -> 200 OK (Uploaded JPEG binary, validated magic bytes, saved to /uploads/crops/)
[PASS] Test 4: GET /uploads/crops/... -> 200 OK (Served exact binary with Content-Type: image/jpeg)
[PASS] Test 5: POST /api/lots -> 201 Created (Created lot with uploaded photo, assigned AGRI-2026-NASH-...)
[PASS] Test 6: GET /api/lots -> 200 OK (Confirmed listing persists in database)
[PASS] Test 7: PUT /api/lots/:id -> 200 OK (Updated price and verified in database)
[PASS] Test 8: Static Assets -> 200 OK (Served index.html, index.css, index.js)
```
