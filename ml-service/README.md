# IMPORTANT!!!!!!!!!
Download test.zip from https://drive.google.com/file/d/1HKJuqN7yRDayQL-RXbdH0FssprPspFZl/view, extract it, and copy and paste model.hdf5 into the ml-service folder. Then proceed with the deployment.

# KneeVision ML Service

This service hosts the trained AI model used by KneeVision for knee X-ray severity prediction.

It is responsible for:
- loading the trained `model.hdf5`
- receiving an uploaded X-ray image
- generating the predicted KL grade
- returning confidence, class probabilities, and Grad-CAM explanation output

## Run Locally with Docker

Run from the project root:

```bash
docker build -t kneevision-ml ./ml-service
docker run --name kneevision-ml-container -p 8000:8000 kneevision-ml
```
or Run from the ml-service folder:

```bash
cd ml-service
docker build -t kneevision-ml .
docker run --name kneevision-ml-container -p 8000:8000 kneevision-ml
```
Once the container starts successfully, the service will be available at:

`http://localhost:8000`

### Notes
```bash
docker run --name kneevision-ml-container -p 8000:8000 kneevision-ml
```
 creates a new container from the kneevision-ml image and gives it the custom name kneevision-ml-container, which makes it easier to identify and manage later in Docker Desktop.
- If you run docker run multiple times without reusing the same container, Docker will create multiple stopped containers.
- If a container named kneevision-ml-container already exists, start it instead of creating a new one.
- To restart an existing container:
  
```bash
docker start kneevision-ml-container
```
- To stop the container:

```bash
docker stop kneevision-ml-container
```

## Available Endpoints

### Health Check

```http
GET /health
```

Example:

`http://localhost:8000/health`

Expected response:

```json
{
  "status": "ok"
}
```

### Prediction

```http
POST /predict
```

This endpoint accepts an image file upload (`png`, `jpg`, `jpeg`) and returns:
- predicted grade
- confidence
- severity label
- class probabilities
- summary
- Grad-CAM heatmap image as base64

## Integration with Backend

The main backend connects to this service through:

```env
ML_SERVICE_URL=http://localhost:8000
```

The backend endpoint:

```http
POST /api/v1/predict
```

will forward the saved uploaded image to this ML service and return the prediction result to the frontend.

## End-to-End Local Workflow

To run the full project locally, start services in this order:

1. **ML service**
   ```bash
   docker run -p 8000:8000 kneevision-ml
   ```

2. **Backend**
   ```bash
   cd backend
   npm run dev
   ```

3. **Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

Then:
- log in
- upload an image
- wait for prediction
- review the results page

## Notes

- The ML service currently runs on CPU in local development.
- If the model file changes, rebuild the Docker image.
- If port `8000` is already in use, update the Docker run command and backend `ML_SERVICE_URL` accordingly.
