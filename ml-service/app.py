import base64
import io
import os

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms, models
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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

preprocess = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((TARGET_SIZE, TARGET_SIZE)),
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

    return {
        "grade": grade,
        "confidence": round(confidence, 2),
        "severityLabel": severity_label_from_grade(grade),
        "probabilities": prob_list,
        "summary": f"The model predicts {grade} with {confidence:.2f}% confidence.",
        "heatmapUrl": heatmap_url,
    }


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