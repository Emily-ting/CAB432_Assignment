Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Yi-Ting(Emily), Chen
- **Student number:** n11530430
- **Partner name (if applicable):**
- **Application name:** The video transcode
- **Two line description:** This REST API provides a upload, download, and transcode of video.
- **EC2 instance name or ID:** i-0adabb3c6dbdd7553

------------------------------------------------

### Core - First data persistence service

- **AWS service name:**  S3
- **What data is being stored?:** video files, transcode files
- **Why is this service suited to this data?:** S3 is easy to manage and store large and varity data
- **Why is are the other services used not suitable for this data?:** It might have different type of data
- **Bucket/instance/table name:** n11530430-test
- **Video timestamp:** 0:08
- **Relevant files:**
    - /src/aws/clients.js
    - /src/controllers/videoController.js
    - /src/routes/videos.js
    - /src/services/storageS3.js

### Core - Second data persistence service

- **AWS service name:**  DynamoDB
- **What data is being stored?:** video data, transcode data
- **Why is this service suited to this data?:** These data are string array, so it is suitable to store in table
- **Why is are the other services used not suitable for this data?:** These data are structured, so use table is easy than others
- **Bucket/instance/table name:** n11530430-videos
- **Video timestamp:** 0:08
- **Relevant files:**
    - /src/aws/clients.js
    - /src/controllers/videoController.js
    - /src/models/videoModel.js

### Third data service

- **AWS service name:**
- **What data is being stored?:**
- **Why is this service suited to this data?:**
- **Why is are the other services used not suitable for this data?:**
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    

### S3 Pre-signed URLs

- **S3 Bucket names:** n11530430-test
- **Video timestamp:** 1:49
- **Relevant files:**
    - /src/services/storageS3.js
    - /src/controllers/videoController.js

### In-memory cache

- **ElastiCache instance name:**
- **What data is being cached?:**
- **Why is this data likely to be accessed frequently?:**
- **Video timestamp:**
- **Relevant files:**
    

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Only short-lived temporary files used during video transcoding (download from S3 → /tmp → ffmpeg → upload back to S3). No user or business data is stored locally
- **Why is this data not considered persistent state?:** These files are ephemeral scratch data required by ffmpeg. They are created in the OS temp directory, used for processing, and immediately deleted after the result is uploaded to S3
- **How does your application ensure data consistency if the app suddenly stops?:** All persistent data is stored in S3, DynamoDB, and Cognito, not on the server.
Temporary transcode files in /tmp are deleted after use and are safe to lose.
If the app crashes mid-task, the source video is still in S3.
The job remains "processing" in DynamoDB and can be retried safely.
This ensures data consistency without depending on local state.
- **Relevant files:**
    - /src/aws/clients.js
    - /src/controllers/videoController.js
    - /src/routes/videos.js
    - /src/services/storageS3.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:**
- **Method for handling lost connections:**
- **Relevant files:**


### Core - Authentication with Cognito

- **User pool name:** n11530430-assignment2-pools
- **How are authentication tokens handled by the client?:** After login, the client receives JWTs (IdToken, AccessToken, RefreshToken) from Cognito.
The client stores them securely (e.g. in memory or secure storage, not hardcoded).
For each API request, the client attaches the IdToken in the Authorization header.
When the token expires, the client can refresh it using the RefreshToken with Cognito.
- **Video timestamp:** 3:26
- **Relevant files:**
    - /src/controllers/authController.js
    - /src/middleware/authMiddleware.js
    - /src/routes/auth.js
    - /src/services/cognito.js

### Cognito multi-factor authentication

- **What factors are used for authentication:**
- **Video timestamp:**
- **Relevant files:**
    

### Cognito federated identities

- **Identity providers used:**
- **Video timestamp:**
- **Relevant files:**
    

### Cognito groups

- **How are groups used to set permissions?:** 'Admin' users can list all video data, add other users to group , and delete data which is belonged to other users
- **Video timestamp:** 5:04
- **Relevant files:**
    - /src/middleware/authMiddleware.js
    - /src/middleware/authorize.js
    - /src/routes/admin.js
    - /src/services/cognitoGroups.js

### Core - DNS with Route53

- **Subdomain:**
- **Video timestamp:**

### Parameter store

- **Parameter names:** /n11530430/app/COGNITO_CLIENT_ID, /n11530430/app/PEXELS_BASE_URL, 	
/n11530430/app/REGION, /n11530430/app/S3_BUCKET, /n11530430/app/COGNITO_USER_POOL_ID
- **Video timestamp:** 6:05
- **Relevant files:**
    - /src/aws/ssm.js
    - /src/services/pexelsService.js
    - /src/services/storageS3.js
    - /src/services/cognito.js
    - /src/services/cognitoGroups.js

### Secrets manager

- **Secrets names:** n11530430/cognito, n11530430/pexels
- **Video timestamp:** 6:05
- **Relevant files:**
    - /src/aws/secrets.js
    - /src/services/pexelsService.js
    - /src/services/cognito.js

### Infrastructure as code

- **Technology used:**
- **Services deployed:**
- **Video timestamp:**
- **Relevant files:**
    

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    