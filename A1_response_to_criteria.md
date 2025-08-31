Assignment 1 - REST API Project - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Yi-Ting(Emily), Chen
- **Student number:** n11530430
- **Application name:** The video transcode
- **Two line description:** This REST API provides a upload, download, and transcode of video.


Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** n11530430-my-awesome-repo
- **Video timestamp:** 0:22
- **Relevant files:**
    - /Dockerfile

### Deploy the container

- **EC2 instance ID:** i-0cc679d734b9f5871
- **Video timestamp:** 0:44

### User login

- **One line description:** Hard-coded username/password list. Using JWTs for sessions.
- **Video timestamp:** 1:24
- **Relevant files:**
    - /src/routes/auth.js
    - /src/middleware/authMiddleware.js

### REST API

- **One line description:** REST API with endpoints and HTTP methods (GET, POST, DELETE)
- **Video timestamp:** 1:22
- **Relevant files:**
    - /src/routes/auth.js
    - /src/routes/video.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### Data types

- **One line description:** Structured: string array, unstructured: video
- **Video timestamp:** 3:05
- **Relevant files:**
    - 

#### First kind

- **One line description:** vide data
- **Type:** array
- **Rationale:** record video data
- **Video timestamp:** 3:10
- **Relevant files:**
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

#### Second kind

- **One line description:** video
- **Type:** video
- **Rationale:** keep video
- **Video timestamp:** 3:15
- **Relevant files:**
  - /src/routes/video.js
  - /src/controllers/videoController.js
  - /src/models/videoModel.js

### CPU intensive task

 **One line description:** upload video and use ffmpeg to stabilise shaky video files
- **Video timestamp:** 3:22
- **Relevant files:**
    - /src/routes/video.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### CPU load testing

 **One line description:** use request to make the CPU usage become higher
- **Video timestamp:** 3:38
- **Relevant files:**
    - /src/routes/video.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** search with page
- **Video timestamp:** 2:05
- **Relevant files:**
    - /src/routes/video.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### External API(s)

- **One line description:** use pexel for search more video and download
- **Video timestamp:** 1:53
- **Relevant files:**
    - /src/routes/pexels.js
    - /src/services/pexelsService.js

### Additional types of data

- **One line description:** counter for download and transcode
- **Video timestamp:** 2:25
- **Relevant files:**
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### Custom processing

- **One line description:** ffmpeg
- **Video timestamp:** 2:45
- **Relevant files:**
    - /src/routes/video.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### Infrastructure as code

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 

### Web client

- **One line description:**
- **Video timestamp:**
- **Relevant files:**
    -   

### Upon request

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 