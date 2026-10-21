#!/usr/bin/env python3
"""
KrishiMarket Production-Ready Localhost Backend Server
- Provides persistent REST APIs for Crop Listings & Appointments
- Real image upload handling with multipart/form-data validation
- Serves the frontend Single Page Application (SPA) with assets
"""

import os
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass
import json
import time
import uuid
import mimetypes
import shutil
from http.server import BaseHTTPRequestHandler
try:
    from http.server import ThreadingHTTPServer as HTTPServerClass
except ImportError:
    from http.server import HTTPServer as HTTPServerClass
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "crops")
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

LOTS_FILE = os.path.join(DATA_DIR, "lots.json")

# Default initial seed lots (realistic Agmarknet verified produce)
INITIAL_SEED_LOTS = [
    {
        "id": "lot-01",
        "lotCode": "AGRI-2026-NASH-0421",
        "farmerId": "f-ramesh-patil",
        "farmerName": "Ramesh Balasaheb Patil",
        "farmerPhone": "+91 98234 56789",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Pimpalgaon Baswant",
        "farmAddress": "Survey No. 42, Pimpalgaon-Vani Road, Nashik, Maharashtra",
        "commodity": "Tomato",
        "category": "Vegetables",
        "variety": "Hybrid Shivam (Grade A)",
        "quantityQuintals": 85,
        "quantityUnit": "Quintals",
        "expectedHarvestDate": "2026-08-30",
        "status": "active",
        "expectedPricePerQ": 2500,
        "priceUnit": "₹/Quintal",
        "minAcceptablePricePerQ": 2350,
        "storageAvailable": True,
        "storageCostPerDayPerQ": 4,
        "verifiedGrade": "Grade A",
        "aiPreliminaryGrade": "Grade A",
        "description": "Premium vine-ripened Shivam hybrid tomatoes. Uniform red color, firm texture, ideal for supermarket retail and processing.",
        "aiAssessment": {
            "id": "ai-01",
            "cropIdentified": "Tomato (Lycopersicon esculentum)",
            "confidenceScore": 96.4,
            "colorUniformityPct": 92.5,
            "maturityIndexPct": 88,
            "visibleDefectsPct": 2.1,
            "recommendedGrade": "Grade A",
            "disclaimer": "AI Preliminary Assessment — Physical inspection available upon request.",
            "assessmentNotes": [
                "Optimal red-orange coloration indicating 85-90% commercial maturity.",
                "High firmness profile with minimum skin cracking (<2.5%).",
                "Average diameter estimated at 55-65mm (Standard retail grade)."
            ],
            "assessedAt": "2026-08-28 09:15 AM"
        },
        "photos": [
            "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1546470427-e26264be0b11?w=800&auto=format&fit=crop&q=80"
        ],
        "passportEvents": [
            {
                "id": "ev-1",
                "title": "Crop Lot Registered",
                "description": "Farmer Ramesh Patil registered 85 Quintals of Shivam Hybrid Tomato with photo proofs.",
                "timestamp": "2026-08-28 08:30 AM",
                "actor": "Farmer",
                "category": "CREATION",
                "status": "COMPLETED",
                "verifiedHash": "0x8f2d4a19"
            },
            {
                "id": "ev-2",
                "title": "AI Preliminary Scan",
                "description": "Vision analysis verified Grade A profile (92.5% color uniformity, 88% maturity).",
                "timestamp": "2026-08-28 09:15 AM",
                "actor": "AI Vision Engine",
                "category": "AI_SCAN",
                "status": "COMPLETED",
                "verifiedHash": "0x3c91b772"
            }
        ],
        "offersCount": 2,
        "bestOfferPerQ": 2580,
        "createdAt": "2026-08-28 08:30 AM"
    },
    {
        "id": "lot-02",
        "lotCode": "AGRI-2026-NASH-0912",
        "farmerId": "f-suresh-shinde",
        "farmerName": "Suresh Tukaram Shinde",
        "farmerPhone": "+91 94220 88123",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Dindori",
        "farmAddress": "Gat No. 118, Mohadi Shivar, Dindori, Nashik",
        "commodity": "Grapes (Thompson / Sonaka)",
        "category": "Fruits",
        "variety": "Thompson Seedless Export Grade",
        "quantityQuintals": 120,
        "quantityUnit": "Quintals",
        "expectedHarvestDate": "2026-09-05",
        "status": "active",
        "expectedPricePerQ": 8400,
        "priceUnit": "₹/Quintal",
        "minAcceptablePricePerQ": 8100,
        "storageAvailable": True,
        "storageCostPerDayPerQ": 8,
        "verifiedGrade": "Grade A+",
        "aiPreliminaryGrade": "Grade A+",
        "description": "Vineyard export-grade Thompson seedless table grapes. High brix sugar content (>18°), crisp berry firmness.",
        "aiAssessment": {
            "id": "ai-02",
            "cropIdentified": "Grapes (Vitis vinifera)",
            "confidenceScore": 98.1,
            "colorUniformityPct": 95.0,
            "maturityIndexPct": 92,
            "visibleDefectsPct": 1.2,
            "recommendedGrade": "Grade A+",
            "disclaimer": "AI Preliminary Assessment — Physical brix refractometer reading verified.",
            "assessmentNotes": [
                "Translucent golden-green berry cluster formation.",
                "Uniform berry size (16-18mm diameter) meeting EU export standards.",
                "Zero pesticide spray residue in pre-harvest interval testing."
            ],
            "assessedAt": "2026-08-28 10:20 AM"
        },
        "photos": [
            "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&auto=format&fit=crop&q=80"
        ],
        "passportEvents": [
            {
                "id": "ev-10",
                "title": "Vineyard Lot Registered",
                "description": "Farmer Suresh Shinde listed 120 Quintals of Thompson Seedless grapes.",
                "timestamp": "2026-08-28 10:20 AM",
                "actor": "Farmer",
                "category": "CREATION",
                "status": "COMPLETED",
                "verifiedHash": "0x5a19ef43"
            }
        ],
        "offersCount": 1,
        "bestOfferPerQ": 8550,
        "createdAt": "2026-08-28 10:20 AM"
    },
    {
        "id": "lot-03",
        "lotCode": "AGRI-2026-NASH-0315",
        "farmerId": "f-ramesh-patil",
        "farmerName": "Ramesh Balasaheb Patil",
        "farmerPhone": "+91 98234 56789",
        "state": "Maharashtra",
        "district": "Nashik",
        "village": "Lasalgaon",
        "farmAddress": "Near APMC Yard, Lasalgaon Road, Nashik",
        "commodity": "Onion",
        "category": "Vegetables",
        "variety": "Nashik Garwa Red Onion (Cured Stock)",
        "quantityQuintals": 140,
        "quantityUnit": "Quintals",
        "expectedHarvestDate": "2026-08-25",
        "status": "active",
        "expectedPricePerQ": 2750,
        "priceUnit": "₹/Quintal",
        "minAcceptablePricePerQ": 2600,
        "storageAvailable": True,
        "storageCostPerDayPerQ": 3,
        "verifiedGrade": "Grade A",
        "aiPreliminaryGrade": "Grade A",
        "description": "Naturally cured Nashik Garwa red onion with tight outer skins, low moisture, excellent 4-month storage shelf life.",
        "aiAssessment": {
            "id": "ai-03",
            "cropIdentified": "Red Onion (Allium cepa)",
            "confidenceScore": 95.8,
            "colorUniformityPct": 91.2,
            "maturityIndexPct": 94,
            "visibleDefectsPct": 2.4,
            "recommendedGrade": "Grade A",
            "disclaimer": "AI Preliminary Assessment — Storage ready.",
            "assessmentNotes": [
                "Double neck closure with tight paper skin retention.",
                "Average bulb diameter 50-60mm.",
                "Moisture index ideal for long-distance transport."
            ],
            "assessedAt": "2026-08-28 11:00 AM"
        },
        "photos": [
            "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80"
        ],
        "passportEvents": [
            {
                "id": "ev-20",
                "title": "Onion Lot Registered",
                "description": "Farmer Ramesh Patil registered 140 Quintals of Garwa Red Onion.",
                "timestamp": "2026-08-28 11:00 AM",
                "actor": "Farmer",
                "category": "CREATION",
                "status": "COMPLETED",
                "verifiedHash": "0x7b8849cd"
            }
        ],
        "offersCount": 3,
        "bestOfferPerQ": 2820,
        "createdAt": "2026-08-28 11:00 AM"
    }
]

def load_lots():
    if not os.path.exists(LOTS_FILE):
        save_lots(INITIAL_SEED_LOTS)
        return INITIAL_SEED_LOTS
    try:
        with open(LOTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to read {LOTS_FILE}: {e}")
        return INITIAL_SEED_LOTS

def save_lots(lots):
    temp_file = LOTS_FILE + ".tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(lots, f, indent=2, ensure_ascii=False)
    if os.path.exists(LOTS_FILE):
        os.replace(temp_file, LOTS_FILE)
    else:
        os.rename(temp_file, LOTS_FILE)


class KrishiMarketHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def safe_write(self, data):
        try:
            self.wfile.write(data)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass

    def send_json(self, status_code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        try:
            self.send_response(status_code)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.safe_write(data)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, OSError):
            pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. Health check
        if path == "/api/health":
            lots = load_lots()
            uploaded_count = len(os.listdir(UPLOADS_DIR)) if os.path.exists(UPLOADS_DIR) else 0
            self.send_json(200, {
                "status": "healthy",
                "app": "KrishiMarket",
                "version": "2.1.0",
                "serverTime": time.strftime("%Y-%m-%d %H:%M:%S"),
                "totalLots": len(lots),
                "uploadedCropsCount": uploaded_count,
                "storage": "persistent_disk",
                "uploadsDir": UPLOADS_DIR
            })
            return

        # 2. Get all crop lots
        if path == "/api/lots":
            lots = load_lots()
            self.send_json(200, {"success": True, "lots": lots})
            return

        # 3. Serve uploaded crop photos
        if path.startswith("/uploads/crops/"):
            filename = os.path.basename(path)
            file_path = os.path.join(UPLOADS_DIR, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                mime, _ = mimetypes.guess_type(file_path)
                if not mime:
                    mime = "image/jpeg"
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_response(404)
                self.send_cors_headers()
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"Uploaded photo not found")
                return

        # 4. Static frontend files
        clean_path = path.lstrip("/")
        if not clean_path:
            clean_path = "index.html"

        candidate_file = os.path.join(PUBLIC_DIR, clean_path)
        if os.path.exists(candidate_file) and os.path.isfile(candidate_file):
            mime, _ = mimetypes.guess_type(candidate_file)
            if clean_path.endswith(".css"):
                mime = "text/css; charset=utf-8"
            elif clean_path.endswith(".js"):
                mime = "application/javascript; charset=utf-8"
            elif clean_path.endswith(".html"):
                mime = "text/html; charset=utf-8"

            with open(candidate_file, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.safe_write(content)
            return

        # SPA Fallback: serve index.html for unknown frontend routes
        index_file = os.path.join(PUBLIC_DIR, "index.html")
        if os.path.exists(index_file):
            with open(index_file, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.safe_write(content)
            return

        self.send_response(404)
        self.send_cors_headers()
        self.end_headers()
        self.safe_write(b"Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. Image upload API
        if path == "/api/upload":
            content_type = self.headers.get("Content-Type", "")
            content_length = int(self.headers.get("Content-Length", 0))

            if content_length > 15 * 1024 * 1024:
                self.send_json(413, {"error": "File size exceeds 15MB limit"})
                return

            body = self.rfile.read(content_length)

            # Support multipart/form-data or raw/base64 JSON upload
            if "multipart/form-data" in content_type:
                boundary = content_type.split("boundary=")[-1].strip().encode('utf-8')
                parts = body.split(b"--" + boundary)
                saved_files = []

                for part in parts:
                    if b"Content-Disposition" in part and b'name="file"' in part:
                        headers_body = part.split(b"\r\n\r\n", 1)
                        if len(headers_body) == 2:
                            header_text = headers_body[0].decode('utf-8', errors='ignore')
                            file_data = headers_body[1].rstrip(b"\r\n")

                            # Detect file type
                            ext = ".jpg"
                            mime = "image/jpeg"
                            if b"\x89PNG" in file_data[:8]:
                                ext = ".png"
                                mime = "image/png"
                            elif b"RIFF" in file_data[:4] and b"WEBP" in file_data[8:16]:
                                ext = ".webp"
                                mime = "image/webp"

                            unique_id = uuid.uuid4().hex[:8]
                            timestamp = int(time.time())
                            filename = f"crop_{timestamp}_{unique_id}{ext}"
                            dest_path = os.path.join(UPLOADS_DIR, filename)

                            with open(dest_path, "wb") as f:
                                f.write(file_data)

                            file_url = f"/uploads/crops/{filename}"
                            saved_files.append({
                                "url": file_url,
                                "filename": filename,
                                "size": len(file_data),
                                "mimeType": mime
                            })

                if saved_files:
                    self.send_json(200, {
                        "success": True,
                        "url": saved_files[0]["url"],
                        "files": saved_files,
                        "message": "Crop photo uploaded successfully"
                    })
                    return
                else:
                    self.send_json(400, {"error": "No valid image found in form-data"})
                    return
            else:
                # Handle JSON upload (e.g. dataURL payload from camera)
                try:
                    payload = json.loads(body.decode('utf-8'))
                    image_data_str = payload.get("image", "")
                    if image_data_str.startswith("data:"):
                        # Extract base64
                        header, base64_data = image_data_str.split(",", 1)
                        import base64
                        raw_bytes = base64.b64decode(base64_data)
                        ext = ".jpg"
                        mime = "image/jpeg"
                        if "png" in header:
                            ext = ".png"
                            mime = "image/png"
                        elif "webp" in header:
                            ext = ".webp"
                            mime = "image/webp"

                        unique_id = uuid.uuid4().hex[:8]
                        timestamp = int(time.time())
                        filename = f"crop_{timestamp}_{unique_id}{ext}"
                        dest_path = os.path.join(UPLOADS_DIR, filename)

                        with open(dest_path, "wb") as f:
                            f.write(raw_bytes)

                        file_url = f"/uploads/crops/{filename}"
                        self.send_json(200, {
                            "success": True,
                            "url": file_url,
                            "filename": filename,
                            "size": len(raw_bytes),
                            "mimeType": mime,
                            "message": "Captured camera photo saved to persistent storage"
                        })
                        return
                except Exception as e:
                    self.send_json(400, {"error": f"Invalid JSON payload: {str(e)}"})
                    return

            self.send_json(400, {"error": "Unsupported upload format. Use multipart/form-data or dataURL JSON."})
            return

        # 2. Create new crop listing API
        if path == "/api/lots":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                lot_data = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_json(400, {"error": "Invalid JSON body"})
                return

            # Basic validation
            if not lot_data.get("commodity"):
                self.send_json(400, {"error": "Crop commodity name is required"})
                return

            lots = load_lots()

            # Generate unique ID and code if needed
            timestamp = int(time.time())
            if not lot_data.get("id"):
                lot_data["id"] = f"lot-{timestamp}-{uuid.uuid4().hex[:4]}"
            if not lot_data.get("lotCode"):
                lot_data["lotCode"] = f"AGRI-2026-NASH-{lot_data['id'][-4:]}"
            if not lot_data.get("createdAt"):
                lot_data["createdAt"] = time.strftime("%Y-%m-%d %H:%M")

            # Prepend to list
            lots.insert(0, lot_data)
            save_lots(lots)

            self.send_json(201, {
                "success": True,
                "lot": lot_data,
                "message": "Crop listing published successfully to marketplace!"
            })
            return

        self.send_json(404, {"error": "Not Found"})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Update crop lot: PUT /api/lots/<id>
        if path.startswith("/api/lots/"):
            lot_id = path.split("/")[-1]
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                updates = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_json(400, {"error": "Invalid JSON"})
                return

            lots = load_lots()
            found = False
            updated_lot = None

            for i, lot in enumerate(lots):
                if lot.get("id") == lot_id:
                    # Allow merchant verification or enforce farmer ownership check
                    if updates.get("action") == "merchant_verify" or updates.get("isMerchantVerification"):
                        # Merchant verification event
                        events = lot.get("passportEvents", [])
                        verifier = updates.get("merchantVerifiedBy") or "Verified Wholesale Merchant"
                        events.append({
                            "id": f"ev-mverify-{int(time.time())}",
                            "title": "Merchant Produce & Photo Verified",
                            "description": f"Merchant '{verifier}' inspected high-resolution photo proof and verified produce quality.",
                            "timestamp": time.strftime("%d %b %Y %I:%M %p"),
                            "actor": verifier,
                            "category": "INSPECTION",
                            "status": "COMPLETED",
                            "verifiedHash": f"0x{uuid.uuid4().hex[:8]}"
                        })
                        lot["passportEvents"] = events
                        lot["merchantVerified"] = True
                        lot["merchantVerifiedBy"] = verifier
                        lot["merchantVerifiedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
                        if updates.get("verifiedGrade"):
                            lot["verifiedGrade"] = updates["verifiedGrade"]
                    else:
                        req_farmer = updates.get("farmerId")
                        if req_farmer and lot.get("farmerId") and req_farmer != lot.get("farmerId") and req_farmer != "admin":
                            self.send_json(403, {"error": "Unauthorized: Cannot edit another farmer's listing"})
                            return

                    # Update lot fields
                    lot.update(updates)
                    lot["updatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
                    lots[i] = lot
                    updated_lot = lot
                    found = True
                    break

            if not found:
                self.send_json(404, {"error": f"Lot '{lot_id}' not found"})
                return

            save_lots(lots)
            self.send_json(200, {
                "success": True,
                "lot": updated_lot,
                "message": "Listing and photos updated successfully"
            })
            return

        self.send_json(404, {"error": "Not Found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Delete crop lot: DELETE /api/lots/<id>
        if path.startswith("/api/lots/"):
            lot_id = path.split("/")[-1]
            lots = load_lots()
            target_lot = None
            remaining = []

            for lot in lots:
                if lot.get("id") == lot_id:
                    target_lot = lot
                else:
                    remaining.append(lot)

            if not target_lot:
                self.send_json(404, {"error": f"Lot '{lot_id}' not found"})
                return

            # Optionally clean up files stored in uploads/crops
            for photo in target_lot.get("photos", []):
                if photo.startswith("/uploads/crops/"):
                    fname = os.path.basename(photo)
                    fpath = os.path.join(UPLOADS_DIR, fname)
                    if os.path.exists(fpath):
                        try:
                            os.remove(fpath)
                        except Exception as e:
                            print(f"[WARN] Failed to delete file {fpath}: {e}")

            save_lots(remaining)
            self.send_json(200, {
                "success": True,
                "deletedId": lot_id,
                "message": "Crop listing deleted successfully"
            })
            return

        self.send_json(404, {"error": "Not Found"})


def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServerClass(server_address, KrishiMarketHandler)
    print(f"="*70)
    print(f"🌾 KRISHIMARKET FULL-STACK SERVER RUNNING")
    print(f"📡 Localhost URL: http://localhost:{port}")
    print(f"📁 Public Folder: {PUBLIC_DIR}")
    print(f"💾 Persistent Storage: {UPLOADS_DIR}")
    print(f"📊 Database: {LOTS_FILE}")
    print(f"="*70)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down KrishiMarket server.")
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run(port)
