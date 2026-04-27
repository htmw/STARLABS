import base64
import io
import os
import sqlite3

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms, models
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

app = FastAPI(title="KneeVision ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLASS_NAMES = ["Grade 0", "Grade 1", "Grade 2", "Grade 3", "Grade 4"]
TARGET_SIZE = 224
MODEL_PATH = os.environ.get("MODEL_PATH", "best_model_b4.pt")
DB_PATH = os.environ.get("DB_PATH", "kneevision_final.db")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class KOAEfficientNet(nn.Module):
    def __init__(self, num_classes=5):
        super().__init__()
        self.backbone = models.efficientnet_b4(weights=None)
        in_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        return self.backbone(x)


if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model file not found: {MODEL_PATH}")

model = KOAEfficientNet(num_classes=5).to(DEVICE)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.eval()

_checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
_state = _checkpoint.get("model_state_dict", _checkpoint)
_new_state = {}
for k, v in _state.items():
    if k.startswith("backbone.classifier"):
        continue
    if k.startswith("backbone."):
        _new_state[k[len("backbone."):]] = v

feature_extractor = models.efficientnet_b4(weights=None)
feature_extractor.load_state_dict(_new_state, strict=False)
feature_extractor.classifier = nn.Identity()
feature_extractor.eval()
feature_extractor.to(DEVICE)

preprocess = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((TARGET_SIZE, TARGET_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

feature_transform = transforms.Compose([
    transforms.Resize((380, 380)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

gradcam_target_layer = model.backbone.features[-1]
gradcam_activations = {}
gradcam_gradients = {}


def forward_hook(module, input, output):
    gradcam_activations["value"] = output.detach()

def backward_hook(module, grad_input, grad_output):
    gradcam_gradients["value"] = grad_output[0].detach()

gradcam_target_layer.register_forward_hook(forward_hook)
gradcam_target_layer.register_full_backward_hook(backward_hook)


def severity_label_from_grade(grade):
    mapping = {
        "Grade 0": "None",
        "Grade 1": "Doubtful",
        "Grade 2": "Mild",
        "Grade 3": "Moderate",
        "Grade 4": "Severe",
    }
    return mapping.get(grade, "Unknown")


def make_gradcam_heatmap(img_tensor, pred_index):
    img_tensor.requires_grad_(True)
    output = model(img_tensor)
    model.zero_grad()
    class_score = output[0, pred_index]
    class_score.backward()
    gradients = gradcam_gradients["value"]
    activations = gradcam_activations["value"]
    weights = torch.mean(gradients, dim=[2, 3], keepdim=True)
    heatmap = torch.sum(weights * activations, dim=1).squeeze()
    heatmap = torch.relu(heatmap)
    heatmap = heatmap / (heatmap.max() + 1e-8)
    return heatmap.cpu().numpy()


def save_gradcam_to_base64(img_np, heatmap, alpha=0.35):
    heatmap_resized = cv2.resize(heatmap, (img_np.shape[1], img_np.shape[0]))
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    if img_np.max() <= 1:
        img_uint8 = (img_np * 255).astype("uint8")
    else:
        img_uint8 = img_np.astype("uint8")
    if len(img_uint8.shape) == 2:
        img_uint8 = cv2.cvtColor(img_uint8, cv2.COLOR_GRAY2BGR)
    superimposed = cv2.addWeighted(img_uint8, 1 - alpha, heatmap_color, alpha, 0)
    superimposed = cv2.cvtColor(superimposed, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(superimposed)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def image_path_to_base64(image_path):
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{encoded}"
    except Exception as e:
        print(f"Image load error for {image_path}: {e}")
        return None


def extract_features(pil_img):
    pil_rgb = pil_img.convert("RGB")
    tensor = feature_transform(pil_rgb).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        vec = feature_extractor(tensor).squeeze().cpu().numpy()
    return vec


def cosine_similarity(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8))


def retrieve_similar(query_vec, kl_grade=None, top_n=5):
    if not os.path.exists(DB_PATH):
        return []

    conn = sqlite3.connect(DB_PATH)
    
    if kl_grade is not None:
        rows = conn.execute("""
            SELECT f.case_id, f.feature_vector,
                   c.image_path, c.kl_grade, c.dataset_source,
                   c.osteophyte_severity, c.joint_space_narrowing,
                   c.subchondral_sclerosis, c.bone_texture,
                   c.affected_compartment, c.overall_findings
            FROM features f
            JOIN cases c ON f.case_id = c.case_id
            WHERE c.kl_grade = ?
        """, (kl_grade,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT f.case_id, f.feature_vector,
                   c.image_path, c.kl_grade, c.dataset_source,
                   c.osteophyte_severity, c.joint_space_narrowing,
                   c.subchondral_sclerosis, c.bone_texture,
                   c.affected_compartment, c.overall_findings
            FROM features f
            JOIN cases c ON f.case_id = c.case_id
        """).fetchall()
    conn.close()

    scored = []
    for row in rows:
        vec = np.frombuffer(row[1], dtype=np.float32)
        sim = cosine_similarity(query_vec, vec)
        scored.append({
            "caseId": row[0],
            "similarity": round(sim, 4),
            "imagePath": row[2],
            "klGrade": row[3],
            "datasetSource": row[4],
            "osteophyteSeverity": row[5],
            "jointSpaceNarrowing": row[6],
            "subchondralSclerosis": row[7],
            "boneTexture": row[8],
            "affectedCompartment": row[9],
            "overallFindings": row[10],
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top = scored[:top_n]

    for case in top:
        case["imageBase64"] = image_path_to_base64(case["imagePath"])
        del case["imagePath"]

    return top


def predict_from_bytes(raw_bytes):
    pil_img = Image.open(io.BytesIO(raw_bytes)).convert("L")
    img_for_display = np.array(pil_img.resize((TARGET_SIZE, TARGET_SIZE)))

    img_tensor = preprocess(pil_img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(img_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0] * 100

    confidence = float(probabilities.max())
    pred_index = int(probabilities.argmax())
    grade = CLASS_NAMES[pred_index]

    heatmap = make_gradcam_heatmap(img_tensor.clone(), pred_index)
    heatmap_url = save_gradcam_to_base64(img_for_display, heatmap)

    prob_list = [
        {"label": CLASS_NAMES[i], "value": round(float(probabilities[i]), 2)}
        for i in range(len(CLASS_NAMES))
    ]

    query_vec = extract_features(pil_img)
    similar_cases = retrieve_similar(query_vec, kl_grade=pred_index, top_n=5)

    return {
        "grade": grade,
        "confidence": round(confidence, 2),
        "severityLabel": severity_label_from_grade(grade),
        "probabilities": prob_list,
        "summary": f"The model predicts {grade} with {confidence:.2f}% confidence.",
        "heatmapUrl": heatmap_url,
        "similarCases": similar_cases,
    }


class SimilarRequest(BaseModel):
    filePath: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file.")
    if file.content_type not in {"image/png", "image/jpeg", "image/jpg"}:
        raise HTTPException(status_code=400, detail="Only PNG and JPEG images are supported.")
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        result = predict_from_bytes(raw_bytes)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/similar")
async def similar(file: UploadFile = File(...), kl_grade: int = None):
    try:
        raw_bytes = await file.read()
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("L")
        query_vec = extract_features(pil_img)
        similar_cases = retrieve_similar(query_vec, kl_grade=kl_grade, top_n=5)
        return {"similarCases": similar_cases}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    
# ─── Quiz endpoint ────────────────────────────────────────────────────────────
# Returns a random case from the DB for the quiz feature.
# Difficulty filters which grades are included.
# The kl_grade is NOT returned to the frontend — only revealed after submission.
@app.get("/quiz/question")
def quiz_question(difficulty: str = "medium"):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database not found.")

    # filter grades based on difficulty
    if difficulty == "easy":
        grade_filter = "(0, 4)"
    elif difficulty == "hard":
        grade_filter = "(1, 2, 3)"
    else:  # medium — all grades
        grade_filter = "(0, 1, 2, 3, 4)"

    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(f"""
        SELECT case_id, image_path, kl_grade,
               osteophyte_severity, joint_space_narrowing,
               subchondral_sclerosis, bone_texture,
               affected_compartment, overall_findings
        FROM cases
        WHERE kl_grade IN {grade_filter}
          AND image_path IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1
    """).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No cases found.")

    image_base64 = image_path_to_base64(row[1])
    if not image_base64:
        raise HTTPException(status_code=500, detail="Could not load image.")

    return {
        "caseId": row[0],
        "imageBase64": image_base64,
        # metadata used for explanation after answer — grade hidden
        "osteophyteSeverity": row[3],
        "jointSpaceNarrowing": row[4],
        "subchondralSclerosis": row[5],
        "boneTexture": row[6],
        "affectedCompartment": row[7],
        "overallFindings": row[8],
    }


@app.get("/quiz/answer/{case_id}")
def quiz_answer(case_id: str):
    # returns the correct grade for a given case — called after user submits
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database not found.")

    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("""
        SELECT kl_grade, osteophyte_severity, joint_space_narrowing,
               subchondral_sclerosis, bone_texture,
               affected_compartment, overall_findings
        FROM cases WHERE case_id = ?
    """, (case_id,)).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Case not found.")

    return {
        "correctGrade": row[0],
        "osteophyteSeverity": row[1],
        "jointSpaceNarrowing": row[2],
        "subchondralSclerosis": row[3],
        "boneTexture": row[4],
        "affectedCompartment": row[5],
        "overallFindings": row[6],
    }
# ─── End Quiz endpoint ────────────────────────────────────────────────────────