import base64
import io
import os

import cv2
import numpy as np
import tensorflow as tf
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
TARGET_SIZE = (224, 224)
MODEL_PATH = os.environ.get("MODEL_PATH", "model.hdf5")
LAST_CONV_LAYER_NAME = os.environ.get(
    "LAST_CONV_LAYER_NAME",
    "global_average_pooling2d",
)

if not os.path.exists(MODEL_PATH):
    raise RuntimeError(f"Model file not found: {MODEL_PATH}")

model = tf.keras.models.load_model(MODEL_PATH)

# Build Grad-CAM model using the same logic your teammate used
grad_model = tf.keras.models.clone_model(model)
grad_model.set_weights(model.get_weights())
grad_model.layers[-1].activation = None

try:
    grad_model = tf.keras.models.Model(
        inputs=[grad_model.inputs],
        outputs=[
            grad_model.get_layer(LAST_CONV_LAYER_NAME).input,
            grad_model.output,
        ],
    )
except Exception as exc:
    raise RuntimeError(
        f"Could not build Grad-CAM model using layer '{LAST_CONV_LAYER_NAME}'. "
        f"Set LAST_CONV_LAYER_NAME correctly."
    ) from exc


def severity_label_from_grade(grade: str) -> str:
    mapping = {
        "Grade 0": "None",
        "Grade 1": "Doubtful",
        "Grade 2": "Mild",
        "Grade 3": "Moderate",
        "Grade 4": "Severe",
    }
    return mapping.get(grade, "Unknown")


def make_gradcam_heatmap(grad_model, img_array, pred_index=None):
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    heatmap = heatmap / (tf.reduce_max(heatmap) + 1e-8)
    heatmap = tf.maximum(heatmap, 0)
    return heatmap.numpy()


def save_gradcam_to_base64(img, heatmap, alpha=0.35):
    heatmap_uint8 = np.uint8(255 * heatmap)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    heatmap_color = cv2.resize(heatmap_color, (img.shape[1], img.shape[0]))

    if img.max() <= 1:
      img_uint8 = (img * 255).astype("uint8")
    else:
      img_uint8 = img.astype("uint8")

    superimposed_img = cv2.addWeighted(img_uint8, 1 - alpha, heatmap_color, alpha, 0)
    superimposed_img = cv2.cvtColor(superimposed_img, cv2.COLOR_BGR2RGB)

    pil_img = Image.fromarray(superimposed_img)
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return f"data:image/png;base64,{encoded}"


def predict_from_bytes(raw_bytes: bytes):
    pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    resized = pil_img.resize(TARGET_SIZE)

    img = np.array(resized).astype("float32")
    img_for_gradcam = img.copy()

    img_array = np.expand_dims(img, axis=0)
    img_array = tf.keras.applications.xception.preprocess_input(img_array)

    y_pred = model.predict(img_array, verbose=0)[0] * 100
    confidence = float(np.max(y_pred))
    pred_index = int(np.argmax(y_pred))
    grade = CLASS_NAMES[pred_index]

    heatmap = make_gradcam_heatmap(grad_model, img_array, pred_index=pred_index)
    heatmap_url = save_gradcam_to_base64(img_for_gradcam, heatmap)

    probabilities = [
        {
            "label": CLASS_NAMES[i],
            "value": round(float(y_pred[i]), 2),
        }
        for i in range(len(CLASS_NAMES))
    ]

    return {
        "grade": grade,
        "confidence": round(confidence, 2),
        "severityLabel": severity_label_from_grade(grade),
        "probabilities": probabilities,
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
        raise HTTPException(
            status_code=400,
            detail="Only PNG and JPEG images are supported.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = predict_from_bytes(raw_bytes)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc